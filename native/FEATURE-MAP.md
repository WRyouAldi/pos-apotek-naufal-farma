# Legacy feature map — Capacitor to Expo Native

Source inspected on branch `migration/expo-native-android`: `src/App.tsx`, `src/db.ts`, and `src/ui.tsx`. This is a behavior inventory, not a claim that these features are already implemented in Expo.

## Navigation and screens

| Legacy area | Existing behavior / controls | Native migration target | Status |
|---|---|---|---|
| Dashboard | Product count, today's revenue and estimated profit, low-stock count/list (up to 12) | Native overview cards, date-aware metrics, low-stock list | Mapped |
| Kasir | Product search by name/code/barcode, barcode scan, cart quantity controls, total, checkout | Native product picker, scanner, cart and payment flow | Mapped; not ported |
| Cek Harga | Search product and scan barcode; result lookup without unnecessary scan-success toast | Fast lookup screen and scanner with quiet success behavior | Mapped |
| Master Barang | Product table, search, CSV import/export | Native CSV import/export backed by SQLite; full CRUD remains future work | CSV import/export implemented; CRUD gap retained |
| Barang Masuk | Exact code/barcode selection, quantity entry, stock increment, MASUK movement history | Native receiving form and movement ledger | Mapped |
| Barang Keluar | Exact code/barcode selection, quantity entry, stock decrement with inventory stock check, KELUAR movement history | Native stock-out form and reportable movement details | Mapped |
| Laporan penjualan | Date range, transaction list, turnover, estimated profit, receipt PDF and sales report PDF | Native report filters, detail view, PDF export | Mapped |
| Laporan barang keluar | Date range, item name, quantity, purchase cost, line total, aggregate quantity/value, PDF | Native stock movement report and PDF | Mapped |
| Pengaturan tema | Light/dark preference stored locally | Native theme preference and system theme | Mapped |
| Sinkronisasi katalog | One-way product master CSV pull from public GitHub source on launch/reconnect/15-minute interval; local stock preserved; offline fallback | Explicitly review whether to keep optional catalog import; no transaction cloud sync implied | Mapped; policy review |
| Data lokal | JSON backup/restore for products, sales, movements; CSV product export | Native document picker, file export/import, validation and safe restore | Product CSV import/export implemented; JSON backup/restore remains mapped |
| Receipt / PDF | PDF receipt and sales / stock-out report generation; Capacitor file save/share | Native PDF generation + Android save/share/document flow | Mapped |
| Barcode integration | Camera permission, rear camera selection, barcode scan, manual fallback | Expo Camera scanner, permission states, lifecycle and manual fallback | Mapped |
| Offline | Dexie local database; remote CSV catalog sync has offline fallback | SQLite persistence; verify airplane-mode relaunch | Mapped |

## Legacy data model

- `Product`: `id`, `code`, `barcode`, `name`, `category`, `brand`, `stock`, `unit`, `buyPrice`, `sellPrice`, `minStock`, `shelf`, `supplier`.
- `Sale`: `id`, `createdAt`, `total`, `items[]`.
- Sale item snapshot: `code`, `name`, `qty`, `price`, `cost`.
- `Movement`: `id`, `createdAt`, `type` (`MASUK | KELUAR | PENJUALAN`), `code`, `name`, signed `qty`, `unitCost`, `note`.

The legacy Dexie schema has products keyed by auto-increment ID with unique code; sales and movements have auto-increment IDs. Barcode is indexed but not unique.

## Important business rules to preserve

1. Do not block cashier checkout because available stock is insufficient. The legacy UI currently still blocks adding/checkout based on stock; this conflicts with the user's previously approved requirement to remove cashier stock validation. Native cashier behavior must follow the approved no-stock-blocking rule, and tests must cover negative stock handling explicitly.
2. Checkout must write the sale header, all sale items, corresponding PENJUALAN movement rows, and stock adjustments atomically. A failed operation must roll back as a whole.
3. Stock-out is an inventory operation and may retain its own stock validation.
4. Product CSV import updates master fields while preserving the local stock quantity for existing product codes.
5. GitHub catalog synchronization is one-way master-data import, not transaction backup or cloud synchronization.
6. Legacy JSON restore replaces local products, sales, and movements; native restore must add confirmation, validation, transaction safety, and recovery tests.

## Current Expo foundation

- Expo project root: `native/`
- Android application ID for side-by-side migration testing: `com.naufalfarma.pos.native`
- SQLite database: `naufal-farma-native.db`
- Schema version: 1
- Tables: `products`, `sales`, `sale_items`, `movements`, `app_meta`
- Product master CSV import/export is implemented in the Expo screen using SQLite and Android document/share flows. Import validates the complete file before writing and preserves local stock for existing product codes.
- No legacy sales/movement import and no cashier transaction implementation in this stage.
