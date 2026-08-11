# Auditoría completa 2026-08-11 — ERP Panaderías Grace

Cuatro auditores (UI front, capa de datos front, backend Frappe, tooling/infra)
sobre `bake-data-frontend` y `gestion_panaderia`. Verificado contra el código,
no supuesto. Los hallazgos de `AUDITORIA_BUGS.md` (julio) NO se repiten aquí:
8 de 10 del backend ya estaban corregidos al momento de esta pasada.

Estado: ✅ = corregido en esta misma sesión (2026-08-11). Ver "Correcciones
aplicadas" al final.

---

## LO BUENO

1. **El dinero difícil ya está bien resuelto donde más dolió.** Ajuste SAT
   derivado de los impuestos YA redondeados, en un solo lugar
   (`frappeSales.ts:80`, espejo en `compraUtils.calcularTotalesEfectivos`), con
   test. `registrarPago` NO redondea `allocated_amount` (caso 786.055904
   documentado — round2 haría que Frappe rechazara el pago). `round2` con
   `toPrecision(12)` y el contraejemplo (3 × 3.335) escrito en el comentario.
2. **Idempotencia POS de libro** (`pos_api.py:174-232`): uuid con índice
   `unique` como barrera real, `exists()` solo como ahorro, catch de
   `UniqueValidationError` con rollback + re-consulta. Exactamente lo que el
   drain del outbox necesita.
3. **SQL 100% parametrizado** en el backend (verificados los 20+
   `frappe.db.sql`). El patrón `_pf()` de `pos_api.py` deja la inyección
   imposible por construcción y documenta por qué no "simplificar".
4. **Seguridad en capas coherente**: `require_roles` fail-closed que excluye
   System Manager a propósito (anti-escalada), DocPerms cerrados en los
   doctypes custom, historial git limpio de secretos (verificado sobre
   `git rev-list --all` en ambos repos), y la lección del deploy invisible
   codificada en `nginx.conf` (immutable para assets con hash, no-cache para
   index.html).
5. **Los 261 tests apuntan a dinero**: IVA, IEPS cuota fija, ISR, cobro/cambio,
   ajuste SAT, drain del outbox con DI, paridad de redondeo del print-server.
   No son tests de relleno.
6. **Self-checks con caso real**: kardex reproduce HARINA BLANCA con la
   invariante `inicial + entradas − usado + ajuste = final`; nómina cuadra
   contra un recibo CONTPAQi centavo a centavo, server-side en `validate`.

---

## LO MALO — críticos 🔴

### 1. POS acepta el precio que mande el cliente ✅
`pos_api.py:214` — `registrar_venta_pos` usa `"rate": flt(it.get("rate"))` sin
comparar contra catálogo. Una cajera con `curl` puede registrar 50 conchas a
$0.01: el corte cuadra (cobrado = registrado), el stock baja, el robo es
invisible salvo comparando precio por pieza a mano.
**Fix:** precio resuelto server-side con la misma lógica de canal de
`get_productos_venta`; el rate del cliente se ignora.

### 2. Venta POS perdible para siempre ✅
`sync.ts:100` + `FrappeBase.ts:38` — cualquier throw en el drain marcaba la fila
`estado='error'` permanente, sin distinguir un 502 transitorio (deploy, migrate)
de un 417 de datos malos. Y ninguna pantalla mostraba las filas en error ni
había reintento: venta cobrada en mostrador que jamás llega a ERPNext.
**Fix:** el Error lleva `status`; 5xx/red = transitorio (la fila queda
`pendiente` y se reintenta al siguiente drain). Filas `error` reales: contador
visible en el POS + botón reintentar.

### 3. Cobro con pago exacto bloqueado al azar ✅
`posUtils.ts:41` (`calcularCobro`) — `importeOk` dependía de `pendiente === 0`,
igualdad exacta de flotantes sobre `qty * precio` sin redondear. Con cantidades
fraccionarias (pan por kilo) falla ~44% de tickets: la pantalla pinta
"$0.00 pendiente" pero el botón Confirmar queda muerto. Es el clásico "a veces
no me deja cobrar" imposible de diagnosticar.
**Fix:** redondear total/pagado/pendiente a centavos ANTES de comparar.

