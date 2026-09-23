# LUMENFALL SPV3-8 — Warrior Lineage V3 Final Baseline Report

Status validasi: **SELESAI — DIAGNOSTIC ONLY**

Klasifikasi akhir:

> **B. REFERENCE READY WITH BALANCE TUNING REQUIRED**

Alasannya: seluruh regression dan build lulus tanpa correctness bug yang ditemukan, tetapi beberapa baseline rotasi/resource/survivability masih merupakan area balance yang harus diputuskan owner. Tidak ada rebalance otomatis pada fase ini.

## 1. Final canonical lineage

Lineage V3 yang tervalidasi:

- Adventurer — 3 skill;
- Warrior — 11 skill;
- Berserker — 9 skill;
- Blade Master — 9 skill.

Jalur yang aktif:

- Adventurer → Warrior → Berserker;
- Adventurer → Warrior → Blade Master.

Sibling specialization tetap terkunci setelah pilihan dibuat. Tidak ada Thief V3, Advanced Job, PvP, monster Accuracy/Evasion, atau class baru yang ditambahkan.

## 2. Level progression dan milestone

| Level | Total SP fixture | Identitas / akses utama | Catatan |
|---:|---:|---|---|
| 1 | 0 | Adventurer | Quick Slash R1 granted |
| 14 | 13 | Adventurer | Rank maksimum Adventurer dapat dicapai sesuai gate |
| 15 | 14 | Warrior tersedia | Warrior Strike R1 tersedia; transisi tidak auto-purchase |
| 30 | 30 | Warrior | Rank dan prerequisite bertahap tetap berlaku |
| 40 | 50 | Warrior | Investasi menengah dan rank gate berjalan |
| 50 | 70 | Warrior | Seluruh skill tetap dibatasi prerequisite/rank |
| 59 | 88 | Warrior | Specialization masih terkunci |
| 60 | 90 | Berserker atau Blade Master | Job change mengembalikan SP skill, total SP tetap |
| 70 | 120 | Specialization | Skill specialization tingkat menengah terbuka sesuai gate |
| 75 | 135 | Specialization | Ultimate R1 dapat memenuhi level bila syarat lain terpenuhi |
| 80 | 150 | Specialization penuh | Rank maksimum dan ultimate final dapat diuji |

SP table di atas adalah simulasi kontrak owner:

- Lv2–29: +1 SP per level;
- Lv30–60: +2 SP per level;
- Lv61–80: +3 SP per level.

SP curve tidak diubah dalam fase ini.

## 3. SP economy simulation

Biaya registry aktual:

| Lineage | Biaya maksimum |
|---|---:|
| Adventurer seluruh rank registry | 13 SP |
| Adventurer paid maximum setelah Quick Slash R1 granted | 12 SP |
| Warrior | 122 SP |
| Berserker | 149 SP |
| Blade Master | 149 SP |

Pada Lv80 tersedia 150 SP. Full ancestry theoretical cost:

- Adventurer paid: 12;
- Warrior: 122;
- satu specialization: 149;
- total: 283 SP;
- coverage pada Lv80: 150 / 283 ≈ 53%.

Implikasi:

- pemain tidak dapat memaksimalkan seluruh ancestry;
- pilihan build nyata tetap ada;
- transisi job me-refund skill SP tanpa mereset identitas job;
- tidak ada global SP curve baru yang di-hardcode.

## 4. Warrior build examples

Semua contoh berikut menggunakan budget Lv59 yang sama, 88 SP. Angka di bawah adalah snapshot build diagnostik, bukan rekomendasi balance final.

### A. Balanced 1H

- Warrior Strike R5;
- Iron Charge R5;
- Sweeping Slash R4;
- Guard Stance R3;
- Armor Breaker R3;
- Battle Cry R3;
- Counter Slash R3;
- Battle Focus R3;
- Ground Breaker R3;
- Unbroken Stance R2;
- Crushing Finale R2.

Build ini memakai sekitar 72 SP paid dan menyisakan ruang untuk prioritas rank lain. Identitasnya adalah frontline umum dengan single target, cleave, guard, dan Armor Break.

### B. Heavy 2H

- Warrior Strike R5;
- Iron Charge R5;
- Sweeping Slash R4;
- Armor Breaker R5;
- Battle Cry R5;
- Ground Breaker R5;
- Crushing Finale R3;
- Battle Focus R2;
- Guard Stance R1.

Build menekankan pressure dan heavy finisher, tetapi tidak otomatis memperoleh Berserker Trance atau skill specialization.

### C. Defensive / counter

