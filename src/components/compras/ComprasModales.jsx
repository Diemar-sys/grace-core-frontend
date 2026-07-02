import NuevaCompra from '../NuevaCompra';
import ConfirmModal from '../modals/ConfirmModal';

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ICON_TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const ICON_WARNING = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export default function ComprasModales({
  modal, borradorEditar, handleModalSuccess, handleModalCancel,
  deleteModal, cancelModal, pagoModal,
  consolidarModal, desagruparModal, cancelConsolidadoModal,
  folioConsolidar, setFolioConsolidar,
  facturadoConsolidar, setFacturadoConsolidar,
  detalleModal, setDetalleModal,
}) {
  return (
    <>
      {/* Modal nueva / editar compra */}
      {(modal === 'nueva' || (modal === 'editar' && borradorEditar)) && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalCancel()}>
          <div className="edit-modal-wrapper">
            <NuevaCompra
              initialData={modal === 'editar' ? borradorEditar : undefined}
              onSuccess={handleModalSuccess}
              onCancel={handleModalCancel}
            />
          </div>
        </div>
      )}

      {/* Eliminar borrador */}
      {deleteModal.item && (
        <ConfirmModal
          title="Eliminar borrador"
          description={<>¿Seguro que deseas eliminar la compra <strong>{deleteModal.item}</strong>?</>}
          subdescription="Esta acción es permanente y no se puede deshacer."
          icon={ICON_TRASH}
          confirmLabel="Sí, eliminar"
          loadingLabel="Eliminando..."
          onConfirm={deleteModal.confirm}
          onCancel={deleteModal.close}
          loading={deleteModal.loading}
          error={deleteModal.error}
        />
      )}

      {/* Cancelar compra confirmada */}
      {cancelModal.item && (
        <ConfirmModal
          title={`Cancelar compra ${cancelModal.item?.custom_no_de_compra ? `#${cancelModal.item.custom_no_de_compra}` : cancelModal.item?.name}`}
          description={<>El stock recibido en esta compra será <strong>revertido automáticamente</strong>. La compra quedará en historial como cancelada.</>}
          subdescription="Después podrás registrar una nueva compra con las cantidades correctas."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar compra"
          loadingLabel="Cancelando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Regresar"
          onConfirm={cancelModal.confirm}
          onCancel={cancelModal.close}
          loading={cancelModal.loading}
          error={cancelModal.error}
        />
      )}

      {/* Cancelar grupo consolidado en cascada */}
      {cancelConsolidadoModal.item && (
        <ConfirmModal
          title={`Cancelar grupo ${cancelConsolidadoModal.item.folio || ''}`}
          description={<>Se cancelarán <strong>las {cancelConsolidadoModal.item.notas.length} nota(s)</strong> de este grupo consolidado y se <strong>revertirá el stock de cada una</strong>. Quedarán en historial como canceladas.</>}
          subdescription="La cancelación es en cascada e irreversible."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar todo el grupo"
          loadingLabel="Cancelando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Regresar"
          onConfirm={cancelConsolidadoModal.confirm}
          onCancel={cancelConsolidadoModal.close}
          loading={cancelConsolidadoModal.loading}
          error={cancelConsolidadoModal.error}
        />
      )}

      {/* Marcar pagada / pendiente */}
      {pagoModal.item && (
        <ConfirmModal
          title={pagoModal.item.value ? 'Marcar como PAGADA' : 'Marcar como PENDIENTE'}
          description={pagoModal.item.value
            ? <>¿Confirmas que la compra <strong>{pagoModal.item.compra?.custom_no_de_compra ? `#${pagoModal.item.compra.custom_no_de_compra}` : pagoModal.item.name}</strong> ya fue <strong>pagada</strong> al proveedor?</>
            : <>La compra <strong>{pagoModal.item.compra?.custom_no_de_compra ? `#${pagoModal.item.compra.custom_no_de_compra}` : pagoModal.item.name}</strong> volverá a quedar como <strong>pendiente de pago</strong>.</>}
          icon={ICON_WARNING}
          confirmLabel={pagoModal.item.value ? 'Sí, ya se pagó' : 'Sí, dejar pendiente'}
          loadingLabel="Guardando..."
          confirmStyle={{ background: pagoModal.item.value ? '#16a34a' : '#d97706' }}
          cancelLabel="Cancelar"
          onConfirm={pagoModal.confirm}
          onCancel={pagoModal.close}
          loading={pagoModal.loading}
          error={pagoModal.error}
        />
      )}

      {/* Consolidar (bloquea + imprime) */}
      {consolidarModal.item && (
        <ConfirmModal
          title="Agrupar e imprimir"
          description={<>
            Se agruparán <strong>{consolidarModal.item.length} nota(s)</strong> de <strong>{consolidarModal.item[0]?.supplier_name || consolidarModal.item[0]?.supplier}</strong> (${fmt(consolidarModal.item.reduce((s, c) => s + parseFloat(c.grand_total || 0), 0))}) bajo un mismo No. de Factura:
            <input type="text" autoFocus className="comp-date-input" style={{ display: 'block', width: '100%', marginTop: 10 }}
              placeholder="No. de Factura (ej: FAC-001)"
              value={folioConsolidar} onChange={e => setFolioConsolidar(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && folioConsolidar.trim() && !consolidarModal.loading) consolidarModal.confirm(); }} />
            <label style={{ display: 'block', marginTop: 10, fontSize: 13 }}>Facturado a:</label>
            <select className="comp-date-input" style={{ display: 'block', width: '100%', marginTop: 4 }}
              value={facturadoConsolidar} onChange={e => setFacturadoConsolidar(e.target.value)}>
              <option value="SIN FACTURA">SIN FACTURA</option>
              <option value="ALMA RODRIGUEZ">ALMA RODRIGUEZ</option>
              <option value="LUIS TORRES">LUIS TORRES</option>
            </select>
          </>}
          subdescription="El folio se asigna a todas. Las notas quedarán BLOQUEADAS para no re-mezclarlas. Solo un Gerente puede desagrupar."
          icon={ICON_WARNING}
          confirmLabel="Consolidar e imprimir"
          loadingLabel="Consolidando..."
          confirmStyle={{ background: '#16a34a' }}
          cancelLabel="Cancelar"
          onConfirm={consolidarModal.confirm}
          onCancel={consolidarModal.close}
          loading={consolidarModal.loading}
          error={consolidarModal.error}
        />
      )}

      {/* Desagrupar (solo Gerente) */}
      {desagruparModal.item && (
        <ConfirmModal
          title="Desagrupar compra"
          description={<>La compra <strong>{desagruparModal.item}</strong> se desbloqueará y podrá volver a consolidarse.</>}
          subdescription="Solo un Gerente puede hacerlo (se valida en el servidor)."
          icon={ICON_WARNING}
          confirmLabel="Sí, desagrupar"
          loadingLabel="Desagrupando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Cancelar"
          onConfirm={desagruparModal.confirm}
          onCancel={desagruparModal.close}
          loading={desagruparModal.loading}
          error={desagruparModal.error}
        />
      )}

      {/* Detalle de compra (click en fila) */}
      {detalleModal && (
        <div className="comp-detalle-overlay" onClick={() => setDetalleModal(null)}>
          <div className="comp-detalle-modal" onClick={e => e.stopPropagation()}>
            {detalleModal.loading ? (
              <p style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</p>
            ) : (
              <>
                <div className="comp-detalle-header">
                  <div>
                    <span className="comp-detalle-num">#{detalleModal.compra.custom_no_de_compra || '—'}</span>
                    <span className="comp-detalle-proveedor">{detalleModal.compra.supplier_name}</span>
                    <span className="comp-detalle-fecha">{detalleModal.compra.posting_date}</span>
                  </div>
                  <button className="comp-detalle-close" onClick={() => setDetalleModal(null)}>✕</button>
                </div>
                <div className="comp-detalle-scroll">
                  <table className="comp-detalle-tabla sys-table">
                    <thead>
                      <tr><th>PRODUCTO</th><th>CANTIDAD</th><th>MEDIDA</th><th className="cell-right">PRECIO UNIT.</th><th className="cell-right">SUBTOTAL</th></tr>
                    </thead>
                    <tbody>
                      {detalleModal.compra.items?.map(it => (
                        <tr key={it.name}>
                          <td><div>{it.item_name}</div><small style={{ color: '#888', fontFamily: 'monospace' }}>{it.item_code}</small></td>
                          <td>{it.qty} {it.uom}</td>
                          <td style={{ color: '#aaa' }}>{it.stock_qty} {it.stock_uom}</td>
                          <td className="cell-right">${fmt(it.rate)}</td>
                          <td className="cell-right cell-bold">${fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="comp-detalle-footer">
                  <span>{detalleModal.compra.items?.length || 0} producto(s)</span>
                  <span>SUBTOTAL <strong>${fmt(detalleModal.compra.total)}</strong>&nbsp;&nbsp;TOTAL <strong className="comp-detalle-total">${fmt(detalleModal.compra.grand_total)}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
