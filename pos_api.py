# gestion_panaderia/api/pos_api.py
"""
Endpoints @frappe.whitelist() para el módulo de Punto de Venta.

Provee:
  - get_productos_venta   → catálogo de productos terminados
  - get_corte_caja        → resumen de ventas por forma de pago + desglose por departamento
  - get_reporte_ventas    → totales para un rango de fechas libre

Uso desde el frontend:
  /api/method/gestion_panaderia.api.pos_api.<función>
"""

import frappe
from frappe.utils import nowdate


COMPANY = "Panaderias Grace"


# ─────────────────────────────────────────────────────────────────
# CATÁLOGO DE PRODUCTOS PARA VENTA
# ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_productos_venta():
    """
    Retorna todos los artículos de tipo PRODUCTO TERMINADO activos,
    con los campos necesarios para el POS.

    El filtrado por nombre/departamento se hace en el cliente para
    garantizar respuesta instantánea sin requests adicionales.
    """
    items = frappe.get_list(
        "Item",
        fields=[
            "item_code",
            "item_name",
            "custom_precio_de_venta",
            "custom_departamento",
            "stock_uom",
            "custom_código_interno",
        ],
        filters={
            "disabled": 0,
            "custom_tipo_item": "PRODUCTO TERMINADO",
        },
        order_by="item_name asc",
        limit=1000,
    )
    return items


# ─────────────────────────────────────────────────────────────────
# CORTE DE CAJA (rango de fechas libre)
# ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_corte_caja(fecha_inicio=None, fecha_fin=None):
    """
    Genera el resumen de cierre de caja para un rango de fechas.

    Args:
        fecha_inicio (str): Fecha inicio YYYY-MM-DD. Default: hoy.
        fecha_fin    (str): Fecha fin YYYY-MM-DD.   Default: fecha_inicio.

    Returns:
        dict: {
            fecha_inicio, fecha_fin,
            total_ventas, num_transacciones,
            por_forma_pago: [ {forma_pago, total} ],
            por_departamento: [ {departamento, total, cantidad} ]
        }
    """
    fecha_inicio = fecha_inicio or nowdate()
    fecha_fin    = fecha_fin    or fecha_inicio

    params = {"company": COMPANY, "inicio": fecha_inicio, "fin": fecha_fin}

    # ── 1. Totales globales ───────────────────────────────────────
    resumen = frappe.db.sql("""
        SELECT
            COUNT(name)                   AS num_transacciones,
            COALESCE(SUM(grand_total), 0) AS total_ventas
        FROM `tabSales Invoice`
        WHERE docstatus     = 1
          AND company       = %(company)s
          AND posting_date BETWEEN %(inicio)s AND %(fin)s
    """, params, as_dict=True)

    total_ventas      = float(resumen[0].total_ventas)     if resumen else 0.0
    num_transacciones = int(resumen[0].num_transacciones)  if resumen else 0

    # ── 2. Por forma de pago ─────────────────────────────────────
    por_forma_pago = frappe.db.sql("""
        SELECT
            sip.mode_of_payment  AS forma_pago,
            SUM(sip.amount)      AS total
        FROM `tabSales Invoice Payment` sip
        INNER JOIN `tabSales Invoice` si ON si.name = sip.parent
        WHERE si.docstatus    = 1
          AND si.company      = %(company)s
          AND si.posting_date BETWEEN %(inicio)s AND %(fin)s
        GROUP BY sip.mode_of_payment
        ORDER BY total DESC
    """, params, as_dict=True)

    ETIQUETAS = {
        "Cash":          "Efectivo",
        "Credit Card":   "Tarjeta",
        "Bank Transfer": "Transferencia",
    }
    for row in por_forma_pago:
        row["forma_pago"] = ETIQUETAS.get(row["forma_pago"], row["forma_pago"])
        row["total"]      = float(row["total"])

    # ── 3. Por departamento ──────────────────────────────────────
    por_departamento = frappe.db.sql("""
        SELECT
            COALESCE(NULLIF(TRIM(it.custom_departamento), ''), 'Sin departamento') AS departamento,
            SUM(sii.qty * sii.rate) AS total,
            SUM(sii.qty)            AS cantidad
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
        INNER JOIN `tabItem`          it ON it.name = sii.item_code
        WHERE si.docstatus    = 1
          AND si.company      = %(company)s
          AND si.posting_date BETWEEN %(inicio)s AND %(fin)s
        GROUP BY it.custom_departamento
        ORDER BY total DESC
    """, params, as_dict=True)

    for row in por_departamento:
        row["total"]    = float(row["total"])
        row["cantidad"] = int(row["cantidad"])

    return {
        "fecha_inicio":      fecha_inicio,
        "fecha_fin":         fecha_fin,
        "total_ventas":      total_ventas,
        "num_transacciones": num_transacciones,
        "por_forma_pago":    por_forma_pago,
        "por_departamento":  por_departamento,
    }


