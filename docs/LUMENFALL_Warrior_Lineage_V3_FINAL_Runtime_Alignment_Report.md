# LUMENFALL — Warrior Lineage V3 Final Runtime Alignment Report

## 1. Source-of-truth yang digunakan

- File: `C:\Users\USER\Documents\LUMENFALL_Warrior_V3_Final.docx.docx`
- SHA-256: `b91775f71c17a7acd23836be5f2a79e021a5713f4f3a3d0a83a3e71de0a919d6`
- Versi dokumen: 2.0, 23 September 2026.
- Status dokumen: **FINAL CANONICAL DESIGN — RUNTIME ALIGNMENT REQUIRED**.

Ekstraksi seluruh 838 paragraf DOCX selesai. Tidak ditemukan konflik desain internal yang mengharuskan penghentian. DOCX hanya menyatakan gate pembelian R1 pada kolom `Gate`; gate rank berikutnya yang tidak dinyatakan eksplisit dipertahankan selama tidak membatalkan gate R1 canonical.

## 2. Working tree yang diaudit

Branch aktif: `dev-ngemper`. Audit dilakukan tanpa mereset perubahan SPV3-8.1/8.1A yang sudah ada di working tree. Area yang diperiksa: registry V3, resolver skill, modifier combat, world execution, equipment/Dual Wield, status, save/load, Job Trainer, K-panel, Character Overview, fixture, dan test.

## 3. Matriks mismatch pra-fix

| Field | DOCX canonical | Runtime sebelum fix | Status pra-fix |
|---|---|---|---|
| Explicit STR/DEX/VIT/INT scaling | `max(0, Effective Stat - 15)` untuk seluruh lineage | Adventurer, Warrior, Berserker, dan Twin Assault masih memakai full Effective Stat | MISMATCH |
| Controlled Warrior Strike R1 | PATK 44; raw 45.04 | Explicit STR memakai 28, bukan Bonus STR 13 | MISMATCH |
| SP Lv2–29 / Lv30–60 / Lv61–80 | +1 / +2 / +3; Lv80 = 150 | +1 setiap level; Lv80 = 79 | MISMATCH |
| Quick Slash scaling/Mana | STR .02/.03/.04/.05/.06; MP 3/3/4/4/5 | STR .02 semua rank; MP 12/12/14/14/16 | MISMATCH |
| Power Strike gate/scaling/Mana | Gate R1 Lv1; STR .04/.05/.06/.07/.08; MP 5/5/6/6/7 | Gate R1 Lv4; STR .04 semua rank; MP 18/18/20/20/22 | MISMATCH |
| Minor Heal gate/Mana | Gate R1 Lv1; MP 8/10/12 | Gate R1 Lv2; MP 26/28/30 | MISMATCH |
| Warrior R1 gates | 15/15/15/15/17/20/17/20/20/25/20 sesuai tabel DOCX | Beberapa skill masih memakai gate lama 17–52 | MISMATCH |
| Warrior buff Mana/CD | Array per rank canonical | Guard/Battle Cry/Battle Focus/Unbroken memakai fallback R1 untuk semua rank | MISMATCH |
| Battle Cry | Outgoing Physical Damage +3–7%; PATK tetap | `physicalAttack%`, sehingga PATK naik | MISMATCH |
| AoE live radius/cap | Radius/range rank aktif dan target cap rank aktif | Frontal memakai fixed `range`; radial tidak menegakkan cap; fixture dapat menyembunyikan bug dengan slicing lokal | MISMATCH |
| Berserker R1 gates | Tabel DOCX (60/60/60/60/60/66/66/70/70) | Beberapa gate lama 61–75 | MISMATCH |
| Two-Hand Sword Mastery Mana scope | Whitelist 6 skill; exclude Iron Blood/Breaker Entry/Warrior | Seluruh tag Berserker saat memakai 2H dapat menerima reduction | MISMATCH |
| Mastery Accuracy scope | 2H untuk Berserker; dual valid untuk Blade Master | Bonus Accuracy tetap masuk tanpa memeriksa weapon style aktif | MISMATCH |
| Berserker Trance MP/CD | 30/34/38; 90/88/85 | 30 dan 90 untuk semua rank | MISMATCH |
| Trance damage/cap scope | Damage hanya Berserker 2H; +1 cap hanya lima AoE Berserker canonical | Satu broad tag path mengatur damage dan cap sekaligus | MISMATCH |
| Blade Master R1 gates | Tabel DOCX (60/60/60/63/63/65/65/65/67) | Beberapa gate lama 62–75 | MISMATCH |
| Inherited Warrior saat dual | `SINGLE_MAIN`; offhand raw ATK tidak ikut | PATK gabungan masih dibaca | MISMATCH |
| Blade Focus prerequisite | Battle Focus R3 | Tidak ada prerequisite | MISMATCH |
| Blade Focus Flow extension | 3.5/3.75/4/4.25/4.5 detik | World jatuh ke 3 detik karena action duration 0 | MISMATCH |
| Counterflow | Cast/counter payoff hanya dengan CounterContext Block/Parry valid | Cast dapat lanjut dengan `NO_COUNTER`; Stun tidak digate oleh context | MISMATCH |
| Blade Rush movement | Collision-safe pass-through ±1.5 m di belakang target | Berhenti 1.2 m di depan target | MISMATCH |
| Tempo generation | +1 per successful execution; tidak butuh consumer learned | Gameplay impact session sudah benar; UI indicator masih presentation gate | MATCH gameplay / PRESENTATION drift |
| Tempo Drive | MP 14/15/16/17/18; CD 24/23/22/21/20 | Runtime rank arrays sudah sesuai | MATCH |
| Armor Break | 6/7.5/9/10.5/12%, source-owned, strongest-only | Sesuai pada V3 source-owned path | MATCH |
| Accuracy/Evasion | Model B; satu roll sebelum Crit | Sesuai | MATCH |
| Save/transient | Lineage/rank/equipment/hotbar persist; combat transient tidak | Mayoritas sesuai; wajib diregresi setelah perubahan | MATCH, VERIFY |

