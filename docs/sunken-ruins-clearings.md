# Sunken Ruins: collision dan pembersihan ruins

Revisi lokal 9 Oktober 2026. Menggantikan ketentuan navigasi yang berhenti sebelum lereng dalam pada [laporan hunting](sunken-ruins-hunting.md). Tidak dipublikasikan.

Invisible wall berasal dari `sunkenWalkable`: kontur pulau/jalur blueprint masih menjadi syarat navigasi, meskipun permukaan pasir sudah diperluas dan diturunkan. Sekarang seluruh permukaan dalam bidang 1000 × 1000 (X/Z −500 sampai 500, dikurangi radius aktor) dapat dilintasi kecuali objek solid. Kontur lama hanya mengatur kedalaman terrain, habitat, dan warna minimap. Grounding tetap mengikuti permukaan, termasuk lereng laut dalam. Batas luar bidang map tetap berlaku.

Tiga patung `ocean_statue`, tiga susunan dinding `broken_wall`, dan 60 potongan paving `slab` di pusat/arena utara dihapus dari placement runtime. Collider player dan kamera patung/dinding ikut hilang. Enam bekas lokasi tetap menjadi ruang kosong agar reef dan home monster tidak bergeser. Clearing bukan collider. Pilar PBR, satu pilar patah, trident, karang, dan portal dipertahankan; GLB sumber tidak dimodifikasi.

Perubahan utama berada di `sunken-ruins-layout.ts`, `sunken-ruins-map.ts`, `sunken-ruins-camera.ts`, dan `sunken-ruins-population.ts`. Tes regresi berada di `sunken-ruins.test.ts` dan `scripts/test-sunken-clearings.mjs`. Snapshot sebelum/sesudah membuktikan placement reef serta ID/koordinat home 177 monster identik.

Validasi:

- 60/60 tes Node lulus: Sunken, field expansion, quest/travel, rules, camera follow/zoom.
- Typecheck, lint, dan build lulus. Build masih menampilkan pemberitahuan klasifikasi route vinext yang sudah ada.
- Browser Chrome: pergerakan lewat controller game berhasil melintasi enam bekas objek dan empat kontur lama sejauh 30 unit; karang tetap solid dan keempat sisi luar menahan aktor. Grounding error saat bergerak di lereng di bawah 0,14 unit.
- Save/reload mempertahankan posisi `(-100, 439.5)` di luar kontur navigasi lama; 177 monster dan tiga portal tetap tersedia. Tidak ada error browser.
- Render runtime tidak memiliki instance `ocean_statue`, `broken_wall`, atau `slab`; bukti gambar dan hasil terstruktur berada di `output/sunken-ruins/revision5/`.
- Browser lifecycle lulus: akses level, ketiga warp, Retry, reload, respawn, renang kedua gender, attachment, dan 32 sudut kamera free/follow. Tiga kunjungan stabil pada 177 monster, 3 label portal, 88 geometry, dan 17 texture; tidak ada error browser.

Benchmark performa penuh tidak diulang pada revisi ini; tidak ada klaim perubahan FPS atau kelulusan budget performa baru. Batas ±500 tetap merupakan batas map, sedangkan apron visual di luarnya tidak playable.
