import FrappeBase from './FrappeBase';

const METHOD = (name: string) => `/api/method/gestion_panaderia.api.nomina_api.${name}`;

export interface Empleado {
  name: string;
  employee_name: string;
  branch?: string;
  designation?: string;
  status?: string;
  date_of_joining?: string;
  custom_nomina_de?: string;
}

export interface Sucursal { name: string; }

export interface Corrida {
  name: string;
  nomina_de: string;
  fecha_pago: string;
  docstatus: number;
  total_declarado?: number;
  total_retenciones?: number;
  total_efectivo?: number;
  total_neto: number;
  total_costo: number;
  egreso_generado?: string;
}

export interface ReporteRow {
  sucursal: string;
  empleado: string;
  corridas: number;
  declarado: number;
  retenciones: number;
  efectivo: number;
  neto: number;
  costo_patron: number;
}

export interface RenglonInput {
  empleado: string;
  declarado: number | string;
  retenciones: number | string;
  efectivo: number | string;
}

export interface NuevoEmpleado {
  nombre: string;
  fecha_ingreso?: string;
  fecha_nacimiento?: string;
  genero: string;
  sucursal?: string | null;
  nomina_de?: string | null;
}

export interface NuevaCorrida {
  fecha_pago: string;
  nomina_de: string;
  renglones: RenglonInput[];
  semana_del?: string | null;
  semana_al?: string | null;
  submit?: 0 | 1;
}

interface Rango { fecha_desde?: string | null; fecha_hasta?: string | null; }

// FrappeBase es JS (any): _fetch devuelve Promise<any>. Tipamos solo la superficie pública.
class FrappeNominaService extends FrappeBase {

  async getSucursales(): Promise<Sucursal[]> {
    const json = await this._fetch(METHOD('get_sucursales'));
    return json?.message || [];
  }

  async crearSucursal(nombre: string): Promise<{ name: string }> {
    const json = await this._fetch(METHOD('crear_sucursal'), {
      method: 'POST',
      body: JSON.stringify({ nombre }),
    });
    return json?.message;
  }

  async getEmpleados(status = 'Active'): Promise<Empleado[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const json = await this._fetch(`${METHOD('get_empleados')}${qs}`);
    return json?.message || [];
  }

  async crearEmpleado(data: NuevoEmpleado): Promise<{ name: string; employee_name: string }> {
    const json = await this._fetch(METHOD('crear_empleado'), {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return json?.message;
  }

  async getCorridas({ fecha_desde, fecha_hasta }: Rango = {}): Promise<Corrida[]> {
    const params = new URLSearchParams();
    if (fecha_desde) params.set('fecha_desde', fecha_desde);
    if (fecha_hasta) params.set('fecha_hasta', fecha_hasta);
    const qs = params.toString();
    const json = await this._fetch(`${METHOD('get_corridas')}${qs ? '?' + qs : ''}`);
    return json?.message || [];
  }

  async crearCorrida(data: NuevaCorrida): Promise<{ name: string; docstatus: number; egreso_generado?: string }> {
    const json = await this._fetch(METHOD('crear_corrida'), {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return json?.message;
  }

  async cancelarCorrida(name: string): Promise<{ name: string; docstatus: number }> {
    const json = await this._fetch(METHOD('cancelar_corrida'), {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return json?.message;
  }

  async getReporteCostoReal({ fecha_desde, fecha_hasta }: Rango = {}): Promise<ReporteRow[]> {
    const params = new URLSearchParams();
    if (fecha_desde) params.set('fecha_desde', fecha_desde);
    if (fecha_hasta) params.set('fecha_hasta', fecha_hasta);
    const qs = params.toString();
    const json = await this._fetch(`${METHOD('reporte_costo_real')}${qs ? '?' + qs : ''}`);
    return json?.message || [];
  }
}

export const nominaService = new FrappeNominaService();
