// Generates only new derived assets. Source libraries and existing maps are read-only.
import * as T from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  mineShell,
  mineCeiling,
  mineBakedLight,
  MINE_ROOMS,
  MINE_CURVES,
  mineLanterns,
  bridgeLocal,
  MINE_BRIDGE,
  MINE_BLOCKERS,
  MINE_LANDMARKS,
  mineGroundHeight,
  mineWallVertex,
} from '../lib/game/ironveil-interior-layout.ts';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend?.();
    });
  }
};
const out = 'public/assets/maps/ironveil-mines-interior-v1';
await mkdir(out, { recursive: true });
const root = new T.Group();
root.name = 'Ironveil Interior — closed shell';
const materials = {
  floor: new T.MeshBasicMaterial({ name: 'mine-floor', vertexColors: true }),
  rock: new T.MeshBasicMaterial({ name: 'mine-rock', vertexColors: true }),
  bridge: new T.MeshBasicMaterial({ name: 'mine-bridge', vertexColors: true }),
};
const cells = new Map(),
  baked = new Map();
function light(p) {
  const key = `${Math.round(p.x * 2)},${Math.round(p.y * 2)},${Math.round(p.z * 2)}`;
  if (!baked.has(key)) baked.set(key, mineBakedLight(p));
  return baked.get(key);
}
function add(kind, a, b, c) {
  const cx = Math.floor(((a.x + b.x + c.x) / 3 + 500) / 50),
    cz = Math.floor(((a.z + b.z + c.z) / 3 + 500) / 50),
    key = `${cx}:${cz}:${kind}`;
  if (!cells.has(key))
    cells.set(key, { cx, cz, kind, position: [], color: [], uv: [] });
  const cell = cells.get(key);
  for (const p of [a, b, c]) {
    cell.position.push(p.x, p.y, p.z);
    cell.color.push(...light(p));
    cell.uv.push(p.x * 0.12, p.z * 0.12);
  }
}
const shell = mineShell();
for (const tri of shell.floors) {
  const center = {
      x: tri.reduce((s, p) => s + p.x, 0) / 3,
      z: tri.reduce((s, p) => s + p.z, 0) / 3,
    },
    b = bridgeLocal(center);
  add(
    Math.abs(b.along) < 14 && Math.abs(b.across) < 9.2 ? 'bridge' : 'floor',
    ...tri,
  );
  const ceiling = tri.map((p) => ({ ...p, y: mineCeiling(p.x, p.z) }));
  add('rock', ceiling[0], ceiling[2], ceiling[1]);
}
// Continuous strata. Bottom/top use EXACT floor and ceiling boundary vertices.
for (const [a, b] of shell.boundary) {
  const bridgeEdge = bridgeLocal({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  if (Math.abs(bridgeEdge.along) < 16 && Math.abs(bridgeEdge.across) < 12)
    continue;
  const levels = 7;
  const at = mineWallVertex;
  for (let i = 0; i < levels; i++) {
    const p = at(a, i / levels),
      q = at(b, i / levels),
      r = at(a, (i + 1) / levels),
      s = at(b, (i + 1) / levels);
    add('rock', p, q, r);
    add('rock', q, s, r);
  }
}
// Rock fissure around the wooden deck. Its bottom is decorative, never navigable.
const bridgeY = mineGroundHeight(MINE_BRIDGE.x, MINE_BRIDGE.z);
const pit = (along, across, y) => ({
  x: MINE_BRIDGE.x + (along + across) / Math.SQRT2,
  z: MINE_BRIDGE.z + (-along + across) / Math.SQRT2,
  y: bridgeY + y,
});
const quad = (a, b, c, d) => {
  add('rock', a, b, c);
  add('rock', b, d, c);
};
quad(
  pit(-16, -24, -18),
  pit(16, -24, -18),
  pit(-16, 24, -18),
  pit(16, 24, -18),
);
for (const side of [-1, 1]) {
  quad(
    pit(-16, side * 24, -18),
    pit(16, side * 24, -18),
    pit(-16, side * 24, 30),
    pit(16, side * 24, 30),
  );
  quad(
    pit(-16, side * 9, 30),
    pit(16, side * 9, 30),
    pit(-16, side * 24, 30),
    pit(16, side * 24, 30),
  );
  for (const end of [-1, 1])
    quad(
      pit(end * 16, side * 9, -18),
      pit(end * 16, side * 24, -18),
      pit(end * 16, side * 9, 30),
      pit(end * 16, side * 24, 30),
    );
}
let triangles = 0;
for (const [key, cell] of cells) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(cell.position, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(cell.color, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(cell.uv, 2));
  // Smooth normals across shared strata faces; baked illumination remains authored per vertex.
  const merged = mergeVertices(g, 0.005);
  merged.computeVertexNormals();
  g.dispose();
  triangles += merged.index.count / 3;
  const mesh = new T.Mesh(merged, materials[cell.kind]);
  mesh.name = `cell:${key}`;
  mesh.userData = { cellX: cell.cx, cellZ: cell.cz, surface: cell.kind };
  root.add(mesh);
}
const binary = await new GLTFExporter().parseAsync(root, {
  binary: true,
  onlyVisible: false,
});
await writeFile(`${out}/cave-shell.glb`, Buffer.from(binary));
const hash = createHash('sha256').update(Buffer.from(binary)).digest('hex');
const manifest = {
  id: 'ironveil-mines-interior-v1',
  generator: 'scripts/prepare-ironveil-interior.mjs',
  footprint: [1000, 1000],
  floorArea: shell.area,
  triangles,
  cells: cells.size,
  bytes: binary.byteLength,
  sha256: hash,
  lighting:
    'Offline vertex bake: warm lantern falloff with floor-domain occlusion; no sky contribution',
  rooms: MINE_ROOMS,
  blockers: MINE_BLOCKERS,
  landmarks: MINE_LANDMARKS,
  routes: MINE_CURVES,
  lanterns: mineLanterns(),
  reusedAssets: [
    '/assets/maps/ironveil-mines-exterior-v1/crate.glb',
    '/assets/maps/ironveil-mines-exterior-v1/barrel.glb',
    '/assets/maps/ironveil-mines-exterior-v1/owner-rock-01.glb',
    '/assets/maps/verdant-plains-v2/dirt.webp',
    '/assets/maps/verdant-plains-v2/wood.webp',
  ],
  sources: [],
};
for (const url of manifest.reusedAssets) {
  const data = await readFile(`public${url}`);
  manifest.sources.push({
    url,
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  });
}
await writeFile(
  `${out}/provenance.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    triangles,
    cells: cells.size,
    bytes: binary.byteLength,
    floorArea: shell.area,
    lanterns: manifest.lanterns.length,
  }),
);
