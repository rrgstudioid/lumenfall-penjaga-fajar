# LUMENFALL — CFV3-3A
## Warrior & Thief Core Job Audit

Status: **AUDIT READ-ONLY**  
Tanggal: 2026-09-22  
Perubahan gameplay pada fase ini: **TIDAK ADA**

## Ringkasan eksekutif

Warrior saat ini terbaca sebagai frontline fisik generalis, tetapi tree-nya sudah memuat terlalu banyak mekanik khusus Great Weapon dan Twin Blade. Itu membuat sebagian identitas Berserker dan Blade Master sudah bocor ke Core Job. Thief sudah jelas sebagai mobile single-target opportunist, tetapi paket dual-dagger multi-hit serta rangkaian stealth/rear/finisher sudah mendekati Rogue dan Assasin.

CFV3 secara arsitektur kompatibel dengan mayoritas skill karena seluruh skill ofensif V2 masuk ke resolver rank → `resolveSkillAction` → `skillHitDamage`, dan memakai physical coefficient terhadap `physicalAttack` yang sudah dihitung CFV3. Risiko utama bukan parser/resolver ganda yang terbukti, melainkan penumpukan multiplier pasif, conditional payoff, dan rank tinggi pada skill multi-hit/finisher.

Rekomendasi global: **RESTRUCTURE**, bukan menghapus kedalaman 30 node secara otomatis. Pertahankan ruang 16 active + 14 passive hanya jika node placeholder dan node spesialisasi yang bocor nanti diberi peran Core yang jelas. Tidak ada perubahan yang diterapkan pada fase ini.

## Sumber dan metode audit

File utama yang dibaca:

- `lib/game/warrior-v2.ts`
- `lib/game/thief-v2.ts`
- `lib/game/skills.ts`
- `lib/game/skill-action.ts`
- `lib/game/rules.ts`
- `lib/game/combat-modifiers.ts`
- `lib/game/combat-transient.ts`
- `lib/game/weapon-style.ts`
- `lib/game/combat-foundation-v3.test.ts`
- `lib/game/warrior-v2.test.ts` bila tersedia pada checkout
- `lib/game/thief-v2.test.ts`
- `lib/game/post-stagger-v2-regression.test.ts`
- `lib/game/stagger-removal.test.ts`

Jalur resolver yang dikonfirmasi:

1. Registry skill memilih rank dan menggabungkan `rankValues`.
2. `resolveSkillAction` membentuk action final, termasuk target, hit sequence, cooldown, cost, effect, dan conditional payoff.
3. `skillHitDamage` memakai flat/base damage + physical coefficient × `physicalAttack` + magic coefficient × `magicAttack` + skill-power contribution, lalu multiplier/modifier yang relevan.
4. `rules.ts` memeriksa kompatibilitas weapon melalui `skillWeaponAllowed`/`meetsWeaponRequirement`.

Semua penilaian di bawah adalah penilaian desain dan arsitektur, bukan keputusan balance final.

## WARRIOR

### Identitas saat ini

Identitas dasarnya sudah cocok dengan **generalist physical frontline**: melee, Guard/Counter, Armor Break, frontal cleave, dan durability. Namun dua jalur weapon-specific sudah terlalu eksplisit untuk Core: Great Weapon Familiarity + Great Weapon Momentum dan Twin Blade Familiarity + Twin Blade Rhythm. Ditambah Heavy-tag skill, multi-hit, dan finisher, Warrior saat ini sebagian sudah terasa seperti tiga job sekaligus: generalist, heavy burst, dan dual-blade rhythm.

### 16 active skills

Notasi: `B→M` = base damage rank awal sampai akhir; `P→M` = physical coefficient; `M` = mana; `CD` = cooldown. Semua skill ofensif Warrior saat ini physical (`magicCoefficient = 0`) dan resolver-nya adalah `resolveSkillAction → skillHitDamage`, kecuali skill buff/movement yang tidak menghasilkan damage.

