# PROJECT RULES — POS Apotek Naufal Farma

- Gunakan TypeScript strict dan komponen modular.
- `Kode Item` adalah kunci unik produk; jangan menggabungkan produk hanya karena nama sama.
- Semua nilai uang disimpan sebagai integer rupiah.
- Tampilan harga jual selalu mengambil `sellPrice`/kolom `Harga Jual`.
- HPP/laba menggunakan `buyPrice`/kolom `Harga Beli`.
- Simpan snapshot harga jual dan HPP pada detail transaksi.
- Semua perubahan stok harus dicatat sebagai mutasi; jangan menghapus riwayat untuk membatalkan transaksi.
- Jangan mengubah stok negatif menjadi nol secara otomatis.
- Impor CSV harus mendeteksi header, mempertahankan kode, dan melaporkan kesalahan parsing.
- Akses database dipusatkan di `src/db.ts` dan layanan/repository, bukan tersebar pada komponen.
- Jangan menambahkan dependensi atau fungsi duplikat sebelum memeriksa implementasi yang sudah ada.
- Jangan menyimpan token, password, atau data sensitif ke Git.
- Jalankan `npm run build` sebelum rilis.
