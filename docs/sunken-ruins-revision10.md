# Revision 10 — dasar laut landai dan lorong tektonik

Perubahan lokal development. Arena Abysal Trench disiapkan tanpa boss aktif sesuai keputusan pengguna. Deep Ocean dan Abysal Trench tetap tanpa monster, loot, quest, atau progression baru.

## Hasil

- Deep Ocean: spawn `(0,320)` sekarang berada pada Y sekitar `-767.15`. Penurunan halus berakhir di Z `180`, kemudian dasar laut sekitar Y `-780` dengan undulasi maksimum 0,25 unit. Jurang luar E1–F1 dan portal F1 dipertahankan.
- Abysal Trench: spawn sekitar Y `-1787.15`, turun perlahan menuju dasar sekitar `-1800`. Lorong berkelok diapit lempengan batu bertingkat, tinggi total sekitar 81–99 unit. Lebar navigasi lorong umumnya sekitar 33–43 unit, dengan landing dan sambungan arena lebih lebar.
- Arena kosong berpusat `(60,-355)`, radius desain 95 unit, dengan pelataran batu rendah sekitar 2 unit di atas pasir. Belum ada boss atau pemicu spawn.
- Geometri lempengan, collision horizontal, pemulihan save, dan minimap memakai layout yang sama. Batas gerak berada pada kaki lempengan. Posisi save lama yang berada di atas lempengan dipulihkan ke posisi valid.
- Material pasir dan batu bercampur per vertex/per fragment agar batasnya tidak terlihat seperti potongan segitiga. Tekstur lokal existing digunakan kembali; tidak ada generasi atau pembelian aset baru.
- Terrain Sunken Ruins, 324 monster existing, warp G7, tema gelap kedua sub-map, dan perbaikan kamera revision 9 dipertahankan.

## Berkas utama

- `lib/game/deep-ocean-layout.ts`: profil kedalaman baru.
- `lib/game/abysal-trench-layout.ts`: jalur, arena, lempengan, material weight, dan area navigasi.
- `lib/game/sunken-ruins-map.ts`, `sunken-ruins-terrain.ts`, `sunken-ruins-materials.ts`: render terrain, campuran material, navigasi dan minimap.
- `lib/game/rules.ts`, `world.ts`: validasi posisi mengikuti lorong.
- `lib/game/regions.ts`: nama sub-area Abysal Trench.
- `lib/game/sunken-ruins.test.ts`, `scripts/test-underwater-revision10.mjs`, `scripts/test-tectonic-camera.mjs`: validasi revisi.

## Verifikasi

- 69/69 tes unit relevan lulus: terrain, collision swept, save, akses portal, populasi, travel, kamera, dan Dragon Veil Wings.
- Browser Chrome lokal: Sunken G7 → Deep Ocean → F1 Abysal Trench → kembali melalui kedua portal; direct travel melalui M ditolak; reload posisi lorong benar; kedua sub-map memiliki nol monster; Sunken kembali dengan 324 monster.
- Jalur penuh dijalankan melalui movement runtime pada follow/free, masing-masing 403 langkah. Perpindahan horizontal 400 unit ke arah lempengan berhenti di X sekitar 23,39, tetap pada area valid.
- Dragon Veil Wings dengan movement speed 600: empat simulasi tick runtime, follow/free pada langkah waktu 30/60 Hz, mencapai arena. Kamera tetap di atas terrain; clearance minimum sekitar 3,91 unit pada follow dan 13,98 pada free. Ini validasi perilaku kamera, bukan benchmark FPS.
- Render arena diperiksa pada empat preset kualitas; console dan page error kosong. Screenshot dan JSON berada di `output/sunken-ruins/revision10/`.
- Typecheck, lint, build, dan `git diff --check` lulus. Build masih menampilkan pemberitahuan klasifikasi route statis vinext; npm menampilkan peringatan opsi konfigurasi pnpm. Log tersedia di direktori output yang sama.

## Batas verifikasi

Screenshot menggunakan browser headless lokal. Belum dilakukan profiling performa 60 detik atau review artistik manual interaktif untuk revisi ini. Lempengan berupa heightfield procedural dengan material batu lokal, bukan hasil simulasi geologi atau aset photogrammetry baru. Semua hasil tetap lokal, tidak dipublikasikan.
