# Cena — pengganti karakter male

Tanggal: 26 September 2026.

## Hasil

Factory `lib/game/character-model.ts` sekarang memuat Cena untuk male/legacy male,
baik di world (`world.ts: createCharacterModel(this.hero)`) maupun Character Preview.
Female tetap menggunakan `female-rpg-rigged.glb` dan animasinya sendiri.
Integrasi awal masuk commit `569e348`. Koreksi grip di bawah belum commit/push/publish.

## Review kontur dagu

`cena-chin.ts` menghaluskan kontur bawah bibir/dagu pada **clone runtime** sebelum
attach rig. Laplacian relaxation dengan falloff halus mengurangi sudut/gelombang
lokal; vertex berimpit diselesaikan bersama agar tidak membuka seam. Perubahan
331 vertex, maksimum 0,006 unit koordinat model. Normal di luar area dijaga
persis; fitur wajah di atas area dagu, material lain, warna, topology/index,
skin weights dan bone transforms tidak diubah. Operasi idempotent, bukan deform
per-frame. Body GLB dan Blender asli tetap utuh, tidak menambah salinan aset besar.
Hash target paket motion tetap benar karena file rig/GLB tidak berubah.

Sebelum/sesudah diperiksa dari depan, profil dan ¾. Bukti sebelum:
`work/cena-character/chin-before/`; sesudah:
`work/cena-character/browser/face*.png`. Preview memiliki tombol Wajah depan,
Profil dagu, Wajah ¾ dan parameter `?view=faceThreeQuarter`.

**26 focused tests PASS**, termasuk isolasi edit, source tetap utuh, idempotency,
rig/weights/feature preservation, animasi dan senjata. Browser menggunakan
factory produksi yang sama; full-world/full production build belum diulang.
Ini koreksi kontur runtime, bukan perubahan sculpt di file Blender sumber.

## Status terbaru — animasi game lama dipulihkan atas persetujuan pemilik

Cena sekarang memakai **Walk, Army Run, DualSword_Attack_01/02/03** dari karakter
lama Astra, di-retarget ke rig Cena. Animasi yang disertakan dalam sumber Blender
Cena tetap tidak dipakai. Catatan pengujian "tanpa native mixer" di bagian
riwayat bawah berlaku untuk tahap body-only sebelumnya, bukan status terbaru.

- `scripts/retarget-cena-legacy-motion.mjs` membaca dua GLB yang sudah ada secara
  read-only. Rotasi world source dipetakan ke frame tulang target, dengan koreksi
  anatomical swing, proporsi kaki dan kontak telapak/flight Run. Tidak menyalin
  child translation, scale, finger tracks atau mesh lama. Idle menggunakan profil
  natural yang telah disetujui, bukan idle/A-pose animasi sumber.
- Output `public/assets/characters/cena/cena-legacy-motion.json`: **301.676 byte**,
  lima clip dengan identitas berbeda dan hash provenance source/target. Regenerasi
  menghasilkan hash yang sama. Tidak mengubah body GLB 52 MB atau `.blend` asli.
  Jalankan ulang script bila rig/body/profile rest pose berubah.
- `cena-motion.ts` memuat paket kecil tersebut sekali, memvalidasi daftar clip
  dan identitas unik. Runtime tidak mengunduh GLB Astra atau Army Run lagi.
  Kegagalan unduh motion memberi warning dan memakai gerak procedural, bukan
  membuat body hilang. Loader tidak memakai `loaded.animations` dari Cena.
- Controller animasi game yang sudah ada tetap memicu Walk/Run/serangan; socket
  diselaraskan ulang sesudah mixer agar grip dan Meteor tetap mengikuti tangan.
  Khusus Cena, jeda reset combo dihitung setelah serangan selesai sehingga clip
  berdurasi >1 detik tidak selalu memaksa kembali ke serangan 01.
- Damage, hit timing, movement speed, collision, skill, item, save tidak diubah.
  Animasi visual tidak menjadi sumber perhitungan combat. Posisi actor tidak
  digerakkan oleh clip; hanya pelvis visual yang mendapatkan cyclic displacement.
- Preview sekarang memiliki tombol Jalan/Lari/Serang berulang/Idle/Pause dengan
  playback RAF nyata. Snapshot deterministik tetap terpisah untuk automation.
  Tiga serangan diputar berurutan; Idle kembali ke pose natural. Preview bergerak
  di tempat dan tetap tidak mengakses save pemilik.
