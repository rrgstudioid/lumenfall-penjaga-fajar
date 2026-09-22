# Phase F4 — prototype terrain LUMENFALL pertama

Status: **prototype lokal selesai; layak direview sebagai rancangan ruang, belum map produksi.**

Nama sementara: **Cekungan Lentera**. ID: `lumenfall-terrain-prototype-01`.
Entry lokal: http://127.0.0.1:3004/terrain-prototype.html

## Ringkasan pemilik

| Area | Hasil |
|---|---|
| Referensi sumber | Heightfield netral hasil decode tile riset `WdMadrigal13-06`, bukan seluruh 49 tile. File `.lnd` tidak dibaca oleh runtime prototype. |
| Ukuran | 320 × 384 unit LUMENFALL, diasumsikan meter untuk pengukuran prototype; 12,288 ha. Elevasi 4,91–83,71. |
| Transformasi | Sampel sumber diputar 31°, footprint sampling 0,88, low-pass 9 sampel, kontribusi relief sumber diperkecil menjadi 18%. Ridge, cliff, tujuh zona, koridor dan sungai kemudian dibentuk secara authored. Tidak ada noise acak pada heightfield. |
| Layout baru | Hub barat daya, lapangan tengah-barat, koridor barat laut, highland timur laut, sungai utara–selatan, arena timur, dan cadangan reruntuhan utara. |
| Jalan | Jalur utama 8 m, jalur sekunder 4 m; dua loop baru. Tidak memakai road placement/mask Flyff maupun road mask Padang Arunika. |
| Landmark | Tujuh reservasi, masih berupa marker dan footprint, bukan bangunan final. |
| Material | Rumput dan rocky terrain dari material library Arunika; tanah prosedural, kayu/batu/air dari sistem material LUMENFALL. Tidak ada DDS/O3D Flyff. |
| Collision | Segitiga terrain netral → `ImportedMapGround` existing. Air non-walkable, bridge netral dapat dilalui. Tidak menggunakan collision object Flyff. |
| Karakter | Karakter rigged LUMENFALL, animasi dan input WASD/camera dari `Game` existing. Save/preferences hanya di memori. |
| Uji browser | Chrome 151.0.7922.108, headed, 1600×950. Input nyata, camera orbit, perjalanan hub–field dan penyeberangan sungai berhasil. Console/page/resource errors: 0 pada hasil final. |
| Originality | Kombinasi kota/jalan/landmark/material/placement Flaris tidak dipertahankan. Namun heightfield ini tetap punya provenance riset turunan; perubahan visual bukan klaim bahwa sumber terrain sudah independen atau siap dipublikasikan. |
| Produksi | Cocok sebagai dasar keputusan layout dan skala. Belum siap mengganti Arunika/Padang atau menjadi asset produksi final. |

## Transformasi per area dan rencana landmark

Semua nama sementara untuk review. Tidak ada monster, NPC interaktif, quest, dungeon aktif, EXP atau drop.

| Zona / landmark | Lokasi X,Z | Perubahan desain dari referensi umum |
|---|---:|---|
| 1. Ambang Lentera — Gerbang dua lentera | -100,110 | Membuat plateau hub SW pada Y24; batas oval baru, cadangan footprint bangunan 12×16 m. Tidak merekonstruksi plaza/kota sumber. |
| 2. Ladang Sela — Penanda kincir ladang | -52,34 | Membentuk lapangan Y14 beradius desain 49×35 m; fungsi transisi hub–field, bukan mengikuti daerah material sumber. |
| 3. Lintasan Kanopi — Jejak pohon payung | -100,-62 | Koridor rendah memanjang di sisi ridge barat; cadangan forest. Belum ada hutan final. |
| 4. Punggung Batu Angin — Menara batu berongga | 78,-112 | Plateau highland Y50 dan ridge timur laut baru; dapat menjadi camp/quarry setelah desain gameplay terpisah. |
| 5. Tepian Kilau — Jembatan pita | 30,-20 | Sungai dan crossing baru; choke point lebar 8 m. Deck greybox 34×8 m pada Y15,95. |
| 6. Cekungan Gema — Lingkar gema | 105,74 | Arena terbuka timur pada Y22 dengan lingkar reservasi radius17 m; belum field boss. |
| 7. Gapura Sunyi — Gapura terbelah | -20,-137 | Plateau reruntuhan utara Y36 dan cabang ke loop; cadangan entrance, tanpa koneksi map. |

