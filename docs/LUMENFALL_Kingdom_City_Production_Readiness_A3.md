# LUMENFALL — A3 Kingdom City Production-Readiness Pilot

## Keputusan untuk owner

Pilot lokal selesai: **15 aset TECH_VALIDATED dalam lingkup uji teknis, 0 PRODUCTION_READY_CANDIDATE**. Status ini berarti bisa dimuat, diperiksa, diskalakan konsisten, dan digunakan sesuai kebijakan collision yang dicatat; bukan sertifikat kelayakan seluruh kebutuhan produksi. Kit bangunan/props cukup untuk greybox bertahap. **Kit lengkap belum aman untuk kota besar dengan semua aset detail asli.** Pohon, LOD, lisensi nature/material remap, dan collision batu masih menjadi hold.

Tidak dibangun kota final, NPC, monster, quest, shop, ataupun district. Arunika/Jayantara, terrain prototype, save, balance dan progression tidak diubah. Tidak dipublikasikan. Perubahan kotor lama pada workspace bukan bagian pekerjaan A3.

## 1. Pilihan pilot dan sumber

Gaya dominan STYLE_A_MEDIEVAL_VILLAGE_MODULAR. Medieval Village MegaKit dipakai untuk dinding, doorway/frame, floor, corner, tangga/landing, dan roof cap. Fantasy Props MegaKit memberi lima props: barrel, crate, bench, wall lantern, banner. Nature memakai tree_small_02 dan boulder_01 dari pustaka lokal.

**Tidak ada tower lengkap yang dipaksakan:** tower disusun dua storey dari modul dinding dan roof cap. Rumah adalah komposisi satu storey dengan roof cap yang sama, bukan castle shell. Ukuran roof yang tinggi adalah proporsi sumber; belum disetujui sebagai rumah umum/menara pertahanan final.

| Asset ID | Pack | Faktor | Triangles LOD0 | Dimensi X×Y×Z, unit game | Lisensi |
|---|---|---:|---:|---|---|
| env_model_wall_plaster_straight | medieval | 1.5 | 86 | 3.00 × 4.69 × 0.61 | LICENSE_OK |
| env_model_wall_plaster_door_round | medieval | 1.5 | 137 | 3.00 × 4.68 × 0.61 | LICENSE_OK |
| env_model_doorframe_round_brick | medieval | 1.5 | 2,046 | 2.40 × 3.88 × 0.72 | LICENSE_OK |
| env_model_roof_tower_roundtiles | medieval | 1.5 | 4,024 | 8.48 × 11.04 × 8.14 | LICENSE_OK |
| env_model_floor_brick | medieval | 1.5 | 4 | 3.00 × 0.03 × 3.00 | LICENSE_OK |
| env_model_corner_exterior_brick | medieval | 1.5 | 3,102 | 0.80 × 4.52 × 0.86 | LICENSE_OK |
| env_model_stairs_exterior_platform | medieval | 1.5 | 32 | 3.00 × 1.50 × 3.00 | LICENSE_OK |
| env_model_stairs_exterior_nofirststep | medieval | 1.5 | 52 | 3.00 × 1.50 × 3.12 | LICENSE_OK |
| env_model_barrel | props | 1.5 | 824 | 1.05 × 1.35 × 1.05 | LICENSE_OK |
| env_model_crate_wooden | props | 1.5 | 1,576 | 1.26 × 1.40 × 1.36 | LICENSE_OK |
| env_model_bench | props | 1.5 | 404 | 4.17 × 0.80 × 0.80 | LICENSE_OK |
| env_model_lantern_wall | props | 1.5 | 2,822 | 0.54 × 2.01 × 1.95 | LICENSE_OK |
| env_model_banner_1 | props | 1.5 | 448 | 2.42 × 3.59 × 0.29 | LICENSE_OK |
| env_package_tree_small_02_2k | env_package_tree_small_02_2k | 1 | 2,062,487 | 2.92 × 4.56 × 4.29 | LICENSE_UNKNOWN |
| env_package_boulder_01_2k | env_package_boulder_01_2k | 1 | 66,122 | 1.27 × 1.00 × 1.83 | LICENSE_UNKNOWN |

