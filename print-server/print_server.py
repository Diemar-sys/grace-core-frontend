#!/usr/bin/env python3
from flask import Flask, request, jsonify, make_response
from escpos.printer import File
from datetime import datetime
import traceback
import glob
import os
import sys

app = Flask(__name__)

# Permitir peticiones desde cualquier IP de la red local por defecto (*)
# En producción muy estricta, puedes poner el dominio exacto.
ALLOWED_ORIGIN = os.environ.get('PRINT_ALLOWED_ORIGIN', '*')


def resolve_dev_path():
    explicit = os.environ.get('PRINTER_DEV')
    if explicit:
        return explicit
    candidates = sorted(glob.glob('/dev/usb/lp*'))
    return candidates[0] if candidates else '/dev/usb/lp0'


def get_printer():
    if sys.platform == 'win32':
        from escpos.printer import Win32Raw
        # Nombre de la impresora instalada en el Panel de Control de Windows
        printer_name = os.environ.get('PRINTER_NAME', 'SICAR')
        return Win32Raw(printer_name)
    else:
        from escpos.printer import File
        return File(resolve_dev_path(), profile="default")

def fmt(n):
    return f"${float(n or 0):,.2f}"


# ── Renderizado de ticket como IMAGEN (fuente TTF pequeña) ────────────────────
# ESC/POS solo trae fuentes A/B; para letra más chica y evitar cortes con
# cantidades fraccionarias + precios largos, dibujamos el ticket con PIL y lo
# mandamos como imagen. Ancho en puntos configurable por printer (58mm≈384).
from PIL import Image, ImageDraw, ImageFont

