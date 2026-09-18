# MAPA DEL FRONTEND — `bake-data-frontend`

> Mapa de archivos, rutas y carpetas del repositorio frontend.
> Generado 2026-09-08 · actualizado 2026-09-18. Si el árbol cambia, este documento miente: regenéralo.

| | |
|---|---|
| **Repo** | `~/bake-data-frontend` → `github.com/Diemar-sys/grace-core-frontend` |
| **Rama** | `main` |
| **Qué es** | App React + Vite. **ES el producto**: Frappe/ERPNext es el motor y el usuario nunca lo ve. |
| **Contra qué pega** | `~/gestion_panaderia`, vía `/api/method/gestion_panaderia.api.<módulo>.<función>` |
| **Prod** | Torre `192.168.2.221` (servida por nginx dentro de Docker). `localhost:5173` es **dev**, no prod. |
| **Toolchain** | Node 22 + pnpm 11, pineados en `package.json`. Con Node 20 truena `node:sqlite`. |
| **Diseño** | "Light Bento Grid" — lo dicta la skill `diseno_bento_grid`, no la improvisación. |
| **Hermano** | `~/erp-grace-infra` (`master`) tiene el compose del front y el `build.sh` |
| **El otro mapa** | `~/gestion_panaderia/MAPA_BACKEND.md` |

🔴 **Reglas vivas al tocar este repo:** todo archivo NUEVO nace en TypeScript; responsive por clase `col-*`, **nunca** por `nth-child`; lo derivado se calcula en el render (`useMemo`), nunca en un `useEffect` — ese fue el bug de `precio_final` que mandó 62 costos desfasados al servidor el 17-ago.

## Índice

1. Raíz del repo — configuración y toolchain
2. Entrada de la app
3. Páginas · Componentes · Estilos · `public/` y `docs/`
4. Servicios — la frontera con el backend
5. Utilidades · Base local (Dexie) · Hooks · Configuración
6. Tests · `testsprite-plans/` · `print-server/` · `.githooks/` · Scripts de pnpm

---

## Raíz del repo — configuración y toolchain

| Archivo | Qué es | Notas |
|---|---|---|
| `package.json` | Manifest pnpm. `packageManager: pnpm@11.1.1`. | Scripts: dev, build, lint, typecheck, preview, test, test:watch. Deps prod: `@radix-ui/react-dialog`, `@radix-ui/react-select`, `dexie`, `dexie-react-hooks`, `frappe-react-sdk`, `lucide-react`, `react`/`react-dom` 18.3.1, `react-router-dom` 7.18.2. Dev: eslint 9 + plugins, vite 5.4.10, vitest 2.1.9, typescript 6.0.3, testing-library, happy-dom. |
| `vite.config.js` | Config Vite + Vitest (`test` embebido). | `assetsDir: 'static'` para no chocar con `/assets` de ERPNext. `manualChunks` con orden en cascada específico (dexie-react-hooks antes que react) 🔴 documentado: un orden equivocado producía un chunk circular `vendor-db → vendor-react → vendor-db`. Proxy dev: `/api|files|assets` → `bakedata.local:8080`; `/print` → `localhost:6789` (print-server). |
| `tsconfig.json` | `strict: true`, `allowJs: true`, `checkJs: false`. | 🔴 `checkJs:false` es la trampa documentada en `preflight.sh`: `tsc` NO revisa `.jsx`, por eso `eslint` es obligatorio (incidente `LIMITE_COSTEO_PAN` en prod, 27-ago). `types: ["vitest/globals"]`. |
| `eslint.config.js` | Flat config ESLint 9. | Reglas React + hooks + refresh. `react/prop-types: off` (proyecto sin PropTypes, TS es el camino si algún día se tipa). |
| `Dockerfile` | Build multi-stage: node 22-alpine build → nginx 1.27-alpine serve. | `corepack enable` en vez de clavar versión de pnpm (para no divergir de `packageManager`). `pnpm-workspace.yaml` se copia junto a package.json/lockfile porque trae los `overrides` que el lockfile ya resolvió. `.env` se hornea en el bundle en build time. |
| `nginx.conf` | nginx de prod: sirve el SPA + proxy a ERPNext + proxy a print-server. | Proxea `/(api\|files\|private\|assets\|socket.io)/` → `bakedata.local:8080` con `proxy_cookie_domain`. `/print/` → `host.docker.internal:6789`. Cabeceras de seguridad repetidas por location porque `add_header` en un location reemplaza las heredadas. `/static/` cache 1 año inmutable; `index.html` con `Cache-Control: no-cache` 🔴 (sin esto el deploy queda invisible — lección de sesión pasada). |
| `preflight.sh` | Gate de calidad: extrae HEAD limpio a un tmpdir (`git archive`) y corre `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test`, `build` ahí. | 🔴 Existe por el incidente `hora.ts` (05-ago): un archivo sin `git add` compilaba local pero rompía HEAD en origin. 🔴 Comentario explícito: `lint` NO es cosmético — cubre el hueco de `checkJs:false`. Copia `.env` al tmpdir porque no está en git pero el build lo necesita. Se corre `bash preflight.sh` ANTES de cada push de deploy. |
| `verificar_css_global.sh` | Guardia: falla si el CSS de `dist/` trae un `body`, `html` o `*` sin acotar. Lo llama `preflight.sh` después del build. | 🔴 Nace el 08-sep, después de que `Login.css` dejara toda la app en `position:fixed`. Verifica el CSS minificado, no las fuentes. |
| `.githooks/pre-push` | Hook que corre `preflight.sh` automáticamente al hacer push a `main`. | Detalle en su propia sección. |
| `.env` | Variables de entorno reales del negocio. | Solo `VITE_FRAPPE_URL` y variables de identidad/tenant (empresa, sucursales, almacén central, POS profile, módulo Frappe). Comentario explícito: API_KEY/API_SECRET NO se usan (login por cookie de sesión). Sin credenciales activas — las líneas de llave están comentadas. (credencial, omitida — no aplica, no hay valores sensibles presentes). |
| `.env.example` | Plantilla para nuevo tenant/cliente. | Mismas claves que `.env` con valores de ejemplo. |
| `.dockerignore` | Excluye `node_modules`, `dist`, `.git`, logs, `msg_commit.txt`, backups de `.env`. | Comentario explícito: `.env` SÍ entra al build context (las `VITE_*` se hornean ahí). |
| `.gitignore` | Ignora `node_modules`, `dist`, `.env*` (excepto `.env.example`), `msg_commit*.txt`, `__pycache__/`, `.claude/`, y notas locales `ESTADO.md`/`ARQUITECTURA.md`. | Comentario: esos dos `.md` cambian cada sesión / duplican el mapa de infra, por eso no viajan en git. |
| `pnpm-workspace.yaml` | `overrides`: fuerza `axios@1.19.0` (parcha CVE en `frappe-react-sdk`→`frappe-js-sdk`), `socket.io-parser` y `ws` a versiones parchadas aunque socket.io no se use (`enableSocket=false`). | `allowBuilds: { esbuild: true }`. |
| `index.html` | Shell del SPA. | Carga fuentes Google (DM Sans, JetBrains Mono, Lora, Space Grotesk), monta `#root`, entrypoint `/src/main.jsx`. |
| `README.md` | Descripción general del proyecto: qué es, módulos, stack, estructura de `src/`, instalación con pnpm 11 / Node 22, preflight. | Al día desde el 08-sep. Sus capturas viven en `docs/screenshots/`. |
| `MAPA_FRONTEND.md` | **Este documento.** Mapa de cada archivo, ruta y carpeta del repo. | 🔴 Se actualiza en el MISMO commit que mueve el árbol, no al cierre de la sesión. Si su fecha no coincide con el árbol, miente. |
| `ARQUITECTURA.md`, `AUDITORIA_2026-08-11.md`, `AUDITORIA_BUGS.md`, `ESTADO.md`, `INSTALL.md` | Notas de trabajo / auditorías históricas, no forman parte del código. | No son config ni lógica. `ESTADO.md`/`ARQUITECTURA.md` los ignora git; las dos `AUDITORIA_*.md` e `INSTALL.md` sí están versionadas. |
| `msg_commit*.txt` | Mensajes de commit preparados por el agente para que Diemar los use al commitear (flujo `commit_workflow_msg_txt`). | No es código; gitignored. |
| `pnpm-lock.yaml` | Lockfile. | No se documenta contenido (autogenerado). |
| `vite-dev.log` | Log de una corrida de dev. | 🔴 Está VERSIONADO en git por error (no lo cubre `.gitignore`). Candidato a `git rm --cached` + ignorar `*.log`. |

## Entrada de la app (`src/` raíz)

- **`src/main.jsx`** — Bootstrap de React. Monta `<App/>` envuelto en `FrappeProvider` (de `frappe-react-sdk`) con `url={VITE_FRAPPE_URL}` y `enableSocket={false}`. Importa `index.css` y `styles/global.css`. 🔴 Comentario explícito: nunca volver a `tokenParams` con API_KEY/SECRET — todo lo `VITE_` se hornea en el bundle público y quedaría descargable en la LAN; la auth es 100% por cookie de sesión.
- **`src/App.jsx`** — Router raíz (`BrowserRouter` + `Routes`). Define todas las rutas protegidas (`ProtectedRoute`) y públicas (`/login`). Carga inmediata para vistas operativas (Catálogo, POS, Inventario, Compras, VentaB2B, EnvioSucursal, Produccion, Pedido, Egresos, Proveedores); code-splitting (`React.lazy`) para reportes y vistas secundarias (ConsultaPedido, ConsultaTablero, ConsultasPOS, Kardex, Liquidacion, 6 reportes, Nomina, Cuentas, Auditoria). `BannerConexion` vive fuera de `<Routes>` para verse en cualquier pantalla, incluido Panel. `/liquidacion` es la única ruta del rol Repartidor (comentario explícito en el código).
- **`src/index.css`** — Reset base + tipografía (`DM Sans`), colores base del cuerpo. 47 líneas, sin lógica.
- **`src/vite-env.d.ts`** — Referencia de tipos de Vite + declara `Window.csrf_token?: string` (usado por `FrappeBase.getHeaders`) y `declare module '*.css'`.

## Páginas (`src/pages/`)

