import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
/** Explicit development-only assets: nothing is copied to a production build. */
export function sunkenDevAssets(): Plugin {
  return {
    name: 'lumenfall-sunken-development-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__sunken-dev/', async (req, res, next) => {
        const file = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (
          ![
            'kit.glb',
            'manifest.json',
            'realism/marine-kit.glb',
            'realism/sand-albedo.png',
            'realism/coral-albedo.png',
            'realism/manifest.json',
            'revision3/ruins-reef-kit.glb',
            'revision3/limestone-albedo.png',
            'revision3/manifest.json',
            'revision3/tripo-kit.glb',
            'revision3/tripo-manifest.json',
            'revision6/sunken-shipwreck.glb',
            'revision6/neptune-statue.glb',
            'revision6/ancient-amphora.glb',
            'revision6/sunken-astrolabe.glb',
            'revision12/neptune-statue.glb',
            'revision13/serpent-guardian.glb',
            'revision13/sea-serpent-boss.glb',
          ].includes(file) ||
          !['GET', 'HEAD'].includes(req.method ?? '')
        )
          return next();
        const path = fileURLToPath(
          new URL(
            `../dev-assets/sunken-ruins-underwater-v1/${file}`,
            import.meta.url,
          ),
        );
        try {
          const info = await stat(path);
          res.setHeader(
            'Content-Type',
            file.endsWith('.glb')
              ? 'model/gltf-binary'
              : file.endsWith('.png')
                ? 'image/png'
                : 'application/json',
          );
          res.setHeader('Content-Length', info.size);
          res.setHeader('Cache-Control', 'no-cache');
          if (req.method === 'HEAD') res.end();
          else createReadStream(path).pipe(res);
        } catch {
          res.statusCode = 404;
          res.end(
            'Sunken kit missing. Run scripts/build-sunken-kit.py in the isolated Blender scene.',
          );
        }
      });
    },
  };
}
