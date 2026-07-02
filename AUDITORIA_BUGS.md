# Auditoría de código — Grace (backend + frontend)

**Fecha:** 2026-07-02
**Alcance:** `gestion_panaderia` (app Frappe) y `grace-core-frontend` (React/Vite).
**Criterio de evaluación:** solución productiva para una micro-empresa — se califica que funcione, que sea razonablemente segura y que un equipo de 1 persona pueda mantenerla. No se exige infraestructura de empresa grande.

---

## Puntuación

| Repo | Antes | Después de corregir | Qué mueve la aguja |
|---|---|---|---|
| Backend (Frappe) | **7.5 / 10** | **9 / 10** | Bug #3 (dato de negocio falso), fuga de costos, carrera de folios |
| Frontend (React) | **7 / 10** | **9 / 10** | XSS, login roto con contraseñas válidas, lint inutilizado |
| **Global** | **7.2 / 10** | **9 / 10** | |

**Por qué 7 y no menos:** la arquitectura está por encima del promedio de proyectos de este tamaño: guard de roles centralizado y fail-closed en ambos lados, SQL 100% parametrizado, doctype Egreso cerrado a REST estándar, proxy same-origin sin CORS ni tokens en JS, anti-tampering server-side, 116 tests que pasan, deuda técnica marcada con comentarios `ponytail:`. Eso no es nivel escolar.

**Por qué no 9 todavía:** hay 2 vulnerabilidades reales (XSS en tickets, fuga de costos), 2 bugs que dan información falsa al negocio (inventario "agotado" vacío, proveedores invertidos), y 1 que bloquea usuarios legítimos (sanitizado de contraseña). Ninguno es difícil de corregir — por eso el "después" sube tanto con tan poco diff.

**Por qué no llega a 10 ni corrigiendo:** el POS offline no tiene drenado de outbox (está documentado y bloqueado para prod, correcto, pero es la pieza mayor pendiente) y no hay CI que corra lint+tests automáticamente.

---

## Bugs ordenados de mayor a menor riesgo

Riesgo = probabilidad de que ocurra × daño si ocurre, en el contexto de una panadería con ~5-10 usuarios internos.

---

### 1. 🔴 XSS en tickets de impresión (frontend)

**Dónde:** `src/utils/print/ticketTemplate.js:43,109` y `src/services/printService.js:117-125`

```js
// ticketTemplate.js — interpolación SIN escapar:
<td style="...">
  ${i.item_name}<br/>                       // ← nombre de item, crudo
  ...
<div class="info-row"><span>CLIENTE:</span><span>${cliente || 'Público en General'}</span></div>

// printService.js (_htmlEgreso) — igual:
${p.concepto ? `<div>Concepto   : ${p.concepto}</div>` : ''}
${p.no_factura ? `<div>NO. FACTURA: ${p.no_factura}</div>` : ''}
```

Ese HTML se inyecta con `win.document.write(html)` en una ventana `about:blank` abierta con `window.open()`.

**Por qué es un error:** una ventana `about:blank` abierta por tu app **hereda el origen de la app**. Un script que corra ahí tiene acceso a la sesión (cookies, localStorage) del usuario que imprime. `item_name`, `cliente`, `concepto` y `no_factura` son texto libre capturado por usuarios: si alguien guarda un item o un egreso con nombre `<img src=x onerror="fetch('/api/...')">`, el script se ejecuta cuando **otro usuario** (por ejemplo el Gerente) imprime el ticket. Es un XSS almacenado clásico. React te protege en JSX, pero aquí saliste de React: armas HTML a mano.

**La solución:** ya existe `escHTML` en `comprasPrint.js:4` (los modales de recibo sí lo usan — el hueco es solo en estos 2 archivos). Moverlo a un util compartido y envolver toda interpolación de texto:

