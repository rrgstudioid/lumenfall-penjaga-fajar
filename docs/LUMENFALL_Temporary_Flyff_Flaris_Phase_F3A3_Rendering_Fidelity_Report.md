# F3-A3 — Rendering Fidelity Correction
Tanggal: 20 September 2026. Local development only. Tidak dipublish.

## Keputusan gate

**Tiga objek: PASS untuk mapping, transform, tekstur dan collision proof. Terrain: PARTIAL. F3-A3 keseluruhan belum diberi FULL PASS.**

Bug besar sudah diperbaiki: height flags, pemilihan satu material per patch, UV, posisi X/Z, arah yaw, localTM dan bounding-box helper. Akan tetapi, penerapan persis UV sumber C++ lama terhadap mask dari client patched masih menghasilkan beberapa cutoff material. Belum ada bukti bahwa source C++ publik itu identik dengan renderer biner client FlyffUS hasil patch.

Jangan mulai F3-B atau melanjutkan ekspansi coverage berdasarkan laporan ini. Langkah terkecil berikutnya adalah validasi renderer/material versi client yang cocok pada tile yang sama, bukan mengubah UV agar terlihat lebih bagus. Tidak ada ekstraksi massal tambahan pada fase ini.

## A. Laporan owner

1. **Penyebab terrain kotak-kotak:** viewer lama memilih layer terakhir yang enabled lalu mengganti seluruh patch. Alpha dan warna lightmap dibuang. Enable mask bukan pengganti bobot alpha.
2. **Blending asli:** urutan layer dipertahankan; patch enable menentukan apakah pass digambar; layer pertama opaque, layer berikutnya memakai alpha lightmap. RGB memakai MODULATE2X. Implementasi shader baru melakukan komposisi tersebut.
3. **UV sebelumnya salah:** satu pengulangan per patch dan V dibalik. Sumber C++ aktif memakai tiga pengulangan per patch dan V searah pertambahan Z. UV lightmap memiliki rumus tersendiri, bukan UV tekstur permukaan.
4. **X/Z ×4 benar** untuk posisi objek yang disimpan dalam LND. Pernyataan kebalikannya pada F3-A2 dicabut.
5. **Mesh objek tidak ikut ×4.** Gunakan localTM O3D lalu scale instance LND. Tidak ada faktor ×4 pada tinggi atau vertex model.
6. **1926 bukan building.** Catalog menempatkannya di kategori Korea “프랍” (prop). Hasil model/texturenya menunjukkan potongan pagar kayu pendek. “Guardrail/pagar” merupakan interpretasi visual; catalog tidak menuliskan subkategori guardrail.
7. **Geometri raksasa:** terdapat 1.370 vertex terrain yang menyimpan flag ≥1000. Viewer lama menggambar flag itu sebagai elevasi. Maksimum mentah 1161,613 menjadi 161,613 setelah decoding sumber. Model 1926 sendiri hanya sekitar 1,811 × 0,812 × 0,396 unit lokal—bukan geometri diagonal raksasa.
8. **Tree20:** tampil sebagai pohon, tinggi dunia sekitar 6,615 unit. Posisi asli dekat batas timur tile. Akar sedikit tertanam sesuai model; tidak diperbesar atau dipindahkan manual.
9. **Prop28:** catalog “가로등” berarti lampu jalan. Bukan flora. Tinggi dunia 3,608 unit dan basis hampir tepat pada terrain.
10. **Numeric height:** lihat tabel di bawah; baik bilinear reference sampler maupun triangle surface diperiksa.
11. **Rotasi/pivot:** source DirectX memakai scale × rotation × translation untuk row vectors. Untuk ketiga record tanpa tilt, Three.js ekuivalen translation × rotationY(-angle) × scale × localTM. Tidak ada recentering pivot.
12. **Collision:** collision embedded memakai transform instance yang sama, tanpa mengalikan localTM submesh render. Overlay pagar sejajar; simplifikasi bentuk collider tidak dianggap kesalahan transform.
13. **Screenshot:** delapan bukti Chrome headed tersedia, termasuk tujuh yang diwajibkan.
14. **Gate:** ketiga objek PASS; keseluruhan fidelity terrain belum FULL PASS.
15. **Coverage:** tetap ditunda hingga ketidakpastian material ditutup. Tidak membuat region penuh, tidak import gameplay dan tidak publish.

