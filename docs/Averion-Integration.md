# Averion — integrasi game utama

Kota Stage03 sekarang tersedia sebagai **Averion** (`averion`) pada menu Map game LUMENFALL lokal. Menggunakan karakter, animasi, kontrol, kamera, dan penyimpanan game yang sama. Arunika dan Jayantara tetap tersedia. Belum dipublikasikan.

## Cara bermain

1. Jalankan `corepack pnpm dev --host 127.0.0.1 --port 3000` dari folder proyek.
2. Buka http://localhost:3000 lalu Continue atau pilih karakter.
3. Tekan **M**, pilih **Averion**, lalu **Masuk kota**. Tersedia mulai level 1.
4. Tunggu pemuatan selesai, lalu berjalan dengan WASD. Spawn berada di jalur selatan air mancur Central Plaza.
5. Untuk kembali, buka Map dan pilih Arunika. Continue berikutnya mengingat kota terakhir yang berhasil dimuat.

Jika aset gagal dimuat, gerak dihentikan dan muncul **ERROR / Retry**. Gerbang tetap tertutup; jembatan bukan jalan keluar kota.

## Implementasi

- `lib/game/averion-map.ts`: adapter bersama Stage03 untuk aset distrik, LOD, collision, anchor, kamera, dan disposal.
- `lib/game/world.ts`: pemuatan Averion, spawn, pergerakan, minimap, kamera, pencahayaan, serta siklus masuk/keluar kota.
- `lib/game/regions.ts`: pendaftaran kota Averion.
- `app/page.tsx`, `app/globals.css`, `app/menu-presentation.css`: nama kota dan tampilan ERROR / Retry.
- `tests/browser/mahkota-fajar-stage03-scene.ts`: fixture lama memakai adapter bersama.
- `scripts/package-averion.py`: menyalin hanya aset runtime kandidat ke `public/assets/maps/averion/`.
- `scripts/test-averion-browser.mjs`: pengujian browser game utama dengan save terisolasi.

Paket: **55 file, 30.924.187 byte (29,49 MiB)**, terdiri dari manifest, runtime GLB gzip, dan tekstur. Manifest memakai `mapId: averion` serta menyimpan `sourceMapId` Stage03. Blender, bukti audit, dan GLB mentah tidak dimasukkan ke paket game. Sumber Blender asli tidak diubah.

## Hasil pengujian

- TypeScript `tsc --noEmit`: lulus.
- Build `pnpm build`: lulus.
- Unit collision/travel: 11/11 lulus.
- Menu Map masuk Averion; WASD, spawn, gerbang tertutup, dan pemulihan posisi invalid: lulus.
- Save/Continue memuat Averion kembali: lulus.
- Dua siklus Arunika–Averion: satu root map, satu canvas; jumlah resource stabil.
- Kegagalan collision asset: gerak terblokir, ERROR terlihat, Retry berhasil.
- 18 jalur antardistrik dua arah melalui `Game.move`: lulus. Ini uji lintasan otomatis, bukan pengukuran waktu berjalan manual.
- Tidak ada error JavaScript pada pengujian.

Pengukuran 180 frame di spawn: rata-rata **16,57 ms**, p95 **18,20 ms**, maksimum **133 draw calls / 446.560 triangle render**. Chrome headless 153, Windows, NVIDIA RTX 3060 Laptop, 1920×1080, DPR 1. Angka ini sampel diam di plaza, bukan benchmark seluruh kota.

Bukti: [hasil JSON](../work/averion/results.json), [tampilan dalam game](../work/averion/averion-final.png), [ERROR / Retry](../work/averion/averion-error-retry.png).

## Batasan

Kota dapat dijelajahi dalam game utama. NPC, layanan toko, quest, dan tujuan Warp produksi belum ditambahkan. Visual memakai hasil polish Stage03; belum identik dengan blueprint. Selisih visual tetap dicatat pada [laporan polish](LUMENFALL-Stage03-Visual-Polish.md). Tidak ada deployment atau penggantian kota publik.
