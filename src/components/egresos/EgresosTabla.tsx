// src/components/egresos/EgresosTabla.tsx
import React from 'react';
import { CategoriaConfig } from './egresosTypes';
import { fmtN } from './egresosConstants';

export interface EgresoItem {
  name: string;
  no_de_compra?: string | number;
  fecha: string;
  proveedor?: string;
  concepto?: string;
  descripcion?: string;
  subcategoria?: string;
  facturado_a?: string;
  no_factura?: string;
  monto: number | string;
  impuesto_tipo?: string;
  monto_impuesto?: number | string;
  pagado?: boolean;
}

interface EgresosTablaProps {
  cat: CategoriaConfig | undefined;
  categoriaKey: string;
  egresos: EgresoItem[];
  egresosFiltrados: EgresoItem[];
  subcatsPresentes: string[];
  subcatFiltro: string;
  setSubcatFiltro: (v: string) => void;
  facturadoFiltro: string;
  setFacturadoFiltro: (v: string) => void;
  desde: string;
  setDesde: (v: string) => void;
  hasta: string;
  setHasta: (v: string) => void;
  busqueda: string;
  setBusqueda: (v: string) => void;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
  confirmDel: string | null;
  setConfirmDel: (v: string | null) => void;
  onVolver: () => void;
  onCargar: (catKey: string) => void;
  onPagado: (e: EgresoItem) => void;
  onImprimir: (e: EgresoItem) => void;
  onEliminar: (name: string) => void;
}

export const EgresosTabla: React.FC<EgresosTablaProps> = ({
  cat,
  categoriaKey,
  egresos,
  egresosFiltrados,
  subcatsPresentes,
  subcatFiltro,
  setSubcatFiltro,
  facturadoFiltro,
  setFacturadoFiltro,
  desde,
  setDesde,
  hasta,
  setHasta,
  busqueda,
  setBusqueda,
  loading,
  error,
  setError,
  confirmDel,
  setConfirmDel,
  onVolver,
  onCargar,
  onPagado,
  onImprimir,
  onEliminar,
}) => {
  const totalListado = egresosFiltrados.reduce(
    (a, e) => a + parseFloat(String(e.monto || 0)),
    0
  );

  return (
    <div className="page-container comprasv2">
      <div className="page-header">
        <div
          className="title-group"
          style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}
        >
          <button className="egresos-back" onClick={onVolver}>
            ← Egresos
          </button>
          <h1 style={{ margin: 0 }}>{cat?.label}</h1>
          <span className="header-subtitle">{cat?.sub}</span>
          {cat?.esVista && <span className="egreso-vista-badge">vista</span>}
        </div>
      </div>

      {/* FILTROS */}
      <div className="filtros-section">
        {subcatsPresentes.length > 1 && (
          <div className="filtro-group filtro-sm">
            <label>Subcategoría</label>
            <select
              className="comp-date-input"
              value={subcatFiltro}
              onChange={e => setSubcatFiltro(e.target.value)}
            >
              <option value="todas">Todas ({egresos.length})</option>
              {subcatsPresentes.map(s => (
                <option key={s} value={s}>
                  {s} ({egresos.filter(e => e.subcategoria === s).length})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="filtro-group filtro-sm">
          <label>Facturado a</label>
          <select
            className="comp-date-input"
            value={facturadoFiltro}
            onChange={e => setFacturadoFiltro(e.target.value)}
          >
            <option value="todas">Todas</option>
            <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
            <option value="LUIS TORRES">Luis Torres</option>
            <option value="SIN FACTURA">Sin factura</option>
          </select>
        </div>
        <div className="filtro-group filtro-sm">
          <label>Desde</label>
          <input
            type="date"
            className="comp-date-input"
            value={desde}
            onChange={e => setDesde(e.target.value)}
          />
        </div>
        <div className="filtro-group filtro-sm">
          <label>Hasta</label>
          <input
            type="date"
            className="comp-date-input"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
          />
        </div>
        <div className="filtro-group search filtro-sm">
          <label>Buscar concepto / proveedor / #</label>
          <input
            type="text"
            placeholder="Ej: GASOLINA, #175"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div
          className="header-actions"
          style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}
        >
          <button
            className="btn-refresh btn-compacto"
            onClick={() => onCargar(categoriaKey)}
          >
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="egresos-error-bar">
          <span>⚠ {error}</span>
          <button
            onClick={() => {
              setError('');
              onCargar(categoriaKey);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* TABLA */}
      {loading ? (
        <div className="loading">Cargando egresos...</div>
      ) : (
        <div className="table-container">
          <table className="sys-table vista-simple">
            <thead>
              <tr>
                <th># Compra</th>
                <th className="col-fecha">Fecha</th>
                <th>Proveedor</th>
                <th>Concepto</th>
                <th className="col-facturado">Facturado a</th>
                <th className="cell-right">Monto</th>
                <th>Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {egresosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-data">
                    {egresos.length === 0
                      ? 'Sin egresos registrados.'
                      : 'Ningún egreso coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                egresosFiltrados.map(e => (
                  <tr key={e.name}>
                    <td className="cell-code">{e.no_de_compra ? `#${e.no_de_compra}` : '—'}</td>
                    <td className="col-fecha">{e.fecha}</td>
                    <td className="comp-td-proveedor" title={e.proveedor || ''}>
                      {e.proveedor || '—'}
                    </td>
                    <td>
                      {e.concepto || (e.descripcion ? '(ver detalle)' : '—')}
                      {e.subcategoria && <div className="comp-subcat">{e.subcategoria}</div>}
                    </td>
                    <td className="col-facturado">
                      <span
                        className={
                          e.facturado_a && e.facturado_a !== 'SIN FACTURA'
                            ? 'comp-facturado-badge'
                            : 'comp-sinfactura-badge'
                        }
                      >
                        {e.facturado_a || 'SIN FACTURA'}
                      </span>
                      {e.no_factura && <div className="comp-subcat">{e.no_factura}</div>}
                    </td>
                    <td className="cell-right cell-bold">
                      {fmtN(e.monto)}
                      {e.impuesto_tipo && (
                        <div className="comp-subcat">
                          {e.impuesto_tipo} {fmtN(e.monto_impuesto)}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className={'egresos-pago-toggle' + (e.pagado ? ' pagado' : '')}
                        onClick={() => onPagado(e)}
                        title={
                          e.pagado ? 'Pagado — clic para revertir' : 'Marcar como pagado'
                        }
                      >
                        {e.pagado ? '✓ Pagado' : 'Por pagar'}
                      </button>
                    </td>
                    <td className="comp-td-acciones">
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="comp-btn-editar"
                          title="Imprimir ticket"
                          onClick={() => onImprimir(e)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 9V2h12v7" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>
                        {confirmDel === e.name ? (
                          <span className="egresos-confirm-del">
                            ¿Seguro?{' '}
                            <button
                              className="egresos-del-si"
                              onClick={() => onEliminar(e.name)}
                            >
                              Sí
                            </button>
                            <button
                              className="egresos-del-no"
                              onClick={() => setConfirmDel(null)}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            className="comp-btn-eliminar"
                            title="Eliminar"
                            onClick={() => setConfirmDel(e.name)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {egresosFiltrados.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="cell-right">
                    {egresosFiltrados.length} egreso(s)
                  </td>
                  <td className="cell-right cell-bold">{fmtN(totalListado)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};