| Archivo | Módulo | Qué hace | Consume | Notas |
|---|---|---|---|---|
| `Auditoria.tsx` | Auditoría | Bitácora de acciones sensibles (color pastel por tipo de movimiento). | `auditoriaService` (`frappeAuditoria`) | Ruta solo para Gerente (`cuentas: true` en roles.ts). Si no hay permiso, el catch queda mudo a propósito ("el feed ya lo reporta"). |
| `Catalogo.jsx` | Catálogo | Alta/edición de insumos y pan, costeo. Dos vistas (tabs `role="tablist"`): insumos / pan. | `inventory` (`frappeInventory`), `produccionService` (`frappeProduccion`) | Roles: Almacén, Operaciones, Gerente. Límite de 40 panes por golpe de API (evita 227 peticiones sueltas: comentario explícito en el código). |
| `Compras.jsx` | Compras | Lista y arma modales de captura de compra. | Vía `hooks/useCompras` (fuera de alcance) → transitivamente `frappePurchase`; no importa services directo | Roles: Almacén, Operaciones, Gerente. Responsive por CLASE de columna, nunca `nth-child` (comentario en cabecera, cumple regla del proyecto). |
| `ConsultaPedido.tsx` | Consultas → Pedido del día | Solo lectura: pedido ya guardado + descarga de PDF. | `pedidoService`, `urlPdfPedido` (`frappePedido`) | Mismos roles que módulo `pedido` (Almacén, Operaciones, Gerente). Exporta `totalesPedido` (testeado) — antes era doble ciclo anidado sobre el mismo arreglo, corregido. |
| `ConsultasPOS.jsx` | Consultas → POS | Historial de ventas, cancelación de venta, corte de caja. | `posService` (`frappePOS`), `auth` (`frappeAuth`), `printService` | Roles: Vendedor, Gerente (módulo `pos`). Doble candado: la ruta ya filtra, y encima el componente exige `auth.getUser()?.role === 'Gerente'` para poder cancelar. |
| `ConsultaTablero.tsx` | Consultas → Tablero de reparto | Cómo va el día contra el pedido guardado (qué falta, qué sobra, a quién). | `pedidoService` (`frappePedido`) | Mismos roles que `pedido`. Lee traspasos REALES del día, no un campo que enlace al pedido (comentario explícito). |
| `Cuentas.tsx` | Cuentas (financiero, dueño) | Consolidado CxC/CxP a nivel dueño. | `cuentasService` (`frappeCuentas`) | Ruta accesible solo a Gerente con `cuentas: true`; el propio comentario aclara que el backend recorta más — solo el dueño ve datos reales, el resto cae en `AccesoRestringido` detectado por regex sobre el mensaje de error (`/permiso/i`). |
| `Egresos.jsx` | Egresos | Captura de gastos, CFE, gasolina, mantenimiento, etc. Operaciones elige qué capturar en mosaicos; **Consulta** (`?modo=consulta`, 15-sep) entra directo a la tabla con dropdown Categoría (arranca en «Todas») → Subcategoría, y «Volver» regresa a Consultas. | `auth`, `egresosService` (`frappeEgresos`), `printService` | Roles: Almacén, Operaciones, Gerente. Muestra acceso a Nómina condicionalmente vía `getRoleConfig(role).rutas.includes('/nomina')` (mosaico y dropdown). 🔴 `cargar` solo pinta la respuesta del último pedido (`ultimoPedido`): al cambiar rápido de categoría, una respuesta vieja pintaba otra categoría bajo el título nuevo. |
| `EnvioSucursal.jsx` | Envío a sucursal | Traspasos internos de mercancía a sucursales. | `stockService` (`frappeStock`) | Roles: Operaciones, Gerente. Incluye `ReposicionInsumos` como botón/sub-vista ("sugerencia_envio") — evita duplicar pantalla (lección de sesión 24-ago). |
| `Inventario.jsx` | Inventario | Stock actual, agotados, cruce por almacén; ajustes y conteo físico. | `inventory`, `stockService` | Roles: Almacén, Operaciones, Gerente. Exporta también `FilaItem` (subcomponente, no confundir con `components/catalogo/FilaItem.tsx`). |
| `Inventario.test.jsx` | test | Prueba de render de filas de `Inventario`. | — | — |
| `Kardex.jsx` | Consultas → Kardex | Consumo de materia prima entre los dos últimos conteos físicos. | `kardexService` (`frappeKardex`), `inventory` | Roles: módulo `inventario` (Almacén, Operaciones, Gerente). Exporta `consumoEntreConteos` (testeado); devuelve `null` con menos de 2 conteos; el número incluye merma (documentado en la etiqueta de la vista). |
| `Kardex.test.js` | test | Prueba de `consumoEntreConteos`. | — | — |
| `Liquidacion.tsx` | Liquidación de camioneta de reparto | Cierre de ruta: qué regresa, qué se tiró; la venta sale por diferencia. | `camionetaService` (`frappeCamioneta`), `stockService` | Único rol: **Repartidor** (única pantalla de ese nivel, sin `/panel`; el backend saca el almacén de la sesión). Preview calculada en render con funciones puras — evita repetir el bug de `precio_final` desfasado (17-ago). |
| `Login.jsx` | Autenticación | Login. | `auth` (`frappeAuth`) | Pública. Redirige con `getRoleConfig(user.role).inicio`. Cuenta regresiva de bloqueo por intentos. |
| `Nomina.tsx` | Nómina | Corrida de nómina, empleados, reporte. | `nominaService` (`frappeNomina`), `printService` | Rol: solo Gerente. Tres subcomponentes internos: `Corrida`, `Empleados`, `Reporte`. |
| `Panel.jsx` | Panel/Dashboard | Tablero principal post-login; arma tiles por sección (operaciones/consultas/reportes/config). | `auth` (`frappeAuth`) | Todos los roles excepto Repartidor (no tiene `/panel` en su config). Gating de módulos vía `getRoleConfig(role).modulosPanel`. |
| `Panel.rutas.test.js` | test | Prueba de armado de rutas/tiles del Panel. | — | — |
| `Pedido.jsx` | Pedido diario | Importa el pedido ya cerrado (capturado en Drive a la 1AM) y genera PDF/Telegram. | `pedidoService`, `leerBase64`, `urlPdfPedido` (`frappePedido`) | Roles: Almacén, Operaciones, Gerente. `key` del `<input file>` se fuerza a cambiar para permitir reelegir el mismo archivo (comentario `ponytail`). |
| `POS.jsx` | Punto de venta (offline-first) | Venta en piso, catálogo, ticket, cobro; opera contra Dexie. | `printService` (`imprimirTicketTermico`); catálogo/stock/outbox vía `src/db` (fuera de alcance) | Roles: Vendedor, Gerente. No importa `services/frappePOS` directo — todo pasa por Dexie/`db/sync`. |
| `Produccion.jsx` | Producción | Recetas (BOM) + registro de producción. | `produccionService` (`frappeProduccion`), `stockService` | Rol: solo Gerente (único módulo del set `MOD_GERENTE` que no está en Almacén/Operaciones). Incluye `ModalEntradaPan` (alta de pan sin receta) y `NuevaReceta`. |
| `Proveedores.jsx` | Proveedores | Alta/edición, filtro activos/inactivos. | `proveedores` (`frappeSupplier`) | Roles: Almacén, Operaciones, Gerente. |
| `ReporteCompras.jsx` | Reportes → Compras | Resumen anual de compras. | `comprasService` (`frappePurchase`) | Rol: solo Gerente (`reportes: true`). |
| `ReporteCuentasPorCobrar.jsx` | Reportes → CxC | Wrapper de solo lectura sobre `TablaCuentasPorCobrar`. | — (delega en el componente, que consume `ventasService`) | Rol: solo Gerente. Archivo de 35 líneas, sin lógica propia. |
| `ReporteCuentasPorPagar.jsx` | Reportes → CxP | Lo que se le debe a cada proveedor: **compras + egresos** (14-sep), agrupado por `facturado_a`, con tarjeta de total partida en compras/egresos. **Vistas General / Compras / Egresos** (15-sep, dropdown «Vista» antes de «Facturado a», como los filtros de Compras): la vista manda sobre la tabla, el strip y el desglose; el backend manda un renglón por tipo y la tabla siempre agrupa por proveedor. Clic en el proveedor despliega sus documentos sin pagar (fecha, tipo, folio, factura, concepto, facturado a), con los estilos `cxc-*` de `global.css`. | `egresosService` (`frappeEgresos`) | Rol: solo Gerente. Exporta `VISTAS`, `deVista`, `docsDeVista`, `pendientePorFacturado`, `filasCxP`, `deudaTotal` y `consultaPendientes` (testeadas); el desglose se pide al desplegar (completo, se filtra por vista al pintar: cambiar de pestaña no vuelve a pedir), se guarda por proveedor+facturado y Actualizar lo tira; buckets fijos: ALMA RODRIGUEZ, LUIS TORRES, SIN FACTURA. |
| `ReporteCuentasPorPagar.test.js` | test | Prueba de `pendientePorFacturado`/`filasCxP`/`deudaTotal`/`consultaPendientes`/`deVista`/`docsDeVista`, con el caso difícil: proveedor con compra Y egreso bajo el mismo facturado. | — | — |
| `ReporteCuentasPorPagar.render.test.tsx` | test | Cableado de las vistas: el dropdown llega a tabla, tarjeta de total, strip y desglose; cambiar de vista no vuelve a pedir el desglose. | — | 15-sep: 9 mutantes de front, 9 muertos (uno murió primero por sintaxis y se rehízo: ese no cuenta). |
| `ReporteGastosAnual.jsx` | Reportes → Gastos anual | Todo lo gastado en un año, mes×categoría, con detalle e impresión a PDF. | `comprasService` (`frappePurchase`), `egresosService` (`frappeEgresos`) | Rol: solo Gerente. Agrega EN EL NAVEGADOR a propósito (comentario `ponytail`: ~770 compras + ~600 egresos/año, debajo del tope de 2000 de `getCompras`; si crece, se mueve a `GROUP BY` SQL). |
| `ReporteGastos.jsx` | Reportes → Gastos | Reporte de gastos (vista simple). | `reportesService` (`frappeReportes`) | Rol: solo Gerente. |
| `ReportesVentasCategoria.jsx` | Reportes → Ventas por categoría | Ventas agrupadas por categoría. | `ventasService` (`frappeSales`) | Rol: solo Gerente. |
| `ReporteValorizacion.test.ts` | test | Prueba de `pesos`/`piezas` (formatters). | — | — |
| `ReporteValorizacion.tsx` | Reportes → Valorización de envíos | Cuánto se mandó a sucursales y cuánto vale (costo y venta). | `pedidoService` (`frappePedido`) | Rol: solo Gerente. Separa vendible (con margen) de materia prima (margen `null`, nunca `$0.00`, para no decir que se regaló) — decisión de diseño documentada in situ. |
| `VentaB2B.jsx` | Venta B2B | Venta a clientes mayoreo (DELI, ZAKIA, etc.), CxC, cobros. | `ventasService` (`frappeSales`) | Roles: Operaciones, Gerente (Almacén NO tiene este módulo). Incluye `TablaCuentasPorCobrar` en modo con botón "Cobrar" y `ModalReciboPDF`. |
| `Catalogo.filtroPan.test.js` | test | Prueba del filtro de pan del Catálogo. | — | — |
| `ConsultaPedido.totales.test.ts` | test | Prueba de `totalesPedido`. | — | — |
| `Egresos.partidas.test.js` | test | Prueba de partidas/cálculo de Egresos. | — | — |
| `Egresos.consulta.test.tsx` | test | Consulta de egresos: entra directo a la tabla con TODAS las categorías (pide sin categoría), Nómina fuera del dropdown para quien no la ve, cambiar de categoría reinicia la subcategoría, una respuesta tardía no pisa la categoría elegida, Volver → Consultas. | — | 9 mutantes, 9 muertos. |

