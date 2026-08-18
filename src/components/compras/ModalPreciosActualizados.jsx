import ConfirmModal from '../modals/ConfirmModal';
// La tabla Antes/Hoy es la misma del aviso de recosteo antes de producir, y se
// importa en vez de copiarse: son el mismo mensaje ("esto cambió de precio")
// y deben verse igual. Hoy el bundle es único y la clase estaría global de
// todos modos, pero eso deja de ser cierto en cuanto haya code-splitting.
import '../../styles/Produccion.css';

/**
 * Avisa qué precios movió la compra en el Catálogo. NO pregunta: la regla es
 * «si se pagó $400, el catálogo dice $400», así que para cuando esto se pinta el
 * backend ya escribió (hook `on_submit` de Purchase Receipt). Un solo botón,
 * porque no hay decisión que tomar.
 *
 * Antes era ModalSugerenciaPrecios: checkboxes y un botón "Omitir, no
 * actualizar". Omitir dejaba el catálogo mintiendo sobre lo que costó el
 * insumo — así es como 39 insumos acabaron costeándose por debajo de su costo
 * real (2026-08-17).
 *
 * El «antes» viene de consultar el catálogo justo antes de confirmar, no de lo
 * que la fila traía cargado: si el precio se capturó por un camino que no llenó
 * `precio_catalogo`, el modal no salía nunca y el cambio pasaba mudo.
 *
 * @param cambios - [{item_code, item_name, antes, ahora}] ya filtrados y con el
 *                  precio anterior real que traía el catálogo.
 */
function ModalPreciosActualizados({ cambios, onCerrar }) {
  const totalAntes = cambios.reduce((s, c) => s + c.antes, 0);
  const totalAhora = cambios.reduce((s, c) => s + c.ahora, 0);

  return (
    <ConfirmModal
      title="Los precios cambiaron"
      description={
        <>
          {cambios.length === 1 ? 'Este insumo se compró' : `Estos ${cambios.length} insumos se compraron`}
          {' '}a un precio distinto al del Catálogo. <strong>El Catálogo ya quedó al precio que se pagó.</strong>
          <table className="prod-recosteo-tabla">
            <thead>
              <tr><th>Insumo</th><th>Antes</th><th>Ahora</th></tr>
            </thead>
            <tbody>
              {cambios.map(c => (
                <tr key={c.item_code}>
                  <td>{c.item_name}</td>
                  <td className="prod-recosteo-antes">${c.antes.toFixed(2)}</td>
                  <td className="prod-recosteo-hoy">${c.ahora.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {cambios.length > 1 && (
              <tfoot>
                <tr>
                  <th>Total</th>
                  <td className="prod-recosteo-antes">${totalAntes.toFixed(2)}</td>
                  <td className="prod-recosteo-hoy">${totalAhora.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </>
      }
      subdescription="El costo de las recetas que usan estos insumos se recalcula al producir."
      confirmLabel="Entendido"
      hideCancel
      onConfirm={onCerrar}
      onCancel={onCerrar}
    />
  );
}

export default ModalPreciosActualizados;
