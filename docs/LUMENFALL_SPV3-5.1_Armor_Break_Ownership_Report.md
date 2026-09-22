# LUMENFALL — SPV3-5.1 Armor Break Ownership Hardening Report

Status: **IMPLEMENTED · TESTED · RUNTIME VALIDATED**  
Tanggal: 22 September 2026

## 1. Limitation sebelumnya

Armor Break sebelumnya direpresentasikan terutama sebagai timer `defenseDown` tunggal. Timer tersebut cukup untuk efek single-source, tetapi tidak dapat menjawab apakah Armor Break berasal dari actor yang sedang menyerang. Karena itu predicate generik `targetStatuses: ['armor_break']` berisiko memberi payoff Crushing Finale atau Ruinous Arc kepada actor yang tidak menerapkan debuff.

## 2. Representasi baru

Ditambahkan store transient generic:

```ts
sourceOwnedStatuses: Record<string, SourceOwnedStatus[]>
```

Setiap aplikasi menyimpan:

- `sourceActorId`
- `sourceSkillId`
- `strength`
- `appliedAt`
- `expiresAt`

API yang dipakai:

- `applySourceOwnedStatus()`
- `getActiveStatusApplications()`
- `hasActiveStatusFromSource()`
- `strongestActiveStatus()`
- `effectiveArmorBreakStrength()`
- `clearExpiredSourceStatuses()`

Primitive ini generic dan tidak mengimplementasikan Poison, Burn, Bleed, Mark, atau status baru lain.

## 3. Ownership dan strongest-only

Status Armor Break V3 dari Armor Breaker menyimpan source actor caster dan source skill. Beberapa actor boleh memiliki record aktif bersamaan. Mitigasi tidak menjumlahkan strength; record terkuat aktif yang dipakai. Untuk strength sama, expiry terbaru lalu application terbaru menjadi tie-break deterministik.

Runtime V3 mempertahankan behavior strength Armor Break yang sudah berjalan sebelumnya, yaitu 20% defense reduction efektif. Tidak ada angka balance Armor Breaker yang diubah pada fase ini. Store mendukung strength berbeda untuk fixture/future content.

## 4. Refresh dan expiry

Reapply dari actor yang sama mengganti satu record sumber tersebut, bukan menambah entry baru. Strength baru tidak menurunkan strength yang sudah dimiliki sumber itu; expiry di-refresh berdasarkan aplikasi terbaru. Source berbeda tetap memiliki record independen.

Saat record terkuat expired, `effectiveArmorBreakStrength()` otomatis memilih record aktif berikutnya. Saat seluruh record expired, mitigation kembali normal dan timer compatibility/UI dibersihkan. Status runtime tidak masuk save.

## 5. Crushing Finale

Payoff tetap **+10% final skill damage**, sekali, tanpa scaling tambahan. Condition V3 sekarang menggunakan `targetStatusesFromSource: ['armor_break']`, sehingga hanya Armor Break dari source actor caster yang memenuhi syarat.

## 6. Ruinous Arc

Payoff tetap **+8% final skill damage**, sekali. World runtime kini memanggil `hasActiveStatusFromSource()` dengan actor ID caster. Armor Break actor lain tidak memenuhi payoff.

## 7. Mitigation

Defense reduction membaca `effectiveArmorBreakStrength()` pada waktu hit. Legacy target yang tidak memiliki source-owned store tetap memakai compatibility fallback lama; target V3 yang sudah memiliki store tidak mempertahankan stale reduction setelah semua source record expired.

## 8. Fixture dua actor

Fixture development-only: `lib/game/armor-break-ownership-fixture.ts` dan browser entry `tests/browser/armor-break-ownership-fixture.ts`. Fixture hanya memuat combat-status dan combat-modifiers; tidak mengimpor `world.ts`, map, terrain, GLB, monster population, atau renderer.

Evidence utama:

- Actor A Armor Break 6%, Actor B Armor Break 12% → effective **12%**, bukan 18%.
- B 12% expired saat A 6% masih aktif → fallback **6%**.
- A reapply 9% → satu record A, bukan duplicate; effective **9%**.
- Semua expired → effective **0%**.
- A → Crushing Finale: multiplier **1.10**.
- B → Crushing Finale terhadap Armor Break A: multiplier **1.00**.
- A → Ruinous Arc: multiplier **1.08**.
- B → Ruinous Arc terhadap Armor Break A: multiplier **1.00**.
- Browser errors/warnings: **0**.

Evidence JSON dan screenshot: `output/release-audit/armor-break-ownership/`.

## 9. Save/transient policy

`sourceOwnedStatuses` hanya berada pada target combat runtime. Tidak ditambahkan ke Hero save schema dan tidak dipulihkan setelah reload. Existing save fields, V2 status behavior, dan active character progression tidak dimigrasikan.

## 10. Regression

- Focused ownership tests: **3 passed / 0 failed**.
- Warrior V3 + Berserker V3 focused tests: **18 passed / 0 failed**.
- Full `lib/game`: **412 passed / 0 failed**.
- Production build: **PASS**, 6,19 detik, peak Node working set sekitar 1,50 GB. Warning chunk >500 kB tetap merupakan warning bundling yang sudah ada, bukan failure.
- Existing Berserker fixture regression: PASS.
- Existing Warrior regression termasuk Armor Breaker, Crushing Finale, CounterContext, Iron Charge/Stun: PASS.

## 11. File utama

- `lib/game/combat-status.ts`
- `lib/game/combat-modifiers.ts`
- `lib/game/world.ts`
- `lib/game/warrior-v3.ts`
- `lib/game/armor-break-ownership.test.ts`
- `lib/game/armor-break-ownership-fixture.ts`
- `tests/browser/armor-break-ownership-fixture.ts`
- `scripts/verify-armor-break-ownership.mjs`

## 12. Known limitations

Party combat dan PvP belum diaktifkan. Belum ada actor networking atau policy untuk boss/elite; source identity sudah tidak mengasumsikan hanya satu attacker. Legacy V2 Armor Break tetap memakai adapter timer lama dan sengaja tidak dimigrasikan ke source-owned system pada fase ini.

## 13. Readiness

Fondasi ownership Armor Break siap menjadi dependency untuk audit Dual Wield dan Blade Master. Fase berikutnya tetap membutuhkan keputusan owner sebelum menambahkan skill atau membuka party/PvP behavior.

**STOP — menunggu OWNER REVIEW.**
