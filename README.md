# LUMENFALL

Prototipe game 3D berbasis browser. Dokumentasi utama untuk developer baru: [docs/for-new-developers.md](docs/for-new-developers.md).

Prasyarat: Node.js >=22.13.0, Git, dan pnpm yang kompatibel dengan `pnpm-lock.yaml` (lockfile v9).

```text
pnpm install --frozen-lockfile
pnpm dev --host localhost --port 3000
```

Buka `http://localhost:3000/`. Jalankan regression dengan `node --test lib/game/*.test.ts` dan build dengan `pnpm build`. Karakter saat ini disimpan di browser lokal; push GitHub bukan deploy ke Site publik.
