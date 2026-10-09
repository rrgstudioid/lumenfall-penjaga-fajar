# Revisi 9: kamera Wings dan pencahayaan sub-map

10 Oktober 2026. Perubahan lokal, tanpa publikasi atau aset berbayar.

## Kamera

Saat bergerak menanjak cepat, kamera underwater sebelumnya menggabungkan X/Z fokus yang tertinggal, tinggi yang berasal dari posisi lain, dan titik collision yang memakai X/Z karakter terbaru. Akibatnya tinggi fokus terhadap lereng berubah menurut frame time dan kamera dapat memendek saat naik. Free camera juga dapat mengarahkan fokus ke bawah permukaan saat turun.

Perbaikan dalam `lib/game/world.ts`:

- Grounding karakter underwater dilakukan sebelum pembaruan fokus.
- Fokus mengikuti tinggi seabed pada X/Z fokus yang dihaluskan, sehingga posisi dan ketinggiannya konsisten.
- Kamera free menghitung tinggi target pada posisi framing aktual.
- Collision kamera memakai titik orbit yang sama dengan arah pandang, bukan gabungan posisi karakter dan tinggi fokus lama.

Perubahan ini berlaku pada keluarga map underwater. Kecepatan Dragon Veil Wings tetap **600% total movement speed**, termasuk bonus +500%; kontrol orbit, zoom, terrain, portal, dan gameplay tidak diubah.

## Pencahayaan

| Parameter | Deep Ocean lama → baru | Abysal Trench lama → baru |
| --- | --- | --- |
| Ambient intensity | 2,1 → 1,7 | 1,7 → 0,95 |
| Directional intensity | 1,9 → 1,45 | 1,5 → 0,65 |
| Exposure | 1,12 → 1,04 | 1,12 → 0,90 |

Warna air Deep Ocean sedikit lebih gelap. Abysal Trench memakai ambient biru yang lebih redup serta latar biru sangat gelap. Dasar pasir, karakter, portal, dan HUD diperiksa dalam renderer. Pencahayaan Sunken Ruins tetap. Jarak pandang palung utara Deep Ocean tetap tersedia.

## Validasi

- **33/33 tes Node relevan lulus**: Sunken/navigation, kamera follow/zoom, serta Wings/equipment/stat persistence.
- **Typecheck, lint, build, dan diff whitespace check lulus**. Peringatan konfigurasi npm dan informasi klasifikasi route vinext yang sudah ada tetap muncul.
- Script `scripts/test-underwater-camera-revision9.mjs` menguji **32 skenario**: dua sub-map, naik/turun, follow/free, serta 30/60/120 FPS dan pola frame time bergantian 8,33/33,33/16,67/40 ms. Semua assertion lulus. Equipment Wings benar-benar dipasang lewat registry/rules fixture.
- Pada kasus Deep Ocean follow menanjak dengan frame time bervariasi, rentang posisi vertikal karakter di layar turun dari **0,03279 menjadi 0,00257 NDC** (sekitar 92%). Fokus kini konsisten 1,35 units di atas permukaan; jarak kamera tidak lagi memendek dari 10 ke sekitar 7,8 units. Kamera tetap minimal 1,2 units di atas dasar laut.
- Pengukuran kamera menjalankan tick runtime secara deterministik, dengan render dimatikan selama pengambilan angka. Ini **bukan benchmark FPS atau GPU**. Gambar pencahayaan diambil terpisah melalui renderer browser sebenarnya.
- Regresi browser Sunken lulus: 32 sudut kamera tanpa blocker menutupi karakter, tiga warp lama, Retry, reload, respawn, kedua model karakter dan attachment, serta tiga kunjungan dengan resource tetap 139 geometries / 17 textures. Tidak ada page error; hasil lengkap di `lifecycle.json`.

Bukti di `output/sunken-ruins/revision9/`: `camera-before.json`, `camera-after.json`, `camera-after-trench.json`, `lighting.json`, gambar kedua map dan HUD, serta log unit/typecheck/lint/build.

Berkas produksi yang direvisi: `lib/game/world.ts` dan `lib/game/sunken-ruins-quality.ts`.
