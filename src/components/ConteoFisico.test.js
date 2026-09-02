import { describe, it, expect } from 'vitest';
import { presFactor, presUnit, lineasAjuste, filtrarPorTipo, contarPendientes } from './ConteoFisico';

// El bug del Bin: a Stock Reconciliation siempre se le manda BASE. presFactor=1 solo
// cuando el item ya está en base (sin presentación o factor inválido) → no multiplicar de más.
describe('presFactor / presUnit — conversión presentación→base', () => {
  it('item con presentación (Bulto 25kg) → factor 25, unidad Bulto', () => {
    const it = { custom_cantidad_por_presentación: 25, custom_presentación: 'Bulto', stock_uom: 'Kg' };
    expect(presFactor(it)).toBe(25);
    expect(presUnit(it)).toBe('Bulto');
    // 25 bultos capturados → 625 kg base
    expect(25 * presFactor(it)).toBe(625);
  });
  it('presentación con factor <1 (Caja 0.86kg) → factor 0.86, unidad Caja', () => {
    const it = { custom_cantidad_por_presentación: 0.86, custom_presentación: 'Caja', stock_uom: 'Kg' };
    expect(presFactor(it)).toBe(0.86);
    expect(presUnit(it)).toBe('Caja');
    // 5 cajas capturadas → 4.3 kg base
    expect(5 * presFactor(it)).toBeCloseTo(4.3);
  });
  it('item sin presentación → factor 1, unidad = stock_uom (no multiplica)', () => {
    const it = { stock_uom: 'Pza' };
    expect(presFactor(it)).toBe(1);
    expect(presUnit(it)).toBe('Pza');
  });
  it('factor 1, 0 o basura → 1 (evita romper items en base)', () => {
    expect(presFactor({ custom_cantidad_por_presentación: 1, custom_presentación: 'Pza' })).toBe(1);
    expect(presFactor({ custom_cantidad_por_presentación: 0 })).toBe(1);
    expect(presFactor({})).toBe(1);
    expect(presFactor(null)).toBe(1);
  });
});

// El bug que tumbaba el ajuste: ERPNext truena si NINGÚN ítem cambia. lineasAjuste filtra los que
// ya coinciden con el sistema (comparando en base) para no mandar un reconciliation vacío.
describe('lineasAjuste — solo ítems con diferencia real', () => {
  const items = [
    { item_code: 'HARAAP25', actual_qty: 0 },
    { item_code: 'BARCODE', actual_qty: 3 },
    { item_code: 'BULTO', actual_qty: 100, custom_cantidad_por_presentación: 25, custom_presentación: 'Bulto', stock_uom: 'Kg' },
  ];

  it('conteo == stock → excluido (evita EmptyStockReconciliation)', () => {
    expect(lineasAjuste({ HARAAP25: '0', BARCODE: '3' }, items)).toEqual([]);
  });
  it('conteo != stock → incluido con qty en base', () => {
    expect(lineasAjuste({ BARCODE: '5' }, items)).toEqual([{ item_code: 'BARCODE', qty: 5 }]);
  });
  it('presentación: 4 bultos = 100kg == stock → excluido; 5 bultos = 125 → incluido', () => {
    expect(lineasAjuste({ BULTO: '4' }, items)).toEqual([]);
    expect(lineasAjuste({ BULTO: '5' }, items)).toEqual([{ item_code: 'BULTO', qty: 125 }]);
  });
  it('celdas vacías se ignoran', () => {
    expect(lineasAjuste({ HARAAP25: '', BARCODE: '' }, items)).toEqual([]);
  });
});

