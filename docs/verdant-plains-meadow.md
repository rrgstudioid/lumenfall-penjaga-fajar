# Revisi Verdant Plains: 30 oak dan rumput horizon

## Optimasi culling rumput tanpa penipisan (1 Oktober 2026)

Implementasi lokal; tidak publish. Geometri tetap empat helai/enam triangle per
rumpun pada Normal/High/Ultra, empat triangle pada Low. Posisi, seed, orientasi,
variasi ukuran/warna, kepadatan, jarak/fade, angin dan respons injakan dipertahankan.
Tidak ada aset sumber atau gameplay yang diubah.

- Setiap petak 62,5 m dipartisi menjadi empat batch 31,25 m. Partisi menyalin nilai
  instance asli tanpa mengacak ulang dan mempertahankan prefix masing-masing
  kualitas. Origin model tetap origin petak lama agar fase shader tidak bergeser.
- Batch memakai empat buffer bersama di seluruh map; total atribut instance tetap
  **1.757.824 byte (1,68 MiB)**. Tidak menambah tekstur atau unduhan aset. Jumlah
  objek batch aktif naik dari 223 menjadi 872; ini menambah metadata CPU/VAO.
- Batch yang sepenuhnya terlarang oleh mask dihilangkan saat loading. Border satu
  texel tetap disertakan untuk filtering. Frustum memakai box dengan margin 3 m
  untuk angin/injakan; radius memakai jarak ke persegi akar, bukan lingkaran
  pembungkus. Culling tidak bergantung pada kepadatan/LOD jarak.
- Shader melewati sampling terrain dan animasi untuk akar yang sudah ditolak
  oleh jarak, batas map, atau mask. Persamaan helai yang terlihat tidak berubah.
- Diagnostik triangle menjumlahkan instance batch yang benar-benar diajukan.

Perbandingan browser sebelum/sesudah pada kamera dan waktu animasi tetap, camp:

| Kualitas | Triangle rumput sebelum | Sesudah | Pengurangan |
|---|---:|---:|---:|
| Low | 384.524 | 219.872 | 42,8% |
| Normal | 3.460.716 | 2.553.696 | 26,2% |
| High | 6.921.432 | 5.107.890 | 26,2% |
| Ultra | 13.842.864 | 10.216.548 | 26,2% |

Di sudut meadow pengurangan 25,0–43,8%; sudut river 65,6–79,2%. Ini pengurangan
geometri yang dikirim, bukan persentase kenaikan FPS. Tradeoff: draw call rumput
di camp naik 7 ke 16 (Low) dan 21 ke 62 (preset lain). Pengujian GPU terisolasi
memakai EXT_disjoint_timer_query_webgl2, 16 sampel per sudut/kualitas; median GPU
rumput camp Low 1,49 ke 0,69 ms, High 7,76 ke 5,31 ms. Sampel Chrome headless
terbatas ini bukan jaminan FPS perangkat pengguna, dan hanya merender rumput.

Verifikasi:

- 22 unit test vegetasi/layout/navigation/quality lulus, termasuk kesetaraan
  seluruh instance asli pada setiap preset dan kasus batas culling.
- 12 pasangan gambar rumput pada kamera/waktu identik: 0–61 piksel RGB berbeda
  per gambar (maksimum sekitar 0,003% pada 1080p). Tidak identik bit-per-bit;
  geometri/animasi tetap sama, dengan perbedaan kecil rasterisasi setelah batching
  dan perubahan jalur shader.
- 20 kombinasi empat kualitas, batas petak, sungai, kamera follow/ortografis:
  batch yang ditolak dirender terpisah dan menghasilkan **nol piksel terlihat**.
  Animasi lewat update map nyata tetap aktif; angka triangle diagnostik cocok
  dengan renderer. Resource stabil setelah siklus kualitas dan tiga roundtrip
  East Gate–Verdant Plains; populasi tetap 497.
- 57 pemeriksaan integrasi Low 1080p/1440p lulus, termasuk UI diagnostik, reload
  preferensi dan sepuluh pergantian kualitas. Frame p95 seluruh game pada rute
  ini 18,2–22,2 ms; belum membuktikan 60 FPS stabil. Tidak ada perbandingan FPS
  seluruh game sebelum/sesudah yang dikontrol dalam pengujian ini.
- Typecheck penuh, lint file terkait, dan `vinext build` lulus.

