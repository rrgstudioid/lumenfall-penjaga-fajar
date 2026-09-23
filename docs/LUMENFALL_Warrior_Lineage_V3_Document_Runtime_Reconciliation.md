# LUMENFALL Warrior Lineage V3 — rekonsiliasi DOCX dan runtime

Tanggal audit: 23 September 2026. Status: **MAJOR MISMATCH**. Ini audit baca-saja; tidak ada gameplay, balance, UI, save, atau DOCX yang diubah. Dokumen kandidat adalah `C:\Users\USER\Documents\LUMENFALL_Warrior_Lineage_V3_Source_of_Truth.docx` (SHA-256 `8B89886255484DD06EEB712559E153718B0B1A620D854D76F73A2F42EA2AC21F`). Karena file sedang dibuka aplikasi lain, teks dibaca dari salinan identik berdasarkan hash di `Documents\Codex\2026-09-23\referenced-chatgpt-conversation-this-is-an\outputs`.

**Authority teknis:** working tree lokal `output/github-clean-migration-20260922` pada saat audit. Beberapa file di working tree sudah mempunyai perubahan dari pekerjaan sebelumnya; audit ini tidak mengubahnya. Yang disebut “runtime” di bawah adalah jalur kode yang dipakai game lokal (`rules.ts` → `resolveSkillAction` → `world.ts`), bukan klaim bahwa deployment Vercel/ChatGPT Site sedang menjalankan commit yang sama. Fixture murni dijalankan untuk formula; tidak ada browser/headed session atau full-world playtest baru dalam audit ini.

## 1. Putusan dan arti klasifikasi

32 skill yang diminta memang terdaftar: 3 Adventurer, 11 Warrior, 9 Berserker, 9 Blade Master. Banyak gate, coefficient, scaling Warrior/Berserker/Blade Master, Stun chance, Armor Break rank, dan hit sequence sesuai. Namun DOCX belum aman sebagai *source of truth* karena selisih besar pada SP income, Mana Adventurer, cara membaca explicit STR/DEX, Mana/cooldown buff, Tempo Drive, dan sejumlah perilaku `world.ts` yang tidak mengikuti data/fixture.

`MATCH` = dokumen dan jalur runtime cocok; `STALE` = dulu mungkin benar tetapi kode sudah berubah; `INCORRECT` = klaim bertentangan dengan jalur runtime sekarang; `INCOMPLETE` = detail penting hilang; `PRESENTATION_ONLY` = metadata/teks belum menjadi perilaku; `FIXTURE_ONLY` = angka atau validasi ada pada fixture, belum membuktikan jalur world; `NOT_VERIFIABLE` = tidak dapat dipastikan tanpa headed runtime/target keadaan tertentu. Label dipakai per klaim, bukan untuk menyatakan seluruh skill salah.

## 2. Formula CFV3: dokumen vs jalur aktual

| Lapisan | Runtime aktual | Status terhadap DOCX |
|---|---|---|
| Base Physical ATK | `7 + floor(max(1,floor(level)) * 1.1)` | `MATCH` untuk level bulat ≥1. `rules.ts:158`. |
| Effective primary stats | `base.str/dex/vit/int + gear` dihitung satu kali di `derivedStats` | `MATCH`. `rules.ts:832-840`. |
| Physical stat contribution | `max(0, effectiveSTR - 15) * weaponFactor`; untuk `none` faktor 0, sword/dual sword faktor 1 | `MATCH` untuk formula PATK. `rules.ts:149-154,850-854`. |
| PATK | `round((basePATK + physicalStatContribution + gear.attack) * (1 + (gear.attackPercent + gear.physicalDamage)/100))` | `MATCH` sebagai formula umum. Raw weapon ATK dari item yang kompatibel masuk `gear.attack` dan karenanya PATK; bukan selalu layer terpisah. `rules.ts:854`; pemisahan per tangan baru dilakukan untuk hit Blade Master tertentu di `composeBladeWeaponHits`. |
| Explicit STR/DEX/VIT/INT skill | `statScaling.str * primaryStats.str + ...` ditambahkan ke `hit.baseDamage` sebelum `damageMultiplier`. Untuk Adventurer/Warrior/Berserker dan **Twin Assault**, input STR/DEX adalah **nilai efektif penuh**; untuk Blade Master selain Twin Assault, STR/DEX dipotong 15 dan di-clamp 0. | `INCORRECT` untuk definisi DOCX bahwa “bonus STR” selalu STR di atas 15. `skill-action.ts:178-188`, `rules.ts:1024-1028`. Tidak ada satu definisi seragam lintas lineage. |
| Raw hit generik | `(flat + explicit stats + P * PATK + M * MATK + skillPowerCoeff * skillPower) * damageMultiplier`; jika `composedPhysicalPower` tersedia, ia menggantikan `P * PATK` | `INCOMPLETE` di DOCX karena komposisi per tangan dan definisi stats efektif tidak dijelaskan tepat. `skill-action.ts:257-268`. |
| Modifier skill | V3 tidak menerima legacy `1 + (rank-1)*.12`. Multiplier awal = `masteryPower * (1+equipmentDamage) * (1+skillDamage/100)`; modifier aksi/payoff menambah lapisan sesuai `combat-modifiers.ts`. | `MATCH` soal tak ada multiplier rank V2 tersembunyi; `INCOMPLETE` untuk urutan dan batas. `skill-action.ts:168-173,249-252`. |
| Battle Cry | Modifier `percent.physicalAttack` +3/4/5/6/7 pada derived PATK setelah formula dasar, **bukan** `physicalDamage`/final skill damage | `INCORRECT` wording DOCX; explicit stat-scaling flat tidak ikut naik oleh Battle Cry. `warrior-v3.ts:62-64`, `combat-modifiers.ts:194-222`. |
| Hit → damage | Validasi target → satu roll Accuracy/Evasion → crit bila hit → raw hit → bonus target tertentu termasuk Ruinous Arc → `Math.round(amount)` → `hurtEnemy` → mitigation → HP → status/proc. | `MATCH` pada prinsip hit-before-crit; `INCOMPLETE` pada rounding, target bonuses, dan waktu status. `world.ts:2305-2404,2678-2690`. |
| Critical | `min(0.8, criticalRate/100)`; damage hit dikali `criticalDamage/100` sebelum rounding | `INCOMPLETE` di DOCX. `combat-mechanics.ts:23`, `world.ts:2332`. |
| Defense | `effectiveDefense = max(0, defense*(1-penetration/100))`; reduction = `effectiveDefense/(effectiveDefense+500+attackerLevel*10)`; Armor Break mengurangi defense terlebih dahulu | `MATCH` secara konsep; `INCOMPLETE` formula tepat. `combat-mechanics.ts:17-22`, `world.ts:2683-2688`. |

