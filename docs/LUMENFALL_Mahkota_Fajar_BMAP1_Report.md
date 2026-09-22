# LUMENFALL — Mahkota Fajar BMAP-1

## Status

Development-only Blender map candidate. The original `.blend` remains read-only and the previous `lumenfall-kingdom-capital-v11` map was not overwritten.

## Owner summary

`LUMENFALL_Medieval_City.blend` berhasil dibaca oleh Blender 5.2.1 LTS dalam mode background. Scene kandidat yang dipakai adalah `LF_City_Reference_Rebuild`; tidak ada redesign, pemindahan object, perubahan terrain, atau perubahan penempatan selama ingest.

Runtime candidate tersedia di:

`http://127.0.0.1:3008/tests/browser/mahkota-fajar-blend.html`

Map Review Mode dapat dibuka dengan `F8`.

## Audit sumber

| Item | Hasil |
|---|---:|
| Scene utama | `LF_City_Reference_Rebuild` |
| Scene lain | `Scene` |
| Object pada scene utama | 9.970 |
| Mesh datablock | 8.410 |
| Material | 41 |
| Image/texture datablock | 15 |
| Light | 4 |
| Camera | 5 |
| Curve | 30 |
| Armature / particle system | 0 / 0 |
| Geometry node group | 1 |
| Unit | Metric, meter, scale 1.0 |
| Bounding box Blender | 600 × 489,07 × 106,57 |
| External linked library | Tidak ada |
| Missing image dependency | Tidak ada; image ter-pack |

Collection utama yang terbaca: terrain, city wall, main gate, castle, roads/stairs/plaza, buildings, market, blacksmith, props, vegetation, water, farmland, bridges, lighting, dan cameras.

## Runtime ingest

Scene diekspor ke GLB staging:

`dev-prototypes/mahkota-fajar-blend-v1/assets/LUMENFALL_Medieval_City.glb`

Transform Blender Z-up ke runtime Three.js Y-up dilakukan oleh exporter glTF. Tidak ada faktor skala arbitrer yang diterapkan. Runtime memakai GLB sebagai map visual, bukan parser `.blend` langsung.

Player spawn sementara: `DEV_TEMP_SPAWN`, runtime sekitar `[0, 4.1, 90]`. Player tampil dan uji WASD bergerak dari z=90,0 ke z=88,8 sambil tetap berada di ground collision.

Terrain collision memakai subset mesh bermaterial `GRASS`, `ROAD`, `COBBLE`, `ROCK`, `ROCK_LIGHT`, `WHEAT`, dan `1001`. Collision bangunan, dinding, dan props belum diauthor secara terpisah pada fase ini.

## Material dan batas teknis

Image yang ter-pack ikut terbawa ke GLB. Material berbasis image dapat ditampilkan. Material Blender yang hanya memakai Noise/ColorRamp/procedural tidak dapat dibawa 1:1 oleh glTF; export staging memberi fallback diffuse dari warna material sumber agar scene tetap terbaca. Ini adalah **TRANSLATION_REQUIRED**, bukan perubahan pada sumber Blender.

Hasil headed browser menunjukkan kota dan landscape tampil, tetapi ada isu fidelity/presentasi yang masih perlu dicatat: beberapa material/alpha/procedural tampil kasar atau berbintik, terutama pada terrain/vegetation, dan skala scene sangat berat untuk browser.

## Review Mode dan validasi browser

- Map Review Mode V1 terintegrasi pada candidate baru.
- `F8` menampilkan panel Pin, Area, Object, Measure, camera presets, Focus ID, dan Export Review.
- Kamera tersedia: 45° Overview, Top-down, Main Entrance, City Center, Castle, Main Street, WASD Player.
- Player terlihat pada ground-eye view.
- Console browser: 0 error dan 0 warning pada pass verifikasi.

## Performance observation

Dalam headed Codex In-app Browser, scene berada sekitar 11–12 FPS pada overview dengan sekitar 24.729–26.060 draw calls dan sekitar 33,9 juta triangles; player view turun sekitar 10–11 FPS dan sekitar 10.800 draw calls pada frame yang terlihat. Tidak ada optimasi, instancing, LOD, chunk culling, atau simplifikasi yang dilakukan karena kontrak BMAP-1 meminta preservation terlebih dahulu.

## Perbandingan terhadap sumber

| Bagian | Hasil |
|---|---|
| Terrain/topology | MATCH secara struktur dan posisi relatif |
| Building placement | MATCH melalui scene export |
| Castle/walls/roads/stairs | MATCH secara scene/object placement |
| Vegetation/water | MATCH secara object placement; material dapat berbeda |
| Materials | PARTIAL MATCH karena keterbatasan procedural-to-glTF |
| Lighting | PARTIAL MATCH; diterjemahkan ke runtime light rig |
| Player traversal | PARTIAL: terrain dasar berjalan, collision struktur belum lengkap |

## Hash dan safety

- Source `.blend` SHA-256: `4101F3DB3210FC73FBCE802B6232D29FC8AB41ADF41D35292815105CC03A7A9E`
- Source size: 49.761.911 bytes
- Staging GLB SHA-256: `13C19EC662379C6AE46994C9FD0486DBC7FAF6B32AC41774B019D2ACD48542CF`
- Source tidak ditimpa atau disimpan ulang.
- Tidak ada asset production map lama yang ditimpa.
- Tidak ada monster, NPC, quest, drop, progression, atau publish.

## Kesimpulan BMAP-1

Candidate map berhasil dimuat dan dapat direview dalam runtime terpisah. Layout/terrain/castle/building placement dipertahankan sebagai ingest 1:1 secara struktural. Map belum siap menjadi basis redesign produksi karena dua blocker nyata: material procedural/alpha belum setara dengan Blender dan performa browser sangat berat. Tahap berikutnya sebaiknya audit material fidelity serta strategi chunk/LOD/collision terpisah, setelah owner menyetujui bahwa candidate ini memang menjadi basis baru.
