# MAPA DEL FRONTEND — `bake-data-frontend`

> Qué es cada archivo y dónde vive lo delicado. Actualizado 2026-11-27.
> Se pone al día al CERRAR EL DÍA, antes de generar el `commit_*.sh` (va en el mismo commit que el código).
> La historia (fechas, mutantes, incidentes) vive en las bitácoras y en `git log`, no aquí.

| | |
|---|---|
| **Repo** | `~/bake-data-frontend` → `github.com/Diemar-sys/grace-core-frontend` |
| **Ramas** | `main` = prod · `develop` = trabajo · etiqueta `prod-AAAAMMDD` en cada deploy |
| **Qué es** | React 18 + Vite 5. **ES el producto**; ERPNext es el motor y el usuario nunca lo ve. |
| **Backend** | `~/gestion_panaderia` vía `/api/method/gestion_panaderia.api.<módulo>.<función>` |
| **Prod / dev** | Torre `192.168.2.221` (nginx en Docker) / `localhost:5173` |
| **Toolchain** | Node 22 + pnpm 11 (pineados). Nunca npm. |
| **Otros mapas** | `~/gestion_panaderia/MAPA_BACKEND.md` · `~/erp-grace-infra/MAPA_INFRA.md` |

🔴 **Reglas vivas:** archivo nuevo nace en TS · responsive por clase, nunca `nth-child` · lo derivado se calcula en render (`useMemo`), nunca en `useEffect` · diseño = skill `diseno_bento_grid` · dinero y precio SIEMPRE del servidor; el navegador solo manda cantidades.

---

## Raíz

| Archivo | Qué es |
|---|---|
| `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` | Deps y scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `preview`). El workspace fuerza versiones parchadas (axios, ws, socket.io-parser). |
| `vite.config.js` | Vite + Vitest. `TZ=America/Mexico_City` en tests. `manualChunks` en orden fijo (otro orden = chunk circular). Proxy dev `/api` → `bakedata.local:8080`, `/socket.io` (ws, realtime de Frappe) → `:8080`, `/print` → `:6789`. |
| `tsconfig.json` | `strict`, `allowJs`, 🔴 `checkJs:false`: tsc no revisa `.jsx` → `lint` es obligatorio. |
| `eslint.config.js` | ESLint 9 flat. |
| `preflight.sh` | Gate antes de push a `main`: HEAD limpio → install, typecheck, lint, test, build. 🔴 Nació de un archivo sin `git add` que rompió prod. |
| `verificar_css_global.sh` | Falla si el CSS de `dist/` trae `body`/`html`/`*` sin acotar (lo llama preflight). |
| `.githooks/pre-push` | Corre `preflight.sh` solo al empujar `main`. Activar: `git config core.hooksPath .githooks`. |
| `Dockerfile` | node 22 build → nginx 1.27 serve. `.env` se hornea en el bundle. |
| `nginx.conf` | Prod: SPA + proxy a ERPNext y print-server. 🔴 `index.html` con `no-cache` (sin eso el deploy es invisible). Interruptor de mantenimiento: con `/etc/nginx/mantenimiento/ON` todo da 503 (`public/mantenimiento.html`); `/mantenimiento/aviso` sirve el aviso previo. |
| `index.html` | Shell del SPA, entra por `src/main.jsx`. |
| `.env.example`, `.dockerignore`, `.gitignore` | Plantilla de variables `VITE_*`; exclusiones. |
| `README.md`, `INSTALL.md`, `AUDITORIA_2026-08-11.md`, `AUDITORIA_BUGS.md` | Documentación e históricos. |
| `MAPA_FRONTEND.md` | Este documento. |

## Estructura de `src/` (17-nov: por módulo del menú)

Cada pantalla vive en `src/modulos/<menú>/<pantalla>/` con TODO lo suyo (página, componentes, css, servicio, tests). Lo que usan dos o más pantallas va en `src/compartido/` (por tipo: `services/`, `utils/`, `hooks/`, `db/`, `components/`, `styles/`, `config/`). `src/app/` arma la aplicación (rutas, Layout, avisos, menú). Si un archivo de una pantalla empieza a usarlo otra, se muda a `compartido/`.

Raíz de `src/`: `main.jsx` (monta `<App/>` en `FrappeProvider`, `enableSocket=false`; 🔴 auth solo por cookie, nunca API key en `VITE_*`), `index.css` y `vite-env.d.ts` (reset base; tipos de Vite y `window.csrf_token`), `test/setup.js` (setup de Vitest, jest-dom).

## App (`src/app/`)



| Archivo | Qué es |
|---|---|
| `App.jsx` | Router. `/recuperar` y `/update-password` (el enlace del correo) son públicas. Rutas protegidas, lazy para reportes. Monta `BannerConexion`, `AvisoSesion`, `AvisoMantenimiento` (fuera del `ErrorBoundary`). `/liquidacion` = única ruta de Repartidor; `/mi-cuenta` = única de Cliente. |
| `AvisoMantenimiento.css` | Estilos de esta pantalla. |
| `AvisoMantenimiento.tsx` | Modal de aviso de mantenimiento (se puede cerrar); en mantenimiento (503) tapa la pantalla sin recargar. |
| `AvisoSesion.css` | Estilos de esta pantalla. |
| `AvisoSesion.tsx` | Bloquea la pantalla si otra pestaña cambió la sesión. |
| `BannerConexion.css` | Estilos de esta pantalla. |
| `BannerConexion.jsx` | Aviso de red caída, en cualquier pantalla. |
| `ErrorBoundary.jsx` | Boundary global: atrapa el error de render y ofrece recargar. |
| `iconosModulos.jsx` | SVG de los tiles del Panel. |
| `Layout.css` | Estilos de esta pantalla. |
| `Layout.jsx` | Shell: topbar con reloj, menú por rol (`getRoleConfig`), salir (siempre navega a `/login`) y aviso «hay versión nueva». |
| `modulos.jsx` | Tiles del Panel: módulo, ruta, icono (operación, consultas, reportes, config). |
| `PildoraMantenimiento.tsx` | Cuenta regresiva del aviso junto al reloj de la barra. |
| `ProtectedRoute.jsx` | Guard de rutas: sin sesión → `/login`, ruta fuera del rol → su inicio. Precarga `appConfig` y `sucursalesConfig` (dependencia = email, no el objeto `user`). |
| `Reloj.tsx` | Fecha/hora local de la barra, un tic por minuto. |
| `roles.ts` | Niveles (Vendedor, Almacén, Operaciones, Gerente, Repartidor, Cliente): módulos y rutas de cada uno. |

