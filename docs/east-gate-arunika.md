# East Gate Arunika — hasil implementasi

Status: diimplementasikan dan dijalankan di `http://localhost:3001/`. Belum dipublikasikan.

## 1. Identitas field

Field baru `east-gate-arunika`, nama **East Gate Arunika**, codename **Sunrise Frontier**, Chapter 1, level rekomendasi 1–8, region type `field`. Padang Arunika (`verdant-plains`) tidak diganti atau dihapus.

## 2. File yang dibuat / diubah dalam pekerjaan ini

| File | Perubahan |
| --- | --- |
| `lib/game/east-gate-layout.ts` | Baru: boundary, elevasi, hydrology, landmark, bangunan, jalur, spawn zones dan collider East Gate. |
| `lib/game/regions.ts` | Registrasi field, koneksi kota, alias keluarga konten, NPC dan starting fields. |
| `lib/game/field-layout.ts` | Menggunakan posisi spawn dari layout; namespace respawn untuk region yang berbagi monster. |
| `lib/game/field-terrain.ts` | Terrain registry East Gate; parameter elevasi/air/jembatan; pencarian segmen sudut yang tepat untuk terrain memanjang; vegetasi baru. |
| `lib/game/field-terrain-renderer.ts` | Memperluas renderer bersama untuk landmark East Gate, portal batu, dusun, dermaga, dan air. |
| `lib/game/world.ts` | Menggunakan respawn key per region, portal travel biru dan minimap hydrology sesuai layout. |
| `lib/game/monster-loot.ts` | Resolusi keluarga loot Padang untuk East Gate tanpa membuat item atau peluang baru. |
| `lib/game/city-services.ts` | Toko camp memakai keluarga equipment yang sama. |
| `lib/game/rules.ts` | Starting fields dan migrasi unlock save lama yang aman. |
| `lib/game/bgm.ts` | Daftar musik field diturunkan dari registry; East Gate memakai BGM_02. |
| `lib/game/east-gate.test.ts` | Baru: 10 tes integrasi data, terrain, loot, spawn, quest, save, dan regresi. |
| `lib/game/city-layout.test.ts` | Jumlah NPC dinamis mengikuti registry. |
| `lib/game/field-expansion.test.ts` | Validasi semua field dan keluarga loot bersama. |
| `lib/game/field-terrain.test.ts` | Memeriksa dua field opt-in tanpa mengubah ekspektasi Padang. |
| `scripts/test-east-gate-browser.mjs` | Baru: 28 skenario browser terisolasi, screenshot, console dan HTTP checks. |
| `docs/east-gate-arunika.md` | Laporan ini. |

Perubahan Padang Arunika yang sudah ada sebelum pekerjaan ini dipertahankan. File lain yang sebelumnya sudah berubah tidak di-reset.

## 3. Koneksi Kota Arunika

`CITIES.arunika.connectedFields` mempertahankan Padang Arunika, Tambang Selubung Besi dan Rimba Bisik, lalu menambahkan East Gate. Hubungan konseptual timur tersimpan sebagai `cityDirection: east`. Pintu masuk field ditempatkan di sisi barat agar arah perjalanan dari kota masuk akal.

Cara masuk: buka **M → East Gate Arunika → Teleport field**. Tersedia sejak level 1.

## 4. Field registry

Jumlah field menjadi tujuh. Menu map, travel, quest dan NPC tetap memakai registry yang sama. Tidak dibuat world manager, merchant manager atau quest state kedua. Hitungan registrasi dan audio mengikuti daftar field.

## 5. Terrain dan arsitektur yang ditemukan

Game memakai Three.js dengan `Game` di `world.ts`. Lima field lama menggunakan bidang rectangular. Padang Arunika sudah memiliki renderer polygon opt-in bersama dari pekerjaan sebelumnya; East Gate memperluas renderer tersebut.

Boundary 64 titik dan 48 ring membentuk mesh radial 3D non-persegi. Pijakan dihitung dari segitiga yang sama dengan renderer, bukan sekadar perkiraan tinggi fungsi. Elevasi naik dari area masuk sekitar 2,8 ke arena sekitar 9,5 unit. Tebing tertutup turun ke air luar, dengan batu dan gunung jauh sebagai latar.

