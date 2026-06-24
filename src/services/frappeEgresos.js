import FrappeBase from './FrappeBase';

const METHOD = name => `/api/method/gestion_panaderia.api.egresos_api.${name}`;

class FrappeEgresosService extends FrappeBase {

  async getEgresos({ categoria, facturado_a, fecha_desde, fecha_hasta } = {}) {
    const params = new URLSearchParams();
    if (categoria)    params.set('categoria',    categoria);
    if (facturado_a)  params.set('facturado_a',  facturado_a);
    if (fecha_desde)  params.set('fecha_desde',  fecha_desde);
    if (fecha_hasta)  params.set('fecha_hasta',  fecha_hasta);
    const qs = params.toString();
    const json = await this._fetch(`${METHOD('get_egresos')}${qs ? '?' + qs : ''}`);
    return json?.message || [];
  }

  async crearEgreso(data) {
    const json = await this._fetch(METHOD('crear_egreso'), {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return json?.message;
  }

  async getCuentasPorPagar() {
    const json = await this._fetch(METHOD('reporte_cuentas_por_pagar'));
    return json?.message || [];
  }

  async marcarPagado(name, pagado) {
    const json = await this._fetch(METHOD('marcar_pagado'), {
      method: 'POST',
      body: JSON.stringify({ name, pagado: pagado ? 1 : 0 }),
    });
    return json?.message;
  }

  async eliminarEgreso(name) {
    const json = await this._fetch(METHOD('eliminar_egreso'), {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return json?.message;
  }
}

export const egresosService = new FrappeEgresosService();
