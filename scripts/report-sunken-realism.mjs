import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const directory = 'output/sunken-ruins/realism';
const original = JSON.parse(
  await readFile(`${directory}/performance.json`, 'utf8'),
);
const optimized = JSON.parse(
  await readFile(`${directory}/performance-optimized.json`, 'utf8'),
);
assert.equal(original.length, 12);
assert.equal(optimized.length, 6);
for (const quality of ['light', 'high']) {
  const rows = optimized.filter((r) => r.quality === quality);
  assert.deepEqual(
    rows.map((r) => r.sample),
    [0, 1, 2],
  );
  assert.ok(
    rows.every(
      (r) => r.diagnostics.capturedAt > original.at(-1).diagnostics.capturedAt,
    ),
  );
}
// Only the two changed policies are replaced. Keep every initial capture on disk.
const final = original.map(
  (r) =>
    optimized.find((o) => o.quality === r.quality && o.sample === r.sample) ??
    r,
);
await writeFile(
  `${directory}/performance-final.json`,
  JSON.stringify(final, null, 2),
);
execFileSync(process.execPath, ['scripts/report-sunken-performance.mjs'], {
  env: { ...process.env, SUNKEN_VISUAL_REPORT: 'realism/performance-final' },
  stdio: 'inherit',
});
