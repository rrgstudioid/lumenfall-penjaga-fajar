# Menjalankan LUMENFALL di Vercel

LUMENFALL menggunakan Vinext. Jalur ChatGPT Site/Cloudflare tetap menggunakan
`pnpm run build` dan plugin Sites/Cloudflare. Jalur Vercel memilih Vinext +
Nitro saat Vercel menetapkan `VERCEL=1`, lalu menjalankan
`pnpm run build:vercel`. Kedua jalur memakai kode game yang sama, tetapi
adapter deploy dan keluaran build berbeda.

## Pengaturan proyek Vercel

1. Hubungkan repository `rrgstudioid/lumenfall-penjaga-fajar`, branch produksi
   `main`, ke proyek Vercel.
2. Buka **Settings → Build and Deployment**. Pastikan **Root Directory** adalah
   akar repository (`./`), bukan `app`, `public`, atau `dist`.
3. Pilih **Framework Preset: Nitro**. `vercel.json` di repository juga menetapkan
   framework ini dan perintah build `pnpm run build:vercel`; jangan gunakan
   preset Vite statis.
4. Pastikan **Build Command** adalah `pnpm run build:vercel` dan **Install
   Command** memakai `pnpm install --frozen-lockfile` jika perlu override.
5. Kosongkan/nonaktifkan override **Output Directory**. Khusus adapter ini,
   Nitro membuat `.vercel/output` sesuai Vercel Build Output API. Jangan isi
   `dist`, `.output`, atau `public` sebagai output directory.
6. Di **Settings → General**, gunakan Node.js 24.x jika pilihan itu tersedia.
   Project memerlukan Node >=22.13 dan build lokal diverifikasi pada Node 24.
7. Buka **Deployments**, deploy ulang commit `main` terbaru. Jika pengaturan
   lama masih terbawa, pilih redeploy tanpa build cache.

Build yang benar akan menampilkan lingkungan Vinext, kemudian Nitro preset
`vercel`, dan menghasilkan `.vercel/output/config.json`,
`.vercel/output/functions/__server.func`, serta aset statis di
`.vercel/output/static`. Halaman `/` harus dilayani fungsi server dan
`/favicon.svg` oleh aset statis. HTML saja tidak cukup untuk menyatakan game
berjalan; uji juga navigasi, panel, dan fungsi permainan di browser.

## Pemeriksaan lokal

```powershell
pnpm install --frozen-lockfile
$env:LUMENFALL_DEPLOY_TARGET = 'vercel'
$env:NITRO_PRESET = 'vercel'
pnpm run build:vercel
```

Variabel di atas hanya untuk meniru target Vercel pada komputer lokal.
Vercel sendiri menetapkan `VERCEL=1`; Nitro mendeteksi preset-nya otomatis.
Untuk memastikan jalur ChatGPT Site tetap sehat, jalankan `pnpm run build`
tanpa variabel Vercel. Perintah itu tetap menghasilkan `dist/server/wrangler.json`
dan `dist/client`.

Push ke GitHub dapat memicu deployment Vercel, tetapi **tidak** memperbarui
ChatGPT Site secara otomatis. Publikasi Site tetap memakai proses dan
persetujuan terpisah.