| Skill | Lv/R | Weapon | Formula dan cost | Target / bentuk / hit | Effect, payoff, movement, CC | Klasifikasi; audit / rekomendasi |
|---|---|---|---|---|---|---|
| Warrior Strike | 15/R5 | 1H sword, greatsword, dual sword | B 18→34; P 1.05→1.25; M6; CD 3.5→3.2 | single, melee, 1 hit | Tidak ada conditional; tidak ada CC | **BREAD-BUTTER**; SAFE; KEEP_AND_REBALANCE |
| Iron Charge | 17/R5 | 1H sword, greatsword, dual sword | B15→27; P .90→1.10; M8; CD 7→6 | single, 1 hit | Dash 7→8.5; knockback ringan | **MOBILITY**; SAFE; KEEP |
| Sweeping Slash | 20/R5 | semua style Warrior | B18→34; P 1.05→1.32; M10; CD 6→5.5 | frontal arc 120°, radius 4.5, max 5 | Frontal cleave | **AOE, BREAD-BUTTER**; SAFE; KEEP_AND_REBALANCE |
| Guard Stance | 20/R5 | saat ini semua style Warrior | self; M10; CD14→12.5; dur5→7 | self buff | Block 4→10; incoming damage reduction 12→18% | **DEFENSIVE**; SAFE; KEEP |
| Rising Slash | 23/R5 | semua style Warrior | B22→38; P1.25→1.55; M11; CD7 | single, 1 hit | Knockback ringan; tidak ada Stagger aktif | **PAYOFF, AOE/UTILITY**; LEGACY_REDESIGN marker; REWORK |
| Armor Breaker | 26/R5 | semua style Warrior | B24→40; P1.30→1.55; M12; CD9 | single, 1 hit | Armor Break dur4→6 | **SETUP, UTILITY**; SAFE; KEEP_AND_REBALANCE |
| Battle Cry | 29/R5 | semua style Warrior | self; M14; CD24→22; dur8→11 | self buff | Physical attack +2.5→6.5%; tenacity +4→10 | **DEFENSIVE, UTILITY**; SAFE; KEEP_AND_REBALANCE |
| Counter Slash | 32/R5 | semua style Warrior | B15→27; P.85→1.05; M9; CD6→5.5 | single, 1 hit | Counter window 2.5s; blocked/parried payoff +damage | **DEFENSIVE, PAYOFF**; SAFE; KEEP_AND_REBALANCE |
| Ground Breaker | 35/R5 | semua style Warrior | B24→40; P1.10→1.32; M15; CD11 | area radius4→4.5, 1 hit | AoE heavy; no Stagger/knockback subsystem | **AOE, PAYOFF**; LEGACY_REDESIGN marker; REWORK |
| Battle Focus | 38/R5 | semua style Warrior | self; M14; CD24→22; dur8→10 | self buff | Accuracy +6→12; crit rate +1.5→3 | **SETUP, UTILITY**; SAFE; KEEP_AND_REBALANCE |
| Severing Arc | 41/R5 | semua style Warrior | B28→44; P1.55→1.95; M15; CD9 | frontal arc 70°, max3 | Heavy frontal pressure | **AOE, PAYOFF**; LIKELY_HIGH in combination; KEEP_AND_REBALANCE |
| Relentless Assault | 44/R5 | semua style Warrior | M18; CD10→9.5 | single, 3 hits; total P 1.90→2.48 | Last hit strongest; no Stagger | **PAYOFF, BREAD-BUTTER**; DOUBLE_SCALING_RISK via stacked passives; KEEP_AND_REBALANCE |
| Unbroken Stance | 47/R5 | semua style Warrior | self; M16; CD26→25; dur6→8 | self buff | Incoming reduction 4→7%; knockback reduction 20→40%; not immunity | **DEFENSIVE**; SAFE; KEEP |
| Iron Reversal | 50/R3 | semua style Warrior | B22→34; P1.05→1.25; M14; CD10→9 | single, 1 hit | Parry-only counter payoff +80→115% | **DEFENSIVE, PAYOFF**; SAFE but conditional-high; KEEP_AND_REBALANCE |
| Crushing Finale | 55/R3 | semua style Warrior | B36→52; P2.20→2.60; M24; CD18→16 | single, 1 hit | Armor Break target payoff +10→20%; old redesign marker | **SIGNATURE, PAYOFF**; LIKELY_HIGH / REQUIRES_REDESIGN; REWORK |
| Warrior Awakening | 59/R3 | semua style Warrior | self; M32; CD50→46; dur12→14 | self buff | Warrior physical damage +6→10%; rank 3 mana reduction | **SIGNATURE**; multiplicative stacking review; KEEP_AND_REBALANCE |

