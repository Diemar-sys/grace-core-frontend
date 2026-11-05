# MAPA DEL FRONTEND — `bake-data-frontend`

> Qué es cada archivo y dónde vive lo delicado. Actualizado 2026-11-04.
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

## Entrada (`src/`)

| Archivo | Qué es |
|---|---|
| `main.jsx` | Monta `<App/>` en `FrappeProvider` (`enableSocket=false`). 🔴 Auth solo por cookie; nunca API key en `VITE_*` (se hornea público). |
| `App.jsx` | Router. Rutas protegidas, lazy para reportes. Monta `BannerConexion`, `AvisoSesion`, `AvisoMantenimiento` (fuera del `ErrorBoundary`). `/liquidacion` = única ruta de Repartidor; `/mi-cuenta` = única de Cliente. |
| `index.css`, `vite-env.d.ts` | Reset base; tipos de Vite y `window.csrf_token`. |

## Páginas (`src/pages/`)

Roles salen de `config/roles.ts`. Tests viven junto a cada página (`*.test.*`).

| Archivo | Ruta / qué hace | Roles |
|---|---|---|
| `HojaDelDia.tsx` | `/hoja` — **cobro sin inventario por destino/día.** Captura ENVIADO por pan (colores vs PEDIDO), «+ charolas», buscador, borrador en IndexedDB, «Guardar todo», camioneta en 3 pasos (capturando / en ruta / liquidado con MERMA y corrección de ENVIADO), cobrar (siempre guarda antes), «Corregir» (si el servidor manda `corregible`: solo Luis/Administrator), «+ Agregar pan» en hoja corregida (`AgregarPan`), Ticket, descuento DELI/ZAKIA, columna LLEGÓ (solo lectura), vista Bolillo, pestaña Estado de cuenta (`?vista=estado`). 🔴 Venta, comisión, Se debe y descuento vienen del servidor; aquí solo se pintan. `peticionRef` descarta respuestas viejas. | Operaciones, Gerente |
| `Liquidacion.tsx` | `/liquidacion` — el repartidor elige día y teclea MERMA (polvorón/muerto agrupados, `repartirMerma`). Manda todos los renglones. Borrador por día en IndexedDB (se ignora si ya se envió o cobró). 🔴 Ya «liquidado» = solo lectura (la merma se manda una vez). | Repartidor |
| `MiCuenta.tsx` | `/mi-cuenta` — portal del cliente: Resumen (debes, facturado, pagado, surtido, antigüedad), Facturas con «Ver» detalle, Pedidos con «Ver pan», Envíos agrupados por folio con «Ver» (`enviosAgrupados`). Lo único que escribe: «Te llegó» del día hasta el cierre (19:00). | Cliente |
| `Pedido.jsx` | Importa el Excel del pedido (fecha la dice el Excel), PDF/Telegram. Un Excel por día; «Quitar» borra el guardado. | Almacén, Operaciones, Gerente |
| `ConsultaPedido.tsx` | Pedido guardado + PDF (solo lectura). | idem |
| `ConsultaTablero.tsx` | Avance del día vs pedido (traspasos reales + lo facturado a clientes). | idem |
| `POS.jsx` | Punto de venta offline-first; todo por Dexie/`db/sync`. | Vendedor, Gerente |
| `ConsultasPOS.jsx` | Historial, cancelación (solo Gerente), corte. | Vendedor, Gerente |
| `VentaB2B.jsx` | Venta mayoreo de abarrote/MP + CxC con «Cobrar». 🔴 El pan ya no se vende aquí (va por la Hoja). | Operaciones, Gerente |
| `EnvioSucursal.jsx` | Traspasos a sucursal, «+ Entrada de Pan», reposición de insumos. | Operaciones, Gerente |
| `Produccion.jsx` | Recetas (BOM) y entrada de pan. | Gerente |
| `Catalogo.jsx` | Alta/edición de insumos y pan, costeo. | Almacén, Operaciones, Gerente |
| `Inventario.jsx` | Stock, agotados, ajustes, conteo físico. | idem |
| `Kardex.jsx` | Consumo entre los dos últimos conteos. | idem |
| `Compras.jsx` | Lista y captura de compras (vía `hooks/useCompras`). | idem |
| `Egresos.jsx` | Gastos (CFE, gasolina, etc.); «Por pagar» abre `ModalPagarEgreso` (normal o con un cobro). `?modo=consulta`. | idem |
| `Proveedores.jsx` | Alta/edición de proveedores. | idem |
| `Nomina.tsx` | Corrida, empleados, reporte. | Gerente |
| `Cuentas.tsx` | Usuarios: crear, nivel, POS, habilitar, ficha. Tocar un System Manager pide llave de Administrator. | System Manager |
| `Auditoria.tsx` | Bitácora de acciones sensibles. | Gerente |
| `ReporteCuentasPorCobrar.jsx`, `ReporteCuentasPorPagar.jsx`, `ReporteCompras.jsx`, `ReporteGastos.jsx`, `ReporteGastosAnual.jsx`, `ReportesVentasCategoria.jsx`, `ReporteValorizacion.tsx` | Reportes. CxP = compras + egresos por `facturado_a` (lógica en `utils/cuentasPorPagar.ts`). Gastos anual agrega en el navegador (tope ~2000 compras). Valorización: MP con margen `null`, nunca $0. Gastos anual incluye `KilosComprados.tsx` (kilos comprados por mes/cuenta + CSV; lógica en `utils/kilosComprados.ts`). | Gerente |
| `Panel.jsx` | Tablero post-login por nivel. | todos menos Repartidor/Cliente |
| `Login.jsx` | Login con bloqueo por intentos. | público |