Tests: `AvisoMantenimiento.render.test.tsx`, `Reloj.render.test.tsx`.

## Módulos (`src/modulos/`)

Roles salen de `app/roles.ts`. Las Consultas que reusan la pantalla de Operaciones (`?modo=consulta`) viven con ella.

### `modulos/acceso/`

| Archivo | Qué es |
|---|---|
| `Login.css` | Estilos de esta pantalla. |
| `Login.jsx` | Login con bloqueo por intentos; «Recuperar acceso» → `/recuperar`. |
| `Panel.jsx` | Tablero post-login por nivel. |
| `Recuperar.tsx` | `/recuperar` (usuario o correo → enlace al correo real) y `/update-password?key=` (contraseña nueva, la llave la valida Frappe). 🔴 Sin sesión; reglas en `recuperar_api.py`. |

Tests: `Panel.rutas.test.js`, `Recuperar.render.test.tsx`.

### `modulos/cliente/mi-cuenta/`

| Archivo | Qué es |
|---|---|
| `frappeCliente.ts` | `cliente_api`: miCuenta, miPedido, miFactura, confirmarLlegada. |
| `MiCuenta.css` | Estilos de esta pantalla. |
| `MiCuenta.tsx` | `/mi-cuenta` — portal del cliente: Resumen (debes, facturado, pagado, surtido, antigüedad), Facturas con «Ver» detalle, Pedidos con «Ver pan» (abajo: por departamento y TOTAL del servidor), Envíos agrupados por folio con «Ver» (`enviosAgrupados`). Lo único que escribe: «Te llegó» mientras Luis no cierre el día; lo tecleado se respalda en IndexedDB (`useBorradorLocal`, por usuario y día) y se borra al guardar. |

Tests: `frappeCliente.miFactura.test.ts`, `MiCuenta.render.test.tsx`.

### `modulos/configuracion/auditoria/`

| Archivo | Qué es |
|---|---|
| `Auditoria.tsx` | Bitácora de acciones sensibles. |
| `frappeAuditoria.ts` | `auditoria_api`: `feed` (bitácora por usuario/rango) y `operadores`. |

### `modulos/configuracion/cuentas/`

| Archivo | Qué es |
|---|---|
| `Cuentas.css` | Estilos de esta pantalla. |
| `Cuentas.tsx` | Usuarios: crear, nivel, POS, habilitar, ficha, «Correo para recuperar contraseña» (no System Manager). Tocar un System Manager pide llave de Administrator. |
| `frappeCuentas.ts` | Cuentas de usuario: listar/crear/editar, habilitar, nivel, POS profile. |

Tests: `Cuentas.ficha.render.test.tsx`.

### `modulos/consultas/kardex/`

| Archivo | Qué es |
|---|---|
| `frappeKardex.ts` | Kardex de un item en un almacén por rango; items para el selector. |
| `Kardex.jsx` | Consumo entre los dos últimos conteos. |
| `kardex.ts` | `consumoEntreConteos`: materia prima gastada entre los dos últimos conteos físicos. |

Tests: `Kardex.test.js`.

### `modulos/consultas/pedido/`

| Archivo | Qué es |
|---|---|
| `ConsultaPedido.tsx` | Pedido guardado + PDF (solo lectura). |

Tests: `ConsultaPedido.totales.test.ts`.

### `modulos/consultas/punto-de-venta/`

| Archivo | Qué es |
|---|---|
| `ConsultasPOS.jsx` | Historial, cancelación (solo Gerente), corte. |
| `corteTemplate.ts` | Plantilla del ticket de corte de caja. |
| `POSHistorial.css` | Estilos de esta pantalla. |
| `POSHistorial.jsx` | Historial de ventas del POS. |
| `POSModalCorte.jsx` | Modal del corte de caja. |

### `modulos/consultas/tablero/`

| Archivo | Qué es |
|---|---|
| `ConsultaTablero.tsx` | Avance del día vs pedido (traspasos reales + lo facturado a clientes). |

Tests: `ConsultaTablero.avance.test.ts`.

### `modulos/operaciones/catalogo/`

| Archivo | Qué es |
|---|---|
| `Catalogo.jsx` | Alta/edición de insumos y pan, costeo. |
| `CatalogoPan.css` | Estilos de esta pantalla. |
| `catalogoTypes.ts` | Tipos del catálogo. |
| `catalogoUtils.ts` | Catálogo de pan: `calcularMargen`, categorías, `filtrarPanes`. |
| `FilaItem.tsx` | Renglón de un item en la lista del catálogo. |
| `NuevoPan.css` | Estilos de esta pantalla. |
| `NuevoPan.jsx` | Modal alta/edición de pan y sus precios. |
| `precioPan.ts` | Alta de pan: margen contra el costo estimado y comparación con el precio de sucursal. |
| `VistaPan.tsx` | Costeo/margen. |

Tests: `Catalogo.filtroPan.test.js`, `NuevoPan.margen.test.js`.

### `modulos/operaciones/compras/`