Contoh DOCX §2 dan §9 **tidak konsisten dengan rumus PATK-nya sendiri**: pada Lv15, base 23, STR 28, weapon ATK 8, tanpa modifier, runtime PATK = **44** (`23 + (28-15) + 8`), bukan 59. Warrior Strike R1 kemudian raw = `44*1 + 28*.08 = 46.24`, bukan 60.04. Matriks sanity DOCX yang memberi Lv15 PATK 31 dan Warrior Strike 32.20 justru cocok dengan STR efektif 15 dan penambahan `15*.08=1.20`; teks “bonus STR di atas 15” tidak menjelaskan angka itu.

## 3. Cara membaca tabel skill

Seluruh array berurutan R1→Rmax. `L` = level gate, `P` = physical coefficient, `S/D` = explicit STR/DEX scaling, `M` = **base Mana** sebelum reduction/ceil, `C` = base cooldown detik sebelum modifier, `R` = radius meter, `K` = target cap data, `H` = jumlah gameplay hit. `—` berarti tidak ada coefficient/cost/requirement terkait. `1H/2H` = satu atau dua tangan sword; `dual` = dua real one-hand swords. Semua physical skill lineage ini mempunyai flat damage 0, magic coefficient 0, VIT scaling 0, INT scaling 0, dan knockback 0 pada data V3. Semua `pvpOverride` skill kosong; hanya tiga `stunProfile` mempunyai data durasi PvP, **bukan PvP runtime**. Deskripsi/motion tidak menentukan damage. Source definisi dan adapter terdapat di `lib/game/{adventurer-v3,warrior-v3,berserker-v3,blade-master-v3}.ts`; eksekusi memakai `rules.ts`, `skill-action.ts`, `world.ts`. `M/C` tanpa array berarti **konstan di seluruh rank pada resolver**, bukan “rank berikutnya belum didefinisikan”.

## 4. Adventurer — 3 skill

| Skill / gate / biaya / prasyarat | Data runtime tepat | Target, efek, penilaian DOCX |
|---|---|---|
| Quick Slash `v3-adventurer-quick-slash`; max5; L `[1,3,6,9,13]`; 1 SP/rank, R1 granted; tanpa prereq | P `[1.05,1.08,1.12,1.16,1.20]`; S **`[.02,.02,.02,.02,.02]`** (base `statScaling`, tak dioverride rank); M **`[12,12,14,14,16]`**; C `[3.2,3.1,3,2.9,2.8]` | Single H1, 1H, range 3.8. P/C/gate `MATCH`; DOCX S `[.02,.03,.04,.05,.06]` dan M `[3,3,4,4,5]` `STALE/INCORRECT`. `adventurer-v3.ts:8-13,43-45`; `skill-action.ts:132-145`. |
| Power Strike `v3-adventurer-power-strike`; max5; L `[4,7,10,12,14]`; 1 SP/rank; tanpa prereq | P `[1.20,1.26,1.32,1.38,1.45]`; S **`[.04,.04,.04,.04,.04]`**; M **`[18,18,20,20,22]`**; C `[6,5.75,5.5,5.25,5]` | Single H1, 1H, range 3.8. P/C/gate `MATCH`; DOCX S `[.04,.05,.06,.07,.08]` dan M `[5,5,6,6,7]` `STALE/INCORRECT`. `adventurer-v3.ts:17-23,45`. |
| Minor Heal `v3-adventurer-minor-heal`; max3; L `[2,8,14]`; 1 SP/rank; tanpa prereq | Heal `[6,8,10]%` max HP; M **`[26,28,30]`**; C `[30,28,26]`; P/S/D 0 | Self H0, no weapon. Heal/C/gate `MATCH`; DOCX M `[8,10,12]` `STALE`. `adventurer-v3.ts:28-36,46`, `rules.ts:1052-1057`. |

Meskipun schema `defaultProfile` Adventurer berisi cost R1, cast memakai `rankValues`, sehingga angka M di atas adalah yang benar. Dokumentasi perlu membedakan raw registry value dan resolved Mana yang mungkin berubah oleh `manaCostReduction` karakter.

## 5. Warrior — 11 skill

