# LUMENFALL — Job Class & Skill Catalog

Status dokumen: referensi proyek, bukan instruksi untuk mengaktifkan job baru.

## 1. Aturan progresi canonical

| Tier | Isi |
|---|---|
| Lv1–14 | Adventurer |
| Lv15–59 | Core Job |
| Lv60+ | Specialization |
| Masa depan | Advanced Job |

Semua Core Job menggunakan HP, Mana, dan Cooldown. Universal Stamina tidak digunakan. K dan J tetap berarti Job Skill dan Quest Journal.

## 2. Arsitektur job canonical

| Core Job | Specialization A | Specialization B | Advanced A | Advanced B |
|---|---|---|---|---|
| Warrior | Berserker | Blade Master | Executioner | Crimson Blade |
| Thief | Rogue | Assasin | Spectre | Reaper |
| Acolyte | Luminary | Sacred Fist | Stellar | Warmonk |
| Archer | Ranger | Marksman | Astral Ranger | Sniper |
| Knight | Vanguard | Phalanx | Royal Guard | Gladiator |
| Mage | Summoner | Sorcerer | Warlock | Arcanist |
| Smith | Blacksmith | Specialist | Mastersmith | Siege |

Spelling `Assasin` sengaja dipertahankan sesuai keputusan owner.

Registry job V2 adalah metadata arsitektur. Job selain content yang sudah diimplementasikan tetap inactive/future-locked.

## 3. Status implementasi

| Job/content | Status |
|---|---|
| Adventurer | Skill dasar tersedia |
| Warrior V2 | Core Job reference implementation; 16 active + 14 passive |
| Thief V2 | Foundation/content tersedia untuk development; 16 active + 14 passive |
| Acolyte V2 | Belum diimplementasikan sebagai tree V2 |
| Archer V2 | Belum diimplementasikan sebagai tree V2 |
| Knight V2 | Belum diimplementasikan sebagai tree V2 |
| Mage V2 | Belum diimplementasikan sebagai tree V2 |
| Smith V2 | Belum diimplementasikan sebagai tree V2 |
| Semua Specialization | Belum diaktifkan sebagai progression publik |
| Semua Advanced Job | Future-locked |

## 4. Adventurer skills

| ID | Nama | Tipe | Fungsi |
|---|---|---|---|
| `fajar-step` | Langkah Fajar | Active | Dash pendek ke target dan stagger ringan |
| `fajar-strike` | Tebasan Fajar | Active | Serangan pedang; memperkuat basic attack berikutnya |
| `guard-stance` | Sikap Penjaga | Active | Mengurangi damage masuk dan membuka parry dasar |
| `nova-fajar` | Nova Fajar | Active | Ledakan cahaya area |

## 5. Warrior V2 — 30 nodes

Warrior adalah reference implementation untuk Core Job. Identitasnya: physical melee, frontline combat, stagger, guard/counter, Armor Break, dan weapon leaning. Warrior bukan Berserker penuh, Blade Master penuh, healer, atau ranged specialist.

### 5.1 Active skills — 16

| # | ID konseptual | Nama | Unlock | Max rank | Ringkasan |
|---:|---|---|---:|---:|---|
| 1 | `warrior-strike` | Warrior Strike | 15 | 5 | Serangan fisik single-target dengan light stagger |
| 2 | `iron-charge` | Iron Charge | 17 | 5 | Dash ke target, damage fisik, minor stagger/knockback |
| 3 | `sweeping-slash` | Sweeping Slash | 20 | 5 | Frontal arc lebar untuk cleave |
| 4 | `guard-stance` | Guard Stance | 20 | 5 | Defensive stance sementara |
| 5 | `rising-slash` | Rising Slash | 23 | 5 | Single-target, stagger tinggi |
| 6 | `armor-breaker` | Armor Breaker | 26 | 5 | Serangan fisik dengan Armor Break |
| 7 | `battle-cry` | Battle Cry | 29 | 5 | Self-buff pressure/tenacity |
| 8 | `counter-slash` | Counter Slash | 32 | 5 | Serangan counter; payoff setelah block/parry valid |
| 9 | `ground-breaker` | Ground Breaker | 35 | 5 | Circle AoE dengan area stagger tinggi |
| 10 | `battle-focus` | Battle Focus | 38 | 5 | Accuracy, critical rate, resistance terhadap disruption |
| 11 | `severing-arc` | Severing Arc | 41 | 5 | Frontal arc lebih sempit dan damage lebih tinggi |
| 12 | `relentless-assault` | Relentless Assault | 44 | 5 | True three-hit melee sequence |
| 13 | `unbroken-stance` | Unbroken Stance | 47 | 5 | Tenacity, stagger resistance, reduced disruption |
| 14 | `iron-reversal` | Iron Reversal | 50 | 3 | Counter lanjutan; payoff khusus setelah parry |
| 15 | `crushing-finale` | Crushing Finale | 55 | 3 | Heavy finisher; synergy Armor Break/recent stagger break |
| 16 | `warrior-awakening` | Warrior Awakening | 59 | 3 | Temporary empowered Warrior state |