```js
// src/utils/print/escHTML.js  (nuevo, 4 líneas — extraído de comprasPrint.js)
export const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// ticketTemplate.js:
${escHTML(i.item_name)}<br/>
<span>${escHTML(cliente || 'Público en General')}</span>

// printService.js (_htmlEgreso):
${p.concepto ? `<div>Concepto   : ${escHTML(p.concepto)}</div>` : ''}
```

Los números formateados con `fmtVal`/`_fmt2` no necesitan escape (pasan por `Number()`, no pueden contener HTML).

**Por qué resuelve el problema:** el escape convierte los 5 caracteres con significado en HTML (`& < > " '`) en entidades inertes. `<img onerror=...>` se imprime literalmente como texto en el ticket en lugar de ejecutarse. El navegador ya no puede interpretar el dato como markup — se corta el vector por definición, sin listas negras que se puedan brincar.

---

### 2. 🔴 El login sanitiza la contraseña (frontend)

**Dónde:** `src/pages/Login.jsx:67-68`

```js
const usuarioLimpio = sanitizar(formData.usuario);
const contraLimpia  = sanitizar(formData.contrasena);   // ← BUG
```

Y `sanitizar` hace (`src/utils/security.js:111-120`):

```js
return valor
  .replace(/<[^>]*>?/gm, '')   // borra todo lo que parezca etiqueta
  .replace(/\0/g, '')
  .trim();                      // borra espacios al inicio/final
```

**Por qué es un error:** una contraseña es un secreto opaco que se compara byte a byte contra un hash en el servidor. Si el usuario tiene la contraseña `Pan<2026!` o ` hola123` (con espacio), `sanitizar` la convierte en `Pan` o `hola123` **antes de enviarla** → Frappe recibe otra cadena → login rechazado **con la contraseña correcta**. El usuario reintenta, tu propio rate limiter lo bloquea 5 minutos, y nadie puede diagnosticarlo porque el bug es invisible (nada truena, solo "credenciales inválidas"). Además no aporta seguridad: la contraseña viaja en el body de un POST y Frappe la hashea — nunca se renderiza como HTML.

**La solución:**

```js
const usuarioLimpio = sanitizar(formData.usuario);
const contraLimpia  = formData.contrasena;   // NUNCA transformar contraseñas
```

**Por qué resuelve el problema:** el servidor recibe exactamente los bytes que el usuario tecleó, que es el contrato de cualquier autenticación. El riesgo XSS que `sanitizar` mitiga no existe para este campo (jamás se muestra), así que no pierdes nada. Regla general que deja este bug: **validar** contraseñas (longitud) está bien; **mutarlas**, nunca.

---

### 3. 🔴 "Agotados por almacén" siempre devuelve lista vacía (backend)

**Dónde:** `gestion_panaderia/api/inventory_api.py:74-86`

```python
query = (
    frappe.qb
    .from_(Item)
    .left_join(Bin).on(
        (Bin.item_code == Item.item_code) & (Bin.actual_qty > 0)
    )
    .select(*_cols_item(Item))
    .where(Item.disabled == 0)
    .where(Bin.item_code.isnull())          # ← quiere "items SIN bin con stock"
)
query = _aplicar_filtros_item(query, Item, Bin, warehouse=warehouse, ...)
# _aplicar_filtros_item agrega:  query.where(Bin.warehouse == warehouse)   ← BUG
```

**Por qué es un error:** contradicción lógica en SQL. El `WHERE Bin.item_code IS NULL` selecciona filas donde el LEFT JOIN **no encontró** Bin — en esas filas **todas** las columnas de Bin son NULL, incluida `Bin.warehouse`. Al agregar después `WHERE Bin.warehouse = 'X'`, pides `NULL = 'X'`, que en SQL nunca es verdadero. Resultado: en cuanto el usuario filtra "agotados" por almacén, la lista sale vacía **siempre** — y una lista de agotados vacía se lee como "no falta nada", que es información de compra falsa para el negocio.

**La solución:** la condición de warehouse debe vivir en el `ON` del join (restringe qué bins cuentan), no en el `WHERE` (que filtra el resultado final):

