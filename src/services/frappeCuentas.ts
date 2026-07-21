import FrappeBase from './FrappeBase';

const METHOD = (name: string) => `/api/method/gestion_panaderia.api.cuentas_api.${name}`;

class FrappeCuentasService extends FrappeBase {
  async _get(name: string): Promise<any> {
    const json = await this._fetch(METHOD(name));
    return json?.message;
  }
  async _post(name: string, body: unknown): Promise<any> {
    const json = await this._fetch(METHOD(name), { method: 'POST', body: JSON.stringify(body) });
    return json?.message;
  }

  listarUsuarios()   { return this._get('listar_usuarios'); }
  listarNiveles()    { return this._get('listar_niveles'); }
  listarPosProfiles(){ return this._get('listar_pos_profiles'); }

  crearUsuario(data: unknown)            { return this._post('crear_usuario', data); }
  cambiarNivel(email: string, nivel: string, adminPassword?: string) { return this._post('cambiar_nivel', { email, nivel, admin_password: adminPassword }); }
  cambiarPosProfile(email: string, pos_profile: string | null) { return this._post('cambiar_pos_profile', { email, pos_profile }); }
  setHabilitado(email: string, enabled: boolean)    { return this._post('set_habilitado', { email, enabled: enabled ? 1 : 0 }); }
  editarUsuario(data: unknown)           { return this._post('editar_usuario', data); }
}

export const cuentasService = new FrappeCuentasService();
