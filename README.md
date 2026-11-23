# POS Apotek Naufal Farma

Aplikasi kasir apotek Android berbasis React, Vite, TypeScript, Capacitor, dan IndexedDB (Dexie).

## Fitur MVP
- Dashboard ringkasan produk, omzet, estimasi laba, dan stok menipis.
- Kasir dengan keranjang, checkout, pengurangan stok, dan pencatatan mutasi.
- Cek harga memakai Harga Jual.
- Master barang dan impor CSV.
- Barang masuk dan barang keluar.
- Laporan penjualan.
- Backup master produk ke CSV.
- Pemindaian barcode melalui kamera perangkat.

## Menjalankan
Memerlukan Node.js 20+ dan Java 17 untuk build Android.
`npm install`, `npm run dev` untuk pengembangan, dan `npm run build` untuk build web.

## Build APK
Workflow GitHub Actions **Build Android APK** berjalan saat push ke main/master atau dapat dijalankan manual melalui tab Actions. Setelah sukses, unduh artifact `pos-apotek-naufal-farma-debug-apk`. Artifact disimpan 14 hari. APK debug hanya untuk pengujian.

## Data dan batasan
Data transaksi tersimpan lokal di IndexedDB pada perangkat/browser. Belum ada sinkronisasi cloud multi-perangkat, login, atau database server. GitHub digunakan untuk source code dan build, bukan database kasir. Ekspor backup secara berkala. Jangan commit data pelanggan, transaksi sensitif, atau token rahasia.

## Aturan perhitungan
- Kode Item menjadi identitas produk.
- Harga Jual dipakai pada penjualan dan cek harga.
- Harga Beli dipakai sebagai HPP estimasi laba.
- Harga dan HPP transaksi disimpan sebagai snapshot.
- Saat impor CSV, stok produk mengikuti nilai stok pada CSV.
