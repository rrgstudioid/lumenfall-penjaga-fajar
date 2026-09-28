# Verdant Plains / Padang Arunika

## Status terbaru: penggantian map lama

Verdant Plains sekarang menggantikan `verdant-plains` sebagai field pertama di menu M. ID map lama dihapus dari registry perjalanan, koneksi kota, daftar unlock, NPC field, dan tujuan quest. Teleport ke ID lama ditolak. Karakter dengan save di map lama dimigrasikan ke Arunika Rest; save yang sedang berada di kota mempertahankan kota dan koordinatnya. Riwayat quest, inventory, equipment, gold, dan progress lama tetap tersimpan.

Definisi monster/loot starter dan geometri historis tetap menjadi data bersama/fixture; East Gate serta Sands tetap menggunakan konten mereka sendiri tanpa perubahan balance. Tidak ada penghapusan aset master atau publish.

Validasi penggantian: 44/44 tes map/audio/migrasi lulus, 6/7 tes field-expansion lulus (kegagalan overflow loot existing), typecheck, lint, dan build lulus. Browser terisolasi memverifikasi urutan menu M, tidak ada kartu lama/duplikat, perjalanan Averion–Verdant Plains, serta reload save migrasi. Bukti: `output/verdant-plains/retirement/retirement.json` dan `map-menu.png`.

Catatan di bawah merupakan riwayat implementasi sebelum penggantian map lama.

Map eksplorasi lokal baru, ID `verdant-plains-v2`, luas 1000 × 1000 world units. Buka **M → Verdant Plains → Teleport field** mulai level 1. Entry dan respawn berada di Arunika Rest. Klik gerbang di ujung jalan utara dari jarak dekat untuk masuk Averion; kembali melalui M. Tidak ada monster, NPC, quest, loot, atau boss baru.

Map `verdant-plains`, East Gate, Averion, aset master, dan schema save karakter dipertahankan. Lima hunting pocket serta satu clearing hanya metadata untuk pekerjaan konten berikutnya. Kecepatan gerak, ukuran karakter, range skill, dan kamera gameplay tidak diperbesar untuk map ini.

## Layout dan runtime

`lib/game/verdant-plains-layout.ts` adalah sumber terrain, jalan, sungai, pesisir, camp, bridge, props, safe zone, dan navigation. Koordinat desain dikonversi dengan `x=u−500`, `z=v−500`.

| Lokasi | World X, Z |
| --- | --- |
| Arunika Rest / entry / respawn | −380, −20 |
| Gerbang Averion | 40, −440 |
| Jembatan tunggal | 120, −10 |
| Bounds nominal | −500…500 pada kedua sumbu |

Heightfield 513² dibagi menjadi 16² chunk dengan empat tingkat LOD. Chunk dekat player memakai resolusi penuh; sampler menggunakan interpolasi segitiga dengan diagonal yang sama. Deck jembatan memiliki tinggi berjalan sendiri. Navigation memakai spatial grid props dan swept steps 0,4 unit. Jalan diratakan dengan transisi ke bukit; pengujian memastikan grade jalan <8°, mayoritas pocket <15°, serta konektivitas semua pocket dari camp.

`lib/game/verdant-plains-map.ts` memiliki scene root, loader, material bersama, instancing, chunk LOD, grass, minimap, dan disposal. Hasil load yang sudah tidak relevan dibuang melalui token lifecycle existing. Gagal memuat aset menggunakan overlay Retry existing. Posisi save map ini divalidasi memakai bounds dan permukaannya sendiri; posisi air/nonfinite/di luar map kembali ke camp.

## Aset dan visual

Turunan runtime berada di `public/assets/maps/verdant-plains-v2/`. `provenance.json` mencatat sumber lokal. Landmark kota telah dihapus sesuai permintaan pemilik; tidak ada aset kota yang dimuat oleh map ini. `asset-budget.json` berisi ukuran dan SHA-256 masing-masing berkas.

