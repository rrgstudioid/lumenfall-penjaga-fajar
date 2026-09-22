# Phase 4C — ID, rank dan prerequisite implemented

Pendamping laporan Phase4C FINAL. Pemilik telah menetapkan range delapan melee 3,5m tanpa scaling dan Silent Opportunity sebagai one-cast/all-hits snapshot.

Semua daftar rank berurutan R1→R5 atau R1→R3. Detik untuk CD/duration/lock, meter untuk range/distance. Bonus Crit adalah percentage points. Base damage sebelum mitigation/crit. Semua direct damage physical, magicCoefficient=0, skillPowerCoefficient=0. Knockback=0, kecuali gerak caster bukan knockback target. Rank_values tidak mendapatkan legacy +12%.

## 16 active — identitas dan prasyarat

| ID lengkap | Nama | Lv | Max | Prasyarat rank | Lock |
|---|---|---:|---:|---|---:|
| v2-thief-quick-stab | Quick Stab | 15 | 5 | Root; R1 granted | .22 |
| v2-thief-slipstep | Slipstep | 17 | 5 | Quick Stab1 | .30 |
| v2-thief-mark-prey | Mark Prey | 19 | 5 | Quick Stab2 | .20 |
| v2-thief-smoke-veil | Smoke Veil | 21 | 5 | Slipstep2 | .30 |
| v2-thief-twin-fang | Twin Fang | 23 | 5 | Quick Stab2 | .42 |
| v2-thief-crippling-cut | Crippling Cut | 25 | 5 | Mark Prey1 | .35 |
| v2-thief-venom-edge | Venom Edge | 28 | 5 | Twin Fang2 | .35 |
| v2-thief-evasive-feint | Evasive Feint | 31 | 5 | Slipstep2 | .25 |
| v2-thief-shadow-lunge | Shadow Lunge | 34 | 5 | Slipstep3 AND Mark Prey1 | .45 |
| v2-thief-marked-strike | Marked Strike | 37 | 5 | Mark Prey3 | .32 |
| v2-thief-blade-flurry | Blade Flurry | 40 | 5 | Twin Fang3 | .68 |
| v2-thief-silent-opening | Silent Opening | 43 | 5 | Smoke Veil3 | .45 |
| v2-thief-rear-rend | Rear Rend | 46 | 5 | Crippling Cut3 | .50 |
| v2-thief-disengage | Disengage | 49 | 5 | Slipstep3 AND Fleet Footing2 | .30 |
| v2-thief-weakpoint-assault | Weakpoint Assault | 54 | 3 | Marked Strike3 AND Rear Rend3 | .65 |
| v2-thief-instinct | Thief Instinct | 59 | 3 | 25 current paid Thief ranks, excluding granted | .40 |

Target: direct attacks dan Mark memakai selected enemy; Shadow Lunge targeted dash; Slipstep/Disengage/misc buffs self, tanpa target. Tidak ada AoE Thief baru.

Weapons: damaging actions dagger/dual_dagger; Twin Fang/Blade Flurry hanya dual_dagger. Mark/movement/self buffs tidak mempunyai weapon gate tambahan. Ini tidak mengubah restriction equipment produksi.

Movement during lock: true hanya Mark Prey, Smoke Veil, Evasive Feint, Thief Instinct. Directional displacement Slipstep/Disengage tetap dilakukan saat cast, walaupun movement input selama lock dibatasi.

## Direct damage rank values

Raw = base + PhysicalAttack × coeff. Semua stagger terpisah dari crit/HP damage.

| Skill | Base per rank | Physical coeff per rank | Stagger per rank | Mana | CD per rank |
|---|---|---|---|---:|---|
| Quick Stab | 14,18,22,26,30 | .95,1,1.05,1.10,1.15 | 3,3,4,4,5 | 5 | 3,3,2.9,2.9,2.8 |
| Crippling Cut | 18,22,26,30,34 | 1.05,1.10,1.15,1.22,1.30 | 4,4,5,5,6 | 10 | 7,6.9,6.8,6.6,6.5 |
| Venom Edge | 18,22,26,30,34 | 1.10,1.16,1.22,1.28,1.35 | 0,0,0,0,0 | 11 | 8,7.8,7.5,7.2,7 |
| Shadow Lunge | 16,19,22,25,28 | .85,.90,.95,1,1.05 | 4,4,5,5,6 | 11 | 7.5,7.3,7,6.8,6.5 |
| Marked Strike | 20,24,28,32,36 | 1.10,1.16,1.22,1.28,1.35 | 0,0,0,0,0 | 10 | 6,5.9,5.8,5.6,5.5 |
| Silent Opening | 22,26,30,34,38 | 1.20,1.27,1.34,1.42,1.50 | 0,0,0,0,0 | 14 | 10,9.8,9.5,9.2,9 |
| Rear Rend | 24,28,32,36,40 | 1.25,1.32,1.40,1.47,1.55 | 7,8,8,9,10 | 13 | 8.5,8.3,8,7.8,7.5 |
| Weakpoint Assault | 32,40,48 | 1.85,2.05,2.25 | 10,12,14 | 22 | 16,15,14 |