Catatan weapon: registry saat ini memberi requirement Warrior weapon bahkan pada buff seperti Guard Stance, Battle Cry, Battle Focus, Unbroken Stance, dan Awakening. Secara desain, buff self tidak selalu harus terkunci pada weapon. Ini bukan bug resolver, tetapi **WEAPON_REQUIREMENT_REVIEW** untuk fase implementasi berikutnya. Skill ofensif memang seharusnya weapon-gated; unarmed tidak mendapat kontribusi STR weapon-dependent setelah CFV3-2.1.

### Warrior passives

| Passive | Isi runtime | Tipe | Leakage / risiko | Rekomendasi audit |
|---|---|---|---|---|
| Warrior Conditioning | Max HP +2%/rank; Physical Defense +1%/rank | A numeric | Core sesuai | KEEP |
| Weapon Discipline | Physical Attack +0.8%/rank dengan compatible Warrior weapon | C weapon | Dapat menumpuk dengan base/weapon/STR secara sah; cek total | KEEP_AND_REBALANCE |
| Firm Footing | Marker `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`; former Stagger dependency | D conditional/legacy | Tidak boleh diganti Stun otomatis | REWORK |
| Guard Training | Block +3 saat manual guard/Guard Stance | B behavior | Core guard jelas | KEEP |
| Combat Instinct | Accuracy +2 dan Crit +0.5/rank | A numeric | Nilai kecil, identity lemah jika berdiri sendiri | KEEP_AND_REBALANCE |
| Heavy Impact | Marker redesign; former Stagger-related slot | D/legacy | Efek lama tidak boleh diam-diam dipertahankan | REWORK |
| Battle Momentum | Damage cast membangun max3 stack, expire 6s; bonus .5→1.5%/stack | B conditional | Tempo/burst mulai mendekati specialization | SIMPLIFY |
| Counter Training | Counter damage +2%/rank saat opportunity diterima | C/D | Core counter sesuai | KEEP |
| Adrenaline | HP≤35%: incoming reduction 5→10% | D conditional | Core frontline; tidak offensive | KEEP |
| Indomitable Will | Marker redesign; former Stagger dependency | D/legacy | Jangan ubah menjadi Stun/resistance | REWORK |
| Great Weapon Familiarity | Greatsword heavy skill damage +.8%/rank | C weapon | Heavy specialization jelas | MOVE_TO_BERSERKER |
| Great Weapon Momentum | Greatsword heavy hit membuka 5s next-heavy +3→6% | C/D | Risiko heavy burst loop | MOVE_TO_BERSERKER |
| Twin Blade Familiarity | Dual sword accuracy +1/rank, crit +.5/rank | C weapon | Dual identity terlalu lengkap untuk Core | MOVE_TO_BLADE_MASTER |
| Twin Blade Rhythm | Dual sword damaging cast, max3 stacks 5s; multi-hit +1→2%/stack | C/D | Sustained rhythm spesialisasi | MOVE_TO_BLADE_MASTER |

### Dampak penghapusan Stagger pada Warrior

Tidak ada `staggerDamage`, gauge, threshold, break window, recovery, atau Stagger Resistance aktif di jalur V2 yang diaudit. Enam item masih membawa penanda desain lama:

- Rising Slash — `REWORK_NEEDED`: pertahankan hanya damage/knockback bila kelak disetujui.
- Ground Breaker — `REWORK_NEEDED`: AoE-nya tidak boleh menunggu Stagger Break.
- Crushing Finale — `REWORK_NEEDED`: payoff Armor Break perlu diaudit terpisah dari Stagger.
- Firm Footing — `REWORK_NEEDED`.
- Heavy Impact — `REWORK_NEEDED`.
- Indomitable Will — `REWORK_NEEDED`.

Field `stagger` bernilai 0 pada rank/default dan pemetaan lama ke `knockbackStrength` di `skill-action.ts` adalah **legacy schema/displacement compatibility**, bukan gameplay Stagger. Sisa field ini sebaiknya dibersihkan pada fase implementasi tersendiri setelah owner menyetujui migrasi schema; tidak diubah di audit ini.

### Warrior leakage dan signature

Signature Core yang paling layak dipertahankan: **Sweeping Slash**, **Guard Stance + Counter Slash**, **Armor Breaker**, dan **Iron Charge**. `Crushing Finale`/`Warrior Awakening` adalah kandidat capstone Core, tetapi skalanya harus divalidasi agar tidak menjadi preview Berserker.

Leakage utama:

- Great Weapon Familiarity/Momentum → **MOVE_TO_BERSERKER**.
- Twin Blade Familiarity/Rhythm → **MOVE_TO_BLADE_MASTER**.
- Relentless Assault → **SIMPLIFY_IN_CORE** bila dual/multi-hit rhythm nanti dipindahkan.
- Battle Momentum → **SIMPLIFY_IN_CORE** agar tetap tempo ringan, bukan burst engine.
- Heavy Impact/Firm Footing/Indomitable Will → **REWORK**, tidak diganti otomatis dengan Stun.

## THIEF

### Identitas saat ini

Thief sudah kuat sebagai mobile single-target opportunist: Quick Stab, Slipstep, Mark, Smoke Veil, rear/mark payoff, poison, dan disengage mendukung target selection. Namun dual-dagger multi-hit dan rangkaian stealth + rear + crit finisher telah mendekati Rogue/Assasin lebih jauh daripada target Core “light setup”.

### 16 active skills

Semua skill damage Thief saat ini physical; skill movement/setup/buff memakai resolver action tanpa damage. `Quick Stab` dan skill dagger menggunakan weapon gate yang sesuai.

