# Kingdom City Framework V1.1 — Mahkota Fajar

Status: **prototype development playable, untuk review owner; bukan map produksi dan tidak dipublish.**

## Ringkasan owner

Kota sekarang memiliki skala ibu kota benteng: landscape baru 1.600 × 1.600 m, perimeter kota sekitar 680 × 710 m, empat teras, kastel di bukit tertinggi, jaringan jalan melingkar, dua kawasan hunian, pasar, distrik kerajinan, dan lingkungan luar. Ini bukan modifikasi Kota Arunika, Padang Arunika, atau heightfield F4.

**Struktur dan perjalanan sudah teruji. Kualitas visual belum setara gambar konsep.** Kastel masih massing, rumah cukup repetitif, foliage ringan, dan detail transisi tanah/jalan masih kasar. Screenshot menunjukkan hasil aktual, bukan render konsep pengganti.

### 1. Ukuran, isi, dan hierarki

| Metrik | Hasil |
|---|---:|
| Landscape | 1.600 × 1.600 m |
| Batas kota bertembok | 680 × 710 m |
| Luas interior, estimasi grid | 387.072 m² |
| Rakitan bangunan | **504**: 503 rumah/cottage + 1 keep placeholder |
| Rumah di dalam kota / cottage luar | 495 / 8 |
| Segmen dinding luar | 375 |
| Tower | 31, termasuk 4 tower kastel |
| Gerbang utama | 1, bukaan nyata dengan dua tower pengapit |
| Sistem tangga | 6: 2 rangkaian ceremonial + 4 koneksi sekunder |
| Jaringan jalan bernama | Sekitar **6,10 km**, termasuk outskirts |
| Distrik | 8 |
| Pohon | 1.157 penempatan ringan |
| Props | 757 penempatan; tidak menghitung setiap bata/fondasi |

Panjang jalan menghapus segmen yang koordinat ujungnya identik, termasuk overlay tangga. Bukan pengukuran union semua permukaan paving; potongan gang tambahan tidak dihitung. Angka instance pada laporan performance adalah **bagian mesh**, bukan jumlah bangunan.

### 2. Tata distrik dan empat elevasi

| Tingkat | Elevasi nominal | Isi |
|---|---:|---|
| Lower city | 10 m | Gerbang Mahkota, Pasar Lonceng, Distrik Bara, Permukiman Selatan |
| Central city | 38 m | Alun-alun Mahkota, civic loop, kawasan komersial/hunian |
| Upper city | 82 m | Permukiman Teras, Teras Dewan, pendekatan formal |
| Castle plateau | 128 m | Benteng Fajar, courtyard, gerbang visual keep |

Bukit kastel berbeda sekitar **118 m** dari kota bawah. Punggungan/tebing teras dan plateau dibuat khusus; bukan platform kecil di terrain datar. Siluet keep mencapai sekitar 227 m elevasi dunia. Landmark kastel dikecualikan dari batas jarak culling distrik biasa sehingga tidak menghilang ketika dilihat dari gerbang.

### 3. Tangga, jalan, dan perimeter

Grand stair naik dari 38 ke 82 m, lebar sekitar22 m; tangga royal berikutnya naik ke128 m, lebar18 m. Keduanya dihubungkan landing dan avenue yang berbelok. Empat tangga sekunder: pasar, craft, hunian barat, dan ascent timur. Semuanya menggunakan permukaan jalan miring kontinu untuk kaki pemain, dengan tread visual dan modul tangga asli di tepi—bukan menghentakkan physics per anak tangga.

Avenue utama12 m, jalan sekunder6–8 m, paving gang3,5 m. Gerbang→plaza tidak berupa satu koridor lurus. Civic loop, market loop, jalur barat dan jalur timur memberi alternatif menuju teras atas. Perimeter memiliki14 titik belok mengikuti bentang bukit, dengan tower pada belokan, segmen panjang, gerbang, dan keep.

Di luar tembok ada8 kelompok kebun/farm dan cottage, jalan selatan, road loop timur, sungai samping kota, jembatan, pohon dan batu. River hanyalah environment; tidak ada mekanik renang atau progresi baru.

### 4. Asset dan material

Dipakai substansial: **STYLE_A_MEDIEVAL_VILLAGE_MODULAR**, melalui staging A2/A3 yang sudah tersedia. Actual modular walls, door walls, roof caps, stairs, stalls, wagon, barrel, crate, bench, lantern, banner, anvil, workbench dan fence digunakan ulang melalui instancing. Boulder dan pohon berasal dari staging library, bukan Flyff O3D.

