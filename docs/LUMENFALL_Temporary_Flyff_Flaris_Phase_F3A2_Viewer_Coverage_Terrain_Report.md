# LUMENFALL — Phase F3-A2
## Viewer Validation, Object Coverage Expansion & Terrain Material Resolution

> Koreksi F3-A3 (20 September 2026): bagian transform dan penilaian visual di laporan ini telah digantikan oleh `LUMENFALL_Temporary_Flyff_Flaris_Phase_F3A3_Rendering_Fidelity_Report.md`. Posisi objek LND X/Z harus dikalikan 4; mesh O3D tidak. Height flags harus didekode. ID 1926 adalah prop pagar pendek, ID 28 lampu jalan. Jangan memakai bagian 2–3 laporan ini sebagai kontrak rendering. Angka coverage bukan bukti fidelity.

Tanggal: 20 September 2026  
Sumber: `D:\FlyffUS`  
Mode: development-only, read-only terhadap file Flyff

## Ringkasan owner

Viewer sekarang benar-benar berjalan melalui Vite pada:

`http://127.0.0.1:3002/flaris-fidelity.html`

Headed browser menampilkan terrain tile `WdMadrigal13-06`, tujuh material terrain dari DDS archive, tiga O3D proof, serta collision overlay debug. Screenshot headed berhasil diambil; panel viewer menampilkan `3 O3D + textured terrain rendered`.

Coverage model naik signifikan setelah seluruh archive model normal yang relevan dipindai dan hanya O3D yang cocok dengan catalog Flaris diekstrak:

- Unique coverage: **376/391 = 96,16%**.
- Placement coverage: **14.890/15.039 = 99,01%**.
- Unresolved: **15 index / 149 placement**.
- Tidak ada unresolved high-frequency object pada 10 prioritas utama.

Gate coverage 95% tercapai. Namun F3-B full reconstruction belum dimulai karena beberapa proof object belum memberikan fidelity visual yang bersih dan material blending terrain masih berbasis patch, bukan lightmap/splat blending penuh.

## 1. Viewer Vite

Entry dev-only:

- [flaris-fidelity.html](../tests/browser/flaris-fidelity.html)
- [flaris-fidelity.tsx](../tests/browser/flaris-fidelity.tsx)
- [flaris-fidelity.css](../tests/browser/flaris-fidelity.css)
- Vite config: [vite.config.ts](../tests/browser/vite.config.ts)

Viewer memakai bundling Vite normal untuk Three.js dan `DDSLoader`. Route static lama `public/dev-imports/.../f3a-viewer.html` tidak lagi dipakai sebagai validasi utama.

Fitur proof:

- height mesh 129×129.
- tujuh terrain material DDS.
- layer enable mask 16×16 dari `.lnd`.
- object placement asli.
- O3D mesh dan material asli.
- embedded collision overlay berwarna kuning.
- object bounding-box debug overlay.

## 2. Koreksi transform penting

Validasi headed menemukan bahwa posisi object record `.lnd` untuk tile lokal sudah berada pada satuan lokal tile. Karena itu viewer Vite menggunakan:

```text
objectX = placement.pos[0]
objectY = placement.pos[1]
objectZ = placement.pos[2]
rotationY = angle × π / 180
scale = placement.scale
```

Faktor `×4` hanya berlaku pada konversi grid vertex/terrain spacing dan formula global tile, bukan untuk mengalikan ulang posisi lokal object.

Pengecekan terrain-vs-object pada tiga record:

- index 1926: delta Y sekitar `0`.
- index 20: delta Y sekitar `-0,049` unit.
- index 28: delta Y sekitar `0`.

## 3. Three-object gate

| Object | O3D/material | Collision | Hasil visual |
|---|---|---|---|
| 1926 `NewFlGDRL_01_01` | berhasil, DDS DXT1 | berhasil, 18 VB / 30 IB | **MINOR TRANSFORM / ASSET-ID ISSUE**; mesh sangat kecil dibanding label struktur besar, perlu konfirmasi semantik model sebelum F3-B |
| 20 `MaCoPrTr01` | berhasil, DDS DXT1 512×512 | berhasil, 25 VB / 60 IB | **PASS**; terlihat berdiri pada terrain dengan transform asli |
| 28 `MaFlPrLa01` | berhasil, DDS DXT1 | berhasil, 32 VB / 78 IB | **MINOR TRANSFORM ISSUE**; placement/asset terbaca, tetapi prop kecil sulit dibedakan dari terrain pada sudut proof |

Ketiga parser menghasilkan EOF `remaining = 0`. Tidak ada model yang diposisikan manual.