- Guard Stance R5;
- Unbroken Stance R5;
- Counter Slash R5;
- Warrior Strike R4;
- Iron Charge R3;
- Battle Focus R3;
- Armor Breaker R3;
- Sweeping Slash R2.

Build menukar sebagian output dengan uptime guard, anchoring, dan CounterContext.

### D. AoE / mobbing

- Sweeping Slash R8;
- Ground Breaker R5;
- Iron Charge R5;
- Warrior Strike R5;
- Guard Stance R3;
- Battle Cry R3;
- Armor Breaker R3;
- Counter Slash R3.

Build memberi alat menghadapi pack, tetapi tetap dibatasi target cap, cooldown, dan Mana.

Hasil audit: tidak ada bukti bahwa Warrior dapat memaksimalkan semua 11 skill dengan budget Lv59.

## 5. Berserker build examples

Berserker dapat mempertahankan investasi ancestry Adventurer/Warrior dan memilih fokus specialization.

### A. AoE farming

Fokus:

- Two-Hand Sword Mastery R5;
- Raging Cleave tinggi;
- Earth Splitter tinggi;
- Fury Harvest tinggi;
- Trance sesuai gate;
- Warrior Sweeping Slash/Ground Breaker sebagai fallback.

Kekuatan: target cap, radial damage, Fury Harvest, dan Frenzy Guard saat tiga target atau lebih berhasil terkena.

### B. Mixed AoE + boss

Fokus:

- Crushing Blow;
- Ruinous Arc;
- Armor Breaker ancestry;
- Raging Cleave;
- Earth Splitter;
- Trance.

Build tetap bergantung pada Two-Hand Sword untuk sebagian besar skill specialization. Ruinous Arc payoff hanya aktif dari Armor Break milik caster.

### C. Survival-heavy

Fokus:

- Iron Blood;
- Two-Hand Sword Mastery;
- Guard/Unbroken ancestry;
- Fury Harvest;
- Trance/Frenzy Guard.

Iron Blood bersifat sementara, bukan tank permanen. Tidak ada hidden VIT scaling atau Max HP permanen.

Audit identitas: Berserker terasa berbeda dari Warrior Core melalui Two-Hand Sword, heavy AoE, dan active survivability. Tidak ada Stagger.

## 6. Blade Master build examples

### A. Dual-Wield boss DPS

Fokus:

- Twin Blade Mastery;
- Twin Assault;
- Cross Sever;
- Piercing Sequence;
- Blade Tempest;
- Flow.

Dual skill menggunakan dua item senjata nyata. Sibling Berserker tetap tidak dapat diakses.

### B. Flow / Tempo technical

Fokus:

- Twin Assault;
- Cross Sever;
- Flow;
- Tempo;
- Tempo Drive;
- Blade Tempest.

Tempo hanya berasal dari Twin Assault dan Cross Sever, satu stack per execution, maksimum tiga, dan tidak disimpan.

### C. Hybrid ancestry

Fokus:

- Warrior AoE sebagai opportunity cost;
- Blade Master single-target sequence;
- Dual-Wield skill hanya ketika konfigurasi dual valid.

Tidak ditemukan kebocoran AoE specialization Blade Master. AoE yang tersedia berasal dari Warrior ancestry.

## 7. Weapon scaling

Hasil audit architecture:

- Warrior 1H dan 2H legal untuk seluruh offensive Warrior V3;
- Berserker menerima 1H/2H secara ancestry, tetapi sebagian besar skill specialization memerlukan 2H;
- Blade Master inherited Warrior skill memakai SINGLE_MAIN saat Dual Wield;
- Cross Sever memakai DUAL_COMBINED;
- Piercing Sequence memakai SINGLE_MAIN raw weapon contribution;
- Blade Tempest memakai sequence hand MAIN/OFF/BOTH dengan shared weights;
- stat character-wide hanya dikonversi satu kali;
- tidak ada offhand 50% penalty;
- Rune dan enhancement setiap item tetap item-local lalu agregasi karakter berjalan satu kali;
- duplicate Unique Effect memakai stable identity dan non-stacking policy;
- Two-Hand Sword dan offhand sword tetap mutually exclusive.

Clean Dual-Wield tests lulus dan tidak menemukan double STR conversion atau phantom offhand layer.

## 8. Basic Attack baseline

Controlled Blade Master diagnostic matrix:

| Level | Dual Main | Dual Off |
|---:|---:|---:|
| 75 | 189 | 159 |
| 80 | 195 | 165 |

Nilai tersebut berasal dari controlled fixture, bukan benchmark monster final.