Contoh penempatan modul: lebih15.000 modul wall-plaster,320 modul tangga,19 stall/cart,6 anvil,6 workbench,6 wagon,24 boulder. Rincian aktual di `manifest.json → assetUse`; tidak semua model yang dimuat harus dianggap ditempatkan.

Rumah besar menggunakan shell modular dan atap gable prototype. Keep menggunakan massa dinding/tower/crown asli buatan prototype; **tidak menyamarkan cottage yang diperbesar sebagai palace final**. Status: **CASTLE HERO ASSET — PLACEHOLDER / FUTURE REPLACEMENT**. Interior bangunan tidak dibuat.

Flyff surface yang tampil: **Upresia_Ground01** untuk grass dan **Obj_FLGR01** untuk courtyard/paving aksen. `default.dds` juga dikonversi sebagai reference, tetapi bukan lapisan utama yang terlihat. Tidak ada .lnd atau object-placement Flyff dibaca runtime ini. Tidak ada bangunan, pohon, prop, monster, nama map atau audio Flyff dibawa ke scene.

Stone architecture/roof tile/boulder-cliff dari staging LUMENFALL; tanah pertanian, dirt road dan air memakai material sederhana. Sampling batu di bangunan memakai world tiling agar tidak memanjang mengikuti ukuran keep. Provenance DDS→PNG disimpan. Izin owner untuk eksperimen lokal **tidak diubah menjadi klaim lisensi redistribusi**. Status sumber nature/material yang belum jelas dari A3 tetap perlu diselesaikan sebelum produksi/publikasi.

### 5. Hasil traversal dan collision

Actual character **Astra LUMENFALL**, tinggi runtime2,4 m, input/movement/animator Game yang sama. Tidak ada proxy pengganti karakter, perubahan kecepatan, atau teleport selama pengukuran. Driver mengarahkan yaw dan menahan W; posisi tidak di-set selama leg berjalan.

| Perjalanan | Waktu bergerak dibulatkan |
|---|---:|
| Main Gate → Central Plaza | **52,3 detik** |
| Plaza → pintu/pendekatan akhir Castle | **79,1 detik** |
| Total dua leg | **131,4 detik / 2 menit11 detik** |

Nilai presisi run terakhir ada di `evidence/populated-walk-result.json`. Jeda QA di plaza tidak dijumlahkan; tidak ada teleport antara dua leg. Kecepatan input W standar runtime sekitar7,564 unit/detik, tidak diperlambat untuk mengejar ukuran.

Sebelum detail population, uji structure-only telah menghasilkan52,34s dan76,04s menuju courtyard. Leg final diperpanjang hingga pendekatan pintu keep. Jalur plaza→craft juga diuji melalui civic loop dan craft stair; bukti terpisah di `craft-walk-result.json`, bukan rute terpendek.

**15/15 pemeriksaan browser input/collision**: enam sistem tangga, exterior building, wall, trunk, parapet, gate passage, bridge deck, gang, identitas karakter, dan tombol W nyata. Tangga upper-city→castle merupakan bagian dari timed traversal. Tidak semua kemungkinan jalur diagonal di seluruh2,56 km² diklaim telah ditelusuri.

### 6. Apakah sudah terasa ibu kota?

**Skala, jumlah blok, perimeter dan hierarki bukit: ya, sudah merupakan framework kota besar, bukan arena10 rumah.** Gate→castle bukan perjalanan beberapa detik. Castle terlihat sebagai tujuan tinggi dari dalam gerbang dan panorama kota.

**Art-direction acceptance tetap memerlukan review owner.** Prototype belum mencapai kekayaan komposisi/material gambar referensi. Pola rumah masih cukup teratur; kastel terlalu sederhana untuk hero final; plaza dan beberapa sabuk hijau di kaki tebing masih membutuhkan authored set-dressing. Foto overview tidak boleh dianggap persetujuan visual final otomatis.

Sampling ruang pada grid4 m memperkirakan **29,7%** interior belum terpakai setelah footprint/yard, jalan, civic precinct, market/craft yard, dan lereng curam dipisahkan. Ini hanya proxy geometri yang dekat batas30%, **bukan bukti matematis bahwa persepsi kosong sudah sempurna**. Area yang paling perlu ditinjau: bahu jalan kota bawah, pita di kaki terrace, taman formal upper-city, dan edge plaza. Ukuran kota tidak dikecilkan.

