// src/components/catalogo/VistaPan.tsx
import React from 'react';
import { PanItem, CostoBOM } from './catalogoTypes';
import { calcularMargen, categoriasDePanes, filtrarPanes } from '../../utils/catalogoUtils';

const COLUMNAS_PAN = [
  'Código',
  'Producto',
  'Categoría',
  'Sucursal',
  'Pueblos',
  'Camioneta',
  'Costo',
  'Margen',
  'Acciones',
];

const APAGADO: React.CSSProperties = { color: '#9ca3af', fontStyle: 'italic' };

function fmtPrecio(v: number | string | undefined | null): string | null {
  const n = parseFloat(String(v || 0)) || 0;
  return n > 0 ? `$${n.toFixed(2)}` : null;
}

interface CeldaCostoProps {
  costoBOM?: CostoBOM;
  manual: number;
  costeado: boolean;
}

function CeldaCostoPan({ costoBOM, manual, costeado }: CeldaCostoProps) {
  if (costoBOM) {
    return (
      <span
        style={{ fontWeight: 600 }}
        title={`Receta: ${costoBOM.cantidadProducida} ${costoBOM.uom} → $${costoBOM.costoTotal.toFixed(
          2
        )}`}
      >
        ${costoBOM.costoPorUnidad.toFixed(2)}
      </span>
    );
  }
  if (manual > 0) {
    return (
      <span title="Capturado a mano, sin receta que lo respalde">
        ${manual.toFixed(2)}{' '}
        <span style={{ ...APAGADO, fontSize: 12 }}>a mano</span>
      </span>
    );
  }
  if (!costeado) {
    return (
      <span
        style={APAGADO}
        title="Filtra por categoría para calcular el costo de la receta"
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{ color: '#d97706', fontWeight: 500 }}
      title="Sin receta ni costo capturado no se calcula el margen, y la entrada de pan lo pide cada vez"
    >
      falta costo
    </span>
  );
}

function CeldaMargenPan({
  margen,
}: {
  margen: { bajoCosto: boolean; pesos: number; pct: number } | null;
}) {
  if (!margen) return <span style={APAGADO}>—</span>;
  const color = margen.bajoCosto ? '#dc2626' : '#059669';
  return (
    <span
      style={{ color, fontWeight: 600 }}
      title={
        margen.bajoCosto
          ? 'Se vende por DEBAJO de lo que cuesta producirlo'
          : `Deja $${margen.pesos.toFixed(2)} por pieza`
      }
    >
      {margen.bajoCosto && '⚠ '}${margen.pesos.toFixed(2)}
      <span style={{ ...APAGADO, fontSize: 12, marginLeft: 4 }}>
        {margen.pct.toFixed(0)}%
      </span>
    </span>
  );
}

interface FilaPanProps {
  pan: PanItem;
  soloLectura: boolean;
  onEdit: (code: string) => void;
  editLoading: boolean;
  costoBOM?: CostoBOM;
  costeado: boolean;
}

