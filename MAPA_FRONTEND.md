# MAPA DEL FRONTEND — `bake-data-frontend`

> Qué es cada archivo y dónde vive lo delicado. Actualizado 2026-11-19 (reportes/por-grupo).
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
| `vite.config.js` | Vite + Vitest. `TZ=America/Mexico_City` en tests. `manualChunks` en orden fijo (otro orden = chunk circular). Proxy dev `/api` → `bakedata.local:8080`, `/print` → `:6789`. |
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
| `AvisoMantenimiento.tsx` | Aviso de 5 min + píldora junto al reloj; en mantenimiento (503) tapa la pantalla sin recargar. Lógica en `compartido/utils/mantenimiento.ts`. |
| `AvisoSesion.css` | Estilos de esta pantalla. |
| `AvisoSesion.tsx` | Bloquea la pantalla si otra pestaña cambió la sesión. |
| `BannerConexion.css` | Estilos de esta pantalla. |
| `BannerConexion.jsx` | Red caída · boundary global · shell/topbar + «hay versión nueva» · guard de rutas + precarga de config. |
| `ErrorBoundary.jsx` | Red caída · boundary global · shell/topbar + «hay versión nueva» · guard de rutas + precarga de config. |
| `iconosModulos.jsx` | Tiles del Panel y sus iconos. |
| `Layout.css` | Estilos de esta pantalla. |
| `Layout.jsx` | Red caída · boundary global · shell/topbar + «hay versión nueva» · guard de rutas + precarga de config. |
| `modulos.jsx` | Tiles del Panel y sus iconos. |
| `PildoraMantenimiento.tsx` | Aviso de 5 min + píldora junto al reloj; en mantenimiento (503) tapa la pantalla sin recargar. Lógica en `compartido/utils/mantenimiento.ts`. |
| `ProtectedRoute.jsx` | Red caída · boundary global · shell/topbar + «hay versión nueva» · guard de rutas + precarga de config. |
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
| `frappeAuditoria.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |

### `modulos/configuracion/cuentas/`

| Archivo | Qué es |
|---|---|
| `Cuentas.css` | Estilos de esta pantalla. |
| `Cuentas.tsx` | Usuarios: crear, nivel, POS, habilitar, ficha, «Correo para recuperar contraseña» (no System Manager). Tocar un System Manager pide llave de Administrator. |
| `frappeCuentas.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |

Tests: `Cuentas.ficha.render.test.tsx`.

### `modulos/consultas/kardex/`

| Archivo | Qué es |
|---|---|
| `frappeKardex.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |
| `Kardex.jsx` | Consumo entre los dos últimos conteos. |
| `kardex.ts` | Recetas (🔴 aquí vivió el −$1M); entrada de pan; conteo; consumo; mapa de stock. |

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
| `catalogoUtils.ts` | Margen/filtro de pan; árbol de grupos por nested set. |
| `FilaItem.tsx` | Renglón de un item en la lista del catálogo. |
| `NuevoPan.css` | Estilos de esta pantalla. |
| `NuevoPan.jsx` | Modales/formularios de alta. |
| `precioPan.ts` | Precio B2B; precio por canal (🔴 `custom_precio_por_kg` es de COMPRA); margen del pan. |
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
| `NuevaCompra.jsx` | Modales/formularios de alta. |
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
| `egresosUtils.ts` | CxP; gasto anual sin doble nómina; totales de nómina (espejo del backend); egresos. |
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
| `destinosEnvio.ts` | Juntar pestañas del pedido; ordenar destinos; destinos de envío (sin duplicar camionetas). |
| `EnvioSucursal.jsx` | Traspasos a sucursal, «+ Entrada de Pan», reposición de insumos. |
| `ModalHojaEntrega.jsx` | Hoja de entrega de un envío. |
| `NuevoEnvioSucursal.jsx` | Modales/formularios de alta. |
| `ReposicionInsumos.tsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `useSucursales.ts` | Lista de sucursales/destinos. |

Tests: `destinosEnvio.test.ts`.

### `modulos/operaciones/hoja/`

