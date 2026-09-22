# LUMENFALL — Temporary Flyff Flaris Import Experiment
## Phase F2 — Beast / WdMadrigal Tile Identification + One-Tile Export Validation

Tanggal: 20 September 2026  
Sumber: `D:\FlyffUS`  
Mode: read-only

## Ringkasan owner

Phase F2 **belum dapat melanjutkan ke ekspor satu tile** karena tidak ditemukan tool/editor/parser Flyff lokal yang dapat membuka `WdMadrigal` secara normal, dan tidak ada metadata world terbuka yang cukup untuk mengidentifikasi Flaris dengan bukti koordinat.

Saya tidak memilih tile secara tebakan, tidak menjalankan brute-force terhadap format proprietary, tidak membongkar archive secara paksa, dan tidak melakukan bypass proteksi. File asli `D:\FlyffUS` tidak diubah.

Status saat ini:

- Flaris: **UNVERIFIED** di dalam `WdMadrigal`.
- Tile Flaris: **belum dapat dipastikan**.
- Ekspor terrain satu tile: **belum dilakukan**.
- Object placement/model: **belum dapat di-resolve**.
- Coordinate system: **belum tervalidasi**.
- Isolated viewer/LUMENFALL test map: **belum dibuat**, karena confidence belum HIGH/CONFIRMED.

## 1. Tool lokal yang dicari

Pencarian read-only dilakukan pada folder Flyff dan folder developer lokal yang relevan untuk nama/jenis:

- Beast / Beast World Editor;
- World Editor / Map Editor;
- Res Editor / Resource Editor;
- Flyff Editor / Masquerade Editor;
- O3D Viewer / O3D Converter;
- LND/WLD/RES parser;
- exporter atau script pembaca world.

Hasil:

- Tidak ditemukan executable atau source tool yang dapat diidentifikasi sebagai Beast/World Editor/Flyff editor/parser/converter.
- `D:\FlyffUS\Flyff.exe` ada, tetapi itu client game, bukan editor/exporter. Tidak dijalankan untuk membuka atau menyimpan world.
- Tidak ada tool lokal yang aman untuk dijadikan jalur export normal pada fase ini.
- Tidak ada tool internet yang diinstall, sesuai scope.

Pencarian juga tidak menemukan parser yang relevan di project LUMENFALL. Project hanya memiliki renderer/runtime LUMENFALL, bukan reader Flyff `.lnd/.res/.o3d`.

## 2. Struktur WdMadrigal yang benar-benar ada

Folder yang diaudit:

`D:\FlyffUS\World\WdMadrigal`

Hasil file:

| Format | Jumlah | Ukuran total | Status |
|---|---:|---:|---|
| `.lnd` | 900 | 233.086.832 B | binary proprietary tile |
| `.res` | 58 | 214.507.369 B | binary proprietary resource |
| `.wld` | 0 | — | tidak ditemukan |
| `.rgn` | 0 | — | tidak ditemukan |
| `.dyo` | 0 | — | tidak ditemukan |

Tidak ada subfolder atau file berdiri sendiri bernama `Flaris` di world folder. Ini konsisten dengan temuan F1 bahwa Flaris kemungkinan merupakan area di dalam grid `WdMadrigal`.

File resource yang relevan secara struktural:

- `D:\FlyffUS\World\WdMadrigal\WdMadrigal.res` — world-level resource yang kemungkinan menjadi index/resource utama.
- `D:\FlyffUS\World\WdMadrigal\WdMadrigalXX-YY.lnd` — pola nama terrain tile.
- `D:\FlyffUS\World\WdMadrigal\WdMadrigalXX-YY.res` — pola nama tile resource/object/material.

`XX-YY` belum boleh dianggap sebagai koordinat Flaris sebelum dibuktikan oleh editor, loader, atau visual landmark.

## 3. Pemeriksaan format

### `.lnd`

Header dan byte awal adalah binary proprietary, bukan format umum seperti PNG, GLB, OBJ, atau heightmap standar. Satu tile dapat dibaca sebagai byte stream, tetapi belum ada dasar yang sah untuk menetapkan offset/stride/resolusi height grid.

Yang **belum terkonfirmasi**:

- height vertices/grid;
- texture layer/splat IDs;
- terrain paint;
- tile lighting/color;
- object IDs dan transform;
- water/attribute/walkability;
- collision.

Kesimpulan: `.lnd` mungkin berisi terrain lokal, tetapi Phase F2 tidak mengubah dugaan menjadi fakta tanpa loader/editor yang tervalidasi.

### `.res`

`.res` world/tile memiliki header proprietary dan tidak dapat dibaca sebagai archive standar. Belum dapat dipastikan apakah ia menyimpan object placement, resource index, terrain support, atau data lain tanpa parser/loader resmi.

Tidak ditemukan string `Flaris` yang readable di world `.lnd/.res`; area bisa direferensikan melalui index numerik atau metadata di dalam resource.

