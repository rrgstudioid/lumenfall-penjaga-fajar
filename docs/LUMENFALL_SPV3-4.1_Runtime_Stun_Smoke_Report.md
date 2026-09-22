# LUMENFALL — SPV3-4.1 Runtime Stun Smoke Test

Tanggal: 2026-09-22  
Status: **FAIL — smoke test belum dapat dinyatakan lulus**

## Scope

Pengujian dilakukan pada headed browser runtime menggunakan development-only,
memory-only harness untuk V3 Warrior. Tidak ada perubahan pada architecture,
chance, duration, threshold, Stagger, monster balance, Berserker, Blade Master,
atau animasi.

## Hasil runtime yang teramati

| Skenario | Hasil observasi | Status |
|---|---|---|
| Iron Charge 2,5 m (<3,5 m) | Cast diterima; target tetap 30.000 HP; Stun tidak aktif | **FAIL / tidak lengkap** |
| Iron Charge 6 m (>=3,5 m, RNG dipaksa proc) | Cast diterima; target tetap 30.000 HP; Stun tidak aktif | **FAIL** |
| Lock movement / Basic Attack / skill saat Stun | Tidak dapat divalidasi karena Stun tidak pernah aktif | **BLOCKED** |
| Recovery setelah 1,5 detik | Tidak dapat divalidasi karena Stun tidak pernah aktif | **BLOCKED** |
| `stunImmune` | Tidak dapat divalidasi secara bermakna karena impact tidak menghasilkan damage | **BLOCKED** |
| Basic Attack tanpa Stun/knockback | Belum dapat dinyatakan PASS dari smoke run ini | **BLOCKED** |

## Evidence

Evidence headed tersedia pada sesi browser smoke-test dengan dua tampilan hasil:

- `SHORT CHARGE`: `castAccepted: true`, `damage: 0`, `stunned: false`, target HP `30,000 / 30,000`.
- `ELIGIBLE CHARGE / DETERMINISTIC PROC`: `castAccepted: true`, `damage: 0`, `stunned: false`, target HP `30,000 / 30,000`.

Pada kedua tampilan, output harness juga melaporkan posisi hero tetap `{x: 0, z: 0}`.
Karena impact/damage tidak terbukti terjadi, hasil ini tidak boleh dipakai sebagai
bukti bahwa threshold atau resolver Stun salah. Smoke test berhenti pada kegagalan
impact runtime.

## Console / server

Tidak ada console error atau warning gameplay baru yang terlihat pada halaman saat
output hasil tersedia. Sesi juga mengalami ketidakstabilan server staging saat
reload; server smoke-test staging yang dibuat untuk pengujian sudah dihentikan.
Server development utama pada port 3003 tidak diubah.

## Perubahan scope pengujian

Harness berikut dibuat sebagai alat development-only dan bukan bagian dari runtime
produksi:

- `tests/browser/stun-smoke.html`
- `tests/browser/stun-smoke.ts`
- `tests/browser/stun-smoke.config.ts`

Tidak ada file `lib/game` yang diubah selama smoke test ini.

## Kesimpulan

**FAIL / BLOCKED.** SPV3-4.1 belum bisa ditutup sebagai PASS karena Iron Charge
belum menunjukkan impact damage pada headed runtime, sehingga eligibility Stun,
control lock, recovery, dan immunity case tidak dapat divalidasi secara sah.

Langkah berikutnya yang diperlukan adalah memperbaiki atau mengisolasi jalur impact
Iron Charge pada harness/runtime terlebih dahulu, lalu mengulang seluruh smoke matrix.
