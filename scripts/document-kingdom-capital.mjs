import fs from 'node:fs';
import path from 'node:path';
import {
  height,
  inside,
  roadDistance,
  perimeter,
  roads,
  districts,
  pathLength,
} from '../tests/browser/kingdom-capital-layout.ts';
const out = path.resolve('dev-prototypes/kingdom-capital-v11'),
  read = (name) =>
    JSON.parse(fs.readFileSync(path.join(out, 'evidence', name), 'utf8'));
const layout = read('layout-runtime.json'),
  runtime = read('browser-result.json'),
  walk = read('populated-walk-result.json');
let area = 0,
  unassigned = 0,
  cliffs = 0;
for (let x = -340; x <= 340; x += 4)
  for (let z = -375; z <= 335; z += 4) {
    if (!inside(x, z)) continue;
    area += 16;
    const use =
      roadDistance(x, z) < 3 ||
      layout.buildings.some(
        (b) =>
          Math.abs(b.x - x) < b.width / 2 + 3 &&
          Math.abs(b.z - z) < b.depth / 2 + 3,
      ) ||
      Math.hypot(x, z - 20) < 55 ||
      Math.hypot((x - 35) / 83, (z + 310) / 83) < 1 ||
      (x > 19 && x < 95 && z > 157 && z < 227) ||
      (x > 173 && x < 227 && z > 220 && z < 270);
    if (use) continue;
    if (
      Math.hypot(
        height(x + 2, z) - height(x - 2, z),
        height(x, z + 2) - height(x, z - 2),
      ) /
        4 >
      0.35
    ) {
      cliffs += 16;
      continue;
    }
    unassigned += 16;
  }
const density = {
  method:
    '4m grid proxy: building footprints +3m yards; paved roads +3m shoulder; civic court, castle precinct, populated market/craft yards; steep slopes >0.35 excluded. Not a perceptual quality score.',
  interiorM2: area,
  unassignedM2: unassigned,
  cliffM2: cliffs,
  unassignedPercent: (100 * unassigned) / area,
};
const manifest = {
  id: 'lumenfall-kingdom-capital-v11',
  status: 'DEVELOPMENT_PROTOTYPE_OWNER_REVIEW',
  name: 'Ibu Kota Mahkota Fajar',
  production: false,
  origin:
    'new authored height function; no F4/Flaris heightfield or object placements',
  dimensionsMetres: [1600, 1600],
  cityBoundsMetres: [680, 710],
  tiersMetres: [10, 38, 82, 128],
  ...runtime.metrics,
  totalBuildingAssemblies: runtime.metrics.buildings + 1,
  houseAssemblies: runtime.metrics.buildings,
  castleHeroAsset: 'MODULAR_MASSING_PLACEHOLDER',
  perimeter,
  roads,
  districts,
  density,
  walking: walk.traversalResults.map((r) => ({
    route: r.name,
    seconds: r.elapsed,
    simulationSeconds: r.simulationSeconds,
    distance: r.distance,
  })),
  walkingTotalSeconds: walk.traversalResults.reduce((n, r) => n + r.elapsed, 0),
  footnote:
    'Walking total is movement time; excludes QA pause at plaza. No teleport between the two legs. Generated service alley snippets are excluded from named road length. Counts are placements, not distinct source assets.',
  assetUse: layout.assets,
  materials:
    '23 scene materials excludes actual player runtime materials; source provenance retained in textures/provenance.json',
  collision:
    'Analytical authored heightfield + OBB exterior colliders, 32m lookup cells. Continuous ramp traversal for visible stair treads.',
  streaming:
    'All selected geometry loaded once. 128m instanced render batches + frustum/distance visibility; not asynchronous asset streaming.',
  gameplay:
    'NONE; memory-only test hero; no region/progression/save registration',
};
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
);
// Neutral reference heightfield. The isolated runtime uses the exact authored analytic function.
const samples = new Float32Array(401 * 401);
for (let z = 0; z <= 400; z++)
  for (let x = 0; x <= 400; x++)
    samples[z * 401 + x] = height(-800 + x * 4, -800 + z * 4);
fs.writeFileSync(path.join(out, 'height.f32le'), Buffer.from(samples.buffer));
fs.writeFileSync(
  path.join(out, 'heightfield.json'),
  JSON.stringify(
    {
      format: 'Float32 little endian',
      width: 401,
      height: 401,
      spacing: 4,
      origin: [-800, -800],
      axes: 'Y up, row +Z / column +X',
      source: 'kingdom-capital-layout.ts authored function',
      renderResolution: 4,
      collision: 'Exact continuous function, not this resampled export',
    },
    null,
    2,
  ),
);
const scale = 0.83,
  ox = 690,
  oy = 560,
  P = (p) => `${ox + p[0] * scale},${oy + p[1] * scale}`;
