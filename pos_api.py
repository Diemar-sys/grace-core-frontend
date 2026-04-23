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
# SESIÓN / PERFIL DE USUARIO
# ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_pos_profile_usuario():
    """Retorna el POS Profile default asignado al usuario activo."""
    result = frappe.db.get_value(
        "POS Profile User",
        {"user": frappe.session.user, "default": 1},
        "parent",
    )
    return result or "Grace POS"


_ROLES_ADMIN    = {"System Manager", "Administrator", "Administrador", "Account Manager", "Sales Manager"}
_ROLES_VENDEDOR = {"Sales User", "POS User", "Vendedor", "Point of Sale User"}

@frappe.whitelist()
def get_user_app_role():
    """Retorna 'admin' o 'vendedor' para el usuario de la sesión activa."""
    roles = set(frappe.get_roles(frappe.session.user))
    if roles & _ROLES_ADMIN:
        return "admin"
    if roles & _ROLES_VENDEDOR:
        return "vendedor"
    return "vendedor"


# ─────────────────────────────────────────────────────────────────
# CATÁLOGO DE PRODUCTOS PARA VENTA
# ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_ventas_historial(fecha_inicio=None, fecha_fin=None, pos_profile=None):
    """Lista de Sales Invoices para el historial del POS."""
    hoy = nowdate()
    desde = fecha_inicio or hoy
    hasta = fecha_fin or desde
    params = {"inicio": desde, "fin": hasta, "pos_profile": pos_profile}
    profile_filter = "AND pos_profile = %(pos_profile)s" if pos_profile else ""

    rows = frappe.db.sql(f"""
        SELECT name, customer, grand_total, creation, docstatus, status
        FROM `tabSales Invoice`
        WHERE docstatus    IN (1, 2)
          AND posting_date BETWEEN %(inicio)s AND %(fin)s
          {profile_filter}
        ORDER BY creation DESC
        LIMIT 500
    """, params, as_dict=True)

    for r in rows:
        r["grand_total"] = float(r["grand_total"])
        r["creation"]    = str(r["creation"])
    return rows


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
def get_corte_caja(fecha_inicio=None, fecha_fin=None, pos_profile=None):
    fecha_inicio = fecha_inicio or nowdate()
    fecha_fin    = fecha_fin    or fecha_inicio

    params = {"company": COMPANY, "inicio": fecha_inicio, "fin": fecha_fin, "pos_profile": pos_profile}
    profile_filter = "AND pos_profile = %(pos_profile)s" if pos_profile else ""

    resumen = frappe.db.sql(f"""
        SELECT
            COUNT(name)                   AS num_transacciones,
            COALESCE(SUM(grand_total), 0) AS total_ventas
        FROM `tabSales Invoice`
        WHERE docstatus    = 1
          AND company      = %(company)s
          AND posting_date BETWEEN %(inicio)s AND %(fin)s
          {profile_filter}
    """, params, as_dict=True)

    total_ventas      = float(resumen[0].total_ventas)    if resumen else 0.0
    num_transacciones = int(resumen[0].num_transacciones) if resumen else 0

    por_forma_pago = frappe.db.sql(f"""
        SELECT
            sip.mode_of_payment  AS forma_pago,
            SUM(sip.amount)      AS total
        FROM `tabSales Invoice Payment` sip
        INNER JOIN `tabSales Invoice` si ON si.name = sip.parent
        WHERE si.docstatus    = 1
          AND si.company      = %(company)s
          AND si.posting_date BETWEEN %(inicio)s AND %(fin)s
          {profile_filter}
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

    por_departamento = frappe.db.sql(f"""
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
          {profile_filter}
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
def get_reporte_ventas(fecha_inicio=None, fecha_fin=None, pos_profile=None):
    fecha_inicio = fecha_inicio or nowdate()
    fecha_fin    = fecha_fin    or fecha_inicio

    params = {"company": COMPANY, "inicio": fecha_inicio, "fin": fecha_fin, "pos_profile": pos_profile}
    profile_filter = "AND pos_profile = %(pos_profile)s" if pos_profile else ""

    resumen = frappe.db.sql(f"""
        SELECT
            COUNT(name)                   AS num_transacciones,
            COALESCE(SUM(grand_total), 0) AS total_ventas
        FROM `tabSales Invoice`
        WHERE docstatus    = 1
          AND company      = %(company)s
          AND posting_date BETWEEN %(inicio)s AND %(fin)s
          {profile_filter}
    """, params, as_dict=True)

    total_ventas      = float(resumen[0].total_ventas)    if resumen else 0.0
    num_transacciones = int(resumen[0].num_transacciones) if resumen else 0

    por_forma_pago = frappe.db.sql(f"""
        SELECT
            sip.mode_of_payment AS forma_pago,
            SUM(sip.amount)     AS total
        FROM `tabSales Invoice Payment` sip
        INNER JOIN `tabSales Invoice` si ON si.name = sip.parent
        WHERE si.docstatus    = 1
          AND si.company      = %(company)s
          AND si.posting_date BETWEEN %(inicio)s AND %(fin)s
          {profile_filter}
        GROUP BY sip.mode_of_payment
        ORDER BY total DESC
    """, params, as_dict=True)

    ETIQUETAS = {"Cash": "Efectivo", "Credit Card": "Tarjeta", "Bank Transfer": "Transferencia"}
    for row in por_forma_pago:
        row["forma_pago"] = ETIQUETAS.get(row["forma_pago"], row["forma_pago"])
        row["total"]      = float(row["total"])

    por_departamento = frappe.db.sql(f"""
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
          {profile_filter}
        GROUP BY it.custom_departamento
        ORDER BY total DESC
    """, params, as_dict=True)

    for row in por_departamento:
        row["total"]    = float(row["total"])
        row["cantidad"] = int(row["cantidad"])

    serie_diaria = []
    if fecha_inicio != fecha_fin:
        serie = frappe.db.sql(f"""
            SELECT
                posting_date     AS fecha,
                SUM(grand_total) AS total,
                COUNT(name)      AS num_ventas
            FROM `tabSales Invoice`
            WHERE docstatus    = 1
              AND company      = %(company)s
              AND posting_date BETWEEN %(inicio)s AND %(fin)s
              {profile_filter}
            GROUP BY posting_date
            ORDER BY posting_date ASC
        """, params, as_dict=True)

        for row in serie:
            serie_diaria.append({
                "fecha":      str(row["fecha"]),
                "total":      float(row["total"]),
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