File implementasi: `lib/game/verdant-grass-tiles.ts`,
`lib/game/verdant-plains-map.ts`, `lib/game/verdant-plains-visuals.ts`.
Regresi: `lib/game/verdant-grass-lod.test.ts`, `scripts/test-oak-browser.mjs`,
`scripts/test-verdant-grass-browser.mjs`. Jalankan tes browser terakhir dengan
`node --experimental-transform-types scripts/test-verdant-grass-browser.mjs`
saat server lokal aktif; `PLAYWRIGHT_MODULE` dapat menunjuk modul Playwright
di mesin lain. Artefak perbandingan: `output/grass-opt/baseline.json`,
`optimized.json`, `pixel-diff.json`, PNG sebelum/sesudah, `acceptance/report.json`,
`integration/profile-checks.json`, dan log build/typecheck.

29 September 2026. Implementasi lokal; tanpa commit/push/publish.

## Oak

- Tepat **30** penempatan statis, tiga variasi masing-masing **10** pohon.
- Ukuran diperbesar **35% secara seragam**: tinggi sekitar **24,4–33,5 m**. Aset bake dipakai ulang, tanpa menambah ukuran unduhan.
- Distribusi delapan zona: **4 / 5 / 4 / 4 / 3 / 3 / 4 / 3**. Enam landmark lama yang masih lolos clearance dipertahankan; dua lainnya tidak dipilih karena tajuk yang membesar.
- Semua kandidat diperiksa ulang terhadap tajuk tetangga, jalan, camp, gerbang, air, arena, pocket hunting, home monster, dan dekorasi. Radius collision turut membesar.
- Renderer memakai jumlah manifest, tidak lagi mengasumsikan 100 instance.
- 497 spawn, 244 batu, dan 265 semak tetap identik dengan baseline.

## Rumput tebal merata hingga 250 m, tanpa LOD jarak

30 September 2026. Revisi ini menggantikan pendekatan sebelumnya yang membagi jumlah terbatas ke seluruh map dan membuat rumput dekat menjadi jarang. Target visual kini kepadatan dekat lama yang sama di seluruh area rumput, sampai 250 m.

| Preset | Kepadatan sebelum mask terrain | Rumpun per petak 62,5 ? 62,5 m |
| --- | ---: | ---: |
| Light | 7,03125/m? | 27.466 |
| Balanced | 14,0625/m? | 54.932 |
| High | 28,125/m? | 109.864 |

- Profil dekat/sedang/jauh dihapus dari konfigurasi dan shader. Hanya satu kepadatan untuk setiap preset, tetap sama di semua jarak.
- Empat helai/enam triangle per rumpun; tinggi, warna, angin dan respons injakan tetap seperti rumput dekat lama.
- Dunia dibagi menjadi petak tetap 62,5 m, tanpa mengikuti karakter. Petak adalah unit frustum culling, bukan LOD. Petak yang terlihat selalu memakai jumlah dan detail penuh.
- Data posisi dasar instanced dibagi bersama antarpetak, sekitar 1,68 MiB untuk kapasitas High. Fase/orientasi bervariasi menurut petak. Bounds mencakup tinggi terrain, helai dan gerak angin.
- Lewati petak di luar kamera/radius 250 m dan petak sepenuhnya terlarang oleh mask terrain. Jalan, air, camp dan lereng terlarang tetap dibersihkan oleh mask.
- Tidak ada transisi pada 39/175 m atau penyusutan helai berdasarkan jarak. Hanya fade coverage terminal 200-250 m. Kamera/fog tetap pada profil 1.400 m / 290?1.000 m.

Jumlah kandidat seluruh map memang lebih tinggi untuk mempertahankan kepadatan per meter; tidak lagi dibatasi 300.000 yang menyebabkan penipisan sebelumnya. Metrics membedakan kandidat seluruh map (`grass`) dari petak/triangle yang benar-benar diajukan ke renderer (`grassField.visibleTiles`, `submittedTriangles`). Tidak ada klaim biaya GPU sama dengan revisi rumput jarang.

## Verifikasi

- 18 unit test layout/navigation/population/grass, termasuk kepadatan yang sama persis dengan patch dekat lama di semua preset.
- Browser save terisolasi: density, buffer sharing, geometry, culling, preset 1080p/1440p, kamera, reload, perpindahan map dan retry.
- Screenshot/laporan: `output/oak/dense-930/`; log `output/oak/dense-930*.log`.
- Pengukuran Chrome headless dibedakan dari GPU perangkat pengguna. Hamparan penuh tetap lebih mahal daripada patch dekat saja.

Regenerasi layout oak: `node scripts/author-oak-layout.mjs`, lalu `node scripts/install-oak-data.mjs --layout-only`. Revisi ini tidak mengubah oak, monster, collision atau save.