| Skill / maxRank / L / prereq | Runtime P, S/D, M/C, shape/effect | Perbandingan dokumen |
|---|---|---|
| Warrior Strike; R10; `[15,18,21,24,28,32,36,41,47,55]`; — | P `[1,1.02,1.04,1.07,1.09,1.11,1.13,1.15,1.18,1.20]`; S `[.08,.09,.10,.11,.12,.13,.14,.15,.16,.18]`; M `[5,5,6,6,7,7,8,8,9,10]`; C `[3.2,3.15,3.1,3.05,3,2.95,2.9,2.85,2.8,2.8]`. Single H1, 1H/2H. | Array/gates `MATCH`; formula kata “bonus STR di atas 15” `INCORRECT` (memakai full effective STR). |
| Iron Charge; R5; `[17,26,35,44,53]`; — | P `[.75,.80,.85,.90,.95]`; S `[.05,.07,.08,.10,.12]`; M `[8,9,10,11,12]`; C `[8,7.6,7.2,6.8,6.5]`; range `[6.5,7,7.5,8,8.5]`; single H1, 1H/2H, dash; Stun `[10,15,20,25,30]%` bila actual travel ≥3.5 m, PvE 1.5s/PvP data .75s. | Angka `MATCH`; knockback 0. Stun hanya sesudah hit yang tidak evade. `warrior-v3.ts:18`, `world.ts:2230-2248,2392-2421`. |
| Sweeping Slash; R8; `[20,24,29,34,40,46,51,56]`; Warrior Strike R2 | P `[.88,.92,.96,1,1.05,1.10,1.14,1.18]`; S `[.08,.10,.11,.13,.15,.17,.18,.20]`; M `[8,9,10,11,12,13,14,15]`; C `[6,5.9,5.8,5.6,5.5,5.3,5.1,5]`; R data `[4,4.1,4.2,4.3,4.4,4.5,4.65,4.8]`; K `[3,3,4,4,4,5,5,5]`; frontal H1/target, 1H/2H. | Rank arrays `MATCH`; **live selector memakai range tetap 4.8 dan sudut default 90°**, bukan rank radius dan tag `arc:120`. R/sudut sebagai gameplay `INCORRECT/PRESENTATION_ONLY`. `world.ts:2190-2201`, `skill-action.ts:222-246`. |
| Guard Stance; R5; `[22,30,38,46,54]`; — | DR `[8,10,12,14,16]%`, Block `[4,6,8,10,12]`, dur `[5,5.5,6,6.5,7]`; **M 10 seluruh rank; C 18 seluruh rank**. Self H0; **weapon requirement 1H/2H**. | Efek/dur `MATCH`; DOCX M `[10,11,12,13,14]`, C `[18,17.5,17,16.5,16]`, dan “buff tak memaksa sword” `INCORRECT`. `warrior-v3.ts:22,64-67`; `rules.ts:999-1000`. |
| Armor Breaker; R5; `[25,33,41,48,55]`; Warrior Strike R3 | P `[1,1.05,1.10,1.15,1.20]`; S `[.10,.12,.14,.16,.18]`; M `[11,12,13,14,15]`; C `[10,9.6,9.2,8.8,8.5]`; single H1, 1H/2H; Defense Down `[6,7.5,9,10.5,12]%` **dur 8s seluruh rank**. | Array, ownership, strongest-only `MATCH`; DOCX hanya menyebut 8s dan itu cocok dengan runtime, walaupun berbeda dari kontrak desain lama yang bukan authority audit ini. `warrior-v3.ts:14,24,79-81`. |
| Battle Cry; R5; `[28,35,42,49,56]`; — | Derived Physical Attack `[3,4,5,6,7]%`, dur `[20,22,24,26,28]`; **M 14 seluruh rank; C 35 seluruh rank**. Self H0, no weapon. | Persentase/dur `MATCH`; DOCX M `[14,15,16,17,18]` `INCORRECT`; label “Physical Damage %” `INCORRECT` karena modifier sebenarnya `physicalAttack`. |
| Counter Slash; R5; `[31,37,44,50,57]`; Guard Stance R2 | P `[.90,.94,.99,1.03,1.08]`; S `[.08,.095,.11,.125,.14]`; D `[.08,.105,.13,.155,.18]`; M `[9,10,11,12,13]`; C `[6.5,6.25,6,5.75,5.5]`; payoff block/parry `[15,18,22,26,30]%`. Single H1, 1H/2H. | Angka `MATCH`; skill punya base hit tanpa context, payoff baru pada valid context. `warrior-v3.ts:28,57-59`. |
| Battle Focus; R5; `[34,40,46,52,58]`; — | Accuracy `[5,7,9,11,13]`, Crit Rate `[1,1.5,2,2.5,3]` pp, dur `[20,22,24,26,28]`; **M 14 seluruh rank; C 35 seluruh rank**. Self H0, no weapon. | Efek/dur `MATCH`; DOCX M `[14,15,16,17,18]` `INCORRECT`. `warrior-v3.ts:29,68-70`. |
| Ground Breaker; R5; `[38,43,48,53,58]`; Sweeping Slash R4 | P `[1.05,1.12,1.20,1.27,1.35]`; S `[.15,.18,.22,.26,.30]`; M `[15,16,17,18,19]`; C `[11,10.6,10.2,9.8,9.5]`; R `[4.3,4.5,4.65,4.8,5]`; K data `[5,5,5,6,6]`; radial H1/target, 1H/2H. | Array `MATCH`; **world tidak menerapkan K pada area target selector** (`INCORRECT` secara live). `world.ts:2195-2208`. |
| Unbroken Stance; R5; `[43,47,51,55,59]`; Guard Stance R3 | DR `[3,4,5,6,7]%`, knockback-resistance data `[15,20,25,30,35]%`, dur `[8,8.5,9,9.5,10]`; **M 16 seluruh rank; C 28 seluruh rank**. Self H0, no weapon; tidak menambah maxHP atau Stun immunity. | Efek/dur `MATCH`; DOCX M `[16,18,20,22,24]`, C `[28,27.5,27,26.5,26]` `INCORRECT`. `warrior-v3.ts:34,70-74`. |
| Crushing Finale; R3; `[52,56,59]`; Armor Breaker R3 | P `[1.45,1.58,1.70]`; S `[.22,.27,.32]`; M `[20,22,24]`; C `[14,13,12]`; single H1, 1H/2H; +10% personal payoff dari own active Armor Break. | Skill data/payoff `MATCH`, tetapi sanity matrix DOCX untuk payoff **belum dibuktikan oleh test yang dicetak**; test `warrior-v3.test.ts:148-156` memakai `{defenseDown:8}` tanpa source record sehingga output runtime test payoff = normal. Label angka payoff DOCX `FIXTURE_ONLY/INCOMPLETE`. |

Seluruh Warrior skill berbiaya 2 SP/rank; total 61 rank = 122 SP (`MATCH`). `Rising Slash` tidak ada pada registry V3 (`MATCH`). Source rincian `warrior-v3.ts:15-87`; target picking `world.ts:2186-2208`.

## 6. Berserker — 9 skill

