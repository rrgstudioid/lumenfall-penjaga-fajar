# Sunken Ruins — revisi visual 2

Revisi lokal atas preview yang telah diterima: memperbaiki ikan mengikuti karakter, menerangkan laut, dan meningkatkan detail coral serta biota. Map ID, layout, collision, input, progression, dan rumus combat tetap menggunakan implementasi preview. `lib/game/adventurer-v3.ts` tidak diubah.

## Perubahan runtime

- `sunken-ruins-marine-motion.ts` mendefinisikan habitat tetap dan lintasan berdasarkan waktu. Posisi pemain hanya menentukan biota yang dirender. Ikan, ray, dan jellyfish tidak ditambahkan ke targeting atau AI combat.
- `sunken-ruins-vfx.ts` menggunakan material yang menerima cahaya, deformasi ekor/sirip/tentakel, partikel pada sel dunia, sinar dengan tepi lembut, dan permukaan air di atas map. Biota tidak lagi berpusat pada pemain.
- `sunken-ruins-materials.ts` menambahkan albedo pasir dan coral, detail normal procedural, variasi mineral, dan caustics cellular bergerak pada koordinat dunia. Seluruh tekstur dan material dimiliki oleh instance map dan dibuang saat keluar/gagal loading.
- `sunken-ruins-map.ts` memuat kit marine tambahan. Model organik digunakan dekat kamera/player, mesh sederhana pada jarak menengah, dan siluet kit awal pada jarak jauh. Preset lama tetap dipakai. Coral menerima dan menghasilkan shadow saat shadow preset aktif.
- `sunken-ruins-quality.ts` dan cabang Sunken di `world.ts` memakai air turquoise lebih terang, cahaya atas cyan-putih, exposure 1.14, hemisphere 2.5, dan directional 3.2. Fog 22–240 menjaga kedalaman dengan warna terang.

Kit baru berisi Acropora bercabang, coral berlapis, fan coral, spons berongga, batu reef dengan normal keluar, ribbon seaweed/kelp, ikan bersirip, jellyfish bertentakel, ray, dan lima mesh untuk jarak menengah. File kerja `work/sunken-ruins/Sunken_Ruins_Realism.blend` terpisah dari kit awal dan source kota. Authoring dapat direproduksi melalui `scripts/build-sunken-realism.py` di scene Sunken terisolasi.

## Aset dan provenance

Semua aset runtime disajikan lokal melalui whitelist middleware development `scripts/sunken-dev-assets.ts`. Tidak ada unduhan runtime dari Higgsfield dan tidak ada publikasi.

| Berkas di `dev-assets/sunken-ruins-underwater-v1/realism/` | Ukuran | Sumber |
| --- | ---: | --- |
| `marine-kit.glb` | 493,732 byte | Geometri original, script Blender proyek |
| `sand-albedo.png` | 2,735,165 byte | Higgsfield GPT Image 2.5, job `4b1a4f6a-b44d-4eb5-9f89-468786901c09` |
| `coral-albedo.png` | 2,160,151 byte | Higgsfield GPT Image 2.5, job `c891573f-7319-4771-b6a6-6843ce28cd7f` |
| `manifest.json` | metadata | Author, source, job, jumlah triangle, hash dan pemisahan source |

Referensi coral `work/sunken-ruins/coral-reference-higgsfield.png` berasal dari job `f3278113-7245-488e-a3c8-b6d692576d17`. Referensi ini membantu authoring bentuk; bukan hasil konversi otomatis gambar menjadi mesh. Tool generasi mesh Higgsfield tidak tersedia dalam sesi ini. Tiga generasi gambar menggunakan total **0.75 kredit**, dengan saldo teramati turun dari 120 menjadi 119.25.

Geometri merupakan karya original untuk proyek. Tekstur generated mengikuti ketentuan provider dan tidak diberi label CC0. [Penjelasan resmi Higgsfield tentang kepemilikan dan penggunaan output](https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially) menyatakan provider tidak mengklaim kepemilikan output atau membatasi penggunaan komersial output; pemakaian tetap tunduk pada ketentuannya. Tidak ada aset marketplace yang dibeli atau diunduh.

SHA-256 kit marine: `0dfe08a423dffb4d69d36e0380eac4454a6d9a86eecbcc4d192e4c61f95bd4dd`. Kit awal tetap `7c980006f502fdf12c5d5056bc229b688704aba7eccde76d45b51394ecf2ec16`.

## Validasi

