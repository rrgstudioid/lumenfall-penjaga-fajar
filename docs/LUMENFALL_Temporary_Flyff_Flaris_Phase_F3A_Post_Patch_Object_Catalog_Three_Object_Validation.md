# LUMENFALL — Phase F3-A
## Post-patch Object Catalog Extraction & Three-Object Fidelity Validation

Tanggal audit: 20 September 2026  
Sumber: `D:\FlyffUS` (`D:\FlyffUS\_F3_Snapshot` tidak tersedia)

## Ringkasan

Patch tidak mematahkan parser terrain. Semua 49 tile Flaris tetap valid. Catalog object lokal ditemukan normal di `D:\FlyffUS\data.res`, terutama `mdlObj.inc`; beberapa O3D frekuensi tinggi berada di `D:\FlyffUS\Model\obj_MaCo.res`.

Object index **1926** berhasil di-resolve sebagai `NewFlGDRL_01_01` → `Obj_NewFlGDRL_01_01.o3d`, dengan 912 placement. Tiga objek proof yang dipilih:

| Peran | Index | Model | Tile/ordinal |
|---|---:|---|---|
| Struktur besar | 1926 | `Obj_NewFlGDRL_01_01.o3d` | `13-06` / 0 |
| Tree | 20 | `Obj_MaCoPrTr01.o3d` | `13-06` / 17 |
| Prop flora | 28 | `Obj_MaFlPrLa01.o3d` | `13-06` / 1762 |

Parser dan exporter membaca ketiga O3D, texture DDS, transform, dan embedded collision. Namun static ES-module viewer tidak mulai mengeksekusi pada headed browser lokal, sehingga screenshot 3D belum dapat dinyatakan PASS. Ini blocker penyajian viewer, bukan parser/model proof.

**F3-B belum aman dimulai:** 271 unique index / 6.253 placement masih belum memiliki model ter-resolve dan terrain texture belum tervalidasi visual.

## 1. Baseline post-patch

| Item | Hasil |
|---|---:|
| Total file instalasi | 37.016 |
| `World\\WdMadrigal\\*.lnd` | 900 |
| `World\\WdMadrigal\\*.res` | 58 |
| `Model\\*.o3d` | 6.722 |
| File texture di `Model\\Texture` | 7.532 |

| File | SHA-256 terbaru | Status vs F2.5 |
|---|---|---|
| `WdMadrigal13-06.lnd` | `4437BA8093935017912F9453B209B5ADE6E08926AC9F04A3825D4FDE340CCF68` | UPDATED |
| `Obj_MaCoPrTr01.o3d` | `2C9CC37838AE810935D504969EFC990706A4154AE8BD1D8096409E5FCCBE907F` | UNCHANGED |
| `Obj_MaCoPrTr01_new.dds` | `1FF524D669CD9F8F99844DA8D20D7F2F8714D530620107D7FD4F85B12C641103` | UNCHANGED |

## 2. Tile revalidation

Range X `10..16`, Y `03..09`:

- 49/49 file ada dan berhasil diparse.
- Semua version `3`.
- EOF alignment: sisa byte `0` setelah object dan SFX records.
- Total object placement: **15.039**.
- Total SFX records: **129**.
- Tile `13-06` sekarang memuat 2.458 object placement.

Script: [f3a_tile_recheck.cjs](../dev-imports/flyff-flaris/f3a_tile_recheck.cjs)

## 3. Catalog dan coverage

Sumber catalog:

- `D:\FlyffUS\data.res` → `mdlObj.inc`, `propObj.csv`, `Terrain.inc`.
- `D:\FlyffUS\Model\obj_MaCo.res` → O3D yang diekstrak normal untuk proof catalog.

Output: [flyffus-object-catalog.json](../dev-imports/flyff-flaris/catalog/flyffus-object-catalog.json)

- Unique index: **391**.
- Model ter-resolve: **120/391 = 30,69%**.
- Placement ter-resolve: **8.786/15.039 = 58,42%**.
- Unresolved: **271 index**, **6.253 placement**.

Model frekuensi tinggi `MaCoPrGr07`, `MaCoPrRo04`, `MaCoPrMu03`, `MaCoPrRo12`, dan `MaCoPrGr07-02` terbukti berada di `obj_MaCo.res`; coverage naik dari 29,43% menjadi 58,42% placement.

