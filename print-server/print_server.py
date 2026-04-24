#!/usr/bin/env python3
from flask import Flask, request, jsonify, make_response
from escpos.printer import File
from datetime import datetime
import traceback
import os

app = Flask(__name__)

# Solo permitir peticiones desde la app local.
# Cambia este valor si el frontend corre en otro puerto en producción.
ALLOWED_ORIGIN = os.environ.get('PRINT_ALLOWED_ORIGIN', 'http://localhost:5173')

DEV_PATH = '/dev/usb/lp0'

def get_printer():
    return File(DEV_PATH, profile="default")

def fmt(n):
    return f"${float(n or 0):.2f}"

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
            p.set(align='center', bold=True, double_height=True, double_width=True)
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

def cors(response, status=None):
    if status:
        response.status_code = status
    response.headers['Access-Control-Allow-Origin']  = ALLOWED_ORIGIN
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return response

if __name__ == '__main__':
    print("Servidor de impresion corriendo en http://localhost:6789")
    app.run(host='127.0.0.1', port=6789)
