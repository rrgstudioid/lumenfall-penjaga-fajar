# LUMENFALL Stage03 — implementation and local validation

Development candidate: `lumenfall-kingdom-capital-stage03-v1`. Menggunakan Game, player, movement, animasi, dan kamera proyek yang sama. Bukan pengganti map produksi; tidak dipublikasikan. Kandidat playable tersedia, tetapi kesetaraan artistik penuh dengan ilustrasi referensi **belum dapat dinyatakan lulus**.

## Jalankan

```powershell
node node_modules/vite/bin/vite.js --config tests/browser/mahkota-fajar-stage03.vite.config.ts
```

Buka http://127.0.0.1:3013/tests/browser/mahkota-fajar-stage03.html . WASD untuk bergerak, tombol pandangan untuk inspeksi, F8 untuk Map Review Mode. Loading menahan pembuatan Game sampai ground/collision dan aset selesai; kegagalan menampilkan ERROR dan Retry. Fixture dibatasi localhost dan mode development.

## Sumber dan file

Source asli: `C:\Users\GG\Desktop\Lumenfall\Blender_Output\Stage03_Final_World\LUMENFALL_Stage03_Final_World.blend`.
SHA256 awal dan verifikasi akhir sama: `30B57127D1C784B7121C0701563E0D337229E04F31841567580F005B1EBE05D7`.
Working Blender: `dev-prototypes/mahkota-fajar-stage03-v1/source/LUMENFALL_Stage03_Runtime_Working.blend`.
Salinan sumber tak diubah: `source/LUMENFALL_Stage03_Working.blend` dalam folder kandidat.
Tidak ada file produksi lama yang diubah dalam implementasi ini. File baru:

- `docs/LUMENFALL-Stage03-Implementation.md`
- `lib/game/stage03-collision.test.ts`
- `lib/game/stage03-collision.ts`
- `scripts/bake-stage03-materials.py`
- `scripts/build-stage03-candidate.py`
- `scripts/finalize-stage03-assets.py`
- `scripts/package-stage03-runtime.py`
- `scripts/render-stage03-comparison.py`
- `scripts/report-stage03.py`
- `scripts/test-stage03-browser.mjs`
- `tests/browser/mahkota-fajar-stage03-scene.ts`
- `tests/browser/mahkota-fajar-stage03.html`
- `tests/browser/mahkota-fajar-stage03.ts`
- `tests/browser/mahkota-fajar-stage03.vite.config.ts`

Aset besar, Blender, dan bukti lokal berada di `dev-prototypes/mahkota-fajar-stage03-v1/` yang diabaikan Git. Keberadaan lokal tidak berarti aset tersimpan di commit/remote.

## Pipeline dan struktur ekspor

Urutan reproduksi: source working copy → `build-stage03-candidate.py` → `bake-stage03-materials.py` (source working copy; sekali untuk cache tekstur) → `finalize-stage03-assets.py` (runtime working) → `package-stage03-runtime.py` → browser QA → `render-stage03-comparison.py` → laporan ini. Jalankan skrip Blender dengan `--background --disable-autoexec <working.blend> --python <script>`. Build ulang terlebih dahulu sebelum finalizer/render diulang; preview placement bukan input ekspor.

`assets/manifest.json` memuat mapId, bounds, transform, chunks+LODs, modules, placements, collision, blockers, boundary, anchors, records, changes, materialFamilies, textures, hash sumber, dan daftar file payload. Anchor: `{id, kind, position:[x,y,z], facing, radius}`. Arrival warp terpisah dari pedestal; tidak ada sistem perjalanan produksi atau NPC otomatis.

`assets/runtime/*.glb.gz`: shell ground/roads/island, delapan distrik, delapan sektor tembok, modul tree/shrub/tower, collision. LOD distrik pada 35/75 unit; vegetation per sektor dan prop kecil cull 60. GLB mentah hanya staging. Server mengirim `Content-Encoding: gzip`; GLTFLoader menerima GLB terdekompresi standar.