| Archivo | Qué es |
|---|---|
| `AgregarPan.tsx` | «+ Agregar pan» de la Hoja: solo con `puede_agregar` (hoja corregida, Luis/Administrator). Manda solo la clave; el precio lo pone el servidor. |
| `bolilloDia.ts` | Vista Bolillo: totales por tanda/camioneta. |
| `DeshacerCobro.tsx` | Modal de «Deshacer cobro»: enseña TODAS las facturas del cobro, pide motivo, se bloquea si hay LIQUIDADO o egresos. |
| `EstadoCuentaHoja.tsx` | Pestaña «Estado de cuenta» de la Hoja: rango de fechas, tabla por día, LIQUIDADO (Eva→Luis, solo `puede_liquidar`), EGRESO, POR ENTREGAR, «Cobrar» (pan y abarrotes, el modal de CxC). Renglones ABARROTES (`tipo`): suman a Se debe; cobrados quedan PAGADOS sin LIQUIDADO/POR ENTREGAR (no entran a la caja de Eva). Días SIN COBRAR (pan enviado sin factura) con tarjeta propia, fuera de Se debe. «Deshacer cobro» solo con `puede_deshacer` (Administrator). Números del servidor. Pueblo (`pueblo`), UN paso: FECHA con día · PAN · EFECTIVO · DIFERENCIA · GASTOS (solo la razón, `razonesGasto`; los montos en Reportes) y sus botones; sin LIQUIDADO/POR ENTREGAR/ENTREGADO ni tarjetas de caja. «Cobrar» y «Registrar entrega» solo con `puede_cobrar` (cortesía; el hook del cobro decide). |
| `HojaDelDia.css` | Estilos de esta pantalla. |
| `HojaDelDia.tsx` | `/hoja` — **cobro sin inventario por destino/día.** Captura ENVIADO por pan (colores vs PEDIDO), «+ charolas», buscador, borrador en IndexedDB, «Guardar todo», camioneta en 3 pasos (capturando / en ruta / liquidado con MERMA y corrección de ENVIADO), cobrar (siempre guarda antes), «Corregir» (si el servidor manda `corregible`: solo Luis/Administrator; sin plazo), «Cerrar/Reabrir llegada» (LLEGÓ lo cierra Luis, `puede_cerrar_llegada`), «+ Agregar pan» en hoja corregida (`AgregarPan`), Ticket, descuento DELI/ZAKIA, columna LLEGÓ (solo lectura) + «Ajustar a lo que llegó» (copia LLEGÓ→ENVIADO al borrador, no guarda; ni supuesto ni bolillo; no en hoja cobrada), vista Bolillo, pestaña Estado de cuenta (`?vista=estado`). 🔴 Venta, comisión, Se debe y descuento vienen del servidor; aquí solo se pintan. `peticionRef` descarta respuestas viejas. |
| `ModalEntregaPueblo.tsx` | Entrega de un pueblo de UN día (botón por renglón en el Estado de cuenta): EFECTIVO que regresó + agua/luz/renta/sueldo/merma/otro (informe: pueden pasar del efectivo o ir sin efectivo); enseña DIFERENCIA (efectivo − pan) y ENTREGADO (efectivo − gastos) antes de guardar. La suma es cortesía (`compartido/utils/entregaPueblo.ts`); 🔴 decide el servidor. |
| `useAvisoSinGuardar.ts` | Confirmar al salir con algo sin guardar. |
| `VistaBolillo.tsx` | Vista Bolillo de la Hoja: PEDIDO vs SALIÓ por tanda; guarda solo lo cambiado. Camioneta: solo se congela en ruta (en el paso 3 se corrige). |

Tests: `bolilloDia.test.ts`, `EstadoCuentaHoja.render.test.tsx`, `HojaDelDia.render.test.tsx`, `useAvisoSinGuardar.test.tsx`, `VistaBolillo.render.test.tsx`.

### `modulos/operaciones/inventario/`

