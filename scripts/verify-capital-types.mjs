import ts from 'typescript';
import fs from 'node:fs';
const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile),
  parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, '.');
const files = parsed.fileNames.filter(
  (f) =>
    !f.startsWith('output/') &&
    !f.startsWith('dist/') &&
    !f.startsWith('.next/') &&
    !f.includes('node_modules/'),
);
const check = (names) =>
  ts
    .getPreEmitDiagnostics(
      ts.createProgram(names, { ...parsed.options, incremental: false }),
    )
    .map((d) => ({
      file: d.file?.fileName.replaceAll('\\', '/'),
      line:
        d.file && d.start !== undefined
          ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
          : null,
      code: d.code,
      message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
    }));
const before = check(files.filter((f) => !f.includes('kingdom-capital'))),
  after = check(files),
  added = after.filter(
    (d) => !before.some((b) => JSON.stringify(b) === JSON.stringify(d)),
  );
const result = {
  method:
    'Counterfactual same checkout excluding/including new capital dev files; archived output/template trees excluded, not an assertion that existing diagnostics are fixed.',
  before,
  after,
  added,
  primaryGameBefore: before.filter((d) => d.file?.includes('/lib/game/'))
    .length,
  primaryGameAfter: after.filter((d) => d.file?.includes('/lib/game/')).length,
};
fs.writeFileSync(
  'dev-prototypes/kingdom-capital-v11/evidence/typescript-comparison.json',
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    before: before.length,
    after: after.length,
    added,
    gameBefore: result.primaryGameBefore,
    gameAfter: result.primaryGameAfter,
  }),
);
if (added.length) process.exitCode = 1;