# Fuente: env > la empacada junto a este script > la del sistema. Empacar el
# .ttf hace al print-server self-contained (la torre puede no traer DejaVu).
_HERE = os.path.dirname(os.path.abspath(__file__))
_FONT_CANDIDATES = [
    os.environ.get('TICKET_FONT'),
    os.path.join(_HERE, 'DejaVuSansMono.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
]
FONT_PATH = next((p for p in _FONT_CANDIDATES if p and os.path.exists(p)), _FONT_CANDIDATES[-1])
PRINTER_DOTS = int(os.environ.get('PRINTER_DOTS', '576'))
_FONT_CACHE = {}


def _font(size):
    if size not in _FONT_CACHE:
        _FONT_CACHE[size] = ImageFont.truetype(FONT_PATH, size)
    return _FONT_CACHE[size]


def _cols(size, width=PRINTER_DOTS, margin=8):
    d = ImageDraw.Draw(Image.new('L', (10, 10), 255))
    cw = d.textlength('0', font=_font(size)) or 1
    return int((width - 2 * margin) / cw)


def _pad_lr(left, right, cols):
    """left a la izquierda, right pegado a la derecha (monospace = alineado)."""
    if len(left) + len(right) + 1 > cols:
        return (left + ' ' + right)[:cols]
    return left + right.rjust(cols - len(left))


def _qty(q):
    q = float(q or 0)
    return str(int(q)) if q == int(q) else f"{q:.3f}".rstrip('0').rstrip('.')


def render_lines_image(rows, width=PRINTER_DOTS, margin=8):
    """rows: [{'text','size','align'} | {'rule':True}] -> PIL Image B/N para térmica."""
    heights = []
    for r in rows:
        if r.get('rule'):
            heights.append(8)
        else:
            asc, desc = _font(r['size']).getmetrics()
            heights.append(asc + desc + 4)
    img = Image.new('L', (width, sum(heights) + 2 * margin), 255)
    d = ImageDraw.Draw(img)
    y = margin
    for r, h in zip(rows, heights):
        if r.get('rule'):
            d.line([(margin, y + 3), (width - margin, y + 3)], fill=0, width=1)
            y += h
            continue
        f = _font(r['size'])
        if 'lr' in r:
            left, right = r['lr']
            d.text((margin, y), left, font=f, fill=0)
            rw = d.textlength(right, font=f)
            d.text((width - margin - rw, y), right, font=f, fill=0)
            y += h
            continue
        w = d.textlength(r['text'], font=f)
        align = r.get('align', 'l')
        x = (width - w) / 2 if align == 'c' else (width - margin - w) if align == 'r' else margin
        d.text((x, y), r['text'], font=f, fill=0)
        y += h
    return img.convert('1')


def render_b2b_image(data):
    """Mismo contenido/formato que el PDF de ventas (ModalReciboPDF), en chico."""
    body = 22
    small = 18
    cols = _cols(body)
    money = fmt
    titulo = 'PREVENTA - PENDIENTE' if data.get('es_borrador') else 'COMPROBANTE DE VENTA'
    rows = [
        {'text': 'GRACE', 'size': 34, 'align': 'c'},
        {'text': 'Panaderia & Reposteria', 'size': 18, 'align': 'c'},
        {'rule': True},
        {'text': titulo, 'size': 22, 'align': 'c'},
        {'rule': True},
        {'text': f"No. Venta:  #{data['num_str']}", 'size': body},
        {'text': f"Fecha:      {data['fecha']}", 'size': body},
        {'text': f"Hora:       {data['hora']}", 'size': body},
        {'text': f"Cliente:    {str(data['cliente'])[:cols - 12]}", 'size': body},
        {'rule': True},
        {'lr': ('PRODUCTO', 'TOTAL'), 'size': body},
        {'rule': True},
    ]
    for it in data['items']:
        nombre = str(it.get('item_name') or it.get('item_code') or '')
        qty = float(it.get('qty', 0) or 0)
        uom = str(it.get('uom', '') or '')
        rate = float(it.get('rate', 0) or 0)
        imp_rate = float(it.get('impuesto_rate', 0) or 0)
        imp_label = str(it.get('impuesto_label', '') or '')
        cant_pres = float(it.get('cantidad_por_presentacion', 0) or 0)
        presentacion = str(it.get('presentacion', '') or '')
        sub = qty * rate
        imp_monto = sub * imp_rate
        total_linea = sub + imp_monto
        rows.append({'text': nombre[:cols], 'size': body})
        rows.append({'lr': (f"  {_qty(qty)} {uom} x {money(rate)}".rstrip(), money(total_linea)), 'size': body})
        # Sub-línea de presentación (ej: 0.06 PZA -> "(1 CAJA)"), como el PDF.
        if cant_pres > 1 and presentacion:
            rows.append({'text': f"    ({_qty(qty / cant_pres)} {presentacion})", 'size': small})
        if imp_monto > 0:
            rows.append({'lr': (f"    {imp_label}", money(imp_monto)), 'size': small})
    rows.append({'rule': True})

    def tline(label, val):
        rows.append({'lr': (label, money(val)), 'size': body})

    tline('Subtotal IVA 16%', data.get('subtotal_iva16', 0))
    tline('Subtotal IEPS 8%', data.get('subtotal_ieps', 0))
    tline('Subtotal IVA 0%', data.get('subtotal_tasa0', 0))
    tline('Subtotal', data['subtotal'])
    if data['iva'] > 0:
        tline('IVA 16%', data['iva'])
    if data['ieps'] > 0:
        tline('IEPS 8%', data['ieps'])
    if data['ajuste'] != 0:
        tline('Ajuste', data['ajuste'])
    rows.append({'rule': True})
    rows.append({'lr': ('TOTAL:', money(data['total'])), 'size': 30})
    rows.append({'rule': True})
    return render_lines_image(rows)


def render_compra_image(data):
    """Ticket de compra (resumen con desglose de impuestos), en imagen chica."""
    body = 22
    money = fmt
    titulo = 'PRECOMPRA - PENDIENTE' if data.get('es_borrador') else 'COMPROBANTE DE COMPRA'
    rows = [
        {'text': 'GRACE', 'size': 34, 'align': 'c'},
        {'text': 'Panaderia & Reposteria', 'size': 18, 'align': 'c'},
        {'rule': True},
        {'text': titulo, 'size': 22, 'align': 'c'},
        {'rule': True},
        {'text': f"No. Compra:  #{data['num_str']}", 'size': body},
        {'text': f"No. Factura: {str(data['no_factura'])[:25]}", 'size': body},
        {'text': f"Proveedor:   {str(data['proveedor'])[:25]}", 'size': body},
        {'text': f"Facturado a: {str(data['facturado_a'])[:25]}", 'size': body},
        {'text': f"Estado pago: {'PAGADO' if data['pagado'] else 'PENDIENTE'}", 'size': body},
        {'text': f"Fecha:       {data['fecha']}", 'size': body},
        {'text': f"Hora:        {data['hora']}", 'size': body},
        {'rule': True},
    ]

    def tline(label, val):
        rows.append({'lr': (label, money(val)), 'size': body})

    tline('Subtotal IVA 16%', data['subtotal_iva16'])
    tline('Subtotal IEPS 8%', data['subtotal_ieps'])
    tline('Subtotal IVA 0%', data['subtotal_tasa0'])
    tline('Subtotal', data['subtotal'])
    if data['descuento'] > 0:
        tline('Descuento', -data['descuento'])
    if data['iva'] > 0:
        tline('IVA 16%', data['iva'])
    if data['ieps'] > 0:
        tline('IEPS 8%', data['ieps'])
    if data['ajuste'] != 0:
        tline('Ajuste', data['ajuste'])
    rows.append({'rule': True})
    rows.append({'lr': ('TOTAL:', money(data['total'])), 'size': 30})
    rows.append({'rule': True})
    return render_lines_image(rows)


def render_traspaso_image(data):
    """Ticket de traspaso a sucursal (productos + cantidad, firmas, Nota.), imagen."""
    body = 22
    small = 18
    cols = _cols(body)
    rows = [
        {'text': 'GRACE', 'size': 34, 'align': 'c'},
        {'text': 'Panaderia & Reposteria', 'size': 18, 'align': 'c'},
        {'rule': True},
        {'text': 'TRASPASO A SUCURSAL', 'size': 22, 'align': 'c'},
        {'rule': True},
        {'text': f"Sucursal:  {str(data['sucursal'])[:cols - 11]}", 'size': body},
        {'text': f"Destino:   {str(data['destino'])[:cols - 11]}", 'size': body},
        {'text': f"No. envio: {str(data['no_envio'])[:cols - 11]}", 'size': body},
        {'text': f"Fecha:     {data['fecha']}", 'size': body},
        {'text': f"Hora:      {data['hora']}", 'size': body},
        {'text': f"Origen:    {str(data['origen'])[:cols - 11]}", 'size': body},
        {'rule': True},
        {'lr': ('PRODUCTO', 'CANTIDAD'), 'size': body},
        {'rule': True},
    ]
    for it in data['items']:
        nombre = str(it.get('item_name') or it.get('item_code') or '')
        qty = float(it.get('qty', 0) or 0)
        uom = str(it.get('uom', '') or '')
        cant_pres = float(it.get('cantidad_por_presentacion', 0) or 0)
        presentacion = str(it.get('presentacion', '') or '')
        rows.append({'lr': (nombre[:cols - 12], f"{_qty(qty)} {uom}".strip()), 'size': body})
        if cant_pres > 1 and presentacion:
            rows.append({'lr': ('', f"({_qty(qty / cant_pres)} {presentacion})"), 'size': small})
    rows.append({'rule': True})
    rows.append({'text': f"Articulos: {len(data['items'])}", 'size': body})
    # Firmas (espacio para firmar + línea + etiqueta)
    for etiqueta in ('Firma de quien entrega', 'Firma de quien recibe'):
        rows.append({'text': '', 'size': body})
        rows.append({'text': '', 'size': body})
        rows.append({'rule': True})
        rows.append({'text': etiqueta, 'size': body})
    rows.append({'text': '', 'size': body})
    rows.append({'text': 'Nota.', 'size': body})
    return render_lines_image(rows)


@app.route('/imprimir', methods=['POST', 'OPTIONS'])
def imprimir():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)
        items   = data.get('items', [])
        cliente = data.get('cliente', 'Publico en General')
        pagos   = data.get('pagos', [])
        total   = float(data.get('total', 0))
        cambio  = float(data.get('cambio', 0))

        p = get_printer()
        try:
            # Encabezado
            p.set(font ='b', align='center', bold=True, double_height=True, double_width=True)
            p.text("GRACE\n")
            p.set(align='center', bold=False, double_height=False, double_width=False)
            p.text("Panaderia & Reposteria\n")
            p.text("AV. SANTUARIO DEL MILAGRO\n")
            p.text("TEL. 4425991147\n")
            p.text("-" * 24 + "\n")

            # Info venta
            now = datetime.now()
            p.set(align='left')
            p.text(f"FECHA : {now.strftime('%d/%m/%Y')}\n")
            p.text(f"HORA  : {now.strftime('%H:%M')}\n")
            p.text(f"CLIENTE: {cliente}\n")
            p.text("=" * 24 + "\n")
            p.set(align='center', bold=True)
            p.text("** TICKET DE VENTA **\n")
            p.set(align='left', bold=False)
            p.text("-" * 24 + "\n")

            # Items
            total_qty = 0
            for item in items:
                qty      = item.get('qty', 1)
                nombre   = item.get('item_name', '')[:20]
                precio   = float(item.get('precio', 0))
                subtotal = qty * precio
                total_qty += qty
                p.text(f"{nombre}\n")
                p.text(f"  {qty} x {fmt(precio):>10}  {fmt(subtotal):>10}\n")

            p.text("-" * 24 + "\n")
            p.text(f"ARTICULOS: {total_qty}\n")
            p.text("=" * 24 + "\n")

            # Total
            p.set(bold=True, double_height=True)
            p.text(f"TOTAL: {fmt(total):>18}\n")
            p.set(bold=False, double_height=False)
            p.text("=" * 24 + "\n")

            # Pagos
            for pago in pagos:
                if float(pago.get('monto', 0)) > 0:
                    metodo = pago.get('metodo', '').upper()
                    monto  = float(pago.get('monto', 0))
                    p.text(f"{metodo:<16}{fmt(monto):>16}\n")
            if cambio > 0:
                p.text(f"{'CAMBIO':<16}{fmt(cambio):>16}\n")

            # Pie
            p.text("-" * 24 + "\n")
            p.set(align='center')
            p.text("GRACIAS POR SU COMPRA\n")
            p.text("www.panaderiasgrace.mx\n")
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)