## 4. File yang diubah

Perubahan fase ini terbatas pada jalur Warrior Lineage dan validasinya:

- Data/adapter skill: `lib/game/adventurer-v3.ts`, `warrior-v3.ts`, `berserker-v3.ts`, `blade-master-v3.ts`.
- Resolver/foundation: `lib/game/rules.ts`, `skill-action.ts`, `combat-modifiers.ts`, `combat-status.ts`, `dual-wield.ts`, `directional-movement.ts`.
- Actual world path: `lib/game/world.ts`.
- Fixture: `lib/game/berserker-v3-fixture.ts`.
- UI bersama: `components/game/v3-job-trainer.tsx`, `app/page.tsx`.
- Test: `adventurer-v3.test.ts`, `warrior-v3.test.ts`, `blade-master-v3-advanced.test.ts`, `warrior-lineage-final-alignment.test.ts`.
- Browser acceptance: `tests/browser/warrior-lineage-final-ui.{html,tsx}`, `warrior-lineage-final-ui-verify.mjs`, serta evidence di `warrior-lineage-final-ui-evidence/`.
- Dokumen ini.

Perubahan working tree SPV3-8.1/8.1A yang sudah ada sebelum fase ini dipertahankan dan tidak di-reset.

## 5. Bonus Stat dan formula CFV3

Semua explicit scaling skill lineage sekarang menerima `max(0, Effective Stat - 15)` untuk STR/DEX/VIT/INT. PATK tetap dihitung sekali dari Base Physical ATK, Bonus STR × weapon factor, dan Weapon ATK yang kompatibel. Explicit scaling kemudian ditambahkan sebagai lapisan terdeklarasi; base stat 15 tidak dihitung kembali.

Urutan player hit aktual: validasi impact → Model B Accuracy/Evasion → Crit → raw damage → mitigation → barrier/HP → status/proc. Dual Wield menggunakan shared character core sekali dan weapon layer menurut mode tangan.

Controlled proof:

`Lv15 Base PATK 23 + Bonus STR 13 + Weapon ATK 8 = PATK 44`

`Warrior Strike R1 = 44 × 1.00 + 13 × 0.08 = 45.04 raw`

Hasil test: **45.04 tepat sebelum mitigation**.

## 6. SP progression

Normal player progression sekarang data-driven melalui kurva berikut:

