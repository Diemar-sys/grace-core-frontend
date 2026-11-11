# Auditoría del frontend — `bake-data-frontend`

> 2026-11-11 · rama `develop` · HEAD `989f31a` · **árbol de trabajo, no HEAD**.
> Hay 8 archivos sin commit del 10-nov (`src/App.jsx`, `src/config/modulos.jsx`,
> `src/config/roles.ts`, `src/services/frappeHoja.ts`, `src/styles/Pedido.css`,
> `src/pages/ReporteCamionetas.tsx`, `src/utils/reporteCamionetas*.ts`): los números de
> línea de `App.jsx` y `frappeHoja.ts` se mueven cuando se commitee.
> Rutas relativas a `src/` salvo que digan otra cosa. No se modificó código.

## Cómo se hizo y qué NO cubre

- **Estática.** Leído completo: `services/FrappeBase.ts`, `services/frappeAuth.ts`,
  `services/frappeHoja.ts`, `main.jsx`, `App.jsx`, `components/ProtectedRoute.jsx`,
  `utils/security.ts`, `utils/errorFrappe.ts`, `utils/print/escHTML.ts`,
  `utils/print/printUtils.ts`, y en la raíz `vite.config.js`, `eslint.config.js`,
  `nginx.conf`, `package.json`.
- **Leído en parte:** `db/sync.ts` (el drenado), los `useEffect` de `HojaDelDia.tsx`,
  `MiCuenta.tsx`, `Liquidacion.tsx`, `EstadoCuentaHoja.tsx`, `Nomina.tsx`, `Auditoria.tsx`,
  `ConsultaTablero.tsx`, `Cuentas.tsx`, `VistaBolillo.tsx`, `hooks/useCompras.ts`; trozos de
  `frappeSales.ts`, `frappePurchase.ts`, `frappeStock.ts`, `frappeProduccion.ts`,
  `frappeKardex.ts`, `appConfig.ts`; las plantillas de `utils/print/` y `printService.ts`;
  `Login.jsx`, `Catalogo.jsx`, `Inventario.jsx`, `Produccion.jsx`, `POS.jsx`,
  `NuevaVentaB2B.jsx`.
- **Solo por `grep`, no leído:** todo lo demás (el repo tiene ~35,800 líneas sin tests).
  Patrones buscados: `dangerouslySetInnerHTML|innerHTML|eval|document.write`,
  `localStorage|sessionStorage`, `import.meta.env`, `fetch(` fuera de servicios,
  `eslint-disable`, `catch` vacíos o de solo consola, `limit_page_length`, `window.open`.
- **Ejecutado, todo sin tocar el repo:** `pnpm lint` (limpio), un `vite build` a una carpeta
  temporal para medir el bundle de hoy, y un `grep` al core de Frappe dentro del contenedor
  de **DEV** (saneo de HTML, CSRF, `SameSite`). **Nada contra la torre.**
- **Fuera:** backend (ver `~/gestion_panaderia/docs/auditoria-backend.md`), `print-server/`
  (solo se miraron sus rutas), CSS, tests, TestSprite. Nada se reprodujo en navegador.
- **CONFIRMADO** = se ve en el código · **PROBABLE** = depende de datos, red o configuración
  que no se ejecutó.

Severidad (la misma escala del backend): **crítica** = robo/pérdida de dinero o acceso sin
permiso explotable hoy · **alta** = dinero o captura corrupta bajo uso normal · **media** =
condición rara, fuga interna, o algo que degrada con la historia · **baja** = higiene.

## Resumen

| | Seguridad | Bugs | Rendimiento | Estructura / API | Total |
|---|---|---|---|---|---|
| Crítica | 0 | 0 | 0 | 0 | **0** |
| Alta | 0 | 0 | 0 | 0 | **0** |
| Media | 1 | 8 | 1 | 1 | **11** |
| Baja | 8 | 1 | 4 | 4 | **17** |

