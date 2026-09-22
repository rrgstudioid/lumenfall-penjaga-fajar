# LUMENFALL — Phase 4D Thief V2 Rendered-World Playtest

Tanggal: 20 September 2026. Status: playtest development lokal selesai; tidak dipublish.

## Owner report

### Kesimpulan

Thief terasa berbeda dari Warrior pada struktur gameplay: Mark sebagai setup, Stealth sebagai persiapan opener, gerak directional, posisi belakang, Crit, dan multi-hit yang ringan. Warrior tetap memiliki identitas frontline/stagger/guard; Thief tidak berubah menjadi Warrior ringan.

Secara mekanik Thief layak dibekukan sebagai **Core Job Reference V1**. Ada isu presentation/asset yang perlu ditangani sebelum public-quality showcase, tetapi tidak ada blocker runtime besar dan tidak ada angka yang diubah.

### Fixture legal yang digunakan

- Map: Padang Arunika / `verdant-plains`.
- Browser: Chrome headed, viewport 1440×1000, Three.js world nyata.
- Level: 59.
- SP: 58 total menurut aturan level; 48 paid Thief ranks, 10 tersisa. Bukan `build=all`, bukan `sp=200`.
- Stat allocation fixture: 174 stat points tersedia pada Lv59; fixture tidak mengalokasikan manual ke STR/DEX, sehingga diagnostik world memakai baseline profile + passive.
- Final Physical Attack: 333,25.
- Crit Rate: 3%.
- Evasion: 2.
- Max Mana: 100.
- Max HP: 1.786,02.
- Equipment: dua instance item existing `field-verdant-plains-dagger`, masing-masing dipasang main-hand/off-hand. Katalog stats produksi tidak diubah; fixture memakai override authorization Thief sementara.
- Rank yang benar-benar learned: semua active Thief tersedia dengan rank Quick2, Slipstep3, Mark3, Smoke3, Twin3, Crippling3, Venom1, Feint1, Lunge1, Marked3, Flurry1, Silent Opening1, Rear Rend3, Disengage1, Weakpoint1, Instinct1. Passives: Fleet2, Agile2, Dagger2, Keen2, Dual Familiarity2, Mark Expertise2, Rear Awareness2, Opportunist2, Silent Opportunity2.

### Mekanik dan rasa bermain

