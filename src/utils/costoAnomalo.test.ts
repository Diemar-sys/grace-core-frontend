import { describe, it, expect } from 'vitest';
import { revisarCostoUnitario, costoPorUnidadBase } from './costoAnomalo';

describe('costoAnomalo — el caso real que costó $8,846.23', () => {
  // MAT-PRE-2026-00095: 200 CAJA a rate 52.90, cuando la CAJA son 20 Kg.
  // La persona llenó el renglón en kilos con la UOM en CAJA.
  it('caza el error de UOM del 02-jul', () => {
    const costo = costoPorUnidadBase(52.9, 20);
    expect(costo).toBeCloseTo(2.645, 4);

    const r = revisarCostoUnitario(costo, 51.7593, 12)!;
    expect(r.nivel).toBe('bloqueo');
    expect(r.barato).toBe(true);
    expect(r.factor).toBeGreaterThan(19);
  });

  // 🔴 El mismo renglón capturado BIEN tiene que pasar sin molestar. Si una
  // alerta se prende en la captura correcta, la gente aprende a ignorarla y
  // volvemos justo al 02-jul.
  it('deja pasar la captura correcta del MISMO item', () => {
    const costo = costoPorUnidadBase(1035.185185, 20);
    expect(costo).toBeCloseTo(51.7593, 4);
    expect(revisarCostoUnitario(costo, 51.7593)!.nivel).toBe('ok');
  });

  // 🔴 La trampa del millón: la TAPITA se registra a $450 el PAQUETE de 2,500 y
  // vale $0.18 la pieza. La alerta vieja no la ve porque compara presentación
  // contra presentación: el rate de $450 es correcto.
  it('la presentación grande capturada bien NO se marca', () => {
    const costo = costoPorUnidadBase(450, 2500);
    expect(costo).toBeCloseTo(0.18, 4);
    expect(revisarCostoUnitario(costo, 0.18)!.nivel).toBe('ok');
  });

  it('pero la misma tapita con la UOM equivocada sí se bloquea', () => {
    // Teclea 450 como si fuera el precio de la PIEZA.
    expect(revisarCostoUnitario(450, 0.18, 5)!.nivel).toBe('bloqueo');
    expect(revisarCostoUnitario(450, 0.18, 5)!.barato).toBe(false);
  });

  it('un alza real de precio avisa pero no bloquea', () => {
    // Guantes: $16.2588 -> $28.99 la caja el 03-sep. 78% de alza, legítima.
    expect(revisarCostoUnitario(0.2899, 0.1626)!.nivel).toBe('ok');
    // Un 4× sí merece que alguien lo mire, sin cortarle la captura.
    expect(revisarCostoUnitario(0.65, 0.1626)!.nivel).toBe('aviso');
  });

  // 🔴 Un item nuevo no es sospechoso. Alertar sin historia es ruido puro.
  it('sin historia no inventa alerta', () => {
    expect(revisarCostoUnitario(51.75, 0)).toBeNull();
    expect(revisarCostoUnitario(51.75, null)).toBeNull();
    expect(revisarCostoUnitario(51.75, undefined)).toBeNull();
  });

  it('sin precio capturado tampoco', () => {
    expect(revisarCostoUnitario(0, 51.7593)).toBeNull();
    expect(revisarCostoUnitario('', 51.7593)).toBeNull();
  });

  // Sin presentación el rate ya viene en unidad base: no dividir entre nada.
  // Dividir de más es el error del 28-ago, que valuó 100 veces abajo.
  it('sin presentación el rate no se toca', () => {
    expect(costoPorUnidadBase(120, 0)).toBe(120);
    expect(costoPorUnidadBase(120, null)).toBe(120);
    expect(costoPorUnidadBase(120, 1)).toBe(120);
  });

  // 🔴 CAPACILLO #74: dos compras, una podrida (1 PZA a $1,559.88 = una CAJA
  // capturada como pieza). La mediana de dos es $780.03 y el capacillo vale
  // $0.1729. Con ese histórico, bloquear la captura CORRECTA seria el colmo.
  it('con menos de 3 compras avisa pero NO bloquea', () => {
    const r = revisarCostoUnitario(0.1729, 780.03, 2)!;
    expect(r.nivel).toBe('aviso');
    expect(r.confiable).toBe(false);
    expect(r.factor).toBeGreaterThan(4000);
  });

  it('con historia suficiente el mismo caso sí bloquea', () => {
    expect(revisarCostoUnitario(0.1729, 780.03, 3)!.nivel).toBe('bloqueo');
  });

  it('los cortes son simétricos: caro y barato se miden igual', () => {
    expect(revisarCostoUnitario(30, 10)!.factor).toBe(3);
    expect(revisarCostoUnitario(10, 30)!.factor).toBe(3);
    expect(revisarCostoUnitario(30, 10)!.nivel).toBe('aviso');
    expect(revisarCostoUnitario(10, 30)!.nivel).toBe('aviso');
  });
});
