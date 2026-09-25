# Cena — pengganti karakter male

Tanggal: 26 September 2026.

## Hasil

Factory `lib/game/character-model.ts` sekarang memuat Cena untuk male/legacy male,
baik di world (`world.ts: createCharacterModel(this.hero)`) maupun Character Preview.
Female tetap menggunakan `female-rpg-rigged.glb` dan animasinya sendiri.
Belum commit, push, atau publish.

Sumber read-only: `C:\Users\USER\Documents\Codex_Blender_Combo03\Cena_Textured_ChinAligned.blend`.
SHA256: `3e374245efb1bda87f3e1b8fe0e1d2f10fd29db05b7033f4ee79c755166b0586`.
Ekspor dilakukan melalui proses Blender background terpisah; file sumber dan sesi
Blender pemilik tidak diubah. Hash sumber sebelum/sesudah ekspor identik.

## Aset runtime

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

44 action data-block dalam sumber tidak diekspor. Loader Cena secara eksplisit menolak
native clips, termasuk apabila GLB di masa depan tidak sengaja berisi clip bernama lama.
Tidak membuat AnimationMixer untuk Cena. Idle, gerak, dan respons serangan procedural
game yang sudah ada tetap berjalan melalui rig; Combo 02/03 dan native animasi male lama
tidak dipasang pada Cena. Animasi female tetap aktif.

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