`assets/textures/`: enam keluarga permukaan dengan color+normal, shared ORM. Stone/paving color 2K, sisanya 1K; normal 1K. UV planar tiling. Color/normal berasal dari bake shader sumber dengan detail tiling; AO lokal tersimpan sebagai vertex color (3 ray/vertex), bukan bake GI penuh. ORM menggunakan roughness konstan, metalness nol untuk keluarga nonlogam; logam tetap parameter material. Glass/water tanpa refraction.

Transform dibakar ke vertex: uniform 250/559, pusat horizontal Blender (0,-3.5), glTF Z-up→Y-up. Root scale runtime 1. Player tetap 2.4. Stable source IDs disimpan sebelum batching. Residence B tetap pada footprint source; tidak dikembalikan ke posisi lama.

## Angka terukur

| Ukuran | Hasil |
|---|---:|
| Resident geometry lintas near/LOD/module (unik; bukan instance-expanded) | 778,021 triangles |
| Peak primary-pass triangles selama traversal (termasuk player) | 587,825 |
| Peak triangles termasuk shadow pass | 988,621 |
| Peak draw calls termasuk shadow selama traversal | 333 |
| Material map aktif | 20 |
| Estimasi texture residency RGBA8+mipmaps | 101.33 MiB |
| Payload transport + manifest | 25,394,818 bytes / 24.22 MiB |
| GLB decoded, tidak termasuk PNG | 69,172,628 bytes |
| File runtime + manifest | 51 |
| P95 frame terburuk dari 18 rute | 17.60 ms |

Texture memory adalah estimasi dari dimensi/format, bukan pembacaan VRAM driver. Frame time diukur interval requestAnimationFrame pada traversal aktual; termasuk overhead collision/QA, bukan GPU timestamp. Tidak menjamin perangkat lain.