Referensi arsip dan entry persis, hierarki, pivot, material slots, texture dependencies, batas model dan blocker per-ID ada di [catalog A3](../data/assets/kingdom-city-pilot-a3.json). Catalog A3 adalah overlay status pilot; tidak mempromosikan seluruh 47 approval A2 atau menghapus audit A1/A2.

## 2. Skala yang dipakai

- Karakter **Astra Hunyuan asli dari Game runtime**, tinggi teramati **2.4 unit**, bukan proxy A2 1.75m. Model karakter dan scale global tidak diubah.
- Medieval Village dan Fantasy Props: **1.5 seragam per pack**. Ini keputusan kalibrasi pilot terhadap karakter/door clearance, bukan klaim metadata sumber membuktikan 1 unit=1 meter.
- Tree dan boulder: **1.0**, metadata BLEND METRIC/unit_scale=1; ekspor glTF mengubah Z-up Blender menjadi Y-up. Tidak ada koreksi skala terpisah per-object.
- Doorframe luar tinggi 3.88; rectangle kosong yang disampling aman **1.65 lebar × 2.60 tinggi**, dibanding avatar 2.4. Itu bukan tinggi penuh lengkung pintu.
- Wall **3.00 ×4.69 ×0.61**; floor slab sekitar0.03; storey rumah4.5.
- Footprint badan rumah dan tower6×6; roof overhang 8.48×8.14. Rumah termasuk roof 14.68 tinggi; tower badan9, total 19.18.
- Stair flight naik **1.50**, run **3.12**, lebar3. Sampling permukaan horizontal menunjukkan detail anak tangga tidak seragam: 0.3353, 0.3562, 0.6122, 0.6457, 0.9173, 0.9226, 1.2276. Selisih kecil termasuk permukaan dekorasi, **bukan semua interval riser**. Riser utama sekitar0.26–0.31; bukan standar konstruksi final. Collision berupa ramp mencapai landing, bukan step solver baru.
- Bench4.17 panjang, lantern2.01 tinggi beserta gantungan, banner3.59 tinggi. Proporsi ini besar/stylized tetapi tidak memerlukan faktor scale berbeda. Tidak ditemukan bukti BAD_SOURCE_SCALE_CONSISTENCY dari subset ini.

Standar awal tercatat di [scale standard](../data/assets/lumenfall-scale-standard-a3.json): normal door1.65×2.6 yang telah diuji; usulan large gate3×4.8, jalan utama6, gang3, storey4.5. Large gate/gang dan defensible wall/tower tetap **referensi desain yang perlu diuji**, bukan asset final yang sudah ada.

## 3. Clean model dan material

Seluruh15 model memuat geometry, normals, UV dan materials; tidak ada nonfinite attribute atau index di luar vertex buffer. Batas geometry dan hierarki disimpan, tidak ada missing mesh yang terlihat. Barrel mengandung **2 triangle degenerat sumber**, tidak menyebabkan crash dan sengaja belum dibersihkan. Roof besar adalah geometry sumber, bukan transform liar.

LOD0 geometry tidak dioptimasi. BLEND nature diekspor dari collection sumber yang lengkap. Tekstur grayscale16-bit yang tidak cocok jalur decode diperbaiki hanya pada staging menjadi RGB; image datablock Blender di-remap ke hasil decode sehingga foliage alpha/albedo tidak hilang. Source tidak disentuh.

Enam controlled remap benar-benar tampil: stone_architecture, wood, plaster_brick, roof_tile, metal, fabric_banner. Banner menggunakan slot sumber **MI_Banner**, tidak mengganti material kayu seluruh banner. Semua slot/model tetap memakai UV sumber. Default tetap **KEEP_SOURCE_MATERIAL**; toggle menampilkan REMAP_TO_LUMENFALL sebagai proof teknis. Stone/wood/roof remap kehilangan detail trim-atlas dan memperlihatkan peregangan/perulangan: **belum final art approval**. Perlu UV/trim-compatible treatment dan texel density konsisten. Tidak dilakukan remap massal47 aset.

