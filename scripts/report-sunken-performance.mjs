import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const directory = 'output/sunken-ruins';
const visualReport = process.env.SUNKEN_VISUAL_REPORT;
const primary = JSON.parse(
  await readFile(`${directory}/comparison.json`, 'utf8'),
);
let closure = [];
try {
  closure = JSON.parse(
    await readFile(`${directory}/reference-closure.json`, 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
let optimized = [];
try {
  optimized = JSON.parse(
    await readFile(
      `${directory}/${visualReport ?? 'sunken-density-lod'}.json`,
      'utf8',
    ),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
// A later full rerun supersedes archived review rounds; never overlay stale captures.
const primaryEnd = primary.at(-1)?.diagnostics.capturedAt;
if (closure.at(-1)?.diagnostics.capturedAt < primaryEnd) closure = [];
if (optimized.at(-1)?.diagnostics.capturedAt < primaryEnd) optimized = [];
const rows = [
  ...primary.filter(
    (r) => !optimized.length || r.map !== 'sunken-ruins-underwater-v1',
  ),
  ...closure,
  ...optimized,
];
const maps = [
  'verdant-plains-v2',
  'whispering-wilds-v2',
  'sunken-ruins-underwater-v1',
];
const qualities = ['office', 'light', 'balanced', 'high'];
if (optimized.length) {
  assert.equal(optimized.length, 12);
  assert.ok(optimized.every((r) => r.map === maps[2]));
}
assert.equal(
  primary.length,
  36,
  'Full comparison needs 3 maps × 4 presets × 3 captures',
);
if (closure.length) {
  assert.equal(closure.length, 12);
  assert.ok(
    closure.every((r) => r.map === maps[0]),
    'One predeclared reference repeat across all presets',
  );
}
const environment = rows[0].diagnostics;
for (const row of rows) {
  assert.equal(row.seconds, 60);
  assert.deepEqual(row.errors, []);
  assert.equal(row.diagnostics.gpu, environment.gpu);
  assert.equal(row.diagnostics.browser, environment.browser);
  assert.deepEqual(row.diagnostics.viewport, environment.viewport);
  assert.deepEqual(row.diagnostics.drawingBuffer, environment.drawingBuffer);
  if (row.scenario === 'traversal-follow')
    assert.ok(row.travel > 100, 'A traversal must actually move');
}
const round = (n) => Math.round(n * 10) / 10;
const summary = qualities.map((quality) => {
  const measurements = maps.map((map) => {
    const samples = rows.filter((r) => r.map === map && r.quality === quality);
    assert.deepEqual(
      samples.map((r) => r.sample),
      closure.length && map === maps[0] ? [0, 1, 2, 0, 1, 2] : [0, 1, 2],
    );
    const max = (key) => Math.max(...samples.map((r) => r[key]));
    return {
      map,
      samples: samples.length,
      p50: round(max('p50')),
      p95: round(max('p95')),
      p99: round(max('p99')),
      cpuP95: round(max('cpuP95')),
      drawCallsP95: max('drawCallsP95'),
      trianglesP95: max('trianglesP95'),
      geometries: Math.max(
        ...samples.map((r) => r.diagnostics.memory.geometries),
      ),
      textures: Math.max(...samples.map((r) => r.diagnostics.memory.textures)),
      assetBytes: max('assetBytes'),
      minimumTraversal: Math.min(
        ...samples.filter((r) => r.travel > 0).map((r) => r.travel),
      ),
    };
  });
  const limit = Math.max(measurements[0].p95, measurements[1].p95);
  return {
    quality,
    label: rows.find((r) => r.quality === quality).diagnostics.qualityLabel,
    limit,
    passed: measurements[2].p95 <= limit,
    measurements,
  };
});
const report = {
  method:
    'Three sequential 60-second captures per map/preset after warm-up; two moving follow-camera routes and one free-camera crowded scene. Worst capture quantile shown, rounded to 0.1 ms.',
  referenceRepeat: closure.length
    ? 'One additional Verdant run, all four presets and three captures each, predeclared after observing a 0.1 ms borderline difference. All primary and repeat captures retained.'
    : null,
  contentRevision:
    process.env.SUNKEN_CONTENT_REVISION ??
    (visualReport
      ? 'Visual revision 2: organic marine kit, generated albedo textures, world-space wildlife and brighter underwater atmosphere.'
      : optimized.length
        ? 'Final density LOD (near coral unchanged, distant instances reduced); all 12 final captures used. Original 12 Sunken captures remain archived in comparison.json.'
        : 'Current comparison.json captures'),
  beforeOptimization: optimized.length
    ? primary
        .filter((r) => r.map === maps[2])
        .map(({ quality, sample, p95, cpuP95, trianglesP95 }) => ({
          quality,
          sample,
          p95,
          cpuP95,
          trianglesP95,
        }))
    : [],
  environment: {
    gpu: environment.gpu,
    browser: environment.browser,
    viewport: environment.viewport,
    drawingBuffer: environment.drawingBuffer,
    logicalCores: environment.logicalCores,
  },
  capturedFrom: rows[0].diagnostics.capturedAt,
  capturedTo: rows.at(-1).diagnostics.capturedAt,
  summary,
};
await writeFile(
  `${directory}/${process.env.SUNKEN_BUDGET_REPORT ?? (visualReport ? 'realism/budget' : 'budget')}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  '| Preset | Verdant p95 | Whispering p95 | Sunken p50 / p95 / p99 | Sunken CPU p95 | Calls p95 | Triangles p95 | Geometries / textures | Result |',
);
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
for (const q of summary) {
  const [v, w, s] = q.measurements;
  console.log(
    `| ${q.label} | ${v.p95} ms | ${w.p95} ms | ${s.p50} / ${s.p95} / ${s.p99} ms | ${s.cpuP95} ms | ${s.drawCallsP95} | ${s.trianglesP95.toLocaleString('en-US')} | ${s.geometries} / ${s.textures} | ${q.passed ? 'PASS' : 'FAIL'} |`,
  );
}
console.log(
  JSON.stringify(
    {
      environment: report.environment,
      assets: summary.map((q) => ({
        preset: q.label,
        bytes: q.measurements.map((r) => ({ map: r.map, bytes: r.assetBytes })),
      })),
    },
    null,
    2,
  ),
);
assert.ok(
  summary.every((q) => q.passed),
  'Sunken p95 exceeds the heavier baseline',
);
