// Execute whole files, retaining every failure. Scope counts come from NEW events,
// keyed against the frozen pre-run classification; never from projected outcomes.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const recovery = process.argv.includes('--dependency-recovery');
const typeScope = process.argv.includes('--type-scope');
const out = 'outputs/gameplay-migration/' + (typeScope ? 'type-scope' : recovery ? 'vinext-recovery' : 'source-review');
mkdirSync(out, { recursive: true });
const baseline = JSON.parse(readFileSync(out + '/baseline/gameplay-suite-results.json', 'utf8'));
const key = r => r.file.replaceAll('\\', '/').replace(/^.*\/lib\/game\//, 'lib/game/') + '\0' + r.name;
const previous = new Map(baseline.results.map(r => [key(r), r]));
assert.equal(previous.size, baseline.results.length, 'Baseline identities must be unique');
const filesFor = scope => [...new Set(baseline.results.filter(r => r.scope === scope).map(r => r.file))];
const results = [];
async function run(name, args, command = process.execPath) {
  const startedAt = new Date().toISOString();
  const result = await new Promise(resolve => {
    let output = '';
    const child = spawn(command, args, { windowsHide: true, env: process.env });
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('error', error => { output += String(error); });
    child.on('close', exitCode => {
      writeFileSync(out + '/' + name + '.log', output);
      resolve({ name, command, args, startedAt, endedAt: new Date().toISOString(), exitCode,
        summary: output.split('\n').filter(s => /^\u2139 (tests|pass|fail|skipped|todo)/.test(s)) });
    });
  });
  results.push(result);
  writeFileSync(out + '/validation.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
async function tests(name, files) {
  await run(name, ['--disable-warning=ExperimentalWarning', '--experimental-transform-types', '--test',
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=./scripts/gameplay-events.mjs', '--test-reporter-destination=' + out + '/' + name + '.jsonl', ...files]);
  const events = readFileSync(out + '/' + name + '.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  assert(events.every(e => !e.skip && !e.todo), 'No skipped/todo tests permitted');
  assert.equal(new Set(events.map(key)).size, events.length, 'Duplicate test identities');
  const scopes = {};
  for (const event of events) {
    const scope = previous.get(key(event))?.scope ?? 'unclassified';
    const count = scopes[scope] ??= { tests: 0, pass: 0, fail: 0 };
    count.tests++; count[event.status]++;
  }
  const present = new Set(events.map(key));
  const missing = baseline.results.filter(r => files.includes(r.file) && !present.has(key(r))).map(key);
  const newFailures = events.filter(e => e.status === 'fail' && previous.get(key(e))?.status !== 'fail');
  const summary = { actualRun: name, scopes, skipped: 0, todo: 0, missing, newFailures,
    failures: events.filter(e => e.status === 'fail'), results: events.map(e => ({ ...e, scope: previous.get(key(e))?.scope ?? 'unclassified' })) };
  writeFileSync(out + '/' + name + '-results.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ name, scopes, missing, newFailures }));
  assert.equal(missing.length, 0, 'Previously covered test did not execute');
}

if (typeScope) await run('scope-inventory', ['scripts/audit-typecheck-scope.mjs']);
else if (recovery) await run('dependency', ['scripts/verify-phase14-vinext.mjs']);
else {
  await tests('targeted', ['city-layout', 'forge', 'rune-forge'].map(n => 'lib/game/' + n + '.test.ts'));
  await run('dependency', ['scripts/audit-phase14-dependency.mjs']);
}
await tests('contract', ['lib/game/canonical-gameplay.test.ts']);
await tests('acceptance-files', filesFor('gameplay-acceptance'));
await tests('legacy-files', [...new Set([...filesFor('legacy-compatibility'), 'lib/game/canonical-gameplay.test.ts'])]);
await tests('full-suite', readdirSync('lib/game').filter(f => f.endsWith('.test.ts')).map(f => 'lib/game/' + f));
if (typeScope) {
  await run('active-types', ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false']);
  await run('archive-types', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.archives.json', '--noEmit', '--pretty', 'false']);
  await run('workspace-audit', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.workspace-audit.json', '--noEmit', '--pretty', 'false']);
} else await run('build', ['node_modules/vinext/dist/cli.js', 'build']);
await run('scoped-types', ['scripts/check-gameplay-types.mjs']);
await run('scoped-lint', ['node_modules/oxlint/bin/oxlint', 'lib/game', 'components/game', 'scripts/check-gameplay-types.mjs', 'scripts/simulate-gameplay.ts', 'tests/browser/canonical-gameplay.tsx']);
if (!typeScope) await run('full-types', ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false']);
await run('full-lint', ['node_modules/oxlint/bin/oxlint']);
if (typeScope) await run('build', ['node_modules/vinext/dist/cli.js', 'build']);
if (recovery || process.argv.includes('--runtime')) {
  process.env.PHASE14_BROWSER_OUTPUT = out + '/runtime';
  await run('browser-runtime', ['--disable-warning=ExperimentalWarning', '--experimental-transform-types', 'scripts/verify-phase14-runtime.mjs']);
}
await run('world-method', ['scripts/verify-gameplay-world.mjs']);
await run('diff-check', ['-c', 'core.safecrlf=false', 'diff', '--check'], 'git');
// No model changes: retain the 528-run evidence without rerunning identical simulation.
process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