## Componentes (`src/components/`)

### Raíz de `components/`

| Archivo | Qué es | Usado por | Notas |
|---|---|---|---|
| `BannerConexion.jsx` | Aviso global de red caída. | Montado en `src/App.jsx` (raíz, fuera de alcance), no dentro de `Layout`. | Comentario explícito: Panel no pasa por `Layout`, por eso se monta en la raíz; sin esto, sin wifi se veía como error de programador. |
| `BuscadorCliente.jsx` | Selector/buscador de clientes B2B (precarga completa, filtra in-memory). | `NuevaVentaB2B.jsx` | Excluye sucursales internas de la lista de clientes. |
| `CantidadDual.tsx` | Input de cantidad capturable en base (Kg/Lt/Pza) o presentación (BULTO/CAJA), con conversión visible. | `NuevoEnvioSucursal.jsx`, `NuevaVentaB2B.jsx` | 🔴 Existe por el bug de UOM de $8,846.23 (julio): se tecleaba pensando bultos y guardaba Kg. `valor` es la única verdad; el campo contrario es vista derivada, nunca estado espejo. |
| `CantidadDual.test.ts` / `CantidadDual.render.test.jsx` | Tests de `CantidadDual` (funciones puras + cableado). | — | — |
| `ConteoFisico.jsx` | Modal de conteo físico de inventario. | `Inventario.jsx` | Exporta `contarPendientes`, `lineasAjuste` (testeadas). Filtra por tipo de item sin copiar el arreglo si no hay filtro (evita invalidar `useMemo` de gratis). |
| `ConteoFisico.test.js` | Test de `ConteoFisico`. | — | — |
| `ErrorBoundary.jsx` | Boundary de errores de React de toda la app. | Montado en `src/App.jsx` (raíz). | — |
| `HistorialMovimientos.jsx` | Historial de movimientos de stock por almacén. | `Inventario.jsx` | — |
| `Layout.jsx` | Shell/topbar + banner de "hay versión nueva, recarga cuando quieras". | Casi todas las páginas protegidas (Catalogo, Compras, Cuentas, Egresos, EnvioSucursal, Inventario, Kardex, Liquidacion, Nomina, Pedido, POS, Produccion, Proveedores, ConsultaPedido, ConsultaTablero, ConsultasPOS, Auditoria, y los 6 Reportes). | El banner de versión nunca recarga solo: espera a que el usuario decida. |
| `NuevaCompra.jsx` | Modal grande de alta de compra (694 líneas). | `ComprasModales.jsx` (`compras/`) | — |
| `NuevaReceta.jsx` | Alta/edición de receta (BOM). | `Produccion.jsx` | — |
| `NuevaVentaB2B.jsx` | Modal de alta de venta B2B. | `VentaB2B.jsx` | Incluye subcomponente interno `FilaProducto`. Columnas Precio venta (CON impuesto, `precioConImpuesto`) · Impuesto (píldora `nc-imp-badge` como Compras: nombre + monto) · Total (17-sep: antes la columna enseñaba la base sin impuesto y confundía). Exporta `precioB2B` (17-sep): el abarrote se vende al MISMO precio que en tienda — `custom_precio_de_venta` ya trae el impuesto, se le quita para la base y el impuesto va encima (antes VELAS $40.02 salía $46.42). Materia prima sigue al costo sin impuesto. |
| `NuevaVentaB2B.precio.test.ts` | Test de `precioB2B` con precios de la lista del piso: total B2B = precio de tienda × cantidad, exacto hasta 300 piezas y máximo 1 centavo hasta 500 (el rate a 6 decimales: ABUELITA ×395 sale +$0.01, marcado `ponytail`); MP no se divide. | — | 6 mutantes, 6 muertos. El backend (`sales_invoice.validar_precio_abarrote`) rechaza la venta si el rate no cuadra. |
| `NuevoEnvioSucursal.jsx` | Modal de alta de traspaso a sucursal. | `EnvioSucursal.jsx` | Incluye subcomponente interno `FilaEnvio`. |
| `NuevoInsumo.jsx` | Alta/edición de insumo (materia prima). | `Catalogo.jsx` | — |
| `NuevoPan.jsx` | Alta/edición de pan (producto terminado). | `Catalogo.jsx` | Usa el MISMO hook y creación de Item que `NuevoInsumo` a propósito (evita panes duplicados a dos precios). Exporta `margen()`, `comparaConSucursal()` (testeadas). |
| `NuevoPan.margen.test.js` | Test de `margen()`. | — | — |
| `NuevoProveedor.jsx` | Alta/edición de proveedor. | `Proveedores.jsx` | — |
| `ProtectedRoute.jsx` | Guard de rutas + precarga de `appConfig`/`sucursalesConfig`. | Montado en `src/App.jsx` (raíz), envuelve cada ruta protegida. | Depende del email del usuario (estable) en vez del objeto `user` completo, para no recargar configs en cada render. |
| `RegistroMerma.jsx` | Modal de registro de merma. | `Inventario.jsx` | Incluye subcomponente interno `FilaProducto`. |
| `RegistroRegalo.jsx` | Modal de regalo de proveedor (free goods, entra como Material Receipt a valor de mercado). | `Inventario.jsx` | Incluye subcomponente interno `BuscadorItem`. |
| `RegistroSalida.jsx` | Modal de salida/transferencia interna (Material Issue). | `Inventario.jsx` | Incluye subcomponente interno `FilaProducto`. |
| `ReposicionInsumos.tsx` | Sub-vista "qué falta reponer" por ritmo de reposición (no por saldo, que es ficción). | `EnvioSucursal.jsx` | — |
| `SelectorTipoItem.tsx` | Filtro presentacional (tipo de item) para buscadores de producto. | `RegistroSalida.jsx`, `ConteoFisico.jsx`, `RegistroMerma.jsx`, `RegistroRegalo.jsx`, `NuevoEnvioSucursal.jsx` | Existe porque los buscadores de materia prima mostraban los 227 panes también. El filtro real lo aplica el servidor, no un `.filter()` local. |
| `TablaCuentasPorCobrar.jsx` | Tabla de CxC B2B (tarjetas + tabla), compartida entre reporte (solo lectura) y venta (con botón Cobrar). | `VentaB2B.jsx`, `ReporteCuentasPorCobrar.jsx` | Expone `ref.recargar()`. |

### `catalogo/`

| Archivo | Qué es | Usado por | Notas |
|---|---|---|---|
| `catalogoTypes.ts` | Tipos TS compartidos del módulo Catálogo. | `FilaItem.tsx`, `VistaPan.tsx` | — |
| `FilaItem.tsx` | Fila de tabla para la vista "insumos" del catálogo. | `Catalogo.jsx` | — |
| `VistaPan.tsx` | Vista completa de pan del catálogo (costeo, margen). | `Catalogo.jsx` | Incluye subcomponentes internos `CeldaCostoPan`, `CeldaMargenPan`, `FilaPan`. |

### `compras/`

| Archivo | Qué es | Usado por | Notas |
|---|---|---|---|
| `BuscadorProveedor.jsx` | Selector/buscador de proveedor. | `Egresos.jsx`, `NuevaCompra.jsx` | — |
| `ComprasModales.jsx` | Orquestador de modales del módulo Compras (abre `NuevaCompra`, `ConfirmModal`). | `Compras.jsx` | — |
| `compraUtils.ts` | Funciones puras: `parseImpuesto`, conversión bulto↔kg, subtotales. | `FilaProducto.jsx` / `NuevaCompra.jsx` | — |
| `compraUtils.test.js` / `compraUtils.impuesto.test.ts` | Tests de `compraUtils`. | — | — |
| `FilaProducto.jsx` | Fila de captura de producto dentro de una compra (bultos/kg dual). | `NuevaCompra.jsx` | Píldora de impuesto: nombre arriba, monto del renglón abajo, sin porcentaje (17-sep). Misma píldora en `NuevaVentaB2B`. |
| `ModalPreciosActualizados.jsx` | Aviso post-compra de qué precios movió en el Catálogo. | `NuevaCompra.jsx` | 🔴 Reemplazó a `ModalSugerenciaPrecios`, que tenía botón "Omitir" — omitir dejaba el catálogo mintiendo sobre el costo real (causa de 39 insumos costeados por debajo de su costo real, 17-ago-2026). Ahora no hay decisión que tomar: solo avisa. |
| `ModalReciboPDF.jsx` | Preview/impresión del recibo de compra. | `NuevaCompra.jsx` | Homónimo de `modals/ModalReciboPDF.jsx` pero es otro archivo (recibo de compra vs. recibo de venta B2B). |

### `egresos/`

