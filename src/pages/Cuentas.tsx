import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Eye, EyeOff, Pencil, Check, X, UserPlus, Lock } from 'lucide-react';
import Layout from '../components/Layout';
import { cuentasService } from '../services/frappeCuentas';
import ModalError from '../components/modals/ModalError';
import { parseErrorFrappe } from '../utils/errorFrappe';
import '../styles/Cuentas.css';

const FORM_INIT: any = { email: '', nombre: '', password: '', nivel: 'Vendedor', pos_profile: '' };

// Color por nivel (tokens globales en global.css).
const NIVEL_COLOR: Record<string, { fg: string; bg: string }> = {
  Vendedor:    { fg: 'var(--nivel-vendedor)',    bg: 'var(--nivel-vendedor-bg)' },
  'Almacén':   { fg: 'var(--nivel-almacen)',     bg: 'var(--nivel-almacen-bg)' },
  Operaciones: { fg: 'var(--nivel-operaciones)', bg: 'var(--nivel-operaciones-bg)' },
  Gerente:     { fg: 'var(--nivel-gerente)',     bg: 'var(--nivel-gerente-bg)' },
  'System Manager': { fg: 'var(--nivel-gerente)', bg: 'var(--nivel-gerente-bg)' },
};
const colorNivel = (n: string) => NIVEL_COLOR[n] || { fg: 'var(--color-text-soft)', bg: '#f1e7d6' };

