# Sunken Ruins — revisi ruang jelajah, sand boundary, dan aset PBR

Catatan: laporan ini merekam revisi environment sebelumnya. Populasi monster dan batas luar terbaru dijelaskan pada [revisi hunting](sunken-ruins-hunting.md).

Revisi lokal untuk `sunken-ruins-underwater-v1`. Field lama, progression, rumus combat, dan `adventurer-v3.ts` tidak diubah pada revisi ini. Tidak ada publikasi.

## Layout dan collision

- Bidang desain/navigasi tetap 1000 × 1000 world units. Anchor lima zona dan tiga portal tetap mengikuti blueprint.
- Hamparan jalur utama 72–80 unit dan alternatif 48 unit. Reef islands boleh menempati sebagian hamparan itu; lajur tembus minimum 36 unit pada jalur utama dan 24 unit pada alternatif dipertahankan. Pendekatan portal menyempit sesuai arch.
- Shelves pasir membuka bagian dalam loop timur, barat daya, dan selatan. Sampling grid 5 unit: footprint seabed lama 25,62%, baru 54,6275%; navigasi bebas obstacle baru 52,32%. Ini estimasi luas dari sampling, bukan hasil pengukuran meter persegi.
- Signed field yang sama mengatur terrain, navigasi, dan minimap. Batas terlarang berupa lereng pasir kontinu, dengan apron visual di luar bidang navigasi. Tidak ada void terbuka di tepi playable area.
- 2.269 placement reef/flora, termasuk 1.697 proxy solid. Semua koloni solid tetap dirender pada setiap preset; hanya flora lunak dikurangi densitasnya. Proxy masuk grid spasial agar query collision tidak memindai semua karang setiap langkah.
- Collision terhubung ke movement player, displacement skill, dan navigasi fixture monster melalui kontrak Sunken yang sudah ada. Routing disampling lebih rapat untuk koloni kecil. Kamera memperhitungkan reef solid dan ketinggian sand bank.

## Aset dan material

Higgsfield menyediakan referensi pilar dan albedo limestone baru. Geometri pendukung masonry, arch, slab, dan broken column dibuat pada file Blender kerja baru; sumber sebelumnya tetap read-only. Model hero pilar dan reef dibuat melalui dua task Tripo yang disetujui pemilik. Hasil Tripo asli disimpan terpisah dari staging runtime.

Runtime mempertahankan tekstur PBR dari glTF. Caustics dikomposisikan di shader tanpa mengganti UV, normal map, atau roughness map. LOD dan staging tekstur 2K dilakukan lokal di Blender; tidak ada konversi API berbayar tambahan. Satu artefak lurus berbentuk jarum pada reef dibuang hanya pada salinan staging. Albedo/ORM dikodekan JPEG kualitas 94 dan normal map tetap lossless.

Kedua task berhasil: pilar `0eb40cc4-1dc5-4cac-b184-5af7cd45b512` dan reef `ca2a927e-d68d-44ee-a635-5c6d5402504a`, masing-masing 50 kredit. Saldo setelah keduanya selesai: **4.900 kredit**, tanpa kredit dibekukan. Tidak ada generasi tambahan. Dua referensi Higgsfield pada revisi ini memakai total 0,5 kredit Higgsfield.

Kit PBR final **13.870.832 byte** dengan enam tekstur 2048 × 2048, dua material, dan tiga LOD per model. Pilar: 15.999 / 5.119 / 1.598 triangle; reef: 14.000 / 4.480 / 1.400 triangle. Kit masonry pendukung **4.524.052 byte**; duplikat pilar dan reef authored tidak diekspor ke runtime. Albedo limestone pendukung **2.895.267 byte**. Ukuran ini ukuran berkas, bukan pemakaian VRAM.

Lokasi:

- Source references dan raw Tripo: `work/sunken-ruins/revision3/`.
- File Blender baru: `Sunken_Ruins_Reef_and_Ruins.blend` dan `Sunken_Ruins_Tripo_Staging.blend` di direktori kerja tersebut.
- Runtime development: `dev-assets/sunken-ruins-underwater-v1/revision3/`.
- Provenance, task ID, biaya aktual, hash, ukuran mesh, dan modifikasi: `manifest.json` serta `tripo-manifest.json` dalam direktori runtime.
- Export transform dan proxy aktual: `revision3/placements.json`, melalui `scripts/export-sunken-placements.mjs`.

Rebuild lokal dari hasil Tripo yang sudah tersimpan tidak memanggil API:

1. Jalankan `scripts/stage-sunken-tripo.py` memakai Blender `--background --factory-startup`, dengan argumen setelah `--`: GLB pilar dan GLB reef pada folder `tripo-out/`.
2. Jalankan `python scripts/optimize-sunken-tripo.py` (memerlukan Pillow) untuk pengodean tekstur runtime dan pembaruan hash manifest.
3. Jalankan `scripts/build-sunken-revision3.py` memakai Blender `--background --factory-startup`, dengan `-- --pbr-runtime`, untuk kit pendukung tanpa duplikat aset hero.
4. Jalankan fixture browser dan `node scripts/export-sunken-placements.mjs` untuk export placement aktual.

