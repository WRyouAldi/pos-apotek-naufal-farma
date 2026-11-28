import type { SQLiteDatabase } from 'expo-sqlite';
import type { Product } from '../domain/models';

const REQUIRED = ['kode item', 'nama item', 'stok', 'harga beli', 'harga jual'] as const;
const OPTIONAL_HEADERS = ['kode barcode', 'jenis', 'merek', 'satuan', 'stok min', 'rak', 'supplier'];

type CsvRow = Record<string, string>;
type ParsedCsv = { rows: CsvRow[]; headerLine: number };

function parseRecords(raw: string, delimiter: string): string[][] {
  const input = raw.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('Tanda kutip CSV tidak berpasangan.');
  row.push(field);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

function detectDelimiter(header: string): string {
  const candidates = [',', ';', '\t'];
  return candidates.sort((a, b) => {
    const count = (value: string, char: string) => [...value].filter(c => c === char).length;
    return count(header, b) - count(header, a);
  })[0];
}

function parseCsv(raw: string): ParsedCsv {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const headerLine = lines.findIndex(line => /kode\s*item/i.test(line) && /nama\s*item/i.test(line));
  if (headerLine < 0) throw new Error('Header CSV tidak ditemukan. Pastikan ada kolom Kode Item dan Nama Item.');
  const delimiter = detectDelimiter(lines[headerLine]);
  const records = parseRecords(lines.slice(headerLine).join('\n'), delimiter);
  if (!records.length) throw new Error('File CSV tidak memiliki data.');
  const headers = records[0].map(value => value.trim().replace(/^\uFEFF/, '').toLowerCase());
  for (const key of REQUIRED) if (!headers.includes(key)) throw new Error(`Kolom wajib tidak ditemukan: ${key}.`);
  const rows = records.slice(1).map((record, index) => {
    if (record.length > headers.length) throw new Error(`Jumlah kolom tidak sesuai pada baris ${headerLine + index + 2}.`);
    return Object.fromEntries(headers.map((header, i) => [header, (record[i] ?? '').trim()]));
  });
  return { rows, headerLine };
}

function integer(value: string, label: string, line: number): number {
  const raw = value.trim().replace(/^rp\s*/i, '').replace(/\s/g, '');
  if (!raw || !/^-?\d+$|^-?\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    throw new Error(`${label} memiliki format angka tidak valid pada baris ${line}.`);
  }
  const result = Number(raw.replace(/\./g, ''));
  if (!Number.isSafeInteger(result)) throw new Error(`${label} di luar batas angka aman pada baris ${line}.`);
  return result;
}

export function parseProductCsv(raw: string): Product[] {
  const parsed = parseCsv(raw);
  const seen = new Set<string>();
  const products: Product[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const code = row['kode item'] ?? '';
    const name = row['nama item'] ?? '';
    const line = parsed.headerLine + i + 2;
    if (!code && !name) continue;
    if (!code || !name) throw new Error(`Baris ${line}: kode dan nama produk wajib diisi.`);
    if (seen.has(code)) throw new Error(`Kode produk duplikat: ${code} (baris ${line}).`);
    seen.add(code);
    const stock = integer(row.stok ?? '', 'Stok', line);
    const buyPrice = integer(row['harga beli'] ?? '', 'Harga Beli', line);
    const sellPrice = integer(row['harga jual'] ?? '', 'Harga Jual', line);
    const minStock = row['stok min'] ? integer(row['stok min'], 'Stok Minimum', line) : 0;
    if (buyPrice < 0 || sellPrice < 0 || minStock < 0) throw new Error(`Harga dan stok minimum tidak boleh negatif (baris ${line}).`);
    products.push({
      code, name, barcode: row['kode barcode'] ?? row.barcode ?? '',
      category: row.jenis ?? row.kategori ?? '', brand: row.merek ?? row.brand ?? '',
      stock, unit: row.satuan || 'pcs', buyPrice, sellPrice, minStock,
      shelf: row.rak ?? '', supplier: row.supplier ?? '',
    });
  }
  if (!products.length) throw new Error('Tidak ada produk valid untuk diimpor.');
  return products;
}

const CSV_HEADERS = ['Kode Item', 'Kode Barcode', 'Nama Item', 'Jenis', 'Merek', 'Stok', 'Satuan', 'Harga Beli', 'Harga Jual', 'Stok Min', 'Rak', 'Supplier'] as const;
const quote = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function importProductsCsv(db: SQLiteDatabase, raw: string): Promise<{ inserted: number; updated: number; total: number }> {
  // Parse and validate the entire file before opening a write transaction.
  const products = parseProductCsv(raw);
  let inserted = 0, updated = 0;
  await db.withTransactionAsync(async () => {
    for (const product of products) {
      const existing = await db.getFirstAsync<{ code: string }>('SELECT code FROM products WHERE code = ?', product.code);
      await db.runAsync(
        `INSERT INTO products (code, barcode, name, category, brand, stock, unit, buy_price, sell_price, min_stock, shelf, supplier, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET barcode=excluded.barcode, name=excluded.name, category=excluded.category,
         brand=excluded.brand, unit=excluded.unit, buy_price=excluded.buy_price, sell_price=excluded.sell_price,
         min_stock=excluded.min_stock, shelf=excluded.shelf, supplier=excluded.supplier, updated_at=excluded.updated_at`,
        product.code, product.barcode, product.name, product.category, product.brand, product.stock,
        product.unit, product.buyPrice, product.sellPrice, product.minStock, product.shelf, product.supplier,
        new Date().toISOString(), new Date().toISOString(),
      );
      if (existing) updated++; else inserted++;
    }
  });
  return { inserted, updated, total: products.length };
}

type ProductDbRow = {
  code: string; barcode: string; name: string; category: string; brand: string; stock: number;
  unit: string; buy_price: number; sell_price: number; min_stock: number; shelf: string; supplier: string;
};

export async function exportProductsCsv(db: SQLiteDatabase): Promise<string> {
  const rows = await db.getAllAsync<ProductDbRow>(
    'SELECT code, barcode, name, category, brand, stock, unit, buy_price, sell_price, min_stock, shelf, supplier FROM products ORDER BY name COLLATE NOCASE'
  );
  const lines = [
    CSV_HEADERS.map(quote).join(','),
    ...rows.map(row => [
      row.code, row.barcode, row.name, row.category, row.brand, row.stock, row.unit,
      row.buy_price, row.sell_price, row.min_stock, row.shelf, row.supplier,
    ].map(quote).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}