**Lo sano.** Sin llaves en el cliente: `.env` solo trae `VITE_*` de identidad (URL, nombre,
almacenes) y git lo ignora; las `API_KEY/SECRET` están comentadas y sin prefijo `VITE_`.
La sesión es la cookie `sid` de Frappe (`HttpOnly`, `SameSite=Lax`); en `localStorage` solo
vive `frappe_user` (correo, nombre, nivel, POS) para pintar la UI. Cero
`dangerouslySetInnerHTML`, `innerHTML` o `eval`. Hay capa de API central. Los `useEffect`
revisados a mano traen sus dependencias bien y casi todos descartan respuestas viejas.

**Lo serio** está en un solo tema repetido: **el error que no se ve**. Sin red, sesión
vencida, 5xx y «no hay datos» se pintan igual o se confunden entre sí (M1, M2, M6, M7, M8).

---

## MEDIA

### M1 · El outbox condena la venta con cualquier 4xx
`db/sync.ts:110` — bugs (dinero) · **CONFIRMADO**

**Por qué.** `rechazoReal = status >= 400 && status < 500` → la fila pasa a `error` y sale de
la cola. Pero una sesión vencida (401/403), un 408 o un 429 no son «el servidor vio la venta
y la rechazó»: la venta es buena y queda parada hasta que alguien vea la insignia y oprima
«reintentar». Es el mismo error que ya se corrigió para los 5xx.

**Solución.** Condenar solo 400/409/417/422. Con 401/403/408/429 → `break` (igual que 5xx) y
avisar «inicia sesión de nuevo».

### M2 · Sin red, `_fetch` devuelve `null` y cada servicio lo lee distinto
`services/FrappeBase.ts:49` · p. ej. `frappeStock.ts:186`, `frappeProduccion.ts:319`,
`frappePurchase.ts:560` — bugs · **CONFIRMADO**

**Por qué.** Un `TypeError` de red regresa `null`. De ahí salen dos comportamientos:
~57 lecturas `data?.data || []` (sin red = lista vacía, idéntica a «no hay nada») y ~65
lecturas `.data` / `.message` sin `?.` (truenan con «Cannot read properties of null»). Solo
`frappeHoja` y `frappeCliente` lo traducen a «Sin conexión». Una tabla vacía de existencias
o de deuda que en realidad es «no hubo respuesta» es un número falso que se ve verdadero.

**Solución.** Un cambio en un lugar: que `_fetch` lance `Error('Sin conexión')` sin `status`.
`sync.ts` ya trata «throw sin status 4xx» como transitorio; hay que quitarle el
`if (res === null) break` y revisar `frappePOS`. Los `|| []` quedan inofensivos.

### M3 · Ventas por categoría: una petición por factura y las que fallan se tiran
`services/frappeSales.ts:600-617` (`getVentasB2BPorCategoria`) → `pages/ReportesVentasCategoria.jsx:40`
— rendimiento + dinero · **CONFIRMADO**

**Por qué.** Baja los nombres (tope 5000) y luego pide **cada** Sales Invoice completa, en
lotes de 8. Un mes de 600 facturas son 600 peticiones. Y `.catch(() => null)` descarta la
que falle: el reporte suma menos y no avisa. También rompe la regla A-bis («agregar en la
base, no en el navegador»).

**Solución.** Endpoint en `reportes_api` que agrupe en SQL, como se hizo con
`/reportes/compras` (309 → 1 petición). Mientras tanto: quitar el `.catch` para que falle
entero. Al mudarlo: chequeo de equivalencia contra la torre.

### M4 · «Pagado» de un grupo consolidado no es todo-o-nada
`hooks/useCompras.ts:136` · `:149` · `:156` — bugs (dinero) · **CONFIRMADO**

**Por qué.** `Promise.all(names.map(updatePagado))` son N `PUT` sueltos: si el tercero falla,
dos notas quedan pagadas y el resto no, bajo un mismo folio de factura. Igual
`updateFacturadoA` después de consolidar. Y `imprimirTicketConsolidado` va dentro de la
misma acción: si la impresión truena, el modal reporta error con todo ya escrito.

**Solución.** Un endpoint que marque la lista en una transacción (`revertirPagado(names)` ya
recibe la lista completa: mismo patrón). La impresión, fuera del camino de la escritura.