Tests: `HojaDelDia.render.test.tsx`, `Liquidacion.render.test.tsx`, `MiCuenta.render.test.tsx`, `Pedido.fecha.test.tsx`, `Cuentas.ficha.render.test.tsx`, `ConsultaTablero.avance.test.ts`, `ConsultaPedido.totales.test.ts`, `Egresos.consulta.test.tsx`, `Egresos.partidas.test.js`, `Inventario.test.jsx`, `Kardex.test.js`, `Panel.rutas.test.js`, `Catalogo.filtroPan.test.js`, `ReporteCuentasPorPagar.test.js`, `ReporteCuentasPorPagar.render.test.tsx`, `ReporteValorizacion.test.ts`.

## Componentes (`src/components/`)

| Archivo | Qué es |
|---|---|
| `EstadoCuentaHoja.tsx` | Pestaña «Estado de cuenta» de la Hoja: rango de fechas, tabla por día, LIQUIDADO (Eva→Luis, solo `puede_liquidar`), EGRESO, POR ENTREGAR, «Cobrar». Números del servidor. |
| `VistaBolillo.tsx` | Vista Bolillo de la Hoja: PEDIDO vs SALIÓ por tanda; guarda solo lo cambiado. Camioneta: solo se congela en ruta (en el paso 3 se corrige). |
| `AgregarPan.tsx` | «+ Agregar pan» de la Hoja: solo con `puede_agregar` (hoja corregida, Luis/Administrator). Manda solo la clave; el precio lo pone el servidor. |
| `AvisoMantenimiento.tsx` / `PildoraMantenimiento.tsx` | Aviso de 5 min + píldora junto al reloj; en mantenimiento (503) tapa la pantalla sin recargar. Lógica en `utils/mantenimiento.ts`. |
| `AvisoSesion.tsx` | Bloquea la pantalla si otra pestaña cambió la sesión. |
| `Reloj.tsx` | Fecha/hora local de la barra, un tic por minuto. |
| `BannerConexion.jsx`, `ErrorBoundary.jsx`, `Layout.jsx`, `ProtectedRoute.jsx` | Red caída · boundary global · shell/topbar + «hay versión nueva» · guard de rutas + precarga de config. |
| `CantidadDual.tsx` | Cantidad en base o presentación con conversión visible. 🔴 Existe por el bug de UOM de $8,846. |
| `NuevaVentaB2B.jsx` | Alta de venta B2B; precio en `utils/ventaB2B.ts` (excepción DELI nata a precio de compra). Escáner: Enter con código de barras busca exacto; pan no entra a B2B. |
| `TablaCuentasPorCobrar.jsx` | CxC (reporte y venta), filtro TODO/PAN/MATERIA PRIMA. |
| `NuevaCompra.jsx`, `NuevaReceta.jsx`, `NuevoEnvioSucursal.jsx`, `NuevoInsumo.jsx`, `NuevoPan.jsx`, `NuevoProveedor.jsx` | Modales/formularios de alta. |
| `ConteoFisico.jsx`, `HistorialMovimientos.jsx`, `RegistroMerma.jsx`, `RegistroRegalo.jsx`, `RegistroSalida.jsx`, `ReposicionInsumos.tsx` | Inventario: conteo, historial, merma, regalo de proveedor, salida, qué reponer (por ritmo, no por saldo). Merma y Salida con borrador local (`useBorradorLocal`). |
| `BuscadorCliente.jsx`, `SelectorTipoItem.tsx` | Buscador de clientes B2B; filtro de tipo de item. |
| `catalogo/` | `FilaItem.tsx`, `VistaPan.tsx` (costeo/margen), `catalogoTypes.ts`. |
| `compras/` | `BuscadorProveedor.jsx`, `ComprasModales.jsx`, `FilaProducto.jsx`, `ModalReciboPDF.jsx`, `compraUtils.ts` (impuesto, bulto↔kg). Escáner en `FilaProducto.jsx`; `LigarCodigo.tsx` (código desconocido: ligar a existente o alta; `ElegirVariante` cuando un código tiene varios items) 🔴 el nombre no dice el tamaño: se confirma la presentación. `ModalPreciosActualizados.jsx` 🔴 sin botón «Omitir» (omitir dejaba el catálogo mintiendo). |
| `egresos/` | `EgresosTabla.tsx`, `ModalPagarEgreso.tsx` (pagar con un cobro), formularios `GasForm.tsx`, `GasolinaForm.tsx`, `LuzForm.tsx`, `SubcatForm.tsx`, `CampoAjustable.tsx`; cálculo puro `luzCalc.ts` (CFE, total truncado), `simpleCalc.ts`; `egresosConstants.ts`, `egresosIcons.tsx`, `egresosTypes.ts`. |
| `modals/` | `ConfirmModal.jsx`, `ModalError.jsx` (🔴 recibe string, nunca objeto: React #31), `ModalEntradaPan.jsx` (precarga lo que FALTA del pedido; costo editable solo Gerente sin receta), `ModalHojaEntrega.jsx`, `ModalReciboPDF.jsx`, `ModalRegistrarPago.jsx` (cobra el SALDO; despliega productos). |
| `pos/` | `POSCatalogo.jsx`, `POSHistorial.jsx`, `POSTicket.jsx`, `POSModalCantidad.jsx`, `POSModalCobro.jsx`, `POSModalCorte.jsx`, `POSModalEspera.jsx`, `posUtils.ts`. |

Tests: `AvisoMantenimiento.render.test.tsx`, `EstadoCuentaHoja.render.test.tsx`, `VistaBolillo.render.test.tsx`, `Reloj.render.test.tsx`, `CantidadDual.test.ts`, `CantidadDual.render.test.jsx`, `ConteoFisico.test.js`, `NuevaVentaB2B.precio.test.ts`, `NuevoPan.margen.test.js`, `TablaCuentasPorCobrar.tipo.test.tsx`, `compraUtils.test.js`, `compraUtils.impuesto.test.ts`, `ModalPagarEgreso.render.test.tsx`, `RegistroMovimiento.borrador.test.jsx`, `luzCalc.test.ts`, `simpleCalc.test.ts`, `ConfirmModal.test.jsx`, `ModalEntradaPan.test.js`, `ModalEntradaPan.segunda.test.tsx`, `ModalEntradaPan.candado.test.tsx`, `ModalError.objeto.test.jsx`, `ModalRegistrarPago.test.tsx`, `posUtils.test.js`, `KilosComprados.render.test.tsx`, `NuevaCompra.escaner.render.test.tsx`, `NuevaVentaB2B.escaner.render.test.tsx`, `compras/FilaProducto.escaneo.render.test.tsx`.

## Estilos (`src/styles/`)

`global.css` = tokens del diseño Bento (colores, radios, sombras) + clases compartidas. Uno por pantalla: `AvisoMantenimiento.css`, `AvisoSesion.css`, `BannerConexion.css`, `CatalogoPan.css`, `Compras.css` (también Egresos), `Cuentas.css`, `Egresos.css`, `HojaDelDia.css`, `Layout.css`, `Liquidacion.css`, `Login.css`, `MiCuenta.css`, `Nomina.css`, `NuevaCompra.css` (shell de varios modales), `NuevoInsumo.css`, `NuevoPan.css`, `NuevoProveedor.css`, `Panel.css` (también Consultas/Egresos/Producción/Catálogo), `Pedido.css` (también ConsultaPedido/Tablero/Valorización), `Produccion.css`, `RegistrarPago.css`, `RegistroMovimiento.css`, `ReporteGastosAnual.css`; `pos/POS.css`, `pos/POSCatalogo.css`, `pos/POSHistorial.css`, `pos/POSModals.css`, `pos/POSTicket.css`.

## Servicios (`src/services/`) — frontera con el backend

Cada uno extiende `FrappeBase.ts` (fetch, CSRF si existe, parseo de error) y exporta un singleton.

| Archivo | Pega a |
|---|---|
| `frappeHoja.ts` | `hoja_api` (mismo nombre en camelCase): hoja, guardar, guardarTodo, confirmarEnvio, reabrirEnvio, guardarMerma, confirmar, corregir, panesParaAgregar, agregarPan, miHoja, guardarRegreso, vistaBolillo, guardarBolillo, destinos, deudores, estadoCuenta, liquidar. |
| `frappeCliente.ts` | `cliente_api`: miCuenta, miPedido, miFactura, confirmarLlegada. |
| `frappeSales.ts` | Venta B2B, CxC, cobros. 🔴 Factura de la Hoja: el factor de impuesto sale de `custom_impuesto` del Item (`renglonDeFactura`), no de la plantilla. |
| `frappePedido.ts` | Importar Excel, fechas, tablero, valorización, sugerencia de envío. |
| `frappePOS.ts` | Perfil POS, productos, `crearVentaOffline` (lo llama el outbox), corte, historial, cancelar. |
| `frappeStock.ts` | Movimientos: entradas, salidas, mermas, ajustes, regalos, traspasos, conteo. |
| `frappeInventory.ts` | Catálogo: almacenes, grupos, UOM, CRUD de Item, stock, `siguienteCodigoInterno`. |
| `frappeProduccion.ts` | BOM, costeo, entrada de pan, `entradoHoy`. |
| `frappePurchase.ts` | Compras: confirmar/cancelar, consolidar, revertir pagado (con contraseña), reporte fiscal (`reportes_api.reporte_compras_mensual`, lo suma la base), `getKilosComprados`, escáner (`esCodigoDeBarras`, `buscarPorCodigo`, `ligarCodigo`). |
| `frappeEgresos.ts` | Egresos, CxP, `marcarPagado(…, cobro?)`, `cobrosParaEgreso`. |
| `frappeAuth.ts` | Login/logout, rol, POS profile. `getUser()` valida localStorage (no escalar rol por DevTools). |
| `frappeCuentas.ts`, `frappeAuditoria.ts`, `frappeNomina.ts`, `frappeKardex.ts`, `frappeReportes.ts`, `frappeSupplier.ts` | Usuarios · bitácora · nómina · kardex · gasto unificado · proveedores. |
| `appConfig.ts`, `sucursalesConfig.ts` | Config ERPNext y sucursales (cache + pub/sub). 🔴 Sin destinos hardcodeados. |
| `printService.ts` | Cliente del print-server (`/print/...`): tickets de venta, corte, traspaso, B2B, Hoja, nómina, egreso. |

Tests: `frappeCliente.miFactura.test.ts`, `frappePedido.test.ts`, `frappePurchase.buscar.test.js`, `frappeSales.cxc.test.js`, `frappeSales.buscar.test.js`, `frappeSales.facturaItems.test.ts`, `frappeSales.totales.test.js`, `frappeStock.envio.test.js`.

## Utilidades (`src/utils/`) — funciones puras

| Archivo | Qué hace |
|---|---|
| `hojaDia.ts` | Hoja del día: bloques por categoría, `totalCapturado`, `estadoEnviado`, `ticketDeHoja`, `conDescuento`, borrador por fecha/destino, `conLlegadas`. |
| `bolilloDia.ts` | Vista Bolillo: totales por tanda/camioneta. |
| `liquidacion.ts` | Vendido, comisión 10% + `COMISION_FIJA` (espejo de `hoja_calculo.COMISION_FIJA`). |
| `cierreRuta.ts`, `mermaAgrupada.ts` | Previsualizar liquidación; agrupar y repartir merma de polvorón/muerto. |
| `buscarPan.ts` | Buscador (sin acentos). 🔴 Solo filtra lo que se pinta; guardar manda todo. |
| `kilosComprados.ts` | Kilos comprados: agrupa categoría→insumo→mes por cuenta (Maps, O(n)), totales por unidad sin mezclar Kg/L/PZA, `csvKilos` (BOM + CRLF). Test `kilosComprados.test.ts`. |
| `charolas.ts` | Piezas → «N char + M pz», espejo de `_charolas` del backend. |
| `pedidoDia.ts`, `gruposDestino.ts`, `destinosEnvio.ts` | Juntar pestañas del pedido; ordenar destinos; destinos de envío (sin duplicar camionetas). |
| `ventaB2B.ts`, `precioCanal.ts`, `precioPan.ts` | Precio B2B; precio por canal (🔴 `custom_precio_por_kg` es de COMPRA); margen del pan. |
| `costoAnomalo.ts` | Costo de compra vs mediana histórica (ok/aviso/bloqueo). |
| `produccionCalc.ts`, `entradaPan.ts`, `conteoFisico.ts`, `kardex.ts`, `stockMP.ts` | Recetas (🔴 aquí vivió el −$1M); entrada de pan; conteo; consumo; mapa de stock. |
| `cuentasPorPagar.ts`, `gastosAnuales.ts`, `nominaTotales.ts`, `egresosUtils.ts` | CxP; gasto anual sin doble nómina; totales de nómina (espejo del backend); egresos. |
| `formato.ts`, `hora.ts`, `reloj.ts`, `uom.ts` | `pesos`/`numero` (sin `Intl` currency); `hoyISO` LOCAL (🔴 nunca `toISOString`); reloj; alias UOM. |
| `catalogoUtils.ts`, `itemGroups.ts` | Margen/filtro de pan; árbol de grupos por nested set. |
| `errorFrappe.ts`, `security.ts`, `version.ts`, `mantenimiento.ts` | Errores legibles; rate-limit de login + anti-XSS; detectar deploy nuevo; leer aviso de mantenimiento con el reloj de la torre. |
| `print/` | `printUtils.ts`, `ticketTemplate.ts`, `corteTemplate.ts`, `comprasPrint.ts`, `egresoDesglose.ts`, `escHTML.ts`. |

Tests: `bolilloDia.test.ts`, `buscarPan.test.ts`, `charolas.test.ts`, `cierreRuta.test.ts`, `costoAnomalo.test.ts`, `destinosEnvio.test.ts`, `errorFrappe.test.js`, `formato.test.ts`, `gastosAnuales.test.js`, `gruposDestino.test.ts`, `hojaDia.test.ts`, `hora.test.js`, `itemGroups.test.js`, `liquidacion.test.js`, `mermaAgrupada.test.ts`, `nominaTotales.test.js`, `pedidoDia.test.ts`, `precioCanal.test.ts`, `produccionCalc.test.ts`, `reloj.test.ts`, `security.test.js`, `stockMP.test.js`, `uom.test.js`, `version.test.js`, `print/egresoDesglose.test.ts`.

## Base local (`src/db/`) — Dexie / offline

| Archivo | Qué es |
|---|---|
| `db.ts` | Base `grace_pos`: `catalogo`, `stock`, `outbox` (ventas pendientes), `conteo`, `borradores`. |
| `sync.ts` | Outbox: `drainOutbox` en orden, single-flight. Sin red → para; 4xx → esa fila `error` y sigue; 5xx → para sin condenar (🔴 si no, una venta durante un deploy se perdía). Push antes de pull. |
| `borradorLocal.ts`, `conteoBorrador.ts` | Autosave de formularios y del conteo físico. |
| `uuid.ts` | UUID v4 con `getRandomValues` (la LAN es HTTP, `randomUUID` no existe ahí). |

Tests: `sync.test.js`, `borradorLocal.test.js`, `conteoBorrador.test.js`.

## Hooks (`src/hooks/`)

`useBorradorLocal.js` (autosave por usuario) · `useAvisoSinGuardar.ts` (confirmar al salir con algo sin guardar) · `useAvisoMantenimiento.ts` · `useSesionCompartida.ts` · `useVersionNueva.ts` · `useConexion.ts` · `useCompras.ts` · `useInsumoForm.ts` (🔴 `formularioDeEdicion` debe traer TODO campo que manda `updateItem`, si no borra el costo; al elegir categoría sugiere la clave N+1) · `useAutoUppercase.ts` · `useConfirmModal.ts` · `useDebounce.ts` · `useSucursales.ts`.

Tests: `useAvisoSinGuardar.test.tsx`, `useSesionCompartida.test.tsx`, `useInsumoForm.edicion.test.ts`, `useInsumoForm.codigo.test.js`, `useInsumoForm.interno.test.js`, `useAutoUppercase.test.jsx`, `useConexion.test.jsx`.

## Configuración (`src/config/`)

| Archivo | Qué es |
|---|---|
| `roles.ts` | Niveles (Vendedor, Almacén, Operaciones, Gerente, Repartidor, Cliente): módulos y rutas de cada uno. |
| `impuestos.ts` | Tasas y cascada IEPS→IVA (25.28%, no 24%). Test: `impuestos.test.js`. |
| `tenant.ts`, `constants.ts` | Identidad del negocio desde `VITE_*`; `PAGE_SIZE`, `TIPOS_ITEM`. |
| `clientesB2B.ts`, `proveedorTaxonomy.ts` | Sucursales internas/destino; grupos de proveedor. |
| `modulos.jsx`, `iconosModulos.jsx` | Tiles del Panel y sus iconos. |

`src/test/setup.js` — setup de Vitest (jest-dom).

## `public/` y `docs/`

`public/logo_GRACE.png`, `public/nuevologobkd.png` (favicon), `public/mantenimiento.html` (página del 503), `public/ticket_preview.html` (maqueta). `docs/screenshots/`: `panel.png`, `catalogo.png`, `compras.png`, `pos.png`, `proveedores.png` (capturas del README).

## `print-server/`

Flask aparte, corre en la PC de la caja e imprime en la térmica por USB. `print_server.py` (servidor; 🔴 la versión del repo es la que corre), `test_fmt.py` (redondeo de montos), `setup.sh` / `setup_windows.bat` (instalación), `requirements.txt`, `README.md`, `DejaVuSansMono.ttf`.

## `testsprite-plans/`

Pruebas de navegador. 🔴 **Solo contra dev, nunca la torre** (teclea de verdad). Usuario `testsprite@grace.local` = Gerente + Admin Sucursal, sin System Manager a propósito. Rerun del portal repite lo viejo: lanzar corrida nueva.
`01-login-rechaza-malas.json`, `02-login-panel-gerente.json`, `03-catalogo-insumos-y-pan.json`, `04-inventario-stock.json`, `05-b2b-abarrote-precio-tienda.json` (🔴 el del dinero), `06-compra-captura.json`, `07-egreso-simple.json`, `08-envio-sucursal.json`, `09-pos-venta-efectivo.json`, `10-reporte-cxp-vistas.json`, `11-proveedor-alta.json`, `12-produccion-entrada-pan.json`, `13-presentacion-recalcula-precio.json`, `14-dia-del-pan-entrada-y-envio.json`.
