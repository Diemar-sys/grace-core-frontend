#!/usr/bin/env python3
from flask import Flask, request, jsonify, make_response
from escpos.printer import File
from datetime import datetime

app = Flask(__name__)

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
        data    = request.json
        items   = data.get('items', [])
        cliente = data.get('cliente', 'Público en General')
        pagos   = data.get('pagos', [])
        total   = float(data.get('total', 0))
        cambio  = float(data.get('cambio', 0))

        p = get_printer()

        # Encabezado
        p.set(align='center', bold=True, double_height=True, double_width=True)
        p.text("GRACE\n")
        p.set(align='center', bold=False, double_height=False, double_width=False)
        p.text("Panaderia & Reposteria\n")
        p.text("AV. SANTUARIO DEL MILAGRO\n")
        p.text("TEL. 4425991147\n")
        p.text("-" * 32 + "\n")

        # Info venta
        now = datetime.now()
        p.set(align='left')
        p.text(f"FECHA : {now.strftime('%d/%m/%Y')}\n")
        p.text(f"HORA  : {now.strftime('%H:%M')}\n")
        p.text(f"CLIENTE: {cliente}\n")
        p.text("=" * 32 + "\n")
        p.set(align='center', bold=True)
        p.text("** TICKET DE VENTA **\n")
        p.set(align='left', bold=False)
        p.text("-" * 32 + "\n")

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

        p.text("-" * 32 + "\n")
        p.text(f"ARTICULOS: {total_qty}\n")
        p.text("=" * 32 + "\n")

        # Total
        p.set(bold=True, double_height=True)
        p.text(f"TOTAL: {fmt(total):>18}\n")
        p.set(bold=False, double_height=False)
        p.text("=" * 32 + "\n")

        # Pagos
        for pago in pagos:
            if float(pago.get('monto', 0)) > 0:
                metodo = pago.get('metodo', '').upper()
                monto  = float(pago.get('monto', 0))
                p.text(f"{metodo:<16}{fmt(monto):>16}\n")
        if cambio > 0:
            p.text(f"{'CAMBIO':<16}{fmt(cambio):>16}\n")

        # Pie
        p.text("-" * 32 + "\n")
        p.set(align='center')
        p.text("GRACIAS POR SU COMPRA\n")
        p.text("www.panaderiasgrace.mx\n")
        p.text("\n\n")
        p.cut()

        return cors(jsonify({'ok': True}))
    except Exception as e:
        print(f"Error: {e}")
        return cors(jsonify({'ok': False, 'error': str(e)}), 500)

def cors(response, status=None):
    if status:
        response.status_code = status
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return response

if __name__ == '__main__':
    print("Servidor de impresion corriendo en http://localhost:6789")
    app.run(host='127.0.0.1', port=6789)