### 4. El reporte fiscal anual miente ✅
`frappePurchase.ts:439` (`getReporteFiscalMensual`) — lista de todo el año con
`limit_page_length: '500'` y sin `order_by`: a ~768 compras/año descarta ~270 y
los meses viejos reportan IVA/IEPS/subtotales menores a los reales. Agravante:
cada doc que fallaba al bajar se tragaba con `.catch(() => null)` y no sumaba.
**Fix:** `limit_page_length: '0'`, batches de 8, y si algún doc no baja el
reporte TRUENA con "N compras no se pudieron leer" en vez de mentir.

### 5. Llaves API posiblemente horneadas en bundles viejos ✅ (parcial)
`.env.backup` (no versionado) contiene `VITE_API_KEY`/`VITE_API_SECRET`. Con
prefijo `VITE_`, cualquier build anterior al 27-abr las horneó en JS público
descargable por cualquier navegador de la LAN/ZeroTier. `main.jsx` además
mandaba `token: "undefined:undefined"` (código muerto).
**Fix aplicado:** `.env.backup` borrado, `tokenParams` eliminado de `main.jsx`.
**🔴 PENDIENTE DIEMAR:** revocar ese par API key/secret en el desk de Frappe
(Usuario → API Access → regenerar o borrar). Sin eso el agujero sigue abierto.

---

## LO MALO — serios 🟠

### Seguridad backend
- ✅ **Fuerza bruta libre contra la password de Administrator.**
  `_verificar_admin_password` (usada por nomina y cuentas) verificaba el hash
  sin límite de intentos ni registro — un usuario nivel Almacén podía probar
  miles de candidatos por minuto vía `editar_empleado`. Fix: 5 intentos
  fallidos → 10 minutos de bloqueo (contador en caché por usuario).
- ✅ **Egresos NÓMINA visibles y borrables por cualquier OFICINA.**
  El efectivo "bajo el agua" ($220k migrados) que `nomina_api` protege con
  GERENTE se fugaba por `egresos_api`: `get_egresos` los listaba y
  `eliminar_egreso` los borraba — incluido el egreso de una corrida confirmada,
  dejando la corrida incancelable y borrando el rastro del feed de Auditoría.
  Fix: no-Gerente no ve categoría NÓMINA en `get_egresos`; `eliminar_egreso`
  exige Gerente para NÓMINA y bloquea egresos ligados a una corrida (el camino
  correcto es cancelar la corrida). ⚠️ Decisión pendiente de Diemar:
  `reportes_api.reporte_gastos` sigue incluyendo NÓMINA para OFICINA.
- ✅ **`editar_usuario`: cambiar solo la contraseña se ignoraba en silencio**
  (la asignación estaba anidada dentro de `if nombre`). Una rotación de
  contraseña "exitosa" que no rotaba nada. Fix: password desanidada.

### Dinero / datos
- ✅ **Ventas vespertinas caían al día siguiente.** `posting_date` salía de
  `created_at` = `toISOString()` (UTC); México es UTC-6 → todo lo vendido
  después de ~18:00 se contabilizaba mañana y el corte no cuadraba. Fix:
  conversión a fecha LOCAL en `frappePOS.crearVentaOffline` (corrige también
  las filas ya encoladas).
- ✅ **Folio de venta B2B reutilizable.** `getSiguienteNumero` excluía
  docstatus 2: cancelar la venta más reciente liberaba su folio y el siguiente
  lo reutilizaba (dos ventas con el mismo número en la libreta). Fix: el max
  ahora incluye canceladas. (El endpoint server-side con lock, como ya tiene
  compras, queda como mejora futura.)
- ✅ **`Renglon Nomina.sucursal` nunca se llenaba** → `reporte_costo_real`
  agrupaba el 100% bajo "(Sin sucursal)". Fix: `validate` congela
  `Employee.branch` en cada renglón. Backfill de corridas viejas: one-shot
  pendiente (correr en prod tras deploy).