### 5.2 Core passives — 10

| # | ID konseptual | Nama | Unlock | Max rank | Fungsi |
|---:|---|---|---:|---:|---|
| 17 | `warrior-conditioning` | Warrior Conditioning | 15 | 5 | Survivability/durability umum |
| 18 | `weapon-discipline` | Weapon Discipline | 18 | 5 | Efisiensi weapon yang kompatibel |
| 19 | `firm-footing` | Firm Footing | 21 | 5 | Stagger resistance/disruption resistance |
| 20 | `guard-training` | Guard Training | 24 | 5 | Memperkuat defensive gameplay; membutuhkan Guard Stance R1 |
| 21 | `combat-instinct` | Combat Instinct | 27 | 5 | Accuracy dan critical rate ringan |
| 22 | `heavy-impact` | Heavy Impact | 30 | 5 | Meningkatkan stagger skill bertag heavy |
| 23 | `battle-momentum` | Battle Momentum | 34 | 5 | Stack dari successful damaging Warrior cast; maksimum 3 |
| 24 | `counter-training` | Counter Training | 38 | 5 | Memperkuat payoff counter dari CounterContext |
| 25 | `adrenaline` | Adrenaline | 43 | 3 | Incoming damage berkurang saat HP rendah |
| 26 | `indomitable-will` | Indomitable Will | 48 | 3 | Ketahanan terhadap Stagger Break/disruption |

### 5.3 Weapon-path passives — 4

| # | ID konseptual | Nama | Unlock | Max rank | Fungsi |
|---:|---|---|---:|---:|---|
| 27 | `great-weapon-familiarity` | Great Weapon Familiarity | 25 | 5 | Bonus scoped untuk great weapon |
| 28 | `great-weapon-momentum` | Great Weapon Momentum | 40 | 3 | Window payoff untuk heavy skill berikutnya |
| 29 | `twin-blade-familiarity` | Twin Blade Familiarity | 25 | 5 | Bonus scoped untuk dual sword |
| 30 | `twin-blade-rhythm` | Twin Blade Rhythm | 40 | 3 | Stack dari successful Warrior skill cast dengan dual sword |

Counter window Warrior: 2.500 ms untuk Block dan Parry. Iron Reversal hanya menerima special payoff dari Parry. Tidak ada perubahan angka balance dalam katalog ini.

## 6. Thief V2 — 30 nodes

Thief Core mengarah ke stealth, mark, positional attack, short mobility, poison, dan dual-dagger leaning tanpa membuat Rogue atau Assasin aktif sebagai specialization.

### 6.1 Active skills — 16

| # | ID | Nama | Unlock | Max rank | Ringkasan |
|---:|---|---|---:|---:|---|
| 1 | `v2-thief-quick-stab` | Quick Stab | 15 | 5 | Serangan single-target cepat; range 3.5m |
| 2 | `v2-thief-slipstep` | Slipstep | 17 | 5 | Gerak sesuai input/arah hadap |
| 3 | `v2-thief-mark-prey` | Mark Prey | 19 | 5 | Personal Mark; range 8m |
| 4 | `v2-thief-smoke-veil` | Smoke Veil | 21 | 5 | Stealth sementara |
| 5 | `v2-thief-twin-fang` | Twin Fang | 23 | 5 | Dua hit nyata; dual dagger; range 3.5m |
| 6 | `v2-thief-crippling-cut` | Crippling Cut | 25 | 5 | Damage dan Slow; range 3.5m |
| 7 | `v2-thief-venom-edge` | Venom Edge | 28 | 5 | Damage dan Poison; range 3.5m |
| 8 | `v2-thief-evasive-feint` | Evasive Feint | 31 | 5 | Temporary Evasion |
| 9 | `v2-thief-shadow-lunge` | Shadow Lunge | 34 | 5 | Collision-aware dash ke target |
| 10 | `v2-thief-marked-strike` | Marked Strike | 37 | 5 | Payoff terhadap personal Mark; range 3.5m |
| 11 | `v2-thief-blade-flurry` | Blade Flurry | 40 | 5 | Tiga hit nyata; range 3.5m |
| 12 | `v2-thief-silent-opening` | Silent Opening | 43 | 5 | Stealth opener dengan cast snapshot |
| 13 | `v2-thief-rear-rend` | Rear Rend | 46 | 5 | Bonus dari posisi belakang; range 3.5m |
| 14 | `v2-thief-disengage` | Disengage | 49 | 5 | Mundur relatif arah hadap |
| 15 | `v2-thief-weakpoint-assault` | Weakpoint Assault | 54 | 3 | Finisher mark/rear synergy; range 3.5m |
| 16 | `v2-thief-instinct` | Thief Instinct | 59 | 3 | Major temporary Thief state; membutuhkan 25 paid ranks |

