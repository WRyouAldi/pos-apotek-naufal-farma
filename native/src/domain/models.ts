export type MovementType = 'MASUK' | 'KELUAR' | 'PENJUALAN';

export interface Product {
  id?: number;
  code: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  minStock: number;
  shelf: string;
  supplier: string;
}

export interface SaleItem {
  code: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

export interface Sale {
  id?: number;
  createdAt: string;
  total: number;
  items: SaleItem[];
}

export interface Movement {
  id?: number;
  createdAt: string;
  type: MovementType;
  code: string;
  name: string;
  qty: number;
  unitCost: number;
  note: string;
}

/** Matches the existing Capacitor backup JSON version 1 envelope. */
export interface LegacyBackupV1 {
  format: 'naufal-farma-pos-backup';
  version: 1;
  createdAt: string;
  data: {
    products: Product[];
    sales: Sale[];
    movements: Movement[];
  };
}