```python
on_cond = (Bin.item_code == Item.item_code) & (Bin.actual_qty > 0)
if warehouse:
    on_cond &= (Bin.warehouse == warehouse)

query = (
    frappe.qb
    .from_(Item)
    .left_join(Bin).on(on_cond)
    .select(*_cols_item(Item))
    .where(Item.disabled == 0)
    .where(Bin.item_code.isnull())
)
# y ya NO pasar warehouse a _aplicar_filtros_item en esta vista:
query = _aplicar_filtros_item(query, Item, Bin, item_group=item_group,
                              departamento=departamento)
```

**Por qué resuelve el problema:** con la condición en el `ON`, la pregunta cambia a "para este item, ¿existe un bin con stock **en este almacén**?". Si no existe, el LEFT JOIN produce la fila con Bin en NULL → sobrevive el `IS NULL` → el item aparece como agotado en ese almacén. La semántica del filtro por fin coincide con lo que el usuario ve en pantalla.

---

### 4. 🔴 Outbox del POS se escribe pero nadie lo drena (frontend)

**Dónde:** `src/pages/POS.jsx:258-281` — **ya documentado por ti** con comentario `ponytail:` y la nota "NO activar el POS en prod sin esto". No es un hallazgo nuevo; se lista porque en riesgo absoluto es el mayor pendiente.

```js
// ponytail: outbox se escribe pero NADIE lo drena → ventas no llegan al backend.
await db.transaction('rw', db.outbox, db.stock, async () => {
  await db.outbox.add(venta);
  ...
});
```

**Por qué es un error (cuando el POS entre a prod):** las ventas viven únicamente en IndexedDB del navegador de la caja. Borrar datos de navegación, cambiar de máquina o un disco muerto = ventas perdidas sin rastro contable. Además el stock local se descuenta pero el central no se entera.

**La solución (el plan de tu propio comentario, confirmado):** listener de `online` + intervalo → leer outbox → enviar por `uuid` → borrar del outbox al confirmar. Y del lado Frappe, idempotencia: campo `custom_uuid_offline` con índice único + endpoint que haga create+submit atómico y responda "ya existe" sin duplicar, para que un reintento tras timeout no genere doble venta.

**Por qué resuelve el problema:** la cola con reintento garantiza *at-least-once* (ninguna venta se pierde); el índice único por uuid garantiza *at-most-once* (ninguna se duplica). Juntas dan *exactly-once efectivo*, que es lo que una caja necesita. Sin la parte del servidor, el reintento solo convierte "venta perdida" en "venta cobrada dos veces" — por eso van juntas.

---

### 5. 🟠 Fuga de costos a cualquier usuario autenticado (backend)

**Dónde:** `gestion_panaderia/api/regalos.py:25-39`

```python
@frappe.whitelist()
def get_regalo_defaults(item_code):
    """Pre-fill del form: rate de mercado sugerido = valuation_rate actual del item."""
    if not item_code:
        return {}
    item = frappe.db.get_value(
        "Item", item_code,
        ["item_name", "stock_uom", "valuation_rate"],   # ← costo real del insumo
        as_dict=True,
    ) or {}
```

**Por qué es un error:** es el único endpoint del módulo sin `require_roles`. Cualquier usuario autenticado — incluido un **Vendedor** de mostrador — puede llamar `/api/method/...get_regalo_defaults?item_code=X` e iterar el catálogo para extraer el `valuation_rate` (costo real) de cada insumo. El margen del negocio es información sensible; el resto del módulo (OFICINA) lo reconoce, este endpoint lo regala.

**La solución:**

```python
@frappe.whitelist()
def get_regalo_defaults(item_code):
    require_roles(*OFICINA)
    ...
```

**Por qué resuelve el problema:** `require_roles` corta con `PermissionError` antes de tocar la base si el usuario no tiene rol de oficina. Queda alineado con `registrar_regalo` (mismo módulo, mismo guard), y el único front que llama este endpoint es el form de regalos, que solo ven usuarios de oficina — cero impacto funcional.

