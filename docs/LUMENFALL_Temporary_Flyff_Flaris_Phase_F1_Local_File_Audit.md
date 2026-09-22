# LUMENFALL — Temporary Flyff Flaris Import Experiment
## Phase F1 — Local File Audit

Tanggal audit: 20 September 2026  
Sumber: `D:\FlyffUS`  
Mode: read-only

## Kesimpulan pemilik

Data Flyff lokal memang memiliki asset yang menyebut Flaris, tetapi audit belum menemukan satu paket world Flaris yang berdiri sendiri dan langsung dapat diimpor ke LUMENFALL. Flaris kemungkinan merupakan area di dalam world tiled `WdMadrigal`.

Kesimpulan teknis saat ini: **reconstructable sebagian (D)**. Asset tekstur tertentu dapat dibaca langsung, tetapi terrain, object placement, collision, dan relasi world masih berada dalam format proprietary Flyff yang memerlukan parser/converter khusus. Tidak ditemukan bukti cukup untuk menyatakan format tersebut terenkripsi, namun formatnya opaque/proprietary dan tidak boleh dibypass bila ternyata memiliki proteksi.

Tidak ada file Flyff yang dihapus, dipindahkan, ditimpa, atau dikonversi. Tidak ada perubahan pada map production LUMENFALL dan tidak ada publish/import gameplay.

## Ringkasan inventaris

| Area | Jumlah | Ukuran total | Temuan utama |
|---|---:|---:|---|
| Seluruh `D:\FlyffUS` | 34.902 file | — | client, archive, model, world, texture, audio |
| `World` | 2.086 | 845.356.255 byte | 1.915 `.lnd`, 171 `.res` |
| `World\WdMadrigal` | 900 `.lnd`, 58 `.res` | — | tiled world yang paling mungkin memuat Flaris |
| `Model` | 29.447 | 3.495.872.056 byte | 6.211 `.o3d`, 434 `.chr`, 3.453 `.ani`, 19.179 `.dds` |
| `Theme` | 1.391 | 413.040.012 byte | world/monster map, ikon, material/theme |

## File yang secara eksplisit menyebut Flaris

### Model dan texture karakter/part

File-file ini bukan map Flaris. Namanya menunjukkan part kostum/character bertema Flaris.

| Full path | Extension | Size | Format/readability | Klasifikasi |
|---|---:|---:|---|---|
| `D:\FlyffUS\Model\Part_fFlarisShicap.o3d` | `.o3d` | 3.030 B | binary proprietary mesh | B — perlu converter |
| `D:\FlyffUS\Model\Part_fFlarisShiCloak.o3d` | `.o3d` | 32.800 B | binary proprietary mesh | B — perlu converter |
| `D:\FlyffUS\Model\Part_mFlarisShicap.o3d` | `.o3d` | 4.842 B | binary proprietary mesh | B — perlu converter |
| `D:\FlyffUS\Model\Part_mFlarisShiCloak.o3d` | `.o3d` | 32.800 B | binary proprietary mesh | B — perlu converter |
| `D:\FlyffUS\Model\Texture\Part_fFlarisShicap.dds` | `.dds` | 196.736 B | DDS standar, langsung terbaca | A untuk texture |
| `D:\FlyffUS\Model\Texture\Part_fFlarisShiCloak.dds` | `.dds` | 786.560 B | DDS standar, langsung terbaca | A untuk texture |
| `D:\FlyffUS\Model\Texture\Part_mFlarisShicap.dds` | `.dds` | 196.736 B | DDS standar, langsung terbaca | A untuk texture |
| `D:\FlyffUS\Model\Texture\Part_mFlarisShiCloak.dds` | `.dds` | 786.560 B | DDS standar, langsung terbaca | A untuk texture |
| `D:\FlyffUS\Model\TextureLow\Part_fFlarisShicap.dds` | `.dds` | 196.736 B | DDS standar, low variant | A untuk texture |
| `D:\FlyffUS\Model\TextureLow\Part_fFlarisShiCloak.dds` | `.dds` | 786.560 B | DDS standar, low variant | A untuk texture |
| `D:\FlyffUS\Model\TextureLow\Part_mFlarisShicap.dds` | `.dds` | 196.736 B | DDS standar, low variant | A untuk texture |
| `D:\FlyffUS\Model\TextureLow\Part_mFlarisShiCloak.dds` | `.dds` | 786.560 B | DDS standar, low variant | A untuk texture |
| `D:\FlyffUS\Model\TextureMid\Part_fFlarisShicap.dds` | `.dds` | 196.736 B | DDS standar, mid variant | A untuk texture |
| `D:\FlyffUS\Model\TextureMid\Part_fFlarisShiCloak.dds` | `.dds` | 786.560 B | DDS standar, mid variant | A untuk texture |
| `D:\FlyffUS\Model\TextureMid\Part_mFlarisShicap.dds` | `.dds` | 196.736 B | DDS standar, mid variant | A untuk texture |
| `D:\FlyffUS\Model\TextureMid\Part_mFlarisShiCloak.dds` | `.dds` | 786.560 B | DDS standar, mid variant | A untuk texture |