### M5 · Mi cuenta: la respuesta vieja de un día pisa al día nuevo
`pages/MiCuenta.tsx:149-155` · `:173` — bugs · **CONFIRMADO en código, no reproducido**

**Por qué.** `abrirDia` hace `setDetalle(await miPedido(fecha))` sin comprobar que `dia`
siga siendo ese (sí lo hace `abrirFactura` con `facturaPedida`). La relectura por minuto,
igual. Con red lenta (celular): toca día A, toca día B, llega B y luego A → encabezado del
día B con el pan del día A, y «Te llegó» se guarda con fecha B.

**Solución.** El mismo `useRef` de folio que usa `abrirFactura` tres líneas abajo.

### M6 · Nadie maneja la sesión vencida
`services/FrappeBase.ts:53` · `components/ProtectedRoute.jsx:11` — bugs · **CONFIRMADO**

**Por qué.** `ProtectedRoute` solo mira `localStorage`. Cuando el `sid` vence, la pantalla
abre normal y cada llamada devuelve 403, que `parseErrorFrappe` traduce a «Sin permisos.
Contacta al administrador». No hay un solo `status === 401/403` en `src/`. El nivel tampoco
se refresca: si a alguien le cambian el rol, la UI sigue con el viejo hasta que salga.

**Solución.** En `_fetch`: ante 401/403, preguntar `frappe.auth.get_logged_user`; si es
`Guest`, borrar `frappe_user` y mandar a `/login`.

### M7 · El login cuenta como contraseña mala cualquier error
`pages/Login.jsx:90-98` · `services/frappeAuth.ts:42` — bugs · **CONFIRMADO**

**Por qué.** Todo `catch` llama `rateLimiter.registrarFallo()` y dice «Usuario o contraseña
incorrectos». Un 502 durante un deploy (`response.json()` sobre HTML lanza `SyntaxError`) o
la red caída cuentan igual: al quinto, bloqueo de 5 minutos a quien no hizo nada mal.

**Solución.** Contar fallo solo con 401. Lo demás: «No hay conexión con el servidor», sin
tocar el contador.

### M8 · Errores que solo van a la consola
`pages/Inventario.jsx:68,83` · `pages/Catalogo.jsx:156,221,235` · `pages/Kardex.jsx:73` ·
`pages/ReporteCuentasPorPagar.jsx:30` · `pages/Proveedores.jsx:114` ·
`hooks/useCompras.ts:108,180` (15 sitios) — bugs · **CONFIRMADO**

**Por qué.** `catch (err) { console.error(err) }`: la tabla queda vacía y la pantalla dice,
en los hechos, «no hay existencias» o «no se debe nada». `Inventario.loadItems` además no
descarta respuestas viejas: cambiar de vista rápido puede dejar la lista de una vista bajo
el título de otra.

**Solución.** Un estado `error` visible; `ModalError` y `parseErrorFrappe` ya existen.

### M9 · Existencias por almacén: mil códigos en la URL de un GET
`services/frappeStock.ts:189-195` (`getStockPorAlmacen`) — bugs · **PROBABLE**

**Por qué.** `["item_code","in",[…hasta 1000 códigos]]` viaja en la query. gunicorn corta la
línea de petición en 4094 bytes por defecto (no se vio otro valor en el arranque del
contenedor de dev); cada código codificado pesa ~17 bytes → revienta cerca de 230 códigos.
Alimenta Inventario «por almacén», la vista previa de Producción y el `seedStock` del POS;
el error solo va a consola (M8). `frappeSales.ts:643` ya parte en trozos de 200 por esto.

**Solución.** Partir en trozos de 200 o un endpoint propio. **Medir primero** en la torre:
cuántos `Bin` con `actual_qty > 0` tiene el almacén más grande.

### M10 · ESLint no revisa los `.ts` / `.tsx`
`eslint.config.js:10` (raíz) — estructura (proceso) · **CONFIRMADO**

**Por qué.** `files: ['**/*.{js,jsx}']`. `react-hooks/exhaustive-deps` y `rules-of-hooks` no
corren sobre TypeScript: 29 archivos con `useEffect` y 55 arreglos de dependencias puestos a
mano, entre ellos la Hoja, Mi cuenta y la Liquidación. `tsc` no revisa hooks. Y la regla
viva es «todo archivo nuevo nace en TS»: el hueco crece con cada pantalla nueva. Es el
espejo del `checkJs:false` que ya mordió en agosto.

