// El cableado, que las funciones puras no cubren: cuál de los dos campos es la
// VERDAD del renglón y qué se le devuelve al padre. Equivocarse aquí es el bug
// original con otro disfraz — teclear bultos y guardar kilos.
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CantidadDual from './CantidadDual';

/** Padre real: guarda lo que el componente le devuelve y se lo regresa. */
function Anfitrion({ capturaEn = 'base', factor = 25, inicial = '', onValor }) {
  const [v, setV] = useState(inicial);
  return (
    <CantidadDual valor={v} onValor={x => { setV(x); onValor?.(x); }}
      factor={factor} uomBase="Kg" presentacion="BULTO" capturaEn={capturaEn} />
  );
}

const campos = () => screen.getAllByRole('spinbutton');

describe('CantidadDual — el cableado', () => {
  it('🔴 teclear 2 en BULTO guarda 50 Kg, no 2', () => {
    const espia = vi.fn();
    render(<Anfitrion onValor={espia} />);
    const [kg, bulto] = campos();
    fireEvent.change(bulto, { target: { value: '2' } });
    // Lo que sube al padre es la VERDAD en unidad base.
    expect(espia).toHaveBeenLastCalledWith('50');
    expect(kg.value).toBe('50');
  });

  it('en compras la verdad son los BULTOS: teclear 50 Kg guarda 2', () => {
    const espia = vi.fn();
    render(<Anfitrion capturaEn="presentacion" onValor={espia} />);
    const [kg] = campos();
    fireEvent.change(kg, { target: { value: '50' } });
    expect(espia).toHaveBeenLastCalledWith('2');
  });

  it('🔴 el punto decimal sobrevive a media tecleada', () => {
    // "1." es el estado entre el 1 y el 5 de "1.5". Sin el borrador, el campo se
    // repinta como "1" y se come el punto: no se puede teclear medio bulto.
    render(<Anfitrion />);
    const [, bulto] = campos();
    fireEvent.change(bulto, { target: { value: '1.' } });
    expect(bulto.value).toBe('1.');
    fireEvent.change(bulto, { target: { value: '1.5' } });
    expect(bulto.value).toBe('1.5');
    expect(campos()[0].value).toBe('37.5');
  });

  it('borrar un campo deja el otro vacío, no en cero', () => {
    render(<Anfitrion inicial="50" />);
    const [kg, bulto] = campos();
    expect(bulto.value).toBe('2');
    fireEvent.change(kg, { target: { value: '' } });
    expect(bulto.value).toBe('');
  });

  it('sin presentación real no aparece el segundo campo', () => {
    // factor 1 = no hay nada que convertir. Un segundo input que siempre repite
    // el mismo número solo estorba y se teclea por error.
    render(<CantidadDual valor="5" onValor={() => {}} factor={1} uomBase="PZA"
                         presentacion="" capturaEn="base" />);
    expect(campos()).toHaveLength(1);
  });
});
