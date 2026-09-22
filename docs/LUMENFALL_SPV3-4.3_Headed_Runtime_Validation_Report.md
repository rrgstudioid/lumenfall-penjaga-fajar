# LUMENFALL — SPV3-4.3 Headed Runtime Validation Report

Tanggal: 22 September 2026  
Status: **BLOCKED — headed runtime evidence belum lengkap**

## 1. Ringkasan

SPV3-4.3 tidak mengubah gameplay, balance, atau arsitektur Stun. Fokus fase ini adalah staging/harness headed. Audit menemukan bahwa halaman HTML dan entry module ringan dapat dimuat, tetapi transform/import langsung terhadap `stun-smoke.ts` berhenti sebelum modul runtime selesai dieksekusi. Harness kemudian dipindahkan ke bundle development-only yang dibuat dari entry smoke test yang sama dan menggunakan modul runtime LUMENFALL aktual.

Bundle tersebut berhasil dilayani oleh server staging dengan respons HTTP cepat. Akan tetapi, sesi browser headed yang diperlukan untuk menjalankan tombol Case A–E dan mengambil screenshot terputus/reset pada sisi konektor browser. Karena tidak ada sesi headed yang tersedia untuk interaksi lanjutan, validasi gameplay A–E tidak boleh dinyatakan PASS.

## 2. Root cause staging/harness

Root cause yang teramati:

1. `stun-smoke.html` berhasil menampilkan kontrol HTML.
2. `smoke-boot.ts` berhasil dieksekusi dan menampilkan `HARNESS_MODULE_BOOT`.
3. Dynamic import terhadap `stun-smoke.ts` tidak selesai dalam 8 detik dan menghasilkan `HARNESS_RUNTIME_IMPORT_TIMEOUT` pada server staging baru.
4. Pada sesi server sebelumnya, request yang sama berakhir sebagai `Failed to fetch dynamically imported module`.
5. Setelah entry smoke test dibundle secara development-only menggunakan entry yang sama, `stun-smoke.bundle.js` dan `stun-smoke.html` merespons HTTP 200 dengan cepat.

Kesimpulannya, kegagalan yang terbukti berada pada jalur transform/import staging Vite untuk graph TypeScript runtime penuh, bukan pada angka Stun, movement, damage, atau resolver combat.

## 3. Resolusi harness yang diterapkan

Perubahan staging:

- `tests/browser/stun-smoke.html` sekarang memuat `stun-smoke.bundle.js` secara langsung.
- `tests/browser/stun-smoke.ts` tetap menjadi sumber smoke test dan tetap mengimpor `Game`, `rules`, `regions`, serta path runtime aktual.
- `tests/browser/stun-smoke.bundle.js` adalah bundle development-only untuk menghindari transform runtime yang macet pada headed staging.
- Import CSS global produksi yang tidak diperlukan smoke test dihapus dari entry smoke test; harness tetap memakai style lokalnya sendiri.
- `tests/browser/smoke-boot.ts` diberi diagnostic timeout untuk membedakan HTML-load, entry-load, dan runtime-import failure.

Tidak ada perubahan pada `lib/game` dalam fase SPV3-4.3.

## 4. Runtime yang digunakan

Target yang disiapkan adalah dedicated development-only headed harness, tetapi bundle-nya menggunakan `Game` dan resolver runtime LUMENFALL aktual, bukan mock combat path. State test tetap memory-only dan tidak menyentuh production save.

Server staging terakhir:

- URL: `http://127.0.0.1:3011/stun-smoke.html`
- HTML: HTTP 200
- Bundle: HTTP 200
- Bundle: berhasil dibuat dari `tests/browser/stun-smoke.ts`

## 5. Hasil Case A–E

| Case | Hasil | Bukti headed gameplay |
|---|---|---|
| A — short charge sekitar 2.5m | **NOT EXECUTED / BLOCKED** | Tidak ada sesi headed yang tersedia untuk klik dan capture trace |
| B — long charge sekitar 6m + deterministic proc | **NOT EXECUTED / BLOCKED** | Sama |
| C — Stun control lock | **NOT EXECUTED / BLOCKED** | Sama |
| D — recovery setelah 1.5s | **NOT EXECUTED / BLOCKED** | Sama |
| E — immunity | **NOT EXECUTED / BLOCKED** | Sama |
| Basic Attack | **NOT EXECUTED / BLOCKED** | Sama |

Tidak ada klaim PASS untuk movement, impact, HP change, Stun, recovery, immunity, atau no-knockback karena bukti headed aktual belum berhasil diambil.

## 6. Trace yang diwajibkan

Harness tetap menyiapkan trace development-only dengan urutan:

`target_snapshot → cast_accepted → movement_command → movement_complete → impact_callback → damage_resolver → target_hp_changed → stun_eligibility → stun_applied`

Trace belum dapat direkam dari klik headed pada fase ini. Karena itu tidak ada stage yang boleh dianggap terverifikasi hanya dari keberadaan tombol HTML.

## 7. Console error/warning

Yang teramati dari staging:

- direct TypeScript dynamic import: timeout/fetch failure;
- bundled entry: file dapat diserve dan mencapai pemuatan asset runtime, tetapi sesi headed reset sebelum smoke action dijalankan;
- warning bundling yang ada adalah duplicate object key `rankEffects` pada `lib/game/warrior-v3.ts`; ini warning existing saat bundling dan bukan perubahan SPV3-4.3.

Saat bundle dijalankan, runtime juga mencatat warning asset existing karena beberapa path GLB mengembalikan dokumen HTML (`Unexpected token '<'`). Warning tersebut berasal dari asset/dekorasi runtime, bukan dari Stun atau Iron Charge. Karena itu syarat “tidak ada console error/warning baru” belum dapat dinyatakan lulus.

Tidak ada dasar untuk menyatakan tidak ada warning runtime karena browser headed tidak tersedia saat penutupan validasi.

## 8. Regression tests

Hasil terakhir yang sudah tersedia sebelum penutupan harness:

- focused Stun + Warrior V3 + Thief V2 + phase tests: **36 passed, 0 failed**;
- full `lib/game`: **399 passed, 0 failed**.

Smoke headed A–E belum lulus sehingga status keseluruhan fase tetap BLOCKED.

## 9. Kesimpulan

`SPV3-4 STUN FOUNDATION — RUNTIME VALIDATED` **belum boleh ditandai**.

Status resmi SPV3-4.3: **BLOCKED — staging bundle sudah diperbaiki, tetapi headed runtime evidence A–E belum dapat dieksekusi setelah sesi browser terputus/reset**.

Tidak ada perubahan pada Stun threshold, chance, duration, Iron Charge damage, cooldown, Mana, movement speed, `stopDistance`, `impactRange`, monster balance, Berserker, Blade Master, atau Stagger.

Langkah lanjutan yang aman adalah membuka ulang URL staging bundle tersebut pada sesi headed yang aktif, lalu menjalankan Case A–E dan menyimpan screenshot/trace. Jangan mengubah combat architecture hanya untuk mengatasi blocker ini.
