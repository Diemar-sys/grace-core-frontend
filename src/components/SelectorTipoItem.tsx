import { TIPOS_ITEM } from '../config/constants';

interface Props {
  value: string;
  onChange: (tipo: string) => void;
  /** Namespace CSS de la pantalla: `nc-input` en conteo físico y envíos; vacío
   *  en los registros de movimiento, donde `.rm-section select` ya lo estiliza. */
  className?: string;
  label?: string;
  id?: string;
}

/**
 * Filtro por tipo de item para los buscadores de producto.
 *
 * Presentacional puro: el estado y el momento de recargar los decide la
 * pantalla. Existe porque el buscador ofrecía los 227 panes del catálogo en
 * pantallas de materia prima — el conteo físico pintaba 487 renglones, 227 de
 * ellos pan, con el ajuste de inventario a un clic.
 *
 * El filtro real lo aplica el servidor (`custom_tipo_item` en el WHERE), no un
 * `.filter()` aquí: traer 487 para tirar 227 es trabajo pagado dos veces.
 */
export default function SelectorTipoItem({
  value,
  onChange,
  className = '',
  label = 'Tipo de producto',
  id,
}: Props) {
  return (
    <>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={className}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label || 'Filtrar por tipo de producto'}
      >
        {TIPOS_ITEM.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </>
  );
}
