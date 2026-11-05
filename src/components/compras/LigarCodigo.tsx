import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { comprasService } from '../../services/frappePurchase';
import { parseErrorFrappe } from '../../utils/errorFrappe';
import { fmtUom } from '../../utils/uom';
import { cantidad } from '../../utils/formato';

type ItemCompra = {
  item_code: string;
  item_name: string;
  stock_uom?: string;
  custom_presentación?: string;
  custom_cantidad_por_presentación?: number | string;
  [k: string]: unknown;
};

/** «BULTO de 50 Kg» / «por Kg». Es lo que se confirma contra la bolsa en la mano. */
export const presentacionDe = (item: ItemCompra): string => {
  const uom = fmtUom(item.stock_uom || 'unid');
  const factor = Number(item.custom_cantidad_por_presentación) || 0;
  if (item.custom_presentación && factor > 0 && factor !== 1) {
    return `${item.custom_presentación} de ${cantidad(factor)} ${uom}`;
  }
  return `por ${uom}`;
};

type Props = {
  codigo: string;
  /** El código ya es de otro producto: se agrega una VARIANTE (otro color), no un producto suelto. */
  compartido?: boolean;
  onLigado: (item: ItemCompra) => void;
  onCrear: () => void;
  onCancelar: () => void;
};

/**
 * Código escaneado que no está en el catálogo. Dos salidas: NO existe → alta
 * con ese código como clave; SÍ existe con otra clave (las inventadas
 * `75000000…`) → ligarlo. Ligar pide elegir por nombre y CONFIRMAR la
 * presentación. 🔴 El nombre no dice el tamaño (la morena «500G» traía 1 Kg):
 * si la bolsa es de otro tamaño, es otro producto y no se liga.
 */