FORMA_PAGO_LABEL = {
    'Cash':          'Efectivo',
    'Bank Draft':    'Tarjeta',
    'Wire Transfer': 'Transferencia',
}

@app.route('/imprimir-corte', methods=['POST', 'OPTIONS'])
def imprimir_corte():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)
        rango_inicio      = data.get('rango_inicio', '')
        rango_fin         = data.get('rango_fin', '')
        num_transacciones = data.get('num_transacciones', 0)
        por_forma_pago    = data.get('por_forma_pago', [])
        por_departamento  = data.get('por_departamento', [])
        total_ventas      = float(data.get('total_ventas', 0))

        es_rango = rango_inicio != rango_fin
        if es_rango:
            periodo = f"{rango_inicio} al {rango_fin}"
        else:
            periodo = rango_inicio

        p = get_printer()
        try:
            # Encabezado
            p.set(align='center', bold=True, double_height=True, double_width=True)
            p.text("GRACE\n")
            p.set(align='center', bold=False, double_height=False, double_width=False)
            p.text("Panaderia & Reposteria\n")
            p.text("-" * 32 + "\n")

            now = datetime.now()
            p.set(align='left')
            p.text(f"PERIODO : {periodo}\n")
            p.text(f"HORA    : {now.strftime('%H:%M')}\n")
            p.text(f"No. VENTAS: {num_transacciones}\n")
            p.text("=" * 32 + "\n")
            p.set(align='center', bold=True)
            p.text("** CORTE DE CAJA **\n")
            p.set(align='left', bold=False)
            p.text("-" * 32 + "\n")

            # Forma de pago
            p.set(bold=True)
            p.text("FORMA DE PAGO\n")
            p.set(bold=False)
            p.text("-" * 32 + "\n")
            for fp in por_forma_pago:
                label = FORMA_PAGO_LABEL.get(fp.get('forma_pago', ''), fp.get('forma_pago', ''))
                total = float(fp.get('total', 0))
                p.text(f"{label.upper():<16}{fmt(total):>16}\n")

            p.text("-" * 32 + "\n")

            # Ventas por categoría
            p.set(bold=True)
            p.text("VENTAS POR CATEGORIA\n")
            p.set(bold=False)
            p.text("-" * 32 + "\n")
            for dep in por_departamento:
                nombre = dep.get('departamento', '')[:16]
                cant   = dep.get('cantidad', 0)
                tot    = float(dep.get('total', 0))
                p.text(f"{nombre:<12}{cant:>4} pz{fmt(tot):>14}\n")

            p.text("=" * 32 + "\n")
            p.set(bold=True, double_height=True)
            label_total = "TOTAL PERIODO:" if es_rango else "TOTAL DEL DIA:"
            p.text(f"{label_total}\n{fmt(total_ventas):>32}\n")
            p.set(bold=False, double_height=False)
            p.text("-" * 32 + "\n")
            p.set(align='center')
            p.text("GRACIAS POR SU COMPRA\n")
            p.text("www.panaderiasgrace.mx\n")
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)