### World/theme/map references

| Full path | Extension | Size | Struktur/fungsi yang dapat dipastikan | Klasifikasi |
|---|---:|---:|---|---|
| `D:\FlyffUS\Theme\English\WORLD_flaris.dds` | `.dds` | 2.457.728 B | DDS standar, 1280×960; kemungkinan world/map preview atau theme texture, bukan bukti heightmap | A untuk dibaca, B untuk dipakai sebagai map asset |
| `D:\FlyffUS\Theme\Default\TexMapMonster_Flaris.bmp` | `.bmp` | 72.056 B | BMP 120×200, 24-bit; atlas/map ikon monster | A untuk dibaca |
| `D:\FlyffUS\Theme\English\TexMapMonster_Flaris.bmp` | `.bmp` | 72.056 B | BMP 120×200, 24-bit; atlas/map ikon monster | A untuk dibaca |
| `D:\FlyffUS\Theme\Default\texMapMonster_Flaris.inc` | `.inc` | 2.724 B | teks; mendefinisikan atlas monster dan item/icon terkait | A untuk dibaca, B untuk dipetakan |
| `D:\FlyffUS\Theme\English\texMapMonster_Flaris.inc` | `.inc` | 2.724 B | teks; isi ekuivalen untuk locale English | A untuk dibaca, B untuk dipetakan |

Isi `.inc` mengonfirmasi fungsi atlas UI, misalnya `MI_AIBATT`, `MI_MUSHPANG`, `MI_BURUDENG`, dan item icon terkait. Ini bukan object placement atau spawn data world.

### Audio bertema Flaris

| Full path | Extension | Size | Fungsi | Klasifikasi |
|---|---:|---:|---|---|
| `D:\FlyffUS\Music\BgmFi1Flaris.ogg` | `.ogg` | 2.281.639 B | musik/background audio | A untuk dibaca, tidak relevan untuk rekonstruksi map |
| `D:\FlyffUS\Music\BgmNEWFLARIS.ogg` | `.ogg` | 2.514.763 B | musik/background audio | A untuk dibaca, tidak relevan untuk rekonstruksi map |
| `D:\FlyffUS\Music\BgmTo1Flaris.ogg` | `.ogg` | 2.699.316 B | musik/transisi area | A untuk dibaca, tidak relevan untuk rekonstruksi map |

## World, terrain, dan object placement

### Terrain

World utama memiliki tile `.lnd`, termasuk 900 tile di `D:\FlyffUS\World\WdMadrigal`. Header `.lnd` bersifat binary proprietary dan tidak menyerupai format gambar/GLB/OBJ. Struktur awal memuat nilai yang tampak seperti data grid/float, tetapi audit ini tidak menetapkan resolusi, unit, atau skala tanpa parser resmi/terverifikasi.

Temuan:

- Tidak ada file bernama `Flaris.heightmap`, `Flaris.lnd`, atau heightmap standar terpisah.
- Height data kemungkinan tersimpan di tile `.lnd` dan/atau resource world terkait.
- Splat/layer terrain dan material tidak dapat dipastikan dari raw header.
- `WORLD_flaris.dds` adalah texture 1280×960, bukan bukti height data.

Klasifikasi: **C/D** — membutuhkan parser world/terrain dan pemetaan tile Flaris di dalam `WdMadrigal`.