| Level | Total SP |
|---:|---:|
| 14 | 13 |
| 29 | 28 |
| 30 | 30 |
| 59 | 88 |
| 60 | 90 |
| 70 | 120 |
| 75 | 135 |
| 80 | 150 |

Delta level adalah +1 pada Lv2–29, +2 pada Lv30–60, dan +3 pada Lv61–80. Helper 500 SP tetap ada hanya pada `createV3JobDevelopmentHero()` dan tidak digunakan oleh progres pemain normal.

## 7. Adventurer alignment

- Quick Slash: scaling STR `.02/.03/.04/.05/.06`, Mana `3/3/4/4/5`, cooldown `3.2/3.1/3/2.9/2.8`, R1 tetap granted.
- Power Strike: gate R1 Lv1, scaling STR `.04/.05/.06/.07/.08`, Mana `5/5/6/6/7`, cooldown `6/5.75/5.5/5.25/5`.
- Minor Heal: gate R1 Lv1, Mana `8/10/12`, cooldown `30/28/26`, heal `6/8/10% Max HP`.
- Actual cast resolver membaca rank value di atas, bukan fallback lama.

## 8. Warrior alignment

Prerequisite graph tetap dan diuji: Strike R2 → Sweeping; Strike R3 → Armor Breaker; Guard R2 → Counter Slash; Sweeping R4 → Ground Breaker; Guard R3 → Unbroken; Armor Breaker R3 → Crushing Finale. Semua gate R1 mengikuti DOCX final. Guard Stance tetap membutuhkan 1H/2H Sword.

## 9. Battle Cry

Battle Cry sekarang memberi outgoing **Physical Damage +3/4/5/6/7%**, bukan Physical Attack/PATK. PATK sebelum dan selama buff identik, sementara skill physical dan Basic Attack bertambah tepat sesuai rank. Explicit STR/DEX tidak dimodifikasi dua kali.

## 10. Warrior buff Mana/cooldown

Resolver rank aktual menggunakan:

- Guard: Mana `10/11/12/13/14`, CD `18/17.5/17/16.5/16`.
- Battle Cry: Mana `14/15/16/17/18`, CD `35`.
- Battle Focus: Mana `14/15/16/17/18`, CD `35`.
- Unbroken: Mana `16/18/20/22/24`, CD `28/27.5/27/26.5/26`.

Tidak ada fallback R1 untuk rank berikutnya.

## 11. AoE world selector

`selectSkillTargets()` menjadi helper canonical bersama untuk world dan fixture. Ia memakai radius/range hasil rank aktif, angle eksplisit, target cap rank aktif, target hidup, urutan jarak deterministik, dan pemilihan per target. Sweeping Slash memakai 120°. Skill yang DOCX tidak beri angle baru mempertahankan angle runtime yang sudah ada. Fixture Berserker tidak lagi melakukan `.slice()` sendiri.

World path kini menegakkan cap untuk Sweeping Slash, Ground Breaker, Raging Cleave, Breaker Entry, Earth Splitter, Ruinous Arc, dan Fury Harvest. Hit/Evasion tetap di-roll per actual target. Penghitungan successful target memakai target ID unik, sehingga Frenzy Guard dan Fury Harvest tidak lagi salah menghitung satu cast AoE sebagai satu target.

## 12. Berserker prerequisite dan scope

Gate R1 dan prerequisite Raging Cleave, Breaker Entry, Earth Splitter, Ruinous Arc, Fury Harvest, dan Trance mengikuti DOCX final. Iron Blood tetap self dan `weaponRequirement = NONE`.

## 13. Two-Hand Sword Mastery whitelist

Mana reduction hanya berlaku untuk enam ID canonical: Raging Cleave, Crushing Blow, Earth Splitter, Ruinous Arc, Fury Harvest, dan Berserker Trance. Iron Blood, Breaker Entry, serta Warrior ancestry dikecualikan. Accuracy Mastery hanya aktif saat 2H benar-benar terpasang.

## 14. Berserker Trance