| Area | Hasil playtest |
|---|---|
| Quick Stab | Responsif sebagai bread-and-butter; range 3,5m dan lock .22s terasa ringan. Single dagger tetap dapat memakai Quick Stab. |
| Slipstep | Input/facing fallback terprediksi; tidak membutuhkan target/Stamina, tidak memberi iframe. Gerak tampak cepat dan terpisah dari charge berat Warrior. Collision tetap melalui movement path. |
| Disengage | Gerak mundur dari arah hadap, tidak mengikuti target; identitasnya jelas berbeda dari Slipstep. |
| Mark | Target frame menampilkan `MARKED`; Mark tidak hilang karena Mark/gerak/Stealth dan target tetap mempertahankan Mark sampai expiry/refresh. Ini terbaca sebagai setup Thief. |
| Smoke Veil | HUD `STEALTH` muncul; Mark, Slipstep, dan Disengage tidak memutusnya. Cast ofensif yang valid memutus Stealth. AI invisibility tidak dinilai sesuai batasan desain. |
| Silent Opening / Opportunity | Runtime snapshot dan hit queue konsisten. Playtest legal memiliki Silent Opening rank1 dan passive rank2; test runtime tambahan mengonfirmasi satu cast/all hits. Tidak menjadi trigger per hit. |
| Rear positioning | Predicate dan timing impact sudah lulus regression; pada rendered pass, arah belakang tidak memiliki cue khusus yang cukup kuat. Ini isu UX/presentation, bukan bug formula. |
| Crippling Cut | Status Slow dan potency dapat dibaca lewat state runtime; rear memberi durasi, bukan damage. Visual payoff rear masih placeholder. |
| Rear Rend | Payoff positional mengikuti posisi impact dan tidak memaksa rotasi. Lock .50s membuat komitmen terasa lebih berat dari Quick Stab. Dedicated rear cue masih diperlukan. |
| Weakpoint Assault | Mark + Rear tetap menjadi payoff Core late-game, bukan execute penuh. Uji exact empat kombinasi berada di regression tests; rendered fixture memiliki skill rank1 tetapi tidak menjadikan hasil monster sebagai balance conclusion. |
| Twin Fang | Dengan dual dagger menghasilkan dua hit nyata, satu pembayaran Mana dan satu cooldown. Switch target tidak meredirect hit kedua. Visual masih memakai routing prototype. |
| Blade Flurry | Tiga hit nyata terlihat dalam event runtime, timing 0/.16/.38, final hit lebih kuat. Secara visual masih cukup mirip dengan multi-hit Warrior sehingga perlu asset/routing khusus nanti. |
| Shadow Lunge | Target-selected dan collision-aware; tidak teleport ke belakang dan Mark tidak dikonsumsi. Playtest real menggunakan range/rank existing; movement terasa precision-oriented. |
| Evasion | Evasive Feint menaikkan Evasion 2→10 pada HP 35% fixture; indicator timed muncul. Evasive Instinct tidak memberi DR/iframe. |
| Venom | Venom Edge memberi direct hit + Poison; fixture mencatat Poison 4 detik. Formula tick existing dipakai, tanpa DoT engine baru. |
| Marked Strike | Own Mark condition tetap ada setelah serangan dan tidak dikonsumsi. Crit payoff dibuktikan oleh resolver tests; visual Crit cue masih generik. |
| Thief Instinct | HUD state tampil saat active. Major cooldown terbaca, tetapi belum memiliki visual signature selain icon/timer generik. |
| Mana | Urutan legal yang dijalankan: Mark8, Smoke12, Slipstep6, Disengage8, Twin9, Flurry15, Venom11, Marked10; Mana turun 100→21 sesuai cost. Tidak diambil sebagai nerf/buff balance. Basic attack tetap dibutuhkan setelah pool menyempit. |

### Single dagger vs dual dagger

Single dagger bukan dead end: Quick Stab berhasil cast dengan off-hand kosong. Twin Fang ditolak ketika off-hand dilepas, lalu kembali valid setelah dual dagger dipasang. Dual dagger adalah leaning yang membuka Twin Fang/Blade Flurry/Familiarity/Control, bukan automatic double-basic system.

### Crit headroom

Diagnostik legal Lv59 Phase 4C: permanent Crit 10,5%; dual-action 13%; Marked Strike 32%; Rear Rend 18%; Silent Opening 37%; Silent Opening + Instinct 47%; actual cap 80%. Build tersebut memakai 58 paid SP dengan alokasi STR90/VIT24/DEX60 dan tidak memaksimalkan semua node. Permanent state tidak trivially mencapai cap. Ini observasi headroom, bukan rebalance recommendation.

### Thief vs Warrior dan specialization headroom

Thief unggul secara identitas pada setup, posisi, avoidance, dan hit sequence; Warrior unggul pada frontline commitment, stagger, guard/counter, dan pressure. Ada overlap wajar pada physical melee dan target selection, tetapi loop-nya berbeda.

Masih ada ruang untuk Rogue: ASPD, sustained dual-dagger rhythm, deeper Crit Damage dan chaining. Masih ada ruang untuk Assasin: rear dependency, stealth assassination, burst dan execution. Tidak ada Rogue/Assasin yang dibuat.

### Presentation classification

| Active | Class |
|---|---|
| Quick Stab | A — acceptable prototype |
| Slipstep | B — understandable placeholder |
| Mark Prey | A — target/UI cue terbaca |
| Smoke Veil | B — state terbaca, asset masih ringan |
| Twin Fang | B — dua event benar, visual belum dedicated |
| Crippling Cut | B — efek status terbaca, rear cue lemah |
| Venom Edge | B — Poison runtime benar, VFX generik |
| Evasive Feint | B — buff row jelas, asset defensif sederhana |
| Shadow Lunge | B — movement terbaca, belum dedicated dagger dash |
| Marked Strike | B — payoff runtime benar, Crit cue generik |
| Blade Flurry | C — dedicated three-beat animation/VFX masih diperlukan |
| Silent Opening | B — opener state terbaca, asset stealth belum final |
| Rear Rend | C — dedicated rear/heavy impact cue diperlukan |
| Disengage | B — movement terlihat, asset masih sederhana |
| Weakpoint Assault | C — finisher/Mark+Rear presentation perlu asset khusus |
| Thief Instinct | B — timer/icon ada, aura/signature belum final |