### Nilai numerik permukaan dan basis objek

Semua nilai dalam source world units. Origin tampilan dikurangi origin tile (6656, 0, 3072); tidak mengubah hubungan objek/terrain. Delta negatif berarti minimum model berada di bawah permukaan pada X/Z origin.

| ID | Catalog | Terrain Y bilinear | Placement Y | Model min Y setelah localTM | Base world Y | Base − terrain |
|---|---|---:|---:|---:|---:|---:|
| 1926 | Prop / pagar pendek | 100,000000 | 100,000000 | -0,002737 | 99,997263 | -0,002737 |
| 20 | Tree | 100,395665 | 100,395660 | -0,258181 | 100,120697 | -0,274968 |
| 28 | Streetlight | 99,699799 | 99,699799 | -0,003639 | 99,695759 | -0,004039 |

Triangle-surface Y: 1926 = 100; 20 = 100,395767; 28 = 99,699799. Perbedaan bilinear/triangle untuk pohon sekitar 0,000101. Basis AABB bukan contact solver seluruh footprint; bagian kanopi tree20 melampaui tile ke timur dan terrain tetangga sengaja tidak dimuat.

| ID | Ukuran lokal X/Y/Z | World AABB min | World AABB max | Ukuran world AABB X/Y/Z | Klasifikasi |
|---|---|---|---|---|---|
| 1926 | 1,811384 / 0,811838 / 0,395713 | 358,749505 / 99,997263 / 186,917071 | 359,639272 / 100,809101 / 188,763263 | 0,889767 / 0,811838 / 1,846193 | PASS |
| 20 | 5,866498 / 6,211022 / 4,752321 | 508,313869 / 100,120697 / 294,784804 | 514,514375 / 106,735437 / 299,847903 | 6,200506 / 6,614739 / 5,063099 | PASS; root penetration diketahui |
| 28 | 1,245574 / 3,250069 / 0,462494 | 394,629918 / 99,695759 / 168,239762 | 395,169080 / 103,303336 / 169,624302 | 0,539162 / 3,607577 / 1,384541 | PASS |

Header O3D bounding boxes dan actual vertex bounds setelah localTM cocok dengan toleransi 0,00001. Nilai lengkap yang tidak dibulatkan ada di [manifest](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/manifest.json>).

## B. Audit source of truth

Reference checkout: C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2
Commit diverifikasi: fdba632b5c52b1918c5d90fd1368466935c9a3c8.

Ada **dua rendering path berbeda** di repository. Jangan menyebut keduanya algoritma yang sama:

### Web runtime yang aktif

- [lnd-reader.ts](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/tools/src/lnd-to-terrain/lnd-reader.ts>): layout LND little-endian, heights, patch-enable BOOL32, ARGB DWORD, placement inline.
- [index.ts](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/tools/src/lnd-to-terrain/index.ts>): posisi placement X/Z × MPU=4; menulis color.png dan class.bin.
- [texture-baker.ts](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/tools/src/lnd-to-terrain/texture-baker.ts>): memilih topmost enabled layer per patch untuk baked color. Tidak memakai ARGB lightmap untuk komposisi penuh.
- [main.cpp — shader](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/platform/main.cpp:1168>): class map 16×16 disampling empat tap; bobot kelas grass/soil/brick/sand/water dicampur bilinear. Repetition per tile masing-masing 20/18/16/18/12. Water bergerak mengikuti waktu. Baked luminance memodulasi warna dengan 0.75 + 0.5 × luminance, kemudian lighting. Ini pendekatan renderer port, **bukan reproduksi tujuh layer asli**.
- [main.cpp — terrain](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/platform/main.cpp:1745>): decode height flags, vertex grid spacing4, full-resolution triangle grid, normals, UV baked 0..1.
- [main.cpp — localTM](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/platform/main.cpp:1003>): bake localTM untuk static world objects.
- [main.cpp — instance render](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/platform/main.cpp:3556>): scale, yaw negatif, translation. Geometry tidak dikalikan MPU.
- [main.cpp — collision](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/platform/main.cpp:2097>) dan [triangle collision](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/platform/main.cpp:2215>): OBB dari bbox; embedded collision memakai inverse instance world matrix.
- [d3dx_replacement.h](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/packages/client/d3d_gles/d3dx_replacement.h:57>): tanda yaw dan konvensi row-matrix dikonfirmasi.

