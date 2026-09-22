# LUMENFALL Kingdom City Asset Validation â€” Phase A2

Status: **VALIDASI VISUAL DEVELOPMENT SELESAI â€” greybox kit, belum production-ready**

## Ringkasan

- Shortlist input: **72 ID unik** dari 74 referensi shortlist V1.
- GLTF yang masuk staging dan berhasil dimuat viewer: **57**.
- BLEND yang ditahan untuk conversion terkontrol: **15**.
- APPROVED untuk A2 greybox: **47**.
- HOLD: **25**.
- REJECTED_FOR_CITY: **0**; tidak ada asset dibuang permanen.

## Hasil validasi

Viewer development-only tersedia melalui 	ests/browser/kingdom-city-kit.html dengan Vite config khusus A2. Viewer memuat GLTF, material dependency, 3/4 orbit, wireframe, bounds, source metadata, triangle count, material count, dan proxy karakter 1.75m. Source scale tidak diubah.

Keluarga arsitektur dominan: **STYLE_A_MEDIEVAL_VILLAGE_MODULAR** dari Medieval Village MegaKit. Fantasy Props dipakai sebagai pendukung market/craft/street, bukan sebagai arsitektur utama.

## Scale, material, collision, LOD, license

Scale seluruh asset tetap **UNKNOWN_SCALE** sampai dilakukan kalibrasi in-world terhadap karakter nyata dan modul pintu/rumah. Tidak ada random per-object scale.

Material dependency GLTF berhasil dibaca dan dipetakan secara rekomendatif ke stone_architecture, wood, plaster_brick, oof_tile, metal, dan abric_banner. Remapping belum dilakukan.

Collision, LOD, dan license tetap **UNKNOWN/MISSING** dari data yang tersedia. Asset belum boleh disebut production-ready.

## Missing assets

- complete palace/castle shell
- religious landmark
- final road/plaza kit
- collision mesh terverifikasi
- LOD terverifikasi
- license/provenance confirmation

Fortification dan vegetation BLEND tetap HOLD. Tidak ada conversion massal atau Blender opening massal.

## Preview

Preview interaktif, contact-sheet, dan composition tests development: 	ests/browser/kingdom-city-kit.html, 	ests/browser/kingdom-city-kit-sheets.html, dan 	ests/browser/kingdom-city-kit-compositions.html. Semua hasil staging berada di dev-assets/kingdom-city-kit-v1/.

## Kesimpulan

Kit final cukup untuk **greybox awal**, tetapi belum cukup untuk production city. Langkah berikutnya yang aman adalah conversion terbatas untuk satu fortification package, satu tree, dan satu rock, lalu kalibrasi scale/collision/LOD.
