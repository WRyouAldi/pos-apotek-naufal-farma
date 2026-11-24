export const DATABASE_NAME = 'naufal-farma-native.db';
export const DATABASE_VERSION = 1;

/**
 * Mirrors the legacy Dexie entities while normalizing sale line items.
 * Prices are stored as integer Rupiah values, matching the legacy app.
 * Product stock intentionally has no non-negative CHECK: cashier stock policy
 * must not block checkout when the migration implements sales.
 */
export const MIGRATION_1_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  barcode TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  buy_price INTEGER NOT NULL DEFAULT 0 CHECK (buy_price >= 0),
  sell_price INTEGER NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  shelf TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY NOT NULL,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  UNIQUE(sale_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_code ON sale_items(product_code);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MASUK', 'KELUAR', 'PENJUALAN')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_type_created_at ON movements(type, created_at);
CREATE INDEX IF NOT EXISTS idx_movements_code ON movements(code);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
