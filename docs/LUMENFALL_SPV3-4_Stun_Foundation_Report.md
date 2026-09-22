# LUMENFALL — SPV3-4 Stun Foundation Report

Status: **IMPLEMENTED / DEVELOPMENT V3**  
Tanggal: 2026-09-22

## Ringkasan

Universal Stun foundation telah dibuat sebagai crowd-control transient yang terpisah dari seluruh sistem Stagger. Penggunaan live pertama hanya terhubung ke `v3-warrior-iron-charge`.

Tidak ada Stagger yang dipulihkan, tidak ada Stun Resistance stat, dan tidak ada Stun pada skill Warrior V3 lain.

## 1. Arsitektur Subsystem

File baru: `lib/game/stun.ts`.

Subsystem menyediakan:

- `StunState`
- `applyStun`
- `isStunned`
- `remainingStun`
- `clearExpiredStun`
- `chargeStunEligible`
- `stunChanceForRank`

Subsystem dapat dipakai oleh player maupun monster karena hanya membutuhkan target dengan state Stun dan hook policy opsional.

## 2. State Fields

Setiap Stun yang berhasil menyimpan:

- `sourceActorId`
- `sourceSkillId`
- `chance`
- `pveDuration`
- `pvpDuration`
- `appliedAt`
- `expiresAt`
- `targetPolicy`: `NORMAL`, `REDUCED`, atau `IMMUNE`

Target juga dapat mendeklarasikan:

- `stunImmune`
- `stunPolicy(requested)` sebagai hook future untuk boss, elite, atau PvP policy.

Hook tersebut belum diberi angka reduction atau diminishing return.

## 3. Control Lock

Saat player memiliki `stunState` aktif berdasarkan `combatTime`:

- movement dari input dihentikan;
- pemanggilan `move` ditolak;
- Basic Attack ditolak;
- active skill ditolak sebelum mana/cast diproses.

Saat `expiresAt` tercapai, `isStunned` menjadi false dan kontrol kembali normal.

Untuk target monster, state generic dipantulkan ke timer runtime `enemy.stun` yang sudah dipakai AI. AI berhenti menyerang/bergerak selama timer aktif. Ini hanya adapter runtime, bukan subsystem Stagger.

Jika Stun mendarat ketika action lain sudah berada di queue, queue tersebut tidak di-reset secara destruktif. Hit yang sudah valid tetap menyelesaikan resolusi sesuai policy queue yang ada; input berikutnya dikunci selama Stun.

## 4. Pengukuran Jarak Iron Charge

Iron Charge sekarang memakai dash dengan `stopDistance = 1.2m` dan `impactRange = 1.0m`.

Jarak yang dipakai untuk syarat Stun adalah jarak horizontal aktual actor sebelum dan sesudah movement charge, bukan sekadar jarak target ketika tombol ditekan.

Threshold data: **3.5m**.

- 2.0m → tidak eligible
- 3.4m → tidak eligible
- 3.5m → eligible
- 6.0m → eligible

Roll dilakukan di callback impact, setelah target masih valid dan serangan benar-benar mengenai target.

## 5. Chance per Rank

| Rank | Chance PvE |
|---:|---:|
| R1 | 10% |
| R2 | 15% |
| R3 | 20% |
| R4 | 25% |
| R5 | 30% |

Nilai disimpan pada `stunProfile` Iron Charge dan dibaca melalui resolver data, bukan disebar sebagai combat constant.

## 6. Duration

- PvE: **1.5 detik**, semua rank.
- PvP override data: **0.75 detik**.

PvP runtime belum aktif.

## 7. Reapplication

Stun tidak pernah menambahkan durasi secara additive.

Jika Stun baru akan berakhir lebih lambat, expiry di-refresh ke expiry baru. Jika expiry baru tidak lebih lambat, aplikasi ditolak. Contoh:

`1.0s tersisa + Stun 1.5s` menjadi expiry baru `1.5s dari aplikasi`, bukan `2.5s`.

## 8. Immunity dan Reduction Hook

Target dapat menolak Stun melalui `stunImmune = true`. Target policy juga dapat mengembalikan `IMMUNE` melalui `stunPolicy`.

`REDUCED` sudah tersedia sebagai policy state untuk fase future, tetapi belum diberi durasi reduction, diminishing return, atau asumsi boss/elite. Target normal development memakai `NORMAL`.

## 9. Hit Reaction vs Stun

Keduanya tetap terpisah:

- hit reaction adalah visual/presentation;
- Stun adalah state gameplay yang memblokir kontrol.

Stun tidak menghasilkan knockback atau displacement gameplay.

## 10. Save dan Transient State

`stunState` tidak ditulis ke character save. `statusEffects.stun` juga dibuang dari save payload. Parser tidak memulihkan Stun aktif dari data save lama.

Dengan demikian reload tidak dapat mengembalikan stale combat Stun.

## 11. Iron Charge Integration

Hanya `v3-warrior-iron-charge` yang memiliki `stunProfile` live.

Urutan validasi:

1. cast dan weapon valid;
2. target valid;
3. charge bergerak menggunakan collision-safe movement;
4. impact callback masih valid;
5. damage tetap diproses;
6. jarak charge memenuhi 3.5m;
7. RNG rank berhasil;
8. target policy mengizinkan;
9. Stun diterapkan.

Iron Charge tetap single-target, one-hit, mobility attack, dan `knockbackStrength = 0`.

Skill lain berikut tidak memiliki Stun profile:

- Warrior Strike
- Sweeping Slash
- Armor Breaker
- Counter Slash
- Ground Breaker
- Crushing Finale

## 12. Basic Attack

Basic Attack tetap:

- tanpa knockback V3;
- tanpa Stun;
- tidak memakai `stunProfile`.

## 13. Focused Tests

File: `lib/game/stun.test.ts`

Hasil: **5 passed / 0 failed**.

Yang divalidasi:

- hanya Iron Charge memiliki profile live;
- threshold 2m / 3.4m / 3.5m / 6m;
- chance R1–R5 deterministik;
- semua state fields dan expiry;
- refresh tidak additive;
- immunity hook;
- transient save behavior.

Warrior V3 regression tetap: **9 passed / 0 failed**.

## 14. Full Regression

Full `lib/game` regression:

- **399 passed / 0 failed**

Tidak ada regression pada CFV3, SPV3, Adventurer V3, Warrior V2, Thief V2, CounterContext, Armor Break, hotbar, equipment, Rune, atau world systems yang diuji.

## 15. Known Limitations

- Belum ada PvP runtime.
- Belum ada diminishing return atau post-Stun protection.
- Belum ada klasifikasi boss/elite global; immunity tetap opt-in per actor.
- Belum ada final Stun VFX/animation.
- Test runtime penuh terhadap scene browser belum dijalankan dalam fase ini; jalur runtime dan collision-safe charge telah dihubungkan pada `Game`.
- Tidak ada perubahan balance monster.

## 16. Recommendation untuk Fase Berserker

Review foundation ini terlebih dahulu. Fase berikutnya dapat memakai Stun API yang sama untuk skill yang disetujui secara eksplisit. Jangan menambahkan Stun ke Berserker, Earth Splitter, Counterflow, Blade Master, atau skill lain tanpa kontrak terpisah dari owner.

SPV3-4 dihentikan di sini sesuai STOP condition.