Air, collider prop, batas pantai, spawn validation dan navigasi memakai layout yang sama. Gerakan disapu dalam langkah kecil agar dash tidak menembus sungai/tebing. Dua jembatan memiliki permukaan pijakan yang mengikuti papan; dermaga memiliki deck tersendiri. Tangganya menggunakan ramp collision ringan.

## 6. Sub-area dan landmark

Koordinat adalah `(x,z)`; utara berarti z negatif.

| Area | Posisi utama | Isi |
| --- | --- | --- |
| Gerbang Timur | `(-43,20)` | Gerbang batu/kayu di barat, menara, area kedatangan, banner, camp. |
| Dusun Purnama | `(-19,28)` | Rumah panggung, lumbung, kebun, saluran kecil, pagar, gerobak, kincir air. |
| Lembah Cahaya | `(12,-30)` | Dataran tinggi, clearing boss, pohon tua besar, akar dan reruntuhan bertangga. |
| Rawa Sinar | `(3,18)` | Kolam rendah dengan reeds dan pulau batu kecil; ruang kering di sekelilingnya. |
| Pelabuhan Timur | `(20,43)` | Dermaga pada danau dekat pantai, perahu, gudang dan menara. |

Hanya tiga area pertama menjadi `subAreas` resmi. Jalur bercabang melalui kedua penyeberangan dan kembali terhubung menuju arena/portal. Gambar konsep tidak digunakan sebagai plane/texture terrain.

## 7. Monster templates dan loot

East Gate menyimpan referensi langsung ke `normalMonsters`, `eliteMonsters` dan `fieldBoss` Padang. Nama canonical saat ini tetap Small Slime, Wild Boar, Forest Piya, Stoneback Beetle, Giant Rootling dan Ancient Treant. Tidak dibuat salinan statistik.

`contentFamilyId: verdant-plains` dipakai oleh loot dan field shop. Semua keluarga loot, bobot item, rarity, Rune unik, Rune Optimizer, material, pet, potion dan equipment sama persis; provenance drop tetap menyebut East Gate sebagai lokasi asal.

## 8. Spawn coordinates

Terdapat 42 posisi deterministik dan unik: 36 normal (9 per spesies), 5 elite, 1 boss. Normal menggunakan zona baru berpusat di `(-28,9)`, `(-15,31)`, `(-30,-23)`, `(38,-23)`, lalu diperiksa/dipindah ke permukaan aman. Titik elite awal `(-39,-17)`, `(-21,-39)`, `(36,-37)`, `(42,4)`, `(-3,-20)` juga divalidasi sebelum digunakan.

Hasil akhir diperoleh melalui `fieldSpawns(FIELDS['east-gate-arunika'])`, bukan daftar monster kedua. Tes memastikan semua titik berada di tanah valid, di luar camp, air, bangunan, tebing, portal dan jalur jembatan; semuanya terhubung ke arena melalui navigasi.

## 9. Field Boss

Ancient Treant berada di `(12,-30)`, clearing radius 14 unit. Area tengah terbuka, dengan pohon besar, akar dan reruntuhan di tepi. Statistik tetap level 10, HP 1900, Attack 60, Defense 23, Magic Defense 20, EXP 1580, drop gate 95%, respawn 120 detik.

## 10. NPC camp dan quest

**Penjaga Pos Timur**, ID `field-npc-east-gate`, berada di `(-38,27)`. Memakai camp UI dan fungsi Buy, Sell, Teleport, Quest yang sudah ada. Area aman menghindarkan monster dari camp dan pintu masuk.

Pilihan quest A diterapkan: registry lama otomatis menghasilkan tiga identitas baru `field-east-gate-arunika-easy`, `field-east-gate-arunika-veteran`, `field-east-gate-arunika-elite`. Quest hanya dapat diambil di map ini. Progress tidak menyelesaikan quest Padang.

## 11. Portal Travel

