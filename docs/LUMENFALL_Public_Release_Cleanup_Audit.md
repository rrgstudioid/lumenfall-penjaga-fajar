# LUMENFALL — Audit cleanup dan publikasi sistem terbaru

Tanggal: 22 September 2026. Bahasa laporan: Indonesia.

## Scope dan keselamatan

Permintaan owner: bandingkan source publik/lokal, bersihkan duplikasi yang tidak perlu, pertahankan gameplay, lalu publikasikan sistem terbaru. Owner menyetujui pilihan karakter V3 baru; karakter V2 tidak dimigrasikan.

Tidak mengubah koefisien damage, chance/durasi Stun, threshold charge, cooldown, Mana skill, Rune rarity, monster balance, atau ekonomi SP. Tidak menambahkan Blade Master, Dual Wield, Executioner, PvP, atau animasi. Save browser owner tidak digunakan untuk QA.

## Temuan utama

1. **Tailwind memindai terlalu luas.** `app/globals.css` memakai automatic source detection pada repository yang berisi staging/export/arsip besar. Membatasi source scan pada app/components/hooks/lib/data menghilangkan hang build. Pipeline vinext/Sites/Cloudflare normal dipertahankan, bukan mode ringan. Watcher juga mengecualikan output dan staging.
2. **Source staging berlapis.** Ditemukan `app/app`, `lib/lib`, `components/components`, `public/public`, `dist/dist`. Copy sebelumnya dapat menaruh pembaruan di folder nested, sementara source aktif tetap lama. Sinkronisasi baru menyalin file ke path tepat dan memverifikasi hash; 571 file stale/duplikat di runtime staging disingkirkan. Root project sebagai sumber utama tidak ditimpa dari staging lama.
3. **Public bukan source lokal terbaru.** Baseline publik v77 memakai commit `00d04c0833aa37afbc8676009a1c261c7f37724e`. Audit 418 file runtime/public menemukan 76 file berubah/baru dan 18 file baseline tidak lagi ada. Daftar mesin: `output/release-audit/source-comparison.json`. Ini perbandingan source resmi version yang deployed, bukan tebakan dari tampilan browser.
4. **SSR produksi HTTP500.** `regions.ts` mengimpor helper koordinat dari `imported-map.ts`, sehingga Three.js dievaluasi di server. LoadingManager membuat AbortController di global scope yang ditolak Worker. Helper koordinat dipisahkan ke `sands-coordinates.ts`, angka dan rumus identik; imported-map tetap reexport kompatibel. HTTP200 dibuktikan memakai Wrangler terhadap hasil build produksi.
5. **Benturan nama loader dekor.** Cleanup Normandy sebelumnya meninggalkan dua `buildRegionDecor` dalam Game. Helper pohon diganti menjadi `buildTreeDecor`, sehingga tidak menimpa konstruksi region utama. Tidak ada pengubahan collision/combat formula; regresi khusus mencegah benturan berulang.
6. **V3 ada tetapi menu belum terhubung penuh.** Sesuai persetujuan owner, menu kini menawarkan V2 klasik atau V3 untuk karakter baru. Routing generic promotion menggunakan transisi V3 yang sudah ada; K-panel memakai registry V3 asli, termasuk biaya rank/prerequisite. Pembelian Berserker sebelumnya kehilangan job registry specialization; diperbaiki. Reset skill V3 memakai refund SP V3, bukan perhitungan V2. Grant/lineage/totalEarnedSP tetap dipertahankan.

## Cleanup dan rollback

54 target arsip/staging lama, **35.307.299.763 byte (~35,3 GB)**, dipindahkan ke:

`C:\Users\USER\Documents\LUMENFALL_RELEASE_BACKUP_20260922`

Termasuk 33 arsip `lumenfall-*.tar.gz`, `.site-package-*`, `.package-stage`, `.site-tmp-v2`, staging `sites-reconcile`/`sites-source-staging`, serta dist/archive lama dari `sites-reconcile-v2`.

Ini **pengurangan isi project, bukan ruang disk yang dibebaskan secara permanen**: backup masih berada pada disk. Manifest lengkap asal/tujuan/ukuran: `output/release-audit/archive-plan.json`. Permanent deletion sempat ditolak pemeriksaan keselamatan; alternatif move ke backup digunakan. Tidak ada permanent deletion pada kumpulan tersebut. Pemulihan dapat dilakukan dari backup; jangan menyalin seluruh staging lama kembali ke source aktif.