| Archivo | Qué es |
|---|---|
| `Compras.jsx` | Lista y captura de compras (vía `modulos/operaciones/compras/useCompras`). |
| `ComprasModales.jsx` | Modales de la pantalla de Compras. |
| `comprasPrint.ts` | Impresión de una compra (🔴 su fecha parte de medianoche UTC: única excepción a `hoyISO`). |
| `costoAnomalo.ts` | Costo de compra vs mediana histórica (ok/aviso/bloqueo). |
| `FilaProducto.jsx` | Renglón de producto de la compra; escáner (Enter con código busca exacto). |
| `LigarCodigo.tsx` | Código desconocido: ligar a existente o alta; `ElegirVariante` cuando un código tiene varios items. |
| `ModalPreciosActualizados.jsx` | Avisa los precios que cambió la compra. 🔴 Sin botón «Omitir» (dejaba el catálogo mintiendo). |
| `ModalReciboPDF.jsx` | Recibo PDF de la compra. |
| `NuevaCompra.jsx` | Formulario de compra con borrador; descuento como fila de impuesto «Total». |
| `useCompras.ts` | Hook de la lista de compras. |

Tests: `costoAnomalo.test.ts`, `FilaProducto.escaneo.render.test.tsx`, `NuevaCompra.escaner.render.test.tsx`.

### `modulos/operaciones/egresos/`

| Archivo | Qué es |
|---|---|
| `CampoAjustable.tsx` | Campo de monto con ajuste a mano. |
| `Egresos.css` | Estilos de esta pantalla. |
| `Egresos.jsx` | Gastos (CFE, gasolina, etc.); «Por pagar» abre `ModalPagarEgreso` (normal o con un cobro). `?modo=consulta`. |
| `egresosConstants.ts` | Categorías y subcategorías de egresos. |
| `egresosIcons.tsx` | Iconos por categoría. |
| `EgresosTabla.tsx` | Tabla de egresos. |
| `egresosTypes.ts` | Tipos de egresos. |
| `egresosUtils.ts` | Egresos: autocompleta Agua por proveedor; totales por partida con ajuste SAT (misma función que Compras). |
| `GasForm.tsx` | Formulario de gas. |
| `GasolinaForm.tsx` | Formulario de gasolina. |
| `luzCalc.ts` | CFE, total truncado. |
| `LuzForm.tsx` | Formulario de luz (CFE), usa `luzCalc.ts`. |
| `ModalPagarEgreso.tsx` | Pagar con un cobro. |
| `simpleCalc.ts` | Cálculo puro de los egresos simples. |
| `SubcatForm.tsx` | Formulario genérico por subcategoría. |

Tests: `Egresos.consulta.test.tsx`, `Egresos.partidas.test.js`, `luzCalc.test.ts`, `ModalPagarEgreso.render.test.tsx`, `simpleCalc.test.ts`.

### `modulos/operaciones/envio-sucursal/`

| Archivo | Qué es |
|---|---|
| `destinosEnvio.ts` | Dropdown Destino de Envío a Sucursal agrupado por TIPO de almacén (sucursales, camionetas, pueblos). |
| `EnvioSucursal.jsx` | Traspasos a sucursal, «+ Entrada de Pan», reposición de insumos. |
| `ModalHojaEntrega.jsx` | Hoja de entrega de un envío. |
| `NuevoEnvioSucursal.jsx` | Formulario de envío: origen Bodega Central (MP) o almacén de pan; un solo origen por envío. |
| `ReposicionInsumos.tsx` | Qué le falta a cada sucursal (por ritmo de consumo, no por saldo). |
| `useSucursales.ts` | Lista de sucursales/destinos. |

Tests: `destinosEnvio.test.ts`.

### `modulos/operaciones/hoja/`

| Archivo | Qué es |
|---|---|
| `AgregarPan.tsx` | «+ Agregar pan» de la Hoja: solo con `puede_agregar` (hoja corregida, Luis/Administrator). Manda solo la clave; el precio lo pone el servidor. |
| `bolilloDia.ts` | Vista Bolillo: totales por tanda/camioneta. |
| `DeshacerCobro.tsx` | Modal de «Deshacer cobro»: enseña TODAS las facturas del cobro, pide motivo, se bloquea si hay LIQUIDADO o egresos. |
| `EstadoCuentaHoja.tsx` | Pestaña «Estado de cuenta» de la Hoja: rango de fechas, tabla por día, LIQUIDADO (Eva→Luis, solo `puede_liquidar`), EGRESO, POR ENTREGAR, «Cobrar» (pan y abarrotes, el modal de CxC). Renglones ABARROTES (`tipo`): suman a Se debe; cobrados quedan PAGADOS sin LIQUIDADO/POR ENTREGAR (no entran a la caja de Eva). Días SIN COBRAR (pan enviado sin factura) con tarjeta propia, fuera de Se debe. «Deshacer cobro» solo con `puede_deshacer` (Administrator). Números del servidor. Pueblo (`pueblo`), UN paso: FECHA con día · PAN · EFECTIVO · DIFERENCIA · GASTOS (solo la razón, `razonesGasto`; los montos en Reportes) y sus botones; sin LIQUIDADO/POR ENTREGAR/ENTREGADO ni tarjetas de caja. «Cobrar» y «Registrar entrega» solo con `puede_cobrar` (cortesía; el hook del cobro decide); «Registrar entrega» solo en días SIN ENTREGAR (sin cobro ni gastos): una por día, se corrige con «Deshacer cobro». |
| `HojaDelDia.css` | Estilos de esta pantalla. |
| `HojaDelDia.tsx` | `/hoja` — **cobro sin inventario por destino/día.** Captura ENVIADO por pan (colores vs PEDIDO), «+ charolas», buscador, borrador en IndexedDB, «Guardar todo», camioneta en 3 pasos (capturando / en ruta / liquidado con MERMA y corrección de ENVIADO), cobrar (siempre guarda antes), «Corregir» (si el servidor manda `corregible`: solo Luis/Administrator; sin plazo), «Cerrar/Reabrir llegada» (LLEGÓ lo cierra Luis, `puede_cerrar_llegada`), «+ Agregar pan» en hoja corregida (`AgregarPan`), Ticket, descuento DELI/ZAKIA, columna LLEGÓ (solo lectura) + «Ajustar a lo que llegó» (copia LLEGÓ→ENVIADO al borrador, no guarda; ni supuesto ni bolillo; no en hoja cobrada), vista Bolillo, pestaña Estado de cuenta (`?vista=estado`). 🔴 Venta, comisión, Se debe y descuento vienen del servidor; aquí solo se pintan. `peticionRef` descarta respuestas viejas. |
| `ModalEntregaPueblo.tsx` | Entrega de un pueblo de UN día (botón por renglón en el Estado de cuenta): EFECTIVO que regresó + agua/luz/renta/sueldo/merma/otro (informe: pueden pasar del efectivo o ir sin efectivo); enseña DIFERENCIA (efectivo − pan) y ENTREGADO (efectivo − gastos) antes de guardar. La suma es cortesía (`compartido/utils/entregaPueblo.ts`); 🔴 decide el servidor. |
| `useAvisoSinGuardar.ts` | Confirmar al salir con algo sin guardar. |
| `VistaBolillo.tsx` | Vista Bolillo de la Hoja: PEDIDO vs SALIÓ por tanda; guarda solo lo cambiado. Camioneta: solo se congela en ruta (en el paso 3 se corrige). |