| Archivo | Qué es |
|---|---|
| `ConteoFisico.jsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `conteoFisico.ts` | Recetas (🔴 aquí vivió el −$1M); entrada de pan; conteo; consumo; mapa de stock. |
| `HistorialMovimientos.jsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `Inventario.jsx` | Stock, agotados, ajustes, conteo físico. |
| `RegistroMerma.jsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `RegistroMovimiento.css` | Estilos de esta pantalla. |
| `RegistroRegalo.jsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `RegistroSalida.jsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `stockMP.ts` | Recetas (🔴 aquí vivió el −$1M); entrada de pan; conteo; consumo; mapa de stock. |

Tests: `ConteoFisico.test.js`, `Inventario.test.jsx`, `stockMP.test.js`.

### `modulos/operaciones/pedido/`

| Archivo | Qué es |
|---|---|
| `CargaDrive.tsx` | Tarjeta «Carga automática» de Pedido: solo el switch (visible si `puede_cambiar`) y último cambio. Sin carpeta configurada no se pinta. Reglas en `pedido_drive.py`. |
| `charolas.ts` | Piezas → «N char + M pz», espejo de `_charolas` del backend. |
| `gruposDestino.ts` | Juntar pestañas del pedido; ordenar destinos; destinos de envío (sin duplicar camionetas). |
| `Pedido.jsx` | La hoja del día: «Traer de Drive» (o, si Drive no responde, subir .xlsx a mano) → previsualiza → «Importar y mandar» (Telegram); limpio y enviado → regresa a Operaciones. Fecha la dice el Excel. Un Excel por día; «Quitar» borra el guardado. Abajo, tarjeta `CargaDrive`. |
| `pedidoDia.ts` | Juntar pestañas del pedido; ordenar destinos; destinos de envío (sin duplicar camionetas). |

Tests: `CargaDrive.render.test.tsx`, `charolas.test.ts`, `gruposDestino.test.ts`, `Pedido.fecha.test.tsx`, `pedidoDia.test.ts`.

### `modulos/operaciones/produccion/`

| Archivo | Qué es |
|---|---|
| `NuevaReceta.jsx` | Modales/formularios de alta. |
| `Produccion.jsx` | Recetas (BOM) y entrada de pan. |

### `modulos/operaciones/proveedores/`

| Archivo | Qué es |
|---|---|
| `frappeSupplier.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |
| `NuevoProveedor.css` | Estilos de esta pantalla. |
| `NuevoProveedor.jsx` | Modales/formularios de alta. |
| `Proveedores.jsx` | Alta/edición de proveedores. |
| `proveedorTaxonomy.ts` | Sucursales internas/destino; grupos de proveedor. |
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
| `BuscadorCliente.jsx` | Buscador de clientes B2B; filtro de tipo de item. |
| `ModalReciboPDF.jsx` | Recibo PDF de la venta B2B. |
| `NuevaVentaB2B.jsx` | Alta de venta B2B; precio en `modulos/operaciones/venta-b2b/ventaB2B.ts` (excepción DELI nata a precio de compra). Escáner: Enter con código de barras busca exacto; pan no entra a B2B. |
| `VentaB2B.jsx` | Venta mayoreo de abarrote/MP + CxC con «Cobrar». 🔴 El pan ya no se vende aquí (va por la Hoja). |
| `ventaB2B.ts` | Precio B2B; precio por canal (🔴 `custom_precio_por_kg` es de COMPRA); margen del pan. |

Tests: `NuevaVentaB2B.escaner.render.test.tsx`, `NuevaVentaB2B.precio.test.ts`.

### `modulos/procesos/nomina/`