function LigarCodigo({ codigo, compartido = false, onLigado, onCrear, onCancelar }: Props) {
  const [modo, setModo] = useState<'elegir' | 'ligar'>('elegir');
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ItemCompra[]>([]);
  const [buscado, setBuscado] = useState('');  // lo que YA contestó el servidor: sin esto «Sin resultados» parpadea al teclear
  const [elegido, setElegido] = useState<ItemCompra | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const buscar = (valor: string) => {
    setTexto(valor);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setResultados(valor.trim().length >= 3 ? await comprasService.buscarItems(valor) : []);
      setBuscado(valor);
    }, 400);
  };

  const ligar = async () => {
    if (!elegido) return;
    setGuardando(true);
    setError('');
    try {
      await comprasService.ligarCodigo(elegido.item_code, codigo);
      onLigado(elegido);
    } catch (e) {
      setError(parseErrorFrappe(e).message);
      setGuardando(false);
    }
  };

  const cerrarConEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onCancelar(); };

  const encabezado = (
    <div className="nc-ligar-cabeza">
      <span className="nc-ligar-etiqueta">{compartido ? 'Otra variante de este código' : 'Código no registrado'}</span>
      <span className="nc-ligar-codigo">{codigo}</span>
      <button type="button" className="nc-ligar-cerrar" aria-label="Cerrar" onClick={onCancelar} disabled={guardando}>×</button>
    </div>
  );

  if (elegido) {
    return (
      <div className="nc-ligar" role="dialog" aria-label="Confirmar presentación" onKeyDown={cerrarConEsc}>
        {encabezado}
        <p className="nc-ligar-pregunta">¿La bolsa que tienes en la mano es…</p>
        <div className="nc-ligar-elegido">
          <span className="nc-ligar-nombre">{elegido.item_name}</span>
          <span className="nc-ligar-pres nc-ligar-pres--fuerte">{presentacionDe(elegido)}</span>
        </div>
        <p className="nc-ligar-nota">Si es de otro tamaño, NO la ligues: es otro producto y se da de alta aparte.</p>
        {error && <p className="nc-ligar-error" role="alert">{error}</p>}
        <div className="nc-ligar-botones">
          <button type="button" className="nc-ligar-no" onClick={() => { setElegido(null); setError(''); }} disabled={guardando}>
            No, es otro tamaño
          </button>
          <button type="button" className="nc-ligar-si" onClick={ligar} disabled={guardando} autoFocus>
            {guardando ? 'Ligando…' : 'Sí, ligar'}
          </button>
        </div>
      </div>
    );
  }

  if (modo === 'elegir') {
    return (
      <div className="nc-ligar" onKeyDown={cerrarConEsc}>
        {encabezado}
        <div className="nc-ligar-opciones">
          <button type="button" className="nc-ligar-opcion" onClick={() => setModo('ligar')} autoFocus>
            <span className="nc-ligar-opcion-titulo">Ya existe: ligarlo</span>
            <span className="nc-ligar-opcion-desc">
              {compartido
                ? 'La variante (otro color) ya está en el catálogo. La buscas y le agregas este código.'
                : 'Está en el catálogo con otra clave. Lo buscas y le agregas este código.'}
            </span>
          </button>
          <button type="button" className="nc-ligar-opcion" onClick={onCrear}>
            <span className="nc-ligar-opcion-titulo">Es nuevo: crear producto</span>
            <span className="nc-ligar-opcion-desc">
              {compartido
                ? 'La variante no está en el catálogo. Se da de alta y se le liga este código.'
                : 'No está en el catálogo. Se da de alta con este código como clave.'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nc-ligar" onKeyDown={cerrarConEsc}>
      {encabezado}
      <button type="button" className="nc-ligar-volver" onClick={() => setModo('elegir')}>‹ Volver</button>
      <input className="nc-ligar-buscar" type="text" autoFocus value={texto}
        aria-label="Buscar producto para ligar"
        placeholder="¿Qué producto es? Busca por nombre…" onChange={e => buscar(e.target.value)} />
      {resultados.length > 0 && (
        <ul className="nc-ligar-lista">
          {resultados.map(item => (
            <li key={item.item_code}>
              <button type="button" onClick={() => setElegido(item)}>
                <span className="nc-ligar-nombre">{item.item_name}</span>
                <span className="nc-ligar-pres">{presentacionDe(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {buscado === texto && texto.trim().length >= 3 && resultados.length === 0 && (
        <p className="nc-ligar-nota">Sin resultados. Prueba con otra palabra.</p>
      )}
    </div>
  );
}

type PropsVariante = {
  codigo: string;
  items: ItemCompra[];
  onElegir: (item: ItemCompra) => void;
  onOtra: () => void;
  onCancelar: () => void;
};

/**
 * Un código, varios productos (Mi Alegría: azul y rosa del mismo número).
 * Se pregunta SIEMPRE: elegir el primero metería el color equivocado al
 * inventario. Sin atajos numéricos a propósito: el escáner TECLEA dígitos y
 * el «1» de la siguiente bolsa elegiría una variante sin que nadie lo vea.
 */
export function ElegirVariante({ codigo, items, onElegir, onOtra, onCancelar }: PropsVariante) {
  const teclas = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
  return (
    <div className="nc-ligar" role="dialog" aria-label="Elegir variante" onKeyDown={teclas}>
      <div className="nc-ligar-cabeza">
        <span className="nc-ligar-etiqueta">¿Cuál es?</span>
        <span className="nc-ligar-codigo">{codigo}</span>
        <button type="button" className="nc-ligar-cerrar" aria-label="Cerrar" onClick={onCancelar}>×</button>
      </div>
      <ul className="nc-ligar-lista">
        {items.map((item, i) => (
          <li key={item.item_code}>
            <button type="button" onClick={() => onElegir(item)} autoFocus={i === 0}>
              <span className="nc-ligar-nombre">{item.item_name}</span>
              <span className="nc-ligar-pres">{presentacionDe(item)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="nc-ligar-volver" onClick={onOtra}>Ninguno: es otra variante</button>
    </div>
  );
}

export default LigarCodigo;