Tests: `bolilloDia.test.ts`, `EstadoCuentaHoja.render.test.tsx`, `HojaDelDia.render.test.tsx`, `useAvisoSinGuardar.test.tsx`, `VistaBolillo.render.test.tsx`.

### `modulos/operaciones/inventario/`

| Archivo | Qué es |
|---|---|
| `ConteoFisico.jsx` | Conteo físico; ajusta contra el stock de BODEGA_CENTRAL. Con borrador local. |
| `conteoFisico.ts` | PURO: conteo físico: factor presentación→base, filtro por tipo, pendientes, `lineasAjuste`. |
| `HistorialMovimientos.jsx` | Historial de Stock Entry por almacén. |
| `Inventario.jsx` | Stock, agotados, ajustes, conteo físico. |
| `RegistroMerma.jsx` | Modal de merma (Material Issue), con borrador local. |
| `RegistroMovimiento.css` | Estilos de esta pantalla. |
| `RegistroRegalo.jsx` | Modal de regalo de proveedor (Material Receipt). |
| `RegistroSalida.jsx` | Modal de salida/transferencia interna, con borrador local. |
| `stockMP.ts` | Mapa de stock por almacén en unidad base (Kg) con presentación (`fetchStockMapKg`). |

Tests: `ConteoFisico.test.js`, `Inventario.test.jsx`, `stockMP.test.js`.

### `modulos/operaciones/pedido-vivo/`

| Archivo | Qué es |
|---|---|
| `PedidoVivo.tsx` | `/pedido-vivo` — pedido en vivo (adiós Drive): la pestaña PRODUCCIÓN con una columna por destino (agrupados SUCURSALES/CLIENTES/PUEBLOS/CAMIONETAS), secciones, total $ por destino. Cada celda se guarda al salir (Enter baja). 🔴 Qué columna se edita, `$`, totales y cierre 6:45 vienen del servidor (`pedido_vivo.py`); Luis y Diemar todo, DELI y P.REAL la suya. |
| `PedidoVivo.css` | Estilos: tarjeta bento, encabezados y CLAVE/PRODUCTO fijos, columna propia resaltada. |
| `frappePedidoVivo.ts` | Servicio: `abrir(fecha)`, `guardarCelda`. |
| `rejilla.ts` | PURO: `agruparPorSeccion` (O(n)), `piezasDeTexto` (enteros 0–9999, igual que el servidor). |

Tests: `rejilla.test.ts`.

### `modulos/operaciones/pedido/`

| Archivo | Qué es |
|---|---|
| `CargaDrive.tsx` | Tarjeta «Carga automática» de Pedido: solo el switch (visible si `puede_cambiar`) y último cambio. Sin carpeta configurada no se pinta. Reglas en `pedido_drive.py`. |
| `charolas.ts` | Piezas → «N char + M pz», espejo de `_charolas` del backend. |
| `gruposDestino.ts` | Ordena destinos por grupo y arma los tramos del encabezado del pedido. |
| `Pedido.jsx` | La hoja del día: «Traer de Drive» (o, si Drive no responde, subir .xlsx a mano) → previsualiza → «Importar y mandar» (Telegram); limpio y enviado → regresa a Operaciones. Fecha la dice el Excel. Un Excel por día; «Quitar» borra el guardado. Abajo, tarjeta `CargaDrive`. |
| `pedidoDia.ts` | `hojaDelDia`: junta las pestañas marcadas del Excel en el pedido del día. |

Tests: `CargaDrive.render.test.tsx`, `charolas.test.ts`, `gruposDestino.test.ts`, `Pedido.fecha.test.tsx`, `pedidoDia.test.ts`.

### `modulos/operaciones/produccion/`

| Archivo | Qué es |
|---|---|
| `NuevaReceta.jsx` | Alta/edición de receta (BOM). |
| `Produccion.jsx` | Recetas (BOM) y entrada de pan. |

### `modulos/operaciones/proveedores/`

| Archivo | Qué es |
|---|---|
| `frappeSupplier.ts` | Proveedores: CRUD, grupos, deshabilitados (datos en campos custom de Supplier). |
| `NuevoProveedor.css` | Estilos de esta pantalla. |
| `NuevoProveedor.jsx` | Alta/edición de proveedor con contactos principal y secundario. |
| `Proveedores.jsx` | Alta/edición de proveedores. |
| `proveedorTaxonomy.ts` | Jerarquía de Supplier Groups (nombres EXACTOS de ERPNext): `TAXONOMY`, `getTipoDeGrupo`, `GRUPOS_RAIZ`. |
| `useDebounce.ts` | Debounce del buscador. |