### 7. Performance

Headed **Chrome151.0.7922.108, Windows,1600×950**, mesin lokal ini. Representative capture berada sekitar60FPS; saat beberapa jendela QA berjalan bersamaan ada sampel load sekitar59FPS. Vsync membatasi hasil; bukan janji minimum hardware.

| View | Draw calls, kisaran | Rendered triangles, kisaran |
|---|---:|---:|
| Top-down lengkap | ~1.230 | ~4,96 juta |
| Overview kota | 1.127 | 4,72 juta |
| Gerbang / dalam gerbang | ~550–580 | ~2,1–2,3 juta |
| Jalan pemain | ~440 | ~2,3 juta |
| Tangga agung | ~210 | ~0,96 juta |
| Panorama jauh | 1.087 | 4,23 juta |

Counter exact per view ada di `evidence/views.json`. **23 material scene unik** (tidak termasuk material karakter runtime), **48.323 instance mesh-part**,144 occupied render cells128 m,100 terrain chunks160 m dengan grid4 m. Draw calls masih tinggi; usable pada mesin uji tidak berarti production optimized.

Pohon memakai crossed impostor dari render asset pohon A3 untuk menekan beban. Ini sengaja kompromi prototype: bentuk terlihat sederhana/gelap dari beberapa sudut, belum pengganti foliage LOD artist-authored. Shadow bangunan tidak diaktifkan. Semua subsetasset dimuat sekali; chunk visibility bukan asynchronous asset streaming. Collision memakai lookup cell32 m, bukan scan seluruh kota setiap langkah. Inventory HUD di-cache.

### 8. Prioritas V1.2 — rekomendasi saja

1. Hero keep/gatehouse dan facade kota atas yang lebih kuat, tetap mempertahankan bukit dan waktu perjalanan.
2. Variasi orientasi/komposisi blok, bukan sekadar menambah jumlah rumah; urban paving/yard yang lebih natural.
3. Foliage LOD, lighting, cliff/road transition, dan trim-safe roof materials.
4. Plaza edge dan craft yard menjadi authored composition yang lebih hidup tanpa gameplay terlebih dahulu.
5. Camera collision terhadap exterior/roof: collision pemain sudah ada, tetapi orbit manual masih dapat menembus visual bangunan dari sudut tertentu.
6. Profiling GPU/VRAM/draw-call budget lintas perangkat dan streaming sebelum produksi.

**Tidak mengerjakan V1.2 otomatis. Tidak menambah monster, quest, shop, trainer, drop, EXP atau save progression. Tidak publish.**

## Bukti gambar dan diagram

Viewer lokal: http://127.0.0.1:3007/tests/browser/kingdom-capital.html

Galeri: http://127.0.0.1:3007/dev-prototypes/kingdom-capital-v11/review.html

Gunakan tombol lokasi untuk inspeksi; **Kembali berjalan** untuk WASD dan kamera runtime. Tombol lokasi melakukan teleport inspeksi, bukan bagian pengukuran perjalanan.

| Bukti | File |
|---|---|
|01 Top-down map|[01-top.png](../dev-prototypes/kingdom-capital-v11/evidence/01-top.png)|
|02 Overview45°|[02-overview.png](../dev-prototypes/kingdom-capital-v11/evidence/02-overview.png)|
|03 Exterior gate|[03-gate.png](../dev-prototypes/kingdom-capital-v11/evidence/03-gate.png)|
|04 Inside gate / castle sightline|[04-inside.png](../dev-prototypes/kingdom-capital-v11/evidence/04-inside.png)|
|05 Plaza|[05-plaza.png](../dev-prototypes/kingdom-capital-v11/evidence/05-plaza.png)|
|06 Craft / blacksmith yard|[06-craft.png](../dev-prototypes/kingdom-capital-v11/evidence/06-craft.png)|
|07 Lower residential|[07-lower.png](../dev-prototypes/kingdom-capital-v11/evidence/07-lower.png)|
|08 Upper residential|[08-upperhome.png](../dev-prototypes/kingdom-capital-v11/evidence/08-upperhome.png)|
|09 Grand stair from below|[09-stairs.png](../dev-prototypes/kingdom-capital-v11/evidence/09-stairs.png)|
|10 Upper terrace → castle|[10-terrace.png](../dev-prototypes/kingdom-capital-v11/evidence/10-terrace.png)|
|11 Castle → lower city|[11-castle.png](../dev-prototypes/kingdom-capital-v11/evidence/11-castle.png)|
|12 Actual player, main street|[12-street.png](../dev-prototypes/kingdom-capital-v11/evidence/12-street.png)|
|13 Actual player, alley|[13-alley.png](../dev-prototypes/kingdom-capital-v11/evidence/13-alley.png)|
|14 Wall + landscape|[14-wall.png](../dev-prototypes/kingdom-capital-v11/evidence/14-wall.png)|
|15 Distant silhouette|[15-silhouette.png](../dev-prototypes/kingdom-capital-v11/evidence/15-silhouette.png)|
|District diagram|[district-diagram.svg](../dev-prototypes/kingdom-capital-v11/district-diagram.svg)|

