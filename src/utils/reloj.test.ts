import { readFileSync } from 'node:fs';
import { textoReloj } from './reloj';

describe('textoReloj', () => {
  it('fecha corta con día de la semana, en hora local', () => {
    expect(textoReloj(new Date(2026, 9, 8, 11, 42))).toEqual({ fecha: 'jue 08 oct', hora: '11:42 a.m.' });
  });

  it('después de las 18:00 sigue siendo HOY (no UTC)', () => {
    // vite.config.js corre los tests en America/Mexico_City: en UTC esto ya sería viernes 09
    expect(textoReloj(new Date(2026, 9, 8, 18, 5)).fecha).toBe('jue 08 oct');
  });

  it('12 horas: mediodía es p.m., medianoche es 12 a.m., minutos con cero', () => {
    expect(textoReloj(new Date(2026, 9, 8, 12, 0)).hora).toBe('12:00 p.m.');
    expect(textoReloj(new Date(2026, 9, 8, 0, 7)).hora).toBe('12:07 a.m.');
    expect(textoReloj(new Date(2026, 9, 8, 23, 59)).hora).toBe('11:59 p.m.');
  });

  it('el reloj está en las DOS barras (Panel no pasa por Layout)', () => {
    for (const f of ['src/components/Layout.jsx', 'src/pages/Panel.jsx']) {
      expect(readFileSync(f, 'utf8')).toMatch(/<Reloj \/>/);
    }
  });
});
