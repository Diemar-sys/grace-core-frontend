import FrappeBase from './FrappeBase';

const METHOD = (name: string) => `/api/method/gestion_panaderia.api.egresos_api.${name}`;

/** Cobro de la hoja con efectivo todavía en la mano de Eva (27-oct). */
export interface CobroParaEgreso {
  cobro: string;
  cliente: string;
  fecha: string;
  facturas: string[];
  recibido: number;
  disponible: number;
}

interface EgresoFiltros {
  categoria?: string;
  facturado_a?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

class FrappeEgresosService extends FrappeBase {

  async getEgresos({ categoria, facturado_a, fecha_desde, fecha_hasta }: EgresoFiltros = {}): Promise<any[]> {
    const params = new URLSearchParams();
    if (categoria)    params.set('categoria',    categoria);
    if (facturado_a)  params.set('facturado_a',  facturado_a);
    if (fecha_desde)  params.set('fecha_desde',  fecha_desde);
    if (fecha_hasta)  params.set('fecha_hasta',  fecha_hasta);
    const qs = params.toString();
    const json = await this._fetch(`${METHOD('get_egresos')}${qs ? '?' + qs : ''}`);
    return json?.message || [];
  }

  /** Un egreso con su desglose de partidas (para el modal de detalle). */
  async getEgreso(name: string): Promise<any> {
    const json = await this._fetch(`${METHOD('get_egreso')}?name=${encodeURIComponent(name)}`);
    return json?.message;
  }

  async crearEgreso(data: unknown): Promise<any> {
    const json = await this._fetch(METHOD('crear_egreso'), {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return json?.message;
  }

  async getCuentasPorPagar(): Promise<any[]> {
    const json = await this._fetch(METHOD('reporte_cuentas_por_pagar'));
    return json?.message || [];
  }

  /** Compras y egresos sin pagar de UN proveedor: el desglose de su renglón en CxP. */
  async getPendientesProveedor(proveedor: string, facturado_a = ''): Promise<any[]> {
    const params = new URLSearchParams({ proveedor, facturado_a });
    const json = await this._fetch(`${METHOD('pendientes_de_proveedor')}?${params}`);
    // Sin red _fetch da null: decir "no debe nada" sería mentir.
    if (!json) throw new Error('Sin conexión: no se pudo cargar lo que se debe');
    return json.message || [];
  }

  /** `cobro`: pagado con el efectivo de ese cobro de la hoja (27-oct; el tope lo pone el servidor). */
  async marcarPagado(name: string, pagado: boolean | number, cobro: string | null = null): Promise<any> {
    const json = await this._fetch(METHOD('marcar_pagado'), {
      method: 'POST',
      body: JSON.stringify({ name, pagado: pagado ? 1 : 0, ...(cobro ? { cobro } : {}) }),
    });
    if (!json) throw new Error('Sin conexión: no se marcó pagado');
    return json.message;
  }

  async cobrosParaEgreso(): Promise<CobroParaEgreso[]> {
    const json = await this._fetch(METHOD('cobros_para_egreso'));
    if (!json) throw new Error('Sin conexión: no se pudieron leer los cobros');
    return json.message || [];
  }

  async eliminarEgreso(name: string): Promise<any> {
    const json = await this._fetch(METHOD('eliminar_egreso'), {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return json?.message;
  }
}

export const egresosService = new FrappeEgresosService();