Base sederhana: `13 - 0.025*z + 0.18*(filteredReference - 116)`. Ridge memakai beberapa bentuk elips authored; plateau diratakan bertahap dengan smoothstep; jalan mengarahkan elevasi koridor; sungai mengukir jalur terakhir. Rata-rata beda elevasi terhadap sampel sumber yang hanya di-offset datum100 adalah **18,71 unit**. Ini metrik perubahan, bukan ukuran legal/originalitas.

River baru: `x = 30 + 10*sin((z+10)/60)`, permukaan `y = 9+(170-z)*0.025`, rentang Z -174..174, lebar air8 m. Dasar berada sekitar1,6 m di bawah air. Ini sungai prototype sederhana; belum hidrologi, waterfall atau riverbank art final.

## Skala, perjalanan dan keterbacaan

- WASD nyata: sekitar **22,8 m / 3 detik**. Kecepatan runtime tidak diubah: `6.2 × movementSpeed × 1.22 / 100`, sekitar7,564 m/s pada fixture.
- Hub → Ladang melalui dua segmen jalan: sekitar90,45 m, **11,95 detik** waktu simulasi dan wall-clock. Steering pengujian hanya mengarahkan yaw; gerakan tetap input W dan tick runtime, tidak teleport sepanjang rute.
- Crossing: karakter berjalan dari X18 sampai sekitarX43 melewati sungai, Y mengikuti deck15,95. Teleport hanya dipakai untuk menyiapkan lokasi awal uji crossing.
- Jalur utama319,10 m: estimasi42,2 detik. Loop barat lengkap ±586,4 m: ±77,5 detik. Loop timur lengkap ±430,6 m: ±56,9 detik. **Durasi loop adalah estimasi**, bukan klaim semua loop sudah dimainkan manual. Ketiga polyline diperiksa dengan collision existing: 0 langkah terblokir.
- Jarak lurus hub–field89,9 m, hub–crossing183,8 m, hub–highland284,5 m. Pemeriksaan sampel tinggi dari mata di hub ke marker atas menunjukkan koridor sightline tanpa occlusion terrain; ini bukan visibility final setelah pohon/bangunan ditambahkan.
- Scale proxies: NPC1,75 m; small monster0,8 m; large monster3,8 m; footprint bangunan12×16×8 m. Semua hanya geometri netral, bukan entity gameplay. Ring3,5 m /8 m membantu menilai jangkauan; **bukan pengujian combat target baru**.
- Foto ground-eye menunjukkan route, lereng dan elevasi dapat dibaca. Beberapa embankment masih terlalu tegas seperti potongan greybox. Tikungan polyline, cliff transition, kelandaian dekat jembatan, serta siluet landmark perlu pass berikutnya.

### Rekomendasi ukuran

Pertahankan section320×384 untuk review awal. Jangan langsung memakai footprint3584×3584: pada kecepatan sekarang, garis lurus sepanjang3584 memakan sekitar7,9 menit tanpa pertempuran. Lebih aman menguji beberapa region yang terhubung setelah loop ini disetujui. Ukuran sekarang cukup untuk uji traversal, belum bukti kapasitas seluruh leveling Core Job.

## Arsitektur teknis

`research height.f32le → offline build.mjs → neutral height + road mask + manifest → dev scene → Game subclass`

