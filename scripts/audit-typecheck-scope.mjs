// Inventory and enforce coverage; no fixture selection or diagnostic suppression.
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { relative } from 'node:path';
import assert from 'node:assert/strict';

const out = 'outputs/gameplay-migration/type-scope';
mkdirSync(out, { recursive: true });
const parse = path => {
  const read = ts.readConfigFile(path, name => ts.sys.readFile(name));
  assert.equal(read.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, '.');
  assert.equal(parsed.errors.length, 0);
  return parsed;
};
const active = parse('tsconfig.json');
const archives = parse('tsconfig.archives.json');
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const trackedTypes = tracked.filter(p => /\.(ts|tsx|mts|cts)$/.test(p));
const trackedSet = new Set(tracked);
const generated = p => p === 'next-env.d.ts' || /^\.next\/(dev\/)?types\//.test(p);
const historical = p => /^(output\/|sites-reconcile-v2\/)/.test(p);
const old = JSON.parse(readFileSync(out + '/baseline/typecheck-roots.json', 'utf8'));
const missingPreviouslyActive = old.filter(r => !historical(r.file) && !active.fileNames.includes(r.file));
const missingTracked = trackedTypes.filter(p => !active.fileNames.includes(p));
const partition = new Set([...active.fileNames, ...archives.fileNames]);
const missingFromPartition = old.filter(r => !partition.has(r.file));
assert.equal(missingPreviouslyActive.length, 0);
assert.equal(missingTracked.length, 0);
assert.equal(missingFromPartition.length, 0);
assert(active.fileNames.every(p => !historical(p)));
assert(archives.fileNames.every(historical));
assert.equal(active.fileNames.filter(p => archives.fileNames.includes(p)).length, 0);
const original = JSON.parse(readFileSync(out + '/baseline/tsconfig.json', 'utf8'));
const current = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
assert.deepEqual(current.compilerOptions, original.compilerOptions, 'Scope change must not relax type checking');
assert.deepEqual(current.exclude, original.exclude);
const roots = active.fileNames.map(file => ({ file, tracked: trackedSet.has(file),
  category: generated(file) ? 'generated' : file.endsWith('.test.ts') || file.startsWith('tests/') ? 'active-test' : 'active-source-or-tool',
}));
const program = ts.createProgram(active.fileNames, { ...active.options, incremental: false });
const included = program.getSourceFiles().map(s => relative(process.cwd(), s.fileName).replaceAll('\\', '/'));
assert(included.every(p => !historical(p)), 'Active imports must not pull historical copies back in');
const archiveGroups = {};
for (const file of archives.fileNames) {
  const group = file.startsWith('output/') ? file.split('/').slice(0, 2).join('/') : 'sites-reconcile-v2';
  (archiveGroups[group] ??= []).push(file);
}
const result = { activeRoots: roots.length, trackedTypeFilesCovered: trackedTypes.length,
  categories: Object.fromEntries(['generated', 'active-test', 'active-source-or-tool'].map(c => [c, roots.filter(r => r.category === c).length])),
  untrackedWork: roots.filter(r => !r.tracked && r.category !== 'generated').map(r => r.file),
  historicalRoots: archives.fileNames.length, historicalGroups: Object.fromEntries(Object.entries(archiveGroups).map(([k,v]) => [k,v.length])),
  compilerOptionsUnchanged: true, missingPreviouslyActive, missingTracked, missingFromPartition,
  actualProgramSourceFiles: included.length, roots, archiveGroups, included,
};
writeFileSync(out + '/scope-inventory.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, roots: undefined, archiveGroups: undefined, included: undefined }, null, 2));
