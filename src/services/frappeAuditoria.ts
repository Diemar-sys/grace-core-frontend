import FrappeBase from './FrappeBase';

const METHOD = (name: string) => `/api/method/gestion_panaderia.api.auditoria_api.${name}`;

interface FeedFiltros {
  desde?: string;
  hasta?: string;
  usuario?: string;
}

class FrappeAuditoriaService extends FrappeBase {
  async feed({ desde, hasta, usuario }: FeedFiltros = {}): Promise<any[]> {
    const p = new URLSearchParams();
    if (desde)   p.set('desde', desde);
    if (hasta)   p.set('hasta', hasta);
    if (usuario) p.set('usuario', usuario);
    const qs = p.toString();
    const json = await this._fetch(`${METHOD('feed')}${qs ? '?' + qs : ''}`);
    return json?.message || [];
  }

  async operadores(): Promise<any[]> {
    const json = await this._fetch(METHOD('operadores'));
    return json?.message || [];
  }
}

export const auditoriaService = new FrappeAuditoriaService();