---

### 6. 🟠 Filtro de proveedores invertido: "incluir deshabilitados" oculta los activos (backend)

**Dónde:** `gestion_panaderia/api/proveedores_api.py:100-104`

```python
if not incluir_deshabilitados:
    query = query.where(Supplier.disabled == 0)
else:
    query = query.where(Supplier.disabled == 1)   # ← "incluir" muestra SOLO deshabilitados
```

**Por qué es un error:** el nombre del parámetro promete "activos + deshabilitados"; el código entrega "solo deshabilitados". Quien consuma el endpoint confiando en el nombre esconderá todos los proveedores activos sin ningún error visible. Los bugs de semántica invertida son los que más sobreviven porque cada lado asume que el otro está bien.

**La solución:** decidir el contrato y hacer que nombre y código coincidan. Si el front lo usa como toggle "ver papelera" (lo más probable dado el ordenamiento por `modified`), renombrar:

```python
def get_proveedores_con_contactos(search=None, grupo=None, solo_deshabilitados="0"):
    ...
    query = query.where(Supplier.disabled == (1 if cint(solo_deshabilitados) else 0))
```

Si de verdad se quería "incluir ambos": eliminar el `else` y ya.

**Por qué resuelve el problema:** el bug no es la lógica en sí sino la mentira del nombre. Con `solo_deshabilitados` el comportamiento actual se vuelve correcto por definición y el próximo que lea la firma no puede malinterpretarla. (Ajustar el caller en `frappeSupplier.js` al renombrar.)

---

### 7. 🟠 Carrera en el consecutivo de compras (backend)

**Dónde:** `gestion_panaderia/api/compras_api.py:6-14`

```python
def siguiente_no_compra():
    pr = frappe.db.sql(
        "select max(custom_no_de_compra) from `tabPurchase Receipt` where docstatus in (0, 1)"
    )[0][0] or 0
    eg = frappe.db.sql("select max(no_de_compra) from `tabEgreso`")[0][0] or 0
    return max(pr, eg) + 1
```

**Por qué es un error:** patrón *read-max-then-write* sin lock. Dos capturistas registrando a la vez leen el mismo `max` → ambos obtienen el mismo folio → dos compras distintas con el mismo número de control. Con 2-3 usuarios la probabilidad por día es baja, pero el folio es tu referencia de control interno/fiscal: un duplicado descubierto meses después es carísimo de auditar.

**La solución mínima honesta** (si aceptas el riesgo, documenta el techo):

```python
# ponytail: max+1 sin lock; folio duplicado posible con captura concurrente.
# Si pasa: bloquear con SELECT ... FOR UPDATE (abajo) o migrar a naming_series.
```

**La solución real** (una línea de SQL distinta — serializa a los concurrentes):

```python
def siguiente_no_compra():
    pr = frappe.db.sql(
        "select max(custom_no_de_compra) from `tabPurchase Receipt` "
        "where docstatus in (0, 1) for update"
    )[0][0] or 0
    eg = frappe.db.sql("select max(no_de_compra) from `tabEgreso` for update")[0][0] or 0
    return max(pr, eg) + 1
```

**Por qué resuelve el problema:** `FOR UPDATE` toma un lock sobre las filas leídas dentro de la transacción del request; la segunda captura concurrente **espera** a que la primera termine (commit) y entonces lee el max ya incrementado. Convierte "los dos leen 41, los dos escriben 42" en "uno escribe 42, el otro lee 42 y escribe 43". Costo: milisegundos de espera solo cuando de verdad hay concurrencia.

---

### 8. 🟠 Manejo offline muerto en el cliente HTTP (frontend)

**Dónde:** `src/services/FrappeBase.js:28-29`

```js
// Sin conexión — retornar null de forma controlada
if (response.status === 0) return null;
```