Quick Stab range3.5. Mark Prey range8. Shadow Lunge range6.5/6.75/7/7.5/8. Twin Fang, Crippling Cut, Venom Edge, Marked Strike, Blade Flurry, Silent Opening, Rear Rend dan Weakpoint Assault memiliki range final3.5 di setiap rank, tanpa range scaling.

## Multi-hit

Tuple `(base, coefficient, stagger)`. Tiap hit canCrit true, roll terpisah, mana/CD satu kali per cast. Tidak ada perkalian full-cast coefficient per hit.

### Twin Fang

| Rank | Hit1 @0 | Hit2 @.20 | Mana | CD |
|---:|---|---|---:|---:|
| 1 | (4,.50,2) | (8,.75,4) | 9 | 5.5 |
| 2 | (5,.54,2) | (10,.79,4) | 9 | 5.4 |
| 3 | (6,.58,2) | (12,.84,5) | 9 | 5.3 |
| 4 | (7,.62,3) | (14,.89,5) | 9 | 5.1 |
| 5 | (8,.65,3) | (16,.95,6) | 9 | 5 |

### Blade Flurry

| Rank | Hit1 @0 | Hit2 @.16 | Hit3 @.38 | Total stagger | Mana | CD |
|---:|---|---|---|---:|---:|---:|
| 1 | (3,.40,1.6) | (4,.45,1.6) | (8,.70,4.8) | 8 | 15 | 9 |
| 2 | (4,.42,1.8) | (5,.49,1.8) | (9,.74,5.4) | 9 | 15 | 8.8 |
| 3 | (5,.45,2) | (6,.53,2) | (10,.79,6) | 10 | 15 | 8.5 |
| 4 | (6,.48,2.2) | (7,.56,2.2) | (12,.84,6.6) | 11 | 15 | 8.2 |
| 5 | (7,.50,2.4) | (8,.60,2.4) | (14,.90,7.2) | 12 | 15 | 8 |

Stagger Flurry didistribusi20%/20%/60%; kontrak mengizinkan pembagian dengan mayoritas pada hit terakhir. Total/timing tidak berubah oleh ASPD.

## Movement / Mark / buffs

| Skill | Per-rank property | Mana | CD per rank |
|---|---|---:|---|
| Slipstep | distance3.5/3.75/4/4.25/4.5 | 6 | 6.5/6.2/6/5.8/5.5 |
| Disengage | distance4/4.25/4.5/4.75/5 | 8 | 10/9.6/9.2/8.8/8.5 |
| Mark Prey | duration10/11/12/13/14; range8 | 8 | 6 semua |
| Smoke Veil | duration3.5/4/4.5/5/5.5 | 12 | 18/17.5/17/16.5/16 |
| Evasive Feint | evasion8/10/12/14/16; duration4/4.5/5/5.5/6 | 10 | 18/17.5/17/16.5/16 |
| Thief Instinct | Crit5/7/10; CritDamage10/15/20; duration10/11/12; R3 Mana-10% | 28 | 50/48/46 |

Modifiers duration/action diterapkan pada resolved action; data registry tidak dimutasi.

## Conditional/status rank values

| Skill | Condition / effect | Per-rank values |
|---|---|---|
| Crippling Cut | Slow20% | duration2.5/3/3.5/4/4.5 |
| Crippling Cut | actual Rear90°, duration saja | bonus duration.75/.90/1.10/1.30/1.50 |
| Venom Edge | Poison existing formula | duration4/4.5/5/5.5/6 |
| Shadow Lunge | markedBySelf, Crit Rate | +6/+7/+8/+9/+10 |
| Marked Strike | markedBySelf, Crit Rate | +8/+9/+10/+12/+14 |
| Marked Strike | markedBySelf, Crit Damage | +8/+10/+12/+14/+16 |
| Silent Opening | Stealth snapshot, Crit Rate | +12/+15/+18/+21/+24 |
| Silent Opening | Stealth snapshot, Crit Damage | +10/+12/+14/+16/+18 |
| Rear Rend | impact rear, total raw multiplier | +12/+15/+18/+21/+25% |
| Weakpoint Assault | markedBySelf, total raw payoff | +8/+12/+16% |
| Weakpoint Assault | impact rear, same payoff group | +8/+12/+16% |

