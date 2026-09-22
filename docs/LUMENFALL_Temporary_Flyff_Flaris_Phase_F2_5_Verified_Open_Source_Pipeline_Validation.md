# LUMENFALL — Phase F2.5
## Verified Open-Source Flaris Pipeline Validation

Tanggal audit: 20 September 2026  
Status: **partial proof berhasil; belum ada import ke map LUMENFALL dan belum publish**

## 1. Kesimpulan pemilik

Repository `ed3ath/flyff-web-mmo` memang memiliki pipeline sumber terbuka yang membaca terrain Flyff `.lnd`, object placement, O3D, tekstur DDS, dan collision. Commit yang dipakai adalah:

`fdba632b5c52b1918c5d90fd1368466935c9a3c8`

Lisensi repository: Apache-2.0. Sumber: [repository reference](https://github.com/ed3ath/flyff-web-mmo).

Hasil terhadap file lokal:

- 49 tile Flaris dari reference ditemukan seluruhnya di `D:\FlyffUS\World\WdMadrigal`.
- Seluruh 49 file lokal berhasil dibaca memakai layout parser `.lnd` reference dan mencapai EOF tepat setelah record SFX.
- Satu tile terkonfirmasi secara struktural: `WdMadrigal13-06.lnd`, koordinat internal `(13, 6)`.
- Terrain berhasil diekspor ke height array netral 129×129.
- Object placement terbukti berada inline di `.lnd`.
- Object index `20` berhasil dipetakan ke `Obj_MaCoPrTr01.o3d` pada reference catalog dan model lokal ditemukan.
- O3D lokal berhasil dibaca penuh: mesh, UV, normal, material texture name, serta embedded collision.
- Tekstur model berhasil diidentifikasi: `Obj_MaCoPrTr01_new.dds`.

Kesimpulan kompatibilitas: **MOSTLY COMPATIBLE / VERSION DIFFERENCE**. Terrain dan layout `.lnd` kompatibel, tetapi katalog object lokal tidak identik dengan sample repository. Sebanyak 20 dari 49 file memiliki ukuran berbeda, dan beberapa index lokal—termasuk object dominan index `1926`—tidak ada di `mdlObj.inc` reference.

Full 49-tile reconstruction sekarang **secara teknis realistis**, tetapi belum turnkey. Masih diperlukan catalog/index object untuk versi FlyffUS lokal serta pemetaan resource terrain/texture lokal.

## 2. Reference source dan file parser

File utama yang diaudit dari clone sementara:

- `tools/src/lnd-to-terrain/lnd-reader.ts` — parser `.lnd`.
- `tools/src/lnd-to-terrain/wld-reader.ts` — parser plain-text `.wld`.
- `tools/src/lnd-to-terrain/index.ts` — export terrain, class map, object placement, dan koordinat.
- `tools/src/lnd-to-terrain/model-index.ts` — pemetaan `mdlObj.inc` ke nama `.o3d`.
- `tools/src/o3d-to-json/index.ts` — parser O3D mesh/material.
- `packages/client/platform/main.cpp` — loader runtime terrain/object/O3D dan collision yang dipakai sebagai sumber verifikasi tambahan.
- `packages/client/neuz_src/common/lod.cpp` — implementasi `CLandscape` original/client-side.
- `packages/client/neuz_src/common/Continent.cpp` — identitas continent Flaris dan world `WdMadrigal`.
- `docs/wasm-original-loader-port.md` — dokumentasi bahwa converter saat ini bersifat lossy dan menyarankan sample Flaris `13-06`.
- `tools/data/flaris-town/WdMadrigal.wld` — ukuran world `30×30`, `MPU 4`.
- `tools/data/flaris-town/mdlObj.inc`, `propObj.csv`, `Terrain.inc` — catalog sample reference.

Repository menyebutkan tool asset seperti `o3d-to-json`, DDS converter, resource tooling, dan terrain converter. `parse-resdata` yang ada di repository ternyata untuk layout UI `resdata.inc`, bukan extractor world `.res`; tidak dipakai untuk menebak atau brute-force archive lokal.

## 3. Exact 49 tile Flaris

Reference `tools/data/flaris-town` mendefinisikan grid lengkap:

- X: `10..16`
- Y: `03..09`
- Total: `7 × 7 = 49`
- Format filename: `WdMadrigalXX-YY.lnd`

Daftar lengkap:

| Y | Tile X=10 sampai 16 |
|---|---|
| 03 | `WdMadrigal10-03.lnd`, `11-03`, `12-03`, `13-03`, `14-03`, `15-03`, `16-03` |
| 04 | `WdMadrigal10-04.lnd`, `11-04`, `12-04`, `13-04`, `14-04`, `15-04`, `16-04` |
| 05 | `WdMadrigal10-05.lnd`, `11-05`, `12-05`, `13-05`, `14-05`, `15-05`, `16-05` |
| 06 | `WdMadrigal10-06.lnd`, `11-06`, `12-06`, `13-06`, `14-06`, `15-06`, `16-06` |
| 07 | `WdMadrigal10-07.lnd`, `11-07`, `12-07`, `13-07`, `14-07`, `15-07`, `16-07` |
| 08 | `WdMadrigal10-08.lnd`, `11-08`, `12-08`, `13-08`, `14-08`, `15-08`, `16-08` |
| 09 | `WdMadrigal10-09.lnd`, `11-09`, `12-09`, `13-09`, `14-09`, `15-09`, `16-09` |

Nama lengkap 49 file tersebut adalah:

```text
WdMadrigal10-03.lnd  WdMadrigal11-03.lnd  WdMadrigal12-03.lnd  WdMadrigal13-03.lnd  WdMadrigal14-03.lnd  WdMadrigal15-03.lnd  WdMadrigal16-03.lnd
WdMadrigal10-04.lnd  WdMadrigal11-04.lnd  WdMadrigal12-04.lnd  WdMadrigal13-04.lnd  WdMadrigal14-04.lnd  WdMadrigal15-04.lnd  WdMadrigal16-04.lnd
WdMadrigal10-05.lnd  WdMadrigal11-05.lnd  WdMadrigal12-05.lnd  WdMadrigal13-05.lnd  WdMadrigal14-05.lnd  WdMadrigal15-05.lnd  WdMadrigal16-05.lnd
WdMadrigal10-06.lnd  WdMadrigal11-06.lnd  WdMadrigal12-06.lnd  WdMadrigal13-06.lnd  WdMadrigal14-06.lnd  WdMadrigal15-06.lnd  WdMadrigal16-06.lnd
WdMadrigal10-07.lnd  WdMadrigal11-07.lnd  WdMadrigal12-07.lnd  WdMadrigal13-07.lnd  WdMadrigal14-07.lnd  WdMadrigal15-07.lnd  WdMadrigal16-07.lnd
WdMadrigal10-08.lnd  WdMadrigal11-08.lnd  WdMadrigal12-08.lnd  WdMadrigal13-08.lnd  WdMadrigal14-08.lnd  WdMadrigal15-08.lnd  WdMadrigal16-08.lnd
WdMadrigal10-09.lnd  WdMadrigal11-09.lnd  WdMadrigal12-09.lnd  WdMadrigal13-09.lnd  WdMadrigal14-09.lnd  WdMadrigal15-09.lnd  WdMadrigal16-09.lnd
```

Verifikasi lokal: **49/49 file ada** di `D:\FlyffUS\World\WdMadrigal`.

Tile proof yang dipilih:

`D:\FlyffUS\World\WdMadrigal\WdMadrigal13-06.lnd`

Alasannya bukan tebakan nama: file tersebut adalah anggota langsung dari grid 49 tile reference dan header lokalnya menyatakan `xLand=13`, `yLand=6`.

## 4. Hasil parse `.lnd` lokal

Format yang terkonfirmasi:

- Endian: little-endian.
- Version tile: `3`.
- Height grid: `129×129 = 16.641` float32.
- Patch grid: `16×16 = 256` patch.
- Water: water height dan water texture per patch.
- Land attributes: 256 byte untuk versi ≥2.
- Texture layer: texture ID, 256 patch-enable flags, dan lightmap `128×128` uint32 per layer.
- Object count tile `13-06`: `2.457`.
- SFX record count: `89`.
- Parser remaining setelah SFX: `0`.

Nilai terrain tile `13-06`:

- Min height: `91.623703`
- Max height: `1161.613037`
- Layer count: lokal terbaca lengkap melalui layout reference.
- Land attributes yang ditemukan: `0` dan `205`.

Ekspor netral:

- `height.f32le` — 16.641 float32 little-endian.
- `metadata.json` — metadata tile, height range, layer summary, object summary, dan formula koordinat.
- `objects-index-20.json` — sample placement object index 20.

## 5. Object placement dan model

Placement object terbukti tersimpan langsung di `.lnd`, bukan perlu ditebak dari `.res` untuk static object proof ini.

Record yang terbaca berisi:

`objType, angle, axis[3], pos[3], scale[3], dwType, index, motion, aiInterface, ai2`

Sample object index `20` pada tile proof:

- ordinal: `17`
- model index: `20`
- angle: `173`
- position lokal tile: `[127.841064, 100.395660, 74.338196]`
- scale: `[1.065, 1.065, 1.065]`
- AI fields: tidak digunakan sebagai gameplay import dalam fase ini.

Reference `mdlObj.inc` memetakan index `20` ke `MaCoPrTr01`. File model lokal yang cocok ditemukan:

`D:\FlyffUS\Model\Obj_MaCoPrTr01.o3d`

Ukuran: `26.043 bytes`.

## 6. Hasil parse O3D

Model lokal berhasil dibaca sampai EOF dengan perlakuan runtime yang benar untuk `nMat=0` sebagai satu material fallback.

- Nama encoded header: `Obj_MaCoPrTr01.o3d`.
- O3D version: `22`.
- Bounding box: `[-2.984321, -0.258181, -2.380619]` sampai `[2.882177, 5.952841, 2.371702]`.
- Mesh: `466` vertex-buffer vertices.
- Index buffer: `1374` indices / `458` triangles.
- UV dan normal: terbaca.
- Material group: `1`.
- Collision embedded: ya.
- Collision mesh: `25` vertices dan `60` indices.
- Parser remaining: `0`.

Output netral:

- `Obj_MaCoPrTr01.json` — mesh, normal, UV, index, material, dan collision summary.
- `Obj_MaCoPrTr01.obj` — geometry proof export.

Texture yang direferensikan material:

`D:\FlyffUS\Model\Texture\Obj_MaCoPrTr01_new.dds`

DDS lokal terdeteksi sebagai DXT1, 512×512, dan disalin hanya ke folder proof terisolasi untuk validasi; file sumber tidak disentuh.

## 7. Koordinat dan collision

Reference runtime menetapkan:

- Y adalah sumbu vertical/up.
- `MPU = 4`.
- Satu tile terrain: `128 × 128` cell × 4 = `512 × 512` world units.
- Height vertex spacing: `4` world units.
- Formula world position:

```text
worldX = (tileX * 128 + localX) * 4
worldY = localY
worldZ = (tileY * 128 + localZ) * 4
```

- Object rotation menggunakan `angle` sebagai rotasi Y pada reference converter/runtime.
- Object scale dipertahankan sebagai tiga komponen scale.

Collision yang terkonfirmasi dari source/reference:

- Terrain: height grid dan land attributes dipakai loader terrain/collision.
- Object: embedded collision mesh di `.o3d`, dengan OBB broad phase dan triangle mesh narrow phase.
- Untuk model proof: embedded collision berhasil terbaca.

Transfer collision ke LUMENFALL belum dilakukan; tidak ada collision production yang diubah.

## 8. Bukti visual dan status isolated viewer

Bukti visual diagnostik height tile:

![Isolated one-tile proof](../dev-imports/flyff-flaris/converted/13-06/isolated-proof.png)

File bukti: [isolated-proof.png](../dev-imports/flyff-flaris/converted/13-06/isolated-proof.png).

Bukti ini menunjukkan height grid hasil decode, posisi sample object index 20, ukuran height, jumlah object, SFX, dan status embedded collision. Ini adalah diagnostic proof, bukan pengganti viewer production.

Saya juga membuat viewer Three.js sementara:

- `viewer.html`
- `Obj_MaCoPrTr01.json`
- `Obj_MaCoPrTr01.obj`
- `Obj_MaCoPrTr01_new.dds`

Namun browser in-app menolak membuka port HTTP lokal sementara (`ERR_BLOCKED_BY_CLIENT`), sehingga textured headed-browser screenshot belum dapat dijadikan bukti final. Karena itu saya **tidak** membuat `flyff-flaris-import-test` di runtime LUMENFALL dan tidak mengklaim full visual fidelity.

## 9. Versi lokal vs reference

Klasifikasi: **MOSTLY COMPATIBLE / VERSION DIFFERENCE**.

Bukti kompatibel:

- semua 49 file ada;
- semua 49 file version `3`;
- semua 49 file dapat diparse dengan layout yang sama sampai EOF;
- header coordinate dan height grid valid;
- object record dapat dibaca;
- satu O3D lokal berhasil dibaca penuh dengan material dan collision.

Bukti perbedaan versi/data:

- 29 dari 49 tile memiliki ukuran byte sama dengan sample reference, 20 berbeda;
- tile `13-06`: lokal `696.231` byte, reference `828.971` byte;
- layer texture dan object count berbeda antara sample reference dan file lokal;
- local object index `1926` tidak ada dalam `mdlObj.inc` reference;
- local install tidak memiliki `WdMadrigal.wld`, `mdlObj.inc`, atau `Terrain.inc` sebagai file standalone pada lokasi yang diaudit.

## 10. Perkiraan full 49 tile

Secara terrain parser:

- jumlah tile: `49`;
- footprint: `7×7×512 = 3584×3584` world units;
- total object records lokal: `15.038`;
- total SFX records: `129`.

Asset conversion belum dibatch. Estimasi jumlah asset unik, waktu konversi, dan disk footprint belum dapat dipercaya sebelum local object-index catalog dibuat. Ini blocker nyata, bukan angka yang boleh ditebak.

## 11. File tambahan fase ini

Semua output berada di folder eksperimen, bukan library production:

- [f2_5_export_one_tile.js](../dev-imports/flyff-flaris/f2_5_export_one_tile.js)
- [render_proof.ps1](../dev-imports/flyff-flaris/render_proof.ps1)
- [metadata.json](../dev-imports/flyff-flaris/converted/13-06/metadata.json)
- [Obj_MaCoPrTr01.json](../dev-imports/flyff-flaris/converted/13-06/Obj_MaCoPrTr01.json)
- [Obj_MaCoPrTr01.obj](../dev-imports/flyff-flaris/converted/13-06/Obj_MaCoPrTr01.obj)
- [viewer.html](../dev-imports/flyff-flaris/converted/13-06/viewer.html)

Tidak ada perubahan pada source runtime LUMENFALL, world production, save, gameplay, NPC, monster, quest, item, drop, atau progression.

## 12. Hash sample source

Hash SHA-256 saat audit:

- `WdMadrigal13-06.lnd`: `B2D1852CB5B1028FC24B30B4A2BB479AB48251DE72C49777808057ED838CEA85`
- `Obj_MaCoPrTr01.o3d`: `2C9CC37838AE810935D504969EFC990706A4154AE8BD1D8096409E5FCCBE907F`
- `Obj_MaCoPrTr01_new.dds`: `1FF524D669CD9F8F99844DA8D20D7F2F8714D530620107D7FD4F85B12C641103`

File sumber asli hanya dibaca. Tidak ada protected-format bypass, DRM bypass, atau brute-force archive extraction.

## 13. Blocker dan rekomendasi Phase F3

Blocker berikutnya:

1. Temukan atau bangun local `object index → model filename` catalog yang cocok dengan versi FlyffUS.
2. Resolve `Terrain.inc`/texture catalog lokal jika terrain texture fidelity diperlukan.
3. Jalankan viewer Three.js headed dengan akses file serving yang diizinkan, lalu verifikasi model textured dan placement terhadap terrain.
4. Setelah satu model building nyata tervalidasi, baru rancang converter 49 tile.

Rekomendasi terkecil: **Phase F3-A — local object catalog extraction**, bukan full import. Cari sumber catalog lokal di resource `.res` atau metadata client yang normal, export hanya index yang muncul pada 49 tile, lalu validasi satu building + satu tree + satu prop. Jangan batch-convert semua model sebelum catalog lokal terbukti benar.
