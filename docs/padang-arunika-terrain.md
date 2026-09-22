# Padang Arunika — laporan implementasi terrain

Tanggal pengujian: 11 September 2026. Hanya field `verdant-plains` yang diubah.
Ini terrain 3D yang dapat dimainkan, bukan gambar peta sebagai lantai game.
Concept art dipakai sebagai arahan suasana; susunan jalur dan geografinya dibuat sendiri.
Tidak ada deployment publik dalam pekerjaan ini.

## 1. Arsitektur sebelumnya

`world.ts` memakai Three.js langsung: shared PlaneGeometry 116×116, tanaman
instanced, pond, dan shrine. `buildRegionDecor` menambah plane/dekorasi region.
`field-layout.ts` menskalakan field dengan sqrt(2), menyebar 36 normal, 5 elite,
dan 1 boss, dengan ID instance serta kunci respawn stabil. Gerakan memakai
batas persegi dan satu pengecekan pond elips. Posisi vertikal player, monster,
NPC, kamera, dan efek sebelumnya mengasumsikan tanah pada y=0.

## 2. Berkas

Implementasi:

- `lib/game/field-terrain.ts` — registry terrain, polygon, height, air, collision, navigasi.
- `lib/game/field-terrain-renderer.ts` — mesh tanah/tebing, landmark, sungai, jembatan, vegetasi.
- `lib/game/field-layout.ts` — penempatan ulang instance monster Padang Arunika.
- `lib/game/regions.ts` — entry, camp, exit dari konfigurasi; travel membaca entry registry.
- `lib/game/rules.ts` — koreksi posisi save yang tidak valid pada terrain baru.
- `lib/game/world.ts` — adapter renderer, actor, NPC, monster, kamera, efek, portal, minimap.

Validasi dan laporan:

- `lib/game/field-terrain.test.ts` — 7 tes khusus terrain dan kompatibilitas.
- `lib/game/field-expansion.test.ts` — validasi spawn mengikuti bentuk terrain baru.
- `lib/game/rules.test.ts` — ekspektasi batas kota mengikuti konfigurasi kota yang sudah ada,
  menggantikan angka lama 44; tidak mengubah implementasi batas kota.
- `scripts/test-verdant-browser.mjs` — 25 pemeriksaan game dalam profil browser terisolasi.
- `docs/padang-arunika-terrain.md` — laporan ini.

Tidak mengubah item registry, monster stat, loot table, quest registry, UI component,
kontrol, maupun struktur save. File ekspor/dokumen pengguna yang sudah ada tidak diubah.

## 3. Boundary organik

Registry `FIELD_TERRAINS` hanya berisi `verdant-plains`. Polygon 64 titik membentuk
plateau tidak simetris. Renderer memakai radial BufferGeometry 48 ring dan 64 sektor,
bukan square floor yang disembunyikan dengan empat deret gunung. Shared terrain lama
tidak dirender di field ini dan tetap digunakan pada seluruh region lain.
Polygon yang sama dipakai untuk batas gerakan, validasi spawn, navigasi, dan minimap.

## 4. Elevasi

Ground camp sekitar y=2,4; dataran tengah bergelombang; river bed turun ke sekitar
y=1,55; arena utara sekitar y=8,3. Lereng sungai dibuat lebar. Height sampler
menginterpolasi segitiga mesh yang benar-benar dirender, sehingga posisi kaki tidak
hanya mengikuti rumus pendekatan. Permukaan jembatan dan tangga memiliki adapter tinggi.
Kamera dan efek mengikuti elevasi. Jarak combat tetap memakai jarak horizontal pada
terrain baru agar tambahan ketinggian tidak diam-diam memperpendek jangkauan serangan.

## 5. Sub-area dan rute

- **Gerbang Fajar, tenggara:** gerbang kayu/batu beratap, plaza kedatangan, camp,
  penunjuk arah, pond di sisi timur, dan sanctuary dekat camp.
- **Padang Lumbung, barat daya:** tiga petak tanaman, saluran irigasi dekoratif,
  pagar rendah, lumbung bertiang, dan pondok. Ruang terbuka di antara area pertanian
  dan dataran tengah tetap dapat dipakai bertarung.
- **Kuil Akar Tua, utara:** bukit tinggi, kuil bertingkat, tangga, pohon besar,
  dan akar di sisi arena. Akses utama memiliki cabang barat dan timur yang terhubung
  melalui dua jembatan. Jalan timur laut menuju tambang.

## 6. Migrasi spawn

Populasi tetap **42: 36 normal + 5 elite + 1 Ancient Treant**. Setiap empat spesies
normal tetap memiliki sembilan instance. ID 0–35, 90–94, dan 100 tetap sama, termasuk
pemetaan ke definisi spesies. Roster terbaru dari registry dipakai tanpa mengganti nama.
Pencarian posisi deterministik memeriksa air, prop, boundary, camp, jembatan,
jarak antarnormal, dan arena. Tidak ada monster state kedua.
HP, attack, level, EXP, drop, dan waktu respawn tetap berasal dari data lama.

## 7. Camp

Penjaga Pos Arunika berada di **(20, 42)**, dekat entry **(28, 39)**. Tenda, peti,
gerobak, api unggun, dan banner menjadi penanda. Safe area terpusat mengecualikan
spawn dan pergerakan monster. Buy, Sell, Teleport, Quest menggunakan menu/fungsi lama.
Interaksi tetap memerlukan klik dan jarak yang sah.