Silent Opportunity adalah satu cast-time snapshot untuk satu offensive Thief cast. Jika cast tersebut multi-hit, seluruh hit cast itu memakai snapshot yang sama. Tidak ada trigger atau consume per hit.

### 6.2 Passives — 14

| # | ID | Nama | Unlock | Max rank | Fungsi |
|---:|---|---|---:|---:|---|
| 17 | `v2-thief-agile-conditioning` | Agile Conditioning | 15 | 5 | Max HP dan Evasion |
| 18 | `v2-thief-dagger-discipline` | Dagger Discipline | 18 | 5 | Efisiensi weapon dagger |
| 19 | `v2-thief-keen-instinct` | Keen Instinct | 21 | 5 | Critical Rate |
| 20 | `v2-thief-shadow-discipline` | Shadow Discipline | 24 | 5 | Durasi skill Stealth |
| 21 | `v2-thief-dual-dagger-familiarity` | Dual Dagger Familiarity | 25 | 5 | Damage/Crit Rate dengan dual dagger |
| 22 | `v2-thief-mark-expertise` | Mark Expertise | 27 | 5 | Durasi Mark |
| 23 | `v2-thief-fleet-footing` | Fleet Footing | 30 | 5 | Jarak directional movement |
| 24 | `v2-thief-venomcraft` | Venomcraft | 33 | 5 | Durasi Poison |
| 25 | `v2-thief-rear-awareness` | Rear Awareness | 36 | 5 | Critical Rate pada rear synergy |
| 26 | `v2-thief-opportunist` | Opportunist | 39 | 5 | Critical Rate terhadap personal Mark |
| 27 | `v2-thief-twin-edge-control` | Twin Edge Control | 40 | 3 | Crit Damage multi-hit dual dagger |
| 28 | `v2-thief-rapid-technique` | Rapid Technique | 42 | 5 | Damage multi-hit |
| 29 | `v2-thief-evasive-instinct` | Evasive Instinct | 45 | 3 | Evasion saat HP rendah |
| 30 | `v2-thief-silent-opportunity` | Silent Opportunity | 48 | 3 | Crit Damage satu cast offensive dari Stealth |

## 7. Legacy compatibility skill families

Registry lama masih memuat beberapa nama internal yang belum sama dengan canonical V2. Ini adalah compatibility content, bukan keputusan untuk mengubah nama job.

| Runtime legacy ID | Nama runtime | Hubungan canonical |
|---|---|---|
| `warrior` | Warrior | Warrior Core Job |
| `rogue` | Rogue | Legacy identifier; canonical Core Job baru adalah Thief |
| `hunter` | Hunter | Legacy identifier; canonical Core Job baru adalah Archer |
| `wizard` | Wizard | Legacy identifier; canonical Core Job baru adalah Mage |
| `acolyte` | Acolyte | Canonical Core Job |

Legacy registry juga memiliki skill compatibility untuk specialization lama seperti Gatotkaca, Garda, Caroq, Anom, Srikandi, Jagawana, Resi, Pujangga, Pandita, dan Bajra. Skill tersebut dipertahankan untuk compatibility dan tidak berarti semua specialization V2 sudah aktif publik.

## 8. Job yang belum memiliki content tree V2

Skill final belum dibuat untuk:

- Acolyte V2 — Luminary / Sacred Fist
- Archer V2 — Ranger / Marksman
- Knight V2 — Vanguard / Phalanx
- Mage V2 — Summoner / Sorcerer
- Smith V2 — Blacksmith / Specialist
- Semua Advanced Job

Untuk job-job tersebut, dokumen ini hanya mencatat architecture contract dan tidak mengarang skill.

## 9. Sumber data

- Canonical job registry: `lib/game/job-registry-v2.ts`
- Skill registry dan Adventurer/legacy skills: `lib/game/skills.ts`
- Warrior V2 content: `lib/game/warrior-v2.ts`
- Thief V2 content: `lib/game/thief-v2.ts`

Dokumen ini bersifat katalog. Ia tidak mendaftarkan skill baru, tidak mengaktifkan progression, dan tidak mengubah combat balance.
