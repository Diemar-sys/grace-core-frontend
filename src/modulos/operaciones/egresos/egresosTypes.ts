// src/components/egresos/egresosTypes.ts
import { ReactNode } from 'react';

export interface ProveedorInfo {
  name: string;
  label: string;
}

export interface PartidaItem {
  id?: string;
  concepto: string;
  descripcion?: string;
  cantidad?: number | string;
  precio?: number | string;
  monto?: number | string;
  impuesto_key?: string;
  impuesto_tipo?: string;
  monto_impuesto?: number | string;
  [key: string]: unknown;
}

export interface EgresoFormState {
  fecha: string;
  proveedor: ProveedorInfo;
  subcategoria: string;
  concepto: string;
  descripcion: string;
  partidas: PartidaItem[];
  ajuste: string;
  ajuste_manual: boolean;
  monto: string;
  impuesto_key: string;
  impuesto_tipo?: string;
  monto_impuesto?: string;
  factura_key: string;
  no_factura: string;
  // Gas-specific
  gas_litros: string;
  gas_precio: string;
  gasolina_litros: string;
  gasolina_precio: string;
  gasolina_iva: string;
  gasolina_total: string;
  aditivo_litros: string;
  aditivo_precio: string;
  descuento_gas: string;
  // Overrides del gasto simple: el calculo es suposicion, el papel es la verdad.
  impuesto_manual: string;
  total_manual: string;
  /** Overrides de los totales de la ruta con partidas. Vacio = auto. */
  totales_override: Record<string, string>;
  // Luz (CFE): el IVA grava solo la energia y el pago va en pesos cerrados.
  luz_energia: string;
  luz_dap: string;
  luz_iva: string;
  luz_total: string;
}

export interface CategoriaConfig {
  key: string;
  label: string;
  sub: string;
  icon: ReactNode;
  color: string;
  bg: string;
  subcategorias: string[];
  esVista?: boolean;
}

export interface FacturaOption {
  label: string;
  facturado_a: string;
  con_factura: boolean;
}

export interface EgresoRow {
  name: string;
  posting_date: string;
  custom_categoria?: string;
  custom_subcategoria?: string;
  custom_concepto_gasto?: string;
  custom_descripcion_gasto?: string;
  supplier?: string;
  supplier_name?: string;
  custom_facturado_a?: string;
  custom_no_factura?: string;
  grand_total?: number;
  docstatus?: number;
}
