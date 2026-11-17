import { describe, it, expect } from 'vitest';
import { resolverCodigoInterno } from './useInsumoForm';

// El campo custom_código_interno es reqd en Item, pero la pantalla de Pan no lo pide:
// ahí el ID del pan es el item_code. Sin este espejo, registrar un pan truena con
// "Falta ingresar un valor para -> Item: Código interno".
describe('resolverCodigoInterno', () => {
  it('sin código interno tecleado, espeja el item_code (caso pan)', () => {
    expect(resolverCodigoInterno('', 'PT_CONCHA')).toBe('PT_CONCHA');
  });

  it('normaliza a mayúsculas al espejar', () => {
    expect(resolverCodigoInterno('', ' pt_concha ')).toBe('PT_CONCHA');
  });

  it('respeta el código propio del negocio (caso insumo)', () => {
    // GALLETA en prod: item_code MP_GALLETA_SUR__MINI, código interno 1023
    expect(resolverCodigoInterno('1023', 'MP_GALLETA_SUR__MINI')).toBe('1023');
  });

  it('al renombrar, el código espejeado sigue al nuevo item_code', () => {
    expect(resolverCodigoInterno('PT_CONCHA', 'PT_CONCHA_GDE', 'PT_CONCHA')).toBe('PT_CONCHA_GDE');
  });

  it('al renombrar, el código propio NO se toca', () => {
    expect(resolverCodigoInterno('1023', '1023', 'MP_GALLETA_SUR__MINI')).toBe('1023');
  });

  it('campos vacíos no producen undefined', () => {
    expect(resolverCodigoInterno(undefined, undefined)).toBe('');
  });
});

// 04-nov: alta desde el escáner de Compras — la clave nace con el código de la bolsa.
import { renderHook as renderHook2 } from '@testing-library/react';
import { vi as vi2, beforeEach as beforeEach2 } from 'vitest';
import useInsumoForm2 from './useInsumoForm';
import { inventory as inventory2 } from '../services/frappeInventory';
describe('useInsumoForm — codigoInicial', () => {
  beforeEach2(() => { vi2.spyOn(inventory2, '_fetch').mockResolvedValue({ data: [] }); });
  it('la clave arranca con el código escaneado', () => {
    const { result } = renderHook2(() => useInsumoForm2({ codigoInicial: '7501111111111' }));
    expect(result.current.formData.item_code).toBe('7501111111111');
  });
  it('sin código, la clave arranca vacía', () => {
    const { result } = renderHook2(() => useInsumoForm2({}));
    expect(result.current.formData.item_code).toBe('');
  });
});
