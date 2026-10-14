// Read-only diagnosis: never rewrites declarations, installs packages or suppresses errors.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const out = 'outputs/gameplay-migration/source-review';
mkdirSync(out, { recursive: true });
const file = 'node_modules/vinext/dist/index.d.ts';
const declaration = readFileSync(file, 'utf8');
const installed = JSON.parse(readFileSync('node_modules/vinext/package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = readFileSync('pnpm-lock.yaml', 'utf8');
const parse = text => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true).parseDiagnostics.map(d => ({
  code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
}));
const result = {
  package: installed.name, requested: manifest.dependencies.vinext, installed: installed.version,
  lockMatchesInstalled: lock.includes(`  vinext@${installed.version}:`),
  lockIntegrity: lock.match(/  vinext@1\.0\.0-beta\.5:\s+resolution: \{integrity: ([^}]+)\}/)?.[1],
  declaration: file, sha256: createHash('sha256').update(declaration).digest('hex'),
  malformedLine: declaration.split('\n')[144], parseDiagnostics: parse(declaration),
  // In-memory syntax experiment only; not fed to tsc, lint, runtime or any test.
  oneByteRemovalParseDiagnostics: parse(declaration.replace('function `vinext', 'function vinext')),
  runtimeHasDefaultExport: readFileSync('node_modules/vinext/dist/index.js', 'utf8').includes('export { vinext as default,'),
  conclusion: 'Installed declaration is syntactically malformed. Version matches manifest and lock; runtime exports default. Origin (local corruption vs published artifact) remains unverified without a pristine integrity-verified artifact. No dependency/config change is justified by local evidence alone.',
  nextStep: 'Obtain the exact beta.5 archive from a trusted package source, verify the lockfile SHA512, compare declaration and package contents. If local corruption, restore with the package manager and frozen lockfile; if published corruption, evaluate a verified upstream fix/version with its peer constraints. Then rerun full types/lint/build and affected runtime.',
};
writeFileSync(out + '/dependency-audit.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.parseDiagnostics.length ? 1 : 0;
