# LUMENFALL Master Asset Library â€” Phase A1 Audit

Status: **AUDIT SELESAI â€” INDEXED, belum diimport ke production**

## Ringkasan pemilik

- Source yang diminta D:\Model\_Asset\_Lumenfall tidak ada pada host. Folder authoritative yang tersedia adalah D:\Model_Asset_Lumenfall; seluruh angka di report ini memakai folder tersebut.
- Total source files: **94**; ukuran total: **3.208 GiB**.
- Struktur top-level: Master_ Material_ Lumenfall dan Master_Model_Lumenfall, plus gb_nomadwaveundercut.mhpkg dan desktop.ini.
- Arsip: **93** (3.208 GiB): 92 ZIP dan 1 MHPKG yang secara fisik adalah ZIP container UE asset. Tidak ada archive nested yang ditemukan dari listing.
- File asli tidak diubah, dipindah, dihapus, atau diekstrak massal.

## Isi arsip dan format

| Area | Hasil |
|---|---:|
| Model GLTF entries | 270 |
| Model FBX/OBJ/BIN/MTL entries | 270 masing-masing; format alternatif dari model yang sama pada dua mega-kit |
| Blender model packages di Master_Model | 24 package entries |
| Material Blender packages | 66 |
| Model records yang dikatalogkan | 294 (270 GLTF + 24 BLEND package records) |
| Material records yang dikatalogkan | 66 |
| PNG | 261 |
| JPG | 102 |
| EXR | 151 |
| BLEND entries total di seluruh library | 87 (termasuk material packages) |

GLTF dapat dibaca langsung oleh Three.js setelah file dan dependencies diekspor/diakses dari archive; GLTF entry diparse dari dalam ZIP untuk mesh/node/primitive/material/texture URI jika tersedia. FBX/OBJ/MTL/BIN tersedia sebagai alternatif, tetapi belum diekstrak. Blender perlu Blender/offline converter atau export GLB. Texture JPG/PNG/EXR terdeteksi; EXR perlu pipeline loader/converter khusus dan tidak cocok dibebankan langsung ke browser tanpa konversi. Tidak ada GLB/KTX2/TGA/DDS yang terdeteksi pada inventory archive.

## Metadata dan batas audit

GLTF records memuat archive path, entry path, ukuran, format, kategori, mesh/node count, estimasi triangle count dari accessor, material slot count, bounding box jika accessor memberi min/max, texture URI, animation/rig flag, dan performance class. Collision, LOD, pivot/origin, unit scale, serta license tidak bisa dipastikan dari filename/listing sehingga ditandai UNKNOWN. Blender/FBX/OBJ package yang belum diekstrak juga tetap UNKNOWN, bukan diasumsikan memiliki collision atau LOD.

MHPKG gb_nomadwaveundercut.mhpkg terbaca normal sebagai ZIP container berisi GB_NomadWaveUndercut.uasset UE5 Groom/Hair asset (string internal menunjukkan UE5.7 dan HairStrandsCore). Ini bukan model environment kerajaan yang terkonfirmasi dan tidak dimasukkan ke Kingdom City Kit.

## Kategori yang terdeteksi

Model library kuat untuk **architecture modular**, props kota, natural assets dan vegetation. MegaKit Medieval Village berisi pieces seperti wall, roof, floor, stair, doorframe, window, balcony, fence, vine dan wagon. Fantasy Props berisi anvil, barrel, bench, crate, banner, stall/cart, workbench, lantern, furniture dan market props. Individual environment packages menyediakan modular fort, large castle door, wooden pier, trees, shrubs, grass, rocks.

Kandidat yang jelas untuk kingdom city: modular fort, large castle door, Medieval Village wall/roof/floor/stair/doorframe pieces, Fantasy Props banners/stall/cart/anvil/workbench/bench/barrel/crate/lantern, village fences, trees/rocks. Complete castle/palace shell dan complete house prefabs **belum dikonfirmasi** hanya dari audit arsip.

## Kingdom City Kit V1

Kit terkurasi machine-readable ada di kingdom-city-kit-v1.json, dengan ID asset nyata dari model catalog. Target tetap kira-kira 50â€“100 item. Status seluruh item SHORTLISTED, bukan PRODUCTION_READY. Kit memprioritaskan modular fort/castle door, village walls/roofs/floors/stairs/doors, props pasar, fences/banners, vegetation dan rocks. Karena sumbernya modular, kit perlu assembly test sebelum kota dibangun.

Missing/needs follow-up: complete palace/castle shell, confirmed church/shrine landmark, road/plaza prefabs yang benar-benar modular, collision/LOD validation, license/source provenance, and asset thumbnails. Existing Terrain/Stone_Architecture/Roof material packages can support the visual family but are not proof of model collision or final material import readiness.

## Preview dan next step

Thumbnail tidak dibuat pada Phase A1 karena model masih berada dalam archive dan audit read-only tidak mengekstrak asset. Preview aman menjadi Phase A2 terbatas: pilih 10â€“20 shortlist, ekstrak hanya dependencies yang diperlukan ke staging di luar production, load GLTF/GLB/OBJ melalui Three.js, lalu render neutral preview. Jangan ekstrak atau convert semua kit.

### Output files

- data/assets/master-model-catalog.json
- data/assets/master-material-catalog.json
- data/assets/kingdom-city-kit-v1.json
- data/assets/asset-audit-summary.json
- docs/LUMENFALL_Master_Asset_Library_Phase_A1_Report.md

Generated from archive listings and readable GLTF JSON only. No production map, active terrain prototype, gameplay, save, monster, item, or public asset bundle was changed.
