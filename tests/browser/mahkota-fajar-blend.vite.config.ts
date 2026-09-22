import { mergeConfig } from 'vite';
import base from './kingdom-city-kit.vite.config';
export default mergeConfig(base, {
  server: { port: 3008, strictPort: true },
  build: {
    copyPublicDir: false,
    outDir: 'dev-prototypes/mahkota-fajar-blend-v1/build',
    emptyOutDir: false,
    rollupOptions: { input: 'tests/browser/mahkota-fajar-blend.html' },
  },
});
