// «No hay dato» y «vale cero» son cosas distintas, y el reporte de valorización
// vive de esa diferencia: la materia prima llega con precio/margen en null
// porque NO SE VENDE. Pintarla como $0.00 diría que se regaló.
import { describe, it, expect } from 'vitest';
import { pesos, piezas } from './ReporteValorizacion';

describe('ReporteValorizacion — formato de dinero', () => {
  it('null y undefined son «—», nunca $0.00', () => {
    expect(pesos(null)).toBe('—');
    expect(pesos(undefined)).toBe('—');
  });

  it('el cero REAL sí se pinta como cero', () => {
    expect(pesos(0)).toBe('$0.00');
  });

  it('nunca escupe NaN a la pantalla', () => {
    expect(pesos('no soy un número')).toBe('—');
    expect(pesos(NaN)).toBe('—');
  });

  it('siempre dos decimales, para arriba y para abajo', () => {
    expect(pesos(1234.5)).toBe('$1,234.50');
    expect(pesos(1234)).toBe('$1,234.00');
  });

  it('el margen negativo conserva el signo (es la señal del reporte)', () => {
    expect(pesos(-100.5)).toBe('-$100.50');
  });

  it('miles con separador: 27930.83 no se lee como 2793083', () => {
    expect(pesos(27930.833)).toBe('$27,930.83');
  });

  it('piezas: sin decimales de dinero, y 0 es 0 (no «—»)', () => {
    expect(piezas(13890)).toBe('13,890');
    expect(piezas(0)).toBe('0');
    expect(piezas(null)).toBe('0');
  });
});
