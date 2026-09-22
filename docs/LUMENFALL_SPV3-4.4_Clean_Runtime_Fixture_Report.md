# LUMENFALL — SPV3-4.4 Clean Runtime Combat Fixture Validation

Tanggal validasi: 22 September 2026  
Status: **PASS**  
Final marker: **SPV3-4 STUN FOUNDATION — RUNTIME VALIDATED**

## 1. Scope dan dependency fixture

Fixture development-only dijalankan sebagai halaman browser terisolasi:

`iron-charge-fixture.html` → `iron-charge-fixture.bundle.js` → `IronChargeRuntimeFixture`

Primitive runtime yang digunakan:

- V3 Warrior/Iron Charge definition dari `warrior-v3.ts`.
- CFV3 skill resolver dan hit damage dari `skill-action.ts`.
- Target-hit validation dari `combat-modifiers.ts`.
- Mitigasi damage dari `combat-mechanics.ts`.
- Charge stepping dari `directional-movement.ts`.
- Stun state, policy, eligibility, expiry, dan reapplication dari `stun.ts`.
- Development trace fixture untuk seluruh lifecycle cast.

`lib/game/world.ts` tidak diimpor. Fixture tidak memuat terrain, renderer, GLB,
dekorasi, pohon, bangunan, NPC, quest, audio, map Mahkota Fajar, atau Flaris.
Bundle final diperiksa dan tidak mengandung referensi `world.ts`, `imported-map`,
atau Flaris.

Server fixture hanya satu instance pada port `3015`, memakai cache Vite terpisah
`.vite-iron-charge-fixture`. Main development server owner tidak disentuh.
Browser validation menggunakan Chrome headless, satu proses/worker.

## 2. Hasil smoke matrix

| Kasus | Hasil | Bukti utama |
|---|---|---|
| A — short charge | PASS | start 3.7m, travel aktual 2.5m, impact terjadi, HP 30000 → 29844, Stun tidak eligible |
| B — long charge | PASS | start 6m, travel aktual 4.8m, impact terjadi, HP 30000 → 29844, Stun aktif sampai 1.5s |
| C — control lock | PASS | movement, Basic Attack, dan active skill semuanya ditolak saat Stun |
| D — recovery | PASS | setelah waktu 1.6s, ketiga aksi diterima dan state Stun bersih |
| E — immunity | PASS | travel 4.8m dan damage tetap terjadi, policy `stunImmune` menolak Stun |
| Basic Attack | PASS | damage 199, Stun `false`, knockback gameplay `0` |

### Case A — short charge

- Jarak awal: `3.7m`.
- `stopDistance`: `1.2m`.
- Travel aktual: `2.5m`.
- Sisa jarak ke target: `1.2m`; impact valid.
- Damage: `156`.
- `stunEligible=false`, `stunned=false`.
- Tidak ada knockback.

### Case B — long charge

- Jarak awal: `6.0m`.
- Travel aktual: `4.8m`.
- Sisa jarak ke target: `1.2m`; impact valid.
- Damage: `156`.
- `stunEligible=true` dengan deterministic RNG sukses.
- Stun diterapkan dengan `expiresAt=1.5s`.
- Tidak ada knockback.

### Case C dan D — kontrol dan recovery

Saat target Stun, ketiga percobaan menghasilkan `accepted=false`:

- movement;
- Basic Attack;
- active skill.

Setelah waktu dimajukan ke `1.6s`, expiry dibersihkan. Movement, Basic Attack,
dan active skill kembali `accepted=true`; `remainingStun=0`.

### Case E — immunity

Target diberi `stunImmune=true`. Charge tetap bergerak, mencapai impact, dan
memberi damage `156`. Eligibility tercapai, tetapi policy menolak aplikasi Stun.

## 3. Development trace

Urutan trace aktual untuk charge yang berhasil:

`target_snapshot` → `cast_accepted` → `movement_command` → `movement_complete`
→ `impact_callback` → `damage_resolver` → `target_hp_changed`
→ `stun_eligibility` → `stun_applied` (hanya saat proc valid).

Case A berhenti secara normal setelah `stun_eligibility` dengan `eligible=false`.
Case E juga berhenti setelah eligibility karena policy immunity.

## 4. Browser evidence dan error

Evidence tersimpan di:

- `tests/browser/iron-charge-evidence/01-full-fixture.png`
- `tests/browser/iron-charge-evidence/fixture-result.json`

Hasil browser:

- console errors: `0`;
- page errors: `0`;
- request failures: `0`;
- Playwright/Chrome: `151.0.7922.108`.

## 5. Memory diagnostic

Working set proses dedicated Vite fixture:

- sebelum smoke test: `322,215,936` bytes, sekitar `307.1 MiB`;
- peak teramati selama smoke test: `324,960,256` bytes, sekitar `310.0 MiB`;
- setelah smoke test: `324,960,256` bytes, sekitar `310.0 MiB`.

Angka ini hanya diagnostic fixture dan tidak mengubah gameplay atau strategi
optimasi server utama.

## 6. Regression test

Focused SPV3/Warrior/Stun tests:

- `29 passed`;
- `0 failed`.

Full `lib/game` regression:

- `399 passed`;
- `0 failed`.

## 7. Kesimpulan

SPV3-4.4 **PASS**. Iron Charge sekarang tervalidasi melalui clean runtime combat
fixture tanpa memuat `world.ts` atau konten map. Movement aktual terjadi sebelum
impact, damage terjadi sebelum evaluasi Stun, control lock bekerja selama 1.5s,
recovery bekerja, immunity policy bekerja, dan Basic Attack tetap tanpa Stun serta
tanpa knockback gameplay.

Tidak ada perubahan pada Stun chance, duration, threshold, mana, cooldown,
movement speed, monster balance, Stagger, Berserker, Blade Master, atau animasi.

STOP setelah validasi ini. Berserker belum diimplementasikan.