Tekstur sumber tak ditimpa: architecture/props dan contoh remap diturunkan ke1K PNG; nature tetap2K. Color sRGB; data normal/roughness/metal Non-Color. Material shared, tidak menduplikasi texture per rumah. Rekomendasi produksi: tetapkan budget material, KTX2 bila valid, ukur 1K nature versus2K pada kamera pemain. Belum diimplementasikan massal.

## 4. Collision dan actual WASD

Chrome headed 151.0.7922.108, viewport1600×950. Game runtime asli, input WASD asli, player model asli, storage in-memory, enemy0. Collision tambahan di subclass/scene dev saja; tidak mengganti sistem game global.

| Cek | Hasil dan batasan |
|---|---|
| Wall | PASS: karakter berhenti di depan compound box |
| Gate | PASS: menyeberangi doorway tanpa menembus jamb |
| Rumah | PASS: masuk dari doorway dan tertahan sisi belakang |
| Tangga | PASS: naik ke sekitar1.48 lewat ImportedMapGround ramp/landing |
| Pohon | PASS: trunk radius0.17 memblokir; canopy bukan collider |
| Batu | PASS anti-penetrasi; AABB konservatif, jarak sisi/sudut belum sepresisi hull |
| Kamera | PASS drag kanan dan posisi finite dekat struktur; probe box lokal, roof/canopy belum sepenuhnya covered |

Tidak semua render mesh dijadikan collision. Wall/jamb/lintel: simple volumes; rumah/tower: compound; tree: lower trunk; batu: conservative box sebagai pilot; props kecil: none; walk surfaces: ImportedMapGround. Step sweep0.12 dan radiusavatar0.45 untuk probe box dev. Hasil angka dan volume disimpan di [collision metadata](../data/assets/kingdom-city-pilot-collision-a3.json). Ini belum stress test crowd, interior lengkap, city navigation atau camera roof occlusion.

## 5. LOD: hasil nyata, bukan sekadar file berhasil diekspor

- Source architecture GLTF pilot tidak memberi chain LOD siap pakai. LOD1/2 turunan diuji hanya modul house/wall/tower. SimplifyModifier merusak seam/roof, terlihat lubang/tiles terpisah: **HOLD kedua level architecture**, gunakan original LOD0. Wall86 tri terlalu ringan untuk perlu simplifikasi ini.
- Nature BLEND punya bagian daun bernamaLOD, tetapi itu bukan bukti tiga complete-tree runtime LOD. Tree lengkap sumber **2,062,487 tri**. Turunan tree LOD1 **134,817 tri**, LOD2 **70,415 tri**. Decimation terpisah trunk/branches/leaves mempertahankan batang; uniform decimation awal yang merusak batang tidak dipakai.
- LOD1 tree dapat digunakan untuk eksperimen performa, tetapi canopy berkurang; LOD2 jelas terlalu jarang untuk dekat. **Keduanya perlu art review sebelum produksi**, tidak ditentukan jarak auto-LOD/impostor final.
- Rock66,122 tri belum dioptimasi karena di luar scope LOD terbatas. TetapHEAVY untuk pengulangan kota.

## 6. Performance block

Blok uji:10 house assemblies,24 wall standalone,4 towers,20 trees,40 props. Modul wall internal rumah/tower merupakan tambahan di luar24. Bukan layout kota. Pengukuran90 frame sesudah warm-up1.5 detik; shadow aktif; browser yang sama. Tidak ada klaim lintas GPU atau minimum hardware.

| Mode | FPS sampel | Draw calls | Rendered triangles/frame | p95 ms |
|---|---:|---:|---:|---:|
| LOD0 / individual | 37.97 | 662 | 80,461,790 | 33.40 |
| LOD0 / instanced | 37.50 | 36 | 80,461,790 | 33.40 |
| LOD1 / individual | 60.31 | 662 | 4,976,266 | 16.80 |
| LOD1 / instanced | 60.06 | 36 | 4,976,266 | 16.70 |

