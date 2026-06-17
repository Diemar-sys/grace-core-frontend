import FrappeBase from './FrappeBase';

const METHOD = name => `/api/method/gestion_panaderia.api.cuentas_api.${name}`;

class FrappeCuentasService extends FrappeBase {
  async _get(name) {
    const json = await this._fetch(METHOD(name));
    return json?.message;
  }
  async _post(name, body) {
    const json = await this._fetch(METHOD(name), { method: 'POST', body: JSON.stringify(body) });
    return json?.message;
  }

  listarUsuarios()   { return this._get('listar_usuarios'); }
  listarNiveles()    { return this._get('listar_niveles'); }
  listarPosProfiles(){ return this._get('listar_pos_profiles'); }

  crearUsuario(data)               { return this._post('crear_usuario', data); }
  cambiarNivel(email, nivel)       { return this._post('cambiar_nivel', { email, nivel }); }
  cambiarPosProfile(email, pos_profile) { return this._post('cambiar_pos_profile', { email, pos_profile }); }
  setHabilitado(email, enabled)    { return this._post('set_habilitado', { email, enabled: enabled ? 1 : 0 }); }
  editarUsuario(data)              { return this._post('editar_usuario', data); }
}

export const cuentasService = new FrappeCuentasService();