Baseline 930 m sebelum pengurangan jarak: 46 pemeriksaan browser, 18 unit test, typecheck, lint terkait dan build lulus. Worst-route Chrome headless p95: Light 21,4 ms, Balanced 81,7 ms, High 34,3 ms. Balanced diuji pada lebih banyak titik daripada Light/High; bukan perbandingan preset pada satu rute identik. Sudut terbuka terberat Balanced mengajukan sekitar 45 juta triangle seluruh scene. Kepadatan penuh 930 m masih berbiaya GPU tinggi, meskipun buffer dibagi bersama dan frustum culling aktif; tidak dinyatakan memenuhi target 60 FPS.

Revisi jarak: batas rumput 400 m, fade coverage 350?400 m. Kepadatan, model, angin, injakan, kamera dan jarak pandang dunia tidak diubah. Laporan revisi: `output/oak/dense-400/`.

Perbandingan titik terbuka yang sama pada Balanced 1440p: triangle seluruh scene turun dari 45.018.381 menjadi 16.017.019 (sekitar 64%). Frame time p95 headless berubah dari 81,7 ms ke 20,0 ms pada sampel ini; bukan jaminan FPS perangkat pengguna.

Revisi terbaru: batas rumput **250 m**, fade coverage **200-250 m**. Kepadatan, bentuk helai, angin dan injakan tetap sama. Hasil uji profil runtime: `output/oak/dense-250/`.

Verifikasi integrasi Git (30 September 2026): perubahan direbase ke `origin/main` d96ee11, mempertahankan Thief V3 dan Earth Splitter. 18 tes vegetasi/navigation lulus, 29 pemeriksaan browser profil lulus, build berhasil. Tujuh kegagalan `rules.test.ts` dan delapan error TS2339 pada `weapon-style.ts` direproduksi identik pada checkout terisolasi d96ee11; ini baseline main yang tidak diperbaiki dalam perubahan vegetasi. Log lokal: `output/oak/pre-push-*` dan `main-baseline-*`.

Perbaikan lanjutan di `dev-gadang` (30 September 2026): type guard dagger kini menyempit ke subtype dagger sehingga senjata lain tidak menjadi `never`; reward dagger Caroq/Anom tetap diberikan setelah migrasi metadata; helper karakter development mengikuti prasyarat promosi tanpa equipment. Fixture reset, promosi, inventory penuh, rune opt-in, spesialisasi legacy dan akses forge diperbarui sesuai kontrak runtime. Sebanyak 65 tes rules/dagger/forge/reset/off-hand/vegetasi/navigation lulus, typecheck bersih, lint file terkait dan build lulus. Log: `output/oak/rules-fix-*`. Ini bukan hasil full suite atau pengukuran browser/GPU baru. Sebelum perbaikan, `dev-gadang` dan `main` identik pada f1364b0; tidak diperlukan merge, dan perubahan lanjutan hanya dikirim ke `dev-gadang`.

## Audit PC kantor dan profil Low (30 September 2026)

Target: GPU terintegrasi, RAM 8 GB, layar 1080p, sasaran 60 FPS (16,7 ms/frame). Target ini belum terbukti pada perangkat tersebut. Benchmark menggunakan Chrome headless 154; renderer melaporkan ANGLE / NVIDIA RTX 3060 Laptop, 16 logical CPU. Ini bukan simulasi GPU kantor, dan waktu CPU submission bukan waktu GPU.

Temuan runtime:
- Rumput mendominasi geometri: di camp preset Light lama mengajukan 3.909.567 triangle/frame, termasuk 3.460.716 triangle rumput. Balanced lama 7.374.807, High lama 14.297.759. Buffer instancing bersama menghemat memori, tetapi vertex shader tetap berjalan untuk setiap helai yang diajukan, termasuk kandidat yang kemudian disembunyikan mask.
- Model Cena sekarang 374.735 triangle, file 52.114.572 byte (49,70 MiB). Female tercatat 9.389 triangle. Model pria menjadi prioritas LOD/bake berikutnya; optimasi profil ini tidak menyederhanakan rig atau mengubah aset asli. File di direktori public yang tidak direferensikan runtime tidak otomatis menambah biaya per frame.
- 497 monster telah memakai early-out untuk aktor sehat yang diam jauh dari pemain. Status, poison, combat, respawn dan jumlah populasi dipertahankan. Oak sudah di-instance, memakai budget/LOD; tidak perlu mengurangi 30 penempatan.
- Penghitungan stats gerak/stamina di tick kini memakai hasil penghitungan mana pada tick yang sama. Traversal shadow karakter berjalan saat load serta pemeriksaan tambahan 1 Hz untuk equipment async, bukan setiap frame. Culling memakai matriks kamera terkini.