## 4. Terrain texture resolution

`Terrain.inc` menjadi source of truth ID→filename. Tujuh texture tile `13-06` berhasil ditemukan dan diekstrak normal dari:

- `D:\FlyffUS\World\Texture\wtex_d.res`
- `D:\FlyffUS\World\Texture\wtex_g.res`
- `D:\FlyffUS\World\Texture\wtex_r.res`
- `D:\FlyffUS\World\Texture\wtex_u.res`
- `D:\FlyffUS\World\Texture\wtex_o.res`
- `D:\FlyffUS\World\Texture\wtex_n.res`

| Texture | Status | Format |
|---|---|---|
| `default.dds` | extracted | 256×256, DXT1 |
| `ground_precipice01.dds` | extracted | 256×256, DXT1 |
| `rock10M.dds` | extracted | 128×128, DXT1 |
| `rock12M.dds` | extracted | 128×128, DXT1 |
| `Upresia_Ground01.dds` | extracted | 512×512, DXT1 |
| `Obj_FLGR01.dds` | extracted | 512×512, DXT1 |
| `NewFlrock01.dds` | extracted | 256×256, DXT1 |

Hasil terrain visual: **berhasil dirender**, dengan catatan implementasi proof memakai material terpilih per patch berdasarkan enable mask `.lnd`. Blending lightmap/splat pixel-level belum direkonstruksi penuh.

Output: `dev-imports/flyff-flaris/terrain-textures/` dan `tests/browser/f3a-assets/`.

## 5. Coverage expansion

Script extraction: [f3a_extract_catalog_models.cjs](../dev-imports/flyff-flaris/f3a_extract_catalog_models.cjs)  
Manifest: `dev-imports/flyff-flaris/extracted-models/extraction-manifest.json`

Hasil scan normal terhadap 138 archive model:

- O3D diekstrak terarah: 293.
- Total model path valid setelah digabung dengan standalone/extraction sebelumnya: 376.
- Unique model texture names pada resolved O3D: 382.
- Sebagian texture object masih perlu extraction terarah lanjutan; tiga proof texture sudah tersedia dan berhasil dimuat.

Prioritas wajib:

| Index | Count | Hasil |
|---:|---:|---|
| 52 | 1.875 | resolved |
| 47 | 1.312 | resolved |
| 1926 | 912 | resolved |
| 21 | 542 | resolved |
| 205 | 488 | resolved |
| 43 | 487 | resolved |
| 20 | 446 | resolved |
| 51 | 431 | resolved |
| 204 | 373 | resolved |
| 54 | 369 | resolved |

Unresolved tersisa:

`517 magiclight (36)`, `519 clouds04 (29)`, `575 fire01 (17)`, `722 pkdudkroprwharf02 (16)`, `544 riverred01 (14)`, `635 enterdungeon (8)`, `515 clouds02 (6)`, `701 magiczone (6)`, `514 clouds01 (4)`, `525 skylight03 (3)`, `577 fire03 (3)`, `516 clouds03 (2)`, `524 skylight (2)`, `569 skylight01 (2)`, `605 thunder01 (1)`.

Index 204 `MaCoPrRo12` berhasil ditemukan dan masuk coverage.

## 6. Inventory dan collision

- Unique O3D yang dibutuhkan Flaris dan sudah ter-resolve: 376.
- Unique DDS object names yang terdeteksi dari resolved O3D: 382.
- Terrain DDS proof: 7/7.
- Collision proof: 3/3 memiliki embedded collision.
- Collision overlay menggunakan parent transform yang sama dengan mesh, sehingga tidak ada transform kedua yang berbeda.

## 7. Safety

- `D:\FlyffUS` tidak diubah.
- Tidak ada full client unpack.
- Tidak ada NPC, monster, quest, item, audio, atau gameplay import.
- Tidak ada production map change.
- Tidak ada DRM/protection bypass.
- F3-B full reconstruction belum dijalankan.

## 8. Keputusan F3-B

Coverage gate numerik sudah tercapai, tetapi rekomendasi tetap **tunda F3-B** sampai dua hal dibereskan:

1. Konfirmasi identitas visual index 1926 karena bounding box O3D menunjukkan mesh kecil dan bukan struktur besar yang jelas pada proof camera.
2. Tingkatkan terrain dari patch-selected material menjadi blending yang menggunakan data lightmap/splat jika targetnya fidelity asli.

Setelah dua poin ini dikonfirmasi, F3-B dapat dimulai secara terisolasi dengan 49 tile, tanpa gameplay import.