// ── Filtro por tipo de item (2026-09-02) ──────────────────────────────────────
// El conteo físico pintaba los 487 items del catálogo, 227 de ellos PAN, con el
// ajuste de inventario a un clic. Se agregó un filtro por tipo; estos casos son
// las tres formas conocidas de que ese filtro haga daño en silencio.
describe('filtrarPorTipo / contarPendientes — filtro del conteo físico', () => {
  const items = [
    { item_code: 'HARINA', custom_tipo_item: 'MATERIA PRIMA' },
    { item_code: 'AZUCAR', custom_tipo_item: 'MATERIA PRIMA' },
    { item_code: 'CONCHA', custom_tipo_item: 'PRODUCTO TERMINADO' },
    { item_code: 'BOLSA',  custom_tipo_item: 'INSUMO GENERAL' },
  ];

  it('sin tipo devuelve TODO, y la misma referencia (no invalida el memo)', () => {
    expect(filtrarPorTipo(items, '')).toBe(items);
  });

  it('con tipo deja solo ese tipo: el pan sale de la vista de materia prima', () => {
    expect(filtrarPorTipo(items, 'MATERIA PRIMA').map(i => i.item_code))
      .toEqual(['HARINA', 'AZUCAR']);
    expect(filtrarPorTipo(items, 'MATERIA PRIMA').map(i => i.item_code))
      .not.toContain('CONCHA');
  });

  it('INSUMO GENERAL no es ni MP ni pan: por eso "Todos" es el default', () => {
    expect(filtrarPorTipo(items, 'MATERIA PRIMA').map(i => i.item_code)).not.toContain('BOLSA');
    expect(filtrarPorTipo(items, 'PRODUCTO TERMINADO').map(i => i.item_code)).not.toContain('BOLSA');
  });

  // El contador es lo que destapó los 115 productos sin contar del cierre de
  // junio: si miente, el faltante deja de avisar.
  it('cuenta SOLO lo capturado dentro del universo, no lo de otros tipos', () => {
    const universo = filtrarPorTipo(items, 'MATERIA PRIMA');
    // Se capturó una MP y un pan. Contra el universo de MP debe contar 1, no 2:
    // si contara 2, "faltan 1 de 2" se volvería "faltan 0" y el aviso se apaga.
    expect(contarPendientes({ HARINA: '5', CONCHA: '9' }, universo)).toBe(1);
    expect(universo.length - contarPendientes({ HARINA: '5', CONCHA: '9' }, universo)).toBe(1);
  });

  it('celda vaciada deja de contar: un "" no es un conteo', () => {
    expect(contarPendientes({ HARINA: '', AZUCAR: '0' }, filtrarPorTipo(items, 'MATERIA PRIMA')))
      .toBe(1);   // el 0 SÍ es un conteo (contado y salió cero); el '' no
  });

  it('cambiar de filtro no borra lo capturado en el otro tipo', () => {
    const conteo = { HARINA: '5', CONCHA: '9' };
    expect(contarPendientes(conteo, filtrarPorTipo(items, 'PRODUCTO TERMINADO'))).toBe(1);
    expect(contarPendientes(conteo, filtrarPorTipo(items, 'MATERIA PRIMA'))).toBe(1);
    expect(contarPendientes(conteo, items)).toBe(2);
  });
});

// 🔴 El motivo por el que el filtro NO recarga `items` desde el servidor.
describe('lineasAjuste — por qué la lista de origen se queda COMPLETA', () => {
  const completo = [
    { item_code: 'BULTO', actual_qty: 100, custom_cantidad_por_presentación: 25,
      custom_presentación: 'Bulto', stock_uom: 'Kg', custom_tipo_item: 'MATERIA PRIMA' },
  ];

  it('con la lista completa: 5 bultos = 125 kg contra un stock de 100', () => {
    expect(lineasAjuste({ BULTO: '5' }, completo)).toEqual([{ item_code: 'BULTO', qty: 125 }]);
  });

  it('si el filtro vaciara la lista, el MISMO conteo mandaría 5 kg y no 125', () => {
    // find() → undefined ⇒ presFactor cae a 1 y actual_qty a 0. No truena: manda
    // un ajuste equivocado. Por eso el filtro de tipo es solo de PINTADO.
    const filtrado = filtrarPorTipo(completo, 'PRODUCTO TERMINADO');   // se queda vacío
    expect(filtrado).toHaveLength(0);
    expect(lineasAjuste({ BULTO: '5' }, filtrado)).toEqual([{ item_code: 'BULTO', qty: 5 }]);
  });
});
