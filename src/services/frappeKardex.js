import FrappeBase from './FrappeBase';

const METHOD = name => `/api/method/gestion_panaderia.api.kardex_api.${name}`;

class FrappeKardexService extends FrappeBase {
  /** Kardex de un item en un almacén, en un rango. Devuelve {filas, totales} o null. */
  async getKardex({ itemCode, warehouse, desde, hasta }, signal) {
    const params = new URLSearchParams({
      item_code: itemCode, warehouse, fecha_desde: desde, fecha_hasta: hasta,
    });
    const json = await this._fetch(`${METHOD('get_kardex')}?${params}`, { signal });
    return json?.message || null;
  }

  /** Items activos para el selector (name = item_code). */
  async getItems(signal) {
    const json = await this._fetch(
      '/api/resource/Item?fields=["name","item_name"]&filters=[["disabled","=",0]]&limit_page_length=0&order_by=item_name asc',
      { signal },
    );
    return json?.data || [];
  }
}

export const kardexService = new FrappeKardexService();
