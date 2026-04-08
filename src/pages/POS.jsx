// src/pages/POS.jsx
import React from 'react';
import Layout from '../components/Layout';

/**
 * Vista del Punto de Venta (POS).
 * Actualmente en desarrollo. Funciona como un placeholder para futuras integraciones.
 * @returns {JSX.Element} Vista de "Próximamente" para el POS.
 */
function POS() {
  return (
    <Layout>
      <div className="proveedores-container">
        <div className="page-header">
          <h1>💰 Punto de Venta</h1>
          <button className="btn-primary">
            <span>🖨️</span> Cerrar Caja
          </button>
        </div>

        <div className="coming-soon-card">
          <div className="icon">🚧</div>
          <h2>Módulo en Desarrollo</h2>
          <p>Pronto podrás:</p>
          <ul>
            <li>🛒 Realizar ventas rápidas</li>
            <li>🧾 Generar tickets</li>
            <li>💳 Aceptar diferentes métodos de pago</li>
            <li>📈 Ver ventas del día</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

export default POS;