Source publik aktif `sites-reconcile-v2` dipertahankan. Dependency umum, original Blender, D:\FlyffUS, source eksternal, serta sistem game tidak dihapus. Tidak mengembalikan Flaris. Penghapusan Normandy/map eksperimen yang sudah dilakukan pada pekerjaan sebelumnya tidak diperluas ke map aktif.

Public assets: sekitar **95,9 MB / 180 file**. Ada 3 pasang ikon Rune identik (46.966 byte redundant); tetap dipertahankan karena masing-masing path dipakai identitas item berbeda, penghematannya kecil dibanding risiko missing icon. Tidak semua nama mirip dianggap duplikat.

## File perubahan inti

- `app/globals.css`, `vite.config.ts`, `.gitignore`: batas scanning/watch/output.
- `lib/game/sands-coordinates.ts`, `imported-map.ts`, `regions.ts`, `field-layout.ts`: pemisahan helper server-safe, koordinat tetap.
- `lib/game/world.ts`: nama helper pohon unik; tidak mengubah combat.
- `app/page.tsx`, `components/game/menu-presentation.tsx`: pilihan V3 opt-in dan akses promotion.
- `components/game/job-skill.tsx`, `lib/game/character-view.ts`, `job-presentation.ts`: tampilkan registry V3, ancestry, biaya/gate yang benar.
- `lib/game/rules.ts`: routing V3, registry pembelian Berserker, refund V3.
- `lib/game/public-v3-routing.test.ts`, `release-boundaries.test.ts`: regresi routing/save/batas server dan loader.
- Script audit/sync/build/browser di `scripts/`: pemeriksaan dapat diulang, output tidak dipublikasikan sebagai konten situs.

## Verifikasi sebelum upload

- Full `lib/game`: **409 passed / 0 failed**, tidak skipped.
- Production build: PASS. Pengukuran setelah perbaikan: **6,52 detik**, peak Node working set **1322 MB** (satu proses build, bukan seluruh RAM PC). Percobaan setelah source-scan fix lain 6,44–8,12 detik; bukan benchmark mesin identik terkontrol dengan run gagal sebelumnya.
- Build masih memberi warning chunk >500 kB. Tidak ada klaim bahwa seluruh bundle telah dipecah/dioptimalkan secara maksimal.
- Browser Chrome headless, viewport 1440×900, profil terpisah, **hasil produksi Wrangler**, bukan dev transform.
- Karakter V3 dibuat melalui menu asli → Enter World → tampil world/canvas → primary hotbar kosong → 3 skill Adventurer V3 → save/reload PASS.
- Panel Job Skill dan Character berada dalam viewport, tidak jatuh di bawah world. Screenshot/trace: `output/release-audit/production-preview/`.
- Fixture save Berserker Lv80 → 9 skill Berserker → beli Mastery melalui UI → 11 skill Warrior ancestry → rank dan total SP bertahan reload: PASS.
- Save V2 Lv12/gold6543 → world dan skill V2 tetap, tidak dimigrasi: PASS.
- Browser preview: **0 console error, 0 warning, 0 request failure**, tidak ada HTTP asset error pada alur yang diuji.
- Combat fixture dibundle ulang dari source saat ini (bukan bundle checked-in lama), dijalankan di browser terisolasi tanpa full world. Iron Charge short/long, damage, Stun lock/recovery/immunity dan Basic Attack: PASS. Berserker Earth Splitter per-target Stun/immunity, Fury Harvest healing count, Trance/Frenzy Guard, Breaker Entry: PASS. Tidak mock hasil combat. Catatan: property fixture lama bernama `raging` sebenarnya menjalankan **Earth Splitter**, bukan bukti browser Raging Cleave.
- Evidence combat: `output/release-audit/combat/results.json` dan screenshots.

## Batas klaim

Regression dan smoke mencakup jalur di atas; bukan bukti seluruh quest/monster/Rune roll/perangkat/semua kombinasi skill telah diuji manual. Browser test tidak mengubah save milik owner. Public dan localhost memiliki storage origin berbeda; save lokal tidak otomatis pindah ke publik. Ekonomi SP V3 tetap konfigurasi yang sudah ada, belum difinalisasi.

## Publikasi

Source yang disinkronkan dan output build harus sama; upload hanya output produksi dan manifest hosting melalui workflow Sites resmi, bukan seluruh repository/backup. Hasil version/deployment/ukuran arsip serta verifikasi publik dicatat pada addendum setelah operasi native berhasil. Jangan menganggap laporan preflight ini sendiri sebagai bukti deployment berhasil.
