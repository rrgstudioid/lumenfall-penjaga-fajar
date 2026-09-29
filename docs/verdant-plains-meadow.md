# Revisi Verdant Plains: 30 oak dan rumput horizon

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
