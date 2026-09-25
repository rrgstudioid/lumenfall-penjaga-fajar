# LUMENFALL Stage03 — Visual Polish

Status: kandidat development sudah dipoles dan diuji ulang. Kesetiaan visual meningkat pada landmark dan identitas layanan, tetapi belum identik dengan referensi. Detail yang belum menyamai target dicatat per bangunan. Tidak dipublikasikan.

Map: `lumenfall-kingdom-capital-stage03-v1`. Working Blender: `D:\lumenfall-penjaga-fajar\dev-prototypes\mahkota-fajar-stage03-v1\source\LUMENFALL_Stage03_Runtime_Working.blend`. Backup sebelum polish: `source/LUMENFALL_Stage03_PrePolish.blend`.

## Perubahan aset dan bangunan

Daftar objek lengkap dan fase perubahan: [polish-object-changes.json](../dev-prototypes/mahkota-fajar-stage03-v1/evidence/polish-object-changes.json). Stable IDs, district grouping, anchor dan arsitektur hybrid dipertahankan.

| Bangunan | Perubahan |
|---|---|
| Grand Hall | Portal berlapis, kolom/pinnacle, dormer, rose tracery dan trim kuningan ditambahkan. |
| Job Change Hall | Kubah kontinu dengan rusuk emas, lantern sejajar, cornice, portal/kolom, dan gable sayap dipulihkan. |
| Training Yard | Dummy berhelm/perisai, bekas latihan, rak dan shelter dipertahankan; stasiun lengkap dipertahankan pada LOD jauh. |
| Merchant | Penanda koin dan display; produce disesuaikan ke counter 1,1 unit; awning biru-putih/dormer dipertahankan. |
| Potion Shop | Penanda botol, botol biru di counter, herba dan kanopi membedakan toko. |
| Weapon Shop | Penanda pedang silang, rak dan display; tinggi pintu serta counter dikoreksi. |
| Armor Shop | Penanda perisai, breastplate/helm pada stand dan identitas fasad biru dipertegas. |
| Blacksmith | Open forge, ember bed, soot lintel, tool rack; anvil/workbench diskalakan, pelat cerobong salah posisi dihapus. |
| Storage / Bank | Portal batu/kuningan, buttress, dormer dan simbol koin memperkuat identitas bank. |
| Inn / Tavern | Kanopi linen, penanda mug, meja 0,9 dan kursi 0,55 unit; tableware tidak melayang lagi. |
| Residential A / B | Pintu, window box/bunga dan detail domestik diperbaiki; Residence B tidak dipindah. |
| Central Plaza / Quest Board | Patung patina, cincin biru/kuningan, riak air, notices dengan glyph dan seal pada ketinggian baca. |
| Warp Plaza | Kristal transparan/emissive terkendali, facet edges, inti, rune dan riser 0,1201 unit. |
| Wall / Island Edge | Batu berlapis dibulatkan, palet batu dipertahankan, warna/depth air dan pecahan foam; ring/gate tetap. |

Vegetasi: 70 tree placements memakai tiga modul (bulat, melebar, ramping), cabang/cluster daun baru; 362 shrub placements dipertahankan dengan modul clump yang disederhanakan. Sector instancing dan LOD 35/75 dipertahankan, shrub kecil cull 60. Arsitektur tidak ditutupi tambahan hutan.

Material: 6 keluarga bake lama dipertahankan; tambahan 2 permukaan warna procedural tiling 1K (terracotta, slate) memakai normal/ORM bersama. Eksperimen tekstur ground/rock dibatalkan setelah review top-down; palet baseline dipulihkan. Bukan bake AO unik per bangunan; AO lama/vertex-color tetap dan tidak diklaim sebagai bake final baru. Tidak memakai refraction mahal.

## Pengukuran dan preservasi

Sumber asli SHA256 tetap `30b57127d1c784b7121c0701563e0d337229e04f31841567580f005b1ebe05d7`. Collision GLB tetap `043d31c387b5725dbb062bf989ad70ba9112a52c71c0c83d1610e5e69366dee6`. Residence B bounds identik: **True**. Root scale [1, 1, 1]; player 2.4 unit; bounds {'minX': -123.43470001220703, 'maxX': 123.43470001220703, 'minZ': -124.99999237060547, 'maxZ': 125, 'pass': True}.