| Index | Count | Definition | Status |
|---:|---:|---|---|
| 52 | 1.875 | `MaCoPrGr07` | resolved dari `obj_MaCo.res` |
| 47 | 1.312 | `MaCoPrRo04` | resolved dari `obj_MaCo.res` |
| 1926 | 912 | `NewFlGDRL_01_01` | resolved standalone |
| 21 | 542 | `MaCoPrTr02` | resolved standalone |
| 205 | 488 | `MaCoPrRo13` | resolved standalone |
| 43 | 487 | `MaCoPrTr03` | resolved standalone |
| 20 | 446 | `MaCoPrTr01` | resolved standalone |
| 51 | 431 | `MaCoPrMu03` | resolved dari `obj_MaCo.res` |
| 204 | 373 | `MaCoPrRo12` | unresolved |
| 54 | 369 | `MaCoPrGr07-02` | resolved dari `obj_MaCo.res` |

## 4. Tiga objek dan parsing O3D

### Struktur besar — index 1926

Placement asli: angle `106.66143035888672`, pos `[89.7996826171875,100,46.959716796875]`, scale `[1,1,1]`.

- O3D v22; 79 vertices / 162 indices / 54 triangles.
- Texture `Obj_NewFlGDRL_01.dds`, 256×256, DXT1, 9 mipmaps.
- Collision embedded: 18 vertices / 30 indices.

### Tree — index 20

Placement asli: angle `173`, pos `[127.841064453125,100.39566040039062,74.33819580078125]`, scale `[1.065000057220459,1.065000057220459,1.065000057220459]`.

- O3D v22; 466 vertices / 1.374 indices / 458 triangles.
- Texture `Obj_MaCoPrTr01_new.dds`, 512×512, DXT1, 10 mipmaps.
- Collision embedded: 25 vertices / 60 indices.

### Prop flora — index 28

Placement asli: angle `272`, pos `[98.727783203125,99.69979858398438,42.19677734375]`, scale `[1.1100000143051147,1.1100000143051147,1.1100000143051147]`.

- O3D v22; 179 vertices / 402 indices / 134 triangles.
- Texture `Obj_MaFlPrLa_new.dds`, 256×256, DXT1, 9 mipmaps.
- Collision embedded: 32 vertices / 78 indices.

Semua parser output memiliki `remaining = 0`. Output ada di `dev-imports/flyff-flaris/three-object-proof/` dan asset viewer di `public/dev-imports/flyff-flaris/f3a/`.

## 5. Terrain material

Tile `13-06` memakai layer ID `0, 19, 13, 17, 254, 246, 255`. `Terrain.inc` memetakan:

| ID | Nama |
|---:|---|
| 0 | `default.dds` |
| 13 | `ground_precipice01.dds` |
| 17 | `rock10M.dds` |
| 19 | `rock12M.dds` |
| 246 | `Upresia_Ground01.dds` |
| 254 | `Obj_FLGR01.dds` |
| 255 | `NewFlrock01.dds` |

File texture terrain tersebut belum ditemukan sebagai standalone file atau entry yang cocok pada inventory yang sudah diperiksa. Status: **PARTIAL / UNRESOLVED**.

## 6. Coordinate dan collision

Kontrak F2.5 yang dipakai ulang:

`threeX = flyffX × 4`, `threeY = flyffY`, `threeZ = flyffZ × 4`; `rotationY = angle × π/180`; scale vector dipakai langsung. Terrain 129×129 dengan spacing 4 menghasilkan footprint 512×512.

Embedded collision ketiga O3D berhasil dibaca. Collision belum dimasukkan ke gameplay LUMENFALL.

## 7. Headed viewer dan safety

Route dev-only: `http://127.0.0.1:3003/dev-imports/flyff-flaris/f3a-viewer.html`.

Route berhasil dibuka pada headed browser, tetapi status berhenti di `module loading…`; screenshot headed yang diambil adalah bukti blocker viewer, bukan bukti visual fidelity PASS. Perbaikan berikutnya harus menyajikan viewer melalui route yang dibundle Vite atau viewer tooling yang kompatibel.

- File `D:\FlyffUS` tidak diubah.
- Tidak ada NPC, monster, quest, item, audio, gameplay, atau publish.
- Tidak ada protected-format bypass.
- Tidak ada perubahan map produksi LUMENFALL.

## 8. Rekomendasi F3-B

Belum mulai F3-B. Langkah terkecil berikutnya:

1. Perbaiki route viewer agar module Three.js benar-benar dieksekusi dan ambil screenshot 3D bertekstur.
2. Lanjutkan extraction terarah dari `obj_*.res` untuk model yang mencakup placement terbanyak.
3. Resolve terrain DDS dari resource yang tepat.
4. Ulangi gate three-object sebelum batch conversion 49 tile.