function FilaPan({
  pan,
  soloLectura,
  onEdit,
  editLoading,
  costoBOM,
  costeado,
}: FilaPanProps) {
  const sucursal = fmtPrecio(pan.custom_precio_de_venta);
  const pueblos = fmtPrecio(pan.custom_precio_de_venta_pueblos);
  const camioneta = fmtPrecio(pan.custom_precio_de_venta_camioneta);
  const manual = parseFloat(String(pan.custom_costo_estimado || 0)) || 0;
  const margen = calcularMargen(
    pan.custom_precio_de_venta,
    costoBOM?.costoPorUnidad || manual
  );

  return (
    <tr>
      <td className="cell-code">{pan.item_code || '—'}</td>
      <td className="cell-name">{pan.item_name}</td>
      <td>{pan.item_group || '—'}</td>
      <td>
        {sucursal || (
          <span style={{ color: '#ef4444', fontWeight: 500 }}>sin precio</span>
        )}
      </td>
      <td>
        {pueblos || (
          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>hereda</span>
        )}
      </td>
      <td>
        {camioneta || (
          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>hereda</span>
        )}
      </td>
      <td>
        <CeldaCostoPan costoBOM={costoBOM} manual={manual} costeado={costeado} />
      </td>
      <td>
        <CeldaMargenPan margen={margen} />
      </td>
      {!soloLectura && (
        <td className="col-actions">
          <button
            className="btn-edit-row"
            onClick={() => onEdit(pan.item_code)}
            disabled={editLoading}
            title="Editar pan"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
}

interface VistaPanProps {
  panes: PanItem[];
  loading: boolean;
  soloLectura: boolean;
  onNuevo: () => void;
  onEdit: (code: string) => void;
  editLoading: boolean;
  onRefrescar: () => void;
  grupo: string;
  setGrupo: (v: string) => void;
  busca: string;
  setBusca: (v: string) => void;
  costosPan?: Record<string, CostoBOM>;
  costeado?: boolean;
}

export const VistaPan: React.FC<VistaPanProps> = ({
  panes,
  loading,
  soloLectura,
  onNuevo,
  onEdit,
  editLoading,
  onRefrescar,
  grupo,
  setGrupo,
  busca,
  setBusca,
  costosPan = {},
  costeado = false,
}) => {
  const categorias = categoriasDePanes(panes);
  const visibles = filtrarPanes(panes, grupo, busca);
  const filtrando = Boolean(grupo || busca.trim());

  return (
    <div className="pan-vista">
      {!loading && (
        <div className="filtros-section">
          {panes.length > 0 && (
            <>
              <div className="filtro-group filtro-sm">
                <label htmlFor="pan-filtro-cat">Categoría</label>
                <select
                  id="pan-filtro-cat"
                  value={grupo}
                  onChange={e => setGrupo(e.target.value)}
                >
                  <option value="">Todas las categorías ({panes.length})</option>
                  {categorias.map(([nombre, n]) => (
                    <option key={nombre} value={nombre}>
                      {nombre} ({n})
                    </option>
                  ))}
                </select>
              </div>
              <div className="filtro-group search filtro-sm">
                <label htmlFor="pan-filtro-busca">Buscar</label>
                <input
                  id="pan-filtro-busca"
                  type="text"
                  placeholder="Nombre o clave del pan..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
            </>
          )}

          <div
            className="header-actions"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
            }}
          >
            {filtrando && (
              <button
                type="button"
                className="btn-refresh btn-compacto"
                onClick={() => {
                  setGrupo('');
                  setBusca('');
                }}
              >
                Limpiar ({visibles.length} de {panes.length})
              </button>
            )}
            <button className="btn-refresh btn-compacto" onClick={onRefrescar}>
              Actualizar
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
                style={{ marginLeft: '8px', verticalAlign: 'middle' }}
              >
                <path d="m17 2 4 4-4 4" />
                <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                <path d="m7 22-4-4 4-4" />
                <path d="M21 13v1a4 4 0 0 1-4 4H3" />
              </svg>
            </button>
            {!soloLectura && (
              <button
                type="button"
                className="pan-vista-nuevo"
                onClick={onNuevo}
              >
                + Registrar pan
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando pan…</div>
      ) : panes.length === 0 ? (
        <div className="pan-vacio">
          <strong>Todavía no hay pan registrado</strong>
          <span>
            Da de alta el primero para que la caja pueda cobrarlo y el reporte de
            ventas lo separe por departamento.
          </span>
        </div>
      ) : (
        <div className="table-container">
          <table className="sys-table">
            <thead>
              <tr>
                {COLUMNAS_PAN.filter(c => !soloLectura || c !== 'Acciones').map(
                  col => (
                    <th key={col}>{col}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS_PAN.length} className="no-data">
                    Ningún pan coincide con el filtro
                    {grupo && ` · categoría ${grupo}`}
                    {busca.trim() && ` · búsqueda «${busca.trim()}»`}
                  </td>
                </tr>
              ) : (
                visibles.map(pan => (
                  <FilaPan
                    key={pan.item_code}
                    pan={pan}
                    soloLectura={soloLectura}
                    onEdit={onEdit}
                    editLoading={editLoading}
                    costoBOM={costosPan[pan.item_code]}
                    costeado={costeado}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
