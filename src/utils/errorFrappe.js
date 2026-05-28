// src/utils/errorFrappe.js
// Convierte errores crudos de Frappe/ERPNext en mensajes claros para el usuario final.
// Frappe suele devolver HTML con stack y enlaces internos; aquí lo traducimos.

const stripHTML = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const ITEM_CODE_RE = /art[íi]culo\s+([A-Z0-9-]{6,})/i;

/**
 * Parsea un error de Frappe y devuelve título + mensaje amigable.
 * @param {Error|string} err
 * @returns {{ title: string, message: string }}
 */
export function parseErrorFrappe(err) {
  const raw = err?.message ?? String(err ?? '');
  const txt = stripHTML(raw);

  // Tasa de valoración faltante → item sin stock real ni costeo en el almacén
  if (/valoraci[oó]n|valuation_rate/i.test(txt)) {
    const m = txt.match(ITEM_CODE_RE);
    const codigo = m ? m[1] : null;
    return {
      title: 'Sin stock disponible',
      message: codigo
        ? `El producto ${codigo} no tiene stock disponible en el almacén origen. Verifica el inventario antes de transferir.`
        : 'Uno o más productos no tienen stock disponible en el almacén origen. Verifica el inventario antes de transferir.',
    };
  }

  // Stock insuficiente / cantidad negativa
  if (/insufficient|negative|stock\s+insuficiente/i.test(txt)) {
    return {
      title: 'Stock insuficiente',
      message: 'La cantidad solicitada supera el stock disponible. Ajusta las cantidades.',
    };
  }

  // Permisos
  if (/permission|not permitted|forbidden/i.test(txt)) {
    return {
      title: 'Sin permisos',
      message: 'Tu usuario no tiene permisos para realizar esta acción. Contacta al administrador.',
    };
  }

  // Fallback: texto limpio recortado
  return {
    title: 'Error',
    message: txt.length > 280 ? txt.slice(0, 280) + '…' : txt || 'Error desconocido.',
  };
}