- Mana `30/34/38`, cooldown `90/88/85`, durasi `12/14/16`.
- Final damage `+6/+8/+10%` hanya untuk skill damage Berserker 2H canonical.
- `+1 target cap` hanya untuk Raging Cleave, Breaker Entry, Earth Splitter, Ruinous Arc, dan Fury Harvest; Warrior AoE tidak menerima bonus.
- Breaker Entry boleh mendapat +1 cap tetapi tidak mendapat damage boost 2H karena skill ini juga valid untuk 1H.
- Frenzy Guard tetap dipicu oleh minimal tiga target unik yang benar-benar terkena hit, refresh tanpa stack, DR `4/5/6%` selama 2 detik.
- Trance diperlakukan sebagai buff canonical; tidak lagi mewarisi generic ultimate super-armor/DR tersembunyi.

## 15. Dual Wield

Dua One-Hand Sword tetap dua instance nyata. Stat item/rune/affix mengagregasi satu kali; main/off raw Weapon ATK tetap dapat dialamatkan terpisah; tidak ada penalti offhand 50%; safe Mastery loss, UI Off Hand, save/reload, dan unique-effect dedupe tetap lolos.

## 16. Inherited Warrior SINGLE_MAIN

Saat Blade Master memakai skill ofensif Warrior sambil dual-wield, resolver sekarang mengomposisi `SINGLE_MAIN`: shared character core sekali + main raw weapon layer. Test isolasi menaikkan hanya Offhand ATK dari 70 menjadi 170; PATK display berubah 100 karena equipment aggregate, tetapi raw Warrior Strike tetap identik. Stat karakter sah dari offhand tetap boleh berkontribusi sekali.

## 17. Twin Assault

MAIN → OFF tetap dua real hit dengan shared weight canonical. Satu atau dua hit yang landed menghasilkan tepat +1 Tempo per execution; kedua hit evade menghasilkan 0. Flow dikonsumsi pada hit merusak pertama, bukan saat jadwal hit dibuat.

## 18. Counterflow

Cast kini ditolak sebelum Mana/cooldown bila tidak ada CounterContext Block/Parry yang fresh dan belum dikonsumsi. Context `none`, hit biasa, expired, consumed, atau source tidak valid tidak dapat memperoleh guaranteed Stun, Flow generator, atau counter payoff. Context yang valid mempertahankan perilaku canonical.

## 19. Blade Focus dan Flow

Prerequisite Blade Focus sekarang Battle Focus R3. Durasi Flow aktif per rank ketika Blade Focus sedang hidup adalah tepat `3.5/3.75/4/4.25/4.5` detik; base Flow tetap 3 detik. Generator Blade Rush/Counterflow membuka atau refresh; eligible sequence Twin Assault/Cross Sever/Piercing/Tempest memakai +5pp Crit dan mengonsumsi pada first successful damaging impact. Evade tidak mengonsumsi.

## 20. Blade Rush

Blade Rush memakai charge/collision path nyata sampai impact lalu mencoba endpoint 1.5 m melewati target. Gerak dilakukan dalam substep 0.25 m melalui callback collision world, bukan teleport. Jika endpoint penuh terhalang, actor berhenti deterministik di titik aman terakhir; impact yang evade tidak membatalkan gerakan yang sudah selesai.

## 21. Tempo

Generator hanya Twin Assault dan Cross Sever, mensyaratkan Blade Master, Mastery R1+, dual valid, dan minimal satu damaging hit. Tidak ada consumer-learning gate. Maksimum 3; satu stack maksimum per execution; lifetime `5/5.5/6/6.5/7` dari Mastery dan seluruh lifetime refresh saat stack baru. Indicator UI kini muncul sejak Mastery dipelajari. State dibersihkan saat capability/config/specialization hilang atau reload.

## 22. Tempo Drive

Mana `14/15/16/17/18`, cooldown `24/23/22/21/20`; minimum satu Tempo; successful activation mengonsumsi semua stack. Mastery dapat mengurangi activation cost, tetapi buff Drive yang baru dibuat tidak retroaktif. Mana efficiency Drive hanya Twin Assault, Cross Sever, Blade Tempest; strongest applicable reduction menang.

## 23. Blade Tempest

Sequence MAIN/OFF/MAIN/OFF/BOTH, coefficient/shared/stat weights, Mana/CD, independent Crit, Flow, snapshot tiga Tempo, first-successful-impact consumption, dan final hit +25pp Crit/+10% final damage tetap canonical. Tidak menjadi AoE, tidak Stun, tidak knockback.

