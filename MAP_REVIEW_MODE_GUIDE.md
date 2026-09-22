# MAP REVIEW MODE V1 — Mahkota Fajar

Mode ini hanya tersedia pada map development `lumenfall-kingdom-capital-v11`.
Aktifkan dengan `F8`; mode ini tidak menulis save pemain dan tidak mengubah layout kota.

## Alur singkat

- `Pin`: klik terrain untuk membuat `P-###`.
- `Area`: klik minimal tiga titik, lalu `Selesaikan area` untuk membuat `A-###`.
- `Objek`: klik rumah, dinding, tower, pohon, atau struktur yang terlihat untuk membuka `O-###` dan inspector.
- `Ukur`: klik dua titik untuk melihat jarak horizontal, beda elevasi, dan jarak 3D.
- `Zones`, `Anchors`, dan `Grid 25m` menyalakan overlay referensi tanpa mengubah map.
- `Focus ID` memusatkan kamera ke ID review yang sudah dipilih.
- `Export Review` mengunduh JSON sesi; tombol ini tidak menyimpan ke production save.

## Detail review

Setelah memilih pin atau area, pilih kategori/status, isi catatan, lalu tekan `Simpan detail`.
`Hapus item` menghapus item dari sesi aktif. Nomor ID yang sudah pernah dipakai tidak digunakan ulang selama sesi tersebut.

Data review yang dibagikan untuk owner disimpan di:

`dev-prototypes/kingdom-capital-v11/reviews/`

Mode ini adalah alat observasi. Tidak ada NPC, monster, quest, drop, job progression,
atau perubahan gameplay yang ditambahkan.
