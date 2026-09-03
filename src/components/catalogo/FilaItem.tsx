// src/components/catalogo/FilaItem.tsx
import React from 'react';
import { InsumoItem, CostoBOM } from './catalogoTypes';
import { fmtUom } from '../../utils/uom';
import { numero } from '../../utils/formato';

interface FilaItemProps {
  item: InsumoItem;
  vista: string;
  onEdit: (code: string) => void;
  editLoading: boolean;
  onDelete: (item: InsumoItem) => void;
  onDisable: (item: InsumoItem) => void;
  onEnable: (item: InsumoItem) => void;
  soloLectura: boolean;
  accionActiva?: string;
  costoBOM?: CostoBOM;
}

function fmtStock(item: InsumoItem) {
  const actual = parseFloat(String(item.actual_qty || 0)) || 0;
  const cantPres = parseFloat(String(item.custom_cantidad_por_presentación || 0)) || 0;
  const presentacion = item.custom_presentación || '';
  const uom = fmtUom(item.stock_uom || '');

  const totalStr = `${actual.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${uom}`;
  const paqStr =
    cantPres > 0 && presentacion
      ? `${(actual / cantPres).toLocaleString('es-MX', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} ${presentacion}`
      : null;
  return { actual, totalStr, paqStr };
}

export const FilaItem: React.FC<FilaItemProps> = ({
  item,
  vista,
  onEdit,
  editLoading,
  onDelete,
  onDisable,
  onEnable,
  soloLectura,
  accionActiva,
  costoBOM,
}) => {
  const BtnAcciones = () =>
    soloLectura ? null : (
      <td className="col-actions">
        {accionActiva === 'editar' && (
          <button
            className="btn-edit-row"
            onClick={() => onEdit(item.item_code)}
            disabled={editLoading}
            title="Editar insumo"
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
        )}
        {(accionActiva === 'eliminar' || accionActiva === 'deshabilitar') && (
          <button
            className="btn-delete-row"
            onClick={() => {
              if (accionActiva === 'eliminar') onDelete(item);
              else if (vista === 'deshabilitado') onEnable(item);
              else onDisable(item);
            }}
            title={
              accionActiva === 'eliminar'
                ? 'Eliminar insumo'
                : vista === 'deshabilitado'
                ? 'Restaurar insumo'
                : 'Deshabilitar insumo'
            }
          >
            {accionActiva === 'eliminar' ? (
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
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            ) : vista === 'deshabilitado' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
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
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            )}
          </button>
        )}
      </td>
    );

  if (vista === 'registrado' || vista === 'deshabilitado') {
    const { actual, totalStr, paqStr } = fmtStock(item);
    const esPT = item.custom_tipo_item === 'PRODUCTO TERMINADO';
    const costoCell = esPT ? (
      costoBOM ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 600 }}>${numero(costoBOM.costoPorUnidad, 2)}</span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {`${costoBOM.cantidadProducida} ${costoBOM.uom} → $${numero(costoBOM.costoTotal, 2)}`}
          </span>
        </div>
      ) : (
        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>sin receta</span>
      )
    ) : (
      '—'
    );
    const cantPres = parseFloat(String(item.custom_cantidad_por_presentación || 0)) || 0;
    const presentacion = item.custom_presentación || '';
    const uomStr = fmtUom(item.stock_uom || '');
    const cantPresStr =
      cantPres > 0
        ? `${cantPres} ${uomStr}${presentacion ? ` / ${presentacion}` : ''}`
        : '—';
    return (
      <tr>
        <td className="cell-code">{item.item_code || '—'}</td>
        <td>{item.custom_código_interno || '—'}</td>
        <td className="cell-name">{item.item_name}</td>
        <td>{cantPresStr}</td>
        <td>
          {item.custom_total_presentacion
            ? `$${numero(parseFloat(String(item.custom_total_presentacion)), 2)}`
            : '—'}
        </td>
        <td>
          {item.custom_precio_final
            ? `$${numero(parseFloat(String(item.custom_precio_final)), 2)}`
            : '—'}
        </td>
        <td>{costoCell}</td>
        <td className="cell-qty">
          {actual > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 600 }}>{totalStr}</span>
              {paqStr && <span style={{ fontSize: '14px', color: '#6b7280' }}>{paqStr}</span>}
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: 500 }}>
              Sin stock
            </span>
          )}
        </td>
        <BtnAcciones />
      </tr>
    );
  }
  return null;
};