- Terrain: grass_ground, dirt, sandy_gravel_02, rock_face_03, medieval_wood, normal air lokal.
- Model: Verdant Cemara dan Beringin dibuat khusus lalu dibake; shrub_03, bagian modular wooden pier, dan Banner_1 memakai koleksi lokal.
- Pohon dekat memakai turunan geometri; kanopi jauh memakai satu billboard yang menghadap kamera. Billboard disembunyikan saat model dekat aktif, sehingga tidak ada geometri ganda. Seleksi dekat berlaku pada seluruh bagian pohon sekaligus.
- Batu memakai tiga bentuk boulder prosedural, masing-masing 80 triangle, dibagi lewat instancing. Bentuk dipertahankan; material terbaru memakai rock_boulder_dry dengan albedo triplanar, bump, dan roughness.
- Rumput memakai tiga helai melengkung per rumpun dekat dan satu helai jauh, gradasi pangkal?ujung, mask jalan/air/camp, serta fade jarak. Penempatan world-space, heightfield, wrapping, dan angin dihitung GPU; tidak ada pembangunan ulang ribuan instance saat melewati sel 10 unit.
- Tenda dan api unggun memakai geometri ringan. Gerbang perjalanan Averion tetap tersedia; landmark kota tidak ditampilkan.
- Air memakai scrolling normal dan warna kedalaman dari heightfield. Tidak ada refleksi realtime atau bloom baru.

Preset dapat dipilih melalui **Escape → pengaturan → Detail Verdant Plains**. Default Balanced, disimpan sebagai preferensi perangkat tersendiri.

| Preset | Maksimum rumput dekat/jauh | DPR maksimum | Shadow |
| --- | --- | --- | --- |
| Light | 4.000 / 2.000 | 1 | Off |
| Balanced | 8.000 / 4.000 | 1,25 | 1024 |
| High | 16.000 / 8.000 | 1,5 | 2048 |

Model karakter existing pada fixture memiliki sekitar 369 ribu triangle. Khusus map ini, bayangannya memakai caster sederhana milik map agar model tersebut tidak dirender ulang dalam shadow pass. Tampilan karakter tidak berubah; flag shadow aslinya dipulihkan saat keluar dari map. Kanopi jauh dan bayangan karakter adalah pendekatan LOD; kualitasnya tidak dimaksudkan identik dengan ilustrasi referensi.

## Regenerasi aset

Jalankan hanya terhadap staging dan output runtime. Script tidak menyimpan `.blend` dan tidak menulis ke koleksi master.

1. `scripts/prepare-verdant-assets.py` dengan Python yang memiliki Pillow.
2. Blender background `--factory-startup --python scripts/export-verdant-models.py`.
3. `scripts/compact-verdant-glb.py` dengan Pillow.
4. Blender background `--factory-startup --python scripts/render-verdant-impostors.py`.
5. `scripts/prepare-verdant-banner.py` dengan Pillow.
6. `scripts/prepare-verdant-polish.py` dengan Pillow.
7. Blender background `--factory-startup --python scripts/bake-verdant-trees.py` (setelah compact; atlas baru tetap 1K).
8. Dengan dev server lokal aktif: set `VERDANT_BAKE_TREE_CARDS=1`, lalu jalankan `node scripts/test-verdant-v2-browser.mjs`; hapus environment flag sebelum regresi biasa. Ini membake kartu jauh dengan lighting runtime.
9. `node scripts/audit-verdant-assets.mjs`.

Root master sesuai direktori yang diberikan pemilik. Seluruh ekstraksi sementara berada di `output/verdant-plains/`, bukan di source master. Tidak memakai aset atau kode dari game Tesana/Lyrio.

## Verifikasi

```powershell
node --experimental-transform-types --test lib/game/verdant-plains.test.ts lib/game/field-terrain.test.ts lib/game/field-expansion.test.ts lib/game/east-gate.test.ts lib/game/field-quest-travel.test.ts lib/game/item-cleanup.test.ts lib/game/stage03-collision.test.ts lib/game/bgm.test.ts
corepack pnpm exec tsc --noEmit
corepack pnpm build
node scripts/test-verdant-v2-browser.mjs
node scripts/audit-verdant-assets.mjs
```

Browser regression memakai Home + Game di Chrome dengan profil dan save sementara. Handle QA disisipkan ke respons dev server oleh Playwright; tidak dikirim dalam source game. Skenario mencakup movement keyboard, menu M, gerbang, preset, reload posisi jauh, respawn, tiga kali perjalanan ke Averion, populasi map lama, dan kegagalan HTTP 503 yang disengaja diikuti Retry.