@app.route('/imprimir-compra', methods=['POST', 'OPTIONS'])
def imprimir_compra():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)

        no_compra  = data.get('no_compra')
        no_factura = data.get('no_factura', '') or '-'
        proveedor  = data.get('proveedor', '') or '-'
        facturado_a = (data.get('facturado_a', '') or 'SIN FACTURA').upper()
        pagado      = bool(data.get('pagado', False))
        fecha      = data.get('fecha', '')
        hora       = data.get('hora', '')
        subtotal_iva16 = float(data.get('subtotal_iva16', 0))
        subtotal_ieps  = float(data.get('subtotal_ieps', 0))
        subtotal_tasa0 = float(data.get('subtotal_tasa0', 0))
        subtotal   = float(data.get('subtotal', 0))
        iva        = float(data.get('iva', 0))
        ieps       = float(data.get('ieps', 0))
        ajuste     = float(data.get('ajuste', 0))
        descuento  = float(data.get('descuento', 0))
        total      = float(data.get('total', 0))
        es_borrador = bool(data.get('es_borrador', False))

        num_str = str(no_compra).zfill(4) if no_compra is not None else '----'

        img = render_compra_image({
            'num_str': num_str, 'no_factura': no_factura, 'proveedor': proveedor,
            'facturado_a': facturado_a, 'pagado': pagado, 'fecha': fecha, 'hora': hora,
            'subtotal_iva16': subtotal_iva16, 'subtotal_ieps': subtotal_ieps,
            'subtotal_tasa0': subtotal_tasa0, 'subtotal': subtotal,
            'descuento': descuento, 'iva': iva, 'ieps': ieps, 'ajuste': ajuste,
            'total': total, 'es_borrador': es_borrador,
        })
        p = get_printer()
        try:
            p.image(img)
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)