### Isu UX yang ditemukan

- Target frame pada screenshot real dapat terlalu dekat dengan camera hint ketika target dipilih.
- Tubuh player dapat menutupi enemy kecil dan ring target pada sudut kamera tertentu.
- Rear success belum memiliki cue world yang kuat.
- Twin Fang/Blade Flurry belum memiliki animasi dagger dedicated; Blade Flurry paling mudah terbaca dari event/damage tetapi belum dari motion.

Kategorinya PRESENTATION / ASSET, bukan balance dan bukan blocker engine. Tidak ada perubahan otomatis karena task ini melarang redesign UX besar.

## Technical report

### Evidence

Evidence tersimpan di [folder Phase 4D](<C:/Users/USER/Documents/ChatGPT/PROJECT GAME NGEMPER/output/phase4d-browser>):

- `01-legal-menu.png`: legal memory fixture.
- `02-legal-world.png`: Padang Arunika rendered world.
- `03-target-frame.png`: target HP frame dan selection ring.
- `04-rotation-result.png`: MARKED, Stagger gauge, hit/VFX/cooldown presentation.
- `05-legal-k-panel.png`: K panel 25/30 learned, 10 SP, range 3,5m dan rank/prerequisite detail.
- `result.json`: final stats, rank ownership, event list, Mana deltas, target state, single/dual validation, Evasion/Venom checks.

`result.json` mencatat Twin Fang dengan 2 hit dan Blade Flurry dengan 3 hit. Tidak ada redirect target dalam cast sequence. Hit timing/coefficients dan Silent Opportunity one-cast/all-hits snapshot juga diverifikasi di runtime regression.

### File yang diubah untuk Phase 4D

- `tests/browser/thief-v2-playtest.mjs`: headed legal-world playtest dan evidence capture.
- `tests/browser/warrior-world.tsx`: expose resolver stat read-only kepada harness memory-only (`__lumenfallRules`); tidak menyentuh save produksi.
- `docs/LUMENFALL_Phase_4D_Thief_Playtest_Report.md`: laporan ini.

Tidak ada file production combat, item catalog, monster, map, job promotion, save migration, Rogue, Assasin, atau balance yang diubah pada Phase 4D.

### Regression/build

- Full `lib/game` suite: **502 passed / 0 failed**.
- Production build: **successful**.
- Primary TypeScript diagnostics: **6 before / 6 after**, sama persis: appearance fallback 4 di `rules.ts`, `ui-layout.ts` scale 1, `real-components.tsx` cameraMode 1.
- Browser console: satu 404 `/favicon.ico` dari harness localhost; tidak ada page exception gameplay, warning kosong, dan tidak ada HTTP failure asset game.

### Bug fixed

Tidak ada bug production yang perlu diperbaiki pada Phase 4D. Satu error verifikasi awal berasal dari test harness: target terhapus saat `clearSkillRuntime` sebelum single-dagger/Venom check. Harness diperbaiki dengan memilih ulang target; hasilnya Quick Stab=true, Twin Fang tanpa off-hand=false, Venom=true.

### Balance confirmation

Tidak ada perubahan damage, coefficient, Mana, cooldown, duration, range, rear angle, Crit bonus, passive value, action lock, prerequisite, monster, item atau EXP. Tidak ada kesimpulan kuat/weak berdasarkan monster Padang Arunika.

## Gate result

**PASS untuk Core Job structural reference V1.** Thief dapat dibekukan sebagai fondasi Core Job setelah playtest ini. Follow-up yang disarankan sebelum public showcase adalah pass presentation kecil untuk target-frame positioning, rear cue, dan dedicated dagger multi-hit animations. Itu bukan bagian dari Phase 4D dan tidak dilakukan otomatis.

Rogue dan Assasin tetap sepenuhnya belum diimplementasikan sebagai V2; Thief tetap development-only dan belum dipublish.