Hasil rinci lokal: `output/verdant-plains/regression.json`, `performance.json`, screenshot `camp.png`, `bridge.png`, `central.png`, `coast.png`, `north.png`, dan `overview.png`. Benchmark memakai delapan titik, 90 frame berjalan per titik, pada 1920×1080 dan 2560×1440. Counter direset **sebelum** render agar shadow pass ikut dihitung; default `renderer.info` Three mereset counter setelah shadow pass. Hasil Chrome headless bukan jaminan performa GPU/interaksi pada semua perangkat dan equipment.

Pengukuran awal sebelum optimasi 29 September 2026, preset Balanced, fixture Adventurer level 1 (lihat hasil optimasi terbaru di bawah):

| Ukuran | p50 frame | p95 terburuk per titik | Draw call maksimum | Triangle maksimum, termasuk shadow |
| --- | --- | --- | --- | --- |
| 1920×1080 | 16,6–16,8 ms | 21,3 ms | 246 | 528.462 |
| 2560×1440 | 16,7–16,8 ms | 19,1 ms | 246 | 528.462 |

Pada implementasi awal, resource GPU setelah tiga perjalanan berulang stabil pada 93 geometry / 20 texture pada posisi uji yang sama. Estimasi tekstur milik map sekitar 56,01 MiB setelah decode dan mipmap; itu bukan ukuran download. Paket tambahan berisi **22 berkas, 11.709.786 byte / 11,17 MiB**, di bawah budget 20 MiB. Resource Timing mencatat 11.703.169 byte body aset pada skenario cold load + retry, termasuk respons kegagalan yang disengaja. Aset karakter dan aset shared existing berada di luar ukuran paket tambahan ini.

Suite relevan: **57 lulus, 1 gagal baseline**. Delapan pengujian map baru lulus. Kegagalan baseline adalah `field-expansion.test.ts` pada overflow loot, ekspektasi `pendingLoot.length === 1` menghasilkan 0. Kegagalan yang sama direproduksi dari source commit awal `5fb0c3e` pada salinan source commit terpisah dalam `output/verdant-plains/baseline/`; mekanisme loot tidak diubah untuk menutupi masalah tersebut. Typecheck dan lint file terkait lulus. Build menghasilkan warning ukuran chunk existing dan klasifikasi route Vinext, tanpa error build.

Implementasi ini tidak melakukan commit, push, atau publish.

## Perbaikan setelah uji pemilik - 29 September 2026

Landmark Averion serta aset turunannya dihapus. Teleport melalui menu M dan gerbang utara tetap bekerja. Terrain playable, collision, progression, dan sumber master tidak diubah. Tekstur rock_face tetap dipakai terrain; model rock_07 dan gambar rock-far yang sudah digantikan tidak dikirim lagi. Paket setelah optimasi awal: **18 berkas, 9.226.898 byte / 8,80 MiB**.

Penyebab stutter yang terukur adalah `updateGrass`: setiap perpindahan sel 10 unit menghitung jarak ke seluruh polyline jalan/sungai untuk ribuan calon rumput dan mengunggah matriks ulang. Diganti dua patch GPU statis dengan mask yang dihitung sekali saat loading. Material DoubleSide backdrop juga dipisahkan agar tidak mengubah side seluruh terrain.

Rute QA 160 unit, 480 frame, resolusi 1920x1080, Balanced, perangkat/browser yang sama:

| Metrik | Sebelum | Sesudah |
| --- | ---: | ---: |
| Frame p95 | 23,4 ms | 18,6 ms |
| Frame p99 | 50,3 ms | 25,5 ms |
| Pembaruan map p99 | 33,7 ms | 0,7 ms |
| Pembaruan map maksimum | 48,4 ms | 1,2 ms |

Ini pengukuran Chrome headless, bukan jaminan FPS pada GPU pemilik. Detail sampel ada di `output/verdant-plains/before-optimization/traversal-profile.json` dan `output/verdant-plains/optimized/traversal-profile.json`. Rute panjang melintasi banyak batas sel, melengkapi benchmark titik pendek awal yang melewatkan lonjakan tersebut. Jalankan dengan `VERDANT_PROFILE_ONLY=1` dan `VERDANT_QA_OUTPUT` untuk folder hasil terpisah.

Verifikasi akhir optimasi: 8 test map, typecheck, lint, build, serta regresi browser lulus. Sambungan terrain-backdrop kini berbagi vertex tepi yang sama; skirt chunk diperdalam untuk menutup celah LOD. Screenshot akhir berada di `output/verdant-plains/optimized/` termasuk `north.png`, `rocks.png`, dan `central.png`.

