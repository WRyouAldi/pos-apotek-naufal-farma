# Naufal Farma — Visual Assets

Aset visual resmi untuk POS Apotek Naufal Farma. Semua ilustrasi berbasis SVG agar tajam pada layar Android density tinggi dan ringan saat dimuat.

## Identitas
- `../app-icon.svg` — ikon aplikasi 512 × 512, maskable-friendly.
- `brand-mark.svg` — lockup logo horizontal.
- `../favicon.svg` — favicon web.

## Ilustrasi
- `dashboard-pharmacy.svg` — visual hero dashboard.
- `category-tablets.svg`, `category-capsules.svg`, `category-syrup.svg`, `category-vitamins.svg`, `category-medical-device.svg`, `category-first-aid.svg` — ikon kategori.
- `empty-products.svg`, `empty-reports.svg` — empty states.
- `stock-low.svg` — ilustrasi stok menipis.

## Penggunaan
Gunakan path absolut dari root aplikasi, misalnya `/assets/dashboard-pharmacy.svg`. Pertahankan rasio aspek asli; gunakan `object-fit: contain`. Jangan mengubah warna aset inti secara langsung untuk Dark Mode—letakkan pada surface semantik tema agar aset tetap konsisten.

Aset ini tidak memuat foto stok atau data operasional fiktif.