**Por qué es un error:** `fetch()` **nunca** resuelve con `status === 0`. Cuando no hay red, la promesa **rechaza** con `TypeError` antes de que exista `response`. Esa línea es inalcanzable, y lo peligroso es el comentario: promete un contrato ("offline → null controlado") que no se cumple — cualquier caller que haga `if (data === null)` para el caso offline en realidad recibirá una excepción no manejada. En una app cuyo pitch es offline-first, el manejo de offline del cliente base debe ser real.

**La solución:**

```js
let response;
try {
  response = await fetch(`${this.baseUrl}${path}`, fetchOptions);
} catch (e) {
  if (e instanceof TypeError) return null;   // sin red — contrato: null controlado
  throw e;
}
```

**Por qué resuelve el problema:** captura el fallo donde realmente ocurre (el reject de la promesa) y ahí sí devuelve el `null` que el comentario prometía. El contrato pasa de ficticio a real y los callers que ya lo esperaban empiezan a funcionar sin cambios.

---

### 9. 🟠 Contraseña sin validar al crear usuario (backend)

**Dónde:** `gestion_panaderia/api/cuentas_api.py` — `editar_usuario` valida (línea 138), `crear_usuario` no (línea 70):

```python
def crear_usuario(email, nombre, password, nivel, pos_profile=None):
    _solo_admin()
    ...
    user = frappe.get_doc({..., "new_password": password, ...})   # ← sin check de longitud

# vs editar_usuario:
    if len(password) < 6:
        frappe.throw(_("La contraseña debe tener al menos 6 caracteres"))
```

**Por qué es un error:** inconsistencia entre las dos puertas del mismo dato. Si la password policy del site está apagada, el dueño puede crear una cuenta con contraseña `1` — y las cuentas POS de mostrador son justo las que acaban con contraseñas triviales compartidas.

**La solución:** un helper y usarlo en ambos lados:

```python
def _validar_password(password):
    if not password or len(password) < 8:
        frappe.throw(_("La contraseña debe tener al menos 8 caracteres"))
```

**Por qué resuelve el problema:** una sola regla, imposible que las dos rutas diverjan de nuevo. 8 en lugar de 6 porque el costo de teclear 2 caracteres extra es nulo y el espacio de búsqueda de fuerza bruta crece ~4 órdenes de magnitud.

---

### 10. 🟡 `page_size=0` tumba el endpoint de proveedores (backend)

**Dónde:** `gestion_panaderia/api/proveedores_api.py:31,39`

```python
start=(cint(page) - 1) * cint(page_size),
...
"total_pages": -(-total // cint(page_size)),   # ← ZeroDivisionError si page_size=0
```

**Por qué es un error:** `cint("0")` y `cint("abc")` devuelven 0 → división entre cero → HTTP 500. Un query string manipulado o un bug del front tira el endpoint completo en lugar de degradar.

**La solución:**

```python
page_size = max(cint(page_size), 1)
page = max(cint(page), 1)
```

**Por qué resuelve el problema:** clamp de una línea en la frontera de confianza. Todo input basura colapsa al valor mínimo válido; el 500 se vuelve imposible por construcción y no hay que confiar en que el front siempre mande bien.

---

### 11. 🟡 `marcar_pagado` responde éxito sobre egresos inexistentes (backend)

**Dónde:** `gestion_panaderia/api/egresos_api.py:130-135`

```python
@frappe.whitelist()
def marcar_pagado(name, pagado=1):
    require_roles(*OFICINA)
    frappe.db.set_value("Egreso", name, "pagado", int(pagado or 0))   # ← no falla si no existe
    return {"name": name, "pagado": int(pagado or 0)}
```

**Por qué es un error:** `db.set_value` sobre un `name` inexistente actualiza 0 filas sin quejarse. El front recibe `{ok}` y pinta el egreso como pagado aunque no se tocó nada (típico tras un borrado concurrente en otra pestaña). En cuentas por pagar, un falso "pagado" es dinero que se deja de cobrar/pagar.

**La solución:**