Pada 16 sampel Balanced (1080p/1440p), maksimum 249 draw call dan 575,933 triangle termasuk shadow pass. Resource setelah tiga perjalanan: [{"geometries": 96, "textures": 20}, {"geometries": 96, "textures": 20}, {"geometries": 96, "textures": 20}]. Tidak ada error runtime/aset tak terduga; HTTP 503 hanya fixture untuk pengujian Retry.

## Pohon, material, dan angin - penyempurnaan terbaru

- Dua pohon baru: Verdant Cedar (1.516 triangle) dan Meadow Oak (1.192 triangle). Bentuk batang bercabang dan kelompok tajuk dibuat di scene Blender kosong. Warna dari master bark_willow dan leafy_grass, dikalikan ambient occlusion lokal, dibake dengan Cycles ke atlas 1024x1024. Tidak mengedit blend master. Atlas tertanam di GLB, tanpa tekstur sumber besar tambahan.
- Kartu pohon jauh dibake dari mesh yang sama menggunakan Three, light rig map, exposure, dan tone mapping runtime. Tone mapping kartu dimatikan agar tidak diterapkan dua kali. Model dekat tetap lit; kartu jauh adalah pendekatan dengan cahaya statis. Model penuh dapat dipakai sampai 48 unit dalam budget triangle yang tetap.
- Shape batu tetap sama. Master rock_boulder_dry menyediakan color dan displacement yang dipakai sebagai bump, bukan geometri. Albedo triplanar mengurangi sambungan tekstur pada bentuk bersudut.
- Air memakai master water_surface dan water_ocean_normal_map: dua normal scrolling dengan arah/skala berbeda, tekstur warna permukaan, warna berdasarkan kedalaman, foam, dan Fresnel langit sederhana. Tidak ada render reflection/refraction pass tambahan.
- Rumput memiliki gelombang angin world-space yang bergerak, gust lebar, flutter lokal, dan lengkungan ujung. Pangkal tetap menempel pada heightfield; data instance tetap statis di GPU. Kepadatan tidak ditambah.

Provenance tambahan: `polish-provenance.json`; laporan bake: `tree-bake-report.json`. Screenshot dan hasil regresi: `output/verdant-plains/material-polish/`. Pengujian kamera tetap pada t=0 dan t=0,8 memverifikasi bahwa grass-wind dan water-ripples benar-benar mengubah pixel render. Geometri terrain, navigasi, teleport, save, dan gameplay tidak berubah.

Hasil terbaru: paket 24 berkas, 6.971.360 byte / 6,65 MiB. Pada rute 160 unit, frame p95 18,4 ms, p99 19,9 ms; update map p99 0,8 ms dan maksimum 1,5 ms. Pengukuran Chrome headless, bukan jaminan FPS GPU perangkat pemilik.

Maksimum 16 sampel Balanced: 251 draw call, 570,159 triangle termasuk shadow. Resource pada tiga perjalanan: [{"geometries": 99, "textures": 27}, {"geometries": 99, "textures": 27}, {"geometries": 99, "textures": 27}]. Delapan test map, typecheck, lint, dan regresi browser lulus.

## Revisi tajuk dan angin gameplay

Tajuk bola diganti sepenuhnya. Cemara/pinus menggunakan tujuh tingkat cabang dengan ujung meruncing dan tepi bergerigi (1.456 triangle). Beringin menggunakan cabang horizontal, tajuk payung pipih bertingkat, batang beralur, dan akar gantung (2.460 triangle). Keduanya dibake ulang ke atlas 1K dan kartu LOD dengan cahaya runtime. URL aset pohon diberi revision query untuk mencegah cache model lama.

Rumput dekat dirapatkan ke patch 48 unit, dengan fade 18-23 unit; patch jauh 108 unit, fade sampai 53 unit. Jumlah instance setiap preset tetap, rumput jauh memakai dua helai ringan. Tinggi dekat 0,57-0,70 unit sebelum variasi scale. Ayunan kini melewati arah netral dan memakai gust, gelombang menyapu, serta flutter; pangkal tetap di tanah.

