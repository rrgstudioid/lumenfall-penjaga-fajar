# Revisi 8: Deep Ocean dan Abysal Trench

Perubahan development lokal. Tidak ada publikasi, unduhan aset baru, atau pemakaian kredit Tripo.

## Hasil

- Angka zona di dalam minimap Sunken Ruins dan Deep Ocean dihapus. Koordinat tepi A-H / 1-8 tetap tersedia, bersama penanda warp G7/F1 dan kapal yang sudah ada.
- Deep Ocean tidak muncul sebagai tujuan teleport M. Pemeriksaan perjalanan juga menolak akses langsung, portal yang salah, sumber map yang tidak terhubung, dan interaksi lebih jauh dari 4,5 world units. Akses masuk dari Sunken Ruins memakai warp G7; akses kembali dari Abysal Trench memakai warp penghubungnya.
- Dasar Deep Ocean menjadi lebih dalam dan turun terus dari selatan ke utara. Sekitar Y=-360 pada tepi selatan, Y=-435,6 pada spawn `(0,320)`, Y=-570 di tengah, dan Y=-780 pada tepi utara. Angka ini world units, bukan meter.
- Di luar batas utara E1-F1, dasar turun hingga sekitar Y=-1.700 menjadi palung dengan sisi melengkung. Transisi dimulai setelah Z=-500, sehingga palung luar tetap tidak dapat dijelajahi langsung. Kabut menuju utara berubah bertahap menjadi biru gelap, dengan jarak pandang lebih panjang agar sisi palung terlihat. Terrain culling mengikuti jangkauan maksimum tersebut.
- Warp **F1 `(187.5,-437.5)`** membuka sub-map **Abysal Trench**, sesuai ejaan yang diminta. Sub-map ini berisi dasar dan sisi palung berpasir serta portal kembali; tidak ada coral, biota, monster, quest, atau reward baru. Spawn berada pada Y=-1554. Mode renang, minimap, penyimpanan posisi, dan pemulihan save memakai lifecycle underwater yang ada.

Terrain, dinding, aset, dan populasi 324 monster Sunken Ruins tetap. Perubahan terrain hanya berlaku pada Deep Ocean dan sub-map baru.

## Jalur warp

| Dari | Warp | Tujuan | Spawn |
| --- | --- | --- | --- |
| Sunken Ruins | G7 `(312.5,312.5)` | Deep Ocean | `(0,320)` |
| Deep Ocean | F1 `(187.5,-437.5)` | Abysal Trench | `(0,320)` |
| Abysal Trench | `(0,350)` | Deep Ocean | `(187.5,-427.5)` |
| Deep Ocean | `(0,350)` | Sunken Ruins | `(312.5,322.5)` |

Spawn kembali berjarak lebih dari 4,5 units dari portal. Tidak ada auto-trigger. Kedua sub-map hanya tersedia melalui warp, sedangkan Sunken Ruins tetap tersedia pada menu M untuk level 32+.

## Validasi

- **64/64 tes Node relevan lulus**: Sunken, field expansion, field quest/travel, save/rules, camera follow, dan camera zoom. Tes baru mencakup penurunan monoton ke utara, kontinuitas tepi palung, pembatas luar, portal yang salah/terlalu jauh, level 31/32, perjalanan kembali, reload sub-map, dan save development pada mode production.
- **Typecheck, lint, dan build lulus**. Build masih menampilkan pemberitahuan klasifikasi route vinext dan peringatan konfigurasi npm yang sudah ada.
- Browser Chrome: tujuan Deep Ocean/Abysal Trench tidak ada pada kartu menu M; teleport langsung gagal; rangkaian empat warp berhasil; reload Abysal Trench mempertahankan `(120,-220)`; tidak ada teleport loop atau page/console error.
- Pengujian minimap mencatat teks yang digambar: hanya delapan angka koordinat di tepi kiri, tanpa angka zona di bagian dalam.
- Traversal ke utara sejauh 100 units pada kedua mode kamera menurunkan posisi sekitar 41,917 units dan tetap sesuai permukaan setelah grounding. Batas utara menahan pusat player pada Z=-499,5.
- Metrik runtime mengonfirmasi dua sub-map memiliki nol monster, nol dekorasi/reef, nol kit PBR, serta nol ambience biota/partikel/shafts. Kembali ke Sunken memulihkan empat portal dan 324 monster.
- Bentuk palung, warp F1, dasar sub-map, dan minimap diperiksa dari gambar renderer. Gambar palung memakai kamera inspeksi untuk memperlihatkan dinding dan kedalamannya; bukan peta atau gambar konsep yang menggantikan runtime.

Tidak dilakukan benchmark penuh Verdant/Whispering untuk revisi ini. Hasil performa revisi 7 tidak dinyatakan sebagai pengukuran revisi 8, terutama karena jangkauan pandang utara Deep Ocean bertambah.

## Berkas dan bukti

Modul baru: `lib/game/abysal-trench-layout.ts`. Integrasi: `underwater-regions.ts`, `deep-ocean-layout.ts`, `sunken-ruins-map.ts`, `sunken-ruins-quality.ts`, `regions.ts`, `world.ts`, `rules.ts`, `field-layout.ts`, `app/page.tsx`, dan HUD. Fixture dan tes perjalanan diperbarui.

Jalankan `node scripts/test-underwater-revision8.mjs` dengan fixture Vite pada port 3002. Hasil berada di `output/sunken-ruins/revision8/`:

- `browser.json`, `browser.log`: hasil assertion runtime.
- `sunken-minimap.png`, `deep-ocean-minimap.png`, `abysal-trench-minimap.png`, `world-map.png`.
- `deep-south.png`, `deep-north.png`, `f1-portal.png`, `offshore-trench.png`, `abysal-trench-landing.png`.
- `unit.log`, `typecheck.log`, `lint.log`, `build.log`.

Gambar `trench-diagnostic.png` adalah eksperimen inspeksi kabut; bukti hasil akhir memakai `offshore-trench.png` dari konfigurasi runtime.
