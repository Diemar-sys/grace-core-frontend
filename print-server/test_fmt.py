#!/usr/bin/env python3
"""Check de redondeo del ticket: `python3 test_fmt.py`.

El ticket termico y la pantalla tienen que decir lo mismo. Los valores
esperados NO son inventados: son la salida de
`Number(v).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})`,
que es como formatea la app en React.
"""
import sys
import types

# Stub de escpos: el modulo lo importa al cargar y aqui no hay impresora.
_esc = types.ModuleType('escpos')
_pr = types.ModuleType('escpos.printer')


class _Stub:
    def __init__(self, *a, **k):
        pass


_pr.File = _Stub
_pr.Win32Raw = _Stub
_esc.printer = _pr
sys.modules.setdefault('escpos', _esc)
sys.modules.setdefault('escpos.printer', _pr)

from print_server import fmt, fmt_unit  # noqa: E402

CASOS = [
    (329.25 * 22.50, '$7,408.13'),  # el caso que destapo el bug (era 7,408.12)
    (0.125,          '$0.13'),
    (2.675,          '$2.68'),
    (1.005,          '$1.01'),
    (8.615,          '$8.62'),
    (1234.5,         '$1,234.50'),
    (0,              '$0.00'),
    (None,           '$0.00'),
]


def main():
    for valor, esperado in CASOS:
        got = fmt(valor).replace('$-', '-$')
        assert got == esperado, f"fmt({valor!r}) = {got}, esperado {esperado}"

    assert fmt(-0.125).replace('$-', '-$') == '-$0.13'
    # El precio unitario conserva los decimales capturados (cuota IEPS, precio gas).
    assert fmt_unit('6.4556') == '$6.4556', fmt_unit('6.4556')
    assert fmt_unit(9.103422) == '$9.103422', fmt_unit(9.103422)
    assert fmt_unit(13.42) == '$13.42', fmt_unit(13.42)
    print(f"OK — {len(CASOS) + 4} casos de redondeo cuadran con toLocaleString")


if __name__ == '__main__':
    main()