Tes animasi sekarang memakai tick game selama 0,8 detik, tanpa menyuntikkan nilai waktu shader. Kamera diam dan objek selain grass/water disembunyikan hanya pada pengujian pixel. Rekaman gameplay biasa: `output/verdant-plains/banyan-wind/grass-live.webm`. Screenshot dan regresi ada di folder yang sama.

Paket aset 24 berkas / 6.569.198 byte (6,26 MiB). Delapan test map, typecheck, lint, serta regresi lengkap termasuk teleport, save, retry, LOD, dan resource stabil lulus.

Balanced: maksimum 251 draw call dan 585,999 triangle termasuk shadow pada 16 sampel 1080p/1440p. Pengukuran headless, bukan jaminan FPS perangkat pemilik.

## Pohon lebih renggang dan rumput responsif terhadap karakter

Pohon dikurangi deterministik dari 817 menjadi 345 (210 cemara/pinus, 135 beringin), sekitar 58% lebih sedikit. Batu tetap 244 dan semak 265, tanpa perubahan posisi. Filter dilakukan pada sumber layout bersama, sehingga collider batang ikut hilang dan tidak menyisakan penghalang tak terlihat.

Tinggi dasar rumput dekat kini 0,88-1,08 unit, jauh 0,70 unit sebelum variasi scale. Jumlah instance dan triangle rumput tetap. Shader menyibakkan helai di dalam radius 1,35 unit dari karakter dan jejak pendek yang mengikuti geraknya: ujung terdorong ke luar, tinggi melentur, pangkal tetap menempel, lalu pulih halus setelah dilewati. Teleport lebih dari 12 unit mereset jejak agar tidak membuat jalur lintas map. Hanya satu vector trail yang diperbarui per frame; tidak ada simulasi CPU per helai.

QA: delapan test map, typecheck, lint, dan regresi browser lulus. Skenario baru menggunakan keyboard untuk berjalan >10 unit melalui padang rumput dan merekam gameplay di `output/verdant-plains/grass-contact/grass-walk.webm`; screenshot `grass-contact.png` memperlihatkan helai tersibak di sekitar kaki. Angin tetap diuji menggunakan tick gameplay sebenarnya.

Balanced pada 16 sampel 1080p/1440p: maksimum 251 draw call, 554,797 triangle termasuk shadow. Resource stabil pada tiga kali perjalanan. Benchmark headless bukan jaminan FPS hardware pemilik.

## Rumput dua lapisan, kepadatan dua kali

Jumlah rumpun digandakan pada setiap preset: Light 8.000 dekat / 4.000 jauh, Balanced 16.000 / 8.000, High 32.000 / 16.000. Luas patch dan mask jalan/air/camp tetap. Setiap rumpun dekat memiliki dua helai tinggi 0,88–1,08 unit dan dua helai bawah 0,32–0,44 unit sebelum variasi scale. Lapisan pendek ikut tertiup angin dan tersibak saat karakter lewat, dengan amplitudo sesuai tinggi helai dan pangkal tetap menempel.

Geometri dekat disederhanakan dari sembilan menjadi enam triangle per rumpun; kedua lapisan memakai draw call yang sama. Tidak ada tambahan tekstur, simulasi CPU per helai, atau perubahan terrain/navigasi. Kapasitas buffer mengikuti preset High supaya pergantian kualitas tetap aman. Pengujian browser memeriksa jumlah instance, kedua lapisan, animasi runtime, dan traversal karakter; hasil berada di `output/verdant-plains/dense-grass/`.

QA lulus: delapan test map, typecheck, lint, dan regresi browser lengkap termasuk resource stabil, teleport, save, serta retry. Pada 16 sampel Balanced 1080p/1440p: maksimum 251 draw call, 586.797 triangle termasuk shadow, dan frame p95 terburuk 18,6 ms. Ini pengukuran Chrome headless, bukan jaminan FPS perangkat pemilik. Rekaman: `grass-walk.webm`; screenshot: `grass-contact.png`.

## Rumput lebih tinggi dan tanpa LOD jarak

Sesuai permintaan berikutnya, tinggi kedua lapisan naik 35% (tinggi 1,188–1,458; pendek 0,432–0,594 unit sebelum variasi scale). Kepadatan per luas digandakan lagi dari versi dua lapisan. Satu geometri enam triangle dan satu material dipakai di semua jarak, dengan density seragam; tidak ada lagi mesh near/far atau pergantian model pada radius 18–23 unit. Wind dan respons karakter tetap aktif.