| Skill / maxRank / L / prereq | Data runtime tepat | Perbandingan dokumen |
|---|---|---|
| Two-Hand Sword Mastery; R5; `[60,64,68,73,78]`; —; 4 SP/rank | Accuracy `[2,4,6,8,10]`; Mana reduction `[2,4,6,8,10]%` bila memakai 2H dan skill Berserker tagged; passive H0, no cast. | `MATCH` untuk efek. Scope runtime juga mencakup **Iron Blood dan Berserker Trance** ketika 2H terpasang, karena resolver menguji tag Berserker + weapon style, bukan daftar skill ofensif; wording DOCX `INCOMPLETE`. `rules.ts:1004-1017`. |
| Raging Cleave; R8; `[60,63,65,68,70,73,76,79]`; Sweeping Slash R4 | P `[.95,1,1.05,1.10,1.15,1.20,1.25,1.30]`; S `[.15,.17,.19,.21,.24,.27,.29,.32]`; M `[14,15,16,17,18,19,20,21]`; C `[7,6.8,6.6,6.4,6.2,6,5.9,5.8]`; R data `[4.6,4.7,4.8,5,5.1,5.25,5.4,5.5]`; K `[4,4,5,5,6,6,7,7]`; frontal H1/target, 2H. | Numeric arrays `MATCH`; world memakai frontal `range=5.5` tetap, bukan R per rank; K diberlakukan. `INCORRECT` bila DOCX R dimaksudkan jangkauan aktual. |
| Crushing Blow; R5; `[61,65,69,74,79]`; — | P `[1.20,1.28,1.37,1.46,1.55]`; S `[.22,.26,.30,.34,.38]`; M `[14,15,17,18,20]`; C `[8.5,8.25,8,7.75,7.5]`; single H1, 2H. | Array/gate `MATCH`. |
| Iron Blood; R5; `[62,66,70,75,80]`; — | MaxHP `[5,6,7,8.5,10]%`, DR `[2,2.5,3,4,5]%`, dur `[8,9,10,11,12]`; M `[18,20,22,24,26]`; C `[34,33.5,33,32.5,32]`; self H0, no weapon requirement. | `MATCH`; world menyesuaikan current HP secara rasio saat aktivasi. `world.ts:2158-2160`. |
| Breaker Entry; R5; `[63,67,71,75,79]`; Iron Charge R3 | P `[.75,.81,.87,.94,1]`; S `[.10,.12,.15,.17,.20]`; M `[12,13,14,15,16]`; C `[10,9.6,9.2,8.8,8.5]`; R `[3.5,3.7,3.9,4,4.2]`; K data `[3,3,4,4,5]`; radial H1/target, 1H/2H; 4s window dari Iron Charge hit, tak mengulang charge. | Angka/window `MATCH`; K area tidak diberlakukan oleh live world selector (`INCORRECT`). |
| Earth Splitter; R5; `[66,69,72,76,80]`; Raging Cleave R3 | P `[1.20,1.28,1.37,1.46,1.55]`; S `[.25,.30,.35,.40,.45]`; M `[22,24,26,28,30]`; C `[14,13.5,13,12.5,12]`; R `[5,5.25,5.5,5.75,6]`; K data `[5,6,6,7,8]`; radial H1/target, 2H; Stun per landed target `[8,10,12,15,18]%`, PvE 1.5s/PvP data .75s. | Koefisien/status `MATCH`; K live `INCORRECT` (fixture `berserker-v3-fixture.ts:85-87` memang melakukan `.slice`, world tidak). |
| Ruinous Arc; R5; `[68,71,74,77,80]`; Armor Breaker R3 | P `[1.10,1.18,1.25,1.32,1.40]`; S `[.20,.24,.28,.31,.35]`; M `[17,18,20,21,23]`; C `[10.5,10.1,9.7,9.3,9]`; R data `[4.5,4.7,4.9,5,5.2]`; K `[4,4,5,5,6]`; frontal H1/target, 2H; own Armor Break +8%. | Data/payoff `MATCH`; live frontal range tetap 5.2 bukan R per rank (`INCORRECT` bila R dianggap jangkauan aktif). |
| Fury Harvest; R5; `[70,73,75,78,80]`; Earth Splitter R3 + Iron Blood R2 | P `[1,1.06,1.12,1.18,1.25]`; S `[.15,.18,.21,.24,.28]`; M `[24,26,28,30,32]`; C `[13,12.5,12,11.5,11]`; R `[4.5,4.7,4.9,5,5.2]`; K data `[5,5,6,6,7]`; radial H1/target, 2H; heal `[.6,.7,.8,.9,1]%` MaxHP per successful target, **heal count cap 5**. | Heal/cap heal `MATCH`; K **damage** tidak diberlakukan oleh live area selector (`INCORRECT`). Fixture menylice target, sehingga hasil fixture tidak membuktikan world cap. |
| Berserker Trance; R3; `[75,78,80]`; Mastery R3 + 18 SP Berserker; 5 SP/rank | Self H0, 2H; **M `[30,30,30]`, C `[90,90,90]`** dari satu fallback rank value; dur `[12,14,16]`; final Berserker 2H damage `[6,8,10]%`, AoE cap data +1, Frenzy Guard DR `[4,5,6]%` selama 2s bila ≥3 actual landed enemies. | DOCX menulis M30/C90: `MATCH`, tetapi perlu eksplisit bahwa konstan semua rank. +1 cap pada **area** tetap tidak efektif di world karena area K tidak dipakai. `berserker-v3.ts:85-90,111-121`; `world.ts:2154-2167,2441-2445`; `rules.ts:1032-1037`. |

Normal Berserker 3 SP/rank; mastery 4; ultimate 5. Total 149 SP (`MATCH`). Sumber array `berserker-v3.ts:95-139`. Walau sebagian data radius/cap ada di registry, bedakan “nilai definisi” dari “pemilihan target live”.

## 7. Blade Master — 9 skill

