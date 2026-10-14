import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [react()],
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
