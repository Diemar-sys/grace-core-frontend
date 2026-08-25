/**
 * FrappePedidoService
 * Importa el pedido diario desde la hoja de Google Drive del jefe.
 *
 * Se manda el archivo completo en base64: un .xlsx trae las ~11 pestañas de una
 * vez, que es lo que se quiere (el .csv solo exporta la pestaña abierta). Todo
 * el parseo vive en el backend para que la misma lógica valga venga por donde
 * venga el archivo.
 */

import FrappeBase from './FrappeBase';

export interface RenglonPedido {
  categoria: string;
  clave: string;
  producto: string;
  item_name: string;
  precio: number;
  piezas_por_charola: number;
  piezas: Record<string, number>;
  /** «3 char + 12 pz», calculado en el backend para que el PDF y la pantalla coincidan */
  charolas_texto: string;
  aviso: string;
}

export interface ProblemaPedido {
  clave: string;
  producto: string;
  motivo: string;
}

export interface HojaPedido {
  pestana: string;
  renglones: RenglonPedido[];
  problemas: ProblemaPedido[];
  destinos: string[];
  total_piezas: number;
  es_resumen: boolean;
  /** pestañas que ya traen estos mismos destinos: importar ambas duplicaría el pedido */
  duplica_a: string[];
  /** el backend sugiere marcarla: trae pedido y no repite destinos de otra */
  sugerida: boolean;
}

/** Un pedido ya guardado, tal como sale en el PDF. */
export interface RenglonGuardado {
  clave: string;
  producto: string;
  depto: string;
  piezas: Record<string, number>;
  total: number;
  por_charola: number;
  charolas_texto: string;
}

export interface PedidoGuardado {
  pedido: string;
  fecha: string;
  dia: string;
  total_piezas: number;
  tramos: { grupo: string; destinos: string[] }[];
  renglones: RenglonGuardado[];
}

export interface FechaPedido {
  name: string;
  fecha: string;
  dia: string;
  total_piezas: number;
  destinos: string;
}

/** Un producto del pedido frente a lo que ya le llegó al destino. */
export interface RenglonSurtido {
  clave: string;
  producto: string;
  pedido: number;
  enviado: number;
  falta: number;
  disponible: number;
  origen: string;
  sugerido: number;
  estado: 'cuadra' | 'falta_hay' | 'falta_no_hay' | 'de_mas';
}

export interface Surtido {
  destino: string;
  almacen: string;
  fecha?: string;
  renglones: RenglonSurtido[];
}

/** Cómo va el reparto del día: avance por destino y lo que quedó descuadrado. */
export interface FilaTablero {
  destino: string;
  clave: string;
  producto: string;
  pedido: number;
  enviado: number;
  diferencia: number;
  disponible: number;
}

export interface Sobra {
  clave: string;
  producto: string;
  disponible: number;
  pedido: number;
  almacen: string;
}

export interface Tablero {
  fecha: string;
  destinos: {
    destino: string;
    almacen: string | null;
    estado: 'almacen' | 'por_definir' | 'cliente';
    pedido: number;
    enviado: number;
  }[];
  pendientes: FilaTablero[];
  sin_pan: FilaTablero[];
  de_mas: FilaTablero[];
  sobras: Sobra[];
}

/** Un renglón del reporte de valorización. Lo que no se vende trae precio y
 *  margen en null: su «precio congelado» era el costo disfrazado. */
export interface RenglonValor {
  clave: string;
  producto: string;
  destino: string;
  grupo: string;
  vendible: boolean;
  /** el pan sin receta se valúa a un % del precio: su margen es aritmética, no medición */
  costo_estimado: boolean;
  sin_precio: boolean;
  piezas: number;
  costo: number;
  precio: number | null;
  margen: number | null;
  margen_pct: number | null;
}

export interface TotalValor {
  piezas: number;
  costo: number;
  precio: number | null;
  margen: number | null;
  margen_pct: number | null;
}

export interface Valorizacion {
  desde: string;
  hasta: string;
  destinos: (TotalValor & { destino: string; grupo: string })[];
  renglones: RenglonValor[];
  vendible: TotalValor;
  insumo: TotalValor;
  hay_costo_estimado: boolean;
}

export interface Cuadre {
  pestana: string;
  comparados: number;
  diferencias: { clave: string; producto: string; resumen: number; detalle: number }[];
}

const RUTA = '/api/method/gestion_panaderia.api.pedido_api';

/**
 * Rellena lo que el servidor pudo no mandar.
 *
 * La pantalla se cayó dos veces por leer un campo que un backend sin actualizar
 * todavía no devolvía. El borde con el servidor es el único lugar donde eso se
 * arregla una vez; adentro la vista puede confiar en la forma.
 */
function normalizarHoja(h: Partial<HojaPedido>): HojaPedido {
  return {
    pestana: h.pestana ?? '',
    renglones: h.renglones ?? [],
    problemas: h.problemas ?? [],
    destinos: h.destinos ?? [],
    total_piezas: h.total_piezas ?? 0,
    es_resumen: h.es_resumen ?? false,
    duplica_a: h.duplica_a ?? [],
    sugerida: h.sugerida ?? !(h.es_resumen ?? false),
  };
}

