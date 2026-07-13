import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import TablaCuentasPorCobrar from '../components/TablaCuentasPorCobrar';
import '../styles/global.css';

function ReporteCuentasPorCobrar() {
  const navigate = useNavigate();
  const tablaRef = useRef(null);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group">
            <div>
              <h1 style={{ margin: 0 }}>Cuentas por Cobrar</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Saldo de ventas B2B por cliente (pendiente vs cobrado)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-refresh" onClick={() => tablaRef.current?.recargar()}>Actualizar</button>
            <button className="btn-refresh" onClick={() => navigate('/panel?seccion=reportes')}>← Volver</button>
          </div>
        </div>

        <TablaCuentasPorCobrar ref={tablaRef} readOnly />
      </div>
    </Layout>
  );
}

export default ReporteCuentasPorCobrar;
