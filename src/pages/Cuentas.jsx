import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Eye, EyeOff, Pencil, Check, X, UserPlus, Lock } from 'lucide-react';
import Layout from '../components/Layout';
import { cuentasService } from '../services/frappeCuentas';
import ModalError from '../components/modals/ModalError';
import { parseErrorFrappe } from '../utils/errorFrappe';
import '../styles/Cuentas.css';

const FORM_INIT = { email: '', nombre: '', password: '', nivel: 'Vendedor', pos_profile: '' };

// Color por nivel (tokens globales en global.css).
const NIVEL_COLOR = {
  Vendedor:    { fg: 'var(--nivel-vendedor)',    bg: 'var(--nivel-vendedor-bg)' },
  'Almacén':   { fg: 'var(--nivel-almacen)',     bg: 'var(--nivel-almacen-bg)' },
  Operaciones: { fg: 'var(--nivel-operaciones)', bg: 'var(--nivel-operaciones-bg)' },
  Gerente:     { fg: 'var(--nivel-gerente)',     bg: 'var(--nivel-gerente-bg)' },
};
const colorNivel = (n) => NIVEL_COLOR[n] || { fg: 'var(--color-text-soft)', bg: '#f1e7d6' };

function iniciales(nombre, correo) {
  const base = (nombre || correo || '?').trim();
  const partes = base.split(/[\s.@_-]+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || base[0].toUpperCase();
}

function AccesoRestringido() {
  return (
    <div className="cuentas-lock">
      <Lock size={64} strokeWidth={1.4} />
      <h3>Administrador de Cuentas</h3>
      <p>Esta sección es solo para el administrador del sistema.</p>
    </div>
  );
}

export default function Cuentas() {
  const [usuarios, setUsuarios] = useState([]);
  const [niveles, setNiveles]   = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(FORM_INIT);
  const [guardando, setGuardando] = useState(false);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [editEmail, setEditEmail] = useState(null);  // email original en edición; null = crear
  const [verPwd, setVerPwd]       = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [u, n, p] = await Promise.all([
        cuentasService.listarUsuarios(),
        cuentasService.listarNiveles(),
        cuentasService.listarPosProfiles(),
      ]);
      setUsuarios(u || []); setNiveles(n || []); setPerfiles(p || []);
    } catch (e) {
      if (/permiso/i.test(e?.message || '')) setSinAcceso(true);
      else setErrorModal({ isOpen: true, ...parseErrorFrappe(e) });
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNuevo = () => { setEditEmail(null); setForm(FORM_INIT); setVerPwd(false); setShowForm(true); };
  const abrirEditar = (u) => {
    setEditEmail(u.name);
    setForm({ email: u.name, nombre: u.full_name || '', password: '', nivel: u.nivel || 'Vendedor', pos_profile: u.pos_profile || '' });
    setVerPwd(false); setShowForm(true);
  };
  const cerrarForm = () => { setShowForm(false); setEditEmail(null); setForm(FORM_INIT); };

  const handleGuardar = async () => {
    if (!form.email) { setErrorModal({ isOpen: true, message: 'Escribe un correo' }); return; }
    if (!editEmail && !form.password) { setErrorModal({ isOpen: true, message: 'Escribe una contraseña' }); return; }
    if (form.password && form.password.length < 6) { setErrorModal({ isOpen: true, message: 'La contraseña necesita al menos 6 caracteres' }); return; }
    setGuardando(true);
    try {
      if (editEmail) {
        await cuentasService.editarUsuario({
          email: editEmail, nombre: form.nombre,
          nuevo_email: form.email, password: form.password || undefined,
        });
      } else {
        await cuentasService.crearUsuario(form);
      }
      cerrarForm(); cargar();
    } catch (e) { setErrorModal({ isOpen: true, ...parseErrorFrappe(e) }); }
    finally { setGuardando(false); }
  };

  // Cambios inline: optimistas con recarga al fallar.
  const conRecarga = async (fn) => {
    try { await fn(); cargar(); }
    catch (e) { setErrorModal({ isOpen: true, ...parseErrorFrappe(e) }); cargar(); }
  };
  const handleNivel  = (email, nivel)  => conRecarga(() => cuentasService.cambiarNivel(email, nivel));
  const handlePos    = (email, pos)    => conRecarga(() => cuentasService.cambiarPosProfile(email, pos || null));
  const handleToggle = (email, enab)   => conRecarga(() => cuentasService.setHabilitado(email, enab));

  if (sinAcceso) {
    return <Layout><div className="cuentas-page"><AccesoRestringido /></div></Layout>;
  }

  return (
    <Layout>
      <div className="cuentas-page">
        <div className="cuentas-head">
          <div>
            <p className="cuentas-eyebrow">Configuración</p>
            <h2 className="cuentas-title">Cuentas</h2>
            <p className="cuentas-sub">Crea usuarios, asigna su nivel y administra su acceso.</p>
          </div>
          <button className="cuentas-new-btn" onClick={abrirNuevo}>
            <UserPlus size={17} /> Nuevo usuario
          </button>
        </div>

        {loading ? (
          <div className="cuentas-loading"><span className="cuentas-spinner" />Cargando cuentas…</div>
        ) : usuarios.length === 0 ? (
          <p className="cuentas-empty">Aún no hay usuarios. Crea el primero con “Nuevo usuario”.</p>
        ) : (
          <div className="cuentas-table-wrap">
            <div className="cuentas-scroll">
              <table className="cuentas-table">
                <thead>
                  <tr><th>Usuario</th><th>Nivel</th><th>POS Profile</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const bloqueado = u.es_system_manager; // dueño: no editable aquí
                    const c = colorNivel(u.nivel);
                    return (
                      <tr key={u.name} className={bloqueado ? 'cuentas-row-locked' : undefined}>
                        <td>
                          <div className="persona">
                            <span className="avatar">{iniciales(u.full_name, u.name)}</span>
                            <span className="persona-datos">
                              <span className="persona-nombre">{u.full_name || '—'}</span>
                              <span className="persona-correo">{u.name}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          {bloqueado ? <span className="pill-sm badge-sysmgr">System Manager</span> : (
                            <select className="nivel-select" value={u.nivel || ''}
                              style={{ color: c.fg, background: c.bg }}
                              onChange={e => handleNivel(u.name, e.target.value)}>
                              {!u.nivel && <option value="">— Sin nivel —</option>}
                              {niveles.map(n => <option key={n}>{n}</option>)}
                            </select>
                          )}
                        </td>
                        <td>
                          {bloqueado ? <span className="persona-correo">—</span> : (
                            <select className="pos-select" value={u.pos_profile || ''}
                              onChange={e => handlePos(u.name, e.target.value)}>
                              <option value="">— Sin perfil —</option>
                              {perfiles.map(p => <option key={p}>{p}</option>)}
                            </select>
                          )}
                        </td>
                        <td>
                          <span className={'estado ' + (u.enabled ? 'on' : 'off')}>
                            <span className="dot" />{u.enabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          {!bloqueado && (
                            <div className="cuentas-acciones">
                              <button className="icon-btn" title="Editar nombre, correo y contraseña"
                                onClick={() => abrirEditar(u)}><Pencil size={15} /></button>
                              <button className={'icon-btn' + (u.enabled ? ' danger' : '')}
                                title={u.enabled ? 'Deshabilitar acceso' : 'Habilitar acceso'}
                                onClick={() => handleToggle(u.name, !u.enabled)}>
                                {u.enabled ? <X size={15} /> : <Check size={15} />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal crear / editar */}
        <Dialog.Root open={showForm} onOpenChange={(o) => { if (!o) cerrarForm(); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="cuentas-overlay" />
            <Dialog.Content className="cuentas-modal">
              <Dialog.Title className="cuentas-modal-title">
                {editEmail ? 'Editar usuario' : 'Nuevo usuario'}
              </Dialog.Title>
              <Dialog.Description className="cuentas-modal-sub">
                {editEmail ? editEmail : 'Asigna correo, nivel y una contraseña inicial.'}
              </Dialog.Description>

              <div className="cuentas-form-grid">
                <label className="cuentas-field">CORREO
                  <input type="email" placeholder="persona@grace.mx" value={form.email}
                    onChange={e => set('email', e.target.value)} />
                </label>
                <label className="cuentas-field">NOMBRE
                  <input type="text" placeholder="Nombre completo" value={form.nombre}
                    onChange={e => set('nombre', e.target.value)} />
                </label>
                <label className="cuentas-field full">CONTRASEÑA
                  <span className="cuentas-pwd">
                    <input type={verPwd ? 'text' : 'password'}
                      placeholder={editEmail ? 'Dejar en blanco = no cambiar' : 'Mínimo 6 caracteres'}
                      value={form.password} onChange={e => set('password', e.target.value)} />
                    <button type="button" className="cuentas-eye" onClick={() => setVerPwd(v => !v)}
                      aria-label={verPwd ? 'Ocultar contraseña' : 'Ver contraseña'}>
                      {verPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {!editEmail && (
                  <>
                    <label className="cuentas-field">NIVEL
                      <select value={form.nivel} onChange={e => set('nivel', e.target.value)}>
                        {niveles.map(n => <option key={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="cuentas-field">PERFIL DE PUNTO DE VENTA
                      <select value={form.pos_profile} onChange={e => set('pos_profile', e.target.value)}>
                        <option value="">— Sin perfil —</option>
                        {perfiles.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>

              <div className="cuentas-form-actions">
                <button className="btn-ghost" onClick={cerrarForm}>CANCELAR</button>
                <button className="btn-primary" onClick={handleGuardar} disabled={guardando}>
                  {guardando ? 'Guardando…' : (editEmail ? 'Guardar cambios' : 'Crear usuario')}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <ModalError
          isOpen={errorModal.isOpen}
          title={errorModal.title}
          message={errorModal.message}
          onClose={() => setErrorModal({ isOpen: false, message: '' })}
        />
      </div>
    </Layout>
  );
}