Screenshot game berasal dari browser headed. PNG diagram adalah render SVG layout aktual; bukan bukti gameplay.

## Catatan teknis dan verifikasi

- Dev-only Vite entry; tidak terdaftar sebagai production region atau normal map graph. Runtime menolak non-DEV/non-localhost.
- Layout/terrain authored di `tests/browser/kingdom-capital-layout.ts`; tidak memuat F4 heightfield. `height.f32le` + `heightfield.json` adalah export netral401×401 dari fungsi baru, bukan source collision yang dibaca produksi.
- Scene/material/instancing/OBB di `kingdom-capital-scene.ts`; Game adapter/storage-memori/camera/test-driver di `kingdom-capital.ts`. Input asli Game tetap digunakan.
- Stage structure-only tersedia melalui `?structure=1`. Decoration baru dibangun setelah midbuild traversal lolos.
- Perbaikan nyata selama verifikasi: endpoint plaza tidak lagi di monument collider; landing final stair tidak memiliki height seam; orientasi foundation tangga dibetulkan; courtyard corner diisi hill geometry; foundation bangunan diperpanjang ke tanah; material keep tidak stretched; kastel tidak hilang karena distance culling; preset gang tidak lagi berada di dinding; craft berada pada tier bawah.
- Pagehide: Game.dispose, penghentian HUD/steering, pelepasan scene/instance/geometry/material/texture. Storage diganti memori sebelum Game/rules diimport; save/region transition dinonaktifkan untuk dev character.
- Existing **lib/game:502 passed /0 failed**. Fokus terrain baru:**3 passed /0 failed**. Browser input/collision:**15 passed /0 failed**. Screenshot terpisah dari test assertions.
- Console/page errors0, warning0, HTTP asset failure0 pada sesi game final. Percobaan screenshot standalone SVG pernah timeout; diagram berhasil dirender melalui wrapper galeri. Tidak disamarkan sebagai crash game.
- TypeScript primary comparison: **9 existing diagnostics sebelum/sesudah;0 baru**, termasuk5 existing di lib/game. Whole-workspace tsc tetap nonzero karena old diagnostics dan archived output/template. Bukan clean typecheck.
- Build entry Vite isolated **berhasil**. DEV guard menghasilkan stub penolakan untuk mode produksi; public directory tidak disalin. **Full production game build tidak dijalankan/dianggap lulus dari build kecil ini.**

### File keluaran / perubahan fase ini

- `tests/browser/kingdom-capital.html`, `.css`, `.ts`, `.vite.config.ts`.
- `tests/browser/kingdom-capital-layout.ts`, `kingdom-capital-layout.test.ts`, `kingdom-capital-scene.ts`, `kingdom-capital-verify.mjs`.
- `scripts/prepare-capital-textures.py`, `document-kingdom-capital.mjs`, `verify-capital-types.mjs`.
- `dev-prototypes/kingdom-capital-v11/`: manifest, neutral heightfield, texture derivatives/provenance, diagram, review gallery, build stub, dan evidence.
- Laporan ini.

File library asli tidak dihapus, dipindah atau dioverwrite. Production map/code tidak diedit oleh pekerjaan city ini; perubahan lain yang sudah ada di working tree tetap dipertahankan. Tidak ada import gameplay Flyff atau publikasi.

**Handoff:** foundation playable siap dinilai owner. Persetujuan visual sebagai ibu kota final tetap terbuka; jangan menyamakan sukses traversal dengan kualitas art final. STOP setelah V1.1.