### `modulos/operaciones/punto-de-venta/`

| Archivo | Qué es |
|---|---|
| `POS.css` | Estilos de esta pantalla. |
| `POS.jsx` | Punto de venta offline-first; todo por Dexie/`compartido/db/sync`. |
| `POSCatalogo.css` | Estilos de esta pantalla. |
| `POSCatalogo.jsx` | Catálogo del POS (lee Dexie). |
| `POSModalCantidad.jsx` | Modal de cantidad. |
| `POSModalCobro.jsx` | Modal de cobro (la venta va al outbox). |
| `POSModalEspera.jsx` | Ventas en espera. |
| `POSTicket.css` | Estilos de esta pantalla. |
| `POSTicket.jsx` | Ticket de la venta. |

### `modulos/operaciones/venta-b2b/`

| Archivo | Qué es |
|---|---|
| `BuscadorCliente.jsx` | Buscador de clientes B2B (precarga todos: son pocos). |
| `ModalReciboPDF.jsx` | Recibo PDF de la venta B2B. |
| `NuevaVentaB2B.jsx` | Alta de venta B2B; precio en `modulos/operaciones/venta-b2b/ventaB2B.ts` (excepción DELI nata a precio de compra). Escáner: Enter con código de barras busca exacto; pan no entra a B2B. |
| `VentaB2B.jsx` | Venta mayoreo de abarrote/MP + CxC con «Cobrar». 🔴 El pan ya no se vende aquí (va por la Hoja). |
| `ventaB2B.ts` | Venta B2B: precio por tipo (materia prima al costo sin impuesto), qué items se ven (el pan ya no: va por la Hoja), precio con impuesto. `descuentoCliente`: P.REAL 20% del total con impuesto desde el 01-nov, solo se ENSEÑA (lo aplica `sales_invoice.py`; misma tabla en los dos). |

Tests: `NuevaVentaB2B.escaner.render.test.tsx`, `NuevaVentaB2B.precio.test.ts`.

### `modulos/procesos/nomina/`

| Archivo | Qué es |
|---|---|
| `frappeNomina.ts` | Nómina: empleados, sucursales, corridas (crear/cancelar), último renglón, costo real, `darDeBaja`. Datos personales y baja con `admin_password`. |
| `Nomina.css` | Estilos de esta pantalla. |
| `Nomina.tsx` | Corrida, empleados (Editar → «Dar de baja» con fecha de salida y clave de Administrator), reporte. |
| `nominaTotales.ts` | Totales de la corrida de nómina (espejo del backend) y payload del ticket. |

Tests: `nominaTotales.test.js`, `Nomina.confirmar.render.test.tsx`.

### `modulos/repartidor/liquidacion/`

| Archivo | Qué es |
|---|---|
| `Liquidacion.css` | Estilos de esta pantalla. |
| `Liquidacion.tsx` | `/liquidacion` — el repartidor elige día y teclea MERMA (polvorón/muerto agrupados, `repartirMerma`). Manda todos los renglones. Borrador por día en IndexedDB (se ignora si ya se envió o cobró). 🔴 Ya «liquidado» = solo lectura (la merma se manda una vez). |
| `mermaAgrupada.ts` | Liquidación: polvorón/muerto (mismo costo) se capturan en UN renglón y la merma se reparte entre sabores (`agruparRenglones`, `repartirMerma`). |

Tests: `Liquidacion.render.test.tsx`, `mermaAgrupada.test.ts`.

### `modulos/reportes/por-grupo/`

| Archivo | Qué es |
|---|---|
| `cuentaPuertaReal.ts` | P.REAL: lo tecleado → `capturasPorGuardar` (solo lo que cambió, por día) y `previsualizar`/`cuentaDia` (🔴 espejo de `hoja_calculo.cuenta_preal` en centavos, para ver las diferencias al teclear; manda el servidor al guardar). |
| `ReportePorGrupo.tsx` | `/reportes/por-grupo` (solo Gerente; `/reportes/camionetas` redirige). Filtros en el renglón del título. Primero GRUPO (Camionetas, Pueblos, Clientes, Sucursales) y luego quién; los grupos que no son camioneta los pinta `ReporteGrupo.tsx`. Camionetas: Venta, gastos y vendido por categoría de cada camioneta por día. La merma se teclea en $: borrador local → Guardar → Cerrar por día (cerrada: «Reabrir» solo Luis/Administrator). Cuentas en `compartido/utils/reporteCamionetas.ts`; 🔴 el dinero viene sumado del servidor. |
| `ReporteGrupo.tsx` | Tablas de Reportes → Pueblos / Clientes / Sucursales (un bloque por destino, un renglón por día). 🔴 Columnas y sumas vienen del servidor (`reporte_grupo`); solo pinta. Cada destino puede traer SUS columnas (pueblos: tabla del jefe, VEGIL con su 10%); las del grupo son las del total de abajo. GANANCIA con signo y color de texto. Tabla `cam-tabla--grupo` (encabezado en dos renglones, centrado). P.REAL (Sucursales): la tabla del jefe; con `puede_capturar` (Luis/Administrator) las columnas `mano` son casillas, borrador local → «Guardar» (`guardarCuentaPuertaReal`). Vive dentro de `ReportePorGrupo.tsx`. |

Tests: `ReporteGrupo.render.test.tsx`, `cuentaPuertaReal.test.ts`.

### `modulos/reportes/compras/`

| Archivo | Qué es |
|---|---|
| `ReporteCompras.jsx` | Reportes → Compras: reporte fiscal mensual (lo suma la base). |

### `modulos/reportes/cuentas-por-cobrar/`