```python
if not frappe.db.exists("Egreso", name):
    frappe.throw(_("El egreso {0} no existe").format(name))
frappe.db.set_value("Egreso", name, "pagado", int(pagado or 0))
```

**Por qué resuelve el problema:** convierte el fallo silencioso en un error visible que el front ya sabe mostrar (toast de error). La UI nunca puede quedar en un estado que la base no respalda.

---

### 12. 🟡 `useEffect` que corre en cada render (frontend)

**Dónde:** `src/components/ProtectedRoute.jsx:11-18`

```js
const user = auth.getUser();          // JSON.parse → objeto NUEVO en cada render
...
useEffect(() => {
  if (!user) return;
  Promise.all([loadAppConfig(), loadSucursalesConfig()]).catch(() => {});
}, [user]);                            // ← identidad nueva cada vez → dispara siempre
```

**Por qué es un error:** React compara dependencias por identidad (`Object.is`). `getUser()` parsea localStorage en cada render y devuelve un objeto nuevo aunque el contenido sea idéntico → la dependencia "cambió" siempre → el efecto corre en **cada render** de cada página protegida, no una vez por sesión. Los caches internos de `load*Config` amortiguan el daño, pero el patrón es el antipatrón #1 de hooks: dependencia de objeto recreado.

**La solución:**

```js
useEffect(() => {
  if (!user) return;
  Promise.all([loadAppConfig(), loadSucursalesConfig()]).catch(() => {});
}, [user?.email]);   // primitivo estable: solo re-corre si cambia la sesión
```

**Por qué resuelve el problema:** un string se compara por valor. `user?.email` solo cambia en login/logout real, que es exactamente la semántica que el efecto quería: "precargar configs cuando hay una sesión". De paso queda el patrón correcto para el resto del código: **dependencias primitivas, no objetos recreados**.

---

### 13. 🟡 Ruta muerta `/consultas/inventario` (frontend)

**Dónde:** `src/App.jsx:123-130` registra la ruta; `src/config/roles.js` (función `rutasDe`) no la incluye en **ningún** nivel:

```js
// roles.js — rutasDe() genera:
...(modulos.includes('pos') ? ['/consultas/pos'] : []),
...(modulos.includes('inventario') ? ['/consultas/kardex'] : []),
// '/consultas/inventario' no aparece nunca
```

**Por qué es un error:** `ProtectedRoute` redirige al `inicio` cualquier ruta fuera de la lista del rol → `ConsultasInventario.jsx` es inalcanzable para todos, incluido el Gerente. Es código muerto con costo de mantenimiento (se compila, se lee, confunde), y ningún grep de "¿quién la navega?" encuentra nada.

**La solución:** todo indica que Kardex la reemplazó. Borrar la ruta de `App.jsx`, el import, y `src/pages/ConsultasInventario.jsx`. (Si la querías viva: una línea en `rutasDe` — pero decide, no la dejes en limbo.)

**Por qué resuelve el problema:** el código muerto no se arregla, se elimina — cada línea que no existe es una línea que no puede tener bugs ni desviar a quien lee. Git la guarda si algún día vuelve.

---

### 14. 🟡 `frappe.db.commit()` manual en endpoints (backend)

**Dónde:** `gestion_panaderia/api/compras_api.py:53, 65, 82`

```python
for n in lista:
    ...
    frappe.db.set_value("Purchase Receipt", n, "custom_consolidado", 1)
frappe.db.commit()   # ← innecesario en un request handler
```

**Por qué es un error:** Frappe hace commit automático al terminar el request con éxito y **rollback** si explota. Los commits manuales aquí son redundantes hoy y una trampa mañana: si alguien agrega lógica después del commit y esa lógica falla, la primera mitad ya quedó escrita → estado a medias (grupo medio consolidado, cascada medio cancelada).

**La solución:** borrar las 3 líneas. (El de `cuentas_api.py:151` **sí se queda**: está justificado con comentario — deadlock del `rename_doc`.)