const colors = ['#8b9875', '#a8aa7a', '#b9ad80', '#cfc19a'];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1200"><rect width="1440" height="1200" fill="#142720"/><text x="55" y="58" fill="#ecdcb8" font-size="30" font-family="Georgia">MAHKOTA FAJAR · DISTRICT FRAMEWORK</text><text x="55" y="89" fill="#b0c3b5" font-size="15" font-family="sans-serif">1,600 × 1,600 m landscape · 680 × 710 m fortified footprint · local development only</text>`;
// Actual authored contours and actual placed houses, not an unrelated conceptual diagram.
for (let z = -380; z < 350; z += 8)
  for (let x = -350; x < 350; x += 8)
    if (inside(x, z)) {
      const h = height(x, z),
        tier = h < 24 ? 0 : h < 60 ? 1 : h < 105 ? 2 : 3;
      svg += `<rect x="${ox + x * scale}" y="${oy + z * scale}" width="7" height="7" fill="${colors[tier]}"/>`;
    }
for (const b of layout.buildings)
  svg += `<rect x="${ox + (b.x - b.width / 2) * scale}" y="${oy + (b.z - b.depth / 2) * scale}" width="${b.width * scale}" height="${b.depth * scale}" fill="#5c5848" opacity=".55"/>`;
for (const r of roads)
  svg += `<polyline points="${r.points.map(P).join(' ')}" fill="none" stroke="${r.stairs ? '#d95838' : r.kind === 'outer' ? '#a68e60' : '#f7e3a7'}" stroke-width="${Math.max(3, r.width * scale)}" ${r.stairs ? 'stroke-dasharray="3 4"' : ''} stroke-linejoin="round"/>`;
svg += `<polygon points="${perimeter.map(P).join(' ')}" fill="none" stroke="#f0d8ad" stroke-width="5"/>`;
for (const d of districts) {
  const x = ox + d.x * scale,
    y = oy + d.z * scale;
  svg += `<circle cx="${x}" cy="${y}" r="7" fill="#193b33" stroke="#fff0cf" stroke-width="2"/><rect x="${x - 83}" y="${y - 37}" width="166" height="23" rx="3" fill="#142720"/><text x="${x}" y="${y - 21}" text-anchor="middle" fill="#fff0cf" font-size="12" font-family="sans-serif">${d.name.replace(' · hero placeholder', '')}</text>`;
}
svg += `<g font-family="sans-serif" fill="#eadcbd" font-size="16"><text x="60" y="260">CITY WALL / TOWERS</text><text x="60" y="295">T1 Lower city · 10 m</text><text x="60" y="325">T2 Civic terrace · 38 m</text><text x="60" y="355">T3 Upper city · 82 m</text><text x="60" y="385">T4 Castle plateau · 128 m</text><text x="60" y="445" fill="#e99676">Red ladder = stair system</text><text x="60" y="475">Light = principal / district roads</text><text x="60" y="505">Ochre = outer roads</text><text x="60" y="565">MARKET = Pasar Lonceng</text><text x="60" y="595">CRAFT = Distrik Bara</text><text x="60" y="625">RESIDENTIAL = Permukiman</text><text x="60" y="655">UPPER CITY = Teras Dewan</text><text x="60" y="685">CASTLE = Benteng Fajar</text></g><path d="M1290 195v-70m-8 15 8-15 8 15" stroke="#eadcbd" fill="none" stroke-width="3"/><text x="1282" y="114" fill="#eadcbd" font-family="sans-serif" font-size="18">N</text><path d="M1110 1000h166m-166-6v12m166-12v12" stroke="#eadcbd" stroke-width="3"/><text x="1160" y="1030" fill="#eadcbd" font-family="sans-serif">200 m</text><text x="60" y="1130" fill="#b0c3b5" font-family="sans-serif" font-size="16">Original layout, not the reference image's roads or building coordinates. Castle massing remains a future hero-asset replacement.</text></svg>`;
fs.writeFileSync(path.join(out, 'district-diagram.svg'), svg);
const names = fs
  .readdirSync(path.join(out, 'evidence'))
  .filter((n) => /^\d\d-.*\.png$/.test(n));
fs.writeFileSync(
  path.join(out, 'review.html'),
  `<!doctype html><html lang="id"><meta charset="utf-8"><title>Mahkota Fajar — Review</title><style>body{background:#142720;color:#eadcbd;font:16px system-ui;max-width:1500px;margin:40px auto;padding:24px}img{width:100%;height:auto}section{margin:40px 0}a{color:#aadecc}h1{font:40px Georgia}</style><h1>Mahkota Fajar · Framework V1.1</h1><p>Development prototype. ${manifest.totalBuildingAssemblies} rakitan bangunan termasuk keep placeholder. Tidak dipublish.</p><p><a href="/tests/browser/kingdom-capital.html">Buka kota playable</a> · <a href="manifest.json">Metrik &amp; layout</a></p><section><h2>Diagram distrik</h2><img src="district-diagram.svg"></section>${names.map((n) => `<section><h2>${n.replace('.png', '')}</h2><img loading="lazy" src="evidence/${n}"></section>`).join('')}</html>`,
);
console.log(
  JSON.stringify(
    {
      manifest: manifest.totalBuildingAssemblies,
      density,
      walking: manifest.walking,
      walkingTotal: manifest.walkingTotalSeconds,
    },
    null,
    2,
  ),
);
