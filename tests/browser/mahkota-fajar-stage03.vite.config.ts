import { defineConfig } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
const assetRoot = resolve('dev-prototypes/mahkota-fajar-stage03-v1/assets');
export default defineConfig({
  root: resolve('.'),
  define: { 'process.env': {} },
  server: { host: '127.0.0.1', port: 3013, strictPort: true, hmr: false },
  plugins: [
    {
      name: 'local-stage03-assets',
      configureServer(server) {
        server.middlewares.use('/stage03-assets/', (req, res, next) => {
          const path = resolve(
            assetRoot,
            decodeURIComponent((req.url ?? '').split('?')[0]).replace(
              /^\/+/,
              '',
            ),
          );
          if (!path.startsWith(assetRoot + sep) || !existsSync(path)) {
            res.statusCode = 404;
            res.end('Stage03 asset missing');
            return;
          }
          res.setHeader(
            'Content-Type',
            path.endsWith('.json')
              ? 'application/json'
              : path.endsWith('.png')
                ? 'image/png'
                : 'model/gltf-binary',
          );
          if (path.endsWith('.gz')) res.setHeader('Content-Encoding', 'gzip');
          createReadStream(path).on('error', next).pipe(res);
        });
      },
    },
  ],
  build: {
    copyPublicDir: false,
    outDir: 'dev-prototypes/mahkota-fajar-stage03-v1/build',
    emptyOutDir: false,
    rolldownOptions: { input: 'tests/browser/mahkota-fajar-stage03.html' },
  },
});