## 24. Stun

Source yang disetujui tetap hanya Iron Charge, Earth Splitter, Counterflow. Iron Charge memakai actual travel ≥3.5 m; Earth Splitter roll per landed target; Counterflow memerlukan valid counter context. Immunity, non-additive refresh, action lock, durasi, dan no-knockback tidak berubah. Load kini juga membuang stale `statusEffects.stun`, bukan hanya `stunState`.

## 25. Armor Break

Strength `6/7.5/9/10.5/12%`, source-owned records, strongest-only mitigation, same-source refresh, expiry fallback, dan no legacy 20% leakage pada V3 tetap lolos. Personal payoff: Finale +10%, Ruinous +8%, Piercing +10 Accuracy semua hit/+10pp Crit final hit hanya dari source caster sendiri.

## 26. Accuracy/Evasion

Model B tidak diubah: `pressure=(Accuracy-90)*0.1`, `effectiveEvasion=clamp(Evasion-pressure,0,50)`, `hitChance=1-effectiveEvasion/100`. Satu roll per gameplay hit sebelum Crit. Current monster adapter tetap memberi Evasion 0. Battle Focus, Blade Focus, kedua Mastery, dan Piercing own-source bonus masuk resolver biasa.

## 27. Save dan transient

Persist: lineage, specialization, ranks, totalEarnedSP, equipment instances, hotbar, dan progression normal. Load/save membuang seluruh active buff ber-ID `v3-*`, Stun state/status, generic temporary/combat modifiers, dan super-armor stale. Flow, Tempo, Drive, CounterContext, Breaker Entry, Frenzy Guard, Trance timer, Armor Break target, dan next basic hand tetap runtime-only.

## 28. Live UI/headed validation

Dua fixture terisolasi merender komponen produksi dan tidak membaca/menulis save pemain:

1. Existing Off Hand fixture: picker Sword/Shield, two distinct swords, `dual_sword`, Twin Assault weapon validity, isolated reload, safe Mastery loss.
2. Final lineage fixture: komponen `V3JobTrainer` yang sama dipakai `app/page.tsx`, `JobSkill`, dan `CharacterOverview`.

Chrome 151 result: Lv15 Warrior transition PASS; Lv60 SP 90 dan dua specialization tersedia; Berserker dipilih dengan 9 K-panel skill; Blade Master dipilih dengan 9 K-panel skill; Dual Off Hand dan label `Dual One-Hand Swords` tampil. Local/session save tetap kosong. Evidence: `tests/browser/warrior-lineage-final-ui-evidence/`.

## 29. Focused tests

Focused lineage/foundation suite: **85 passed / 0 failed**. Mandatory A–N dan tambahan stale-transient-load test semuanya lulus.

## 30. Full lib/game regression

**464 passed / 0 failed** dalam 3.34 detik.

## 31. Production build

`vinext build`: **PASS**. Lima tahap client/server/RSC/SSR selesai. Ada satu warning non-blocking bahwa sebagian chunk >500 kB; tidak ada build error dan warning tersebut bukan correctness mismatch Warrior Lineage.

## 32. Browser errors/warnings

Acceptance browser: **0 console errors, 0 console warnings, 0 page errors, 0 request failures, 0 HTTP failures**.

## 33. Rekonsiliasi pasca-fix DOCX vs runtime

Seluruh field di bawah dibandingkan ulang terhadap DOCX final setelah perubahan. `MATCH` berarti definition, resolver, dan world path yang relevan konsisten.