| Skill | Lv/R | Weapon | Formula dan cost | Target / bentuk / hit | Effect, payoff, movement, CC | Klasifikasi; audit / rekomendasi |
|---|---|---|---|---|---|---|
| Quick Stab | 15/R5 | dagger/dual dagger | B14→30; P.95→1.15; M5; CD3→2.8 | single, 1 hit | Tidak ada conditional | **BREAD-BUTTER**; SAFE; KEEP |
| Slipstep | 17/R5 | none | M6; CD6.5→5.5 | self movement | Directional move 3.5→4.5; no iframe | **MOBILITY**; SAFE; KEEP |
| Mark Prey | 19/R5 | none | M8; CD6; dur10→14 | single mark | Personal Mark; no damage | **SETUP**; SAFE; KEEP |
| Smoke Veil | 21/R5 | none | M12; CD18→16; dur3.5→5.5 | self buff | Stealth breaks on basic/offensive/damage received; not AI invisibility | **SETUP, UTILITY**; SAFE; KEEP_AND_REBALANCE |
| Twin Fang | 23/R5 | dual dagger | M9; CD5.5→5; two hits; P total1.25→1.60 | single, 2 hit | Multi-hit | **PAYOFF**; ROGUE leakage; SIMPLIFY |
| Crippling Cut | 25/R5 | dagger/dual dagger | B18→34; P1.05→1.30; M10; CD7→6.5 | single, 1 hit | Slow 20% dur2.5→4.5; rear extends duration | **UTILITY, SETUP**; SAFE; KEEP_AND_REBALANCE |
| Venom Edge | 28/R5 | dagger/dual dagger | B18→34; P1.10→1.35; M11; CD8→7 | single, 1 hit | Poison dur4→6 | **UTILITY, PAYOFF**; SAFE; KEEP_AND_REBALANCE |
| Evasive Feint | 31/R5 | none | M10; CD18→16; dur4→6 | self buff | Evasion +8→16; not iframe | **DEFENSIVE**; SAFE; KEEP |
| Shadow Lunge | 34/R5 | dagger/dual dagger | B16→28; P.85→1.05; M11; CD7.5→6.5 | single dash, 1 hit | Dash 6.5→8; Mark payoff crit +6→10 | **MOBILITY, PAYOFF**; SAFE; KEEP_AND_REBALANCE |
| Marked Strike | 37/R5 | dagger/dual dagger | B20→36; P1.10→1.35; M10; CD6→5.5 | single, 1 hit | Mark payoff crit +8→16 and crit damage +8→16 | **PAYOFF, SIGNATURE**; likely high with Mark chain; KEEP_AND_REBALANCE |
| Blade Flurry | 40/R5 | dual dagger | M15; CD9→8; three hits; P total1.55→2.00 | single, 3 hit | Multi-hit | **PAYOFF, AOE** (target remains single); ROGUE leakage; MOVE_TO_ROGUE |
| Silent Opening | 43/R5 | dagger/dual dagger | B22→38; P1.20→1.50; M14; CD10→9 | single, 1 hit | Stealth payoff crit +12→24; crit damage +10→18 | **PAYOFF, SIGNATURE**; ASSASIN leakage; SIMPLIFY/MOVE_TO_ASSASIN |
| Rear Rend | 46/R5 | dagger/dual dagger | B24→40; P1.25→1.55; M13; CD8.5→7.5 | single, 1 hit | Rear payoff +12→25% damage | **PAYOFF**; ASSASIN leakage; SIMPLIFY |
| Disengage | 49/R5 | none | M8; CD10→8.5 | self movement | Backward move 4→5; no iframe | **MOBILITY**; SAFE; KEEP |
| Weakpoint Assault | 54/R3 | dagger/dual dagger | B32→48; P1.85→2.25; M22; CD16→14 | single, 1 hit | Mark +8→16 and rear +8→16; same payoff group | **SIGNATURE, PAYOFF**; LIKELY_HIGH; REWORK |
| Thief Instinct | 59/R3 | none | M28; CD50→46; dur10→12 | self buff | Crit +5→10; crit damage +10→20; rank 3 mana reduction | **SIGNATURE**; Assasin leakage; SIMPLIFY |

### Thief passives

| Passive | Isi runtime | Tipe | Leakage / risiko | Rekomendasi audit |
|---|---|---|---|---|
| Agile Conditioning | Max HP +1.5%/rank; evasion +1 | A | Numeric kecil | KEEP_AND_REBALANCE |
| Dagger Discipline | Physical Attack +.8%/rank dengan dagger/dual | C | Weapon scaling sah; cek stacking | KEEP |
| Keen Instinct | Crit +.5/rank | A | Numeric kecil, identitas terbatas | KEEP_AND_REBALANCE |
| Shadow Discipline | Stealth duration +5%/rank | C/D | Light stealth masih Core | KEEP |
| Dual Dagger Familiarity | Dual dagger action damage +.5%/rank, crit +.5; tidak basic | C | Rogue leakage | SIMPLIFY/MOVE_TO_ROGUE |
| Mark Expertise | Mark duration +.5s/rank | D | Core mark sesuai | KEEP |
| Fleet Footing | Slipstep/Disengage distance +.15m/rank | C | Core mobility sesuai | KEEP |
| Venomcraft | Poison duration +.4s/rank; tick unchanged | C | Light poison sesuai | KEEP |
| Rear Awareness | Rear-synergy crit +1/rank bila benar-benar rear | D | Mulai Assasin, tetapi masih light | KEEP_AND_REBALANCE |
| Opportunist | Mark-synergy crit +1/rank pada personal Mark | D | Core mark sesuai | KEEP |
| Twin Edge Control | Dual dagger multi-hit crit damage +5/+10/+15 | C/D | Rogue rhythm/crit leakage | MOVE_TO_ROGUE |
| Rapid Technique | Multi-hit damage +1.5%/rank | C | Rogue sustained tempo | MOVE_TO_ROGUE |
| Evasive Instinct | HP≤35%: evasion +5/+8/+12 | D | Defensive light | KEEP |
| Silent Opportunity | Satu cast offensive dari stealth; crit damage +5/+10/+15, snapshot seluruh hit | D | Assasin opener leakage | MOVE_TO_ASSASIN |