/** Lee el archivo como base64 (sin el prefijo data:). */
export function leerBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

class FrappePedidoService extends FrappeBase {
  /** Lee el archivo y dice qué entraría por pestaña, sin guardar nada. */
  async previsualizar(archivo: string, nombreArchivo: string): Promise<{
    hojas: HojaPedido[];
    cuadre: Cuadre | null;
    grupos: Record<string, string>;
    ordenGrupos: string[];
  }> {
    const r = await this._fetch(`${RUTA}.previsualizar`, {
      method: 'POST',
      body: JSON.stringify({ archivo, nombre_archivo: nombreArchivo }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return {
      hojas: (r.message?.hojas ?? []).map(normalizarHoja),
      cuadre: r.message?.cuadre ?? null,
      grupos: r.message?.grupos ?? {},
      ordenGrupos: r.message?.orden_grupos ?? [],
    };
  }

  /** Los pedidos ya guardados, del más nuevo al más viejo. */
  async fechas(limite = 40): Promise<FechaPedido[]> {
    const r = await this._fetch(`${RUTA}.fechas`, {
      method: 'POST',
      body: JSON.stringify({ limite }),
    });
    return r?.message ?? [];
  }

  /** El pedido guardado de esa fecha, o null si no hay. */
  async consultar(fecha: string): Promise<PedidoGuardado | null> {
    const r = await this._fetch(`${RUTA}.consultar`, {
      method: 'POST',
      body: JSON.stringify({ fecha }),
    });
    return r?.message ?? null;
  }

  /** Renglones con que se prellena un envío a sucursal, desde el pedido del día. */
  async sugerenciaEnvio(fecha: string, almacenDestino: string, almacenOrigen?: string): Promise<Surtido> {
    const r = await this._fetch(`${RUTA}.sugerencia_envio`, {
      method: 'POST',
      body: JSON.stringify({ fecha, almacen_destino: almacenDestino, almacen_origen: almacenOrigen }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return { destino: '', almacen: almacenDestino, renglones: [], ...(r.message ?? {}) };
  }

  /** Cómo va el reparto de ese día contra el pedido guardado. */
  async tablero(fecha: string): Promise<Tablero> {
    const r = await this._fetch(`${RUTA}.tablero`, {
      method: 'POST',
      body: JSON.stringify({ fecha }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    // el borde con el servidor es el único lugar donde se rellena lo que falte:
    // adentro la pantalla puede recorrer las listas sin preguntar si existen
    return {
      fecha, destinos: [], pendientes: [], sin_pan: [], de_mas: [], sobras: [],
      ...(r.message ?? {}),
    };
  }

  /** Cuánto se mandó en el periodo y cuánto vale, al costo y a precio de venta. */
  async valorizacion(desde: string, hasta?: string, destino?: string): Promise<Valorizacion> {
    const r = await this._fetch(`${RUTA}.valorizacion_envios`, {
      method: 'POST',
      body: JSON.stringify({ desde, hasta, destino }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    const vacio = { piezas: 0, costo: 0, precio: null, margen: null, margen_pct: null };
    return {
      desde, hasta: hasta || desde, destinos: [], renglones: [],
      vendible: vacio, insumo: vacio, hay_costo_estimado: false,
      ...(r.message ?? {}),
    };
  }

  /** ¿Ya está guardado el pedido de esa fecha? El PDF y el envío leen lo guardado. */
  async hayPedido(fecha: string): Promise<boolean> {
    const r = await this._fetch(`${RUTA}.hay_pedido`, {
      method: 'POST',
      body: JSON.stringify({ fecha }),
    });
    return Boolean(r?.message);
  }

  /** Etiquetas de quienes pueden recibir el pedido (los chat_id no salen del servidor). */
  async destinatarios(): Promise<string[]> {
    const r = await this._fetch(`${RUTA}.destinatarios`, { method: 'POST', body: '{}' });
    return r?.message ?? [];
  }

  /** Manda el PDF del pedido por Telegram. El destinatario vive en el servidor. */
  async enviar(fecha: string, destinatario?: string) {
    const r = await this._fetch(`${RUTA}.enviar`, {
      method: 'POST',
      body: JSON.stringify({ fecha, destinatario }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return r.message as { enviado_a: string; archivo: string; bytes: number };
  }

  /** Guarda el pedido del día con las pestañas elegidas. */
  async importar(archivo: string, nombreArchivo: string, fecha: string, pestanas: string[]) {
    const r = await this._fetch(`${RUTA}.importar`, {
      method: 'POST',
      body: JSON.stringify({ archivo, nombre_archivo: nombreArchivo, fecha, pestanas }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    const m = r.message ?? {};
    return {
      pedido: (m.pedido ?? '') as string,
      renglones: (m.renglones ?? 0) as number,
      destinos: (m.destinos ?? []) as string[],
      pestanas: (m.pestanas ?? []) as string[],
      problemas: (m.problemas ?? []) as ProblemaPedido[],
    };
  }
}

/** URL del PDF del pedido guardado: el navegador ya manda la cookie de sesión. */
export const urlPdfPedido = (fecha: string) =>
  `${RUTA}.pdf?fecha=${encodeURIComponent(fecha)}`;

export const pedidoService = new FrappePedidoService();
export default FrappePedidoService;
