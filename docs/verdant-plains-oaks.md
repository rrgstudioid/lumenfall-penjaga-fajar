# Giant Oak — Verdant Plains

**Revisi aktif:** 30 oak berukuran 35% lebih besar dan rumput dengan LOD hingga 930 m. Lihat [laporan revisi meadow](verdant-plains-meadow.md). Bagian di bawah adalah catatan implementasi awal 100 oak; jumlah, rentang skala, dan benchmark awalnya sudah digantikan revisi terbaru.

Implementasi lokal, 29 September 2026. Tidak ada commit, push, atau publish.

## Hasil

- Seluruh 345 fir/broadleaf lama diganti **100 oak statis** (`oak-001`–`oak-100`).
- Kuota delapan zona: **10 / 18 / 14 / 12 / 10 / 10 / 16 / 10**. Delapan landmark tetap pada koordinat rencana.
- Variasi A/B/C: **34 / 33 / 33**. Skala seragam 0,86–1,18; landmark 1,18; tinggi master 21 m, batas radius tajuk 11,75 m.
- **497 spawn** beserta ID, koordinat, rank, dan spesies dibekukan dari baseline. **244 batu dan 265 semak** identik; RNG dekorasi lama tetap dikonsumsi sebelum pohon lama difilter.
- Rumput dan populasi tidak dikurangi. Boss yang ditemukan dalam checkout ini adalah Ancient Treant; pekerjaan oak tidak mengganti boss.
- Jalan, air, camp, gerbang, arena, hunting pocket, root flare/dekorasi, jarak monster, kemiringan, kuota grove, serta luas jejak tajuk divalidasi otomatis.

## Aset dan rendering

Master staging: `output/oak/LUMENFALL_OakTree_Master.blend`. Source master pengguna tidak dibuka untuk diedit. Bark memakai salinan `Tree_bark/tree_bark_03_2k.blend.zip` dengan detail fissure 4K baru; bukan klaim bahwa pembesaran foto 2K menciptakan detail asli. Master foliage terdiri dari daun berlobus yang dibake menjadi atlas empat sprig, lalu disusun menjadi 120 kelompok tajuk.

Turunan runtime berada di `public/assets/maps/verdant-plains-v2/oak/`. Dua material, tiga variasi, tiga mesh LOD, impostor 24 arah (8 azimuth × 3 elevasi), dan dua proxy shadow. Atlas impostor memuat warna/alpha serta normal/depth; shader menerapkan pencahayaan dan kedalaman per view. Tidak ada light atau render pass transmission baru.

| Representasi | Triangle per pohon |
| --- | ---: |
| LOD0 | 23.560 |
| LOD1 | 10.120 |
| LOD2 | 3.280 |
| LOD3 | 2 |
| Shadow Balanced | ≤1.380 |
| Shadow High | 2.140 |

Seleksi LOD memakai tinggi layar, hysteresis 15%, kualitas, frustum kamera, dan budget geometri. Kamera ortografis menggunakan skala proyeksinya, tanpa pembagian jarak perspektif. Hanya satu representasi utama per pohon. Proxy shadow dibatasi 6/8 pohon dekat pada Balanced/High, tanpa shadow pada Light. Anggaran triangle menghitung proxy pada main pass dan shadow pass.

Daun dan ujung cabang memiliki angin shader; pangkal tetap stabil. Sampling terrain identik dengan interpolasi segitiga navigasi dan hanya dilakukan pada root band. Material shadow menerima deformasi yang sama. Alpha-to-coverage merapikan tepi daun pada MSAA.

Ukuran paket: **16.097.882 byte / 15,35 MiB**, 11 file. Estimasi tekstur RGBA+mipmap: **101,33 MiB**; ditambah buffer model sekitar **6,17 MiB** dan buffer instance, sekitar **108 MiB**. Ini estimasi resource oak, bukan pembacaan VRAM perangkat.

## Integrasi dan lifecycle

- Manifest `verdant-plains-oaks.ts` dipakai renderer serta collision melalui `plainsProps()`.
- `verdant-plains-spawn-layout.ts` memisahkan home monster dari RNG/nav baru sehingga tidak terjadi siklus penempatan.
- Save di dalam batang baru mencari posisi valid dalam radius 10 m, lalu fallback camp. Schema save tidak berubah.
- Model fir/tree dan kartu lamanya tidak dimuat lagi oleh Verdant Plains; source/aset lama tetap tersedia untuk penggunaan lain.
- Gagal memuat oak menahan aktivasi map dan memakai Retry existing. Promise region diamati sejak awal untuk mencegah rejection muncul sebelum loading karakter selesai.
- Resource oak dimiliki satu map, dilepas saat map dibuang atau build gagal; texture heightfield tetap milik map.

## Verifikasi

