import ts from 'typescript';
import { execFileSync } from 'node:child_process';
// Report project semantic errors even when the installed vinext .d.ts has a
// pre-existing parser error. Does not edit node_modules or suppress project errors.
const file = ts.readConfigFile('tsconfig.json', name => ts.sys.readFile(name));
const config = ts.parseJsonConfigFileContent(file.config, ts.sys, '.');
const baseline = process.argv.includes('--baseline');
const roots = config.fileNames.filter(f => /^(app|components|hooks|lib)\//.test(f.replaceAll('\\','/')) && !f.endsWith('.test.ts'));
if (!baseline) roots.push('scripts/simulate-gameplay.ts', 'tests/browser/canonical-gameplay.tsx', 'lib/game/canonical-gameplay.test.ts');
const hostCompiler = ts.createCompilerHost(config.options);
if (baseline) {
  const original = hostCompiler.readFile.bind(hostCompiler);
  const tracked = new Set(execFileSync('git', ['ls-files'], {encoding:'utf8'}).trim().split('\n'));
  hostCompiler.readFile = name => {
    const relative = name.replaceAll('\\','/').replace(ts.sys.getCurrentDirectory().replaceAll('\\','/')+'/', '');
    if (/^(app|components|hooks|lib)\//.test(relative)) {
      if (!tracked.has(relative)) return undefined;
      return execFileSync('git',['show',`HEAD:${relative}`],{encoding:'utf8',maxBuffer:8e6});
    }
    return original(name);
  };
  for (let i=roots.length-1;i>=0;i--) if (!tracked.has(roots[i].replaceAll('\\','/'))) roots.splice(i,1);
}
const program = ts.createProgram(roots, { ...config.options, incremental: false }, hostCompiler);
const diagnostics = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()];
const host = { getCanonicalFileName: f => f, getCurrentDirectory: () => ts.sys.getCurrentDirectory(), getNewLine: () => '\n' };
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
process.exitCode = diagnostics.length ? 1 : 0;