| Skill / maxRank / L / prereq | Data runtime tepat | Perbandingan dokumen |
|---|---|---|
| Twin Blade Mastery; R5; `[60,64,68,73,78]`; —; 4 SP/rank | Passive H0, capability dual pada R1; Accuracy `[2,4,6,8,10]`, reduction `[0,2,4,6,8]%`. Scope reduction: **Twin Assault, Cross Sever, Blade Tempest, Tempo Drive cast** bila dual. | Angka `MATCH`; DOCX “Twin Assault mana reduction” `INCOMPLETE/menyesatkan`. Runtime adapter punya fallback M16/C35, tetapi pasif tidak hotbar/castable: `PRESENTATION_ONLY/adapter placeholder`, bukan biaya gameplay. `blade-master-v3.ts:14-19,141-145`, `rules.ts:1013-1018`. |
| Twin Assault; R8; `[60,63,65,68,70,73,76,79]`; Mastery R1 | P total `[.80,.84,.88,.93,.98,1.03,1.08,1.12]`; S `[.08,.09,.10,.11,.12,.14,.16,.18]`; D `[.10,.11,.12,.14,.16,.18,.20,.22]`; M `[10,11,12,13,14,15,16,17]`; C `[4.5,4.4,4.3,4.2,4.1,4,3.9,3.8]`; single H2 MAIN→OFF, shared weight `.5/.5`, dual. | Data `MATCH`; explicit STR/DEX input **full** effective stats, bukan “di atas 15”. Hit coefficients P/2 masing-masing; raw per-hand item attack tidak dipenalti 50% tersembunyi, tetapi terkena coefficient hit yang dideklarasikan. Successful cast +1 Tempo, Flow consumer. |
| Blade Rush; R5; `[62,66,70,74,79]`; Iron Charge R3 | P `[.75,.82,.90,.98,1.06]`; S `[.05,.06,.07,.08,.10]`; D `[.12,.15,.18,.21,.24]`; M `[10,11,12,13,14]`; C `[7.5,7.1,6.7,6.3,6]`; single H1, any sword, dash. | Data `MATCH`; DOCX “pass-through” hanya niat motion: world memakai dash sampai stopDistance 1.2m, bukan endpoint 1.5m di belakang target (`PRESENTATION_ONLY/INCORRECT` sebagai gerak gameplay). Hit sukses membuka Flow. |
| Counterflow; R5; `[63,67,71,75,79]`; Counter Slash R3 | P `[1,1.06,1.12,1.18,1.25]`; S `[.08,.09,.10,.12,.14]`; D `[.16,.19,.22,.26,.30]`; M `[12,13,14,15,16]`; C `[8,7.6,7.2,6.8,6.5]`; single H1, any sword; Stun chance 100%, PvE .8s/PvP data .4s; counter policy blocked/parried 2.5s. | Array/Stun data `MATCH`, **syarat valid CounterContext tidak ditegakkan sebelum cast atau sebelum Stun**: `world.ts:2119-2123` hanya mencari target lalu snapshot context (dapat `none`); Stun rollout `world.ts:2402-2422` tidak memeriksa `counter.result`. Klaim “tanpa context tidak ada guaranteed Stun” `INCORRECT` untuk live path. |
| Blade Focus; R5; `[64,68,72,76,80]`; — | Accuracy `[6,9,12,15,18]`, Crit `[2,3,4,5,6]` pp, dur modifier `[20,22,24,26,28]`; M `[16,17,18,19,20]`; C `[35,35,35,35,35]`; self H0, any sword. Intended Flow extension `[3.5,3.75,4,4.25,4.5]` saat buff. | Stat buff/dur `MATCH`. **Flow extension tidak terbukti aktif pada world path**: `world.ts:2215-2216` menulis `activeBuffs[id]=skill.duration`, sedangkan action Blade Focus `duration=0`; `world.ts:2360` mengecek `activeBuffs[id]>0` dan jatuh ke 3s. `INCORRECT` untuk extension live, walau fixture state dapat mensimulasikannya. |
| Cross Sever; R5; `[66,69,72,76,80]`; Twin Assault R3 | P `[1.20,1.28,1.35,1.43,1.50]`; S `[.12,.14,.16,.18,.20]`; D `[.18,.21,.24,.27,.30]`; M `[16,17,18,20,21]`; C `[8,7.8,7.6,7.4,7.2]`; single H1 BOTH, dual, one crit roll. | Data `MATCH`; shared core sekali + main/off layer; successful hit +1 Tempo dan Flow consumer. |
| Piercing Sequence; R5; `[68,71,74,77,80]`; Blade Rush R2 + Armor Breaker R3 | P total `[1.15,1.25,1.35,1.45,1.55]`; S `[.08,.09,.10,.12,.14]`; D `[.20,.24,.28,.32,.36]`; M `[15,16,17,18,20]`; C `[8.5,8.1,7.7,7.3,7]`; single H3 MAIN/MAIN/MAIN, weight `.3/.3/.4`, any sword. Own Armor Break: +10 Accuracy tiap hit, +10 crit pp hit akhir. | Data/payoff `MATCH`; per hit dapat evade/crit independen. Offhand raw attack tidak dipakai dalam `composedPhysicalPower`; source `blade-master-impact.ts:21-35`. |
| Tempo Drive; R5; `[71,73,75,78,80]`; Twin Assault R4 | **M `[14,15,16,17,18]`, C `[24,23,22,21,20]`**; self H0, dual, membutuhkan ≥1 Tempo dan mengonsumsi semua. Dur menurut stack `[5.5,7,8.5]`; ASPD base `[4,5,6,7,8]%` +4 pp/stack; mana reduction base `[2,3,4,5,6]%` +4 pp/stack. | DOCX `NOT_DEFINED`/fallback 0 `STALE`. Aktivasinya sendiri menerima **Mastery reduction**, tidak buff reduction yang baru diaktifkan. Buff mana hanya Twin Assault/Cross Sever/Blade Tempest; highest applicable reduction menang. `blade-master-v3.ts:70-77,97,141-145`, `combat-transient.ts:101-106`. |
| Blade Tempest; R3; `[75,78,80]`; Mastery R3 + 18 SP Blade Master; 5 SP/rank | Total P `[1.75,2.00,2.25]`; per-hit R1 `[.25,.25,.25,.25,.75]`, R2 `[.28,.28,.28,.28,.88]`, R3 `[.30,.30,.30,.30,1.05]`; S total `[.18,.22,.26]`, D `[.28,.34,.40]`; M `[36,40,44]`; C `[70,68,65]`; single H5 MAIN/OFF/MAIN/OFF/BOTH, shared weights `[.15,.15,.15,.15,.40]`, dual. | Arrays/sequence `MATCH`. Flow +5 crit pp seluruh hit yang berhasil disiapkan, konsumsi saat hit pertama berhasil. Snapshot tepat 3 Tempo → final hit +25 crit pp/+10% damage; Tempo habis saat first damaging impact. `blade-master-v3.ts:129-131`, `blade-master-impact.ts:12-44`. |

Normal Blade Master 3 SP/rank; mastery 4; ultimate 5. Total 149 SP (`MATCH`). Tidak ada dedicated Blade Master AoE (`MATCH`). Source arrays `blade-master-v3.ts:90-145`; semua physical hit VIT/INT/flat/magic 0.

## 8. Dual Wield dan pembuktian formula

`resolveWeaponStyle` hanya menghasilkan `dual_sword` bila main/off dua item 1H berbeda; capability diperoleh dari Mastery R1, tidak otomatis untuk Warrior/Berserker. `resolveWeaponAttackContext` menyediakan `SINGLE_MAIN`, `SINGLE_OFF`, `DUAL_COMBINED`, `DUAL_SEQUENCE`; item raw atk main/off penuh, stat karakter dari gear digabung sekali. `composeBladeWeaponHits` menghitung `shared = PATK - mainRaw - offRaw`, lalu per hit:

`composedPhysicalPower = shared * sum(hitCoefficients) * sharedWeight + handRaw * hitCoefficient * weaponContributionCoefficient`.

`BOTH` memakai `mainRaw + offRaw`; masing-masing raw item tidak diberi penalti 50% tersembunyi. Explicit stat scaling dibagi menurut `sharedContributionWeight` dan ditambahkan sebagai flat. Ini menjelaskan Twin Assault, Cross Sever, Piercing Sequence, dan lima hit Tempest (`MATCH` untuk struktur; wording “full offhand” perlu menjelaskan coefficient per hit). `dual-wield.ts:63-75`, `blade-master-v3.ts:147-159`, `skill-action.ts:178-200`.

**Pengecualian live yang besar:** fungsi komposisi hanya dipanggil jika `bladeSkill` (`rules.ts:1029-1032`). Warrior skill warisan tidak melalui `SINGLE_MAIN`; saat dual-wield ia memakai PATK penuh dari kedua item. Fixture in-memory level 80, main ATK 100, offhand 70→170, stat item lain tetap:

| Offhand ATK | PATK | Warrior Strike R1 raw | Cross Sever R1 raw | Piercing Sequence R1 raw |
|---:|---:|---:|---:|---:|
| 70 | 265 | 266.2 | 318 | 224.25 |
| 170 | 365 | **366.2** | 438 | **224.25** |

Piercing sudah `SINGLE_MAIN`; Warrior Strike belum. Jadi pernyataan DOCX tentang mode `SINGLE_MAIN` sebagai kontrak umum melebihi yang diimplementasikan (`INCORRECT` untuk inherited Warrior live). Tidak ada item/skill yang diubah dalam fixture. `SINGLE_OFF` tersedia sebagai primitive dan Basic Attack dual memilih hand bergantian; tidak ada skill aktif lineage ini yang khusus `SINGLE_OFF`.

## 9. Stun

| Source | Chance / durasi / syarat aktual | Penilaian |
|---|---|---|
| Iron Charge | `[.10,.15,.20,.25,.30]`, PvE 1.5s, PvP metadata .75s; actual travel ≥3.5 m; hanya impact yang hit | `MATCH`. Movement selesai tetap walau impact evade; tanpa knockback. |
| Earth Splitter | `[.08,.10,.12,.15,.18]` per hit target, PvE 1.5s, PvP metadata .75s | `MATCH` chance/policy; jumlah target live dapat melebihi cap data karena selector area. |
| Counterflow | `[1,1,1,1,1]`, PvE .8s, PvP metadata .4s, impact hit | Chance/dur `MATCH`; **counter prerequisite pada cast/stun `INCORRECT`** seperti §7. |

Generic `stun.ts` menyimpan source actor/skill, applied/expires, immunity policy; reapplication mengambil expiry lebih akhir, tidak menambah durasi. Saat Stun, movement/basic/skill terkunci; transient dan tidak disimpan. `stun.ts:1-75`, `world.ts:2084,2400-2425`, `rules.ts:2388-2397`. Tidak ada Stagger dalam jalur ketiga source ini. Target-policy `REDUCED` hanya hook; nilai reduksi belum diimplementasikan (`INCOMPLETE` bila DOCX menganggapnya aktif).

## 10. Armor Break

R1–R5 runtime `[6,7.5,9,10.5,12]%`; `armorBreakStrengthByRank` di adapter Warrior dipakai pada impact, bukan legacy 20%. Record `sourceActorId/sourceSkillId/strength/appliedAt/expiresAt` independen; yang terkuat aktif dipakai mitigation; reapply actor yang sama mengganti record, tidak additive; saat expiry fallback ke source lain. Crushing Finale +10% hanya own active source melalui `targetStatusesFromSource`; Ruinous Arc +8% hanya own source melalui pengecekan world; Piercing +10 Accuracy per hit dan +10 crit pp pada final hit hanya own source. `MATCH` untuk kontrak ini. Source: `warrior-v3.ts:14,77-81`, `combat-status.ts:54-105`, `combat-modifiers.ts:100-105,367-381`, `world.ts:2347-2379`, `blade-master-impact.ts:20-35`.

Legacy 20% masih ada di `effectiveArmorBreakStrength` **hanya jika `sourceOwnedStatuses` belum ada** dan timer `defenseDown` ada (`combat-status.ts:76-80`). Itu bukan angka Armor Breaker V3. Tetapi status campuran V2/V3 pada target tanpa source-owned record dapat memakai fallback tersebut sampai aplikasi V3 dibuat; DOCX harus menulis batas kompatibilitas ini, bukan mengklaim konstanta 20% sudah lenyap global (`INCOMPLETE`). Buff Armor Break diterapkan **setelah** damage Armor Breaker sendiri, sehingga hit penerap tidak mendapat mitigasi yang diturunkan oleh status barunya.

## 11. Accuracy dan Evasion

Resolver `combat-mechanics.ts:35-66` tepat mengikuti Model B DOCX:

`pressure=(accuracy-90)*.1; effectiveEvasion=clamp(targetEvasion-pressure,0,50); hitChance=1-effectiveEvasion/100; result=roll<hitChance`.

Satu avoidance roll per gameplay hit dilakukan sebelum crit, termasuk Basic Attack dan tiap target AoE/hit sequence. Monster tanpa `evasion` memakai 0 (`world.ts:2311,2636`); ini tidak menjamin 100% hit bila attacker Accuracy jauh di bawah 90 karena tekanan negatif dapat menghasilkan effectiveEvasion positif — klaim “monster Evasion 0 → selalu 100%” hanya benar untuk Accuracy baseline ≥90 (`INCOMPLETE`). Bonus Battle Focus, Blade Focus, mastery, dan Piercing own Armor Break masuk input hit; Piercing ditambah sebelum roll via `BladeMasterImpactSession.prepare` (`MATCH`). Evasion baseline monster tetap 0; path monster→player tetap terpisah. Combat Power tidak diberi accuracy factor baru.

## 12. Flow, Tempo, resource, dan save

| Mekanik | Runtime aktual | Status DOCX |
|---|---|---|
| Flow generator | Blade Rush/Counterflow **setelah successful damaging hit**. Base lifetime 3s; `openBladeFlow` dapat refresh expiry. | `MATCH` base. Blade Focus extension pada world tidak aktif karena `activeBuffs` duration 0 (`INCORRECT`). |
| Flow bonus/consume | +5 crit pp untuk Twin Assault, Cross Sever, Piercing, Tempest; first successful damaging impact mengonsumsi. Evaded first hit tidak mengonsumsi. | `MATCH`. `blade-master-impact.ts:19-43`. |
| Tempo generator | Twin Assault/Cross Sever setelah ≥1 successful damaging impact, 1 stack per execution; dual valid + Mastery R1+. **Tidak perlu Tempo Drive/Tempest dipelajari.** | DOCX §8.4 “active hanya ... + consumer dipelajari” `STALE`. `blade-master-impact.ts:36-43`; `world.ts:2361-2364`. |
| Tempo lifetime/cap | Maks3; Mastery R1–R5 `[5,5.5,6,6.5,7]`s; generation refresh semua; hilang saat dual/capability/mastery/specialization tak valid, expiry, reset/reload. | `MATCH` kecuali consumer gate. `combat-transient.ts:94-108`, `world.ts:495-501`. |
| Tempo Drive | Consume seluruh 1–3 stacks saat successful cast, M `[14,15,16,17,18]`, C `[24,23,22,21,20]`. Efficiency hanya tiga dual skills; strongest of global/Mastery/Drive. | `STALE` untuk M/C 0/NOT_DEFINED; buff/cost precedence `MATCH`. |
| Tempest 3 Tempo | Snapshot saat cast, consume ketiganya first damaging hit; hanya final hit +25 crit pp/+10% final-hit damage. Bila 0–2 stack, tidak dikonsumsi. | `MATCH`. |
| SP earned | **Live `gainXP` menambah totalEarnedSP +1 per level**, dimulai 0 pada Lv1; bila naik normal ke Lv80 = 79 SP. Development helper menyuntik **500 SP**. | DOCX curve +1/+2/+3 dan total 150 pada Lv80 `INCORRECT/FIXTURE_ONLY`. Belum ada curve live 150. `rules.ts:1193-1201,608-613`; `adventurer-v3.ts:96-104`. |
| Refund/access | Job change mengembalikan semua paid ranks, mempertahankan granted rank, earned SP dan lineage; sibling branch terkunci. | `MATCH`. `skill-progression-v3.ts:245-265,315-360`. |
| Save | Rank/earned SP/lineage persisted; Stun, Armor Break enemy, Flow, Tempo, Drive, Frenzy Guard runtime-only. Trance timer secara khusus dibuang; temporary modifiers tidak disimpan. | `MATCH` untuk transient utama. `rules.ts:2385-2398`; `combat-transient.ts:72-78`. |

