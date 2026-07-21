import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import Layout from '../components/Layout';
import { auditoriaService } from '../services/frappeAuditoria';
import { parseErrorFrappe } from '../utils/errorFrappe';
import ModalError from '../components/modals/ModalError';

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// YYYY-MM-DD local (no UTC shift).
const ymd = (d: Date | number) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// Color pastel por tipo de movimiento (tokens semánticos de global.css).
const TIPO_COLOR: Record<string, { fg: string; bg: string }> = {
  Venta:   { fg: '#15803d', bg: '#dcfce7' },
  Cobro:   { fg: '#15803d', bg: '#dcfce7' },
  Compra:  { fg: '#1565c0', bg: '#e3f0ff' },
  Pago:    { fg: '#b45309', bg: '#fef3c7' },
  Egreso:  { fg: '#b45309', bg: '#fef3c7' },
  'Envío': { fg: '#6a1b9a', bg: '#f3e5f5' },
  Ajuste:  { fg: '#8f2f23', bg: '#f6e3df' },
};
const colorTipo = (t: string) => TIPO_COLOR[t] || { fg: 'var(--color-text-soft)', bg: '#f1e7d6' };

export default function Auditoria() {
  const hoy = ymd(new Date());
  const hace7 = ymd(new Date(Date.now() - 7 * 864e5));

  const [desde, setDesde] = useState(hace7);
  const [hasta, setHasta] = useState(hoy);
  const [usuario, setUsuario] = useState('');
  const [operadores, setOperadores] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title?: string; message: string }>({ isOpen: false, message: '' });

  useEffect(() => {
    auditoriaService.operadores()
      .then(setOperadores)
      .catch(() => { /* si no tiene permiso, el feed ya lo reporta */ });
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditoriaService.feed({ desde, hasta, usuario: usuario || undefined });
      setRows(data);
    } catch (e) {
      setErrorModal({ isOpen: true, ...parseErrorFrappe(e) });
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 style={{ margin: 0 }}>Auditoría</h1>
            <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
              Quién registró cada movimiento y cuándo
            </span>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{rows.length}</span>
              <span className="stat-label">Movimientos</span>
            </div>
          </div>
        </div>

        <div className="filtros-section">
          <div className="filtro-group">
            <label>Usuario</label>
            <select value={usuario} onChange={(e: ChangeEvent<HTMLSelectElement>) => setUsuario(e.target.value)}>
              <option value="">Todos</option>
              {operadores.map((o: any) => (
                <option key={o.name} value={o.name}>{o.full_name || o.name}</option>
              ))}
            </select>
          </div>
          <div className="filtro-group filtro-sm">
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e: ChangeEvent<HTMLInputElement>) => setDesde(e.target.value)} />
          </div>
          <div className="filtro-group filtro-sm">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e: ChangeEvent<HTMLInputElement>) => setHasta(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-soft)', padding: 'var(--space-4)' }}>Cargando…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--color-text-soft)', padding: 'var(--space-4)' }}>
            Sin movimientos en el rango seleccionado.
          </p>
        ) : (
          <table className="sys-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Referencia</th>
                <th>Detalle</th>
                <th className="cell-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => {
                const c = colorTipo(r.tipo);
                return (
                  <tr key={`${r.creation}-${i}`} style={r.cancelado ? { opacity: 0.55 } : undefined}>
                    <td>{r.fecha}</td>
                    <td>{r.hora}</td>
                    <td><strong>{r.usuario}</strong></td>
                    <td>
                      <span className="pill-sm" style={{ color: c.fg, background: c.bg }}>{r.tipo}</span>
                    </td>
                    <td className="cell-code">
                      {r.ref}
                      {r.cancelado && <span style={{ color: 'var(--color-danger)', marginLeft: 6, fontSize: 11 }}>(cancelado)</span>}
                    </td>
                    <td>{r.detalle || '—'}</td>
                    <td className="cell-right">{r.monto != null ? `$${fmt(r.monto)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ModalError
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
      />
    </Layout>
  );
}