Perilaku yang tervalidasi:

- Main dan Off hand tetap dapat dibedakan;
- dual basic tidak menggandakan shared character core;
- Accuracy/Evasion memakai satu resolver;
- Critical baru dievaluasi setelah hit berhasil;
- tidak ada Stun;
- tidak ada knockback gameplay baru.

Warrior sanity matrix juga menunjukkan basic attack tetap memakai CFV3 physical foundation. Perbedaan 1H/2H harus dibaca bersama item attack fixture; test weapon-gate memvalidasi legalitas, bukan balance tier final.

## 9. Single-target rotation baseline

Per-skill damage sanity yang tersedia dari controlled fixtures:

| Level | Twin Assault | Cross Sever | Piercing | Counterflow | Tempest normal | Tempest + Flow + 3 Tempo |
|---:|---:|---:|---:|---:|---:|---:|
| 75 | 173.35 | 329.75 | 241.19 | 288.29 | 346.70 | 397.75 |
| 80 | 195.58 | 376.04 | 286.28 | 312.74 | 466.74 | 537.04 |

Perbandingan diagnostic Berserker:

| Level | Crushing Blow | Earth Splitter |
|---:|---:|---:|
| 75 | 354.63 | 333.33 |
| 80 | 386.29 | 388.14 |

Ini adalah snapshot per skill dengan equipment/level fixture, bukan klaim pemenang DPS.

Continuous 20/60-second rotation lengkap belum memiliki fixture timeline terpisah yang mencatat seluruh cooldown, Mana regeneration, Basic Attack insertion, dan idle period. Karena itu tidak ada klaim final DPS antar job. Ini adalah balance follow-up, bukan correctness failure.

## 10. AoE / farming baseline

Coverage yang tervalidasi:

- target cap Raging Cleave, Earth Splitter, Fury Harvest, dan Breaker Entry;
- target individual dapat hit/evade secara independen;
- Earth Splitter Stun hanya diproses untuk target yang berhasil hit;
- Fury Harvest hanya menghitung actual successful targets;
- Frenzy Guard membutuhkan minimal tiga target berhasil;
- Blade Master tidak memiliki specialization AoE baru.

Berserker fixture membuktikan:

- Earth Splitter memilih sesuai cap;
- Fury Harvest tidak menghitung target yang evaded;
- Trance menambah target cap secara sementara;
- Frenzy Guard aktif pada pack yang memenuhi syarat.

Belum ada tuning monster HP/DEF.

## 11. Survivability baseline

Sistem yang tervalidasi:

Warrior:

- Guard Stance;
- CounterContext;
- Unbroken Stance;
- displacement resistance tanpa Stun immunity.

Berserker:

- Iron Blood temporary Max HP/damage reduction;
- Fury Harvest recovery;
- Trance/Frenzy Guard.

Blade Master:

- mobility/counter/Flow tools;
- tidak mendapat artificial tank buff.

Full incoming-damage timeline untuk membandingkan uptime tiga build belum dibuat sebagai fixture terpisah. Tidak ditemukan implementasi yang membuat Berserker permanent tank.

## 12. Stun / CC regression

Approved live Stun sources:

1. Warrior Iron Charge;
2. Berserker Earth Splitter;
3. Blade Master Counterflow.

Validasi mencakup:

- duration;
- chance;
- immunity;
- per-target roll;
- non-additive refresh;
- action lock;
- recovery.

Stagger, Stagger Resistance, dan poise gauge tetap tidak ada.

Tidak ada skill lain pada Warrior lineage yang menerima Stun pada registry V3 ini.

## 13. Armor Break regression

Canonical runtime values tervalidasi:

- R1: 6%;
- R2: 7.5%;
- R3: 9%;
- R4: 10.5%;
- R5: 12%.

Source ownership tetap berlaku:

- strongest-only untuk effective Defense reduction;
- source records tetap independen;
- same-source refresh tidak membuat duplicate additive entries;
- Crushing Finale: +10% hanya dari Armor Break caster;
- Ruinous Arc: +8% hanya dari Armor Break caster;
- Piercing Sequence: +10 Accuracy hanya dari Armor Break caster;
- legacy 20% tidak bocor ke V3 mitigation path.

## 14. Accuracy / Evasion regression

Model B tervalidasi:

- Accuracy 105 / Evasion 1.5 → effective 0%, hit 100%;
- Accuracy 105 / Evasion 5.5 → effective 4%, hit 96%;
- Accuracy 145 / Evasion 5.5 → effective 0%, hit 100%;
- Accuracy 90 / Evasion 50 → effective 50%, hit 50%;
- Accuracy 80 / Evasion 10 → effective 11%, hit 89%.