Weakpoint kedua condition: ×1.16/1.24/1.32, bukan1.08²/1.12²/1.16². Mark tidak dikonsumsi. Tidak ada guaranteed crit/execute/reset/iframe.

## 14 passive — semua ID dan rank

| ID lengkap / nama | Lv / Max | Prasyarat | Efek per rank dan scope |
|---|---|---|---|
| v2-thief-agile-conditioning / Agile Conditioning | 15/5 | — | MaxHP1.5/3/4.5/6/7.5%; evasion1/2/3/4/5 |
| v2-thief-dagger-discipline / Dagger Discipline | 18/5 | — | PhysicalAttack .8/1.6/2.4/3.2/4%; dagger/dual_dagger |
| v2-thief-keen-instinct / Keen Instinct | 21/5 | — | Crit .5/1/1.5/2/2.5 |
| v2-thief-shadow-discipline / Shadow Discipline | 24/5 | Smoke Veil1 | Thief stealth-tag duration +5/10/15/20/25% |
| v2-thief-dual-dagger-familiarity / Dual Dagger Familiarity | 25/5 | Dagger Discipline2 AND Twin Fang1 | dual_dagger physical Thief action damage+.5/1/1.5/2/2.5%, Crit+.5/1/1.5/2/2.5; bukan basic |
| v2-thief-mark-expertise / Mark Expertise | 27/5 | Mark Prey1 | Thief mark-tag duration+.5/1/1.5/2/2.5s |
| v2-thief-fleet-footing / Fleet Footing | 30/5 | Slipstep2 | directional movement+.15/.30/.45/.60/.75m, bukan Lunge |
| v2-thief-venomcraft / Venomcraft | 33/5 | Venom Edge1 | Thief poison-tag duration+.4/.8/1.2/1.6/2s |
| v2-thief-rear-awareness / Rear Awareness | 36/5 | Crippling Cut2 | rear_synergy + actual Rear90°: Crit+1/2/3/4/5 |
| v2-thief-opportunist / Opportunist | 39/5 | Mark Expertise2 | mark_synergy + own-Mark: Crit+1/2/3/4/5 |
| v2-thief-twin-edge-control / Twin Edge Control | 40/3 | Dual Dagger Familiarity3 AND Blade Flurry2 | dual_dagger + multi_hit: CritDamage+5/10/15 |
| v2-thief-rapid-technique / Rapid Technique | 42/5 | Blade Flurry1 | multi_hit damage+1.5/3/4.5/6/7.5%, normal additive |
| v2-thief-evasive-instinct / Evasive Instinct | 45/3 | Evasive Feint3 | HP≤35% effectiveMaxHP: Evasion+5/8/12; no recursion/DR |
| v2-thief-silent-opportunity / Silent Opportunity | 48/3 | Smoke Veil3 AND Keen Instinct2 | satu offensive Thief Stealth cast CritDamage+5/10/15; satu snapshot berlaku pada seluruh hit cast itu |

Silent Opportunity tidak retrigger/consume/stack per hit. Delayed hits menyimpan bonus cast semula walaupun Stealth sudah berakhir. Cast berikutnya tidak mendapat bonus tanpa Stealth baru. Angka R1–R3 tidak berubah.

## Tag scopes

- Shared damaging: thief, physical, melee, single_target.
- multi_hit: Twin Fang, Blade Flurry.
- mark_synergy: Shadow Lunge, Marked Strike, Weakpoint Assault.
- rear_synergy: Crippling Cut, Rear Rend, Weakpoint Assault.
- stealth_opener: Silent Opening. stealth: Smoke Veil. poison: Venom Edge.
- mark: Mark Prey. directional: Slipstep, Disengage. finisher: Weakpoint Assault.
- Buffs menggunakan buff/evasion/major_state seperlunya. Tidak ada selector menarget puluhan ID hardcoded dalam damage engine.

## Fixture expected raw Rank1 / Attack200

| Skill | Expected raw sebelum crit/mitigation |
|---|---:|
| Quick Stab | 204 |
| Crippling Cut | 228 |
| Venom Edge | 238, Poison terpisah |
| Shadow Lunge | 186 |
| Marked Strike | 240 |
| Twin Fang total | 262 |
| Blade Flurry total | 325 |
| Silent Opening | 262, crit bonus terpisah |
| Rear Rend | 274 sebelum rear payoff |
| Weakpoint Assault | 402 sebelum mark/rear payoff |

Tabel tersebut diverifikasi independent golden tests; bukan angka CP atau damage akhir melawan monster produksi.
