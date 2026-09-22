# LUMENFALL SPV3-4.2 — Iron Charge Runtime Repair Report

Tanggal: 2026-09-22  
Status implementasi: **FIX DITERAPKAN**  
Status headed smoke: **BLOCKED — belum boleh dinyatakan PASS**

## 1. Root cause

Cast Iron Charge diterima dan movement charge memang dijalankan melalui `Game.move()`.
Actor berhenti pada `stopDistance = 1.2m` dari target. Namun validasi callback impact
meminta jarak akhir maksimal `impactRange = 1.0m`. Karena endpoint charge berada 1,2m
dari target, `SkillHitQueue` menganggap impact tidak valid dan membatalkan callback.

Akibatnya urutan sebelumnya berhenti setelah movement: impact callback tidak dipanggil,
damage resolver tidak dipanggil, HP target tidak berubah, dan evaluasi Stun tidak pernah
dijalankan.

## 2. Perbaikan

File yang diubah:

- `lib/game/world.ts`
- `tests/browser/stun-smoke.ts`
- `tests/browser/stun-smoke.html`

Perbaikan runtime memakai effective impact validation range:

`max(configured impactRange, stopDistance)`

Nilai data asli tidak diubah. `stopDistance` tetap 1,2m dan `impactRange` tetap 1,0m.
Penyesuaian ini hanya menyatukan validasi callback dengan endpoint charge yang memang
ditentukan oleh movement contract.

Tidak ada perubahan pada:

- Stun chance
- Stun duration
- threshold 3,5m
- coefficient damage
- cooldown
- Mana cost
- monster balance
- Stagger
- Berserker / Blade Master / Dual Wield / PvP

## 3. Diagnostic tracing

Tracing development-only ditambahkan melalui `Game.developmentTrace`. Event yang tersedia:

- `target_snapshot`
- `cast_accepted`
- `movement_command`
- `movement_complete`
- `impact_rejected` bila validasi gagal
- `impact_callback`
- `damage_resolver`
- `target_hp_changed`
- `stun_eligibility`
- `stun_applied`

Tracing tidak aktif bila callback development tidak dipasang dan tidak memengaruhi gameplay.

## 4. Expected runtime proof

Dengan perbaikan ini, jalur runtime yang digunakan adalah:

`cast accepted → target snapshot → Game.move() collision-safe → actor position berubah → charge selesai → impact callback → damage resolver → HP berubah → Stun eligibility`

Jalur tersebut tidak memberikan damage langsung dari cast acceptance.

## 5. Test results

Focused Stun + Warrior V3 tests:

- **14 passed**
- **0 failed**

Full `lib/game` regression:

- **399 passed**
- **0 failed**

## 6. Headed smoke status

Harness baru sudah memakai actor/runtime path nyata dan mengumpulkan tracing dari `Game`.
Namun headed browser staging pada percobaan terakhir hanya menampilkan HTML kontrol; bundle
TypeScript tidak dieksekusi setelah reload/navigasi. Karena itu kasus berikut belum memiliki
bukti headed yang valid dan tidak saya klaim PASS:

- Case A short charge
- Case B long charge + Stun
- Case C immunity
- Case D lock/recovery
- Case E Basic Attack

Server staging juga mengalami ketidakstabilan navigasi/cache pada port 3004–3006.
Warning loader asset yang muncul berasal dari staging asset path, bukan dari resolver
Iron Charge, tetapi smoke headed tetap harus diulang ketika bundle dapat dimuat normal.

## 7. Kesimpulan

Root cause runtime sudah diperbaiki secara minimal tanpa mengubah balance. Unit dan full
regression seluruhnya hijau. Status fase **belum PASS** sampai headed smoke matrix A–E dapat
dijalankan dan dibuktikan di browser runtime.

STOP setelah repair dan regression; tidak ada implementasi Stun tambahan atau perubahan
job/gameplay lain dalam fase ini.
