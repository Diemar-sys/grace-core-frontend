import React from 'react';
import { deptColor, fmt } from './posUtils';
import '../../styles/pos/POSCatalogo.css';

function POSCatalogo({
  productosFiltrados,
  todosProductos,
  departamentos,
  busqueda,
  setBusqueda,
  departamento,
  setDepartamento,
  loadingProds,
  cargarProductos,
  agregarProducto,
}) {
  return (
    <div className="pos-left">
      <div className="pos-toolbar">
        <input
          id="pos-busqueda"
          type="search"
          className="pos-search-input"
          placeholder="Buscar producto por nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          autoFocus
        />
        <select
          className="pos-dept-select"
          value={departamento}
          onChange={e => setDepartamento(e.target.value)}
        >
          <option value="">Todos los depts.</option>
          {departamentos.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button
          className="pos-historial-btn"
          onClick={cargarProductos}
          title="Recargar catálogo de productos"
          disabled={loadingProds}
        >
          🔄
        </button>
      </div>

      <div className="pos-products-grid">
        {loadingProds ? (
          <div className="pos-empty-products">
            <span>⏳</span>
            <p>Cargando productos...</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="pos-empty-products">
            <span>🔍</span>
            <p>
              {todosProductos.length === 0
                ? 'No hay productos terminados registrados.'
                : 'Sin resultados para tu búsqueda.'}
            </p>
          </div>
        ) : (
          productosFiltrados.map(prod => {
            const color = deptColor(prod.custom_departamento || '');
            const precio = parseFloat(prod.custom_precio_de_venta) || 0;
            return (
              <div
                key={prod.item_code}
                id={`prod-${prod.item_code}`}
                className="pos-product-card"
                onClick={() => agregarProducto(prod)}
                style={{ borderTop: `3px solid ${color}` }}
                title={`Agregar ${prod.item_name} al ticket`}
              >
                <span className="pos-card-dept" style={{ color }}>
                  {prod.custom_departamento || '—'}
                </span>
                <span className="pos-card-name">{prod.item_name}</span>
                <span className="pos-card-price">{fmt(precio)}</span>
                <span className="pos-card-uom">por {prod.stock_uom || 'PZA'}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default React.memo(POSCatalogo);
