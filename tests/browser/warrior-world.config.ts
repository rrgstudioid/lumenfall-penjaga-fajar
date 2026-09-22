import { mergeConfig, defineConfig } from 'vite';
import base from './vite.config';
import { fileURLToPath } from 'node:url';
// Separate localhost-only server. This is not an application route or a production flag.
export default mergeConfig(
  base,
  defineConfig({
    cacheDir: '../../node_modules/.vite-warrior-world',
    resolve: { dedupe: ['react', 'react-dom'] },
    optimizeDeps: {
      entries: ['warrior-world.html'],
      include: [
        'react',
        'react-dom/client',
        '@base-ui/react/progress',
        '@base-ui/react/slider',
        '@base-ui/react/dialog',
        '@base-ui/react/alert-dialog',
      ],
    },
    publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
    server: { port: 3003, host: '127.0.0.1', strictPort: true },
  }),
);