- **16 unit test lulus:** oak/layout/navigation/population/save/asset budgets, termasuk identitas seluruh baseline dan swept movement.
- **45 pemeriksaan browser lulus:** kamera perspective/orthographic, rotasi tanpa gerak pemain, semua kualitas, reload di batang, sepuluh roundtrip East Gate, perjalanan Averion, kegagalan GLTF yang disengaja, dan Retry.
- Resource renderer stabil dalam sepuluh roundtrip: **141 geometry / 43 texture** pada titik sampling yang sama; tidak terus bertambah.
- Tidak ada error runtime tak terduga. Respons 503 yang disengaja dicatat terpisah dari error normal.
- Typecheck, lint file terkait, dan build produksi lokal diperiksa. Build Vinext memiliki pemberitahuan klasifikasi route statis yang belum tersedia; bukan kegagalan build.

Screenshot gameplay delapan zona, empat sisi, quarter, kamera tinggi, far, serta overview: `output/oak/runtime/`. Bukti lifecycle: `output/oak/runtime/acceptance.json`. Benchmark akhir setelah optimasi root: `output/oak/final-profile/performance.json`.

### Benchmark Chrome headless

Nilai berikut adalah **nilai maksimum antar-rute** dari percentile setiap sampel, bukan percentile gabungan. Termasuk gameplay, bukan hanya pohon. Tes 90 frame per titik; Light/High menguji camp dan grove tenggara, Balanced menguji delapan titik. Tidak menjamin FPS GPU perangkat pengguna.

| Resolusi | Preset | p50 / p95 / p99 (ms) | Max triangle oak | Max draw oak | CPU oak p95 |
| --- | --- | --- | ---: | ---: | ---: |
| 1920×1080 | Light | 16,6 / 22,0 / 27,3 | 30.368 | 7 | 0,2 ms |
| 1920×1080 | Balanced | 16,8 / 21,3 / 33,2 | 47.040 | 17 | 0,2 ms |
| 1920×1080 | High | 16,7 / 20,2 / 32,0 | 78.040 | 19 | 0,2 ms |
| 2560×1440 | Light | 16,7 / 20,9 / 32,7 | 43.480 | 10 | 0,1 ms |
| 2560×1440 | Balanced | 16,9 / 20,7 / 22,5 | 76.840 | 19 | 0,2 ms |
| 2560×1440 | High | 16,7 / 20,7 / 30,6 | 78.040 | 22 | 0,2 ms |

Budget geometri, draw call, paket, estimasi memori, dan CPU terpenuhi pada rute tersebut. Laporan baseline lama sempat menunjukkan delta sampai +3,4 ms, tetapi memakai urutan aktivitas yang berbeda sehingga tidak dipakai untuk kesimpulan akhir.

Pembandingan akhir menjalankan **renderer/layout sebelum oak dari HEAD secara read-only di browser terisolasi**, dengan harness, fixture, rute, kamera, preset, dan resolusi yang sama. Tidak ada checkout atau penggantian file proyek. Laporan: `output/oak/matched-baseline/performance.json`. Kenaikan p95 terbesar **+0,9 ms pada Balanced**, **+2,3 ms di seluruh preset**; memenuhi target +2,5 ms pada sampel headless ini. Beberapa sampel menunjukkan delta negatif besar akibat variasi timing browser, sehingga tidak digunakan untuk mengklaim persentase peningkatan FPS. Pengukuran GPU perangkat pengguna tetap diperlukan. Rumput/jumlah oak tidak dikurangi untuk memperbaiki angka.

## Reproduksi

1. `node scripts/author-oak-layout.mjs` — seed 71943100, baseline immutable dari `tests/fixtures/oak/legacy-layout.json`; gagal eksplisit bila kuota tidak terpenuhi.
2. Blender background: `--python scripts/build-giant-oak.py` — membuat staging, master, bake, LOD, dan atlas. Memerlukan archive bark lokal yang tercantum pada script.
3. `node scripts/install-oak-data.mjs` — memasang derivative dan manifest; `pack-oak-textures.ps1` mengemas PNG 8-bit serta normal bark JPEG kualitas 95.
4. `node --test lib/game/verdant-oaks.test.ts lib/game/verdant-plains.test.ts`.
5. Server localhost:3000, lalu `node scripts/test-oak-browser.mjs`. Gunakan `OAK_PROFILE_ONLY=1` untuk hanya benchmark dan `VERDANT_QA_OUTPUT` untuk folder laporan lain. Profil/save browser terisolasi.
6. Tambahkan `OAK_LEGACY_BASELINE=1` bersama profile-only untuk pembandingan read-only dengan source sebelum oak. Revisi default **674146c0d29ae78c99ed1380268a63698f51cf56**; bisa diatur melalui `OAK_BASELINE_REF`.

Impostor tetap pendekatan dua dimensi pada jarak jauh; perubahan view diskret dapat terlihat saat orbit ekstrem. Bentuk belakang/percabangan adalah interpretasi authoring dari satu referensi foto, bukan rekonstruksi botani persis.