| Archivo | Qué es |
|---|---|
| `ReporteCuentasPorCobrar.jsx` | Reportes → CxC: envoltura de `TablaCuentasPorCobrar`. |

### `modulos/reportes/cuentas-por-pagar/`

| Archivo | Qué es |
|---|---|
| `cuentasPorPagar.ts` | Agrupaciones de CxP: saldo por `facturado_a` (siempre los 3), vistas, filas, deuda total. |
| `ReporteCuentasPorPagar.jsx` | Reportes → CxP: compras + egresos por `facturado_a`, vistas General/Compras/Egresos, docs pendientes por proveedor (lógica en `cuentasPorPagar.ts`). |

Tests: `ReporteCuentasPorPagar.render.test.tsx`, `ReporteCuentasPorPagar.test.js`.

### `modulos/reportes/gastos/`

| Archivo | Qué es |
|---|---|
| `frappeReportes.ts` | `reportes_api`: gasto unificado (compras + egresos) por `facturado_a` y rango. |
| `ReporteGastos.jsx` | Reportes → Gasto por cuenta en un rango. |

### `modulos/reportes/gastos-anual/`

| Archivo | Qué es |
|---|---|
| `gastosAnuales.ts` | Consolidado anual de todo lo que sale de caja: compras + egresos por mes/categoría; la nómina cae en la fecha de pago de su corrida; colores fijos por categoría. |
| `kilosComprados.ts` | Kilos comprados: agrupa categoría→insumo→mes por cuenta (Maps, O(n)), totales por unidad sin mezclar Kg/L/PZA, `csvKilos` (BOM + CRLF). Test `kilosComprados.test.ts`. |
| `KilosComprados.tsx` | Kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`. |
| `ReporteGastosAnual.css` | Estilos de esta pantalla. |
| `ReporteGastosAnual.jsx` | Reportes → Gasto anual mes × categoría, detalle al clic, PDF; incluye `KilosComprados.tsx` (lógica en `gastosAnuales.ts`, tope ~2000 compras). |

Tests: `gastosAnuales.test.js`, `KilosComprados.render.test.tsx`, `kilosComprados.test.ts`.

### `modulos/reportes/valorizacion/`

| Archivo | Qué es |
|---|---|
| `ReporteValorizacion.tsx` | Reportes → Valorización de envíos: lo mandado a sucursales al costo y a precio de venta. MP con margen `null`, nunca $0. |

Tests: `ReporteValorizacion.test.ts`.

### `modulos/reportes/ventas-categoria/`

| Archivo | Qué es |
|---|---|
| `ReportesVentasCategoria.jsx` | Reportes → Ventas B2B por categoría por mes. |

## Compartido (`src/compartido/`)

`services/`: cada uno extiende `FrappeBase.ts` (fetch, CSRF si existe, parseo de error) y exporta un singleton; frontera con el backend. `compartido/styles/global.css` = tokens del diseño Bento + clases compartidas. `db/` = Dexie / offline (`grace_pos`).

### `compartido/components/`

| Archivo | Qué es |
|---|---|
| `CantidadDual.tsx` | Cantidad en base o presentación con conversión visible. 🔴 Existe por el bug de UOM de $8,846. |
| `NuevoInsumo.jsx` | Modal alta/edición de insumo (materia prima). |
| `SelectorTipoItem.tsx` | Select de tipo de item (MP, pan…) con namespace CSS por pantalla. |
| `TablaCuentasPorCobrar.jsx` | CxC (reporte y venta), filtro TODO/PAN/MATERIA PRIMA. |

Tests: `CantidadDual.render.test.jsx`, `CantidadDual.test.ts`, `RegistroMovimiento.borrador.test.jsx`, `TablaCuentasPorCobrar.tipo.test.tsx`.

### `compartido/components/compras/`

| Archivo | Qué es |
|---|---|
| `BuscadorProveedor.jsx` | Buscador de proveedores (Compras y Egresos). |
| `compraUtils.ts` | Impuesto, bulto↔kg. |

Tests: `compraUtils.impuesto.test.ts`, `compraUtils.test.js`.

### `compartido/components/modals/`

| Archivo | Qué es |
|---|---|
| `ConfirmModal.jsx` | Modal de confirmar (con `useConfirmModal`). Se monta en `document.body` (portal): dentro de una tarjeta animada el velo no cubría la pantalla. |
| `ModalEntradaPan.jsx` | Precarga lo que FALTA del pedido; costo editable solo Gerente sin receta. |
| `ModalError.jsx` | 🔴 recibe string, nunca objeto: React #31. |
| `ModalRegistrarPago.jsx` | Cobra el SALDO; despliega productos. |

Tests: `ConfirmModal.test.jsx`, `ModalEntradaPan.candado.test.tsx`, `ModalEntradaPan.segunda.test.tsx`, `ModalEntradaPan.test.js`, `ModalError.objeto.test.jsx`, `ModalRegistrarPago.test.tsx`.

### `compartido/components/pos/`

| Archivo | Qué es |
|---|---|
| `posUtils.ts` | Cuentas puras del POS (totales, cambio). |

Tests: `posUtils.test.js`.

### `compartido/config/`

| Archivo | Qué es |
|---|---|
| `clientesB2B.ts` | Sucursales internas/extendidas: `esSucursalInterna`, destinos, `ocultaMateriaPrima`. Lee de `sucursalesConfig`. |
| `constants.ts` | `COMPANY`, `BODEGA_CENTRAL`, `DEFAULT_CUSTOMER`, `SUCURSALES`, `PAGE_SIZE`, `TIPOS_ITEM` (de `tenant.ts`). |
| `impuestos.ts` | Tasas y cascada IEPS→IVA (25.28%, no 24%). Test: `impuestos.test.js`. |
| `tenant.ts` | Identidad del negocio desde `VITE_*` (`TENANT`); se hornea público en el bundle. |

Tests: `impuestos.test.js`.

### `compartido/db/`

| Archivo | Qué es |
|---|---|
| `borradorLocal.ts` | Borrador local de formularios largos (envío, compra, venta B2B). |
| `conteoBorrador.ts` | Borrador local del conteo físico (no se pierde al cerrar el modal). |
| `db.ts` | Base `grace_pos`: `catalogo`, `stock`, `outbox` (ventas pendientes), `conteo`, `borradores`. |
| `sync.ts` | Outbox: `drainOutbox` en orden, single-flight. Sin red → para; 4xx → esa fila `error` y sigue; 5xx → para sin condenar (🔴 si no, una venta durante un deploy se perdía). Push antes de pull. |
| `uuid.ts` | UUID v4 con `getRandomValues` (la LAN es HTTP, `randomUUID` no existe ahí). |

Tests: `borradorLocal.test.js`, `conteoBorrador.test.js`, `sync.test.js`.

### `compartido/hooks/`

| Archivo | Qué es |
|---|---|
| `useAutoUppercase.ts` | Inputs en mayúsculas. |
| `useAvisoMantenimiento.ts` | Lee el aviso de mantenimiento del servidor. |
| `useBorradorLocal.js` | Autosave por usuario; al cambiar de clave lee antes de guardar. |
| `useConexion.ts` | En línea / sin red. |
| `useConfirmModal.ts` | Estado del `ConfirmModal`. |
| `useInsumoForm.ts` | 🔴 `formularioDeEdicion` debe traer TODO campo que manda `updateItem`, si no borra el costo; al elegir categoría sugiere la clave N+1. |
| `useSesionCompartida.ts` | Aviso cuando otra pestaña cambia de sesión. |
| `useVersionNueva.ts` | Detecta un deploy nuevo y pide recargar. |

Tests: `useAutoUppercase.test.jsx`, `useConexion.test.jsx`, `useInsumoForm.codigo.test.js`, `useInsumoForm.edicion.test.ts`, `useInsumoForm.interno.test.js`, `useSesionCompartida.test.tsx`.

### `compartido/services/`

| Archivo | Qué es |
|---|---|
| `appConfig.ts` | Config global ERPNext (cuentas, Item Tax Templates); caché por sesión con fallback. |
| `frappeAuth.ts` | Login/logout, rol, POS profile. `getUser()` valida localStorage (no escalar rol por DevTools). `pedirRecuperacion`/`cambiarConLlave` (sin sesión; tras cambiar cierra la sesión que abre Frappe). |
| `FrappeBase.ts` | Fetch, CSRF si existe, parseo de error. |
| `frappeEgresos.ts` | Egresos, CxP, `marcarPagado(…, cobro?)`, `cobrosParaEgreso`. |
| `frappeHoja.ts` | `hoja_api` (mismo nombre en camelCase): hoja, guardar, guardarTodo, confirmarEnvio, reabrirEnvio, guardarMerma, confirmar, corregir, cerrarLlegada, reabrirLlegada, cobrosDeFactura, deshacerCobro, panesParaAgregar, agregarPan, miHoja, guardarRegreso, vistaBolillo, guardarBolillo, destinos, deudores, estadoCuenta, liquidar, rentabilidadCamionetas, guardarMermasCamioneta, cerrarMermaCamioneta, reabrirMermaCamioneta, registrarEntrega, reporteGrupo, guardarCuentaPuertaReal. |
| `frappeInventory.ts` | Catálogo: almacenes, grupos, UOM, CRUD de Item, stock, `siguienteCodigoInterno`. |
| `frappePedido.ts` | Importar Excel, fechas, tablero, valorización, sugerencia de envío; `estadoDrive`/`cambiarDrive`/`buscarEnDrive` (`pedido_drive`). |
| `frappePOS.ts` | Perfil POS, productos, `crearVentaOffline` (lo llama el outbox), corte, historial, cancelar. |
| `frappeProduccion.ts` | BOM, costeo, entrada de pan, `entradoHoy`. |
| `frappePurchase.ts` | Compras: confirmar/cancelar, consolidar, revertir pagado (con contraseña), reporte fiscal (`reportes_api.reporte_compras_mensual`, lo suma la base), `getKilosComprados`, escáner (`esCodigoDeBarras`, `buscarPorCodigo`, `ligarCodigo`). |
| `frappeSales.ts` | Venta B2B, CxC, cobros. 🔴 Factura de la Hoja: el factor de impuesto sale de `custom_impuesto` del Item (`renglonDeFactura`), no de la plantilla. |
| `frappeStock.ts` | Movimientos: entradas, salidas, mermas, ajustes, regalos, traspasos, conteo. |
| `printService.ts` | Cliente del print-server (`/print/...`): tickets de venta, corte, traspaso, B2B, Hoja, nómina, egreso. |
| `sucursalesConfig.ts` | Sucursales internas/extendidas del servidor, caché + pub/sub. 🔴 Sin destinos hardcodeados (fallback vacío). |

Tests: `frappeAuth.recuperar.test.ts`, `frappePedido.test.ts`, `frappePurchase.buscar.test.js`, `frappeSales.buscar.test.js`, `frappeSales.cxc.test.js`, `frappeSales.facturaItems.test.ts`, `frappeSales.totales.test.js`, `frappeStock.envio.test.js`.

### `compartido/styles/`

| Archivo | Qué es |
|---|---|
| `Compras.css` | También Egresos. |
| `global.css` | Estilos de esta pantalla. |
| `NuevaCompra.css` | Shell de varios modales. |
| `NuevoInsumo.css` | Estilos de esta pantalla. |
| `Panel.css` | También Consultas/Egresos/Producción/Catálogo. |
| `Pedido.css` | También ConsultaPedido/Tablero/Valorización. |
| `Produccion.css` | Estilos de esta pantalla. |
| `RegistrarPago.css` | Estilos de esta pantalla. |

### `compartido/styles/pos/`

| Archivo | Qué es |
|---|---|
| `POSModals.css` | Estilos de esta pantalla. |

### `compartido/utils/`

| Archivo | Qué es |
|---|---|
| `buscarPan.ts` | Buscador (sin acentos). 🔴 Solo filtra lo que se pinta; guardar manda todo. |
| `cierreRuta.ts` | PURO: cierre de ruta de camioneta: renglones de captura, excesos y `previsualizar` la liquidación. |
| `entradaPan.ts` | PURO: Entrada de Pan: filas desde el pedido, item_code, payload, valor y costo editable. |
| `entregaPueblo.ts` | Entrega de pueblo: conceptos (PÉRDIDA → MERMA), `resumenEntrega` (centavos enteros: diferencia, entregado; sin tope: los gastos son informe), `razonesGasto` (la razón de cada gasto para el Estado de cuenta), `conSigno` y `claseDiferencia` (color de texto `.dif` de `global.css`). Espejo de `caja_cobro.armar_entrega`. |
| `errorFrappe.ts` | Traduce errores crudos de Frappe (HTML, stack) a mensajes para el usuario; `logError`. |
| `formato.ts` | `numero`/`pesos`/`cantidad` para México (coma de miles), sin `Intl` currency. |
| `hojaDia.ts` | Hoja del día: bloques por categoría, `totalCapturado`, `estadoEnviado`, `ticketDeHoja`, `conDescuento`, borrador por fecha/destino, `conLlegadas`, `ajustesALoQueLlego`. |
| `hora.ts` | Fechas y horas: `hoyISO` LOCAL (🔴 nunca `toISOString`), `horaFrappe` (TIME sin cero a la izquierda), `haceCuanto`, fechas corta/larga, rangos. |
| `itemGroups.ts` | Árbol de Item Group por nested set: `hojasDe`, `bucketsCategorias`. |
| `liquidacion.ts` | Vendido, comisión 10% + `COMISION_FIJA` (espejo de `hoja_calculo.COMISION_FIJA`). |
| `mantenimiento.ts` | Lee `/mantenimiento/aviso` (nginx del SPA) y saca la cuenta regresiva. |
| `precioCanal.ts` | PURO: precio de venta por canal según el almacén (`tipoPrecioPorAlmacen`, `resolverPrecioVenta`). 🔴 `custom_precio_por_kg` es de COMPRA, no entra a la cadena. |
| `produccionCalc.ts` | PURO: recetas: factor de producción, escalar ingredientes, costeo. 🔴 Aquí vivió el −$1M (escala mal del consumo). |
| `reloj.ts` | Texto del reloj de la barra, hora local, listas fijas en vez de `Intl`. |
| `reporteCamionetas.ts` | Reporte de camionetas: totales por camioneta y `conMerma` (sobrepone la merma tecleada por DIFERENCIA contra la guardada). |
| `security.ts` | `rateLimiter` del login, `sanitizar`/`sanitizarObjeto` anti-XSS, `validar`. |
| `uom.ts` | `fmtUom`: alias de UOM solo para mostrar; no cambia lo que va a la API. |
| `version.ts` | Detecta deploy nuevo comparando el bundle del `index.html` con el cargado. |

Tests: `buscarPan.test.ts`, `cierreRuta.test.ts`, `entregaPueblo.test.ts`, `errorFrappe.test.js`, `formato.test.ts`, `hojaDia.test.ts`, `hora.test.js`, `itemGroups.test.js`, `liquidacion.test.js`, `precioCanal.test.ts`, `produccionCalc.test.ts`, `reloj.test.ts`, `reporteCamionetas.test.ts`, `security.test.js`, `uom.test.js`, `version.test.js`.

### `compartido/utils/print/`

| Archivo | Qué es |
|---|---|
| `egresoDesglose.ts` | Desglose de un egreso para imprimir. |
| `escHTML.ts` | Escapa HTML de las plantillas. |
| `printUtils.ts` | Envío al print-server (`/print`). |
| `ticketTemplate.ts` | Plantilla del ticket de venta. |

Tests: `egresoDesglose.test.ts`.

## `public/` y `docs/`

`public/logo_GRACE.png`, `public/nuevologobkd.png` (favicon), `public/mantenimiento.html` (página del 503), `public/ticket_preview.html` (maqueta). `docs/auditoria-frontend.md` (auditoría del 11-nov, hallazgos FE-*; el plan vive en `gestion_panaderia/docs/plan-de-accion.md`). `docs/screenshots/`: `panel.png`, `catalogo.png`, `compras.png`, `pos.png`, `proveedores.png` (capturas del README).

## `print-server/`

Flask aparte, corre en la TORRE (servicio de systemd) e imprime en la térmica por USB. `print_server.py` (servidor; 🔴 la versión del repo es la que corre), `test_fmt.py` (redondeo de montos), `setup.sh` / `setup_windows.bat` (instalación), `requirements.txt`, `README.md`, `DejaVuSansMono.ttf`.

## `testsprite-plans/`

Pruebas de navegador. 🔴 **Solo contra dev, nunca la torre** (teclea de verdad). Usuario `testsprite@grace.local` = Gerente + Admin Sucursal, sin System Manager a propósito. Rerun del portal repite lo viejo: lanzar corrida nueva.
`01-login-rechaza-malas.json`, `02-login-panel-gerente.json`, `03-catalogo-insumos-y-pan.json`, `04-inventario-stock.json`, `05-b2b-abarrote-precio-tienda.json` (🔴 el del dinero), `06-compra-captura.json`, `07-egreso-simple.json`, `08-envio-sucursal.json`, `09-pos-venta-efectivo.json`, `10-reporte-cxp-vistas.json`, `11-proveedor-alta.json`, `12-produccion-entrada-pan.json`, `13-presentacion-recalcula-precio.json`, `14-dia-del-pan-entrada-y-envio.json`.
