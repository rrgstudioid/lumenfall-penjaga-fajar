# Revision 11 — maze Abysal Trench dan hunting Deep Ocean

Implementasi development lokal. Terrain Sunken Ruins, warp G7/F1, kedalaman landai, dan tema cahaya revision 10 dipertahankan.

## Abysal Trench

Maze deterministik menjangkau seluruh sisi map: 45 kantong hunting dan 53 sambungan, termasuk loop serta cabang buntu. Luas navigasi hasil sampling sekitar 312.200 world-unit persegi. Lebar bersih lorong utama sekitar 43 unit; kantong hunting berdiameter desain 62–74 unit. Semua kantong terhubung ke landing dan arena `(60,-355)`, radius 95.

Collision, heightfield, minimap, dan pemulihan save memakai sumber layout yang sama. Pencarian segmen serta kantong memakai indeks sektor 128 unit; pemeriksaan terrain tidak memindai seluruh maze pada setiap sampel. Terrain tetap diculling per chunk.

Area hunting disiapkan sebagai layout. Populasi Abysal Trench tetap kosong, termasuk arena boss, sesuai keputusan sebelumnya. Monster baru dalam revisi ini hanya di Deep Ocean.

## Deep Ocean

| Monster | Level | Jumlah |
| --- | ---: | ---: |
| Goblin Shark | 38 | 76 |
| Deep Baracuda | 40 | 116 |
| Deep Marlyn | 43 | 64 |
| Giant Squid | 46 | 62 |
| Giant Squid · Elite | 47 | 16 |
| Megalodon | 48 | 1 |

Total 335. Spawn tersebar pada lattice 50 unit dengan variasi posisi deterministik. Portal mempunyai buffer aman, dan home Megalodon `(-240,-280)` mempunyai area bebas spawn lain beradius 95. Akses tetap melalui warp, dengan syarat masuk existing level 32; rekomendasi hunting kini 38–48.

Stat memakai scaling rank existing. Respawn normal 25 detik, elite 60, boss 120. EXP dan loot aktif memakai mekanisme existing, material vibranium dan rune boss Jayantara existing; tidak ada quest atau item baru. Abysal Trench secara eksplisit tidak mewarisi populasi/loot Deep Ocean.

## Model dan combat

Enam mesh original procedural, satu mesh/material per monster, kurang dari 5.000 vertex per model. Siluet memiliki sirip/ekor, moncong shark, paruh marlyn, serta sepuluh lengan/tentakel squid. Gerak ekor/tentakel lewat shader, tanpa animation mixer per monster. Megalodon sekitar 26,2 unit panjang, skala empat kali model shark normal.

Range monster laut memakai permukaan kapsul tubuh horizontal. Basic attack, pemilihan target skill, auto approach dan validasi dash mengikuti permukaan ini, sehingga karakter tidak perlu masuk ke pusat Megalodon. Collision radius mempertimbangkan ukuran model; hover tidak mengubah posisi gameplay. Monster darat tanpa bentuk kapsul tetap memakai range ke pusat existing.

Model adalah geometri stylized runtime, bukan model realistis hasil Tripo. Tidak ada kredit API yang digunakan dan tidak ada source asset yang diubah.

## Verifikasi

- Suite diperluas: **111/114 lulus**. Tiga kegagalan juga direproduksi pada salinan Git HEAD `2c637c2`: transisi Blade Master di `accuracy-evasion.test.ts`, ekspektasi stat 145 versus 62 di `combat-foundation-v3.test.ts`, dan training weapon di `combat-power.test.ts`. Ketiganya dicatat sebagai masalah existing, bukan diperbaiki dalam revisi map.
- Tes map/populasi/loot/geometry, save/travel, camera dan Wings dalam suite tersebut lulus. Semua node maze dapat dijangkau; setiap edge memiliki clearance navigasi; model finite dan distinct; semua spawn di area valid dan di luar portal aman.
- Browser: 335 monster aktif, hanya enam terlihat dari landing. Basic attack normal/elite/boss, auto approach, dash-gap validation, reward, death, deadline save, respawn, chase dan return lulus. Tidak ada console/page error.
- Warp Sunken → Deep → Abysal → Deep → Sunken dan reload di maze lulus. Main route ke arena dilalui pada follow/free, 876 langkah masing-masing.
- Wings speed 600 mencapai arena melalui maze pada simulasi tick 30/60 Hz, follow/free. Clearance minimum kamera sekitar 3,91 unit follow dan 13,98 unit free. Ini tes perilaku, bukan benchmark FPS.
- Smoke performa: Chrome headless 1280×720, empat preset, satu adegan per map, warm-up 1,5 detik + pengambilan 6 detik. Median 60 FPS, p95 16,8–17,1 ms; Deep 10–18 draw calls, 4.700–5.998 triangle pada frame terakhir; Abysal 6–14 calls, 4.800–6.098 triangle. Angka ini hanya adegan yang diuji, bukan budget traversal penuh atau jaminan untuk perangkat lain. GPU time/VRAM byte tidak diukur.
- Typecheck, lint, build, dan diff whitespace diperiksa. Bukti, log, minimap dan screenshot spesies ada di `output/sunken-ruins/revision11/`.

Berkas utama: `abysal-trench-layout.ts`, `deep-ocean-layout.ts`, `deep-ocean-population.ts`, `deep-ocean-monster-models.ts`, `monster-models.ts`, `regions.ts`, `field-layout.ts`, `monster-loot.ts`, dan `world.ts`. Tidak dipublikasikan.