- ✅ **Doble-tap en "Confirmar compra/venta" sin guard** (pantalla táctil):
  dos llamadas concurrentes antes del refresh = riesgo de documento duplicado,
  y el error solo iba a `console.error`. Fix: botón deshabilitado por `name`
  en curso + error visible, en `useCompras.ts` y `VentaB2B.jsx`.

### Tooling
- ✅ **`package-lock.json` desfasado conviviendo con `pnpm-lock.yaml`** —
  anulaba la política supply-chain de pnpm. Fix: borrado + campo
  `"packageManager"` en package.json.
- ✅ **axios y react-router con vulnerabilidades high en runtime.** axios
  (transporta todas las llamadas, vía frappe-js-sdk) y react-router-dom 7.13.0.
  Fix: override `axios>=1.16.0` + upgrade `react-router-dom` 7.18.2; suite y
  build verificados.
- ✅ **`.pre-commit-config.yaml` sin instalar** (`.git/hooks` vacío — teatro:
  ruff jamás corrió). Fix: instalado + hook local que corre los 2 self-checks
  Python (`test_item_uom.py`, `test_permisos_niveles.py`).
- ✅ **Nada compilaba desde checkout limpio antes de push** — la clase de bug
  `hora.ts` (archivo sin `git add`, compila local, roto en origin, `typecheck`
  no lo atrapa). Fix: `preflight.sh` que compila desde `git archive HEAD`.
  Correrlo antes de cada push de deploy.
- **Backend: 66 endpoints whitelisted, 0 tests corriendo** — los self-checks
  existen y ahora corren en pre-commit; la aritmética de nómina/stock sigue
  sin red más allá de eso. Mejora incremental: extraer aritmética a funciones
  puras cuando se toque cada módulo.

---

## LO MALO — menores 🟡

- ✅ `egresos_api.py` usaba `_()` sin importarlo → `NameError` (500) en el
  camino de error de `marcar_pagado`.
- ✅ `reporte_cuentas_por_pagar` incluía egresos NÓMINA → "(Sin proveedor)"
  acumulaba deuda falsa gigante arriba de la lista.
- ✅ `_SQL_DEPARTAMENTO` sumaba `qty * rate` en vez de `base_amount` → el
  desglose por departamento no sumaría igual que el total del corte en cuanto
  un corte incluyera descuento/impuesto.
- ✅ `auditoria_api.py`: `limit=abc` → `ValueError` 500. Ahora `cint`.
- ✅ `COMPANY` re-hardcodeado en `nomina_api.py` y `reconciliar_uom.py` en vez
  de importar `constants.COMPANY`.
- ✅ `getVentas` limit 100 → 2000 (mismo bug que `getCompras`, julio).
- ✅ `getStockActual`/`getMovimientos` interpolaban `itemCode` crudo en la URL:
  un `#` en el código (velas "No. 8") truncaba el query y pintaba stock de OTRO
  producto. Ahora `URLSearchParams`.
- ✅ `frappePOS`: `rate`/`qty` malformados ya no se degradan a 0 en silencio —
  truenan con mensaje. `crearVenta` (camino online sin uuid, sin callers)
  borrado para que nadie lo reviva.
- ✅ `frappeSupplier.#getSiguienteNumero` traía 500 proveedores para sacar el
  max en JS → `order_by desc, limit 1`.
- ✅ `getPresentaciones` sin `options` devolvía `undefined` → `return []`.
- ✅ `BuscadorProveedor` sin guard de respuesta fuera de orden (BuscadorCliente
  sí lo tenía) → mismo patrón `cancel`.
- ✅ `key={i}` → `key={item.item_code}` / `key={p.name}` en Catalogo y
  Proveedores.
- ✅ `typescript` fijado exacto (no sigue semver; el caret podía romper
  `typecheck` con un `pnpm update` casual).
- ✅ Basura: `cookies.txt` (vacío, verificado), `src/api/` (directorio vacío)
  borrados; `.dockerignore` ahora excluye `.env*`/`cookies.txt`.
