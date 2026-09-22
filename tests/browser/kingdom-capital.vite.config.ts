import { mergeConfig } from 'vite';
import base from './kingdom-city-kit.vite.config';
export default mergeConfig(base, {
  server: { port: 3007, strictPort: true },
  build: {
    copyPublicDir: false,
    outDir: 'dev-prototypes/kingdom-capital-v11/build',
    emptyOutDir: false,
    rollupOptions: { input: 'tests/browser/kingdom-capital.html' },
  },
});
