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
        total      = float(data.get('total', 0))
        es_borrador = bool(data.get('es_borrador', False))

        num_str = str(no_compra).zfill(4) if no_compra is not None else '----'
        titulo = "** PRECOMPRA **" if es_borrador else "** TICKET DE COMPRA **"

        p = get_printer()
        try:
            # Header — font A grande
            p.set(font ='b', align='center', bold=True, double_height=True, double_width=True)
            p.text("GRACE\n")
            p.set(align='center', bold=False, double_height=False, double_width=False)
            p.text("Panaderia & Reposteria\n")
            p.text("-" * 32 + "\n")
            p.set(align='center', bold=True)
            p.text(f"{titulo}\n")
            p.set(align='left', bold=False)
            p.text("-" * 32 + "\n")

            # Body — font B (más pequeño, 42 cols). LPAD da margen izquierdo.
            LPAD = ""
            p.set(font='b', align='left')
            p.text(f"{LPAD}NO. COMPRA  : #{num_str}\n")
            p.text(f"{LPAD}NO. FACTURA : {no_factura[:25]}\n")
            p.text(f"{LPAD}PROVEEDOR   : {proveedor[:25]}\n")
            p.text(f"{LPAD}FACTURADO A : {facturado_a[:25]}\n")
            p.text(f"{LPAD}ESTADO PAGO : {'PAGADO' if pagado else 'PENDIENTE'}\n")
            p.text(f"{LPAD}FECHA       : {fecha}\n")
            p.text(f"{LPAD}HORA        : {hora}\n")
            p.text("-" * 32 + "\n")
            p.text(f"{'SUBTOTAL IVA 16%:':<18}{fmt(subtotal_iva16):>14}\n")
            p.text(f"{'SUBTOTAL IEPS 8%:':<18}{fmt(subtotal_ieps):>14}\n")
            p.text(f"{'SUBTOTAL IVA  0%:':<18}{fmt(subtotal_tasa0):>14}\n")
            ajuste_desglose = round(subtotal - (subtotal_iva16 + subtotal_ieps + subtotal_tasa0), 6)
            if ajuste_desglose != 0:
                p.text(f"{'AJUSTE:':<18}{fmt(ajuste_desglose):>14}\n")
            p.text(f"{'SUBTOTAL:':<18}{fmt(subtotal):>14}\n")
            if iva > 0:
                p.text(f"{'IVA 16%:':<18}{fmt(iva):>14}\n")
            if ieps > 0:
                p.text(f"{'IEPS 8%:':<18}{fmt(ieps):>14}\n")
            if ajuste != 0:
                p.text(f"{'AJUSTE:':<18}{fmt(ajuste):>14}\n")
            p.text("-" * 32 + "\n")

            # Total — font A bold
            p.set(font='a', bold=True)
            p.text(f"{LPAD}TOTAL: {fmt(total):>16}\n")
            p.set(font='b', align='left')
            p.text("-" * 32 + "\n")
            p.set(font='b', bold= False, align='center')
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
                p.text(f"Ref. egreso : {no_egreso}\n")
            else:
                p.set(font='b', align='left')
                p.text(f"NO. EGRESO  : {no_egreso}\n")
            p.text(f"FECHA       : {fecha}  {hora}\n")
            p.text(f"CATEGORIA   : {categoria[:18]}\n")
            if subcategoria:
                p.text(f"SUBCATEGORIA: {subcategoria[:18]}\n")
            if concepto:
                p.text(f"CONCEPTO    : {concepto[:18]}\n")
            p.text(f"FACTURADO A : {facturado_a[:18]}\n")
            p.text(f"CON FACTURA : {'SI' if con_factura else 'NO'}\n")
            if no_factura:
                p.text(f"NO. FACTURA : {no_factura[:18]}\n")
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
                p.text(f"{'BASE:':<18}{fmt(base):>14}\n")
                if monto_impuesto > 0:
                    p.text(f"{impuesto_tipo + ':':<18}{fmt(monto_impuesto):>14}\n")
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
            p.text("-" * 32 + "\n")
            p.text(f"{'#COMPRA':<7}{'REMISION':<15}{'TOTAL':>10}\n")
            p.text("-" * 32 + "\n")
            for n in notas:
                num = str(n.get('no_compra') or '-')
                rem = str(n.get('remision') or '-')[:14]
                tot = fmt(float(n.get('total') or 0))
                p.text(f"#{num:<6}{rem:<15}{tot:>10}\n")
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