### Sumber Flyff C++ asli yang disertakan dalam commit yang sama

- [landscape.h](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/landscape.h:6>): MAP_SIZE128, NUM_PATCHES16, PATCH_SIZE8.
- [lod.cpp — vertex/UV](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/lod.cpp:696>): dua set UV, tiga repeat per patch.
- [lod.cpp — RenderPatches](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/lod.cpp:808>): urutan layer, enabled mask, opaque-first/alpha-next.
- [lod.cpp — MODULATE2X](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/lod.cpp:882>): RGB modulation dan alpha source.
- [lod.cpp — load lightmap](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/lod.cpp:1306>): A8R8G8B8 dari DWORD; opsi build A4R4G4B4 juga ada.
- [lod.cpp — height flags](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/lod.cpp:1657>): flags bukan height.
- [World3D.cpp](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/World3D.cpp:448>): texture × diffuse, SRCALPHA/INVSRCALPHA.
- [Obj.cpp](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/Obj.cpp:126>): YPR negative yaw, negative X tilt, positive Z tilt pada __FIX_ROTATE.
- [Obj.cpp — record reader](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/Obj.cpp:478>): axis.x/z, placement scale, OLD_MPU pada X/Z.
- [lod.cpp — world origin](<C:/Users/USER/AppData/Local/Temp/lumenfall-flyff-web-mmo-f2/reference/source/_Common/lod.cpp:1356>): tile origin ditambahkan.
- packages/client/neuz_src/common/lod.cpp memiliki rumus UV aktif yang sama.
- Local catalog: C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/catalog/mdlObj.inc, baris228/2478/2723. Terrain.inc: authoritative ID→filename.

**Pilihan viewer:** untuk mempertahankan seluruh tujuh material aktual, viewer menerapkan layer renderer C++ asli, bukan mengganti semua material dengan lima kelas generik web port. Ini keputusan yang didokumentasikan, bukan klaim parity pixel-perfect dengan shader web aktif. Full parity web-port maupun patched client belum dinyatakan lulus.

Tidak ditemukan screenshot teridentifikasi tile13-06 dengan camera metadata di checkout untuk perbandingan geometri. Tidak memakai screenshot internet acak.

## C. Terrain implementation

Tile: D:/FlyffUS/World/WdMadrigal/WdMadrigal13-06.lnd.
Version3; 129×129 heights; 512×512 world units; 256 patch × 8×8 cells.
2.458 object records dan 89 SFX records dilewati/dibaca untuk alignment, **hanya tiga objek dirender**.
EOF tepat byte696295. Tidak memuat gameplay/SFX.

Height decode reference port:

    actualHeight = raw >= 1000 ? raw - floor(raw/1000)*1000 : raw

Raw min/max91,623703 /1161,613037; decoded min/max91,623703 /161,613037.
Flag dipisahkan; tidak smoothing geometry.

Full-resolution topology mengikuti triangle grid main.cpp: a,c,b dan b,c,d. Original C++ juga memiliki adaptive patch LOD/stitching; viewer tidak mereproduksi adaptive LOD. Tidak stitching tile tetangga.