Instancing mengurangi **662→36 draw calls**, tetapi tidak mengurangi triangles. LOD0 tetap sekitar38 FPS: bottleneck geometry/foliage, bukan hanya submit calls. LOD1 sekitar60 FPS, tetapi itu **bukan persetujuan kualitas visual LOD**. Rendered triangle counters dapat mencakup shadow/material passes, bukan unique source geometry. Frame limit/vsync sekitar60 ikut memengaruhi hasil.

Material switch aktual **belum diinstrumentasi**; dicatat16 material unik,38 texture dan draw calls, tidak menyebutnya jumlahswitch. Perkiraan referenced RGBA8+mip texture **390.67 MiB**, bukan VRAM terukur; mengecualikan driver/framebuffer/karakter. PNG kecil di disk tidak berarti hemat VRAM. Seluruh staging terpilih+source-copy+evidence saat audit sekitar616.96 MiB, bukan production payload.

## 7. Repeated assets dan city chunking — rencana saja

Instance menurut asset+material+LOD **per spatial chunk**, cocok untuk wall, trunk/tree yang telah disederhanakan, rock, barrel, crate, lamp dan banner statis. House/tower tetap prefab modular; part identik dapat dibatch, perubahan pintu/interior unik tetap object biasa. Collision tetap representasi sederhana terpisah, bukan per instance render raycast.

Usulan awal: spatial cell64–96 unit (perlu profil), logical district outer_gate/market/craft/residential/upper_city/castle sebagai manifest kepemilikan, **tidak dibangun sekarang**. Load chunk terlihat dan tetangganya, collider dekat pemain, cull per chunk, material/geometry reference-counted. Jangan satu global InstancedMesh ribuan object karena menghilangkan granularitas culling. Tetapkan budget texture/triangle/draw berdasarkan target hardware dahulu; jangan muat source-copy dan semua LOD saat produksi seperti alat diagnostik ini.

## 8. Lisensi/provenance dan status

13 GLTF architecture/props: **LICENSE_OK berdasarkan teks CC0 1.0 Universal / Quaternius yang disertakan dalam dua ZIP lokal**, hanya cakupan Standard pack yang dipakai. Evidence sourceEntry dan textcopy ada di provenance staging/catalog. Ini audit dokumen lokal, bukan pendapat hukum atau verifikasi chain kepemilikan eksternal.

Tree, boulder, keenam remap material: **LICENSE_UNKNOWN**. Tidak ditemukan bukti lisensi yang memadai di metadata/file yang diinspeksi; nama asset/folder tidak dianggap bukti. Local test boleh berjalan sesuai scope owner, tetapi publikasi/production hold.

Semua 15: TECH_VALIDATED dalam lingkup teknis yang disebutkan, masing-masing punya blocker. **Tidak ada asset yang dipromosikan PRODUCTION_READY_CANDIDATE pada fase ini.** Gagal/rejected derivative: architecture LOD1/2; tree LOD2 untuk close view; bukan penghapusan asset asli. Barrel2 degenerates dicatat. Unknownlicense tidak disembunyikan oleh status TECH_VALIDATED.

## 9. Hero gaps dan spesifikasi berikutnya

1. **Palace/castle shell**: custom silhouette, badan/roof/wall/courtyard yang modular pada grid3 unit, gate besar sekurangnya usulan3×4.8 dengan avatar 2.4, pivot/snap jelas, shell exterior dan interior opsional terpisah, collision sederhana dan roof-camera test. Jangan upscale cottage ini menjadi palace.
2. **Religious landmark**: silhouette berbeda dari roof village (nave/sanctum/tower atau bentuk original LUMENFALL), ruang masuk minimal normal door, material trim/UV konsisten, opsi interior dan collider terpisah. Ukuran footprint ditentukan layout kelak, bukan diinvent pada pilot.
3. **Road/plaza kit**: grid3 unit, jalan utama6/gang3 sebagai test reference; straight/corner/T/cross/edge/curb/stair/ramp, sambungan slope dan seam terukur, tiling PBR dan collision ground. Jalan pilot masih primitive netral, bukan kit final.
4. Lengkapi lisensi nature/material, foliage LOD artist-authored, rock hull, camera roof collision, trim-safe remap dan texture budget sebelum kota besar.

