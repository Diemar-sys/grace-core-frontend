import FrappeBase from './FrappeBase';

const METHOD = (name: string) => `/api/method/gestion_panaderia.api.reportes_api.${name}`;

class FrappeReportesService extends FrappeBase {
  /**
   * Reporte de gasto unificado: Compras (inventario) + Egresos, por cuenta
   * (facturado_a) en un rango de fechas, con desglose de egresos por categoría.
   */
  async getReporteGastos({ desde, hasta }: { desde: string; hasta: string }, signal?: AbortSignal): Promise<any> {
    const params = new URLSearchParams({ fecha_desde: desde, fecha_hasta: hasta });
    const json = await this._fetch(`${METHOD('reporte_gastos')}?${params}`, { signal });
    return json?.message || null;
  }
}

export const reportesService = new FrappeReportesService();
