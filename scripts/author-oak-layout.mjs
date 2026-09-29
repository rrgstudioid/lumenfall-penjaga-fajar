// Offline authoring only: deterministic, constrained groves, never runtime RNG.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as L from '../lib/game/verdant-plains-layout.ts';
const baseline = JSON.parse(
  await readFile('tests/fixtures/oak/legacy-layout.json', 'utf8'),
);
await mkdir('output/oak', { recursive: true });
const zones = [
  ['camp', [60, 210, 335, 630], [170, 350], [6, 3]],
  ['northwest', [90, 425, 60, 290], [290, 100], [8, 6, 3]],
  ['central-west', [230, 455, 295, 555], [355, 540], [6, 4, 3]],
  ['averion', [445, 740, 35, 185], [600, 95], [8, 3]],
  ['clearing-east', [680, 820, 200, 385], [730, 290], [6, 3]],
  ['northeast', [760, 900, 60, 195], [810, 145], [6, 3]],
  ['southeast', [690, 885, 540, 790], [835, 645], [12, 3]],
  ['coast', [340, 670, 665, 810], [420, 790], [6, 3]],
];
let seed = 71943100;
const rnd = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const decor = baseline.props.filter(
  (p) => p.kind === 'rock' || p.kind === 'shrub',
);
function valid(p) {
  const R = p.scale * 11.75;
  if (
    !L.plainsWalkable(p, 2) ||
    L.plainsRoadDistance(p) < R + 4 ||
    L.plainsRiverDistance(p) < R + 6 ||
    L.plainsCoast(p.x) - p.z < R + 10 ||
    L.plainsSafe(p, R + 20) ||
    Math.hypot(p.x - L.PLAINS_EXIT.x, p.z - L.PLAINS_EXIT.z) < R + 30 ||
    Math.hypot(p.x - L.PLAINS_CLEARING.x, p.z - L.PLAINS_CLEARING.z) < R + 68 ||
    L.PLAINS_POCKETS.some(
      (q) => Math.hypot(p.x - q.x, p.z - q.z) < q.radius + R + 8,
    )
  )
    return false;
  if (baseline.spawns.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 10))
    return false;
  if (
    decor.some(
      (q) =>
        Math.hypot(p.x - q.x, p.z - q.z) <
        p.scale * 0.9 + (q.kind === 'rock' ? q.radius : 1.4 * q.scale),
    )
  )
    return false;
  const h = L.plainsTerrainHeight(p.x, p.z);
  return Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4).every(
    (a) =>
      Math.abs(
        L.plainsTerrainHeight(p.x + Math.cos(a) * 2, p.z + Math.sin(a) * 2) - h,
      ) <=
      Math.tan(Math.PI / 15) * 2,
  );
}
const landmarks = zones.map(([zone, , [u, v]]) => ({
  ...L.plainsPoint(u, v),
  scale: 1.18,
  zone,
  group: zone + '-landmark',
  landmark: true,
}));
for (const p of landmarks)
  if (!valid(p)) throw Error('Landmark conflict: ' + p.zone);
const compatible = (a, b) =>
  Math.hypot(a.x - b.x, a.z - b.z) >=
  (a.scale + b.scale) * 11.75 * (a.group === b.group ? 0.8 : 1) +
    (a.group === b.group ? 0 : 30);
