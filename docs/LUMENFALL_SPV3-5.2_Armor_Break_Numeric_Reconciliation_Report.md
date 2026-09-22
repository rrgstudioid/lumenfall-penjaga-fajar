# LUMENFALL — SPV3-5.2 Armor Break Numeric Reconciliation Report

Status: **PASS — V3 numeric path reconciled**

## 1. Temuan utama

Nilai 20% berasal dari jalur legacy/adaptor lama, bukan dari kontrak Warrior V3:

- `lib/game/world.ts` sebelumnya menerapkan source-owned Armor Break dengan `strength: 20`.
- `lib/game/combat-status.ts` masih memiliki fallback kompatibilitas `20` untuk target yang hanya memakai status legacy tanpa `sourceOwnedStatuses`.
- `lib/game/combat-mechanics.ts` tetap memiliki `armorBreakDefenseMultiplier: 0.8` untuk jalur legacy/Combat Power.
- Definisi Warrior V3 sebelumnya hanya menyatakan debuff `armor_break`, tetapi belum membawa data strength per rank ke adapter runtime.

Jadi, angka 20% bukan hasil normalisasi rank V3 dan bukan keputusan balance V3. Jalur V2/legacy dipertahankan; yang diperbaiki adalah jalur V3 source-owned.

## 2. Data path setelah perbaikan

```text
Warrior V3 Armor Breaker rank
  → ARMOR_BREAK_REDUCTION_BY_RANK
  → runtime adapter armorBreakStrengthByRank
  → resolved skill action
  → world.ts applySourceOwnedStatus(strength rank aktual)
  → sourceOwnedStatuses.armor_break
  → effectiveArmorBreakStrength()
  → defense × (1 - strength / 100)
  → mitigateDamage()
```

Kontrak V3 yang sekarang digunakan:

| Rank | Strength runtime |
|---:|---:|
| R1 | 6% |
| R2 | 7,5% |
| R3 | 9% |
| R4 | 10,5% |
| R5 | 12% |

## 3. Perubahan file

- `lib/game/skills.ts` — menambahkan metadata `armorBreakStrengthByRank` pada skill runtime.
- `lib/game/warrior-v3.ts` — menambahkan data kanonik R1–R5 dan meneruskannya melalui adapter V3.
- `lib/game/world.ts` — source-owned Armor Break memakai strength rank V3, bukan hardcode 20%.
- `lib/game/armor-break-ownership.test.ts` — validasi rank nyata sampai mitigation.
- `lib/game/armor-break-ownership-fixture.ts` — fixture multi-source memakai nilai nyata R1/R3/R5.
- `scripts/verify-armor-break-ownership.mjs` — verifikasi strongest-only, fallback, refresh, dan payoff.
- Dokumen ini.

Ownership architecture SPV3-5.1 tidak diubah.

## 4. Validasi mitigation runtime

Test menggunakan `WARRIOR_V3_RUNTIME_MAP`, `resolveSkillAction`, `applySourceOwnedStatus`, `effectiveArmorBreakStrength`, dan `mitigateDamage`; bukan hanya memeriksa konstanta data.

Dengan raw damage 100, target Defense 100, attacker level 60:

| Kondisi | Effective Defense | Damage sesudah mitigation |
|---|---:|---:|
| Tanpa Armor Break | 100 | 91,6667 |
| R1 | 94 | 92,1273 |
| R2 | 92,5 | 92,2432 |
| R3 | 91 | 92,3594 |
| R4 | 89,5 | 92,4758 |
| R5 | 88 | 92,5926 |

Nilai meningkat progresif sesuai rank dan tidak ada reduksi V3 tersembunyi 20%.

## 5. Multi-source dan expiry

Fixture runtime:

- Actor A menerapkan Armor Breaker R1 = 6%.
- Actor B menerapkan Armor Breaker R5 = 12%.
- Effective Defense Reduction = **12%**, bukan 18%, 20%, atau 32%.
- Saat aplikasi B expired, fallback otomatis menjadi **6%** dari A.
- Reapply dari actor yang sama mempertahankan satu source record, bukan entry additive.
- Setelah semua aplikasi expired, effective reduction = 0%.

Source records tetap independen dan dapat ditanya per actor.

## 6. Payoff source-aware

Tidak berubah:

- Crushing Finale: **+10% final skill damage** hanya jika Armor Break berasal dari caster saat ini.
- Ruinous Arc: **+8% final skill damage** hanya jika Armor Break berasal dari caster saat ini.

Fixture membuktikan Actor A mendapat payoff miliknya, sedangkan Actor B tidak dapat memakai Armor Break milik A.

## 7. V2 compatibility dan transient state

Jalur legacy tetap memakai perilaku kompatibilitas lama, termasuk fallback 20% dan multiplier legacy. Tidak ada migrasi atau rebalance V2.

Source-owned Armor Break tetap runtime-only; tidak dipersist ke save dan tidak dipulihkan sebagai debuff stale setelah reload.

## 8. Regression result

- Ownership browser fixture: **PASS**
- Focused Armor Break / Warrior / Berserker: **19 passed, 0 failed**
- Full `lib/game`: **413 passed, 0 failed**
- Production build: **PASS**, 6,1 detik, peak Node working set sekitar 1.504,5 MB

Build hanya mengeluarkan warning ukuran chunk >500 kB; bukan failure dan tidak berkaitan dengan Armor Break.

## 9. Readiness

Armor Break V3 sekarang konsisten dengan data rank kanonik dan siap menjadi fondasi audit berikutnya. Ownership, strongest-only mitigation, expiry fallback, serta payoff Crushing Finale/Ruinous Arc tetap terlindungi.

Dual Wield dan Blade Master **belum diimplementasikan**. Tidak ada perubahan pada balance skill lain, Stun, V2, monster, atau Rune.

**SPV3-5.2 — COMPLETE.**