function iniciales(nombre?: string, correo?: string) {
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

interface AdminGate { titulo: string; run: (pwd: string) => Promise<any>; }

export default function Cuentas() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [niveles, setNiveles]   = useState<string[]>([]);
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title?: string; message: string }>({ isOpen: false, message: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<any>(FORM_INIT);
  const [guardando, setGuardando] = useState(false);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [editEmail, setEditEmail] = useState<string | null>(null);  // email original en edición; null = crear
  const [verPwd, setVerPwd]       = useState(false);
  // Llave sudo: acción pendiente que requiere la contraseña de Administrator.
  const [adminGate, setAdminGate] = useState<AdminGate | null>(null);
  const [gatePwd, setGatePwd]     = useState('');
  const [gateBusy, setGateBusy]   = useState(false);
  const [gateError, setGateError] = useState('');
  const [verGatePwd, setVerGatePwd] = useState(false);

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
      if (/permiso/i.test((e as any)?.message || '')) setSinAcceso(true);
      else setErrorModal({ isOpen: true, ...parseErrorFrappe(e) });
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const abrirNuevo = () => { setEditEmail(null); setForm(FORM_INIT); setVerPwd(false); setShowForm(true); };
  const abrirEditar = (u: any) => {
    setEditEmail(u.name);
    setForm({ email: u.name, nombre: u.full_name || '', password: '', nivel: u.nivel || 'Vendedor', pos_profile: u.pos_profile || '', es_sm: u.es_system_manager });
    setVerPwd(false); setShowForm(true);
  };
  const cerrarForm = () => { setShowForm(false); setEditEmail(null); setForm(FORM_INIT); };

  const doGuardar = async (adminPassword?: string) => {
    if (editEmail) {
      await cuentasService.editarUsuario({
        email: editEmail, nombre: form.nombre,
        nuevo_email: form.email, password: form.password || undefined,
        admin_password: adminPassword,
      });
    } else {
      await cuentasService.crearUsuario(form);
    }
  };

  const handleGuardar = () => {
    if (!form.email) { setErrorModal({ isOpen: true, message: 'Escribe un correo' }); return; }
    if (!editEmail && !form.password) { setErrorModal({ isOpen: true, message: 'Escribe una contraseña' }); return; }
    if (form.password && form.password.length < 6) { setErrorModal({ isOpen: true, message: 'La contraseña necesita al menos 6 caracteres' }); return; }
    // Editar un System Manager exige la llave de Administrator (sudo).
    if (editEmail && form.es_sm) {
      setAdminGate({ titulo: `Editar System Manager · ${form.email}`, run: async (pwd: string) => { await doGuardar(pwd); cerrarForm(); } });
      return;
    }
    setGuardando(true);
    doGuardar()
      .then(() => { cerrarForm(); cargar(); })
      .catch(e => setErrorModal({ isOpen: true, ...parseErrorFrappe(e) }))
      .finally(() => setGuardando(false));
  };

  // Ejecuta la acción pendiente con la contraseña de Administrator tecleada.
  const cerrarGate = () => { setAdminGate(null); setGatePwd(''); setVerGatePwd(false); setGateError(''); };
  const confirmarGate = async () => {
    if (!gatePwd) { setGateError('Escribe la contraseña de Administrator'); return; }
    if (!adminGate) return;
    setGateBusy(true); setGateError('');
    try {
      await adminGate.run(gatePwd);
      cerrarGate();
      cargar();
    } catch (e) {
      // Error INLINE en el propio modal (no abrir otro diálogo encima → mantiene la
      // llave abierta para reintentar sin que Radix la cierre por foco externo).
      setGateError(parseErrorFrappe(e).message || 'Error');
    } finally { setGateBusy(false); }
  };

  // Cambios inline: optimistas con recarga al fallar.
  const conRecarga = async (fn: () => Promise<any>) => {
    try { await fn(); cargar(); }
    catch (e) { setErrorModal({ isOpen: true, ...parseErrorFrappe(e) }); cargar(); }
  };
  const handleNivel = (email: string, nivel: string, esSM: boolean) => {
    // Otorgar/quitar System Manager (rey toca rey) → pide llave de Administrator.
    if (nivel === 'System Manager' || esSM) {
      setAdminGate({ titulo: `Nivel de ${email} → "${nivel}"`, run: (pwd: string) => cuentasService.cambiarNivel(email, nivel, pwd) });
    } else {
      conRecarga(() => cuentasService.cambiarNivel(email, nivel));
    }
  };
  const handlePos    = (email: string, pos: string)     => conRecarga(() => cuentasService.cambiarPosProfile(email, pos || null));
  const handleToggle = (email: string, enab: boolean)   => conRecarga(() => cuentasService.setHabilitado(email, enab));

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
                  {usuarios.map((u: any) => {
                    const esSM = u.es_system_manager; // dueño: editable solo con llave admin
                    const c = colorNivel(u.nivel);
                    return (
                      <tr key={u.name} className={esSM ? 'cuentas-row-sysmgr' : undefined}>
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
                          <select className="nivel-select" value={u.nivel || ''}
                            style={{ color: c.fg, background: c.bg }}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleNivel(u.name, e.target.value, esSM)}>
                            {!u.nivel && <option value="">— Sin nivel —</option>}
                            {niveles.map(n => <option key={n}>{n}</option>)}
                          </select>
                        </td>
                        <td>
                          {esSM ? <span className="persona-correo">—</span> : (
                            <select className="pos-select" value={u.pos_profile || ''}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) => handlePos(u.name, e.target.value)}>
                              <option value="">— Sin perfil —</option>
                              {perfiles.map((p: any) => <option key={p}>{p}</option>)}
                            </select>
                          )}
                        </td>
                        <td>
                          <span className={'estado ' + (u.enabled ? 'on' : 'off')}>
                            <span className="dot" />{u.enabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="cuentas-acciones">
                            <button className="icon-btn" title="Editar nombre, correo y contraseña"
                              onClick={() => abrirEditar(u)}><Pencil size={15} /></button>
                            {!esSM && (
                              <button className={'icon-btn' + (u.enabled ? ' danger' : '')}
                                title={u.enabled ? 'Deshabilitar acceso' : 'Habilitar acceso'}
                                onClick={() => handleToggle(u.name, !u.enabled)}>
                                {u.enabled ? <X size={15} /> : <Check size={15} />}
                              </button>
                            )}
                          </div>
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
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set('email', e.target.value)} />
                </label>
                <label className="cuentas-field">NOMBRE
                  <input type="text" placeholder="Nombre completo" value={form.nombre}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set('nombre', e.target.value)} />
                </label>
                <label className="cuentas-field full">CONTRASEÑA
                  <span className="cuentas-pwd">
                    <input type={verPwd ? 'text' : 'password'}
                      placeholder={editEmail ? 'Dejar en blanco = no cambiar' : 'Mínimo 6 caracteres'}
                      value={form.password} onChange={(e: ChangeEvent<HTMLInputElement>) => set('password', e.target.value)} />
                    <button type="button" className="cuentas-eye" onClick={() => setVerPwd(v => !v)}
                      aria-label={verPwd ? 'Ocultar contraseña' : 'Ver contraseña'}>
                      {verPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {!editEmail && (
                  <>
                    <label className="cuentas-field">NIVEL
                      <select value={form.nivel} onChange={(e: ChangeEvent<HTMLSelectElement>) => set('nivel', e.target.value)}>
                        {niveles.filter(n => n !== 'System Manager').map(n => <option key={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="cuentas-field">PERFIL DE PUNTO DE VENTA
                      <select value={form.pos_profile} onChange={(e: ChangeEvent<HTMLSelectElement>) => set('pos_profile', e.target.value)}>
                        <option value="">— Sin perfil —</option>
                        {perfiles.map((p: any) => <option key={p}>{p}</option>)}
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

        {/* Llave sudo: contraseña de Administrator para operar sobre un System Manager */}
        <Dialog.Root open={!!adminGate} onOpenChange={(o) => { if (!o && !gateBusy) cerrarGate(); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="cuentas-overlay" />
            <Dialog.Content className="cuentas-modal cuentas-gate">
              <Dialog.Title className="cuentas-modal-title"><Lock size={18} /> Llave de Administrator</Dialog.Title>
              <Dialog.Description className="cuentas-modal-sub">
                {adminGate?.titulo} — requiere la contraseña de Administrator.
              </Dialog.Description>
              {gateError && (
                <div style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>
                  {gateError}
                </div>
              )}
              <label className="cuentas-field full">CONTRASEÑA DE ADMINISTRATOR
                <span className="cuentas-pwd">
                  <input type={verGatePwd ? 'text' : 'password'} autoFocus
                    placeholder="••••••••" value={gatePwd}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setGatePwd(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') confirmarGate(); }} />
                  <button type="button" className="cuentas-eye" onClick={() => setVerGatePwd(v => !v)}
                    aria-label={verGatePwd ? 'Ocultar contraseña' : 'Ver contraseña'}>
                    {verGatePwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <div className="cuentas-form-actions">
                <button className="btn-ghost" onClick={cerrarGate} disabled={gateBusy}>CANCELAR</button>
                <button className="btn-primary" onClick={confirmarGate} disabled={gateBusy}>
                  {gateBusy ? 'Verificando…' : 'Confirmar'}
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