Perangkat/browser: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560) Direct3D11 vs_5_0 ps_5_0, D3D11)`; `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`; 1920×1080 DPR 1, 16 logical cores.

## Rute dua arah

Semua rute memakai Game.move dan collision asli kandidat. Path otomatis mencari lintasan bebas; bukan penilaian rasa kontrol manusia. Lebar di bawah adalah diameter ruang bebas terhadap blocker di sepanjang path, bukan survei seluruh lebar setiap ruas jalan.

| Rute dari/ke Central | Arah | Jarak | Waktu jalan | Min clear diameter | P95 ms | Lulus |
|---|---|---:|---:|---:|---:|---|
| warp | pergi | 46.96 | 6.26s | 6.77 | 17.60 | True |
| warp | kembali | 46.96 | 6.26s | 6.71 | 17.40 | True |
| guild | pergi | 83.70 | 11.18s | 5.08 | 17.40 | True |
| guild | kembali | 83.70 | 11.18s | 5.08 | 17.40 | True |
| merchant | pergi | 88.33 | 11.78s | 6.76 | 17.30 | True |
| merchant | kembali | 88.32 | 11.77s | 6.71 | 17.30 | True |
| training | pergi | 82.36 | 11.00s | 5.60 | 17.40 | True |
| training | kembali | 82.36 | 11.00s | 5.60 | 17.30 | True |
| job | pergi | 71.90 | 9.60s | 6.62 | 17.40 | True |
| job | kembali | 71.90 | 9.60s | 6.62 | 17.30 | True |
| forge | pergi | 63.21 | 8.43s | 6.76 | 17.30 | True |
| forge | kembali | 63.20 | 8.42s | 6.69 | 17.40 | True |
| bank | pergi | 78.90 | 10.53s | 6.76 | 17.30 | True |
| bank | kembali | 78.89 | 10.52s | 6.69 | 17.30 | True |
| inn | pergi | 91.39 | 12.20s | 6.82 | 17.30 | True |
| inn | kembali | 91.39 | 12.19s | 6.78 | 17.30 | True |
| residential | pergi | 91.16 | 12.16s | 6.70 | 17.20 | True |
| residential | kembali | 91.16 | 12.16s | 6.70 | 17.30 | True |

## Validasi dan batas bukti

- `bounds`: `{"minX": -123.43470001220703, "maxX": 123.43470001220703, "minZ": -124.99999237060547, "maxZ": 125, "pass": true}`.
- `rootScale`: `[1, 1, 1]`.
- `spawn`: `true`.
- `boundaryBlocked`: `true`.
- `gateBlocked`: `true`.
- `stairRamp`: `true`.
- `roofExcluded`: `true`.
- `recovered`: `true`.
- `cameraCollision`: `true`.
- `playerHeight`: `2.4`.
- `keyboardMovement`: `true`.
- Error/retry: errorDisplayed=True, retryPassed=True; page errors=[].
- Tiga reload: [(242, 1, {'geometries': 184, 'textures': 12}), (242, 1, {'geometries': 184, 'textures': 12}), (242, 1, {'geometries': 184, 'textures': 12})]. Stabilitas hitungan mendukung tidak ada duplikasi pada tiga siklus; bukan bukti heap leak jangka panjang.
- Enam unit test collision lulus: tunneling, sliding diagonal, invalid recovery, radius boundary, rentang tinggi, clearance lintas grid.
- Fixture Vite build dan lint file baru lulus. Type-check seluruh repo masih gagal pada error existing `tests/browser/kingdom-pilot-scene.ts:89` (property position); bukan dinyatakan lulus.
- Spawn, root scale, world bounds, ramp Grand Hall, gate/boundary, roof exclusion, serta satu camera proxy utama diuji otomatis. Semua posisi kamera pada semua gedung belum diuji exhaustif.
- Route screenshots dan perbandingan tersedia; seluruh detail kecil/floating geometry di seluruh kota belum dapat disertifikasi dari sampel pandangan.
- Target clearance pintu/prop diterapkan lewat catatan perubahan manifest. Pengukuran ulang seluruh pintu, counter, meja, riser dan ruas jalan belum exhaustif; tidak ditandai lulus global.

## Bug yang ditemukan dan diperbaiki

- Decimation pada paving, genteng dan ashlar terpisah menghasilkan lubang: diganti permukaan plaza, envelope atap per klaster, dan skin tembok; structural LOD dipertahankan.
- Batching awal salah membaca material index dan warna AO ternormalisasi: koreksi assignment dan pembacaan attribute.
- Renderer.info default mengabaikan shadow pass: counter frame eksplisit dan pemisahan primary/shadow.
- Ground visual tidak dipakai sebagai collider; collision ground/ramp dan blocker terpisah, invalid position pulih ke spawn tervalidasi.

## Deviasi visual yang masih perlu review

- Siluet kota, zona, warna, pintu dan landmark mengikuti Stage03+blueprint, tetapi vegetasi masih modul sederhana; kepadatan/variasi foliage dan detailing organik belum setara ilustrasi.
- Detail portal, jendela, trim, prop dan material di beberapa landmark masih lebih sederhana daripada referensi. Peningkatan fasad telah dilakukan, tetapi klaim semua gedung lebih mirip referensi memerlukan review artistik per gedung.
- Island edge memakai kontur sumber yang disederhanakan; komposisi cliff/water belum menyamai kedalaman dan detail referensi.
- Sebagian repeated props dibatch per district, belum seluruhnya berupa instance reusable. LOD structural dipertahankan untuk mencegah holes, sehingga pengurangan geometri near/far tidak seragam.
- Tidak ada NPC final, quest/combat/service baru, networking, atau Warp production travel.

## Gambar dan bukti

[Galeri blueprint / working Blender / in-game](../dev-prototypes/mahkota-fajar-stage03-v1/evidence/comparison.html).
[JSON hasil browser](../dev-prototypes/mahkota-fajar-stage03-v1/evidence/final-browser.json).
[Manifest](../dev-prototypes/mahkota-fajar-stage03-v1/assets/manifest.json).
[Working Blender](../dev-prototypes/mahkota-fajar-stage03-v1/source/LUMENFALL_Stage03_Runtime_Working.blend).