| Archivo | Qué es | Usado por | Notas |
|---|---|---|---|
| `CampoAjustable.tsx` | Renglón de total calculado con override manual ("gana el papel"). | `SubcatForm.tsx`, `LuzForm.tsx` | — |
| `egresosConstants.ts` | Listas constantes: vehículos, sucursales, teléfonos, tipos de mantenimiento/refacción/agua, subcategorías con IVA. | Formularios de `egresos/` | — |
| `egresosIcons.tsx` | Iconos SVG por categoría de egreso. | `Egresos.jsx` y formularios | — |
| `EgresosTabla.tsx` | Tabla principal de egresos capturados, con filtros Categoría (dropdown con «Todas», 15-sep) → Subcategoría (sale de los egresos cargados) → Facturado a → fechas → búsqueda. | `Egresos.jsx` | La categoría la cambia el padre (`onCategoria`); las opciones son las mismas que los mosaicos visibles para ese nivel. |
| `egresosTypes.ts` | Tipos TS compartidos del módulo Egresos. | Formularios de `egresos/` | — |
| `GasForm.tsx` | Formulario de gasto de gas LP. | `Egresos.jsx` | — |
| `GasolinaForm.tsx` | Formulario de gasolina (copia impuestos del CFDI, IVA+IEPS en cascada). | `Egresos.jsx` | — |
| `luzCalc.ts` | Cálculo puro del recibo CFE: IVA solo sobre energía, DAP exento, total TRUNCADO a pesos (no redondeado). | `LuzForm.tsx` | Verificado contra el papel; DAP dentro de la base daría IVA de 212.75 cuando el recibo real dice 196.99. |
| `luzCalc.test.ts` | Test de `calcLuz`. | — | — |
| `LuzForm.tsx` | Formulario de recibo CFE. | `Egresos.jsx` | — |
| `simpleCalc.ts` | Cálculo puro de gasto simple (monto + un impuesto). | `SubcatForm.tsx` | Antes vivía duplicado (`SubcatForm` calculaba para pintar, `Egresos.jsx` recalculaba para guardar) — unificado en una sola fuente. |
| `simpleCalc.test.ts` | Test de `calcSimple`. | — | — |
| `SubcatForm.tsx` | Formulario genérico por subcategoría de egreso. | `Egresos.jsx` | — |

### `modals/`