Current monster adapter tetap Evasion 0.

Fixture membuktikan:

- Basic Attack hit/evade;
- Twin Assault hit per hit;
- Piercing source-owned +10 Accuracy;
- Blade Tempest mixed HIT/EVADE/HIT/EVADE/HIT;
- Earth Splitter per-target;
- Fury Harvest successful-target count.

Critical selalu setelah HIT, bukan sebelum.

## 15. Flow / Tempo regression

Flow:

- dibuka Blade Rush/Counterflow;
- +5 percentage points Critical Rate;
- dikonsumsi pada successful damaging impact pertama;
- hit evaded tidak mengonsumsi Flow.

Tempo:

- generator hanya Twin Assault dan Cross Sever;
- maksimum tiga;
- satu stack per execution;
- expiry aktif;
- Tempo Drive mengonsumsi stack;
- tiga Tempo dapat mengaktifkan finisher Blade Tempest;
- state tidak disimpan.

Mastery loss dan invalid Dual-Wield state membersihkan transient state yang relevan.

## 16. Mana sustainability

Mana values dan strongest-reduction policy yang tervalidasi:

- Warrior skill costs memakai canonical per-rank data;
- Berserker Two-Hand Mastery mengurangi Mana skill Berserker 2H, bukan Warrior ancestry;
- Blade Master Twin Blade Mastery dan Tempo Drive mengikuti scope skill yang ditentukan;
- tidak ada FP;
- tidak ada resourceEfficiency yang menambah Max Mana secara salah;
- Tempo Drive tidak mengurangi Mana cast dirinya sendiri secara retroaktif.

Continuous 60-second Mana rotation untuk low/mid/high build belum dipisahkan menjadi fixture timeline. Karena itu pertanyaan spam tanpa tekanan atau kebutuhan INT belum diklasifikasikan final. Ini menjadi balance measurement berikutnya.

## 17. Cooldown / CDR sanity

Registry dan test memastikan:

- cooldown rank bersifat finite;
- cooldown tidak menjadi nol karena resolver;
- Blade Tempest mempertahankan fixed internal hit timing;
- ASPD Tempo Drive tidak mengompres ultimate sequence;
- Flow/Tempo window memakai transient timer;
- cooldown reduction tidak mengubah skill definition secara permanen.

Tidak ada zero-cooldown correctness bug yang ditemukan.

## 18. Rune / equipment sanity

Regression Rune/equipment lulus untuk:

- stat aggregation satu kali;
- Dual-Wield dua item;
- primary-stat conversion satu kali;
- enhancement item-local;
- Unique Effect dedupe;
- Magic Attack Rune flat;
- resourceEfficiency sebagai persentase, bukan Max Mana flat;
- skillDamage tidak dipakai untuk healing;
- tidak ada Magic Attack leak dari sword.

Rune rarity, roll values, socket rate, dan drop rate tidak diubah.

## 19. Combat Power observations

Combat Power tidak diubah pada fase ini.

Observation:

- CP memakai calculator existing;
- equipment upgrade yang benar memengaruhi CP;
- dua item Dual Wield tetap dapat menyumbang stat/equipment value sesuai pipeline;
- Accuracy belum diskor sebagai offensive CP terhadap benchmark Evasion 0;
- accuracyFactor tetap 1.

Tidak ditemukan kebutuhan correctness untuk mengubah formula CP.

## 20. Live UI / job flow

Automated live integration tests lulus:

- Lv15 membuka Warrior;
- Lv59 mengunci Berserker dan Blade Master;
- Lv60 membuka kedua specialization;
- setelah memilih satu sibling terkunci;
- K panel menampilkan 9 skill specialization yang sesuai;
- Character Overview menampilkan Core/Specialization;
- save/reload mempertahankan job identity dan rank;
- hotbar menerima active skill yang learned dan menolak mastery/unlearned skill.

Validasi browser manual terbaru tidak dapat diselesaikan karena server dev lokal berhenti setelah startup dan tidak mempertahankan listener pada port 3001. Startup memperlihatkan warning optional import Vite/Nitro dan error environment Request.cf/EACCES pada Sites runtime. Ini dicatat sebagai staging/environment limitation, bukan sebagai gameplay correctness bug.

Public Vercel route yang tersedia masih dapat membuka main menu, tetapi tidak dipakai sebagai bukti SPV3-8 terbaru karena deployment public belum dipromosikan ke commit fase ini.