**Solución.** `typescript-eslint` como parser y extender `files` a `ts,tsx`. Es dependencia
de desarrollo nueva: la única forma de que eslint lea TS.

### M11 · `/print/` llega a la térmica sin sesión
`nginx.conf:90-94` (raíz) — seguridad · **CONFIRMADO**

**Por qué.** El proxy a `host.docker.internal:6789` no pide cookie. Cualquier equipo de la
LAN puede mandar un `POST /print/imprimir-egreso` o `/imprimir-venta-b2b` con los datos que
quiera y sale un comprobante con el formato oficial, sin tener cuenta.

**Solución.** `auth_request` contra `/api/method/frappe.auth.get_logged_user`, o un token
compartido entre nginx y el print-server.

---

## BAJA

| # | Archivo:línea | Cat. | Problema | Solución |
|---|---|---|---|---|
| B1 | `utils/print/ticketTemplate.ts:203-205`; `utils/print/corteTemplate.ts:44`; `services/printService.ts:306,319-323`; se dispara en `components/compras/ModalReciboPDF.jsx:116-121` | Seguridad | `noFactura`, `proveedor`, `facturadoA`, `departamento`, `categoria` entran sin `escHTML` a un `document.write` en un popup del mismo origen. **Bajó de media:** Frappe sanea el HTML de los campos al guardar (`_sanitize_content`, visto en dev), así que hoy la única defensa es esa capa — y no cubre documentos ya confirmados ni lo escrito con `db.set_value`. | Envolver en `escHTML`, que ya se usa en los renglones de al lado. |
| B2 | `services/frappeAuth.ts:206-217` | Seguridad | El comentario dice que validar el nivel evita escalar por DevTools; no: basta escribir `"role":"Gerente"`. Solo cambia lo que se ve (el servidor manda), pero el comentario promete de más. | Corregir el comentario; o pedir el nivel al servidor al montar (va con M6). |
| B3 | `services/FrappeBase.ts:30` | Seguridad | En prod no viaja token CSRF y Frappe no lo exige (la sesión no trae `csrf_token`). La defensa es `SameSite=Lax` del `sid` más el rollback de Frappe en los GET (ambos vistos en dev). Es una sola capa. | Confirmar el atributo de la cookie en la torre. Sin cambio de código. |
| B4 | `services/frappeAuth.ts:106,171` | Seguridad | `logout` por GET: un enlace externo cierra la sesión. Molestia, no fuga. | `method: 'POST'`. |
| B5 | `nginx.conf:23-28` (raíz) | Seguridad | Sin `Content-Security-Policy`. | `default-src 'self'` más lo que pidan los popups de impresión; probar en dev. |
| B6 | `nginx.conf:45,62` (raíz) | Seguridad | La cookie de paso del mantenimiento está fija en el repo. El propio archivo dice que no es seguridad; queda anotado. | Nada, o moverla a un archivo montado. |
| B7 | `utils/security.ts:73-97` | Seguridad | El `rateLimiter` vive en `sessionStorage`: otra pestaña lo reinicia. Es aviso al usuario, no defensa (el comentario lo llama «primera línea de defensa»). | Ajustar el comentario; el límite real es el de Frappe. |
| B8 | `utils/security.ts:122` | Seguridad | `sanitizar` borra todo `<…>`: «HARINA <1KG>» se guarda como «HARINA». Muta captura legítima sin avisar. | Escapar al pintar fuera de React (B1), no mutar al guardar. |
| B9 | `services/frappeAuth.ts:115-120` | Bugs | Si falla la red justo al entrar, el nivel cae a `Vendedor` y así se queda guardado: un Gerente ve el menú de Vendedor hasta que sale y vuelve a entrar. | Fallar el login en vez de adivinar el nivel. |
| B10 | `main.jsx:12,19` | Rendimiento | `frappe-react-sdk` solo aporta un `FrappeProvider` sin un solo hook usado, y cae en `vendor-react` (323 kB, 106 kB gzip). | Quitar el provider y la dependencia. |
| B11 | `App.jsx:16-25` | Rendimiento | 10 páginas con import directo: `index` pesa 593 kB (152 kB gzip, medido hoy). Repartidor y Cliente bajan POS, Compras y Catálogo que nunca abren. | `lazy()` como las demás; nada más. |
| B12 | `pages/Catalogo.jsx:164-175` | Rendimiento | Costea por BOM **todo** producto terminado de `items`: 3 peticiones cada uno, sin el tope que sí tiene el efecto de panes de `:189`. | Mismo tope, o lo que ya dice el comentario de `:177-184`: que la receta guarde su costo en el Item. |
| B13 | `services/frappeSales.ts:447`; `services/frappePurchase.ts:514`; `services/frappeStock.ts:183` | Rendimiento | Topes de 2000 / 1000 que truncan sin decirlo. | Si llegan exactamente `limit` filas, avisar «acorta las fechas» (como `MiCuenta.tsx:481`). |
| B14 | `components/NuevaCompra.jsx` (829 líneas, 34 `useState`); `components/NuevaVentaB2B.jsx` (708); `services/frappeStock.ts` (890); `services/frappeSales.ts` (795) | Estructura | Componentes y servicios gigantes. `NuevaCompra` mezcla escáner, impuestos, borrador y modales. | Sin urgencia. Partir solo cuando se toque: el estado del formulario a un hook, como ya se hizo con `useCompras`. |
| B15 | `utils/print/comprasPrint.ts:145-250`; `components/compras/ModalReciboPDF.jsx:13-112`; `components/modals/ModalReciboPDF.jsx:29-125` | Estructura | El HTML del recibo existe en tres copias casi iguales. | Una función en `utils/print/` y los dos modales la llaman. |
| B16 | `App.jsx:88-323` | Estructura | 29 bloques `<Route><ProtectedRoute>…` idénticos. | Un arreglo de rutas y un `map`. |
| B17 | `components/NuevaVentaB2B.jsx:91`; `services/frappeAuth.ts` (8 `fetch` crudos); `services/appConfig.ts:45`; `services/sucursalesConfig.ts:53` | API | Llamadas a ERPNext que no pasan por `FrappeBase._fetch`. La de `NuevaVentaB2B` es la única dentro de un componente y además pide `limit_page_length: 100` para una lista que puede traer más códigos. | Pasarlas por `_fetch` (después de M2). |