## 10. Evidence dan cara membuka

Viewer: http://127.0.0.1:3006/tests/browser/kingdom-pilot.html (localhost dev saja). Jalankan node node_modules/vite/bin/vite.js --config tests/browser/kingdom-pilot.vite.config.ts jika server berhenti. WASD, drag kanan kamera, pilih titik inspeksi, collision debug, remap dan LOD. Tidak membuat save permanen.

| Evidence | File |
|---|---|
| Player–gate | [01-player-gate.png](../dev-assets/kingdom-city-pilot-a3/evidence/01-player-gate.png) |
| House entrance | [02-player-house.png](../dev-assets/kingdom-city-pilot-a3/evidence/02-player-house.png) |
| Wall/tower | [03-wall-tower.png](../dev-assets/kingdom-city-pilot-a3/evidence/03-wall-tower.png) |
| Street | [04-street.png](../dev-assets/kingdom-city-pilot-a3/evidence/04-street.png) |
| Tree/rock | [05-tree-rock.png](../dev-assets/kingdom-city-pilot-a3/evidence/05-tree-rock.png) |
| Collisiondebug | [06-collision.png](../dev-assets/kingdom-city-pilot-a3/evidence/06-collision.png) |
| Remapbuilding | [07-material-remap.png](../dev-assets/kingdom-city-pilot-a3/evidence/07-material-remap.png) |
| Fabric/metal remap | [07b-fabric-metal-remap.png](../dev-assets/kingdom-city-pilot-a3/evidence/07b-fabric-metal-remap.png) |
| Overview | [08-overview.png](../dev-assets/kingdom-city-pilot-a3/evidence/08-overview.png) |
| Walk upstairs | [walk-stairs.png](../dev-assets/kingdom-city-pilot-a3/evidence/walk-stairs.png) |
| Camera | [camera-near-wall.png](../dev-assets/kingdom-city-pilot-a3/evidence/camera-near-wall.png) |

Tambahan tree LOD0/1/2 dan empat performance screenshot ada di directory evidence. Screenshot adalah bukti visual, bukan pengganti collision assertions.

## 11. Verifikasi teknis, outputs, keamanan

- Headed Chrome: **7/7 cek lulus**, error0, consolewarning0, HTTPgagal0.
- Primary lib/game TypeScript saat audit awal5 error, sesudah5; A3new diagnostics 0. Historical 6 error bukan baseline aktual turn ini. Whole workspace 75 diagnostics termasuk folder dev/output lama; file log menyimpan detail. TypeScript keseluruhan **belumclean**.
- Build entry Vite pilot exit0. DEV guard membuat build production stub penolakan dan tidak menyalinpublic; **bukan klaim full game production build lulus**. Full suite game tidak dijalankan karena A3 tidak mengubah production game code.
- Sepuluh arsip sumber di-hash SHA256 sebelum/selesai staging dan final: **10/10 identik**. Hash lengkap di catalog A3. Tidak ada extraction massal, rename/delete/overwrite original.
- Lifecycle: pagehide mematikanRAF, Game.dispose dan geometry/material/texture/InstancedMesh dev; storage memori, transition disabled. Tidak ada dependency baru atau production route baru.
- Files A3: scripts/prepare-kingdom-pilot-a3.mjs, scripts/convert-kingdom-pilot-a3.py, scripts/finalize-kingdom-pilot-a3.mjs; tests/browser/kingdom-pilot.html/.css/.ts, kingdom-pilot-scene.ts, kingdom-pilot.vite.config.ts, kingdom-pilot-verify.mjs; empat JSON di data/assets; laporan ini; derived staging dan evidence di dev-assets/kingdom-city-pilot-a3.

**Rekomendasi akhir:** boleh memakai subsetarchitecture/props pada greybox kecil yang di-stream bertahap. Jangan menganggap hasil ini izin membangun full city dengan pohonLOD0, unknown license atau LODcacat. Tidak ada kota/progression/map produksi yang diubah, tidak publish. STOP setelah pilot.
