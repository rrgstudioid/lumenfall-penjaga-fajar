// Verify the official archive against the FROZEN lock, then every installed file.
// Read-only: this script never installs, extracts or changes node_modules.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import ts from 'typescript';

const out = 'outputs/gameplay-migration/vinext-recovery';
const archive = readFileSync(out + '/vinext-1.0.0-beta.5.tgz');
const expected = readFileSync('pnpm-lock.yaml', 'utf8').match(/  vinext@1\.0\.0-beta\.5:\s+resolution: \{integrity: ([^}]+)\}/)?.[1];
const actual = 'sha512-' + createHash('sha512').update(archive).digest('base64');
assert.equal(actual, expected, 'Archive must match lock integrity before comparison');
const tar = gunzipSync(archive);
const files = [];
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512);
  const name = header.subarray(0, 100).toString().split('\0')[0];
  if (!name) break;
  const size = parseInt(header.subarray(124, 136).toString().replaceAll('\0', '').trim(), 8);
  assert(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length);
  if (header[156] === 48 || header[156] === 0) {
    assert(name.startsWith('package/') && !name.split('/').includes('..'));
    const relative = name.slice('package/'.length);
    const installed = 'node_modules/vinext/' + relative;
    files.push({ relative, matches: existsSync(installed) && readFileSync(installed).equals(tar.subarray(offset + 512, offset + 512 + size)) });
  }
  offset += 512 + Math.ceil(size / 512) * 512;
}
const declaration = readFileSync('node_modules/vinext/dist/index.d.ts', 'utf8');
const parseDiagnostics = ts.createSourceFile('index.d.ts', declaration, ts.ScriptTarget.Latest, true).parseDiagnostics.map(d => ({ code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
const before = readFileSync(out + '/baseline/installed-index.d.ts.txt', 'utf8');
const result = { expected, actual, integrityVerified: true, filesCompared: files.length,
  different: files.filter(f => !f.matches), parseDiagnostics,
  originalDiffWasSingleBacktick: before.replace('function `vinext', 'function vinext') === declaration,
  installedVersion: JSON.parse(readFileSync('node_modules/vinext/package.json', 'utf8')).version,
};
writeFileSync(out + '/restored-package.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
assert.equal(result.installedVersion, '1.0.0-beta.5');
assert.equal(result.filesCompared, 925);
assert.equal(result.different.length, 0);
assert.equal(result.parseDiagnostics.length, 0);
assert(result.originalDiffWasSingleBacktick);
