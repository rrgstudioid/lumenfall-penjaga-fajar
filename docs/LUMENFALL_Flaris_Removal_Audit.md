# LUMENFALL — Flaris Removal Audit

Tanggal: 22 September 2026  
Status: **STAGED / PERMANENT DELETION NOT APPROVED**

## Ringkasan

Audit read-only dilakukan sebelum cleanup. Artefak eksperimen Flaris yang jelas sudah dipindahkan keluar repository ke:

`C:\LUMENFALL_BACKUP_FLARIS\`

Tidak ditemukan production import menuju eksperimen Flaris dari:

- `lib/`
- `app/`
- `components/`
- `package.json`
- `vite.config.ts`

Namun masih ada referensi historis/provenance dan script prototype yang menunjuk ke path lama. Karena itu permanent deletion belum dilakukan.

## 1. Artefak yang dipindahkan ke backup

| Kategori | Path asal | Status |
|---|---|---|
| Generated/imported experiment | `dev-imports/flyff-flaris/` | Dipindahkan |
| Public experiment assets | `public/dev-imports/flyff-flaris/` | Dipindahkan |
| Browser test | `tests/browser/flaris-fidelity.tsx` | Dipindahkan |
| Browser test | `tests/browser/flaris-fidelity.html` | Dipindahkan |
| Browser test | `tests/browser/flaris-fidelity.css` | Dipindahkan |
| Browser verifier | `tests/browser/flaris-fidelity-verify.mjs` | Dipindahkan |
| Browser proof assets | `tests/browser/f3a-assets/` | Dipindahkan |
| Flaris-derived staging script | `scripts/prepare-capital-textures.py` | Dipindahkan |

Total backup: **411 file / 35,89 MB**.

Backup bersifat recoverable. Tidak ada file pada `D:\FlyffUS` yang diubah.

## 2. Klasifikasi hasil audit

### Experimental-only files

- `dev-imports/flyff-flaris/`
- `public/dev-imports/flyff-flaris/`
- `tests/browser/flaris-fidelity.*`
- `tests/browser/f3a-assets/`
- `scripts/prepare-capital-textures.py`

Semua sudah dipindahkan ke backup eksternal.

### Test/browser files

File Flaris fidelity sudah dipindahkan. Beberapa test terrain/capital masih memiliki teks pemeriksaan atau provenance yang menyebut Flyff, tetapi tidak mengimpor asset Flaris runtime.

### Generated assets

Asset `.o3d`, `.lnd`, `.dds`, parser output, catalog, dan proof viewer berada di backup eksternal. Tidak ada asset tersebut yang tersisa di path project eksperimen asal.

### Documentation

Dokumentasi audit Flaris tetap dipertahankan sebagai histori dan provenance. Dokumentasi tidak dimuat oleh production runtime.

### Production code references

Audit terhadap `lib/`, `app/`, dan `components/` menghasilkan **NONE** untuk:

`Flaris`, `Flyff`, `flyff-flaris`, `flaris-fidelity`, `WdMadrigal`, `.o3d`, `.lnd`, dan `D:/FlyffUS`.

`lib/game/world.ts`, `lib/game/regions.ts`, terrain LUMENFALL, CFV3, SPV3, Warrior, dan Stun tidak diubah.

### Package/Vite/test configuration

Tidak ada referensi Flaris pada `package.json` atau `vite.config.ts`. Referensi yang tersisa berada pada artefak dokumentasi, evidence/provenance prototype, dan beberapa script verifier dev-only.

## 3. Referensi yang masih tersisa

Referensi residual utama:

- `dev-prototypes/lumenfall-terrain-prototype-01/build.mjs` menunjuk pada heightfield Flaris-derived lama untuk regenerasi prototype.
- `dev-prototypes/lumenfall-terrain-prototype-01/provenance.json` menyimpan asal-usul riset lama.
- `dev-prototypes/kingdom-capital-v11/textures/provenance.json` menyimpan provenance tekstur Flyff yang sebelumnya diizinkan owner.
- Dokumentasi fase Flaris menyebut `D:\FlyffUS`, `.lnd`, dan `.o3d` sebagai catatan historis.
- `tests/browser/kingdom-capital.html` masih memiliki label development tentang tekstur Flyff.

Referensi tersebut bukan production import, tetapi sebagian script prototype tidak lagi dapat membangun ulang output lama karena input sudah berada di backup. Ini alasan permanent deletion ditahan.

## 4. Production imports sebelum dan sesudah cleanup

### Sebelum

Tidak ditemukan import Flaris dari production code. Yang ada adalah import pada browser fidelity experiment dan path staging/dev prototype.

### Sesudah

Tidak ditemukan import Flaris dari `lib/`, `app/`, `components/`, `package.json`, atau `vite.config.ts`.

## 5. Cache yang dibersihkan

Cache berikut dibersihkan:

- `node_modules/.vite/`
- `node_modules/.vite-stun-smoke/`
- `node_modules/.vite-temp/`
- `node_modules/.vite-warrior-world/`
- `tests/browser/dist/`

Dependency umum tidak dihapus.

## 6. Development server dan memory

Mode yang diuji:

`LUMENFALL_LIGHT_DEV=1 vinext dev --host 127.0.0.1 --port 3013`

Hasil:

- server berhasil start;
- route `/` merespons HTTP 200;
- initial compile sekitar 4,7 detik;
- setelah compile, proses Node terbesar sekitar **1,17 GB working set**;
- tidak terjadi lonjakan 31 GB pada pengujian ini.

Angka 31 GB sebelumnya kemungkinan berasal dari transform/pre-bundling graph besar atau beberapa server/cache yang berjalan bersamaan. Cleanup Flaris mengurangi footprint repository, tetapi bukan satu-satunya faktor memory Vite karena production runtime LUMENFALL memiliki graph besar sendiri.

## 7. Regression tests

Full `lib/game` setelah staging cleanup:

- **399 passed**
- **0 failed**

Tidak ada perubahan pada gameplay code.

## 8. Keputusan permanent deletion

**DITAHAN.**

Alasan:

1. Tidak ada production dependency, jadi runtime production aman dari sisi import.
2. Masih ada dev prototype rebuild scripts dan provenance lama yang menunjuk ke artefak Flaris.
3. Backup eksternal sudah cukup untuk menjaga kemampuan recovery.
4. User meminta permanent deletion hanya setelah regression dan game normal; tahap staging sudah lolos, tetapi cleanup residual references belum dilakukan.

Permanent deletion dapat dilakukan pada fase terpisah setelah owner menyetujui penghapusan histori/prototype references yang tersisa.
