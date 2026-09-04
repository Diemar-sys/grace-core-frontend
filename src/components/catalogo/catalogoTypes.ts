// src/components/catalogo/catalogoTypes.ts

export interface CostoBOM {
  costoPorUnidad: number;
  costoTotal: number;
  cantidadProducida: number;
  uom: string;
}

export interface PanItem {
  item_code: string;
  item_name: string;
  item_group?: string;
  custom_precio_de_venta?: number | string;
  custom_precio_de_venta_pueblos?: number | string;
  custom_precio_de_venta_camioneta?: number | string;
  custom_costo_estimado?: number | string;
  /** 1 = el costo se derivó del precio de venta, no de una receta. */
  custom_costo_provisional?: number | boolean;
}

export interface InsumoItem {
  item_code: string;
  item_name: string;
  item_group?: string;
  custom_tipo_item?: string;
  custom_código_interno?: string;
  custom_cantidad_por_presentación?: number | string;
  custom_presentación?: string;
  custom_total_presentacion?: number | string;
  custom_precio_final?: number | string;
  actual_qty?: number | string;
  stock_uom?: string;
  disabled?: number | boolean;
}