---

## Punto 5 · Cómo se habla con ERPNext

**Hay capa centralizada, con cuatro fugas.**

- `services/FrappeBase.ts` es la única clase que arma cabeceras, manda la cookie
  (`credentials: 'include'`), pone `cache: 'no-store'` y traduce `_server_messages` a un
  `Error` con `status`. La extienden 17 singletons (`frappeHoja`, `frappeSales`,
  `frappeStock`…). Los componentes llaman servicios, no `fetch`.
- Dos estilos conviven: endpoints propios (`/api/method/gestion_panaderia.api.*`, lo nuevo:
  Hoja, Cliente, Pedido, Reportes) y REST genérico (`/api/resource/<Doctype>`, lo viejo:
  Sales, Purchase, Stock, Inventory, Producción). **El REST genérico es de donde salen M3,
  M4, M9 y B12**: el navegador cruza y suma lo que debería agregar la base.
- Fugas: B17. Los `fetch` a `/print/…` (`printService.ts`, `comprasPrint.ts`) y a
  `/mantenimiento/aviso` no son ERPNext y están bien donde están.
- El contrato de error no es uno solo (M2): unos servicios lanzan, otros devuelven vacío.

## Orden sugerido

1. **M1 + M2** juntos (tocan `FrappeBase` y `sync.ts`; con mutante sobre `sync.test.js`).
2. **M6 + M7** (sesión y login: mismo archivo, misma idea).
3. **M5** (cinco líneas) y **B1** (envolver en `escHTML`).
4. **M10** antes de la siguiente pantalla nueva en TS.
5. **M3, M4, M9** piden endpoint de backend: se planean con el backend.
6. **M11** es de infra (nginx + print-server).