Catatan UI: indikator Tempo di `world.ts:529-532` **baru tampil bila Tempo Drive atau Blade Tempest dipelajari**, walau stack gameplay sudah bisa terbentuk sebelum itu. Ini `PRESENTATION_ONLY` gate, bukan syarat generator.

## 13. Controlled formula fixture vs DOCX

Fixture baca-saja memakai hero V3 Lv80, effective STR 28/DEX 25, main sword ATK 100, off sword ATK 70 untuk Blade Master, 2H ATK 150 untuk Berserker, tanpa crit/target defense/status. Semua angka berikut **raw pre-mitigation** dari `resolveHeroSkill` + `skillHitDamage`; bukan damage universal atau tooltip final. `doc simple` mencoba formula DOCX yang memakai `max(0,STR-15)` dan `max(0,DEX-15)` untuk explicit stat scaling, sebelum hand composition.

| Skill R1 | PATK | Raw runtime (hit sequence) | `doc simple` | Interpretasi |
|---|---:|---:|---:|---|
| Warrior Strike | 208 | 210.24 | 209.04 | Selisih 1.20: runtime S×28, doc simple S×13. |
| Iron Charge | 208 | 157.40 | 156.65 | Selisih .75: full STR. |
| Earth Splitter | 258 | 316.60 | 312.85 | Selisih 3.75: full STR. |
| Twin Assault | 278 | 85.57 + 73.57 = 159.14 | 224.44 | Hit MAIN/OFF masing-masing memakai P/2 untuk weapon; explicit S/D memakai full stats lalu dibagi .5/.5. Formula singkat PATK×P tidak memodelkan hand sequence. |
| Cross Sever | 278 | 336.96 | 336.96 | Cocok karena BOTH memakai kedua weapon layer dan Blade Master ini memakai above-15 STR/DEX. |
| Piercing Sequence | 278 | 72.672 + 72.672 + 96.896 = 242.24 | 322.74 | `SINGLE_MAIN` raw weapon: offhand tidak masuk tiap hit; shared core tetap sekali. |
| Blade Tempest | 278 | 54.121 + 46.621 + 54.121 + 46.621 + 205.156 = 406.64 | 491.64 | Lima weapon-hand contributions, shared total 1×; rumus PATK×total P terlalu sederhana. |

Dengan demikian, DOCX §9 belum bisa menjelaskan semua Current Effect Preview dari satu rumus universal. Preview UI sendiri menjumlah `skillHitDamage` tanpa target mitigation/status/crit (`rules.ts:1048-1051`, `components/game/job-skill.tsx:489-510`). Semestinya dokumen memakai formula resolver per mode dan menjelaskan input hero/equipment. Data sanity di laporan terdahulu tidak boleh diperlakukan sebagai nilai umum.

## 14. Mismatch yang harus dicatat eksplisit dalam revisi DOCX

| No. | Nilai/klaim DOCX | Runtime sekarang dan sumber | Koreksi dokumen yang disarankan |
|---:|---|---|---|
| 1 | SP 150 pada Lv80 dari curve +1/+2/+3 | 79 dari +1/level normal; 500 hanya helper development (`rules.ts:1193-1201,608-613`) | Tulis curve live yang aktual; label curve 150 sebagai target desain belum live. |
| 2 | Quick Slash/Power Strike S meningkat tiap rank; Mana 3–5/5–7 | S konstan .02/.04; Mana `[12,12,14,14,16]`/`[18,18,20,20,22]` (`adventurer-v3.ts:43-46`) | Ganti array tabel Adventurer. |
| 3 | Minor Heal Mana `[8,10,12]` | `[26,28,30]` (`adventurer-v3.ts:46`) | Ganti array. |
| 4 | Bonus STR selalu above 15; contoh Lv15 PATK59/raw60.04 | PATK memakai above15, tetapi explicit skill scaling memakai effective STR penuh kecuali sebagian Blade Master; contoh aktual PATK44/raw46.24 (`rules.ts:850-854,1024-1028`) | Pisahkan kontribusi STR PATK dari input explicit skill; revisi contoh. |
| 5 | Guard Stance/Battle Cry/Battle Focus/Unbroken Mana/CD naik/turun per rank | Runtime masing-masing 10/18, 14/35, 14/35, 16/28 konstan (`warrior-v3.ts:22-34,55-82`) | Ganti array DOCX dengan nilai konstan, jelaskan rank buff tetap meningkat. |
| 6 | Guard Stance buff tidak butuh sword | Requirement 1H/2H diperiksa saat cast (`warrior-v3.ts:22`, `rules.ts:999-1000`) | Tulis persyaratan weapon aktual. |
| 7 | Battle Cry Physical Damage % | Runtime `percent.physicalAttack` (`warrior-v3.ts:62-64`) | Gunakan istilah Physical Attack %, jelaskan explicit flat scaling tak naik. |
| 8 | Frontal arc memakai radius rank; Sweeping 120° | World memilih dengan `skill.range` tetap dan default 90°, tag `arc:120` tak dibaca (`world.ts:2190-2194`, `skill-action.ts:222-246`) | Pisahkan registry radius dari actual live range/angle; tandai ketidaksesuaian gameplay yang perlu owner review. |
| 9 | Radial K cap membatasi target | World area filter tidak `.slice(maxTargets)` (`world.ts:2195-2208`); fixture Berserker menylice sendiri | Tandai K sebagai data konfigurasi yang belum enforced pada world, jangan klaim cap live. |
| 10 | Tempo Drive M/CD NOT_DEFINED/fallback 0 | `[14,15,16,17,18]` / `[24,23,22,21,20]` (`blade-master-v3.ts:97`) | Ganti semua penyebutan fallback 0 di §3, §7, §10. |
| 11 | Tempo perlu consumer terpelajari | Generator cuma mensyaratkan impact, dual, Mastery (`blade-master-impact.ts:36-43`); consumer hanya gate indikator UI (`world.ts:529-532`) | Hapus consumer gate dari gameplay; sebut gate indikator sebagai UI sementara. |
| 12 | Twin Blade Mastery hanya “Twin Assault Mana reduction” | Twin Assault, Cross Sever, Blade Tempest, Tempo Drive cast (`blade-master-v3.ts:141-145`, `rules.ts:1013-1018`) | Perluas scope, bedakan active Drive efficiency. |
| 13 | Blade Focus memperpanjang Flow | World check bergantung timer `activeBuffs` yang diisi `duration=0` (`world.ts:2215-2216,2360`) | Jangan klaim extension live sampai ada proof/fix; efek stat lain tetap ada. |
| 14 | Counterflow butuh valid CounterContext untuk Stun | Cast path tidak menolak `counter.result='none'`; Stun condition tidak memeriksanya (`world.ts:2119-2123,2402-2422`) | Tulis implementasi aktual dan tandai mismatch gameplay; jangan mengubah kode dalam audit. |
| 15 | Inherited Warrior attack memakai SINGLE_MAIN saat dual | `composeBladeWeaponHits` hanya Blade Master skills; Warrior Strike raw berubah 100 saat offhand ATK +100 (`rules.ts:1029-1032`, fixture §8) | Tandai exception/bug, jangan nyatakan SINGLE_MAIN berlaku universal. |
| 16 | Blade Rush pass-through 1.5m di belakang target | Motion metadata menyebutnya, world dash berhenti pada stopDistance 1.2m (`blade-master-v3.ts:28-33,world.ts:2229-2248`) | Label motion intent terpisah dari live movement. |
| 17 | Monster Evasion0 berarti pasti hit 100% | Hanya bila attacker Accuracy≥90; Accuracy<90 membuat negative pressure (`combat-mechanics.ts:43-64`) | Tambahkan syarat baseline Accuracy. |
| 18 | Warrior Finale payoff sanity matrix adalah bukti test | Test yang mencetak matriks memakai legacy timer tanpa source actor sehingga payoff tercetak = normal (`warrior-v3.test.ts:148-156`) | Label angka payoff DOCX sebagai perhitungan bersyarat/source-owned, bukan keluaran test tersebut. |