| Archivo | Qué es |
|---|---|
| `frappeNomina.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |
| `Nomina.css` | Estilos de esta pantalla. |
| `Nomina.tsx` | Corrida, empleados, reporte. |
| `nominaTotales.ts` | CxP; gasto anual sin doble nómina; totales de nómina (espejo del backend); egresos. |

Tests: `nominaTotales.test.js`.

### `modulos/repartidor/liquidacion/`

| Archivo | Qué es |
|---|---|
| `Liquidacion.css` | Estilos de esta pantalla. |
| `Liquidacion.tsx` | `/liquidacion` — el repartidor elige día y teclea MERMA (polvorón/muerto agrupados, `repartirMerma`). Manda todos los renglones. Borrador por día en IndexedDB (se ignora si ya se envió o cobró). 🔴 Ya «liquidado» = solo lectura (la merma se manda una vez). |
| `mermaAgrupada.ts` | Previsualizar liquidación; agrupar y repartir merma de polvorón/muerto. |

Tests: `Liquidacion.render.test.tsx`, `mermaAgrupada.test.ts`.

### `modulos/reportes/por-grupo/`

| Archivo | Qué es |
|---|---|
| `ReportePorGrupo.tsx` | `/reportes/por-grupo` (solo Gerente; `/reportes/camionetas` redirige). Primero GRUPO (Camionetas, Pueblos, Clientes, Sucursales) y luego quién; los grupos que no son camioneta los pinta `ReporteGrupo.tsx`. Camionetas: Venta, gastos y vendido por categoría de cada camioneta por día. La merma se teclea en $: borrador local → Guardar → Cerrar por día (cerrada: «Reabrir» solo Luis/Administrator). Cuentas en `compartido/utils/reporteCamionetas.ts`; 🔴 el dinero viene sumado del servidor. |
| `ReporteGrupo.tsx` | Tablas de Reportes → Pueblos / Clientes / Sucursales (un bloque por destino, un renglón por día). 🔴 Columnas y sumas vienen del servidor (`reporte_grupo`); solo pinta. Cada destino puede traer SUS columnas (pueblos: tabla del jefe, VEGIL con su 10%); las del grupo son las del total de abajo. GANANCIA con signo y color de texto. Tabla `cam-tabla--grupo` (encabezado en dos renglones, centrado). Vive dentro de `ReportePorGrupo.tsx`. |

Tests: `ReporteGrupo.render.test.tsx`.

### `modulos/reportes/compras/`

| Archivo | Qué es |
|---|---|
| `ReporteCompras.jsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

### `modulos/reportes/cuentas-por-cobrar/`

| Archivo | Qué es |
|---|---|
| `ReporteCuentasPorCobrar.jsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

### `modulos/reportes/cuentas-por-pagar/`

| Archivo | Qué es |
|---|---|
| `cuentasPorPagar.ts` | CxP; gasto anual sin doble nómina; totales de nómina (espejo del backend); egresos. |
| `ReporteCuentasPorPagar.jsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

Tests: `ReporteCuentasPorPagar.render.test.tsx`, `ReporteCuentasPorPagar.test.js`.

### `modulos/reportes/gastos/`

| Archivo | Qué es |
|---|---|
| `frappeReportes.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |
| `ReporteGastos.jsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

### `modulos/reportes/gastos-anual/`

| Archivo | Qué es |
|---|---|
| `gastosAnuales.ts` | CxP; gasto anual sin doble nómina; totales de nómina (espejo del backend); egresos. |
| `kilosComprados.ts` | Kilos comprados: agrupa categoría→insumo→mes por cuenta (Maps, O(n)), totales por unidad sin mezclar Kg/L/PZA, `csvKilos` (BOM + CRLF). Test `kilosComprados.test.ts`. |
| `KilosComprados.tsx` | Kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`. |
| `ReporteGastosAnual.css` | Estilos de esta pantalla. |
| `ReporteGastosAnual.jsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

Tests: `gastosAnuales.test.js`, `KilosComprados.render.test.tsx`, `kilosComprados.test.ts`.

### `modulos/reportes/valorizacion/`

