import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  define: { 'process.env': '{}' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../..', import.meta.url)),
      'next/image': fileURLToPath(import.meta.resolve('vinext/shims/image')),
    },
  },
  server: { host: '127.0.0.1', port: 3005, strictPort: true, hmr: false },
});