Untuk posisi cell lokal x,z dalam patch px,pz:

    surfaceU = 3*x/8
    surfaceV = 3*z/8
    lightU = (px*8+x)*7/1024 + 1/256
    lightV = (pz*8+z)*7/1024 + 1/256

Semua layer memakai rumus yang sama. DDS flipY=false, RepeatWrapping untuk surface; lightmap bilinear tanpa mip, rentang sampel .00390625..87890625 (tidak mencapai1). Tidak mengganti 7/1024 dengan nilai yang terlihat lebih enak.

ARGB little-endian diubah ke RGBA eksplisit. Shader menjalankan urutan source:

    layerRGB = clamp(2 * terrainTextureRGB * lightmapRGB, 0, 1)
    firstEnabled: result = layerRGB
    nextEnabled: result = mix(result, layerRGB, lightmapAlpha)

Enable=false tidak ikut. Tidak ada “texture gagal → pakai texture lainnya”; missing menggunakan checker magenta/hitam dan masuk daftar error UI. Tidak ada texture missing dalam run final.

Fixed-function diffuse global tidak tersedia sebagai world lighting yang tervalidasi. Viewer memakai white/neutral diffuse dan mempertahankan lightmap; tidak memakai HDR tone mapping, pencahayaan PBR yang berlebihan, recolor estetis, fog, dynamic shadow atau weather. Komposisi terrain dilakukan dalam legacy byte-color space. Ini minimum faithful layer/color equivalent, bukan final environment shading.

### Batas fidelity material yang belum selesai

[material-diagnostic.json](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/material-diagnostic.json>) menghitung bobot alpha kedua sisi patch boundary menggunakan **UV source yang sama**, sebelum warna DDS diambil.

- 480 internal patch boundaries ×4 sample =1.920 sample.
- 14 sample memiliki loncatan bobot >0,05.
- Contoh patch(14,4) →(14,5), sample7: bobot default/Obj_FLGR01 berubah dari 0,875/0,125 ke0/1.
- Karena UV di kedua sisi boundary identik, perbedaan berasal dari kombinasi enable mask dan alpha yang disampling dengan rumus pinned source, bukan pemilihan top-layer lama.
- Ini bukti sisa discontinuity, **bukan bukti client patched salah**. Bisa ada perbedaan renderer/data version atau kebiasaan sumber yang belum cocok. Tidak ditebak, tidak “diperbaiki” dengan UV/mask baru.
- Masih ada batas material dan tint terang yang perlu pembanding client/editor sesuai versi. Global illumination belum direkonstruksi. Oleh sebab itu terrain tetap PARTIAL.

### Tujuh texture, urutan sesuai file

Resource column adalah sumber ekstraksi F3-A2 yang dipakai ulang; archive dibaca untuk hash, tidak diekstrak ulang fase ini.

| ID | Expected filename / loaded | Source resource | Size / format | Status |
|---|---|---|---|---|
| 0 | default.dds | D:/FlyffUS/World/Texture/wtex_d.res | 256×256 DXT1 | LOADED |
| 19 | rock12M.dds | D:/FlyffUS/World/Texture/wtex_r.res | 128×128 DXT1 | LOADED |
| 13 | ground_precipice01.dds | D:/FlyffUS/World/Texture/wtex_g.res | 256×256 DXT1 | LOADED |
| 17 | rock10M.dds | D:/FlyffUS/World/Texture/wtex_r.res | 128×128 DXT1 | LOADED |
| 254 | Obj_FLGR01.dds | D:/FlyffUS/World/Texture/wtex_o.res | 512×512 DXT1 | LOADED |
| 246 | Upresia_Ground01.dds | D:/FlyffUS/World/Texture/wtex_u.res | 512×512 DXT1 | LOADED |
| 255 | NewFlrock01.dds | D:/FlyffUS/World/Texture/wtex_n.res | 256×256 DXT1 | LOADED |

## D. Object transforms and collision

Source positions, no manual relocation:

| ID / ordinal | LND position | Angle degrees | Instance uniform scale | Axis |
|---|---|---:|---:|---|
| 1926 /0 | 89,799683 /100 /46,959717 | 106,661430 | 1 | 0/0/0 |
| 20 /17 | 127,841064 /100,395660 /74,338196 | 173 | 1,065 | 0/0/0 |
| 28 /1762 | 98,727783 /99,699799 /42,196777 | 272 | 1,11 | 0/0/0 |

Global source-world conversion:

    worldX = tileX*512 + LND.posX*4
    worldY = LND.posY
    worldZ = tileY*512 + LND.posZ*4

One-tile viewer subtracts fixed origin(6656,0,3072). Source-local model vertex:

    pModel = localTM * pVertex
    pViewer = Translation(localX*4, y, localZ*4) * RotationY(-angle) * Scale(record) * pModel

This is a matrix-convention conversion, not an axis reflection. Determinant remains positive for proof scales. No mesh-wide ×4; no center() or artificial pivot. LocalTM stored row-major is loaded as equivalent transposed column transform through Three Matrix4.fromArray.

Tilt is zero in all three proof placements. Axis.y is not used as separate yaw in original CObj::Read. The limited proof helper rejects nonzero axes instead of silently discarding them. Nonzero tilt generalization remains unvalidated; not needed for these objects.

Model catalog default scale (tree1.5) is not multiplied on top of saved LND1.065. CObj::Read restores m_vScale; static instance render uses that value. ResetScale is a separate operation.

All three O3D version22; encoded filename matches expected; EOF remaining0. One static mesh per object, parent=-1. Render groups/material slots retained. LocalTM applied to geometry/normals. Model file sources:

- D:/FlyffUS/Model/Obj_NewFlGDRL_01_01.o3d — 79 render vertices /162 indices; collision18/30.
- D:/FlyffUS/Model/Obj_MaCoPrTr01.o3d — 466/1374; collision25/60.
- D:/FlyffUS/Model/Obj_MaFlPrLa01.o3d — 179/402; collision32/78.

DDS sources under D:/FlyffUS/Model/Texture:

- Obj_NewFlGDRL_01.dds.
- Obj_MaCoPrTr01_new.dds.
- Obj_MaFlPrLa_new.dds.

Viewer DDS copies have SHA-256 equality with those local originals. UV kept as stored, flipY=false, material block indices retained, alpha cutout enabled. No placeholder materials in final screenshots.

Embedded collision is already model-local. It gets **instance transform only**, not render mesh localTM. Ground/surface bbox helpers are world-space and not transformed twice. Pagar overlay uses yellow collision, blue bounds, RGB axes. Collision is a simplified solid envelope, not expected to match every visible timber edge. No LUMENFALL gameplay collision integration.

## E. Camera and evidence

URL: http://127.0.0.1:3002/flaris-fidelity.html

Presets: top-down;45° elevation orbit;ground-eye;focus1926;focus20;focus28.
Toggles: terrain wireframe, object bounds, embedded collision, origins, boundary, labels.
Presets only move camera. At tile-wide view the real small objects are small; close views provide geometry evidence. UI labels are offset to avoid overlap, not world objects.

Chrome151.0.7922.108, headless=false, 1600×950, WebGL2. Used installed Playwright because agent-browser command is unavailable. Browser verification skill drove the check of exported data→Vite requests→WebGL output→UI controls.

| Required view | Evidence |
|---|---|
| Top-down terrain | [01-top-down.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/01-top-down.png>) |
| 45° terrain + original three placements | [02-orbit.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/02-orbit.png>) |
| Object1926 close | [03-object-1926.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/03-object-1926.png>) |
| Tree20 close | [04-tree-20.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/04-tree-20.png>) |
| Lamp28 close | [05-lamp-28.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/05-lamp-28.png>) |
| Wireframe + textures | [06-wireframe.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/06-wireframe.png>) |
| Collision overlay | [07-collision.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/07-collision.png>) |
| Extra ground-eye | [08-ground-eye.png](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/08-ground-eye.png>) |

