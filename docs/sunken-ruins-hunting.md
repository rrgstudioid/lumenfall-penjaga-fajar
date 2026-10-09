# Sunken Ruins — populasi hunting dan lereng laut dalam

Catatan terbaru: [revisi collision dan pembersihan ruins](sunken-ruins-clearings.md) membuka navigasi sampai batas map sebenarnya dan menghapus patung/masonry. Ketentuan batas kontur di bawah merupakan catatan revisi sebelumnya.

Revisi lokal 9 Oktober 2026, berdasarkan permintaan untuk mengaktifkan monster Lv32–42 dan menurunkan batas luar. Ketentuan preview kosong pada laporan revisi sebelumnya digantikan oleh permintaan ini. Map tetap development-only `sunken-ruins-underwater-v1`; field lama `sunken-ruins` tetap utuh. Tidak dipublikasikan.

## Populasi

| Monster | Level | Rank | Jumlah |
| --- | ---: | --- | ---: |
| Drowned Warrior | 32 | Normal | 48 |
| Drowned Soldier | 33 | Normal | 42 |
| Leech Wraith | 37 | Normal | 33 |
| Ruin Guardian | 40 | Normal | 41 |
| Sunken Sentinel | 42 | Elite | 12 |
| Abyssal Leviathan | 42 | Boss | 1 |

Total **177**: 164 normal, 12 elite, 1 boss. Zona kedatangan memiliki 28 normal di luar area aman; jalur selatan 40; pusat 64 normal dan 4 elite; abyss barat laut 24 normal dan 8 elite; pinggiran utara 8 normal. Boss berada di pusat Abyssal Throne `(45,-370)` dengan radius 85 unit bebas home monster lain.

Home dipilih deterministik dari permukaan navigasi, dengan jarak antarmonster minimal 28 unit, clearance obstacle 3 unit, dan jarak tambahan 24 unit dari area aman spawn/portal. Home dijauhkan 26 unit dari tepi playable. AI, chase/return, cooldown, horizontal collision, dan distance culling memakai sistem existing. Spawn ID stabil dan death timer dipisahkan dari field lama melalui prefix map.

Species/model dan tier loot menggunakan keluarga Sunken existing. Boss baru disesuaikan dari Lv44 ke Lv42 dengan formula rank existing; boss field lama tetap Lv44. Tidak ada perubahan rumus job, skill, `adventurer-v3.ts`, quest, atau NPC. Model monster masih geometri procedural existing, bukan aset Tripo baru. Tidak ada kredit API yang dipakai pada revisi ini.

Kill pada map ini sekarang memberi EXP, gold pickup, loot, kill progress, dan catatan boss melalui jalur existing. Respawn normal 25 detik, elite 60 detik, boss 120 detik. Fixture combat menandai aktor pengujian sebagai `rewardless` secara eksplisit; suppress reward tidak lagi diterapkan ke seluruh map.

## Batas luar

Permukaan yang sebelumnya naik menjadi sand bank kini turun melalui kurva smoothstep menjadi lereng laut dalam sekitar 60–70 unit di bawah lantai utama. Warna pasir bergradasi ke biru seiring lereng turun. Apron visual diperpanjang hingga ±800 agar tepi mesh berada di luar jarak baca fog/kamera; navigasi tetap dalam bidang desain 1000 × 1000 dan berhenti sebelum lereng dalam. Player tidak dapat jatuh atau berenang keluar boundary. Jalur dan reef collision tetap dipertahankan.

## Validasi

- **59/59 tes Node** lulus: populasi/level/spacing, legacy field, save, loot semua kategori, travel, smooth slope, collision, dan kamera.
- Typecheck, lint, build, dan `git diff --check` lulus. Output production tidak memuat loader/aset Sunken development.
- Browser hunting: 177 aktor valid; normal/elite/boss dapat ditarget dan dikalahkan, memberi EXP/gold/loot, menyimpan deadline, tetap mati setelah reload, lalu respawn pada home valid setelah deadline kedaluwarsa.
- **223 perbandingan combat** cocok dengan fixture darat. Empat monster fixture menyelesaikan chase/attack/return/death/respawn.
- Lifecycle: akses Lv31 terkunci/Lv32 terbuka, tiga portal, Retry, reload, renang kedua gender, kamera, dan respawn lulus. Tiga kunjungan stabil pada 177 monster, 3 label portal, 88 geometry dan 17 texture dalam skenario tersebut.
- Performance smoke Low/Ultra: tiga capture 10 detik per preset, sekitar 60 FPS, p95 17,0–17,1 ms, tanpa error browser. CPU submission p95 tertinggi 4,3 ms pada Low dan 5,8 ms pada Ultra. Pengukuran singkat ini tidak menggantikan benchmark 60 detik per capture atau menyatakan budget master plan lulus.

Bukti: `output/sunken-ruins/revision4/hunting.json`, `lifecycle.json`, `combat-parity.json`, screenshot `warrior.png`, `elite.png`, `boss.png`, dan `deep-slope.png`. Log: `work/sunken-ruins/revision4/`.

File implementasi utama: `sunken-ruins-population.ts`, `sunken-ruins-layout.ts`, `sunken-ruins-terrain.ts`, `field-layout.ts`, `regions.ts`, `world.ts`, serta label menu M di `app/page.tsx`. Tidak ada perubahan source Blender atau GLB asli.