### Dampak Stagger dan crowd control pada Thief

Tidak ditemukan dependency aktif Thief terhadap Stagger, Stagger Break, threshold, recovery, atau Stagger Resistance. Tidak ada item Thief yang perlu penggantian Stagger.

CC aktual yang terbukti dari Core V2:

- **Slow**: Crippling Cut.
- **Knockback/displacement**: Iron Charge dan Rising Slash berada di Warrior; Thief tidak memiliki hard displacement utama.
- **Poison**: Venom Edge adalah damage-over-time/debuff, bukan hard CC.
- **Stun, root, silence, knockdown**: **NONE** sebagai efek aktif V2 yang digunakan tree ini. Union generic di `skills.ts` tidak sama dengan efek yang sedang diterapkan.

### Thief leakage dan signature

Signature Core yang paling jelas: **Quick Stab**, **Slipstep**, **Mark Prey + Marked Strike**, dan **Smoke Veil + satu payoff stealth ringan**. Venom Edge dapat menjadi signature alternatif bila poison memang ingin dipertahankan sebagai identitas Core.

Leakage utama:

- Twin Fang/Blade Flurry + Dual Dagger Familiarity/Twin Edge Control/Rapid Technique → **MOVE_TO_ROGUE** atau sederhanakan menjadi satu multi-hit ringan di Core.
- Silent Opening, Rear Rend, Weakpoint Assault, Silent Opportunity, Thief Instinct → **MOVE_TO_ASSASSIN** atau turunkan menjadi setup ringan. Jangan menambahkan Stun sebagai pengganti.
- Mark Prey, Crippling Cut, Shadow Lunge, Disengage → **KEEP_IN_CORE**.

## CFV3 damage audit lintas job

### Aman secara struktur

- Skill physical dengan weapon gate memakai physical resolver yang kompatibel dengan CFV3.
- Weapon ATK hanya masuk bila weapon cocok; unarmed tidak memperoleh weapon-dependent STR contribution.
- Tidak ditemukan kembali penggunaan global STR×2 pada jalur resolver yang diaudit.
- Tidak ada magic coefficient pada active skill Warrior/Thief yang diaudit.

### Risiko tinggi / perlu audit balance lanjutan

- Warrior `Crushing Finale`: coefficient 2.20→2.60 plus Armor Break payoff.
- Thief `Weakpoint Assault`: coefficient 1.85→2.25 plus Mark dan rear payoff.
- `Relentless Assault`, `Blade Flurry`, dan `Twin Fang`: total coefficient multi-hit naik cukup besar di rank tinggi dan dapat menerima modifier multi-hit/weapon/conditional sekaligus.
- Counter payoffs `Counter Slash` dan `Iron Reversal`: bukan otomatis salah, tetapi conditional damage harus diuji terhadap base + weapon + STR + passive multiplier.
- `Warrior Awakening`/`Thief Instinct`: global class damage/crit buffs perlu diuji terhadap skill-damage global CFV3-2.1 untuk memastikan tidak terjadi penggandaan.

### Legacy / redesign flags

- `stagger` field pada action/rank: **LEGACY_FORMULA/SCHEMA**, bukan gameplay aktif.
- Enam Warrior marker `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`: **REWORK**, bukan penggantian otomatis dengan Stun.
- Tidak ada bukti double calculation resolver yang pasti pada audit ini. Yang ada adalah **DOUBLE_SCALING_RISK** karena beberapa layer modifier memang sengaja dapat ditumpuk; ini memerlukan test numerik per skill pada fase rework.