[Browser result](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3/evidence/browser-result.json>): ready=true; 10 textures loaded; missing0; page/console errors0; warnings0; failed requests0; no Vite error overlay. First pass reported a favicon404, fixed with inline empty favicon; final pass clean.

## F. Verification, changed files and safety

10 focused regression tests passed,0 failed:

- four height flag bands and finite validation;
- source surface/lightmap UV;
- alpha blend + RGB MODULATE2X;
- disabled mask exclusion;
- MPU/negative yaw/axis guard;
- bilinear/triangle sampling and explicit outside-tile result;
- each of three proofs: O3D EOF, localTM vs header bbox, position/terrain delta;
- seven texture IDs and unchanged source hashes.

Isolated viewer TypeScript check passed with exit0. Existing production game suite/build were **not rerun**: this task changes no game source and does not assert a new global game baseline. Vite runtime compilation and headed renderer were verified. No claim that 10 tests replace game regression.

Hand-edited/added files:

- tests/browser/flaris-fidelity.tsx
- tests/browser/flaris-fidelity.html
- tests/browser/flaris-fidelity.css
- tests/browser/flaris-fidelity-verify.mjs
- dev-imports/flyff-flaris/f3a_export_three.cjs — export parse function, avoid extraction on require.
- dev-imports/flyff-flaris/f3a3-semantics.mjs
- dev-imports/flyff-flaris/f3a3-export.mjs
- dev-imports/flyff-flaris/f3a3-material-check.mjs
- dev-imports/flyff-flaris/f3a3-semantics.test.mjs
- docs/LUMENFALL_Temporary_Flyff_Flaris_Phase_F3A2_Viewer_Coverage_Terrain_Report.md — superseded-transform notice.
- This report.

Generated artifacts isolated under C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/dev-imports/flyff-flaris/f3a3: decoded height array,7 RGBA lightmaps,manifest,3 neutral JSON mesh/placement/collision files,material diagnostics,evidence.

The exporter checks SHA-256 before/after for24 inputs:13 original D:/FlyffUS files plus11 existing extracted/reference copies. All unchanged. Full hashes in manifest, including:

| Source | SHA-256 before = after |
|---|---|
| WdMadrigal13-06.lnd | 4437ba8093935017912f9453b209b5ade6e08926ac9f04a3825d4fde340ccf68 |
| Obj_NewFlGDRL_01_01.o3d | 522293dce3dc6d492cc16d8db076310eea6ad2a15203c306cd7554066ab5d624 |
| Obj_MaCoPrTr01.o3d | 2c9cc37838ae810935d504969efc990706a4154ae8bd1d8096409e5fccbe907f |
| Obj_MaFlPrLa01.o3d | 8e8ae622fc17a03ca07abcd42a449ecaf0856e065364167190afa547b2ee945f |

No original source writes, no archive extraction in this phase, no protection/DRM bypass, no coverage expansion. Existing unrelated worktree changes were preserved. No production map/asset library/gameplay edits; no new LUMENFALL region, no publish.

## Final gate checklist

| Requirement | Result |
|---|---|
| Wrong topmost-layer replacement removed | PASS |
| Source-defined UV and lightmap composition implemented | PASS against pinned original C++ branch; not pixel parity with current web shader |
| No unexplained giant1926 geometry | PASS |
| Tree/prop dimensions and transform | PASS |
| Basis vs terrain numerically consistent | PASS within stated footprint limitation |
| Rotation/pivot for these three proof records | PASS |
| Collision transform | PASS |
| Diagnostic cameras/screenshots | PASS |
| Fully validated material boundaries for patched FlyffUS | NOT YET —14 measured boundary discontinuities; compatible-client comparison needed |
| Full F3-A3 acceptance | **PARTIAL / NOT FULL PASS** |

STOP. Do not start F3-B or resume bulk coverage until the remaining material-fidelity issue is resolved from source/client evidence.