Folder `.tripo/`, `work/`, `output/`, dan `dev-assets/` tetap lokal dan diabaikan Git. File Blender kota asli tidak dibuka atau dimodifikasi. Server Blender MCP interaktif belum tersambung; staging dikerjakan melalui Blender 5.2.2 LTS secara background pada file kerja baru.

Kepemilikan output dan ketentuan pemakaian mengikuti provider. Aset ini tidak dinyatakan CC0. Sumber ketentuan dicatat pada manifest; referensi visual dibuat khusus untuk pekerjaan ini, bukan rekonstruksi aset game pihak lain.

## Validasi

Validasi ulang setelah pemasangan PBR Tripo:

- **100/100 tes Node** lulus, termasuk layout/collision, animasi dan attachment, save/rules, kamera, targeting, dan input.
- Browser Chrome: UV, albedo, normal, dan roughness map kedua aset aktif; tekstur maksimum 2K; solid reef tidak menghilang ketika preset diturunkan. Normal preview tetap nol monster.
- **223 perbandingan combat cocok**, dengan 116 aksi diterima dan 107 penolakan yang sama pada fixture darat. Dua monster normal, satu elite, dan satu boss fixture menyelesaikan chase, attack, return, death, dan respawn; tidak menghasilkan reward.
- Level 31 terkunci dan 32 terbuka; tiga portal menuju spawn yang benar. Mode darat dan clip native pulih setelah keluar. Reload, respawn, Retry, 11 pose pada kedua gender, attachment, dan 32 posisi kamera lolos.
- Tiga kunjungan berulang stabil pada **84 geometry, 17 texture, 3 label, 0 monster** dalam skenario lifecycle; ini resource count renderer pada sudut pengujian, bukan jumlah seluruh geometry kit atau byte VRAM.
- Typecheck, lint, build, dan `git diff --check` lulus. Pencarian output production tidak menemukan loader `__sunken-dev`, modul map Sunken, atau label environment preview.
- **20 screenshot runtime** mencakup kelima zona pada empat preset; tidak ada error browser, normal preview tetap kosong, dan Low tidak menyalakan shadow dinamis.

Bukti browser, data validasi, dan laporan pengukuran berada di `output/sunken-ruins/revision3/`. Log tes/typecheck/lint/build ada di `work/sunken-ruins/revision3/`. Local game tersedia di `http://localhost:3000`; fixture terisolasi menggunakan MemoryStorage di `http://127.0.0.1:3002/sunken-ruins.html`.

## Performa final — ambang ketat belum terpenuhi

12 pengambilan baru, masing-masing 60 detik setelah warm-up: dua traversal follow dan satu adegan ramai free-camera untuk setiap preset. RTX 3060 Laptop, Chrome 155, viewport/drawing buffer 1280 × 720 sama dengan data pembanding Verdant/Whispering yang tersimpan. Pembanding diambil pada 8–9 Oktober; kandidat revisi ini diukur ulang pada 9 Oktober 2026. Semua sampel disimpan, tanpa memilih ulang sampel agar lulus.

| Preset | Batas p95 pembanding | Sunken p50 / p95 / p99 | CPU submission p95 | Calls p95 | Triangle p95 | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Low | 16,9 ms | 16,7 / 17,1 / 17,3 ms | 3,4 ms | 83 | 292.284 | Belum lulus |
| Medium | 16,8 ms | 16,7 / 17,0 / 17,2 ms | 4,0 ms | 116 | 341.344 | Belum lulus |
| High | 16,8 ms | 16,7 / 17,1 / 17,3 ms | 4,1 ms | 164 | 545.172 | Belum lulus |
| Ultra | 16,8 ms | 16,7 / 17,1 / 17,2 ms | 3,6 ms | 158 | 543.474 | Belum lulus |

Setiap capture mencatat sekitar 3.600 frame dalam 60 detik; setiap traversal bergerak sekitar 454 world units. Tidak ada error browser. Selisih p95 terhadap batas adalah 0,2–0,3 ms; laporan budget sengaja mengembalikan kegagalan. Ini belum memenuhi acceptance performa master plan, meski framerate rata-rata sekitar 60 FPS. CPU submission tidak menyatakan waktu GPU. Pengukuran ini belum membuktikan penyebab selisihnya, sehingga tidak dinyatakan sebagai noise ataupun regresi GPU.

Resource renderer tertinggi pada skenario benchmark: 164/183/220/213 geometry dan 16/16/17/17 texture untuk Low/Medium/High/Ultra. Total berkas aset yang benar-benar dimuat pada fixture adalah **29.443.584 byte**, termasuk karakter dan aset bersama. Detail setiap permintaan, distribusi frame, dan pembanding terdapat pada `performance.json` dan `budget.json`. Resource count ini bukan byte VRAM; skenario benchmark menjelajah lebih banyak sektor daripada tes lifecycle statis di atas.

Perubahan implementasi dan uji fungsional selesai, tetapi penerimaan penuh master plan tetap terbuka pada kriteria performa dan review fidelity pemilik. Tidak ada publikasi.

Tidak menyatakan seluruh map sudah fotorealistik. Material laut tetap pendekatan real-time, dan modul dekoratif pendukung masih mencampur geometri authored dengan aset hero PBR. Patung oceanic dan sebagian ikan/flora masih memakai kit procedural sebelumnya; detailnya belum setara dengan dua aset Tripo baru. Penilaian fidelity perlu memakai screenshot runtime, bukan hanya preview generator.
