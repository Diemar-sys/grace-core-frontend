import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useInsumoForm from './useInsumoForm';
import { inventory } from '../services/frappeInventory';

// 04-nov: al elegir categoría se sugiere la clave interna N+1 de su serie
// (VELAS → B0026). Lo que puede mentir: pisar la clave que el usuario tecleó,
// dejar la sugerencia de la categoría anterior, aceptar la respuesta tardía de
// una categoría que ya no está elegida, o sugerir al EDITAR (cambiaría la clave).
const grupo = (g) => ({ target: { value: g } });
const SERIES = { VELAS: 'B0026', HARINA: 'H0024' };

describe('useInsumoForm — clave interna N+1', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(inventory, '_fetch').mockResolvedValue({ data: [] });
    vi.spyOn(inventory, 'siguienteCodigoInterno').mockImplementation(async (g = '') => SERIES[g] ?? null);
  });

  it('elegir categoría llena la clave interna', async () => {
    const { result } = renderHook(() => useInsumoForm({}));
    act(() => result.current.handleItemGroupChange(grupo('VELAS')));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe('B0026'));
  });

  it('cambiar de categoría reemplaza la sugerencia anterior', async () => {
    const { result } = renderHook(() => useInsumoForm({}));
    act(() => result.current.handleItemGroupChange(grupo('VELAS')));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe('B0026'));
    act(() => result.current.handleItemGroupChange(grupo('HARINA')));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe('H0024'));
  });

  it('categoría sin serie borra la sugerencia anterior', async () => {
    const { result } = renderHook(() => useInsumoForm({}));
    act(() => result.current.handleItemGroupChange(grupo('VELAS')));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe('B0026'));
    act(() => result.current.handleItemGroupChange(grupo('PAPELERIA')));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe(''));
  });

  it('lo tecleado a mano no se pisa', async () => {
    const { result } = renderHook(() => useInsumoForm({}));
    act(() => result.current.handleChange({ target: { name: 'custom_código_interno', value: 'X0001', type: 'text' } }));
    act(() => result.current.handleItemGroupChange(grupo('VELAS')));
    await waitFor(() => expect(inventory.siguienteCodigoInterno).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.formData.custom_código_interno).toBe('X0001');
  });

  it('respuesta tardía de la categoría anterior no gana', async () => {
    let soltarVelas;
    inventory.siguienteCodigoInterno.mockImplementation((g = '') =>
      g === 'VELAS' ? new Promise(r => { soltarVelas = () => r('B0026'); }) : Promise.resolve(SERIES[g] ?? null));
    const { result } = renderHook(() => useInsumoForm({}));
    act(() => result.current.handleItemGroupChange(grupo('VELAS')));
    act(() => result.current.handleItemGroupChange(grupo('HARINA')));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe('H0024'));
    await act(async () => { soltarVelas(); });
    expect(result.current.formData.custom_código_interno).toBe('H0024');
  });

  it('al editar no se sugiere nada', async () => {
    const editItem = { item_code: 'MP_X', item_group: 'HARINA', custom_código_interno: 'H0003' };
    const { result } = renderHook(() => useInsumoForm({ editItem }));
    await waitFor(() => expect(result.current.formData.custom_código_interno).toBe('H0003'));
    act(() => result.current.handleItemGroupChange(grupo('VELAS')));
    await act(async () => {});
    expect(inventory.siguienteCodigoInterno).not.toHaveBeenCalled();
    expect(result.current.formData.custom_código_interno).toBe('H0003');
  });
});