Batas tampil tetap radius 53 unit, dengan fade hanya di tepi luar 48–53 unit agar wrapping tidak muncul tiba-tiba. Ini batas jangkauan render, bukan pergantian detail. Rumput tidak dirender di seluruh map 1000×1000 sekaligus.

Mengisi area jauh dengan kepadatan penuh membutuhkan lebih banyak instance daripada sekadar menggandakan total lama: Balanced 16.000 / 48² × 2 × 108² = 162.000 rumpun dalam patch persegi; mask air/jalan/camp dan fade menyembunyikan bagian yang tidak sesuai. Light 81.000 dan High 324.000. Tidak ada tambahan aset atau draw call; CPU tetap hanya memperbarui uniform. Konsekuensinya, anggaran lama 600 ribu triangle tidak lagi sesuai: grass sendiri 972 ribu triangle pada Balanced (dulu 112 ribu). Batas regresi baru 1,46 juta mempertahankan sisa anggaran untuk scene selain grass; biaya aktual dilaporkan terpisah dan tidak diklaim lebih ringan.

Verifikasi: delapan test map, typecheck, lint, serta regresi browser lengkap lulus. Maksimum 16 sampel Balanced 1080p/1440p: 250 draw call dan 1.446.797 triangle termasuk shadow; frame p95 terburuk 18,2 ms pada Chrome headless. Hasil bukan jaminan FPS hardware pengguna. Resource stabil setelah tiga perjalanan map. Rekaman dan metrik: `output/verdant-plains/uniform-grass/grass-walk.webm`, `performance.json`, dan `regression.json`.

## Populasi hunting level 1–8

Permintaan terbaru mengaktifkan konten combat di map ini: 480 normal, 16 elite, satu Ancient Treant level 8. Batas rekomendasi dan loot equipment map menjadi level 1–8. Tidak ada penambahan NPC atau quest. Ketentuan eksplorasi kosong pada tahap awal sudah digantikan oleh permintaan ini; map lama tetap memakai populasi dan definisinya sendiri.

Normal: Small Slime (1), Meadow Slime (2), Wild Boar (3), Forest Piya (4), Stoneback Beetle (5), Rootling (6), Thorn Wolf (7). Elite: delapan Giant Rootling (7) dan delapan Alpha Boar (8). Model memakai geometri low-poly existing dengan ID spesies baru; formula statistik rank existing, loot starter, dan rune Akar Purba digunakan kembali tanpa mengubah monster map lama. Boss memiliki 1.580 HP dan EXP dasar 1.075; pengurangan EXP karena selisih level tetap memakai sistem existing.

Sebaran deterministik: 60 kelompok berisi lima normal (20 kelompok di lima hunting pocket, 40 di daratan luas) dan 180 individu tersebar. Monster dekat camp level 1–2; utara/pesisir lebih tinggi. Seluruh 497 home diuji terhubung ke camp. Spawn menghindari air, collider, jalan, jembatan, radius aman camp 44 unit, dan gerbang utara. Boss di clearing desain (620,300), world (120,-200), dengan jarak bebas normal/elite 55 unit. ID normal 0–479, elite 1000–1015, boss 2000; identitas spesies dan timer save terpisah dari map lama.

Respawn mengikuti rank existing: normal 25 detik, elite 60 detik, boss 120 detik. Mati lalu respawn sebagai pemain tidak menghidupkan kembali monster/boss yang timernya belum habis. Movement/knockback monster memakai swept navigation map dan radius tubuh; clamp field lama ±63 tidak lagi diterapkan pada hit di map 1000×1000 ini. Camp menolak masuknya monster. Minimap menampilkan monster sekitar pemain dan marker boss.

Untuk performa, body normal/elite hanya dirender dalam 110 unit (boss 160); AI monster sehat yang diam di home dan jauh diistirahatkan. Timer kematian, DOT/status aktif, dan monster yang sedang kembali ke home tetap diproses. Ini tidak mengubah rumput tanpa LOD yang diminta sebelumnya.

QA: sepuluh test khusus map lulus, termasuk konektivitas seluruh spawn, sebaran, loot semua kategori, dan isolasi respawn save. Gabungan empat suite: 31/32 lulus; satu kegagalan overflow loot lama (`field-expansion.test.ts`, pendingLoot 0 vs 1) tetap merupakan baseline yang sebelumnya sudah dikonfirmasi pada HEAD. Browser lengkap lulus: aggro, damage/kill, reward/progress, respawn, boss HUD/kill, timer boss saat player respawn, perjalanan ulang/resource stabil, retry loading, dan populasi map legacy. Hasil di `output/verdant-plains/population/`; screenshot boss tambahan di `population-combat/`.