- Output terrain: grid161×193, spacing2 m; 61.440 triangle terrain.
- **30 chunk**64×64 m maksimum, frustum culling Three.js; normals dihitung dari grid global agar sambungan tidak memakai normal tepi berbeda.
- Data height+road mask hanya **248.584 byte**; metadata terpisah. Tidak ada proprietary parser pada route runtime.
- Collision: mesh terrain pada resolusi yang sama, dengan triangle di koridor air dikeluarkan; bridge ditambahkan sebagai mesh biasa. Spatial hash existing2 m, langkah gerak existing≤0,2 m. Tidak memakai special material alias bridge Sands untuk melompati tebing.
- Uji batas: X160 tidak bisa bergerak keluar. Di center sungai Z100 tidak ada lantai walkable. Cliff uji dariX121 menuju133 berhenti sekitarX124. Ketinggian bridge dari Float32 sekitar15,9499998, ditoleransi1e-5 dalam validasi, bukan diubah precision runtime.
- Shader tanah baru mencampur texture library grass4,8 m, rock12 m, dan tanah dari road mask baru. Rock triplanar/slope-aware; bukan tujuh lapisan LND. Base color/roughness prototype, belum full normal/roughness terrain pass akhir.
- Air memakai `ArunikaMaterials.water_pond` pada strip sungai authored. Geraknya visual sederhana, belum flow-vector sepanjang channel.
- Vegetasi: satu batch instanced tuft library LUMENFALL di patch field, menghindari jalan. Tidak ada penanaman seluruh map.
- Player memakai Game asli: gerak, camera follow/RMB, animasi dan collision adapter existing. Subclass dev mengganti terrain/entity construction dan penyimpanan saja; tidak ada perubahan `lib/game`.
- Manifest map tidak dimasukkan ke `FIELDS`, graph teleport, UI pemilihan region atau save schema. Hero fixture memiliki ID field internal yang valid hanya di memori; label/geometry/collision prototype datang dari scene dev, bukan produksi.
- LocalStorage/sessionStorage diganti memory storage **sebelum** modul game diimpor. `save()` dev tidak menulis. NPC/enemy production builder dinonaktifkan. Pergantian region ditolak pada harness.
- Cleanup `pagehide`: HUD RAF dibatalkan, `Game.dispose()` membersihkan renderer/input/scene, collision geometries dan palette lokal dilepas.
- Browser menunjukkan sekitar60 fps pada mesin ini; contoh ground view19–39 draw calls, overview67. Angka ini bukan benchmark perangkat rendah. Jumlah triangle seluruh render juga memasukkan karakter rigged dan pass shadow (sekitar177–199 ribu pada frame yang direkam).
- Belum streaming terrain/LOD; belum diperlukan untuk footprint ini. Jangan mengalikan arsitektur ini ke49 tile tanpa profiling. Marker tidak punya gameplay collision; hanya terrain+bridge yang diuji.

## Files baru / evidence

- `dev-prototypes/lumenfall-terrain-prototype-01/build.mjs`: konversi offline, authored layout, provenance.
- `manifest.json`, `height.f32le`, `road.f32le`, `provenance.json`: export neutral terisolasi.
- `prototype.test.mjs`, `verify-types.mjs`: focused checks dan perbandingan diagnostik.
- `tests/browser/terrain-prototype.html`, `.css`, `.ts`: route dev, memory character, HUD/controls.
- `tests/browser/terrain-prototype-scene.ts`: material/chunk/marker/collision builder.
- `tests/browser/terrain-prototype.vite.config.ts`: localhost3004, memakai public material/character library existing.
- `tests/browser/terrain-prototype-verify.mjs`: headed Chrome, keyboard movement, camera, screenshots, route/collision checks.
- `tests/browser/terrain-prototype-input-check.mjs`: headed checks W/A/S/D terpisah, wheel zoom, ESC pause/resume; hasil `evidence/input-result.json`.
- Dokumen ini. Tidak ada file gameplay/map produksi yang diedit untuk F4.

### Bukti perbandingan yang diminta

A. [Source research terrain, screenshot F3-A3 sebelumnya](../dev-imports/flyff-flaris/f3a3/evidence/01-top-down.png). Gambar ini hanya referensi dan mengandung material/objek riset; **tidak dimuat prototype**.

B. [Transformed terrain overview](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/02-transformed.png).

C. [Top-down layout baru](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/03-top-layout.png).