## 15. Data yang benar tetapi mudah menyesatkan dan batas validasi

- `M/C` tabel adalah **base rank values**, bukan selalu biaya aktual: derived INT/global reduction, mastery, Tempo Drive, cooldown reduction, dan pembulatan `ceil` dapat mengubah cost/cooldown cast (`skill-action.ts:227-240`, `rules.ts:1013-1019`). DEX tidak menjadi global physical damage multiplier.
- `Two-Hand Sword Mastery` dan `Twin Blade Mastery` pasif; placeholder adapter M/C tidak boleh masuk tabel biaya cast. `Berserker Trance` M30/C90 adalah konstan semua rank, bukan “hanya R1”.
- `R` dan `K` adalah angka data registry, **tidak selalu diterapkan oleh pemilihan target live**; frontal memakai fixed `range`, radial mengabaikan `maxTargets`.
- `Stun pvpDuration` adalah metadata untuk masa depan; PvP runtime tidak diaudit/dijalankan. `REDUCED` policy masih hook tanpa angka reduction.
- Earth Splitter 369, Fury Harvest 287, Raging Cleave 332, Breaker Entry 163 berasal dari `berserker-v3-fixture.ts` dengan PATK 199, STR 135, defense 0 dan target yang diatur fixture. Itu `FIXTURE_ONLY`, bukan tooltip universal; fixture menylice cap yang world belum lakukan.
- Nilai Warrior sanity pada Lv15/30/45/59 bergantung gear dan stat fixture. `Crushing Finale` payoffs pada DOCX tidak cocok dengan *printed test matrix* saat ini karena test tidak membuat source-owned status; jangan menyajikannya sebagai hasil test yang telah terbukti.
- Tidak ada browser/headed validation baru dalam fase ini. Pembacaan world path cukup untuk menemukan ketidaksesuaian kode, tetapi frekuensi kejadian, UI saat bergerak, dan hasil di deployment publik `NOT_VERIFIABLE` dari audit ini.

## 16. Verifikasi dan daftar perubahan DOCX untuk menjadi source-of-truth

Tes fokus read-only yang dijalankan: `node --experimental-strip-types --test` pada delapan berkas Adventurer, Warrior, Berserker, Blade Master, Accuracy/Evasion, Armor Break, dan Dual Wield: **53 passed / 0 failed**. Ini bukan full `lib/game` regression atau production build; keduanya tidak diperlukan untuk audit tanpa perubahan game. Tes hijau tidak membatalkan temuan world path karena beberapa fixture memakai logika seleksi target yang berbeda.

Revisi DOCX yang dibutuhkan, **belum dilakukan**:

1. Perbaiki formula eksplisit STR/DEX beserta contoh Lv15, dan tambahkan formula per-hand untuk Twin Assault/Piercing/Tempest.
2. Perbaiki tabel Adventurer, empat Warrior buff/stace M/C, Tempo Drive M/C, serta scope Mastery Mana reduction.
3. Koreksi SP income live versus target desain/fixture, dan label `500 SP` development-only.
4. Tambahkan kolom “defined” vs “enforced live” untuk frontal radius/sudut dan radial target cap; jangan mengubah kontrak desain diam-diam.
5. Tandai ketidaksesuaian runtime yang menunggu owner decision/fix: inherited Warrior dual weapon layer, Counterflow context gate, Blade Focus Flow extension, Blade Rush pass-through, dan radial caps. Dokumen boleh menyatakan *intended design*, tetapi harus menandai bahwa runtime belum mengikuti.
6. Label sanity numbers sebagai fixture diagnostic dengan semua input; ganti klaim Finale payoff matrix yang tidak didukung keluaran test terkini.
7. Pertahankan bagian yang cocok: roster 32 skill, sebagian besar gate/coefficient/weapon, stun data, source-owned Armor Break, Accuracy Model B, Flow/Tempo hit semantics, dan transient save policy.

**STOP:** hasil rekonsiliasi siap untuk owner review. Tidak ada perubahan runtime atau DOCX yang disarankan untuk dieksekusi otomatis dari audit ini.