| Archivo | Qué es | Usado por | Notas |
|---|---|---|---|
| `ConfirmModal.jsx` | Modal de confirmación genérico. | Muchas pantallas: `ConsultasPOS`, `EnvioSucursal`, `VentaB2B`, `Produccion`, `Proveedores`, `Catalogo`, `RegistroMerma`, `RegistroRegalo`, `ModalPreciosActualizados`, `ComprasModales`. | `hideCancel` para modales que solo AVISAN (no hay decisión que tomar). |
| `ConfirmModal.test.jsx` | Test de `ConfirmModal`. | — | — |
| `ModalEntradaPan.jsx` | Alta de pan terminado SIN receta (mientras no existan BOM). **Precarga los renglones del pedido del día** (09-sep): 66 panes el 09-sep, cada uno con su cantidad pedida, y enseña `pedido: N · corregido` al lado para que un número corregido se vea distinto del pedido. Sin pedido cargado, avisa y sigue sirviendo a mano. | `Produccion.jsx` | Exporta `resolverItemCode`, `itemsPayload`, `calcularValor`, `filasDesdePedido`, `hoyISO`, `costoTexto` (todas testeadas; 8 mutantes muertos). Buscador con `<datalist>` nativo (ponytail: ~50 panes, sin autocomplete propio). 🔴 `hoyISO` NO usa `toISOString()`: en México eso adelanta el día después de las 18:00 y pediría el pedido de mañana. 🔴 No consulta la receta de cada renglón precargado (serían 66 peticiones): el servidor ya ignora el costo tecleado cuando hay receta. 🔴 `costoTexto` corta el ruido de coma flotante del costo provisional (`8.70 × 0.35 = 3.0449999999999995`) a 4 decimales, y devuelve VACÍO —nunca `'0'`— cuando no hay costo: un 0 mete pan gratis al inventario. |
| `ModalEntradaPan.test.js` | Test de `ModalEntradaPan`. | — | — |
| `ModalError.jsx` | Modal de error/advertencia genérico. | Casi todas las pantallas de captura (`ConsultaPedido`, `Auditoria`, `ReporteValorizacion`, `Produccion`, `Cuentas`, `Pedido`, `ConsultasPOS`, `ConsultaTablero`, `RegistroSalida`, `NuevoEnvioSucursal`, `RegistroMerma`, `NuevaReceta`, `NuevoInsumo`, `NuevoProveedor`, `RegistroRegalo`, `NuevoPan`, `ConteoFisico`, `NuevaCompra`, `NuevaVentaB2B`). | 🔴 Histórico (21-ago-2026): si recibía el objeto crudo de `parseErrorFrappe` en vez de un string, React tiraba el error #31 y el `ErrorBoundary` se llevaba TODA la pantalla, tapando justo el error que iba a mostrar. Ya blindado (usa `.message`). |
| `ModalError.objeto.test.jsx` | Test que reproduce ese caso (objeto en vez de string). | — | Es el test que prueba el fix del bug de arriba. |
| `ModalHojaEntrega.jsx` | Hoja de entrega para traspaso a sucursal (PDF/impresión, sin precios). | `EnvioSucursal.jsx`, `NuevoEnvioSucursal.jsx` | — |
| `ModalReciboPDF.jsx` | Preview/impresión de recibo de venta B2B. | `VentaB2B.jsx`, `NuevaVentaB2B.jsx` | Homónimo de `compras/ModalReciboPDF.jsx` pero archivo distinto (recibo de venta, no de compra). |
| `ModalRegistrarPago.jsx` | Modal para registrar cobro contra facturas pendientes de un cliente. Resumen arriba (deuda, # facturas, se cobra) y **clic en la factura despliega sus productos** (14-sep): qué se debe, no solo cuánto. | `TablaCuentasPorCobrar.jsx` | Arranca vacío; cobra exactamente lo marcado (soporta pago parcial por fila). La casilla va en la ÚLTIMA columna, después de Asignar (15-sep). Productos vía `ventasService.getFacturaItems`, pedidos al abrir y guardados por factura (reabrir no vuelve a pedir). La casilla y el monto cortan el clic para no desplegar. Estilos en `styles/RegistrarPago.css`. |
| `ModalRegistrarPago.test.tsx` | Test del cableado: productos una sola petición, casilla/monto no despliegan, error visible ≠ factura vacía, cobra el SALDO y no el total. | — | 5 mutantes probados, 5 muertos. La factura de prueba trae abono previo (total ≠ saldo): sin eso el mutante «cobra el total» sobrevivía. |

### `pos/`

| Archivo | Qué es | Usado por | Notas |
|---|---|---|---|
| `POSCatalogo.jsx` | Grid de productos del POS. | `POS.jsx` | Exportado con `React.memo`. |
| `POSHistorial.jsx` | Historial/lista de ventas del día. | `ConsultasPOS.jsx` | Exportado con `React.memo`. |
| `POSModalCantidad.jsx` | Modal para editar cantidad de un renglón del ticket. | `POS.jsx` | — |
| `POSModalCobro.jsx` | Modal de cobro (multi-forma de pago). | `POS.jsx` | — |
| `POSModalCorte.jsx` | Modal de corte de caja. | `ConsultasPOS.jsx` | — |
| `POSModalEspera.jsx` | Modal de tickets en espera (ventas pausadas). | `POS.jsx` | — |
| `POSTicket.jsx` | Ticket en pantalla. | `POS.jsx` | Exportado con `React.memo`. |
| `posUtils.ts` | Funciones puras: `fmt` (moneda), `calcularCobro`, colores por depto, formateo de modo de pago. | `POS.jsx` y componentes `pos/*` | Comentario: antes `$${toFixed(2)}` imprimía `$12345.67` en vez de `$12,345.67` en un corte de caja. |
| `posUtils.test.js` | Test de `posUtils`. | — | — |

## Estilos (`src/styles/`)

| Archivo | Sirve a | Notas |
|---|---|---|
| `BannerConexion.css` | `BannerConexion.jsx` | `@media print` está scoped a `.banner-conexion` — seguro. |
| `CatalogoPan.css` | `Catalogo.jsx` (vista pan) | — |
| `Compras.css` | `Compras.jsx`; reusado por `Egresos.jsx` | — |
| `Cuentas.css` | `Cuentas.tsx` | — |
| `Egresos.css` | `Egresos.jsx` | — |
| `global.css` | Compartido por casi todas las páginas (tokens/variables raíz del diseño Bento: colores, radios, sombras, escala de espaciado) | Es la base de la skill `diseno_bento_grid`. Se importa en 18+ páginas. |
| `Layout.css` | `Layout.jsx` (shell/topbar) | `@media print` scoped a `.version-banner` — seguro. |
| `Liquidacion.css` | `Liquidacion.tsx` | — |
| `Login.css` | `Login.jsx` | ✅ Corregido el 08-sep. Todo va acotado con `html:has(.login-container)` / `body:has(.login-container)`, y los nombres genéricos (`.form-group`, `.form-input`, `.feature`…) cuelgan de `.login-container`. El `* { box-sizing }` se mudó a `index.css`: era el único reset de caja de la app y scoparlo habría volteado el modelo de caja en todas las pantallas. |
| `Nomina.css` | `Nomina.tsx` | — |
| `NuevaCompra.css` | `NuevaCompra.jsx`; reusado como shell de modal por `ConteoFisico.jsx`, `NuevaVentaB2B.jsx`, `NuevoEnvioSucursal.jsx`, `ModalEntradaPan.jsx`, `Egresos.jsx` | Funciona como CSS genérico de "modal grande de captura", no solo de compras. |
| `NuevoInsumo.css` | `NuevoInsumo.jsx` | — |
| `NuevoPan.css` | `NuevoPan.jsx` | — |
| `NuevoProveedor.css` | `NuevoProveedor.jsx` | — |
| `Panel.css` | `Panel.jsx`; reusado por `ConsultasPOS.jsx`, `Egresos.jsx`, `Produccion.jsx`, `Catalogo.jsx` | Layout de tiles compartido entre esas pantallas. |
| `Pedido.css` | `Pedido.jsx`; reusado por `ConsultaPedido.tsx`, `ConsultaTablero.tsx`, `ReporteValorizacion.tsx` | Familia visual de pedido/consultas. |
| `pos/POSCatalogo.css` | `POSCatalogo.jsx` | — |
| `pos/POS.css` | `POS.jsx` | — |
| `pos/POSHistorial.css` | `POSHistorial.jsx` | — |
| `pos/POSModals.css` | Modales del POS (`POSModalCobro`, `POSModalCorte`, `POSModalEspera`, `POSModalCantidad`) + ticket de corte imprimible | 🔴 **Histórico ya corregido y documentado in situ**: el `@media print` original apagaba `body` de TODA la app al imprimir (`POS.jsx` se importa eager, así este CSS entra al bundle principal y afecta cualquier otra pantalla, p. ej. `ReporteGastosAnual`). El fix actual usa `body:has(#ticket-corte-imprimible) > * { display: none }`, scoped al ticket de corte — ya no es un selector ciego. |
| `pos/POSTicket.css` | `POSTicket.jsx` | — |
| `Produccion.css` | `Produccion.jsx`; reusado por `NuevaReceta.jsx`, `compras/ModalPreciosActualizados.jsx` | — |
| `RegistroMovimiento.css` | `RegistroMerma.jsx`, `RegistroSalida.jsx`, `RegistroRegalo.jsx` | — |
| `RegistrarPago.css` | `modals/ModalRegistrarPago.jsx` | Todo colgado de `.rp-*`, con tokens Bento de `global.css`. Overlay y botones siguen viniendo de `NuevaCompra.css` (`nc-modal-overlay`, `nc-btn-*`). |
| `ReporteGastosAnual.css` | `ReporteGastosAnual.jsx` | ✅ Corregido el 08-sep. El `@media print` ahora usa `body:has(.rga) *`; antes, con solo haber abierto el reporte una vez en la sesión, cualquier impresión posterior salía en blanco. |

## `public/` y `docs/`

| Archivo | Qué es | Notas |
|---|---|---|
| `public/logo_GRACE.png` | Logo de la panadería. | Usado en `src/pages/Login.jsx` y como default en `src/config/tenant.ts` (fuera de alcance). |
| `public/nuevologobkd.png` | Favicon. | Referenciado en `index.html` (raíz, fuera de alcance) como `<link rel="icon">`. |
| `public/ticket_preview.html` | Mockup estático (HTML+CSS embebido) de un ticket térmico de venta. | No se referencia desde `src/` ni desde `index.html` — es una herramienta de preview manual para diseño, no se sirve en runtime de la app. |
| `docs/screenshots/panel.png` | Captura del Panel. | Referenciada en `README.md` (raíz, fuera de alcance). |
| `docs/screenshots/catalogo.png` | Captura del Catálogo. | Referenciada en `README.md`. |
| `docs/screenshots/compras.png` | Captura de Compras. | Referenciada en `README.md`. |
| `docs/screenshots/pos.png` | Captura del POS. | Referenciada en `README.md`. |
| `docs/screenshots/proveedores.png` | Captura de Proveedores. | 🔴 No referenciada en `README.md` — huérfana (no confirmado si se usa en otro doc fuera de alcance). |
## Servicios (`src/services/`) — la frontera con el backend

Patrón común: cada servicio extiende `FrappeBase` (`src/services/FrappeBase.ts`) y expone un singleton (`export const xService = new XService()`). Casi todos pegan a `/api/method/gestion_panaderia.api.<modulo>_api.<metodo>` (custom API Python whitelisted) o a `/api/resource/<DocType>` (REST genérico de Frappe).

**`FrappeBase.ts`** — Clase base. `getHeaders()` agrega `X-Frappe-CSRF-Token` SOLO si `window.csrf_token` existe (comentario explícito: en prod nunca existe porque el index.html no lo sirve Frappe, así que se omite en vez de mandar un valor falso). `_fetch()` es el único punto de red: `credentials:'include'`, `cache:'no-store'`; en error de red (`TypeError`) devuelve `null` (offline controlado); en `!response.ok` parsea `_server_messages` de Frappe y lanza `Error` con `.status` adjunto — 🔴 comentario: esto existe para que el outbox distinga un 5xx transitorio (deploy, nginx reiniciando) de un 4xx real (dato malo), porque antes una venta buena se marcaba error permanente por un 502 de 2 minutos.

| Archivo | Qué hace | Exporta | Endpoints que consume |
|---|---|---|---|
| `FrappeBase.ts` | Clase base HTTP (headers CSRF, fetch, parseo de error Frappe) | `default FrappeBase` | — |
| `appConfig.ts` | Config global ERPNext (cuentas COA, item tax templates) con fallback hardcoded si el endpoint falla; cache module-level | `loadAppConfig`, `getAppConfigSync`, `clearAppConfigCache`, tipo `AppConfig` | `GET /api/method/gestion_panaderia.api.config.get_app_config` |
| `sucursalesConfig.ts` | Config dinámica de sucursales internas/destino, con fallback vacío a propósito (🔴 comentario: un destino hardcodeado se pudre al primer rename de almacén — pasó con `MP PUERTA - PG`) y patrón pub/sub (`subscribeSucursalesConfig`) para hooks React | `loadSucursalesConfig`, `getSucursalesConfigSync`, `clearSucursalesConfigCache`, `subscribeSucursalesConfig`, tipos | `GET /api/method/gestion_panaderia.api.config.get_sucursales_config` |
| `frappeAuth.ts` | Login/logout, sesión (cookie `sid`), rol del usuario, POS profile, permiso "puede administrar cuentas"; `getUser()` valida estructura de localStorage para evitar escalar rol vía DevTools | `auth` (instancia `FrappeAuthService`) | `POST /api/method/login`, `GET /api/method/frappe.auth.get_logged_user`, `GET .../pos_api.get_user_app_role`, `GET .../pos_api.get_pos_profile_usuario`, `GET .../cuentas_api.puede_administrar_cuentas`, `GET /api/method/logout`, `GET /api/resource/{doctype}` (genérico) |
| `frappeAuditoria.ts` | Feed de auditoría (quién hizo qué) y lista de operadores | `auditoriaService` | `GET .../auditoria_api.feed`, `GET .../auditoria_api.operadores` |
| `frappeCamioneta.ts` | Cierre de ruta de camionetas: mi ruta, resumen del día, cerrar día (traspaso + Material Issue). 🔴 Comentario: el almacén NUNCA se manda desde el front en el cierre — el backend lo saca de la sesión, para que cerrar la ruta ajena no sea "cambiar una cadena en el navegador" | `camionetaService` (default y named) | `GET .../camioneta_api.mi_ruta`, `GET .../camioneta_api.resumen_dia`, `POST .../camioneta_api.cerrar_dia` |
| `frappeCuentas.ts` | Administración de usuarios/nivel/POS profile (rol Gerente + System Manager) | `cuentasService` | `POST .../cuentas_api.cambiar_nivel`, `POST .../cuentas_api.cambiar_pos_profile`, y otros `_get`/`_post` genéricos sobre `cuentas_api.*` |
| `frappeEgresos.ts` | CRUD de Egreso (gastos, CxP): listar, obtener, crear, marcar pagado, eliminar, desglose de lo que se debe a un proveedor (`getPendientesProveedor`, truena sin red en vez de decir «no debe nada») | `egresosService` | `GET/POST .../egresos_api.*` |
| `frappeInventory.ts` | Catálogo: warehouses, item groups, UOMs, departamentos, presentaciones, CRUD de Item (crear/editar/renombrar/eliminar/deshabilitar/habilitar), stock, productos por estado (con stock, deshabilitados, agotados). Cache privada (`#cachedFetch`) | `inventory` / `default FrappeInventoryService`, interfaces `RenglonReposicion`, `Reposicion` | `GET /api/resource/Warehouse`, `/Item Group`, `/UOM`, `/Custom Field` (para `custom_presentación`), `/Item` (CRUD completo), `POST /api/method/frappe.client.rename_doc` |
| `frappeKardex.ts` | Kardex de movimientos por item/almacén/rango + lista de items activos | `kardexService` | `GET .../kardex_api.get_kardex`, `GET /api/resource/Item?...` |
| `frappeNomina.ts` | Empleados, sucursales, corridas de nómina (crear/cancelar), reporte de costo real | `nominaService`, interfaces `Empleado`, `Corrida`, `NuevaCorrida`, etc. | `GET/POST .../nomina_api.*` (sucursales, empleados, corridas, reporte_costo_real) |
| `frappePedido.ts` | Importa el pedido diario (.xlsx de Drive, base64) al backend; consulta fechas, tablero, valorización, sugerencia de envío | `pedidoService`/`default`, `leerBase64`, `urlPdfPedido`, muchas interfaces (`HojaPedido`, `Tablero`, `Valorizacion`, `Cuadre`, etc.) | `POST/GET .../pedido_api.*` (previsualizar, importar, fechas, consultar, sugerencia_envio, tablero, valorizacion, hay_pedido, destinatarios, enviar) |
| `frappePOS.ts` | Flujo de punto de venta: perfil POS, búsqueda de productos, `crearVentaOffline` (llamado por el outbox), corte de caja, historial de ventas, cancelar venta | `posService`/`default` | `GET/POST /api/method/{frappeApp}.api.pos_api.*` — usa `TENANT.frappeApp`, no hardcodeado |
| `frappeProduccion.ts` | Recetas (BOM): CRUD, activar/desactivar, costeo (batch y en vivo), registrar producción/entrada de pan, stock bajo mínimo. Depende de `stockService` (frappeStock) | `produccionService`/`default` | `GET/POST .../produccion_api.*` + reutiliza `frappeStock` para el `Stock Entry` de Material Issue |
| `frappePurchase.ts` | Purchase Receipt: catálogo de items, proveedores, borradores, confirmar/cancelar compra, consolidar/desconsolidar facturas, revertir pagado (con password), reporte fiscal mensual, historial de precios | `comprasService`/`default` | `GET/POST .../compras_api.*` (get_items_catalogo, get_siguiente_no_compra, cancelar_consolidado, revertir_pagado, consolidar_compras, etc.) + `/api/resource/Purchase Receipt` (implícito vía nombres de método) |
| `frappeReportes.ts` | Reporte de gasto unificado (Compras + Egresos por cuenta) | `reportesService` | `GET .../reportes_api.reporte_gastos` |
| `frappeSales.ts` | Sales Invoice para Venta B2B (clientes externos: PUERTA REAL/ALEJANDRO TORRES, DULCE CARAMEL, DELI, ZAKIA); cálculo de impuestos y totales (funciones puras exportadas), cuentas por cobrar, pagos/abonos | `ventasService`/`default`, funciones puras `agruparImpuestosVenta`, `calcularTotalesVenta`, `saldoCobrable` | `GET/POST /api/resource/Sales Invoice`, `/Customer`, `/Item`, `/Payment Entry`, `/Payment Entry Reference`, `POST /api/method/frappe.client.cancel`, `GET .../reportes_api.cuentas_por_cobrar` |
| `frappeStock.ts` | Núcleo de movimientos de inventario: almacenes (por tipo BODEGA/DEPARTAMENTO/SUCURSAL/CAMIONETA/PUNTO DE VENTA), entradas/salidas/mermas/ajustes/regalos/transferencias a sucursal, conteo físico, historial. Resuelve precio por canal vía `utils/precioCanal` (pura) | `stockService`/`default`, re-exporta tipo `TipoPrecio` | `GET/POST /api/resource/Stock Entry`, `/Stock Reconciliation`, `/Item`, `POST /api/method/frappe.client.cancel`, `POST .../inventory_api.crear_ajuste_inventario`, `POST .../regalos.registrar_regalo` |
| `frappeSupplier.ts` | Directorio de proveedores (activos/inactivos, búsqueda, paginación) | `proveedores`/`default` | `GET .../proveedores_api.get_proveedores`, `/api/resource/Supplier` |
| `printService.ts` | Cliente HTTP hacia el print-server (`/print/...`, proxeado por nginx/Vite) para tickets térmicos: venta simple, corte de caja, traspaso, venta B2B, regalo, nómina (fire-and-forget), egreso (con fallback a `window.print()` si la térmica no responde) | `imprimirTicketTermico`, `imprimirCorteTermico`, `imprimirTraspasoTermico`, `imprimirVentaB2BTermico`, `imprimirRegaloTermico`, `imprimirNominaTermico`, `imprimirEgresoTicket` | `POST /print/imprimir`, `/imprimir-corte`, `/imprimir-traspaso`, `/imprimir-venta-b2b`, `/imprimir-regalo`, `/imprimir-nomina`, `/imprimir-egreso` (print-server, no ERPNext) |

Tests de servicios (ver sección Tests): `frappePedido.test.ts`, `frappePurchase.buscar.test.js`, `frappeSales.cxc.test.js`, `frappeSales.totales.test.js`, `frappeStock.envio.test.js`.

## Utilidades (`src/utils/`)

Todas las funciones de `src/utils/*.ts` (excluyendo `print/`) son **puras**: sin `fetch`, sin `window`/`document`/`localStorage`, sin importar servicios de red — con dos excepciones marcadas abajo.

| Archivo | Qué hace | ¿Puro? | Tiene test |
|---|---|---|---|
| `catalogoUtils.ts` | Margen de un pan (`calcularMargen`), categorías presentes (`categoriasDePanes`), filtro de panes (`filtrarPanes`) | Sí | No |
| `charolas.ts` | Convierte piezas a texto "N char + M pz", espejo de `_charolas` en `pedido_api.py` (backend) — mismo cálculo en dos lenguajes a propósito, con tests paralelos | Sí | Sí (`charolas.test.ts`) |
| `cierreRuta.ts` | Lógica pura del cierre de ruta de camioneta: convierte texto tecleado a cantidades, detecta excesos, previsualiza liquidación (usa `liquidacion.ts`). 🔴 Comentario: no convertir strings a número demasiado pronto — ahí vivió el bug del campo dual del 04-sep | Sí | Sí (`cierreRuta.test.ts`) |
| `costoAnomalo.ts` | Detecta renglones de compra con costo anómalo vs. mediana histórica del item (niveles `ok/aviso/bloqueo`). 🔴 Documenta el incidente real `MAT-PRE-2026-00095` ($8,846.23 de fuga por UOM mal capturada) que motivó bloquear (no solo avisar) | Sí | Sí (`costoAnomalo.test.ts`) |
| `egresosUtils.ts` | Auto-detección de subcategoría "Agua" por proveedor; cálculo de totales de partidas de egreso reusando `calcularTotalesEfectivos` de Compras | Sí (importa función pura de `components/compras/compraUtils`, fuera de mi alcance pero sin efectos) | No |
| `errorFrappe.ts` | Traduce errores crudos de Frappe (HTML con stack) a `{title, message}` legibles; `logError()` es el punto único de logging no-fatal (reemplaza `console.error` disperso) | Casi puro — `logError` hace `console.error` (efecto de logging, intencional y centralizado) | Sí (`errorFrappe.test.js`) |
| `formato.ts` | Formato de números/dinero es-MX: `numero()`, `pesos()`, `cantidad()`. 🔴 Comentario: NO usa `Intl` `style:'currency'` porque el símbolo varía entre navegadores (`$` vs `MX$`); normaliza `-0` para no imprimir "-0.00"; el signo negativo va antes del `$` | Sí | Sí (`formato.test.ts`) |
| `gastosAnuales.ts` | Consolidado anual de gasto (Compras + Egresos, sin doble conteo de Nómina), agrupación por familia/bloque fiscal (CON/SIN FACTURA), paleta de color estable por categoría. Documenta reglas de negocio extensas (fecha del hecho no de captura, Activo Fijo/Préstamo cuentan como salida aunque no sean gasto contable) | Sí | Sí (`gastosAnuales.test.js`) |
| `gruposDestino.ts` | Ordena destinos del pedido por grupo (SUCURSALES/CAMIONETAS/OTROS) para el encabezado de la hoja | Sí | Sí (`gruposDestino.test.ts`) |
| `hora.ts` | Formatea horas/fechas de Frappe (`str(timedelta)` sin cero a la izquierda), "hace N tiempo" con `Intl.RelativeTimeFormat` nativo (ponytail: sin date-fns) | Sí | Sí (`hora.test.js`) |
| `itemGroups.ts` | Clasifica categorías del árbol de Item Group usando nested set (`lft`/`rgt`) de ERPNext en vez de comparar `parent_item_group` directo — soporta cualquier profundidad | Sí | Sí (`itemGroups.test.js`) |
| `liquidacion.ts` | Aritmética pura de liquidación de ruta de camioneta: `vendido = salió − regresó − mermado`; comisión 10% + $200 fijo; redondeo half-up robusto (`toPrecision(12)` antes de `Math.round`) | Sí | Sí (`liquidacion.test.js`), y además lo ejercita `cierreRuta.test.ts` |
| `nominaTotales.ts` | Totales de una corrida de nómina (bruto/deducciones/neto), payload del ticket térmico — replica `validate()` de `corrida_de_nomina.py` del backend | Sí | Sí (`nominaTotales.test.js`) |
| `pedidoDia.ts` | Junta las pestañas marcadas del pedido en la vista "todo el día", sumando piezas por destino y recalculando charolas | Sí | Sí (`pedidoDia.test.ts`) |
| `precioCanal.ts` | Resolución pura del precio de venta por canal (normal/pueblos/camioneta) según tipo de almacén. 🔴 Documenta que `custom_precio_por_kg` NO es precio de venta (se deriva de compra) — meterlo en la cadena inflaba falsas "ventas con pérdida" | Sí | Sí (`precioCanal.test.ts`) |
| `produccionCalc.ts` | Aritmética pura de recetas/producción: factor de escala del BOM, escalado de ingredientes, costeo de líneas. 🔴 Comentario: aquí vivió el bug del −$1M (escalar mal el consumo de ingredientes) | Sí | Sí (`produccionCalc.test.ts`) |
| `security.ts` | Rate limiter de login (bloqueo tras 5 intentos, `sessionStorage`), sanitizador anti-XSS (`sanitizar`/`sanitizarObjeto`, quita HTML y null bytes — NO filtra SQLi porque Frappe parametriza), validadores de campo (correo/teléfono/texto/número/usuario) | NO — usa `sessionStorage` (estado del navegador) | Sí (`security.test.js`) |
| `stockMP.ts` | Mapea filas de stock crudo a un objeto por item_code con info de presentación (`buildStockMapKg`, pura) + wrapper async que llama al servicio (`fetchStockMapKg`, con inyección de dependencias) | `buildStockMapKg` sí es pura; `fetchStockMapKg` no (llama a `frappeInventory`, aunque testeable por DI) | Sí (`stockMP.test.js`) |
| `uom.ts` | Alias de display para UOM (`L`/`l` → `Lt`), solo visual, no toca lo que se manda a la API | Sí | Sí (`uom.test.js`) |
| `version.ts` | Detección de deploy nuevo: extrae el hash del bundle Vite del HTML de prod y lo compara con el cargado. `bundleCargado(doc)` recibe el `Document` como parámetro inyectado (sin leer `window`/`document` global directamente) | Sí (I/O inyectado, sin efectos propios) | Sí (`version.test.js`) |

### `src/utils/print/`

Generación de HTML/plantillas para tickets térmicos y compra. Mezcla funciones puras de armado de HTML con unas pocas que sí hacen red o abren ventanas.

| Archivo | Qué hace | ¿Puro? |
|---|---|---|
| `escHTML.ts` | Escapa entidades HTML (`&<>"'`) | Sí |
| `egresoDesglose.ts` | Agrupa partidas de egreso por tasa de impuesto para el ticket, deriva el ajuste sin guardarlo en campo propio (🔴 evita ceros negativos "-0.00" con `+ 0`) | Sí |
| `printUtils.ts` | `imprimirHTML()`: abre popup, inyecta HTML, dispara `window.print()` | No — usa `window.open`/`document.write` |
| `corteTemplate.ts` | `generarHTMLCorte()`: arma el HTML del ticket de corte de caja | Casi puro (usa `new Date()` internamente para el timestamp de generación, sin I/O externo) |
| `ticketTemplate.ts` | `generarHTMLTicket()`, `generarHTMLTicketCompra()`: HTML de ticket de venta y de compra | Casi puro (usa `new Date()` para fecha) |
| `comprasPrint.ts` | `docToDatosImpresion()` (pura: mapea doc Purchase Receipt a formato de impresión); `imprimirCompraTicket()`/`imprimirTicketConsolidado()` hacen `fetch('/print/...')` con fallback a `window.open`+`window.print()`; `imprimirCompraPDF()` abre ventana e imprime | Mixto — la función de mapeo es pura, las de "imprimir" son efectos de red/DOM |

## Base local (`src/db/`) — Dexie / offline

**`db.ts`** define la base `grace_pos` (Dexie/IndexedDB) con 5 tablas y 3 versiones de esquema:

- **v1**: `catalogo` (índice `item_code, custom_departamento` — caché del catálogo para POS offline), `stock` (índice `item_code` — stock cacheado), `outbox` (índice `uuid, estado` — cola de ventas pendientes de sincronizar).
- **v2**: agrega `conteo` (índice `key` = `` `${fecha}|${warehouse}` `` — borrador de conteo físico, un renglón por almacén/día).
- **v3**: agrega `borradores` (índice `key` — borrador genérico de formulario largo: envío, compra, venta B2B; un renglón por formulario, sin clave por día).

Interfaces TS: `CatalogoItem`, `StockRow`, `OutboxVenta` (`estado: 'pendiente'|'error'`, `uuid` propio para idempotencia server-side), `ConteoBorrador`, `BorradorForm`.

**El outbox (`sync.ts`)** — mecanismo offline-first:
- `seedCatalogo()` / `seedStock()`: siembran Dexie desde el backend (`posService.buscarProductos()`, `stockService.getStockPorAlmacen()`); fallan degradado (`false`), nunca lanzan.
- `drainOutbox()`: procesa las ventas `pendiente` en orden (`sortBy('created_at')`), single-flight (`_draining` flag evita drenados concurrentes). Por cada venta:
  - `null` (sin red) → aborta el loop entero, las demás quedan `pendiente` para el próximo trigger.
  - `throw` con `status` 4xx → marca esa fila `error` y **continúa** con las siguientes (una venta podrida no bloquea la cola).
  - `throw` con `status` 5xx o sin status → **transitorio**, aborta el loop sin condenar la fila (🔴 razón documentada: sin esto, una venta buena capturada durante un deploy de ~2 min quedaba `error` permanente — pérdida contable muda).
  - éxito (incluida `duplicada:true`, que cuenta como éxito) → `delete` del outbox.
  - Tras drenar con éxito, relee stock autoritativo (`seedStock`) — **push antes de pull**, a propósito: leer el stock antes resucitaría stock ya vendido.
- `contarErrores()` / `reintentarErrores()`: cuentan filas `error` y las regresan a `pendiente` para reintento manual.
- Toda la función acepta inyección de dependencias (`Deps`) para testear sin red ni IndexedDB real.

**`borradorLocal.ts`** — autosave de formulario largo genérico: `guardarBorradorForm(key, datos)` (borra el renglón si `datos == null`, en vez de dejar un borrador vacío fantasma), `cargarBorradorForm(key)`, `borrarBorradorForm(key)`.

**`conteoBorrador.ts`** — autosave del conteo físico, con clave por almacén+día (`claveBorrador`); mismo patrón (borra si no hay nada capturado).

**`uuid.ts`** — `generateUUID()`: UUID v4 manual vía `crypto.getRandomValues()` en vez de `crypto.randomUUID()`, porque este último exige contexto seguro (HTTPS/localhost) y la app corre también sobre HTTP+LAN.

## Hooks (`src/hooks/`)

| Archivo | Qué hace |
|---|---|
| `useAutoUppercase.ts` | Efecto global: intercepta el evento `input` en captura (`document.addEventListener('input', handler, true)`) y fuerza mayúsculas en inputs/textareas, salvo tipos excluidos (password, email, number, date, etc.) y campos marcados `data-no-upper`. 🔴 Comentario: revisa `autocomplete` (no `type`) para detectar contraseñas reveladas con el "ojito", porque el `type` cambia a `text` pero `autocomplete` no. |
| `useBorradorLocal.js` | Autosave de un formulario contra `db/borradorLocal.ts`, con debounce (`delay=600`), namespaced por usuario (`claveUsuario` agrega el email — comentario: IndexedDB es del navegador, no del usuario, en PC compartida). No guarda hasta que termina de hidratar (evita que el autosave se coma su propio respaldo en el primer render). |
| `useCompras.ts` | Hook grande de la pantalla de Compras: orquesta `frappePurchase`, `frappeEgresos`, filtros, modales de confirmación (`useConfirmModal`), impresión de tickets. Importa utilidades fuera de mi alcance (`components/compras/compraUtils`). |
| `useConexion.ts` | Estado de conexión (`'ok'|'sin-conexion'|'volvio'`) basado en `navigator.onLine` + eventos `online`/`offline` nativos (ponytail: sin polling propio). `'volvio'` es un estado explícito (no vuelve solo a `'ok'`) para ofrecer recargar sin perder el formulario. |
| `useConfirmModal.ts` | Hook genérico para modales de confirmación con acción async, estado `loading`/`error`, y `fallbackAction` opcional (ej. deshabilitar si eliminar falla). |
| `useDebounce.ts` | Debounce genérico de un valor (`delay` default 350ms). |
| `useInsumoForm.ts` | Hook grande del formulario de alta/edición de Item (insumo/pan): carga catálogos, cálculo bidireccional de precio (costo↔venta↔porcentaje de ganancia), generación de código, validaciones, submit con manejo de errores Frappe traducidos a mensajes de UI. Exporta también `resolverCodigoInterno()` (pura, testeada aparte). |
| `useSucursales.ts` | Hook reactivo sobre `sucursalesConfig` (se suscribe a cambios de cache + dispara `loadSucursalesConfig()`). |
| `useVersionNueva.ts` | Avisa cuando hay deploy nuevo sin recargar solo (evita perder un carrito de venta a medio hacer). Revisa al volver a la pestaña (`visibilitychange`) y cada 15 min; usa `utils/version.ts` para comparar hashes de bundle. |

## Configuración de la app (`src/config/`)

| Archivo | Qué hace |
|---|---|
| `constants.ts` | Re-exporta `COMPANY`, `BODEGA_CENTRAL`, `DEFAULT_CUSTOMER`, `SUCURSALES` desde `TENANT`; define `PAGE_SIZE=20` y `TIPOS_ITEM` (filtro compartido por 6 pantallas). |
| `tenant.ts` | Única fuente de identidad del negocio, leída 100% de `import.meta.env` (`VITE_*`) con fallbacks a los valores reales de Panaderías Grace. Cambiar de cliente = cambiar `.env`, sin tocar código. |
| `roles.ts` | Config de niveles de app (Vendedor, Almacén, Operaciones, Repartidor, Gerente): qué módulos ve cada uno y qué rutas tiene permitidas (`rutasDe()` arma la lista). Debe coincidir con `permisos.NIVELES` del backend (gating de módulos es frontend; el backend da el permiso API grueso). Fail-closed: rol desconocido → Vendedor. |
| `clientesB2B.ts` | Wrappers síncronos sobre `sucursalesConfig` (`esSucursalInterna`, `getSucursalesInternas`, `getSucursalesDestino`) + lista hardcoded `CLIENTES_MP_POR_TRANSFERENCIA=['ALEJANDRO TORRES']` (antes "PUERTA REAL") para ocultar materia prima del buscador de Venta B2B — comentario explícito: es guía de UX, no barrera de seguridad real. |
| `impuestos.ts` | Catálogo único de impuestos: tasas planas y la cascada `iva16_ieps` (IEPS entra primero, IVA se calcula sobre base+IEPS → 25.28%, no 24%). `desglosarImpuesto()`, `grupoSubtotal()`, `claveImpuesto()`, `buildTaxes()` (resuelve Item Tax Template vía `appConfig`), `getTasa()`. Tiene test dedicado (`impuestos.test.js`). |
| `proveedorTaxonomy.ts` | Jerarquía de Supplier Group de ERPNext replicada en frontend (COSTO/GASTO y sus subtipos), `getTipoDeGrupo()`. |
| `modulos.jsx` | Datos de los tiles del Panel (MODULOS, MODULOS_CONSULTAS, MODULOS_REPORTES, MODULOS_CONFIG): key de módulo (debe existir en `roles.ts`), ruta, icono, color. Separado de `iconosModulos.jsx` a propósito (un archivo que exporta datos + componentes pierde fast refresh). |
| `iconosModulos.jsx` | Componentes SVG puros de los iconos usados en `modulos.jsx` (Catálogo, Inventario, Compras, Proveedores, POS, VentaB2B, EnvioSucursal, Egresos, Producción, Reporte, Cuentas, Auditoría). |

## Tests (`src/test/` y los `*.test.ts` sueltos)

- **`src/test/setup.js`** — setup global de Vitest: extiende `expect` con `@testing-library/jest-dom/vitest`.
- Todos los tests unitarios de `src/utils/`, `src/db/`, `src/hooks/`, `src/config/` y `src/services/` están listados en sus secciones respectivas de arriba, con lo que prueban resumido en el nombre del `describe`. Resumen de casos "con historia" (bugs reales que motivaron el test):
  - `costoAnomalo.test.ts` — caso real `$8,846.23` de fuga por UOM mal capturada.
  - `produccionCalc.test.ts` — caso real del −$1M por mal escalado de receta.
  - `nominaTotales.test.js` — cuadra contra `validate()` del backend Python.
  - `charolas.test.ts` — espejo exacto de `_charolas` en `pedido_api.py` (si una se mueve sin la otra, truena).
  - `frappeStock.envio.test.js` — valorización de envíos al costo, no al precio de venta (bug de dinero real corregido).
  - `frappeSales.totales.test.js` / `frappeSales.cxc.test.js` — ajuste SAT de redondeo y saldo cobrable.
  - `security.test.js` — rate limiter anti fuerza bruta, sanitización XSS, validadores.
  - `impuestos.test.js` (en `src/config/`) — cascada IEPS→IVA (25.28%, no 24%).

### Archivos de test sin renglón propio arriba

Viven junto al módulo que prueban, no en `src/test/`.

| Archivo | Prueba |
|---|---|
| `src/hooks/useAutoUppercase.test.jsx` | `useAutoUppercase` — que fuerce mayúsculas sin tocar contraseñas ni campos excluidos. |
| `src/hooks/useInsumoForm.codigo.test.js` | `resolverCodigoInterno` — la parte pura del hook de alta de Item. |
| `src/hooks/useConexion.test.jsx` | `useConexion` — transiciones `ok` / `sin-conexion` / `volvio`. |
| `src/utils/liquidacion.test.js` | `calcularLiquidacion` y `vendidoSinPrecio` — dinero del cierre de ruta. |
| `src/db/conteoBorrador.test.js` | `claveBorrador`, `guardarBorrador`, `cargarBorrador` — borrador del conteo físico. |
| `src/db/borradorLocal.test.js` | `guardarBorradorForm` / `cargarBorradorForm` / `borrarBorradorForm`. |
| `src/db/sync.test.js` | `seedCatalogo`, `seedStock`, `drainOutbox` — todo por inyección de dependencias, sin red ni IndexedDB real. |
| `src/utils/print/egresoDesglose.test.ts` | `agruparPorTasa` (subtotales del ticket) y `ajusteDerivado`, incluido el caso del **cero negativo** que imprimía `-0.00`. |

## `testsprite-plans/`

Planes de prueba de navegador (TestSprite), uno por flujo. Son **datos**, no código:
cada `.json` describe pasos y aserciones que un agente en la nube ejecuta contra la app
real por un túnel. Cubren el hueco que los `vitest` no ven — que la pantalla de verdad
se pinte y el clic de verdad haga algo (`Login.css` dejando la app en `position:fixed`,
React #31 tapando la pantalla, `/catalogo` tirado por un refactor).

🔴 **Solo contra dev (`localhost:5173`), NUNCA contra la torre.** El agente teclea de
verdad: apuntarlo a `192.168.2.221` crearía ventas, compras y traspasos reales. El
usuario que usa (`testsprite@grace.local`) vive solo en la base de DEV y su contraseña
está fuera del repo (`~/.testsprite_dev_pass`, 0600) — no se commitea.

🔴 **Ese usuario carga nivel Gerente MÁS el rol `Admin Sucursal`**, que es el que de
verdad traen `admin.piramides`/`admin.puertareal`/`admin.santuarios`. No se le da System
Manager a propósito: `require_roles` deja pasar SIEMPRE al admin, así que con System
Manager la suite dejaría de poder cazar un bug de permisos. Con Admin Sucursal, el verde
significa «le funciona a un admin real». 🔴 Los niveles que reparte la UI de Cuentas
(`ROLES_GESTIONADOS`) **no** incluyen `Admin Sucursal`, y sin él el alta de proveedor
truena con `PermissionError` — medido en dev el 18-sep, sin verificar contra la torre.

🔴 **Un rerun en el portal repite la corrida vieja, no el código nuevo** (lo advierte el
propio CLI). Para juzgar un cambio hay que lanzar corrida NUEVA:
`testsprite test run <testId> --local 5173 --local-host localhost`.

| Archivo | Flujo que prueba | ¿Escribe en dev? |
|---|---|---|
| `01-login-rechaza-malas.json` | Credenciales malas no entran y la URL sigue en `/login`. | No |
| `02-login-panel-gerente.json` | Panel de Gerente pinta sus tiles y el tile Catálogo no rebota. | No |
| `03-catalogo-insumos-y-pan.json` | Las dos vistas del catálogo (insumos/pan) pintan filas con precio. Entra por `/catalogo?modo=consulta`: el `/catalogo` pelón abre un MENÚ de acciones (Crear/Editar/Deshabilitar), no la lista. | No |
| `04-inventario-stock.json` | Existencias por almacén. Entra por `/inventario?modo=consulta`: el mosaico «Stock de Inventario» solo existe en `accionActiva === 'consulta_menu'`. | No |
| `05-b2b-abarrote-precio-tienda.json` | 🔴 **El del dinero.** VELAS PIROTECNICA en Venta B2B da Total \$35.00 (precio de tienda, impuesto adentro) y NO \$40.60. Es el fix del 17-sep vuelto test de navegador. | No (no confirma la venta) |
| `06-compra-captura.json` | Captura y confirma una compra de un renglón. | **Sí** (Purchase Receipt) |
| `07-egreso-simple.json` | Captura un gasto simple y lo encuentra en `?modo=consulta` con Categoría en «Todas». | **Sí** (Egreso) |
| `08-envio-sucursal.json` | Traspaso de pan a `TIENDA - PIRAMIDES - PG` desde `ALMACEN - PANQUELERIA - PG`, y el folio `MAT-STE-` de vuelta. 🔴 Tres trampas que costaron cuatro corridas: el origen arranca en Bodega Central y el pan vive en el almacén de su departamento; el destino es `TIENDA - PIRAMIDES - PG` porque `PIRAMIDES - PG` es el padre y no es destino válido; y **esta pantalla no muestra importes** (columnas: Producto · Stock disp. · Cantidad · Stock final), así que exigirle un \$ es pedirle lo que no tiene. El traspaso se valoriza al COSTO del lado del servidor (`basic_rate`) y ese número se ve en el Reporte de Valorización. | **Sí** (Stock Entry) |
| `09-pos-venta-efectivo.json` | 🔴 Venta en el POS que **llega al servidor**: se cobra y luego se busca en Consultas → POS. La primera versión asertaba «el ticket queda vacío» y pasó en VERDE sin que existiera ninguna Sales Invoice — el ticket también está vacío ANTES de vender. Aserción sobre la consecuencia, nunca sobre un estado que ya era cierto al empezar. | **Sí** (Sales Invoice) |
| `10-reporte-cxp-vistas.json` | Las vistas General/Compras/Egresos mueven tarjeta y tabla (fix del 15-sep). | No |
| `11-proveedor-alta.json` | Alta de proveedor con sus 5 campos obligatorios (razón social, teléfono, correo, contacto 1 nombre y teléfono) y sin modal de error. Llenar solo el nombre truena con `MandatoryError`. | **Sí** (Supplier) |
| `12-produccion-entrada-pan.json` | Entrada de pan sin receta **rechaza** costo vacío o cero (nunca pan gratis). | No (espera rechazo) |
| `13-presentacion-recalcula-precio.json` | 🔴 **La cadena del costo.** Cambia `Cantidad por Presentación` de DOMO PARA ROLLO DB09A a 25 y exige que la columna «Precio por Unidad» quede en \$24.54 = (\$528.87 / 25) × 1.16. Si sigue en \$12.27, el precio quedó derivado del factor viejo y las recetas se cuestan con un número muerto. El item lleva `iva16` A PROPÓSITO: con `tasa0` el precio final es idéntico al por-unidad y un mutante que borre el impuesto pasaría sin que nadie lo vea. | **Sí** (Item) |
| `14-dia-del-pan-entrada-y-envio.json` | 🔴 **La secuencia, no la pantalla.** Registra una entrada de 10 MANTECADA GDE en Producción y acto seguido manda ese mismo pan a `TIENDA - PIRAMIDES - PG`. Así ocurre el día de verdad: primero se hornea y se da entrada, después se envía. Además el test se vuelve **autosuficiente** — crea su propio stock en vez de comerse las 150 piezas que dejó ayer, que a 2 por corrida se acaban y el rojo parecería un bug cuando sería el test agotando el inventario. | **Sí** (Stock Entry ×2) |

Los 7 que escriben ensucian la base de DEV a propósito — decisión tomada el 18-sep para
cubrir el camino completo. Dev ya diverge de prod; el dinero se sigue midiendo contra la
torre, nunca contra esto.

## `print-server/`

Servicio Python/Flask **separado** de la app React (corre en la PC de la caja, no en el contenedor del frontend). Imprime en la térmica SICAR WL88S vía USB (`python-escpos`, `/dev/usb/lp0` en Linux o `Win32Raw` en Windows).

| Archivo | Qué es |
|---|---|
| `print_server.py` (876 líneas) | App Flask con 8 rutas POST (`/imprimir`, `/imprimir-corte`, `/imprimir-compra`, `/imprimir-egreso`, `/imprimir-ticket-consolidado`, `/imprimir-venta-b2b`, `/imprimir-traspaso`, `/imprimir-regalo`), todas con `OPTIONS` para CORS abierto (`ALLOWED_ORIGIN` configurable, default `*`). Usa `PIL` para renderizar cada ticket como imagen (`render_*_image`) antes de mandarla a la impresora — no texto plano. Redondeo de dinero con `Decimal` + `ROUND_HALF_UP` (`_round`, `fmt`, `fmt_unit`) — consistente con la regla del proyecto de nunca usar `round()` nativo (half-even) para dinero. `get_printer()` resuelve la ruta del dispositivo o cae a `Win32Raw` en Windows. |
| `test_fmt.py` | Runner manual (no pytest) que verifica `fmt`/`fmt_unit`/`_num` contra 8 casos de redondeo (incluye el caso real que destapó un bug: `329.25 × 22.50` daba `$7,408.12` en vez de `$7,408.13`) + 6 casos de `_num`. Stubea el módulo `escpos` para poder importar `print_server` sin impresora conectada. Se corre con `python3 test_fmt.py`. |
| `setup.sh` | Instala en una PC nueva: deshabilita CUPS (interfiere con la térmica), crea regla `udev` para permisos permanentes del USB, crea venv en `/opt/print-server-venv`, instala Flask/python-escpos/pyusb, registra y arranca un servicio `systemd` (`print-server.service`) corriendo como el usuario normal (no root). |
| `setup_windows.bat` | Equivalente Windows del setup (no leído línea a línea — mismo propósito). |
| `requirements.txt` | `Flask>=2.2.0`, `python-escpos>=3.0a9`, `pywin32` (solo Windows), `pyusb` (solo no-Windows). |
| `README.md` | Instrucciones de instalación/operación/troubleshooting; datos de la impresora (idVendor `0x20d1`, idProduct `0x7007`). |
| `DejaVuSansMono.ttf` | Fuente monoespaciada embebida para renderizar los tickets como imagen con PIL. |
| `__pycache__/` | Excluido del alcance (bytecode compilado, gitignored). |

## `.githooks/`

- **`pre-push`** — Hook de git que corre `preflight.sh` automáticamente, pero **solo** cuando el push apunta a la rama `main` (`RAMA_DEPLOY=main`); pushear una rama de trabajo no paga el costo. Se activa una vez por máquina con `git config core.hooksPath .githooks` (no viaja en el repo — es config local). Si `preflight.sh` falla, bloquea el push con mensaje explícito. 🔴 Comentario: existe porque `preflight.sh` como paso manual se saltaba — dos incidentes de prod documentados (27-ago: refactor tiró `/catalogo` porque nadie corría eslint; 02-sep: un patch llevaba un día sin commitear y se creía deployado) en los que la herramienta ya existía pero nadie la invocó. Se puede saltar con `git push --no-verify`, con advertencia en el propio comentario del script ("si lo estás escribiendo, pregúntate qué te está avisando").

## Scripts de pnpm

| Script | Qué corre | Cuándo se usa |
|---|---|---|
| `dev` | `vite` | Desarrollo local, con proxy a `bakedata.local:8080` y print-server local. |
| `build` | `vite build` | Genera `dist/` (usado dentro del Dockerfile, stage build). |
| `lint` | `eslint .` | Parte obligatoria de `preflight.sh` — cubre lo que `tsc` no ve en `.jsx` (`checkJs:false`). |
| `typecheck` | `tsc --noEmit` | Parte de `preflight.sh`; NO revisa archivos `.jsx`. |
| `preview` | `vite preview` | Servir el build localmente para probarlo antes de deploy. |
| `test` | `vitest run` | Corrida única de toda la suite (usada en `preflight.sh` y CI manual). |
| `test:watch` | `vitest` | Desarrollo con tests en watch mode. |