# ─────────────────────────────────────────────────────────────────
# REPORTE DE VENTAS (rango de fechas libre)
# ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_reporte_ventas(fecha_inicio=None, fecha_fin=None):
    """
    Genera un reporte de ventas para un rango de fechas libre.

    Args:
        fecha_inicio (str): Fecha inicio YYYY-MM-DD. Default: hoy.
        fecha_fin    (str): Fecha fin YYYY-MM-DD.   Default: fecha_inicio.

    Returns:
        dict: {
            fecha_inicio, fecha_fin,
            total_ventas, num_transacciones,
            por_forma_pago:    [...],
            por_departamento:  [...],
            serie_diaria:      [{fecha, total, num_ventas}]  ← cuando rango > 1 día
        }
    """
    fecha_inicio = fecha_inicio or nowdate()
    fecha_fin    = fecha_fin    or fecha_inicio

    params = {"company": COMPANY, "inicio": fecha_inicio, "fin": fecha_fin}

    # ── Totales globales ─────────────────────────────────────────
    resumen = frappe.db.sql("""
        SELECT
            COUNT(name)                   AS num_transacciones,
            COALESCE(SUM(grand_total), 0) AS total_ventas
        FROM `tabSales Invoice`
        WHERE docstatus     = 1
          AND company       = %(company)s
          AND posting_date BETWEEN %(inicio)s AND %(fin)s
    """, params, as_dict=True)

    total_ventas      = float(resumen[0].total_ventas)    if resumen else 0.0
    num_transacciones = int(resumen[0].num_transacciones) if resumen else 0

    # ── Por forma de pago ─────────────────────────────────────────
    por_forma_pago = frappe.db.sql("""
        SELECT
            sip.mode_of_payment AS forma_pago,
            SUM(sip.amount)     AS total
        FROM `tabSales Invoice Payment` sip
        INNER JOIN `tabSales Invoice` si ON si.name = sip.parent
        WHERE si.docstatus    = 1
          AND si.company      = %(company)s
          AND si.posting_date BETWEEN %(inicio)s AND %(fin)s
        GROUP BY sip.mode_of_payment
        ORDER BY total DESC
    """, params, as_dict=True)

    ETIQUETAS = {"Cash": "Efectivo", "Credit Card": "Tarjeta", "Bank Transfer": "Transferencia"}
    for row in por_forma_pago:
        row["forma_pago"] = ETIQUETAS.get(row["forma_pago"], row["forma_pago"])
        row["total"]      = float(row["total"])

    # ── Por departamento ──────────────────────────────────────────
    por_departamento = frappe.db.sql("""
        SELECT
            COALESCE(NULLIF(TRIM(it.custom_departamento), ''), 'Sin departamento') AS departamento,
            SUM(sii.qty * sii.rate) AS total,
            SUM(sii.qty)            AS cantidad
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
        INNER JOIN `tabItem`          it ON it.name = sii.item_code
        WHERE si.docstatus    = 1
          AND si.company      = %(company)s
          AND si.posting_date BETWEEN %(inicio)s AND %(fin)s
        GROUP BY it.custom_departamento
        ORDER BY total DESC
    """, params, as_dict=True)

    for row in por_departamento:
        row["total"]    = float(row["total"])
        row["cantidad"] = int(row["cantidad"])

    # ── Serie diaria (cuando el rango abarca más de un día) ───────
    serie_diaria = []
    if fecha_inicio != fecha_fin:
        serie = frappe.db.sql("""
            SELECT
                posting_date     AS fecha,
                SUM(grand_total) AS total,
                COUNT(name)      AS num_ventas
            FROM `tabSales Invoice`
            WHERE docstatus     = 1
              AND company       = %(company)s
              AND posting_date BETWEEN %(inicio)s AND %(fin)s
            GROUP BY posting_date
            ORDER BY posting_date ASC
        """, params, as_dict=True)

        for row in serie:
            serie_diaria.append({
                "fecha":     str(row["fecha"]),
                "total":     float(row["total"]),
                "num_ventas": int(row["num_ventas"]),
            })

    return {
        "fecha_inicio":      fecha_inicio,
        "fecha_fin":         fecha_fin,
        "total_ventas":      total_ventas,
        "num_transacciones": num_transacciones,
        "por_forma_pago":    por_forma_pago,
        "por_departamento":  por_departamento,
        "serie_diaria":      serie_diaria,
    }