@app.route('/imprimir-egreso', methods=['POST', 'OPTIONS'])
def imprimir_egreso():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)

        no_egreso     = data.get('no_egreso', '') or '-'
        no_de_compra  = data.get('no_de_compra')  # solo gastos categoría GASTO
        fecha         = data.get('fecha', '')
        categoria     = (data.get('categoria', '') or '').upper()
        subcategoria  = (data.get('subcategoria', '') or '').upper()
        concepto      = data.get('concepto', '') or ''
        facturado_a   = data.get('facturado_a', '') or '-'
        con_factura   = bool(data.get('con_factura', 0))
        no_factura    = data.get('no_factura', '') or ''
        total         = float(data.get('monto', 0))
        impuesto_tipo = (data.get('impuesto_tipo', '') or '').upper()
        monto_impuesto = float(data.get('monto_impuesto', 0))
        gas           = data.get('gas')  # desglose solo para subcategoria GAS

        hora = datetime.now().strftime('%H:%M')

        p = get_printer()
        try:
            # Header
            p.set(font='b', align='center', bold=True, double_height=True, double_width=True)
            p.text("GRACE\n")
            p.set(align='center', bold=False, double_height=False, double_width=False)
            p.text("Panaderia & Reposteria\n")
            p.text("-" * 32 + "\n")
            p.set(align='center', bold=True)
            p.text("** COMPROBANTE DE EGRESO **\n")
            p.set(align='left', bold=False)
            p.text("-" * 32 + "\n")

            # Datos — el consecutivo de COMPRA es el ID protagonista (lo pide
            # contabilidad); el folio interno del egreso queda como referencia.
            if no_de_compra:
                p.set(font='a', align='center', bold=True)
                p.text(f"COMPRA #{no_de_compra}\n")
                p.set(font='b', align='left', bold=False)
                p.text(f"NO. EGRESO  : {no_egreso}\n")
            else:
                p.set(font='b', align='left')
                p.text(f"NO. EGRESO  : {no_egreso}\n")
            if no_factura:
                p.text(f"NO. FACTURA : {no_factura[:18]}\n")
            p.text(f"FECHA       : {fecha}  {hora}\n")
            p.text(f"CATEGORIA   : {categoria[:18]}\n")
            if subcategoria:
                p.text(f"SUBCATEGORIA: {subcategoria[:18]}\n")
            if concepto:
                p.text(f"CONCEPTO    : {concepto[:18]}\n")
            p.text(f"FACTURADO A : {facturado_a[:18]}\n")
            p.text(f"CON FACTURA : {'SI' if con_factura else 'NO'}\n")
            p.text("-" * 32 + "\n")

            # Desglose
            if gas:
                g_lit = float(gas.get('litros', 0)); g_pre = float(gas.get('precio', 0))
                g_sub = float(gas.get('subtotal_gas', g_lit * g_pre))
                a_lit = float(gas.get('aditivo_litros', 0)); a_pre = float(gas.get('aditivo_precio', 0))
                a_sub = float(gas.get('aditivo_subtotal', a_lit * a_pre))
                subtotal  = float(gas.get('subtotal', g_sub + a_sub))
                descuento = float(gas.get('descuento', 0))
                base      = float(gas.get('base', subtotal - descuento))
                iva       = float(gas.get('iva', monto_impuesto))
                p.text("GAS\n")
                p.text(f"  {g_lit:.2f} L x {fmt(g_pre)}{fmt(g_sub):>12}\n")
                if a_lit > 0:
                    p.text("ADITIVO\n")
                    p.text(f"  {a_lit:.2f} L x {fmt(a_pre)}{fmt(a_sub):>12}\n")
                p.text("-" * 32 + "\n")
                p.text(f"{'SUBTOTAL:':<18}{fmt(subtotal):>14}\n")
                if descuento > 0:
                    p.text(f"{'DESCUENTO:':<18}{fmt(-descuento):>14}\n")
                p.text(f"{'BASE GRAVABLE:':<18}{fmt(base):>14}\n")
                p.text(f"{'IVA 16%:':<18}{fmt(iva):>14}\n")
            else:
                base = total - monto_impuesto
                tasa = 'IVA 16%' if impuesto_tipo == 'IVA' else 'IEPS 8%' if impuesto_tipo == 'IEPS' else 'IVA  0%'
                p.text(f"{'SUBTOTAL ' + tasa + ':':<18}{fmt(base):>14}\n")
                p.text(f"{'SUBTOTAL:':<18}{fmt(base):>14}\n")
                if monto_impuesto > 0:
                    p.text(f"{tasa + ':':<18}{fmt(monto_impuesto):>14}\n")
            p.text("-" * 32 + "\n")

            # Total
            p.set(font='a', bold=True)
            p.text(f"TOTAL: {fmt(total):>16}\n")
            p.set(font='b', bold=False, align='center')
            p.text("-" * 32 + "\n")
            p.text(f"Generado {fecha} {hora}\n")
            p.text("www.panaderiasgrace.mx\n")
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)