| Archivo | Qué es |
|---|---|
| `ReporteValorizacion.tsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

Tests: `ReporteValorizacion.test.ts`.

### `modulos/reportes/ventas-categoria/`

| Archivo | Qué es |
|---|---|
| `ReportesVentasCategoria.jsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `modulos/reportes/cuentas-por-pagar/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `modulos/reportes/gastos-anual/kilosComprados.ts`). |

## Compartido (`src/compartido/`)

`services/`: cada uno extiende `FrappeBase.ts` (fetch, CSRF si existe, parseo de error) y exporta un singleton; frontera con el backend. `compartido/styles/global.css` = tokens del diseño Bento + clases compartidas. `db/` = Dexie / offline (`grace_pos`).

### `compartido/components/`

| Archivo | Qué es |
|---|---|
| `CantidadDual.tsx` | Cantidad en base o presentación con conversión visible. 🔴 Existe por el bug de UOM de $8,846. |
| `NuevoInsumo.jsx` | Modales/formularios de alta. |
| `SelectorTipoItem.tsx` | Buscador de clientes B2B; filtro de tipo de item. |
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
| `ConfirmModal.jsx` | Modal de confirmar (con `useConfirmModal`). |
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
| `clientesB2B.ts` | Sucursales internas/destino; grupos de proveedor. |
| `constants.ts` | Identidad del negocio desde `VITE_*`; `PAGE_SIZE`, `TIPOS_ITEM`. |
| `impuestos.ts` | Tasas y cascada IEPS→IVA (25.28%, no 24%). Test: `impuestos.test.js`. |
| `tenant.ts` | Identidad del negocio desde `VITE_*`; `PAGE_SIZE`, `TIPOS_ITEM`. |

Tests: `impuestos.test.js`.

### `compartido/db/`

| Archivo | Qué es |
|---|---|
| `borradorLocal.ts` | Autosave de formularios y del conteo físico. |
| `conteoBorrador.ts` | Autosave de formularios y del conteo físico. |
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
| `appConfig.ts` | Config ERPNext y sucursales (cache + pub/sub). 🔴 Sin destinos hardcodeados. |
| `frappeAuth.ts` | Login/logout, rol, POS profile. `getUser()` valida localStorage (no escalar rol por DevTools). `pedirRecuperacion`/`cambiarConLlave` (sin sesión; tras cambiar cierra la sesión que abre Frappe). |
| `FrappeBase.ts` | Fetch, CSRF si existe, parseo de error. |
| `frappeEgresos.ts` | Egresos, CxP, `marcarPagado(…, cobro?)`, `cobrosParaEgreso`. |
| `frappeHoja.ts` | `hoja_api` (mismo nombre en camelCase): hoja, guardar, guardarTodo, confirmarEnvio, reabrirEnvio, guardarMerma, confirmar, corregir, cerrarLlegada, reabrirLlegada, cobrosDeFactura, deshacerCobro, panesParaAgregar, agregarPan, miHoja, guardarRegreso, vistaBolillo, guardarBolillo, destinos, deudores, estadoCuenta, liquidar, rentabilidadCamionetas, guardarMermasCamioneta, cerrarMermaCamioneta, reabrirMermaCamioneta, registrarEntrega, reporteGrupo. |
| `frappeInventory.ts` | Catálogo: almacenes, grupos, UOM, CRUD de Item, stock, `siguienteCodigoInterno`. |
| `frappePedido.ts` | Importar Excel, fechas, tablero, valorización, sugerencia de envío; `estadoDrive`/`cambiarDrive`/`buscarEnDrive` (`pedido_drive`). |
| `frappePOS.ts` | Perfil POS, productos, `crearVentaOffline` (lo llama el outbox), corte, historial, cancelar. |
| `frappeProduccion.ts` | BOM, costeo, entrada de pan, `entradoHoy`. |
| `frappePurchase.ts` | Compras: confirmar/cancelar, consolidar, revertir pagado (con contraseña), reporte fiscal (`reportes_api.reporte_compras_mensual`, lo suma la base), `getKilosComprados`, escáner (`esCodigoDeBarras`, `buscarPorCodigo`, `ligarCodigo`). |
| `frappeSales.ts` | Venta B2B, CxC, cobros. 🔴 Factura de la Hoja: el factor de impuesto sale de `custom_impuesto` del Item (`renglonDeFactura`), no de la plantilla. |
| `frappeStock.ts` | Movimientos: entradas, salidas, mermas, ajustes, regalos, traspasos, conteo. |
| `printService.ts` | Cliente del print-server (`/print/...`): tickets de venta, corte, traspaso, B2B, Hoja, nómina, egreso. |
| `sucursalesConfig.ts` | Config ERPNext y sucursales (cache + pub/sub). 🔴 Sin destinos hardcodeados. |

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
| `cierreRuta.ts` | Previsualizar liquidación; agrupar y repartir merma de polvorón/muerto. |
| `entradaPan.ts` | Recetas (🔴 aquí vivió el −$1M); entrada de pan; conteo; consumo; mapa de stock. |
| `entregaPueblo.ts` | Entrega de pueblo: conceptos (PÉRDIDA → MERMA), `resumenEntrega` (centavos enteros: diferencia, entregado; sin tope: los gastos son informe), `razonesGasto` (la razón de cada gasto para el Estado de cuenta), `conSigno` y `claseDiferencia` (color de texto `.dif` de `global.css`). Espejo de `caja_cobro.armar_entrega`. |
| `errorFrappe.ts` | Errores legibles; rate-limit de login + anti-XSS; detectar deploy nuevo; leer aviso de mantenimiento con el reloj de la torre. |
| `formato.ts` | `pesos`/`numero` (sin `Intl` currency); `hoyISO` LOCAL (🔴 nunca `toISOString`); reloj; alias UOM. |
| `hojaDia.ts` | Hoja del día: bloques por categoría, `totalCapturado`, `estadoEnviado`, `ticketDeHoja`, `conDescuento`, borrador por fecha/destino, `conLlegadas`, `ajustesALoQueLlego`. |
| `hora.ts` | `pesos`/`numero` (sin `Intl` currency); `hoyISO` LOCAL (🔴 nunca `toISOString`); reloj; alias UOM. |
| `itemGroups.ts` | Margen/filtro de pan; árbol de grupos por nested set. |
| `liquidacion.ts` | Vendido, comisión 10% + `COMISION_FIJA` (espejo de `hoja_calculo.COMISION_FIJA`). |
| `mantenimiento.ts` | Errores legibles; rate-limit de login + anti-XSS; detectar deploy nuevo; leer aviso de mantenimiento con el reloj de la torre. |
| `precioCanal.ts` | Precio B2B; precio por canal (🔴 `custom_precio_por_kg` es de COMPRA); margen del pan. |
| `produccionCalc.ts` | Recetas (🔴 aquí vivió el −$1M); entrada de pan; conteo; consumo; mapa de stock. |
| `reloj.ts` | `pesos`/`numero` (sin `Intl` currency); `hoyISO` LOCAL (🔴 nunca `toISOString`); reloj; alias UOM. |
| `reporteCamionetas.ts` | Reporte de camionetas: totales por camioneta y `conMerma` (sobrepone la merma tecleada por DIFERENCIA contra la guardada). |
| `security.ts` | Errores legibles; rate-limit de login + anti-XSS; detectar deploy nuevo; leer aviso de mantenimiento con el reloj de la torre. |
| `uom.ts` | `pesos`/`numero` (sin `Intl` currency); `hoyISO` LOCAL (🔴 nunca `toISOString`); reloj; alias UOM. |
| `version.ts` | Errores legibles; rate-limit de login + anti-XSS; detectar deploy nuevo; leer aviso de mantenimiento con el reloj de la torre. |

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

Flask aparte, corre en la PC de la caja e imprime en la térmica por USB. `print_server.py` (servidor; 🔴 la versión del repo es la que corre), `test_fmt.py` (redondeo de montos), `setup.sh` / `setup_windows.bat` (instalación), `requirements.txt`, `README.md`, `DejaVuSansMono.ttf`.

## `testsprite-plans/`

Pruebas de navegador. 🔴 **Solo contra dev, nunca la torre** (teclea de verdad). Usuario `testsprite@grace.local` = Gerente + Admin Sucursal, sin System Manager a propósito. Rerun del portal repite lo viejo: lanzar corrida nueva.
`01-login-rechaza-malas.json`, `02-login-panel-gerente.json`, `03-catalogo-insumos-y-pan.json`, `04-inventario-stock.json`, `05-b2b-abarrote-precio-tienda.json` (🔴 el del dinero), `06-compra-captura.json`, `07-egreso-simple.json`, `08-envio-sucursal.json`, `09-pos-venta-efectivo.json`, `10-reporte-cxp-vistas.json`, `11-proveedor-alta.json`, `12-produccion-entrada-pan.json`, `13-presentacion-recalcula-precio.json`, `14-dia-del-pan-entrada-y-envio.json`.