Empat pilihan Graphics menggunakan ID storage lama agar preferensi tersimpan tetap memiliki kualitas yang sama:

| Pilihan | ID internal | Rumput / m² | Jarak / awal fade | Triangle / rumpun | DPR maksimum | Shadow |
|---|---|---:|---|---:|---:|---|
| Low | office | 3,516 | 100 / 55 m | 4 | 1, dibatasi 921.600 pixel | Off |
| Normal | light | 7,031 | 250 / 200 m | 6 | 1 | Off |
| High | balanced | 14,063 | 250 / 200 m | 6 | 1,25 | 1024 |
| Ultra | high | 28,125 | 250 / 200 m | 6 | 1,5 | 2048 |

Low adalah default browser baru/storage invalid. Preferensi valid existing tidak ditimpa. Batas pixel hanya berlaku pada dunia 3D; HUD tetap resolusi native. Low memakai empat helai dengan tinggi, angin dan respons injakan yang sama; detail bentuk disederhanakan dan fade terminal diperlebar. Tidak ada penipisan dalam beberapa cincin jarak. Shader terrain padang rumput tetap terlihat di luar jangkauan helai. Budget oak Low 40 ribu triangle, tanpa proxy shadow; Normal/High/Ultra mempertahankan budget lama.

Menu Graphics juga menyediakan Diagnostik performa: sampel 240 frame terakhir, median FPS, p50/p95/p99/max interval frame, waktu CPU submission, GPU yang dilaporkan browser, drawing buffer, draw calls, triangle dan jumlah resource. Pengambilan laporan manual, tanpa jaringan/telemetry, dan teks bisa dipilih/disalin. Waktu pause/loading/hidden tidak dihitung, tetapi stall saat gameplay tetap dicatat. Nama GPU bukan jaminan performa.

Hasil awal rute camp, lima hunting pocket, bridge dan oak tenggara pada 1080p/1440p: Low 827.317–1.035.441 triangle/frame; pada camp 833.039 (sekitar 88,7% di bawah Balanced lama). Median interval sekitar 16,7 ms; p95 17,8–20,6 ms. Penghematan geometri terukur, tetapi sasaran 60 FPS stabil belum terpenuhi berdasarkan p95, apalagi belum diuji di GPU terintegrasi. Jangan menyamakan penurunan triangle dengan kenaikan FPS sebesar persentase yang sama.

Validasi: 21 unit test layout/navigation/quality/sampler lulus; 57 pemeriksaan profil Low/browser lulus, termasuk menu diagnostik, reload preferensi dan sepuluh perubahan kualitas tanpa kenaikan jumlah geometry/texture. Build dan lint file terkait lulus. Typecheck penuh menemukan tiga error tipe test existing (character-ui.test.ts:44/113 dan rules.test.ts:420); reproduksi compiler dengan source HEAD fee7b8b menghasilkan tiga error yang sama. Tidak ada error tipe baru dari optimasi ini.

Artefak lokal: output/office/baseline, optimized, final; office-tests.log, office-types.log, office-types-baseline.log, office-lint.log dan office-build.log. Screenshot gameplay Low ditinjau. Benchmark bukan pengujian worst-case seluruh skill/class atau FPS perangkat pengguna. Pekerjaan berikutnya yang masih perlu validasi: turunan LOD Cena/tekstur karakter, profil combat/VFX berat, dan pengukuran pada GPU kantor sungguhan. Belum commit, push, atau deploy dalam pekerjaan ini.

Pemeriksaan akhir: 46 acceptance browser tambahan lulus, mencakup kamera orbit/ortografis, reload di batang, sepuluh roundtrip East Gate, Averion, kegagalan aset terkontrol dan retry. Tidak ada error tak terduga atau kenaikan jumlah geometry/texture pada roundtrip. UI akhir diverifikasi menampilkan tepat Low/Normal/High/Ultra; keempat pilihan dapat dipilih dan persisted. Artefak: output/office/lifecycle/acceptance.json, output/office/graphics-final.png, output/office-graphics.log.

UI preset kini berupa empat kartu Low/Normal/High/Ultra di bagian atas Graphics, dengan ikon, deskripsi, spesifikasi singkat, radio keyboard-accessible dan penanda aktif emas. Dialog Graphics lebih lebar, grid dua kolom di desktop dan satu kolom pada layar sempit. Browser memverifikasi pemilihan semua preset, persistence, navigasi keyboard dan lebar 390 px tanpa overflow horizontal. Screenshot: output/office/graphics-cards-desktop.png dan graphics-cards-mobile.png. Lint komponen lulus; typecheck tetap hanya tiga error test baseline yang dicatat di atas.