## 21. Save dan transient cleanup

Save/reload tests lulus untuk:

- chosen Core Job;
- chosen Specialization;
- total SP;
- skill ranks;
- granted Adventurer rank;
- hotbar-safe references;
- Berserker/Blade Master identity.

Transient tidak dipulihkan stale dari save:

- Stun;
- Flow;
- Tempo;
- Tempo Drive;
- Breaker Entry Window;
- Berserker Trance;
- Frenzy Guard;
- CounterContext;
- next Basic Attack hand;
- Armor Break runtime status.

Full death/map-transition/character-change browser timeline belum dijadikan satu fixture terpisah. Existing transient and save tests cover the relevant parser/reset contracts.

## 22. Focused regression

Focused lineage/system coverage lulus melalui test suites:

- Adventurer V3;
- Warrior V3;
- Berserker V3;
- Blade Master 7A/7B;
- Dual Wield;
- Stun;
- Armor Break;
- Accuracy/Evasion;
- SPV3;
- equipment/Rune;
- save/hotbar/live job integration.

## 23. Full regression

Perintah:

node --test lib/game/*.test.ts

Hasil:

- **444 passed**
- **0 failed**
- **0 skipped**
- **0 cancelled**

Tidak ada test lama yang dihapus atau dilewati untuk mencapai hasil ini.

## 24. Production build

Perintah build production berhasil dengan exit code 0.

Warning non-fatal yang tetap muncul:

- optional @tailwindcss/vite dan nitro/vite tidak ter-resolve pada konfigurasi saat ini dan diperlakukan sebagai external;
- client chunk melebihi 500 kB;
- sebagian route tidak dapat diklasifikasikan otomatis oleh static analysis vinext.

Tidak ada build error yang berasal dari SPV3-8 karena fase ini tidak mengubah gameplay code.

## 25. Correctness bugs found

Tidak ditemukan correctness bug baru pada:

- lineage access;
- sibling lock;
- prerequisite/rank gate;
- SP refund;
- weapon gate;
- Dual-Wield shared stat calculation;
- Stun;
- Armor Break source ownership/numeric values;
- Accuracy/Evasion order;
- Flow/Tempo;
- Rune aggregation;
- save/reload;
- V3 live job integration.

Tidak ada perubahan kode gameplay dibuat pada fase ini.

## 26. Balance concerns found

Hal-hal berikut perlu owner review, tetapi tidak disentuh:

1. Full 20/60-second rotation DPS belum memiliki timeline fixture final.
2. Mana sustainability low/mid/high build belum memiliki measurement kontinu final.
3. Survivability uptime antar build belum memiliki incoming-damage timeline final.
4. Pada controlled snapshots, Blade Tempest + Flow + 3 Tempo meningkat sesuai kontrak; angka final tetap perlu diuji terhadap target/monster benchmark owner.
5. Berserker dan Blade Master memiliki trade-off berbeda, tetapi final comparative balance belum boleh disimpulkan dari snapshot per skill.
6. SP Lv80 hanya sekitar 53% dari full ancestry theoretical cost, sehingga build choice cukup berarti; apakah budget ini terlalu ketat adalah keputusan balance owner.

## 27. Recommended changes

Tidak ada perubahan wajib sebelum review.

Rekomendasi fase berikutnya:

- owner review klasifikasi balance concern;
- bila diperlukan, buat satu deterministic rotation benchmark world-free;
- buat satu Mana/survivability timeline fixture;
- jangan mengubah skill values sebelum hasil benchmark disetujui;
- perbaiki staging/server harness secara terpisah dari combat architecture bila live browser proof masih diperlukan.

Tidak direkomendasikan menambah class atau skill baru sebelum baseline ini disetujui.

## 28. Readiness sebagai V3 reference implementation

Warrior Lineage V3 layak menjadi reference implementation untuk fondasi berikutnya karena:

- ancestry dan sibling access konsisten;
- Warrior, Berserker, dan Blade Master registry lengkap;
- combat foundation terintegrasi;
- status ownership dan transient policy tervalidasi;
- Accuracy/Evasion Model B sudah tersentralisasi;
- Dual Wield tidak menggandakan stat/weapon layer;
- save, hotbar, K panel, dan Character Overview mempertahankan lineage;
- full regression dan production build hijau.

Klasifikasi akhir tetap:

> **REFERENCE READY WITH BALANCE TUNING REQUIRED**

Fase berikutnya harus menunggu OWNER REVIEW. Tidak ada Thief V3, Advanced Job, PvP, monster rebalance, atau final animation yang dimulai.