const pools = zones.map(([zone, [a, b, c, d]]) => {
  const pool = [];
  for (let i = 0; i < 22000; i++) {
    const p = {
      ...L.plainsPoint(a + rnd() * (b - a), c + rnd() * (d - c)),
      scale: 0.86 + rnd() * 0.3,
      zone,
      landmark: false,
    };
    if (valid(p) && landmarks.every((q) => compatible(p, q))) pool.push(p);
  }
  console.log('Candidate pool', zone, pool.length);
  return pool;
});
let solution;
// Restart complete compositions, without changing quotas, anchors or exclusions.
for (let attempt = 0; attempt < 150 && !solution; attempt++) {
  const placed = [...landmarks];
  let failed = false;
  for (const zi of [6, 2, 3, 4, 5, 0, 7, 1]) {
    const [zone, , , sizes] = zones[zi],
      pool = pools[zi];
    for (let gi = 0; gi < sizes.length; gi++) {
      const n = sizes[gi],
        group = zone + '-grove-' + (gi + 1);
      let grove;
      for (let tries = 0; tries < 800 && !grove; tries++) {
        const first = { ...pool[Math.floor(rnd() * pool.length)], group };
        if (!placed.every((q) => compatible(first, q))) continue;
        const picked = [first],
          radius = n >= 8 ? 65 : n >= 5 ? 48 : 35;
        const nearby = pool.filter(
          (p) =>
            Math.hypot(p.x - first.x, p.z - first.z) < radius &&
            placed.every((q) => compatible({ ...p, group }, q)),
        );
        while (picked.length < n) {
          let best = null,
            score = Infinity;
          for (const raw of nearby) {
            const p = { ...raw, group };
            if (!picked.every((q) => compatible(p, q))) continue;
            const near = Math.min(
              ...picked.map((q) => Math.hypot(p.x - q.x, p.z - q.z)),
            );
            const s = near + Math.hypot(p.x - first.x, p.z - first.z) * 0.3;
            if (s < score) {
              score = s;
              best = p;
            }
          }
          if (!best) break;
          picked.push(best);
        }
        if (picked.length === n) grove = picked;
      }
      if (!grove) {
        failed = true;
        break;
      }
      placed.push(...grove);
    }
    if (failed) break;
  }
  if (!failed) solution = placed;
  if (attempt % 10 === 0)
    console.log('Composition attempt', attempt, 'placed', placed.length);
}
if (!solution) {
  await writeFile(
    'output/oak/layout-conflicts.json',
    JSON.stringify(
      {
        reason: 'No complete constrained composition',
        zones: zones.map((z, i) => ({
          zone: z[0],
          candidates: pools[i].length,
        })),
      },
      null,
      2,
    ),
  );
  throw Error('No complete layout: constraints were not relaxed');
}
solution.sort(
  (a, b) =>
    zones.findIndex((z) => z[0] === a.zone) -
      zones.findIndex((z) => z[0] === b.zone) ||
    a.group.localeCompare(b.group) ||
    a.x - b.x,
);
const candidates = solution.map((p, i) => ({
  ...p,
  id: 'oak-' + String(i + 1).padStart(3, '0'),
  yaw: rnd() * Math.PI * 2,
  variant: i % 3,
  tint: 0.94 + rnd() * 0.12,
  hue: (rnd() - 0.5) * 0.10472,
  windPhase: rnd() * Math.PI * 2,
  radius: 0.9 * p.scale,
  canopyRadius: 11.75 * p.scale,
}));
// Revised brief: keep 30, enlarge uniformly by 35%, and revalidate clearances.
const quotas = [4, 5, 4, 4, 3, 3, 4, 3];
const enlarged = candidates
  .map((p) => ({
    ...p,
    scale: p.scale * 1.35,
    radius: p.radius * 1.35,
    canopyRadius: p.canopyRadius * 1.35,
  }))
  .filter(valid);
const selected = [];
for (let zi = 0; zi < zones.length; zi++) {
  const zone = zones[zi][0];
  for (let n = 0; n < quotas[zi]; n++) {
    const choices = enlarged.filter(
      (p) =>
        p.zone === zone &&
        !selected.includes(p) &&
        selected.every((q) => compatible(p, q)),
    );
    choices.sort(
      (a, b) =>
        Number(b.landmark) - Number(a.landmark) ||
        Math.min(
          ...selected.map((q) => Math.hypot(b.x - q.x, b.z - q.z)),
          1000,
        ) -
          Math.min(
            ...selected.map((q) => Math.hypot(a.x - q.x, a.z - q.z)),
            1000,
          ),
    );
    if (!choices.length) throw Error('Enlarged oak quota conflict: ' + zone);
    selected.push(choices[0]);
  }
}
const data = selected.map((p, i) => ({
  ...p,
  id: 'oak-' + String(i + 1).padStart(3, '0'),
  variant: i % 3,
}));
await writeFile('output/oak/placements.json', JSON.stringify(data, null, 2));
console.log(
  'COMPLETE',
  data.length,
  Object.fromEntries(
    zones.map(([z]) => [z, data.filter((p) => p.zone === z).length]),
  ),
);