@app.route('/imprimir-ticket-consolidado', methods=['POST', 'OPTIONS'])
def imprimir_ticket_consolidado():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)

        proveedor = (data.get('proveedor', '') or '-')
        factura   = (data.get('factura', '') or '-')
        fecha     = data.get('fecha', '') or datetime.now().strftime('%d/%m/%Y')
        notas     = data.get('notas', []) or []
        gran_total = sum(float(n.get('total') or 0) for n in notas)

        p = get_printer()
        try:
            p.set(font='b', align='center', bold=True, double_height=True, double_width=True)
            p.text("GRACE\n")
            p.set(align='center', bold=False, double_height=False, double_width=False)
            p.text("Panaderia & Reposteria\n")
            p.text("-" * 32 + "\n")
            p.set(align='center', bold=True)
            p.text("** TICKET CONSOLIDADO **\n")
            p.set(align='left', bold=False)
            p.text("-" * 32 + "\n")

            p.set(font='b', align='left')
            p.text(f"PROVEEDOR : {str(proveedor)[:28]}\n")
            p.text(f"FACTURA   : {str(factura)[:28]}\n")
            p.text(f"FECHA     : {fecha}\n")
            p.text(f"FACTURADO A : {str(data.get('facturado_a', '') or 'SIN FACTURA').upper()[:18]}\n")
            p.text("-" * 32 + "\n")
            # ponytail: 9+12+11=32 cols; trailing pad on header forces gap so "#COMPRA"/"REMISION" no se pegan
            p.text(f"{'#COMPRA':<9}{'REMISION':<12}{'TOTAL':>11}\n")
            p.text("-" * 32 + "\n")
            for n in notas:
                num = str(n.get('no_compra') or '-')
                rem = str(n.get('remision') or '-')[:11]
                tot = fmt(float(n.get('total') or 0))
                p.text(f"{('#'+num):<9}{rem:<12}{tot:>11}\n")
            p.text("=" * 32 + "\n")
            p.set(font='a', bold=True)
            p.text(f"GRAN TOTAL:{fmt(gran_total):>11}\n")
            p.set(font='b', bold=False, align='center')
            p.text(f"{len(notas)} nota(s)\n")
            p.text(f"Generado {fecha}\n")
            p.text("www.panaderiasgrace.mx\n")
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)


