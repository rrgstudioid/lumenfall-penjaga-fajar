# LUMENFALL — SPV3-8.1A Headed Dual Wield UI Validation

**Kesimpulan: PASS.** SPV3-8.1 — LIVE UI RUNTIME VALIDATED.

## 1. Mekanisme fixture development

Entry hanya berada di `tests/browser/blade-master-offhand-ui.html`. Entry tersebut dijalankan oleh konfigurasi Vite untuk browser test dan merender komponen produksi `CharacterOverview` serta `JobSkill` yang sama dengan game. Tidak ada tombol fixture pada menu game. Entry memeriksa `import.meta.env.DEV`; build produksi normal tidak memuat halaman atau bundle fixture ini.

Fixture memanggil `createV3JobDevelopmentHero('blade-master-60')` setelah komponen React terpasang. Karakter adalah Lv60 Warrior → Blade Master dengan Twin Blade Mastery R1. Inventaris berisi dua instance Dawnblade yang berlainan ID dan satu Ironveil Shield. Sword A berada di Main Hand; Sword B dan Shield di inventory; Off Hand kosong.

Character Overview memakai pemilih equipment produksi dari SPV3-8.1. Tombol Equip pada fixture meneruskan tindakan ke resolver `equipItem` asli, lalu merender kembali hero yang dihasilkan. K-panel memakai komponen `JobSkill` asli dan skill belum dibeli otomatis.

## 2. Isolasi save

Fixture hanya memakai `sessionStorage` dengan kunci `lumenfall:dev-fixture:blade-master-offhand-ui:v1`. Ia tidak memanggil `saveCharacter`, `loadCharacter`, atau membaca/menulis tiga kunci save normal (`lumenfall-saves-v3`, `lumenfall-saves-v2`, `lumenfall-save-v1`). Browser test membandingkan ketiga nilai tersebut sebelum dan sesudah semua interaksi; hasilnya identik. Tidak ada slot milik owner yang dihapus atau ditimpa.

## 3. Urutan boot

Urutan teramati: halaman development dimuat → React terpasang → efek client memuat fixture dari namespace terisolasi atau membuat fixture baru → `data-boot-stage="ready"` → UI dapat dipakai. Otomasi menunggu tanda `ready` sebelum menekan kontrol. Saat reload, tanda `data-fixture-source="isolated-storage"` membuktikan bahwa data benar-benar dibaca kembali dari namespace fixture.

Konfigurasi browser test menunjuk `publicDir` ke folder `public/` proyek agar ikon dan model 3D produksi tersedia pada route development. Percobaan awal menampilkan warning asset hilang karena route test belum melayani folder ini. Percobaan final bebas warning. Ikon dan model karakter pada screenshot final berhasil dimuat.

## 4–9. Evidence UI

| Kasus | Hasil | Bukti |
|---|---|---|
| A. Off Hand picker | Tepat dua kandidat: Sword B dan Ironveil Shield. Sword A yang sedang dipakai tidak muncul sebagai kandidat. | [01 — picker](../tests/browser/blade-master-offhand-ui-evidence/01-offhand-picker.png) |
| B. Equip Sword B | Tombol Equip berhasil; Main ID `v3-job-blade-master-60-fajar-blade`, Off ID `v3-job-blade-master-60-fajar-blade-offhand`. ID berbeda; style `dual_sword`. | [02 — Sword B equipped](../tests/browser/blade-master-offhand-ui-evidence/02-sword-b-equipped.png) |
| B. Character Overview | Kedua slot terisi Dawnblade dan preview karakter membawa dua sword. Twin Assault weapon validity = `VALID`. | [03 — both hands](../tests/browser/blade-master-offhand-ui-evidence/03-both-hands-overview.png) |
| C. K-panel | Detail Twin Assault menampilkan requirement `Dual One-Hand Swords`; nilai internal tetap `dual_sword`. Rank Twin Assault tetap 0. | [04 — requirement](../tests/browser/blade-master-offhand-ui-evidence/04-twin-assault-requirement.png) |
| D. Save/reload | Setelah reload dari `sessionStorage`, kedua slot dan ID tetap sama; seluruh data instance Sword B dibandingkan sebelum/sesudah reload dan sama. | [05 — after reload](../tests/browser/blade-master-offhand-ui-evidence/05-after-isolated-reload.png) |
| E. Mastery loss | Setelah fixture mengembalikan Twin Blade Mastery R1, Sword B dilepas dari Off Hand, tetap ada dalam inventory dengan seluruh data item, dan Sword A tetap di Main Hand. | [06 — safe unequip](../tests/browser/blade-master-offhand-ui-evidence/06-mastery-loss-safe-unequip.png) |

Data hasil mesin tersedia di [validation.json](../tests/browser/blade-master-offhand-ui-evidence/validation.json).

## 10. Diagnostik browser

Playwright Chromium/Chrome dijalankan dalam mode headed, satu browser dan satu halaman, viewport 1600×1050. Hasil run final:

- Console errors: **0**
- Console warnings: **0**
- Page errors: **0**
- Failed requests: **0**
- HTTP 4xx/5xx yang terpantau: **0**

## 11. Focused tests

Blade Master Offhand UI, Dual Wield, Blade Master 7A/7B, Character Screen, dan save/equipment (`rules.test.ts`): **51 passed / 0 failed**.

Headed UI test: **PASS**, termasuk seluruh kasus A–E dan verifikasi boot/save isolation.

## 12. Full regression dan build

- Full `lib/game`: **451 passed / 0 failed**.
- Production build `pnpm run build:vercel`: **PASS**, seluruh lima tahap selesai.
- Output produksi tidak memuat halaman fixture development.

Build mengeluarkan warning bundler vinext terkait dynamic import/chunk size yang sudah terpisah dari fixture. Pemeriksaan `tsc --noEmit` langsung masih gagal pada sejumlah ketidaksesuaian tipe repository lain (`forge-panel`, `skill-action`, beberapa fixture lama, dan lain-lain); tidak ada error yang menunjuk file fixture baru. Pemeriksaan TypeScript tersebut bukan langkah build produksi yang dipakai proyek dan tidak mengubah hasil regresi di atas.

## 13. File fase ini

- `tests/browser/blade-master-offhand-ui.html`
- `tests/browser/blade-master-offhand-ui.tsx`
- `tests/browser/blade-master-offhand-ui.css`
- `tests/browser/blade-master-offhand-ui-verify.mjs`
- `tests/browser/vite.config.ts` (melayani asset `public/` bagi browser test)
- `tests/browser/blade-master-offhand-ui-evidence/` (enam screenshot dan JSON hasil)

Reproduksi lokal:

```powershell
.\node_modules\.bin\vite.CMD --config tests/browser/vite.config.ts --host 127.0.0.1 --port 3002
node tests/browser/blade-master-offhand-ui-verify.mjs
```

**SPV3-8.1 — LIVE UI RUNTIME VALIDATED.** Tidak ada perubahan gameplay atau balance dalam SPV3-8.1A.
