import { describe, it, expect, vi } from 'vitest';
import { parseErrorFrappe, logError } from './errorFrappe';

describe('errorFrappe — parseErrorFrappe (traducción de errores)', () => {
  it('valuation_rate → "Sin stock disponible" con código de artículo', () => {
    const out = parseErrorFrappe(new Error('valuation_rate missing for artículo HARINA-001'));
    expect(out.title).toBe('Sin stock disponible');
    expect(out.message).toContain('HARINA-001');
  });

  it('valoración sin código → mensaje genérico de stock', () => {
    const out = parseErrorFrappe(new Error('Falta tasa de valoración'));
    expect(out.title).toBe('Sin stock disponible');
    expect(out.message).toMatch(/uno o más productos/i);
  });

  it('insufficient stock → "Stock insuficiente"', () => {
    expect(parseErrorFrappe('insufficient stock').title).toBe('Stock insuficiente');
  });

  it('permission → "Sin permisos"', () => {
    expect(parseErrorFrappe('not permitted').title).toBe('Sin permisos');
  });

  it('folio duplicado → título propio, sin HTML', () => {
    const out = parseErrorFrappe(new Error('Ya existe una compra con el folio de factura <b>F-AJ3736</b> para este proveedor'));
    expect(out.title).toBe('Folio de factura duplicado');
    expect(out.message).toContain('F-AJ3736');
    expect(out.message).not.toContain('<b>');
  });

  it('limpia HTML del mensaje crudo de Frappe', () => {
    const out = parseErrorFrappe('<div class="x">Error <b>raro</b></div>');
    expect(out.message).toBe('Error raro');
    expect(out.message).not.toContain('<');
  });

  it('trunca mensajes muy largos a 280 + …', () => {
    const out = parseErrorFrappe('x'.repeat(400));
    expect(out.message.length).toBeLessThanOrEqual(281);
    expect(out.message.endsWith('…')).toBe(true);
  });

  it('defensivo: null/undefined no lanza', () => {
    expect(() => parseErrorFrappe(null)).not.toThrow();
    expect(parseErrorFrappe(undefined).title).toBe('Error');
  });
});

describe('errorFrappe — campo desconocido NO es falta de permisos', () => {
  // El mensaje es TEXTUAL, capturado del backend el 08-sep contra
  // /api/resource/Item con un campo que la base no tenia migrado. Si se
  // reescribe "bonito" el test deja de proteger del caso real.
  const REAL = 'frappe.exceptions.DataError: Field not permitted in query: custom_costo_provisional';

  it('lo clasifica como esquema, no como roles', () => {
    const out = parseErrorFrappe(REAL);
    expect(out.title).toBe('Falta un campo en el servidor');
    expect(out.title).not.toBe('Sin permisos');
  });

  it('nombra el campo que falta y dice qué hacer', () => {
    const out = parseErrorFrappe(REAL);
    expect(out.message).toContain('custom_costo_provisional');
    expect(out.message).toContain('bench migrate');
  });

  it('llega envuelto en HTML, como lo manda Frappe de verdad', () => {
    const out = parseErrorFrappe('<pre>Field not permitted in query: custom_camioneta</pre>');
    expect(out.title).toBe('Falta un campo en el servidor');
    expect(out.message).toContain('custom_camioneta');
  });

  it('un permiso DE VERDAD sigue saliendo como permiso', () => {
    // La regla nueva va antes que la de permisos: hay que probar que no se la comió.
    expect(parseErrorFrappe('frappe.exceptions.PermissionError: Not permitted').title)
      .toBe('Sin permisos');
    expect(parseErrorFrappe('Insufficient Permission for Item').title).toBe('Sin permisos');
    expect(parseErrorFrappe('403 Forbidden').title).toBe('Sin permisos');
  });
});

describe('errorFrappe — logError (punto único)', () => {
  it('registra con contexto', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    logError('Stock origen', err);
    expect(spy).toHaveBeenCalledWith('[Stock origen]', err);
    spy.mockRestore();
  });
});