- **Pendientes menores** (no bloquean nada):
  - `calcGas()` duplicado en `Egresos.jsx` (form vs buildPayload) — extraer a
    `compraUtils` como `calcGasolina`. ⚠️ Egresos.jsx tiene cambios sin
    commitear (LUZ); hacerlo después de ese commit.
  - 3 `useEffect` muertos de sincronía en `Egresos.jsx` (escriben `form.monto`
    que nadie lee). Mismo motivo para esperar.
  - Helper `fetchDocsEnLotes(8)` para los 4 N+1 de Stock Entry.
  - `INSTALL.md`/`README.md` mienten: `VITE_API_URL` no existe (es
    `VITE_FRAPPE_URL`), dicen npm (es pnpm), WireGuard (es ZeroTier), bench
    bare-metal (es Docker).
  - Google Fonts por CDN en app LAN offline-first → self-host en
    `public/fonts/`.
  - eslint no cubre `.ts` (~5k líneas de servicios sin lint de higiene).
  - Header CSRF manda el literal `'fetch'` (`window.csrf_token` nunca se
    asigna): protección aparente que no existe; la defensa real es
    SameSite. Decidir: poblar el token o borrar la línea y documentar.
  - Endpoint `get_siguiente_no_venta` server-side con lock (como compras).
  - Backfill `sucursal` en renglones de corridas viejas (one-shot en prod).

---

## LO QUE NO TOCAR (deliberado, no descuido)

- **Archivos grandes** (Egresos 873, Compras 681, Catalogo 646): buena parte es
  SVG inline y catálogos de configuración, no lógica anidada. Partirlos =
  cosmético con costo real.
- **`ignore_permissions=True` generalizado en el backend**: es el diseño de dos
  capas (DocPerms cerrados + `require_roles` como única puerta). Quitarlo
  obligaría a abrir DocPerms por rol y reabriría el REST genérico.
- **Floats + `flt()` en vez de Decimal**: todo pasa por `flt()` y campos
  Currency; el residuo que dolía (ajuste SAT) se corrigió en la causa.
- **Sin CI**: `preflight.sh` local da el 80% del valor por el 5% del costo para
  un solo dev con deploy manual.
- **Self-checks Python con stub de frappe** en vez de pytest+bench: corren en
  <1s y prueban la aritmética que importa. Ahora sí se ejecutan (pre-commit).
- **~45 vulnerabilidades dev-only** (vitest UI, rollup, postcss…): solo corren
  en la laptop, se van solas al subir vite/vitest.
- **`any` en el boundary**: patrón deliberado de la migración TS — que en
  services/db/utils/config ya está TERMINADA.
- **`saldoCobrable` devolviendo el outstanding SIN redondear cuando es
  cobrable**: deliberado — es el valor exacto que `registrarPago` necesita.
  Redondearlo reintroduciría el bug de DULCE CARAMELO.
- **Versiones exactas sin caret en runtime**: control de cambios correcto para
  proyecto sin CI. No "normalizar" a carets.
- **Scripts one-shot del backend** (`fix_*`, `install_*`, `reconciliar_uom`
  fuera de patches.txt): registro ejecutable de cómo quedó la base; sin
  `@frappe.whitelist()`, solo invocables por `bench execute`.

---

## Correcciones aplicadas en esta sesión (2026-08-11)

Ver `msg_commit.txt` de cada repo para el detalle por commit. Resumen: todos
los 🔴 y 🟠 marcados ✅ arriba, más los menores ✅.

### Queda en manos de Diemar
1. **Revocar el par API key/secret** viejo en el desk de Frappe (10 min, prod).
2. Decidir si OFICINA ve NÓMINA en `reporte_gastos`.
3. Backfill one-shot de `sucursal` en corridas viejas (tras deploy).
4. Los "pendientes menores" listados arriba, sin prisa.

Veredicto global: proyecto notablemente más sano que en julio. Los dos temas
estructurales eran de la misma familia — confianza en el cliente donde hay
dinero (precio POS) y la frontera Gerente/OFICINA fugándose por el doctype
Egreso — y ambos quedaron cerrados en esta pasada.