@app.route('/imprimir-venta-b2b', methods=['POST', 'OPTIONS'])
def imprimir_venta_b2b():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)

        no_venta = data.get('no_venta')
        cliente  = str(data.get('cliente', '') or '-')
        fecha    = data.get('fecha', '')
        hora     = data.get('hora', '')
        items    = data.get('items', [])
        subtotal = float(data.get('subtotal', 0))
        iva      = float(data.get('iva', 0))
        ieps     = float(data.get('ieps', 0))
        ajuste   = float(data.get('ajuste', 0))
        total    = float(data.get('total', 0))
        num_str  = str(no_venta).zfill(4) if no_venta is not None else '----'

        img = render_b2b_image({
            'num_str': num_str, 'cliente': cliente, 'fecha': fecha, 'hora': hora,
            'items': items, 'subtotal': subtotal, 'iva': iva, 'ieps': ieps,
            'subtotal_iva16': float(data.get('subtotal_iva16', 0)),
            'subtotal_ieps': float(data.get('subtotal_ieps', 0)),
            'subtotal_tasa0': float(data.get('subtotal_tasa0', 0)),
            'ajuste': ajuste, 'total': total,
            'es_borrador': bool(data.get('es_borrador', 0)),
        })
        p = get_printer()
        try:
            p.image(img)
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)


@app.route('/imprimir-traspaso', methods=['POST', 'OPTIONS'])
def imprimir_traspaso():
    if request.method == 'OPTIONS':
        return cors(make_response('', 200))
    try:
        data = request.get_json(force=False, silent=True)
        if not data:
            return cors(jsonify({'ok': False, 'error': 'Se requiere Content-Type: application/json y un cuerpo JSON válido'}), 400)

        sucursal = (data.get('sucursal', '') or '-')
        destino  = (data.get('warehouse_destino', '') or '-')
        no_envio = (data.get('no_envio', '') or '-')
        fecha    = data.get('fecha', '')
        hora     = data.get('hora', '')
        origen   = (data.get('origen', '') or 'Bodega Central')
        items    = data.get('items', [])

        img = render_traspaso_image({
            'sucursal': sucursal, 'destino': destino, 'no_envio': no_envio,
            'fecha': fecha, 'hora': hora, 'origen': origen, 'items': items,
        })
        p = get_printer()
        try:
            p.image(img)
            p.text("\n\n")
            p.cut()
        finally:
            p.close()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        traceback.print_exc()
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)


def cors(response, status=None):
    if status:
        response.status_code = status
    response.headers['Access-Control-Allow-Origin']  = ALLOWED_ORIGIN
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return response

if __name__ == '__main__':
    # 0.0.0.0: el nginx del frontend (en contenedor) llega vía host-gateway.
    # En LAN confiable; el acceso real se controla en nginx (location /print).
    print("Servidor de impresion corriendo en http://0.0.0.0:6789")
    app.run(host='0.0.0.0', port=6789, debug=False, use_reloader=False)
