// src/pages/ConsultasInventario.jsx
// Historial de movimientos de MP (entradas, salidas, mermas, producción).
// Accesible desde Panel → Consultas → Inventario / Movimientos.
import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import HistorialMovimientos from '../components/HistorialMovimientos';
import { stockService } from '../services/frappeStock';
import '../styles/global.css';

function ConsultasInventario() {
  const [almacenes, setAlmacenes] = useState([]);

  useEffect(() => {
    let cancel = false;
    stockService.fetchAllWarehousesInclusive()
      .then(list => { if (!cancel) setAlmacenes(list); })
      .catch(err => console.error('Almacenes ConsultasInventario:', err));
    return () => { cancel = true; };
  }, []);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                Historial de Movimientos
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginLeft: 10 }}>
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
                </svg>
              </h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Entradas, salidas, mermas y producción por almacén
              </span>
            </div>
          </div>
        </div>

        {almacenes.length > 0
          ? <HistorialMovimientos almacenes={almacenes} />
          : <div className="loading">Cargando almacenes...</div>
        }
      </div>
    </Layout>
  );
}

export default ConsultasInventario;