| Elemen | Hasil terukur |
|---|---|
| door | 5 contoh pintu tunggal; tinggi 3.050, lebar minimum 1.800. Lebar adalah projected XY span mesh, bukan sertifikasi bukaan interior. |
| counter | 5 contoh, tinggi 1.100–1.100 unit |
| table | 2 contoh, tinggi 0.900–0.900 unit |
| stairs | Grand Hall approach: 0.1342; Warp ring: 0.1201 |
| road | 9 jalur, pemisahan curb minimum 6.256 unit; batas curb bukan jaminan seluruh jalur bebas prop. |
| Service approach / interaksi | Minimum radius bebas di seluruh anchor 3.309; minimum lebar obstacle sepanjang 18 lintasan 5.084 unit. |
| Bukaan pagar Training | Jarak endpoint bagian rail terbuka 27.209 unit; lintasan masuk yang diuji memiliki lebar obstacle minimum 5.599. Bukan lebar seluruh court. |

Pintu bangunan tetap tertutup. Pengukuran adalah contoh representatif dan dimensi visual; tidak mengklaim setiap jendela/detail telah diukur. Rute Grand Hall memiliki lebar minimum sekitar 5,08 pada approach, memenuhi service access ≥3; target ≥6 diperiksa pada curb jalan utama.

## Visual sweep dan kamera

Diperbaiki: floating tableware/produce/tools, ukuran meja-counter-anvil, pintu rendah/sempit, UV kosong, zero-area triangles, duplikasi facet Warp, gable Job yang hilang, pusat dome/lantern, pelat cerobong salah posisi, perpotongan roof/wood dikurangi, dan LOD dummy yang semula meninggalkan helm/perisai.

Pemeriksaan mesh final: 0 masalah UV/nonfinite; 0 objek dengan triangle nol luas; 0 duplikasi mesh polish dalam group sama. Screenshot inspeksi mencakup depan/samping dan sudut jalan; tidak mengklaim inspeksi manual setiap polygon atau seluruh interior.

Kamera: 4608 sampel orbit, 0 penetrasi proxy pada sampel. Mencakup semua 12 massa bangunan, belakang Grand Hall, anchor, jalan toko, tembok timur/barat dan Warp. 2 titik di kompleks Job dilewati karena titik fokus/tanah tidak valid; sisi lain diuji. Recovery menjauh monoton: True; jarak akhir 8.87. Proxy atap konservatif dapat menarik kamera lebih dekat daripada geometri visual sebenarnya.

## Regresi dan performa

18 rute: **18/18 lulus**, seluruhnya dijalankan ulang setelah perubahan. Unit collision 6/6 lulus. Typecheck seluruh proyek `tsc --noEmit`: lulus. Kesalahan `position` pada `kingdom-pilot-scene.ts` adalah anotasi tipe lama yang tidak mencantumkan data yang sudah dihasilkan; diperbaiki tanpa perubahan perilaku.

| Metrik | Sebelum | Sesudah |
|---|---|---|
| p95 terburuk / rute | 17.60 ms | 17.70 ms |
| Rata-rata tertimbang frame | Tidak direkam | 16.66 ms |
| Draw calls traversal, termasuk shadow | 333 | 377 |
| Triangulasi traversal, primary | 587825 | 677222 |
| Triangulasi traversal + shadow | 988621 | 1128380 |
| Resident seluruh LOD | 778021 | 896580 |
| Material aktif | 20 | 23 |
| Memori tekstur estimasi RGBA+mip | 101.33 MiB | 112.00 MiB |
| Payload gzip + manifest | 24.22 MiB | 29.49 MiB |

Perangkat: ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560) Direct3D11 vs_5_0 ps_5_0, D3D11); Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36; viewport 1920×1080, DPR 1. Frame time adalah interval RAF end-to-end saat traversal, bukan GPU timestamp. p95 dilaporkan sebagai p95 terburuk per rute, bukan p95 gabungan. Pengukuran ini lokal, bukan jaminan perangkat lain.

Maksimum dari 19 view review: 464 draw calls termasuk shadow.