- **98/98 tes kode** lulus, termasuk tes regresi marine: perpindahan pengamat X/Z/Y tidak mengubah transform biota yang sama pada waktu tetap; waktu berjalan menggerakkan biota; resource kit pinjaman tidak ikut dibuang oleh VFX.
- Browser membandingkan **42 identitas biota** sebelum/sesudah perpindahan pengamat. Seluruh transform tetap sama pada `dt=0`; preview tetap nol monster.
- **223 perbandingan combat**, termasuk 116 aksi diterima, lulus. Keempat monster fixture tetap chase/attack/return/death/respawn tanpa reward.
- Lifecycle browser lulus: tiga portal, level 31/32, Retry, reload, respawn, model pria/perempuan, attachment, serta 32 sudut kamera. Setelah tiga kunjungan kembali, resource stabil pada **86 geometries, 12 textures**, nol monster dan tiga label portal. Angka resource adalah count, bukan VRAM byte.
- **20 screenshot** lima zona × empat preset dihasilkan tanpa error browser. Low tetap tanpa shadow dinamis.
- Typecheck, lint 531 berkas, dan production build lulus. Warning chunk besar dan klasifikasi route vinext masih ada. Production client tidak memuat loader atau URL aset Sunken.

Pemeriksaan visual tambahan memakai renderer runtime yang sama, dengan kamera inspeksi untuk detail: [coral dekat](../output/sunken-ruins/realism/reef-detail.png), [cahaya dan permukaan](../output/sunken-ruins/realism/sunlight.png), [biota](../output/sunken-ruins/realism/wildlife.png). Screenshot ini bukan render Higgsfield.

## Batas fidelity

Revisi meningkatkan detail dan material ke arah naturalistik, tetapi **belum setara lingkungan fotorealistis sinematik**. Geometri coral, ikan dan ruins masih model game procedural; sinar dan permukaan air merupakan pendekatan shader real-time, bukan simulasi volumetric scattering atau ray-traced refraction. Karakter dan arsitektur lama tetap bergaya game. Tekstur generated membantu permukaan, bukan bukti bahwa seluruh laut sudah ultra realistic.

## Performa revisi

Chrome 155, RTX 3060 Laptop, viewport/drawing buffer 1280 × 720, DPR 1, browser yang sama dengan pembanding tersimpan. Setelah warm-up, tiga capture 60 detik per preset: dua traversal follow dan satu adegan fixture ramai dengan kamera free. Pembanding Verdant/Whispering berasal dari baseline sebelumnya dengan identitas perangkat, browser dan konfigurasi identik; tidak diukur ulang bersamaan pada revisi ini. Angka adalah quantile capture terberat, dibulatkan ke 0.1 ms. Layar 60 Hz membatasi interpretasi headroom.

| Preset | p50 / p95 / p99 | CPU submission p95 | Draw calls p95 | Triangles p95 | Batas p95 pembanding | Hasil |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Low | 16.7 / 16.9 / 17.1 ms | 2.9 ms | 108 | 1,445,416 | 16.9 ms | Lulus |
| Medium | 16.7 / 16.8 / 17.0 ms | 3.4 ms | 145 | 1,608,091 | 16.8 ms | Lulus |
| High | 16.7 / 16.8 / 17.0 ms | 3.5 ms | 206 | 2,536,510 | 16.8 ms | Lulus |
| Ultra | 16.7 / 16.8 / 17.0 ms | 3.8 ms | 196 | 2,548,782 | 16.8 ms | Lulus |

Capture awal Medium/Ultra sempat melampaui ambang sebesar 0.1 ms. Perubahan konten berikutnya memindahkan mesh Medium ke LOD menengah pada jarak sektor 50 (sebelumnya 60) dan menghentikan sektor Ultra yang sepenuhnya berada di balik fog, dengan margin sektor tetap. Tiga capture kedua preset diukur ulang setelah perubahan, semuanya dipakai; hasil awal tetap disimpan. Draw calls Ultra turun dari 285 menjadi 196. Low/High tidak mengalami perubahan kebijakan geometri, sehingga capture awal keduanya dipertahankan. Pembulatan atau batas kelulusan tidak dilonggarkan.

Payload aset runtime Sunken teramati **8,153,433 byte**, termasuk UI/karakter yang dimuat fixture; kit marine dan kedua albedo menyumbang **5,389,048 byte**. Nilai ini berada di antara pembanding Whispering (5,384,433 byte) dan Verdant (25,865,094 byte). CPU submission bukan waktu GPU; texture/geometry count bukan pemakaian VRAM dalam byte.

Data: `output/sunken-ruins/realism/performance.json` (12 capture awal), `performance-optimized.json` (6 capture kedua preset yang berubah), `performance-final.json` (12 capture implementasi final), dan `budget.json`. Jalankan `node scripts/report-sunken-realism.mjs` untuk merakit dan memeriksa laporan tanpa menghapus capture awal. Screenshot [kamera di atas permukaan air](../output/sunken-ruins/realism/overhead.png) memastikan permukaan tidak menutupi inspeksi map dari atas.