- **25 focused tests PASS / 0 failed**, termasuk tiga combo, mixer action nyata,
  gerak kedua grip, source clip rejection, target hash, kembali idle, rest pose,
  arah bidang Meteor, load order, female, Astra dan Revision02. Lint PASS.
- **17 headed browser cases PASS**, nol console error/warning/page error/request
  failure. Evidence `work/cena-character/browser/live-*.png` dan `report.json`;
  `motion-retarget-report.json` mencatat jumlah frame/durasi/koreksi grounding.
- Build fixture PASS. Full production build/full lib/game tidak diulang pada
  tahap visual ini. Full-world acceptance belum dilakukan; fixture memakai
  factory/animator produksi. Tidak ada IK medan/adaptive grip baru: ukuran tubuh
  Cena dan pedang Meteor yang besar masih bisa menimbulkan overlap pada pose
  ekstrem; bukan animasi baru yang dirancang khusus untuk semua ukuran senjata.
- Belum commit, push atau publish.

## Koreksi grip setelah review pemilik

Socket memiliki posisi yang benar, tetapi basis orientasi empty dari Blender dalam
GLB berbeda dengan asumsi holder senjata runtime. Bilah mengikuti sumbu yang
melintang terhadap genggaman. Tes awal hanya membandingkan senjata dengan socket;
itu tidak cukup untuk membuktikan kesesuaian anatomis.

`loadCenaCharacter()` sekarang menormalkan orientasi kedua socket pada CLONE dengan
rotasi lokal X -90 derajat: arah grip -Z hasil ekspor menjadi +Y yang dikonsumsi
equipment. Bone jari, mesh, ukuran senjata, cached GLB dan sumber Blender tidak
diubah. Koreksi tidak menumpuk ketika karakter/preview dibuat ulang.

Validasi koreksi:

- Tes sekarang memeriksa arah hilt terhadap landmark buku jari kelingking→telunjuk,
  selain posisi/orientasi socket, sepanjang gerak procedural dan actor transform.
  Arah dihitung dari matrixWorld dan dinormalisasi, bukan quaternion dekomposisi
  hierarchy berskala nonuniform. Threshold alignment socket tetap >0,999;
  landmark anatomi >0,96 (landmark buku jari tidak persis sejajar handle).
- **23 focused tests PASS / 0 failed**: Cena, character-model, Revision02, female,
  special-sword-model. Lint/type-aware file yang diubah: PASS.
- Chrome headless dan headed: unarmed, 1H, dual, Meteor di kedua tangan, 2H,
  female, serta gerak/serangan procedural. **10 capture cases PASS**.
- Screenshot depan/samping/belakang serta close-up kedua tangan diperiksa.
  Meteor ditunggu sampai kedua model GLB benar-benar terpasang sebelum dicapture.
- Console error/warning, page error, request failure: **0**.
- Fixture memakai factory produksi, profil browser terisolasi, tanpa world/map
  atau perubahan save. Tidak mengklaim full-world gameplay acceptance baru.
- Full lib/game dan production build tidak diulang untuk patch orientasi visual
  ini; hasil baseline integrasi awal dicatat terpisah di bawah.
- Tidak menambahkan native animation/IK genggaman dua tangan. 2H tetap mengikuti
  kontrak attachment main-hand yang sudah ada, bukan pose dua tangan baru.

Bukti: `work/cena-character/browser/report.json`, `dual-hands.png`,
`dual-handsReverse.png`, `meteor-hands.png`, `meteor-handsReverse.png`.
Capture sebelum koreksi: `work/cena-character/grip-before/`.

Preview interaktif: `node scripts/check-cena-character-browser.mjs --serve`.
Terminal mencetak URL lokal pada port bebas; append `?equipment=meteor` untuk
membuka dua Meteor. Drag untuk orbit, scroll untuk zoom, tombol untuk sudut dan
pose procedural. Server hanya bind loopback; berhenti dengan Ctrl+C. Ini bukan
server utama pemilik dan bukan publikasi.

Sumber read-only: `C:\Users\USER\Documents\Codex_Blender_Combo03\Cena_Textured_ChinAligned.blend`.
SHA256: `3e374245efb1bda87f3e1b8fe0e1d2f10fd29db05b7033f4ee79c755166b0586`.
Ekspor dilakukan melalui proses Blender background terpisah; file sumber dan sesi
Blender pemilik tidak diubah. Hash sumber sebelum/sesudah ekspor identik.