| Rute | Arah | Jarak | Waktu jalan | Min. lebar | Avg / p95 ms | Draw calls |
|---|---|---:|---:|---:|---:|---:|
| Central ↔ warp | pergi | 46.96 | 6.26 s | 6.80 | 16.66 / 17.60 | 358 |
| Central ↔ warp | kembali | 46.96 | 6.26 s | 6.69 | 16.64 / 17.50 | 358 |
| Central ↔ guild | pergi | 83.70 | 11.18 s | 5.08 | 16.66 / 17.30 | 253 |
| Central ↔ guild | kembali | 83.69 | 11.17 s | 5.08 | 16.65 / 17.50 | 253 |
| Central ↔ merchant | pergi | 88.34 | 11.78 s | 6.77 | 16.66 / 17.70 | 272 |
| Central ↔ merchant | kembali | 88.32 | 11.78 s | 6.74 | 16.66 / 17.40 | 272 |
| Central ↔ training | pergi | 82.36 | 11.00 s | 5.60 | 16.66 / 17.40 | 273 |
| Central ↔ training | kembali | 82.36 | 11.00 s | 5.60 | 16.67 / 17.60 | 273 |
| Central ↔ job | pergi | 71.90 | 9.60 s | 6.62 | 16.66 / 17.50 | 239 |
| Central ↔ job | kembali | 71.89 | 9.60 s | 6.62 | 16.66 / 17.50 | 239 |
| Central ↔ forge | pergi | 63.21 | 8.43 s | 6.77 | 16.66 / 17.40 | 279 |
| Central ↔ forge | kembali | 63.21 | 8.43 s | 6.73 | 16.66 / 17.30 | 279 |
| Central ↔ bank | pergi | 78.90 | 10.53 s | 6.73 | 16.66 / 17.40 | 309 |
| Central ↔ bank | kembali | 78.90 | 10.53 s | 6.77 | 16.66 / 17.60 | 309 |
| Central ↔ inn | pergi | 91.39 | 12.20 s | 6.82 | 16.66 / 17.40 | 377 |
| Central ↔ inn | kembali | 91.39 | 12.20 s | 6.84 | 16.66 / 17.40 | 377 |
| Central ↔ residential | pergi | 91.14 | 12.16 s | 6.70 | 16.66 / 17.40 | 366 |
| Central ↔ residential | kembali | 91.13 | 12.15 s | 6.70 | 16.66 / 17.70 | 366 |

Gate/boundary/ramp/recovery/roof-ground separation/keyboard/spawn: `{'spawn': True, 'boundaryBlocked': True, 'gateBlocked': True, 'stairRamp': True, 'roofExcluded': True, 'recovered': True, 'cameraCollision': True, 'keyboardMovement': True}`. Error UI: True; Retry: True. Reload 3×: root children [274, 274, 274], canvas [1, 1, 1], renderer memory [{'geometries': 211, 'textures': 15}, {'geometries': 211, 'textures': 15}, {'geometries': 211, 'textures': 15}]. Stabilitas ini bukan pembuktian heap leak semua browser.

## Perbandingan dan deviasi tersisa

[Galeri reference vs final in-game](../dev-prototypes/mahkota-fajar-stage03-v1/evidence/polish-comparison.html) memuat 14 view wajib, tambahan Potion/Weapon/Armor/Central/player, baseline bila tersedia, dan evaluasi silhouette, roof, facade, portal, windows, trim, material, color, proportion, environment.