**Por qué resuelve el problema:** restaura la atomicidad por request que el framework ya garantiza: o todo el grupo se consolida/cancela, o nada. Menos código y más correcto a la vez.

---

### 15. 🟡 Lint con 677 errores = lint que nadie lee (frontend)

**Dónde:** `eslint.config.js` — la regla `react/prop-types` genera 626 de los 677 errores en un proyecto que no usa PropTypes.

**Por qué es un error:** una herramienta que siempre grita se ignora, y entre el ruido se esconden los ~49 errores reales: imports muertos, 37 `import React` innecesarios (JSX runtime moderno no lo requiere), 2 miembros privados muertos (`frappeInventory.js:184`, `frappeSupplier.js:20`).

**La solución:**

```js
// eslint.config.js, en rules:
'react/prop-types': 'off',
```

Luego `pnpm lint --fix` + limpiar a mano los unused restantes, y dejar `pnpm lint` en verde.

**Por qué resuelve el problema:** no vas a tipar 60 componentes con PropTypes (y si algún día quieres tipos, el camino es TypeScript, no PropTypes). Con la regla fuera, lint verde vuelve a ser la línea base: cualquier error nuevo destaca al instante y puedes exigir "lint limpio antes de commit".

---

## Menores (sin bloque — una línea cada uno)

| # | Dónde | Qué | Fix |
|---|---|---|---|
| 16 | `security.js:162` | `validar.usuario` rechaza emails con `+` | agregar `+` al set del regex |
| 17 | `frappeAuth.js:132` | `logout()` no limpia Dexie (catálogo/stock/outbox quedan para el siguiente usuario) | `db.delete()` o clear por tabla al logout; urgente solo cuando el outbox drene |
| 18 | `print_server.py:14` | CORS `*` + Flask dev server en `0.0.0.0` sin auth (LAN confiable, documentado) | en prod fijar `PRINT_ALLOWED_ORIGIN` al origen real |
| 19 | `regalos.py:21`, `config.py:7` | `COMPANY` duplicado/hardcoded | importar `constants.COMPANY` |
| 20 | `pos_api.py:228` | `limit=1000` mágico | usar `MAX_ITEMS_LISTADO` |
| 21 | `pos_api.py:171` | `get_ventas_historial` no filtra `company` (corte y reporte sí) | agregar `AND company = %(company)s` |
| 22 | `compras_api.py:61` | guard de `desconsolidar_compra` con string compare, distinto al resto | `require_roles(*ADMIN_MANAGERS)` |
| 23 | `kardex_api.py:33`, `sales_invoice.py:2` | typos "COnsumo", "Valicaciones" | corregir |
| 24 | `App.jsx:43-186` | 16 bloques `<Route>` idénticos | array `{path, Component}` + `.map()` |

---

## Qué NO tocar (está bien y es fácil "arreglarlo" hacia peor)

- `require_roles` centralizado + `_guard_no_es_dueno` + niveles que no incluyen System Manager: el modelo anti-escalada es correcto.
- Egreso sin permisos de doctype + endpoints con guard: bloquea el REST estándar a propósito.
- `_pf()` en `pos_api.py`: los literales fijos + parámetros son la forma correcta; no "simplificar" a f-strings.
- Validaciones anti-tampering en hooks de Sales Invoice / Stock Entry: el servidor manda, el front propone.
- `sanitizar()` en sí (la filosofía del comentario es correcta) — el bug fue aplicarla a la contraseña.
- Transacción Dexie venta+stock, DI en `sync.js`, `FrappeBase`, `errorFrappe` centralizado, tests.

---

## Orden de ataque sugerido

1. **Hoy (riesgo real, diff mínimo):** #2 (1 línea), #5 (1 línea), #10 (2 líneas), #1 (~20 líneas), #3 (~10 líneas).
2. **Esta semana:** #6, #7, #8, #9, #11, #14, #15.
3. **Cuando toque POS en prod:** #4 (+ #17).
4. **Cuando haya un rato:** #12, #13 y la tabla de menores.