## Rank system audit

R5 umumnya naik secara bertahap, bukan lonjakan ekstrem: Warrior Strike P1.05→1.25 dan Quick Stab P.95→1.15 adalah contoh yang relatif terkendali. Risiko lebih besar terdapat pada:

- R3 `Crushing Finale` P2.2→2.6 plus payoff.
- R3 `Weakpoint Assault` P1.85→2.25 plus dua kondisi.
- `Relentless Assault` total P sekitar 1.90→2.48.
- `Blade Flurry` total P sekitar 1.55→2.00.
- `Twin Fang` total P sekitar 1.25→1.60.

Kesimpulan: rank progression tetap bermakna, tetapi beberapa R3 finisher/multi-hit berisiko terlalu besar dibanding skill satu-hit dengan cost dan cooldown sebanding. Belum ada angka balance yang diubah.

## Resource audit

- Warrior active cost: sekitar 6–32 Mana.
- Thief active cost: sekitar 5–28 Mana.
- Physical job masih memakai Mana; belum ada FP.
- Dengan cooldown beberapa skill pendek dan cost rendah, physical class berpotensi terasa sangat berkelanjutan/“unlimited” bila regen dan pool Mana cukup besar. Ini concern desain, bukan bug yang diperbaiki di audit.
- Jika FP diputuskan nanti, perlu resource resolver terpisah, mapping cost per skill, dan rotation test. Jangan mengganti cost sekarang.

## Solo, party, dan build diversity

### Solo

- Warrior secara mekanis cocok untuk 2–4 musuh melalui cleave, Guard, Counter, armor break, dan durability; jangan mengandalkan one-shot.
- Thief cocok untuk 1–2 target melalui target selection, mobility, Mark, rear/crit, dan poison; AoE farming besar bukan identitasnya.

### Party

Warrior menawarkan frontline, Armor Break, counter, dan enemy management. Thief menawarkan priority-target damage, Mark, poison, serta rear exploitation. Tree saat ini tidak menunjukkan ketergantungan party untuk leveling dasar; party seharusnya meningkatkan efisiensi. Dukungan party formal belum menjadi sistem yang lengkap di dua registry ini, sehingga kontribusi party masih berupa efek combat individual.

### Pilihan build

Warrior memiliki offensive frontline, guard/counter, dan weapon-path, tetapi weapon-path Greatsword/Dual Sword terlalu lengkap untuk Core. Thief memiliki precision, mobility, mark/stealth, poison, dan dual-dagger, tetapi dual-dagger dan stealth/rear payoff sudah menghabiskan ruang identitas Specialization. Karena itu struktur sekarang lebih tepat **RESTRUCTURE** daripada mempertahankan seluruh node apa adanya.

## Rekomendasi implementasi berikutnya

1. Kunci audit ini tanpa perubahan gameplay.
2. Pisahkan secara eksplisit Core identity dari Berserker/Blade Master dan Rogue/Assasin.
3. Bersihkan atau migrasikan marker/schema Stagger lama hanya dalam fase schema cleanup terpisah.
4. Audit numerik finisher dan multi-hit dengan matrix CFV3; jangan rebalance berdasarkan perkiraan visual.
5. Putuskan weapon requirement untuk self-buff Warrior.
6. Setelah owner review, baru lakukan rework node yang bertanda `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`.
7. Stun dan FP tetap fase terpisah; jangan diperkenalkan sebagai pengganti Stagger pada fase ini.

## Status perubahan

- Skill definitions: tidak diubah.
- Skill damage/cooldown/cost: tidak diubah.
- Skill tree/passive placement: tidak diubah.
- Monster/equipment/Rune: tidak diubah.
- Stun/FP/Specialization: tidak diaktifkan.
- Production map/runtime: tidak diubah.
- Laporan ini adalah hasil audit dan rekomendasi owner-review saja.