Portal batu dengan energi biru berada di `(49,-9)`, sisi timur laut. Label mendekat menampilkan tujuan dan instruksi klik. Interaksi memakai `changeRegion` → `travel` → `unlockReason`, bukan teleport khusus.

Tujuan `ironveil-mines`; level 1 ditolak dengan pesan membutuhkan level 8, level 8 diterima. Gerbang barat `(-51,20)` kembali ke Kota Arunika. Inventory, equipment, hotbar, quest, save dan timer tidak diganti saat perjalanan.

## 12. Save migration

East Gate ditambahkan ke starting unlock secara deduplikasi saat load; unlock lama tetap dipertahankan. Format save tidak diubah. Posisi tersimpan yang invalid pada terrain baru dipindahkan ke titik aman terdekat.

Monster yang memakai template sama memiliki respawn key terpisah di East Gate, misalnya `east-gate-arunika:verdant-plains-5:spawn:100`. Key Padang lama tidak diubah atau diwariskan ke East Gate. Menewaskan Ancient Treant di satu map tidak menghilangkannya di map lain.

## 13. Optimasi dan audio

Vegetasi memakai InstancedMesh; bangunan, akar dan batu statis digabung per material. Terrain utama di bawah 4.000 vertex. Collider berbentuk sederhana; navigation grid dan height samples di-cache. Tidak ditambahkan texture 4K atau mesh per helai rumput.

Sampel browser pada pandangan portal: **80 draw calls, 28.500 triangles** untuk scene yang terlihat. Ini pengukuran satu view, bukan klaim FPS pada semua perangkat.

Musik `field-east-gate-arunika` memakai fallback BGM_02 yang sama dengan field lain. Identifier `ambient-east-gate-arunika` sudah terdaftar; belum ada rekaman ambience khusus baru.

## 14. Pengujian

- **151/151 tes logika lolos**, termasuk 10 tes baru East Gate.
- **28/28 skenario browser lolos** dalam profil Chrome lokal terpisah. Save milik pemain dan website publik tidak disentuh.
- TypeScript `--noEmit`: lolos.
- Build production Vinext: berhasil.
- Lint seluruh file yang disentuh dalam tugas ini: lolos.
- `git diff --check`: lolos.
- Tidak ada error runtime, hydration atau console pada pengujian browser; tidak ada request HTTP gagal.
- Verifikasi visual: pintu masuk, dusun, rawa, dermaga, jembatan, arena, portal, overview; viewport 1440×960, 1366×768, 1920×1080.
- Browser menguji WASD, basic attack, enemy navigation, camera minimum zoom, buy/sell, accept/complete quest, death/respawn, reload, kedua portal, level gate dan seluruh tujuh field.
- SHA-256 snapshot memastikan keenam definisi field lama, layout Padang, spawn Padang dan geometri render Padang tidak berubah.

Screenshot dan hasil mesin tersimpan di `work/east-gate/`; daftar pemeriksaan lengkap ada di `browser-results.json`. Tes membunuh monster dan memajukan deadline secara terkontrol untuk memverifikasi respawn tanpa menunggu 120 detik; bukan pengujian sesi multiplayer live.

## 15. Batasan yang tersisa

- Visual memakai geometri low-poly sesuai game saat ini, bukan detail ilustrasi konsep satu banding satu.
- BGM masih fallback; ambience khusus dan animasi air tingkat lanjut belum ditambahkan.
- Belum dilakukan benchmark perangkat mobile/low-end atau sesi bermain panjang.
- Build memberi peringatan bundle client di atas 500 kB, bukan build error.
- Lint seluruh repository masih menemukan 26 error lama pada komponen UI umum, hook mobile dan dua file tes lama yang tidak disentuh dalam tugas ini. File implementasi East Gate bersih.
- Terrain radial mengharapkan boundary star-shaped berurutan mengelilingi origin; bukan dukungan polygon arbitrer berlubang. Sungai/kolam ditangani oleh lapisan air dan navigasi yang terpisah.
- **Belum dipublikasikan**. Hasil dapat diperiksa di localhost sebelum deployment berikutnya.
