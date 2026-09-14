// src/components/egresos/egresosConstants.ts
import React from 'react';
import { CategoriaConfig, FacturaOption, EgresoFormState } from './egresosTypes';
import { pesos } from '../../utils/formato';
import {
  IconGasto,
  IconCamioneta,
  IconActivoFijo,
  IconPrestamo,
  IconNomina,
  IconImpuesto,
  IconRenta,
} from './egresosIcons';

// La placa es lo que distingue a cada vehículo: "Tornado Van 1..4" no decía cuál
// era cuál y 66 de 79 cargas de gasolina quedaron en la Van 1 (la primera de la
// lista). El texto se guarda tal cual en `concepto`; los egresos viejos conservan
// su "TORNADO VAN N" a propósito: no se sabe a qué placa corresponde cada uno.
export const VEHICULOS: string[] = [
  'Tornado Van 2022 Blanca · SX-0068-B',
  'Tornado Van 2024 Blanca · SV-3060-E',
  'Tornado Van 2024 Gris · ST-3404-E',
  'Tornado Van 2025 Blanca · SW-1411-E',
  'Toyota Hilux 2023 Gris · SX-8551-D',
  'Toyota Avanza 2021 Blanca · UNP-054-E',
  'Honda BRV 2024 Gris · UNL-407-J',
];

export const SUCURSALES_RECIBO: string[] = [
  'Paseos del Bosque',
  'Puerta Real',
  'Pirámides',
  'Santuarios',
  'Casa',
];

export const TELEFONOS: string[] = ['Héctor', 'Luis', 'Alma', 'Paseos del Bosque', 'Santuarios'];
export const TIPOS_MANT: string[] = ['Maquinaria', 'Camioneta', 'Infraestructura', 'Cómputo'];
export const TIPOS_REFAC: string[] = ['Camioneta', 'Maquinaria', 'Otro'];
export const TIPOS_AGUA: string[] = [
  'Agua para consumo humano',
  'Pipa de agua',
  'Agua de uso diario - CEA',
];

export const SUBCAT_IVA: string[] = [
  'Control de plagas',
  'Luz',
  'Comisión por tarjetas de crédito',
];

export const impuestoDefault = (subcat: string): string =>
  SUBCAT_IVA.includes(subcat) ? 'iva16' : 'tasa0';

export const CATEGORIAS: CategoriaConfig[] = [
  {
    key: 'Gasto',
    label: 'Gastos',
    sub: 'Operativos',
    icon: React.createElement(IconGasto),
    color: '#dc2626',
    bg: '#fee2e2',
    subcategorias: [
      'Gasolina',
      'Gas',
      'Luz',
      'Agua',
      'Internet',
      'Teléfono',
      'Mantenimiento',
      'Uniformes',
      'Papelería',
      'Artículos de limpieza',
      'Refacciones',
      'Control de plagas',
      'Comisión por tarjetas de crédito',
      'Otros gastos',
    ],
  },
  {
    key: 'camioneta_view',
    label: 'Camioneta',
    sub: 'Vista filtrada',
    icon: React.createElement(IconCamioneta),
    color: '#0891b2',
    bg: '#cffafe',
    esVista: true,
    subcategorias: [],
  },
  {
    key: 'Activo Fijo',
    label: 'Activo Fijo',
    sub: 'Inversiones',
    icon: React.createElement(IconActivoFijo),
    color: '#7c3aed',
    bg: '#ede9fe',
    subcategorias: ['Pago Camioneta'],
  },
  {
    key: 'Préstamo',
    label: 'Préstamos',
    sub: 'Financiamiento',
    icon: React.createElement(IconPrestamo),
    color: '#d97706',
    bg: '#fef3c7',
    subcategorias: ['Paneles', 'Pago Guillermo', 'Pago Camioneta'],
  },
  {
    key: 'Nómina',
    label: 'Nómina',
    sub: 'Empleados',
    icon: React.createElement(IconNomina),
    color: '#059669',
    bg: '#d1fae5',
    subcategorias: ['Empleados', 'Efectivo'],
  },
  {
    key: 'Impuesto',
    label: 'Impuestos',
    sub: 'IMSS · ISR · IEPS · 3% Nómina',
    icon: React.createElement(IconImpuesto),
    color: '#1565c0',
    bg: '#e3f0ff',
    subcategorias: ['IMSS', 'ISR', 'IEPS', '3% Nómina'],
  },
  {
    key: 'Renta',
    label: 'Renta',
    sub: 'Locales',
    icon: React.createElement(IconRenta),
    color: '#be185d',
    bg: '#fce7f3',
    subcategorias: [],
  },
];

export const FACTURA_OPTIONS: FacturaOption[] = [
  { label: 'Sin factura', facturado_a: 'SIN FACTURA', con_factura: false },
  { label: 'Alma Rodríguez', facturado_a: 'ALMA RODRIGUEZ', con_factura: true },
  { label: 'Luis Torres', facturado_a: 'LUIS TORRES', con_factura: true },
];

export const IMP_ERPNEXT: Record<string, string> = { tasa0: '', iva16: 'IVA', ieps: 'IEPS' };
export const IVA_RATE = 0.16;

export function fmtN(val: number | string | null | undefined): string {
  // Antes usaba style:'currency', que en el ICU de algunos navegadores imprime
  // "MX$1,234.56" en vez de "$1,234.56".
  return pesos(val);
}

export function n(v: string | number | null | undefined): number {
  return parseFloat(String(v || 0)) || 0;
}

export const FORM_INIT: EgresoFormState = {
  fecha: new Date().toISOString().split('T')[0],
  proveedor: { name: '', label: '' },
  subcategoria: '',
  concepto: '',
  descripcion: '',
  partidas: [],
  ajuste: '',
  ajuste_manual: false,
  monto: '',
  impuesto_key: 'tasa0',
  impuesto_tipo: '',
  monto_impuesto: '',
  factura_key: 'SIN FACTURA',
  no_factura: '',
  gas_litros: '',
  gas_precio: '',
  impuesto_manual: '',
  total_manual: '',
  totales_override: {},
  luz_energia: '',
  luz_dap: '',
  luz_iva: '',
  luz_total: '',
  gasolina_litros: '',
  gasolina_precio: '',
  gasolina_iva: '',
  gasolina_total: '',
  aditivo_litros: '',
  aditivo_precio: '',
  descuento_gas: '',
};