### Tile dan resource world yang relevan

Contoh file yang terbaca sebagai binary proprietary:

| Full path/family | Extension | Fungsi kemungkinan | Akses |
|---|---:|---|---|
| `D:\FlyffUS\World\WdMadrigal\WdMadrigal.res` | `.res` | world-level resource/index | custom parser |
| `D:\FlyffUS\World\WdMadrigal\WdMadrigalXX-YY.lnd` | `.lnd` | tile terrain/grid | custom parser |
| `D:\FlyffUS\World\WdMadrigal\WdMadrigalXX-YY.res` | `.res` | tile object/resource/material data | custom parser |
| `D:\FlyffUS\World\Texture\wtex_*.res` | `.res` | world texture resource variants | custom parser |
| `D:\FlyffUS\World\TextureLow\wtexl_*.res` | `.res` | low texture resource variants | custom parser |
| `D:\FlyffUS\World\TextureMid\wtexm_*.res` | `.res` | mid texture resource variants | custom parser |

Nomor `XX-YY` adalah contoh pola nama tile, bukan koordinat LUMENFALL. Nilai X/Y/Z, rotasi, skala, dan asset reference belum bisa diekstrak secara aman dari audit header saja.

### Object placement

Tidak ditemukan file placement Flaris yang readable dan berdiri sendiri. Data placement kemungkinan berada di `.res` tile/world atau archive/resource terkait. Karena raw search tidak menemukan string `Flaris` di world `.lnd/.res`, nama area mungkin disimpan sebagai index numerik atau referensi internal.

Klasifikasi: **C/D** — perlu parser resource dan pemetaan indeks asset. Dependencies kemungkinan mencakup world index, tile `.lnd`, tile `.res`, model `.o3d`, material/texture, dan transform metadata.

### Building, tree, prop, dan material

Tidak ada kumpulan file eksplisit bernama `FlarisBuildings`, `FlarisTrees`, atau `FlarisProps`. Asset kemungkinan memakai ID/nama generik di `Model` lalu direferensikan oleh world resource.

- Mesh Flyff: `.o3d`, proprietary.
- Character/rig: `.chr`, proprietary.
- Animation: `.ani`, proprietary.
- Texture yang dapat dibaca langsung: `.dds`, `.bmp`, `.tga`.
- Material/atlas metadata: `.inc` dan resource proprietary.

GLB/glTF/OBJ/PNG tidak ditemukan sebagai format native Flaris dari audit ini. Konversi mesh membutuhkan converter proprietary yang sah atau export dari runtime/tool resmi. Texture DDS/BMP/TGA secara teknis dapat dikonversi ke PNG/KTX2, tetapi belum dilakukan.

Klasifikasi: **B** untuk texture terbuka; **B/C** untuk mesh dan material.

## Collision

Tidak ditemukan file terpisah bernama `Flaris_collision`, `.col`, atau format collision yang dapat diidentifikasi. Collision dapat tersimpan di world `.res`, `.lnd`, atau runtime-generated dari mesh.

Status: **belum dapat dipastikan**. Klasifikasi **C/D**. Collision tidak boleh diasumsikan dari visual terrain saja karena akan berisiko menghasilkan map yang tidak playable.

## Coordinate system

Audit file-only belum cukup untuk menentukan secara aman:

- up axis;
- unit scale terhadap meter LUMENFALL;
- world origin;
- rotasi Euler/quaternion dan urutan sumbu;
- apakah koordinat placement memakai origin tile atau world origin.

Jangan mengonversi koordinat berdasarkan asumsi Y-up/Z-up atau skala 1:1. Nilai tersebut harus diperoleh dari parser/export yang sah atau pengukuran runtime yang terverifikasi.

Status: **C — unknown until parser/export validation**.

## Gameplay data — hanya dilaporkan

Tidak ada import gameplay dilakukan.

- NPC placement: tidak ditemukan sebagai file readable bernama Flaris; kemungkinan berada di world resource/index.
- Monster placement/spawn: atlas UI Flaris tersedia, tetapi itu bukan spawn data. Spawn kemungkinan berada di resource/world data atau server-side data yang tidak teridentifikasi dari client file saja.
- Quest marker/quest logic: tidak ditemukan sebagai data map Flaris yang readable dalam audit ini.