D. [Player ground-eye](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/04-ground-eye.png), [setelah WASD+RMB](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/05-walk-camera.png).

E. [Road/landmark plan](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/08-road-landmark-plan.png).

Tambahan: [hub→field](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/06-town-to-field.png), [river crossing](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/07-river-crossing.png), [browser measurements](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/browser-result.json), [TypeScript comparison](../dev-prototypes/lumenfall-terrain-prototype-01/evidence/typescript.json).

## Hasil verifikasi

- Existing `lib/game`: **502 passed, 0 failed**; tidak dikurangi atau diubah.
- Focused F4 checks: **5 passed, 0 failed** (termasuk pemeriksaan evidence hasil browser; bukan pengganti browser run).
- Headed browser: berhasil; tidak ada error/shader failure/resource404 pada run final. Gagal awal favicon404 diperbaiki dengan favicon kosong lokal. Marker yang menutup karakter dan z-fighting deck dirapikan.
- Production build `vinext build`: berhasil, warning ukuran chunk>500kB dan static route classification existing. `npm` tidak tersedia di PATH shell ini; CLI package yang sama dijalankan lewat Node. Tidak publish.
- TypeScript sumber primer: **9 existing → 9, 0 baru**. Rinciannya4 appearance fallback,1 UI layout,1 browser snapshot,3 viewer Flaris lama. Perbandingan existing vs existing+F4 dilakukan dengan compiler options yang sama dan mengeluarkan salinan archive/output. Pemeriksaan root tanpa filter juga mencakup salinan publish/tool templates; tidak dilaporkan seolah semuanya error F4.
- Hash input neutral riset sebelum/sesudah sama: `423fb53d2f3072efb4c2b25de05db9776d5a68de54855431f1617faefe0e50a0`.
- Task ini tidak menulis/memindah/menghapus file di `D:\FlyffUS`; konversi hanya membaca neutral export sebelumnya. File LND asli dibaca kembali untuk hash akhir: `4437ba8093935017912f9453b209b5ade6e08926ac9f04a3825d4fde340ccf68`, sama dengan baseline F3-A3. Tidak mengekstrak model atau mengejar coverage. Tidak ada Flyff art request pada prototype.
- Supplemental headed input check: W/A/S/D masing-masing bergerak pada arah yang benar sekitar3,78–3,91 m per0,5 detik, wheel mengubah camera distance10→13,50; ESC pause/resume berhasil.

## Originality review dan langkah setelah persetujuan

Tidak terlihat kombinasi1:1 layout kota, jalan, landmark, placement atau identitas material Flaris. Bukti top-down memperlihatkan layout dua-loop/new river, berbeda dari jalan dan landform sumber. Namun tidak mengklaim penilaian visual ini menjadikan asset turunan siap produksi secara otomatis.

Berikutnya, **hanya setelah owner menyetujui layout**: rapikan grade jalan/riverbank dan tepi map, beri siluet landmark yang berbeda, uji traversal lebih lama dan low-end hardware, lalu author terrain produksi dengan provenance independen berdasarkan layout yang disetujui. Material detail, flora, cliff collision menyeluruh, occlusion camera oleh bangunan, dan final entrance/exit masih belum selesai.

Map ini cocok sebagai **base desain ruang**, bukan map produksi yang langsung dipasang. Tidak ada perubahan Warrior, job, skill, stat, movement speed, monster, EXP, item atau drop. Tidak ada quest/monster final; tidak ada penggantian Arunika/Padang; tidak ada publish. **STOP setelah F4.**

## Menjalankan ulang secara lokal

```powershell
node dev-prototypes/lumenfall-terrain-prototype-01/build.mjs
node node_modules/vite/bin/vite.js --config tests/browser/terrain-prototype.vite.config.ts
# Buka http://127.0.0.1:3004/terrain-prototype.html
```

`build.mjs` sengaja membutuhkan heightfield riset yang sudah divalidasi; tidak mengunduh atau membaca archive Flyff. Jangan memasukkan `dev-prototypes` atau research outputs ke pipeline publikasi.