- **Grand Hall:** Siluet lebih tinggi dan berat daripada referensi; atap pusat masih satu massa dominan. Fasad batu terlalu seragam, jendela hijau datar, ukiran dan kedalaman portal belum sehalus target. Proporsi footprint lama dipertahankan; lanskap depan lebih jarang.
- **Job Change Hall:** Kubah dan lantern lebih sederhana; ritme jendela lurus, relief portal dan trim lebih sedikit. Material batu lebih homogen, biru lebih gelap, sayap lebih kaku; taman belum selapis referensi.
- **Training Yard:** Siluet pagar/pintu dan shelter lebih geometris; kayu/atap belum memiliki keausan target. Lapangan terasa lebih kosong dan bukaan pagar lebih lebar. Tidak ada fasad/jendela tertutup untuk dibandingkan.
- **Merchant:** Massa tiga tingkat lebih tinggi daripada toko kompak referensi. Atap/awning lebih lurus, fasad dan portal kurang kaya, jendela datar dan trim minim; kayu terlalu teratur, isi pasar dan taman lebih jarang.
- **Potion Shop:** Atap merah dan bentuk silang cocok secara identitas; massa masih lebih tinggi. Fasad/portal, bingkai jendela dan trim sederhana, kanopi pucat, botol kurang beragam; rak dan lanskap lebih jarang.
- **Weapon Shop:** Siluet masih rumah tiga tingkat dengan atap pelana sederhana. Portal/overhang, jendela dan trim belum serinci referensi; warna merah-kayu cocok tetapi material bersih. Tampilan senjata kecil pada pandangan jauh dan halaman lapang.
- **Armor Shop:** Gable, portal dan trim emas belum seornamental referensi. Fasad/jendela tetap sederhana, armor lebih gelap; proporsi massa lebih tinggi, halaman/taman lebih kosong. Atap biru mempertahankan palet tetapi detail masih berulang.
- **Blacksmith:** Cerobong masih terlalu dominan/kotak. Atap, portal tungku, bukaan dan struktur kayu lebih sederhana; emissive lebih terang dan kurang volumetrik. Material jelaga/metal, trim, keausan tanah dan kepadatan alat belum setara; jendela bukan fokus struktur terbuka.
- **Storage / Bank:** Siluet lebih tinggi/kaku; gable depan, fasad, portal dan jendela belum memiliki relief target. Trim emas lebih sedikit, batu homogen dan biru lebih gelap. Struktur samping berupa kanopi sederhana; halaman lebih luas/kosong.
- **Inn / Tavern:** Massa dua tingkat lebih besar daripada referensi. Atap, fasad/portal, jendela dan trim masih berpola sederhana; warna kayu/terracotta sesuai keluarga tetapi detail hangat kurang. Seating persegi belum menyerupai meja-payung bundar dan taman lebih jarang.
- **Residential A / B:** Siluet dan atap tetap lebih tegak/geometris; fasad timber, portal, jendela serta trim lebih sederhana. Material bersih, warna merah/terracotta sesuai tetapi kebun dan pagar domestik belum sekaya target. Proporsi rumah tetap mengikuti fondasi yang disetujui.
- **Central Plaza / Quest Board:** Patung lebih kaku dan besar secara visual; air/pancuran belum lembut seperti referensi. Komposisi ring dan jalur tetap, planter lebih geometris. Quest frame/kanopi/jendela tidak relevan sebagai bangunan; detail papan masih simbol tanpa teks gameplay final.
- **Warp Plaza:** Kristal masih prisma memanjang; glow tidak memakai bloom/refraction. Pedestal/ring lebih sederhana, batu dan trim kurang halus, vegetasi/banner lebih jarang. Portal perjalanan belum diaktifkan sesuai scope; fasad/jendela tidak berlaku.
- **Wall / Island Edge:** Tebing masih berundak/geometris dibanding batu organik referensi. Air statis dan foam berupa strip; menara/cap, relief tembok dan trim lebih sederhana. Tidak ada vegetasi rimbun di luar; lingkungan tetap dibatasi 250×250.

Batas visual yang masih terlihat: transisi strip pada beberapa atap/LOD, material berulang, taman rendah/jarang, air tanpa animasi arus, dan tebing belum organik. Tidak mengklaim reference fidelity penuh atau hasil siap produksi.

## Berkas dan cara menjalankan

Berkas runtime diperbarui: `tests/browser/mahkota-fajar-stage03-scene.ts`, `mahkota-fajar-stage03.ts`, `mahkota-fajar-stage03.html`; perbaikan tipe: `tests/browser/kingdom-pilot-scene.ts`. Script baru: `inspect-stage03-polish.py`, `polish-stage03-candidate.py`, `measure-stage03-polish.py`, `update-stage03-camera-wall.py`, `visual-stage03-polish.mjs`, `report-stage03-polish.py`. Script regresi `test-stage03-browser.mjs` ditambah average frame time. `lib/game/world.ts` dan production map tidak diubah.

Aset lokal: `source/*Runtime_Working.blend`, `assets/manifest.json`, affected raw GLB dan `assets/runtime/*.glb.gz`, dua color textures aktif baru. Struktur hybrid tetap shell + 8 district/LOD + 8 wall sectors + reusable modules + collision; manifest menyimpan placements, anchors, blockers, cameraVolumes/cameraWall, material/textures dan polish log. Folder development tetap diabaikan Git, bukan paket publish.

Dari root repository:

```powershell
node node_modules/vite/bin/vite.js --config tests/browser/mahkota-fajar-stage03.vite.config.ts
```

Buka http://127.0.0.1:3013/tests/browser/mahkota-fajar-stage03.html . Tunggu status DEVELOPMENT CANDIDATE. Pilih WASD Player untuk berjalan; tombol view untuk review; F8 untuk Map Review. Bila ERROR, tekan Retry setelah penyebab asset diperbaiki. Tidak perlu mengganti map produksi.

Jangan jalankan ulang initial build/rescale untuk melihat kandidat ini. Pipeline polish bekerja pada turunan; beberapa koreksi in-place merupakan langkah migrasi satu kali, bukan resep rekonstruksi yang idempotent dari sembarang fase. Backup pre-polish tersedia untuk reproduksi berurutan.

Catatan review tambahan: bidang paving/terrain berbentuk segitiga masih terbaca pada top-down. Ini deviasi visual yang belum dirapikan, bukan klaim fidelity selesai penuh. `render-stage03-comparison.py` juga diperbarui dengan `--assemble-only` untuk merakit preview placement dalam working Blender; preview instances dikecualikan dari ekspor runtime.