Status untuk ketiganya: **C/D**, perlu sumber data resmi/terstruktur lain. Data tersebut sengaja tidak disentuh untuk eksperimen geometry-only.

## Archive, package, dan perlindungan

`data.res`, `dataSub1.res`, `dataSub2.res`, world `.res`, serta tile `.res` memakai binary header proprietary dan tidak dapat dibaca sebagai ZIP/PNG/GLB biasa. Raw string scan sederhana tidak menemukan metadata Flaris di world resource.

Ini belum membuktikan encryption/DRM. Namun formatnya opaque/proprietary. Tidak dilakukan cracking, bypass, unpacking paksa, atau reverse engineering proteksi. Bila pemeriksaan legal/teknis berikutnya menemukan encryption, DRM, atau access protection, proses harus berhenti sesuai scope eksperimen ini.

`config.ini` juga tidak terbaca sebagai konfigurasi plain text biasa dan tidak dipakai untuk menebak kunci atau melakukan bypass.

## Klasifikasi keseluruhan

| Komponen | Klasifikasi | Alasan |
|---|---|---|
| Flaris DDS/BMP/OGG/INC yang eksplisit | A | dapat dibaca langsung, tetapi bukan full map |
| Texture untuk dev sandbox | A/B | dapat digunakan setelah isolasi dan pengecekan hak penggunaan |
| Mesh `.o3d` | B/C | perlu converter/parser; belum GLB/glTF |
| Terrain `.lnd` | C/D | perlu parser dan identifikasi tile Flaris |
| Placement `.res` | C/D | transform/reference belum terbaca |
| Collision | C/D | belum ada file collision terpisah yang teridentifikasi |
| NPC/monster/quest | C/D | hanya dilaporkan, tidak diimport |
| Full direct import Flaris | E untuk saat ini | tidak ada world package self-contained dan pipeline import terverifikasi |
| Full reconstruction experiment | D | mungkin, setelah parser/export dan koordinat tervalidasi |

## Blocker utama

1. Flaris tidak teridentifikasi sebagai world package mandiri; kemungkinan perlu memetakan tile area di `WdMadrigal`.
2. Format `.lnd/.res/.o3d/.chr/.ani` proprietary dan belum ada parser/converter yang terverifikasi di project.
3. Placement, collision, material binding, dan coordinate system belum dapat diekstrak dengan aman.
4. Asset Flaris yang eksplisit sebagian besar adalah theme/icon/audio/character part, bukan bangunan dan terrain map.
5. Hak penggunaan/redistribusi asset Flyff belum ditetapkan; eksperimen harus tetap lokal/development-only sampai statusnya jelas.

## Rekomendasi Phase F2 — langkah terkecil

Jangan mulai full import. Langkah terkecil yang disarankan:

1. Dapatkan parser/export path yang sah untuk satu tile `WdMadrigal` yang dipastikan berada di area Flaris, atau gunakan export dari tool/runtime resmi.
2. Ekspor hanya satu slice terrain dan 1–3 object reference ke format netral sementara: terrain mesh/height data + JSON placement.
3. Validasi sumbu, unit, origin, dan collision pada viewer terpisah.
4. Buat map development terisolasi bernama `flyff-flaris-import-test`.
5. Masukkan hanya satu building dan beberapa tree/prop setelah dependency mesh/texture berhasil dipetakan.
6. Jangan membawa NPC, monster, quest, drop, atau gameplay Flyff ke LUMENFALL.

Jika tidak tersedia parser/export yang sah, alternatif aman adalah rekonstruksi manual berbasis referensi visual/runtime capture menggunakan asset placeholder atau asset yang hak pakainya jelas. Itu akan menjadi rekonstruksi, bukan direct import.

## Status akhir F1

Audit file lokal selesai dalam mode read-only. Tidak ada file Flyff atau LUMENFALL yang diubah. Tidak ada converter dijalankan, tidak ada import, tidak ada publish, dan tidak ada gameplay Flyff yang dipindahkan.

**F1 recommendation: lanjut hanya ke F2 parser/export validation terisolasi; jangan full import.**