## Aset runtime

### Koreksi bidang bilah Meteor

Review lanjutan menemukan tes arah ujung/gagang belum mencakup **roll bidang
bilah**. Pedang procedural sudah tegak pada socket Cena, tetapi Meteor masih
memakai tambahan -90° legacy di `alignCrimsonSword`, sehingga bidang lebarnya
mendatar seperti nampan. Cena kini menyediakan `importedSwordGripRoll = 0`;
rig lain tetap memakai nilai legacy. Koreksi dipasang baik bila pedang selesai
load sebelum body maupun sesudah body. Tidak mengubah ujung, panjang, posisi
gagang, pose tangan/kaki, data equipment atau source asset.

`setCrimsonSwordGripRoll()` memutar bidang di sekitar sumbu panjang mesh dan
mempertahankan grip/tip. Aura tetap child dari blade frame. Tes GLB nyata
memastikan kedua urutan load, kedua tangan, actor transform, bidang bilah tegak,
serta koordinat tip/grip sebelum-sesudah identik dalam toleransi 1e-6.
Browser kini memeriksa arah lebar blade asli, bukan hanya wrapper/arah ujung.
**24 focused tests PASS**, lint PASS; **10 headed browser cases PASS**, nol
console error/warning, page error dan failed request. Screenshot Meteor terbaru
memperlihatkan bidang lebar vertikal. Tidak menjalankan ulang full production
build atau full lib/game untuk koreksi presentasi ini.

### Pose istirahat natural (review lanjutan)

Cena sekarang mempunyai offset pose visual khusus model, bukan A-pose ekspor:
lengan atas didekatkan ke torso, lengan bawah rileks, kaki selebar pinggul.
Pergelangan diarahkan sedikit keluar agar kedua bilah tidak bersilangan saat idle;
socket tetap mengikuti tangan, bukan digeser terpisah dari genggaman.
`CharacterVisualProfile.restPose` diterapkan setelah delta gerak procedural dalam
basis game, tanpa mengubah bind matrix, mesh, source GLB, atau Blender.
Offset kaki dikompensasi di pergelangan untuk mempertahankan arah telapak;
`preserveRestFootHeight` menyesuaikan tinggi visual sekali saat attach agar
perubahan stance tidak menenggelamkan telapak. Actor/collision tidak digeser.

Profil ini hanya diaktifkan pada Cena; female/Revision02 tidak berubah. Reset
serangan kembali ke pose santai yang sama. Genggaman/socket tetap mengikuti
bone tangan dan animasi native tetap nonaktif. Tidak menambahkan clip animasi,
finger IK adaptif, atau pose dua tangan baru.

Validasi: **23 focused tests PASS**, termasuk jarak siku/tangan terhadap torso,
lebar kaki 0,38–0,48 unit, seluruh vertex telapak dalam toleransi 0,003 unit dari
lantai saat reset, grip saat bergerak, source clone, female dan model lama.
Fixture headed **10 cases PASS**, nol console errors/warnings/page errors/request
failures; screenshot idle depan, samping, kedua tangan dan Meteor ditinjau.
Lint/type-aware untuk tiga modul yang diubah: PASS. Full production build dan
full lib/game tidak diulang untuk perubahan pose visual ini.

- File: `public/assets/characters/cena/cena-rigged.glb`.
- Ukuran: 52.114.572 byte (49,70 MiB).
- 374.735 triangle; 187.981 vertex sumber, lebih banyak vertex GPU akibat split normal/material.
- Rig asli 52 tulang dipertahankan, termasuk 30 tulang jari.
- Lima primitive/material yang terpakai; empat pengaruh tulang maksimum per vertex, dinormalisasi.
- Nol animation clips, nol mesh pedang bawaan, nol kamera/lampu/objek duplikat dari scene sumber.
- Koreksi bentuk leher/dagu dan genggaman statis dievaluasi menjadi bind pose ekspor.
- Ukuran visual mengikuti tinggi game 2,4 unit; posisi actor, collision, damage, dan stat tidak berubah.

