import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  appType: 'spa',
  server: { host: '127.0.0.1', port: 3016, strictPort: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
});