| Skill | Rank/gate/SP/prerequisite | Weapon/target/hit/AoE | Coefficient + Bonus Stat | Mana/CD/duration/status/payoff | Final |
|---|---|---|---|---|---|
| Quick Slash | MATCH | MATCH | MATCH | MATCH | MATCH |
| Power Strike | MATCH | MATCH | MATCH | MATCH | MATCH |
| Minor Heal | MATCH | MATCH | MATCH | MATCH | MATCH |
| Warrior Strike | MATCH | MATCH | MATCH | MATCH | MATCH |
| Iron Charge | MATCH | MATCH | MATCH | MATCH | MATCH |
| Sweeping Slash | MATCH | MATCH, including 120°/rank cap | MATCH | MATCH | MATCH |
| Guard Stance | MATCH | MATCH | N/A | MATCH | MATCH |
| Armor Breaker | MATCH | MATCH | MATCH | MATCH | MATCH |
| Battle Cry | MATCH | MATCH | N/A | MATCH, Physical Damage not PATK | MATCH |
| Counter Slash | MATCH | MATCH | MATCH | MATCH | MATCH |
| Battle Focus | MATCH | MATCH | N/A | MATCH | MATCH |
| Ground Breaker | MATCH | MATCH, live rank cap | MATCH | MATCH | MATCH |
| Unbroken Stance | MATCH | MATCH | N/A | MATCH | MATCH |
| Crushing Finale | MATCH | MATCH | MATCH | MATCH, own-source +10% | MATCH |
| Two-Hand Sword Mastery | MATCH | MATCH | N/A | MATCH, exact whitelist | MATCH |
| Raging Cleave | MATCH | MATCH, live rank cap | MATCH | MATCH | MATCH |
| Crushing Blow | MATCH | MATCH | MATCH | MATCH | MATCH |
| Iron Blood | MATCH | MATCH, no weapon | N/A | MATCH | MATCH |
| Breaker Entry | MATCH | MATCH, live rank cap | MATCH | MATCH | MATCH |
| Earth Splitter | MATCH | MATCH, per-target | MATCH | MATCH, generic Stun | MATCH |
| Ruinous Arc | MATCH | MATCH, live rank cap | MATCH | MATCH, own-source +8% | MATCH |
| Fury Harvest | MATCH | MATCH, actual hit/heal cap | MATCH | MATCH | MATCH |
| Berserker Trance | MATCH | MATCH, exact scoped +1 cap | N/A | MATCH | MATCH |
| Twin Blade Mastery | MATCH | MATCH | N/A | MATCH, exact Mana scope | MATCH |
| Twin Assault | MATCH | MATCH, two real hits | MATCH | MATCH | MATCH |
| Blade Rush | MATCH | MATCH, collision-safe pass-through | MATCH | MATCH | MATCH |
| Counterflow | MATCH | MATCH | MATCH | MATCH, valid context only | MATCH |
| Blade Focus | MATCH | MATCH | N/A | MATCH, Flow R1–R5 | MATCH |
| Cross Sever | MATCH | MATCH, DUAL_COMBINED | MATCH | MATCH | MATCH |
| Piercing Sequence | MATCH | MATCH, three hits/SINGLE_MAIN | MATCH | MATCH, own-source bonuses | MATCH |
| Tempo Drive | MATCH | MATCH | N/A | MATCH | MATCH |
| Blade Tempest | MATCH | MATCH, five hits | MATCH | MATCH | MATCH |

Foundation reconciliation:

| Area | Definition | Resolver | World/UI/save | Result |
|---|---|---|---|---|
| Bonus Stats / CFV3 | MATCH | MATCH | MATCH | MATCH |
| SP/refund/ancestry | MATCH | MATCH | MATCH | MATCH |
| Dual Wield | MATCH | MATCH | MATCH | MATCH |
| Stun | MATCH | MATCH | MATCH | MATCH |
| Armor Break | MATCH | MATCH | MATCH | MATCH |
| Accuracy/Evasion | MATCH | MATCH | MATCH | MATCH |
| Flow/Tempo | MATCH | MATCH | MATCH | MATCH |
| Live Job/K-panel/Overview | MATCH | MATCH | MATCH | MATCH |
| Save/transient | MATCH | MATCH | MATCH | MATCH |

**Unresolved correctness mismatch: 0.**

## 34. Remaining balance concerns only

Tidak ada balance tuning dilakukan. Output damage fixture, konsumsi Mana, cooldown, target cap, dan class comparison dapat dievaluasi pada fase balance terpisah. PvP runtime, Advanced Job, dan final animation asset tetap future scope. Warning ukuran bundle adalah concern optimisasi deployment, bukan combat correctness.

## 35. FINAL STATUS

**FULL MATCH — WARRIOR LINEAGE V3 DESIGN + RUNTIME ALIGNED**

