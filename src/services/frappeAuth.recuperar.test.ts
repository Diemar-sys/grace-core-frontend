import { afterEach, describe, expect, it, vi } from 'vitest';
import { auth } from './frappeAuth';

const respuesta = (status: number, body: any) =>
  ({ ok: status < 400, status, statusText: '', json: async () => body }) as Response;

describe('frappeAuth — recuperar contraseña (09-nov)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('🔴 pedir manda `user` (el nombre que también usa el reset nativo desviado) por POST', async () => {
    const f = vi.fn().mockResolvedValue(respuesta(200, { message: 'MISMO MENSAJE' }));
    vi.stubGlobal('fetch', f);
    expect(await auth.pedirRecuperacion('hector.th@grace.mx')).toBe('MISMO MENSAJE');
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe('/api/method/gestion_panaderia.api.recuperar_api.pedir');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ user: 'hector.th@grace.mx' });
  });

  it('pedir: 429 dice que espere', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(429, {})));
    await expect(auth.pedirRecuperacion('x')).rejects.toThrow(/Espera una hora/);
  });

  it('🔴 cambiar: manda la llave, cierra TODAS las sesiones viejas y luego la que Frappe abrió', async () => {
    const f = vi.fn().mockResolvedValue(respuesta(200, { message: '/app' }));
    vi.stubGlobal('fetch', f);
    await auth.cambiarConLlave('abc', 'panGrace2026');
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe('/api/method/frappe.core.doctype.user.user.update_password');
    expect(JSON.parse(opts.body)).toEqual({ new_password: 'panGrace2026', key: 'abc', logout_all_sessions: 1 });
    expect(f.mock.calls[1][0]).toBe('/api/method/logout');
  });

  it('cambiar: 410 (vencida o usada) lo dice claro y no cierra nada', async () => {
    const f = vi.fn().mockResolvedValue(respuesta(410, { message: 'The reset password link has been expired' }));
    vi.stubGlobal('fetch', f);
    await expect(auth.cambiarConLlave('viejo', 'panGrace2026')).rejects.toThrow(/ya venció o ya se usó/);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