Balanced 16 sampel 1080p/1440p: maksimum 271 draw call, 1.452.669 triangle termasuk shadow, frame p95 terburuk 20 ms. Pengukuran Chrome headless, bukan jaminan FPS perangkat pemilik. Tidak menambah unduhan model atau tekstur.

## Langit cerah dari bake Ultra Dynamic Sky

Sumber asli: `C:/ProgramData/Epic/EpicGamesLauncher/VaultCache/UltraDyn12790d13e818V8/data/Content/UltraDynamicSky`. Tiga tekstur pilihan disalin ke proyek Unreal staging di `output/verdant-plains/uds-bake/UnrealExport`; VaultCache tidak dibuka sebagai proyek dan tidak ditulis. Unreal Engine 5.4.4 `TextureExporterTGA` mengekspor `StaticClouds_A`, `Cloud_Wisps`, dan `clouds_diverse` dengan commandlet headless/NullRHI. SHA-256 sumber diverifikasi kembali saat bake. `clouds_diverse` hanya diperiksa sebagai alternatif; dua tekstur pertama menjadi input bake runtime.

`bake-verdant-sky.py` membake kanal lighting directional StaticClouds_A menjadi daylight shade, mempertahankan opacity UDS, dan melinearkan cloud wisps. Hasil: `sky-clouds.webp`, atlas data RGB lossless 2048×2048, 3.743.356 byte; R=shade, G=opacity, B=wisps. Provenance dan hash tersimpan di `sky-provenance.json`. Ini bake/rekombinasi tekstur UDS untuk Three.js, bukan menjalankan Blueprint atau merender ulang simulasi volumetrik Unreal. Hasil proyeksi dan lighting merupakan adaptasi untuk map ini.

Runtime baru `verdant-plains-sky.ts`: satu sphere 960 triangle dan satu draw call, bergerak bersama kamera, tidak ikut raycast atau depth/shadow pass. Shader memakai langit biru, horizon pucat, awan berotasi perlahan, matahari putih hangat dengan aureole tanpa bloom. Satu arah matahari dipakai bersama oleh disc dan directional light sehingga bayangan konsisten. Hemisphere light, fog, dan tint Fresnel air diselaraskan dengan daylight. Vignette hijau bagian atas dikurangi hanya pada gameplay Verdant Plains melalui `data-map-id`; map lain memakai konfigurasi sebelumnya. Langit ini fixed pagi cerah, belum merupakan siklus waktu atau weather system.

Lifecycle tetap milik adapter: atlas ikut loading all-settled/retry, geometry/material/texture didispose saat pindah map. Sky diposisikan setelah clamp kamera terhadap terrain. Tidak ada capture refleksi, raymarching, atau simulasi cloud volumetrik per frame.

Pipeline reproduksi: `prepare-verdant-sky.py` → UnrealEditor-Cmd dengan `export-verdant-sky.py` pada proyek staging → `bake-verdant-sky.py` (Pillow + numpy) → `audit-verdant-assets.mjs`. Paket map setelah perubahan: 26 file / 10.314.071 byte (9,84 MiB), tetap di bawah 20 MiB. Seluruh source Unreal, TGA, dan proyek staging berada di output yang diabaikan Git; hanya atlas/provenance runtime masuk public assets.

QA: typecheck, lint terkait, 10 test map, dan regresi browser lengkap lulus. Test langit memeriksa atlas linear, arah sun/light, centering kamera, warna langit dan gerakan awan melalui tick gameplay asli (6.476 pixel berubah dalam 1,25 detik pada capture 480×270). Combat, boss, teleport/reload, retry, dan tiga perjalanan map/resource stabil tetap lulus. Gambar: `output/verdant-plains/uds-daylight/sunny-meadow.png`; metrik dan hasil di folder yang sama. Maksimum 16 sampel Balanced 1080p/1440p: 276 draw call, 1.456.683 triangle termasuk shadow; frame p95 terburuk 19,8 ms. Benchmark Chrome headless, bukan jaminan FPS GPU pengguna.