## 8. Arena Ancient Treant

Arena berada di **(0, −36)** dengan radius desain 14. Pusat radius 11 tetap bebas
dari prop pemblokir, termasuk clearance monster boss. Kuil ada di **(−3, −54)**.
Akar serta pohon besar berada di sisi arena; pendekatan selatan dibuka untuk kamera.
Boss tetap memakai ID, reward, stat, dan deadline respawn sebelumnya.

## 9. Transisi

Gerbang selatan di **(28, 48)** kembali ke Kota Arunika. Gerbang tambang berada di
**(40, −28)** pada cabang jalan timur laut, bukan mengambang di dataran kosong.
Klik dari dekat memanggil sistem travel yang sudah ada. Level minimum Tambang
Selubung Besi tetap diberlakukan. `currentField`, `currentCity`, unlock, save, dan
NPC teleport tetap memakai state yang sama.

## 10. Collision dan navigasi

Circle/rectangle collider sederhana melindungi pohon, batu, bangunan, dan tiang
gerbang. Polygon dengan margin membatasi tebing. Sungai serta pond tidak walkable;
dua bridge deck cocok dengan permukaan gerakan. Movement disapu dalam langkah
maksimal 0,3 unit agar dodge/dash/knockback tidak menembus air atau batas.
Monster memakai jalur langsung jika aman, dengan grid navigasi 2-unit yang dicache
untuk mengejar melalui jembatan atau mengitari rintangan. Aggro dan leash tidak diubah.

## 11. Optimasi

Tanah sekitar 3.136 vertex / 6.144 triangle (termasuk segitiga pusat degenerat);
tanaman/pohon/batu memakai instancing. Struktur statis digabung per material.
Height dan navigation grid dicache. Tidak ada texture besar atau model eksternal baru.
Snapshot renderer pada titik gerbang tambang: **78 draw call, 28.406 triangle,
159 geometry** untuk scene yang terlihat saat pemeriksaan. Ini bukan benchmark FPS
untuk semua perangkat maupun nilai maksimum sepanjang gameplay.

## 12. Save compatibility

Posisi lama yang masih sah dipertahankan. Posisi di pond, bangunan, tebing, atau luar
boundary dipindahkan ke titik aman terdekat; fallback entry tersedia. Koordinat y
dihitung dari terrain, tanpa menambah format save. Instance respawn deadlines tetap
terpasang pada ID yang sama setelah lokasi home berubah. Inventory, equipment,
Rune, GOLD, job, level, pet, quest, dan progres tidak dihapus.

## 13. Pengujian

- **141/141 tes logika lulus**, termasuk 7 tes terrain: polygon, entry/camp/exit,
  42 spawn, swept movement, jembatan, arena, rute semua monster, migrasi save,
  serta kecocokan raycast mesh/height sampler dengan error di bawah 0,0001 unit.
- **25/25 pemeriksaan browser lulus** pada Chrome desktop 1440×960, profil terisolasi.
  Meliputi load, WASD, air terblokir, menyeberangi jembatan, navigasi monster,
  zoom eye-level di farm/jembatan/kuil/tebing, respawn player, klik NPC, Buy, Sell,
  tombol Ambil Quest, basic attack, skill, kematian normal/elite/boss, turn-in reward,
  save/reload deadline boss tanpa duplikasi, respawn semua varian, teleport kota,
  level gate, klik portal tambang, kelima field lain, dan koreksi posisi save di pond.
- Minimap dan tampilan entry, farm, bridge, temple, exit serta overview scene diperiksa.
- **0 error JavaScript/console** pada pengujian tersebut.
- TypeScript dan build produksi berhasil. Build memberi peringatan chunk aplikasi
  di atas 500 kB; tidak ada kegagalan compile.
- Respawn diuji dengan timestamp nyata ketika mati/reload, lalu deadline fixture
  dimajukan untuk memeriksa jalur timer selesai. Pengujian tidak menunggu 120 detik penuh.
- Bukti hasil lokal: `work/verdant-terrain/browser-results.json` dan screenshot
  `entry.png`, `farm.png`, `bridge.png`, `temple.png`, `exit.png`, `overview.png`.

Reproduksi tes logika: `node --experimental-strip-types --test lib/game/*.test.ts`.
Skrip browser membutuhkan game pada localhost:3001 serta `PLAYWRIGHT_MODULE` yang
menunjuk instalasi Playwright lokal. Test hook hanya disisipkan ke respons dev oleh
skrip pengujian; tidak ada debug global yang dikirim pada build produksi.

## 14. Batasan

- Landmark memakai model low-poly procedural, bukan asset artist final.
- Sungai/air terjun masih visual sederhana tanpa simulasi air; saluran sawah dangkal
  adalah dekorasi, bukan penghalang atau sistem berenang.
- Terrain radial ini ditujukan untuk polygon star-shaped; bukan terrain dengan
  gua, overhang walkable, atau beberapa lantai navigasi.
- Kamera mengikuti elevasi, memakai clearance tanah, dan pendekatan arena terbuka;
  belum ada sistem universal memudarkan semua prop yang menghalangi kamera.
- Performa mobile, semua GPU, dan sesi berjam-jam belum dibenchmark.
- Versi publik belum diubah; hasil tersedia untuk review lokal.
