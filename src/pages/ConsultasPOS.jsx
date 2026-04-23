import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import POSHistorial from '../components/pos/POSHistorial';
import POSModalCorte from '../components/pos/POSModalCorte';
import { posService } from '../services/frappePOS';
import { auth } from '../services/frappeAuth';
import { generarHTMLCorte } from '../utils/print/corteTemplate';
import { imprimirHTML } from '../utils/print/printUtils';
import { imprimirCorteTermico } from '../services/printService';
import '../styles/global.css';
import '../styles/Panel.css';
import '../styles/pos/POSModals.css';

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

const IconHistorial = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const SUB_OPCIONES = [
  { key: 'historial', nombre: 'Historial de Ventas', sub: 'Consulta de ventas por fecha', icon: <IconHistorial />, color: '#bf360c', bg: '#fbe9e7' },
];

function LandingConsultasPOS({ onSeleccionar }) {
  return (
    <div className="panel-body" style={{ paddingTop: 40 }}>
      <div className="panel-greeting">
        <h2>Consultas — Punto de Venta</h2>
        <p>Selecciona una opción</p>
      </div>
      <div className="panel-grid" style={{ maxWidth: 600 }}>
        {SUB_OPCIONES.map(op => (
          <button
            key={op.key}
            className="panel-module"
            style={{ "--mod-color": op.color, "--mod-bg": op.bg, border: 'none', cursor: 'pointer' }}
            onClick={() => onSeleccionar(op.key)}
          >
            <div className="panel-module-icon">{op.icon}</div>
            <span className="panel-module-name">{op.nombre}</span>
            <span className="panel-module-sub">{op.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConsultasPOS() {
  const [vista,          setVista]          = useState(null);
  const [ventasHoy,      setVentasHoy]      = useState([]);
  const [loadingHist,    setLoadingHist]    = useState(false);
  const [rangoInicio,    setRangoInicio]    = useState(hoyISO);
  const [rangoFin,       setRangoFin]       = useState(hoyISO);
  const [datosReporte,   setDatosReporte]   = useState(null);
  const [loadingReporte, setLoadingReporte] = useState(false);

  const [modalCorte,   setModalCorte]   = useState(false);
  const [datosCorte,   setDatosCorte]   = useState(null);
  const [loadingCorte, setLoadingCorte] = useState(false);
  const [errorCorte,   setErrorCorte]   = useState('');

  const navigate = useNavigate();
  const puedeCancel = auth.getUser()?.role === 'admin';

  useEffect(() => {
    if (vista !== 'historial') return;
    setLoadingHist(true);
    posService.getVentasDelDia(rangoInicio, rangoFin)
      .then(setVentasHoy)
      .catch(console.error)
      .finally(() => setLoadingHist(false));
  }, [vista, rangoInicio, rangoFin]);

  useEffect(() => {
    if (vista !== 'historial') return;
    setLoadingReporte(true);
    setDatosReporte(null);
    const t = setTimeout(() => {
      posService.getReporteVentas(rangoInicio, rangoFin)
        .then(setDatosReporte)
        .catch(console.error)
        .finally(() => setLoadingReporte(false));
    }, 400);
    return () => clearTimeout(t);
  }, [vista, rangoInicio, rangoFin]);

  const setHoy = useCallback(() => {
    const h = hoyISO();
    setRangoInicio(h); setRangoFin(h);
  }, []);

  const setEstaSemana = useCallback(() => {
    const d = new Date();
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    setRangoInicio(lunes.toISOString().split('T')[0]);
    setRangoFin(d.toISOString().split('T')[0]);
  }, []);

  const setEsteMes = useCallback(() => {
    const d = new Date();
    const primero = new Date(d.getFullYear(), d.getMonth(), 1);
    setRangoInicio(primero.toISOString().split('T')[0]);
    setRangoFin(d.toISOString().split('T')[0]);
  }, []);

  const cancelarVenta = useCallback(async (name) => {
    if (!window.confirm(`¿Cancelar la venta ${name}?`)) return;
    try {
      await posService.cancelarVenta(name);
      setVentasHoy(prev => prev.map(v =>
        v.name === name ? { ...v, docstatus: 2, status: 'Cancelled' } : v
      ));
    } catch (err) {
      alert(`Error al cancelar: ${err.message}`);
    }
  }, []);

  const abrirCorte = useCallback(async () => {
    setModalCorte(true);
    setErrorCorte('');
    setDatosCorte(null);
    setLoadingCorte(true);
    try {
      const data = await posService.getCorteCaja(rangoInicio, rangoFin);
      setDatosCorte(data);
    } catch (err) {
      setErrorCorte(err.message || 'Error al generar el corte');
    } finally {
      setLoadingCorte(false);
    }
  }, [rangoInicio, rangoFin]);

  const imprimirCorte = useCallback(async () => {
    if (!datosCorte) return;
    try {
      await imprimirCorteTermico({
        rango_inicio:      rangoInicio,
        rango_fin:         rangoFin,
        num_transacciones: datosCorte.num_transacciones,
        por_forma_pago:    datosCorte.por_forma_pago,
        por_departamento:  datosCorte.por_departamento,
        total_ventas:      datosCorte.total_ventas,
      });
    } catch {
      imprimirHTML(generarHTMLCorte(datosCorte, rangoInicio, rangoFin));
    }
  }, [datosCorte, rangoInicio, rangoFin]);

  return (
    <Layout>
      {vista === null && (
        <LandingConsultasPOS onSeleccionar={setVista} />
      )}

      {vista === 'historial' && (
        <POSHistorial
          ventasHoy={ventasHoy}
          loadingHist={loadingHist}
          rangoInicio={rangoInicio}
          setRangoInicio={setRangoInicio}
          rangoFin={rangoFin}
          setRangoFin={setRangoFin}
          datosReporte={datosReporte}
          loadingReporte={loadingReporte}
          onCancelarVenta={cancelarVenta}
          setHoy={setHoy}
          setEstaSemana={setEstaSemana}
          setEsteMes={setEsteMes}
          onAbrirCorte={abrirCorte}
          puedeCancel={puedeCancel}
          onVolver={() => setVista(null)}
        />
      )}

      {modalCorte && (
        <POSModalCorte
          datosCorte={datosCorte}
          loadingCorte={loadingCorte}
          errorCorte={errorCorte}
          rangoInicio={rangoInicio}
          rangoFin={rangoFin}
          imprimirCorte={imprimirCorte}
          onCerrar={() => setModalCorte(false)}
        />
      )}
    </Layout>
  );
}

export default ConsultasPOS;
