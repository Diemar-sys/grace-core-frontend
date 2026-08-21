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