### `.o3d`

`.o3d` adalah format mesh proprietary Flyff. Tidak ditemukan O3D viewer/converter lokal. Tidak dilakukan konversi.

## 4. Identifikasi Flaris

Flaris **belum teridentifikasi secara visual atau struktural** pada grid `WdMadrigal`.

Belum tersedia bukti untuk:

- town plaza Flaris/Flarine;
- bridge atau road landmark;
- surrounding hills;
- world coordinate;
- tile X/Y yang mengandung town;
- daftar tile tetangga.

Karena confidence masih **UNVERIFIED**, tidak ada tile yang boleh diberi label “Flaris”.

### Tile yang sengaja tidak dipilih

Tile seperti `WdMadrigal00-00.lnd` tidak dipilih sebagai sample karena nama file saja tidak membuktikan bahwa tile tersebut adalah Flaris. Memilihnya akan menghasilkan export yang tidak dapat dipertanggungjawabkan.

## 5. Object placement

Lokasi definitif record object belum dapat ditentukan antara `.lnd`, tile `.res`, world `.res`, atau loader runtime. Akibatnya field berikut belum bisa dipetakan:

- object/model ID;
- position X/Y/Z;
- rotation;
- scale;
- material/texture reference;
- collision flag.

Status: **UNKNOWN — parser/editor blocker**.

## 6. Terrain export dan model conversion

Tidak ada export terrain yang dibuat. Tidak ada mesh yang dibuat dari byte mentah. Tidak ada `.o3d` yang dikonversi ke GLB/glTF/OBJ. Tidak ada texture yang dikonversi.

Alasannya adalah menjaga fidelity dan mencegah menghasilkan terrain palsu akibat asumsi offset, endian, ukuran tile, height scale, atau transform yang salah.

## 7. Coordinate system dan collision

Belum dapat divalidasi:

- up axis;
- handedness;
- forward axis;
- world unit;
- terrain tile world size;
- height scale;
- local/global origin;
- rotation convention;
- scale convention.

Conversion contract Flyff → Three.js belum dibuat karena belum ada angka tervalidasi.

Collision juga belum tervalidasi. Belum diketahui apakah collision berasal dari attribute grid `.lnd`, mesh/object `.o3d`, flags di `.res`, atau collision runtime yang dibuat client.

## 8. Status proteksi

Format `.lnd`, `.res`, dan `.o3d` opaque/proprietary, tetapi audit ini tidak membuktikan encryption/DRM. Tidak dilakukan cracking, password recovery, anti-cheat bypass, unpack paksa, atau exploit.

Jika tool resmi/legitimate nanti melaporkan file protected, proses harus berhenti dan file tidak boleh dibypass.

## 9. Klasifikasi hasil F2

| Area | Klasifikasi |
|---|---|
| Tool lokal editor/parser | Tidak tersedia |
| WdMadrigal world structure | Teridentifikasi sebagian |
| Flaris tile coordinate | Unverified |
| `.lnd` content | Custom parser required |
| Object placement | Custom parser/editor required |
| Terrain export | Belum feasible dengan bukti saat ini |
| O3D conversion | Converter required |
| Texture binding | Belum dapat dikaitkan ke object |
| Coordinate conversion | Belum tervalidasi |
| Collision | Not validated |
| Isolated viewer | Tidak dibuat |
| LUMENFALL dev map | Tidak dibuat |

## 10. Blocker berikutnya

Blocker utama adalah **tidak adanya jalur editor/export/parser yang sah dan dapat dibuktikan**. Reverse-engineering ratusan `.lnd` tidak sesuai arah yang disepakati dan berisiko menghasilkan data salah.

## Rekomendasi Phase F2.1

Langkah terkecil yang aman:

1. Sediakan atau temukan tool/export resmi yang dapat membuka world Flyff secara normal.
2. Buka salinan `WdMadrigal`, bukan folder asli, dalam mode read-only.
3. Cari Flaris memakai landmark visual town/plaza/bridge/hills.
4. Catat satu tile dan tetangganya dari editor.
5. Export satu tile melalui exporter tool tersebut.
6. Baru validasi satu object dan satu texture binding.

Jika tool tersebut tidak tersedia, fase harus berhenti pada audit ini. Alternatifnya adalah rekonstruksi manual berbasis referensi visual, bukan direct import.

## Konfirmasi keamanan

- File asli `D:\FlyffUS` tidak diubah.
- File production LUMENFALL tidak diubah.
- Tidak ada NPC, monster, quest, item, skill, UI, atau audio Flyff yang diimport.
- Tidak ada batch conversion.
- Tidak ada protected-format bypass.
- Tidak ada isolated viewer atau test map yang dibuat karena Flaris belum CONFIRMED/HIGH.
- Tidak ada publish.

**Phase F2 berhenti pada identifikasi tooling dan struktur world. One-tile proof-of-concept belum sah untuk dilakukan tanpa editor/parser yang valid.**
