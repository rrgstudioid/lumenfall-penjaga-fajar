import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import { sunkenDevAssets } from '../../scripts/sunken-dev-assets';
export default defineConfig({
  cacheDir: fileURLToPath(new URL('../../node_modules/.vite-lumenfall-browser-fixture', import.meta.url)),
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [react(), sunkenDevAssets()],
  css: { postcss: { plugins: [tailwindcss()] } },
  define: { 'process.env': '{}' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../..', import.meta.url)),
      'next/image': fileURLToPath(import.meta.resolve('vinext/shims/image')),
    },
  },
  // Freeze each test run. Entry-point HMR can dispose its React root mid-gesture.
  // Reload explicitly after changing test or production source.
  server: { host: '127.0.0.1', port: 3002, strictPort: true, hmr: false },
});
