# Male Body Mesh Review

## Ringkasan cepat

Model kandidat yang dikirimkan di `C:\Users\USER\Documents\Male Body Mesh.glb` adalah file GLB yang valid, tetapi bukan karakter game-ready yang kompatibel dengan kontrak runtime Lumenfall saat ini.

Berdasarkan struktur data GLB dan pola asset yang sudah dipakai di proyek, model ini masih memiliki karakteristik berikut:

- belum ada rig/skinning yang memenuhi kontrak bone game
- belum ada socket untuk senjata yang cocok dengan `WeaponSocketR` / `WeaponSocketL`
- belum ada animasi yang konsisten dengan runtime male-body skinned pipeline
- belum ada optimasi yang disesuaikan dengan `character-model.ts` dan `revision02-character.ts`

Ini berarti model tersebut perlu diproses lagi di Blender atau alat rigging sebelum bisa menggantikan karakter male di game.

## Referensi runtime yang sudah ada

Proyek saat ini memakai asset rigged yang sudah terintegrasi di:

- [public/assets/characters/astra-hunyuan/astra-hunyuan-rigged.glb](../public/assets/characters/astra-hunyuan/astra-hunyuan-rigged.glb)
- [public/assets/characters/male-revision-02/male-revision-02.glb](../public/assets/characters/male-revision-02/male-revision-02.glb)
- [lib/game/hunyuan-character.ts](../lib/game/hunyuan-character.ts)
- [lib/game/revision02-character.ts](../lib/game/revision02-character.ts)
- [lib/game/character-model.ts](../lib/game/character-model.ts)

Kedua loader di atas mengharapkan:

- skinned mesh dengan hierarchy bone / joint
- bone names yang konsisten (contoh: `UpperArmR`, `HandR`, `WeaponSocketR`)
- `HandR` / `HandL` untuk attachment aktif
- posisi tangan dan grip yang pas untuk senjata
- karakter dengan tinggi game yang tetap pada skala yang sama

## Hasil audit model kandidat

Dari inspeksi GLB kandidat, node-nya terlihat seperti:

- `Male_body_cena_Mesh:Body`
- `Male_body_cena_Mesh:Eye`
- `Male_body_cena_Mesh:Eyebrow`
- `Male_body_cena_Mesh:Sena`

Struktur ini menandakan bahwa asset masih berupa mesh komposit body/cena, bukan skeleton karakter game yang siap dipakai.

Belum terlihat tanda-tanda:

- skin dengan `skinWeights`, `skinIndices`
- bone hierarchy game-ready
- `WeaponSocketR` / `WeaponSocketL`
- transform grip yang sudah disesuaikan dengan pegangan tangan

## Pekerjaan yang perlu dilakukan

### 1) Rigging ulang di Blender

- import model ke Blender
- buat/retarget skeleton karakter sesuai kontrak Lumenfall
- pastikan nama bone konsisten dengan system runtime
- jaga `Hips`, `Spine`, `Chest`, `Head`, `HandR`, `HandL`, `WeaponSocketR`, `WeaponSocketL`

### 2) Optimasi geometri

- remove hidden internal faces
- weld duplicate vertices pada seam
- limit total triangle sesuai target gameplay
- jaga bentuk siluet tetap mirip aset asli
- pastikan normal dan UV tetap rapi

### 3) Perbaiki posisi senjata di tangan

- pastikan pivot sword/grip berada pada palm atau grip center
- orientasi blade mengikuti forward `-Z` / axis game
- pastikan saat idle dan attack, senjata tidak mengambang atau menembus lengan
- buat socket kunggulan di `WeaponSocketR` dan `WeaponSocketL`

### 4) Export ke format game

- export ke GLB/GLTF dengan bone hierarchy dan skin
- simpan sebagai asset dev/test sebelum mengganti asset produksi
- lakukan verifikasi di runtime setelah siap

## Rekomendasi penerapan

Model ini saat ini lebih tepat diperlakukan sebagai kandidat source, bukan sebagai pengganti langsung yang siap pakai.

Langkah yang aman:

1. copy kandidat ke folder development asset, bukan langsung ke `public/assets/characters/`
2. rigify ulang dan optimize di Blender
3. export versi `male-rigged-game-ready.glb`
4. uji binding di runtime dengan sistem yang sama seperti [lib/game/hunyuan-character.ts](../lib/game/hunyuan-character.ts)
5. setelah valid, baru ganti male body default pada game

## Kesimpulan

Model yang dikirim bukan karakter male-game-ready yang dapat langsung menggantikan char utama. Butuh proses rigging + socket adjustment + optimization sebelum siap untuk gameplay.

Jika kamu mau, langkah berikutnya yang paling tepat adalah saya bantu:

- buat pipeline rigging exact untuk model ini di Blender, atau
- menyiapkan script/guide untuk retarget bone dan socket yang cocok dengan game, atau
- menyalin model ke folder staging dev asset supaya siap diproses lebih lanjut