Base color shader procedural dibake menjadi warna vertex, termasuk rambut cokelat,
kulit, kain/headband dan iris. Roughness material dipertahankan. Micro-bump procedural
Blender tidak diekspor; file ini bukan shader-identical reproduction Blender.
Appearance skin/hair tint lama tidak menimpa warna authored Cena; data pilihan appearance
tetap disimpan tanpa perubahan. Belum ada decimation/LOD. Ukuran/polycount lebih berat
daripada Astra sehingga optimasi perlu fase tersendiri bila dipakai untuk banyak actor.

## Rig dan senjata

`cena-character.ts` memberi mapping nama bone Cena ke binding humanoid yang sudah ada.
`revision02-character.ts` menerima mapping per model tanpa mengganti rig female/Revision02/Astra.
Socket `WeaponSocketR/L` berasal dari `Meteor_Grip.R/L` sumber; posisi dan orientasi
genggaman digunakan untuk senjata runtime. Rotasi blade holder yang sudah ada dikompensasi
satu kali agar orientasi pedang mengikuti grip, bukan menambahkan rotasi ganda.
Senjata tampil berdasarkan equipment/inventory. Body GLB tidak memberikan item atau
capability Dual Wield. Fixture dua pedang mengisi loadout langsung hanya untuk QA visual;
aturan equip dan progression gameplay tetap memakai resolver lama.

## Animasi

44 action data-block dalam sumber tidak diekspor. Loader mengabaikan clip yang
tertanam di GLB Cena, termasuk clip dengan nama lama. Atas persetujuan pemilik,
AnimationMixer kini menggunakan paket terpisah hasil retarget animasi game lama
(lihat status terbaru). Idle tetap procedural natural; animasi female tetap aktif.

## Validasi

- Focused character/equipment tests: **29 passed, 0 failed**.
- Unit test GLB nyata: triangle/bone/weights/colors; clip tidak aktif; save tidak berubah;
  kedua grip mengikuti gerak; geometry/skeleton/material clone terpisah; dispose aman.
- Fixture browser dengan factory produksi: unarmed, 1H, Dual Sword, 2H, run procedural,
  attack procedural, dan female. **PASS** di Chrome headless dan headed.
- Dev fixture dibuild dengan Vite tanpa full world/map, lalu disajikan server sementara
  pada port bebas. Browser memakai profil/storage terpisah, tidak menyentuh save pemilik.
- Console errors, warnings, page errors, failed requests: **0**.
- Kesalahan posisi grip maksimum pada capture fixture < 5e-16 unit.
- Bukti: `work/cena-character/browser/*.png`, `report.json`, `export-report.json` di parent.
- Lint/type-aware check untuk file TS/JS yang disentuh: PASS.
- Full `lib/game`: **407 passed / 82 failed / 489 total**.
- Pembanding read-only dengan tiga modul/test karakter sebelum perubahan dimuat dari
  Git HEAD ke memori, sementara perubahan lain milik pemilik dipertahankan:
  **406 passed / 82 failed / 488 total**. Nama 82 kegagalan identik, **0 new failures**.
  Test Cena adalah satu test tambahan yang lulus. Full suite bukan keseluruhan green.
- Project-wide `tsc --noEmit` terhalang syntax/type declaration dependency vinext
  (`dist/index.d.ts`, TS1003/TS1160). Tidak mengubah dependency untuk tugas model.
- Build browser fixture berhasil. Full production build dan full-world acceptance
  tidak dijalankan; hasil browser membuktikan factory produksi di fixture visual terisolasi.

## File implementasi

- `scripts/export-cena-character.py`: exporter offline, sumber tidak disimpan ulang.
- `public/assets/characters/cena/cena-rigged.glb`: model body-only.
- `lib/game/cena-character.ts`, `lib/game/cena-character.test.ts`.
- `lib/game/character-model.ts`, `lib/game/character-model.test.ts`.
- `lib/game/revision02-character.ts`.
- `tests/browser/cena-character-fixture.html`, `tests/browser/cena-character-fixture.ts`.
- `scripts/check-cena-character-browser.mjs`.
- Dokumen ini dan tambahan koordinasi di `docs/3D_MODEL_HANDOFF.md`.

Perubahan awal pada `components/game/job-skill.tsx`, `lib/game/rules.ts`, dan
`lib/game/rules.test.ts` milik pekerjaan lain dipertahankan, tidak diedit oleh tugas ini.
Model Astra dan Revision02 lama tetap tersedia sebagai referensi; default male hanya
meminta aset Cena, tidak memuat ketiga model bersamaan.
