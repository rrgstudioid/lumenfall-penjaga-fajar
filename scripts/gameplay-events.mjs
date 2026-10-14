/** Capture every executed test. This reporter never selects or skips tests. */
export default async function* report(source) {
  for await (const event of source) {
    if (!['test:pass', 'test:fail'].includes(event.type)) continue;
    const { name, file, line, column, nesting, skip, todo, details } = event.data;
    yield JSON.stringify({ status: event.type.slice(5), name, file: file?.replaceAll('\\', '/'),
      line, column, nesting, skip: !!skip, todo: !!todo, type: details?.type,
      diagnostic: details?.error?.cause?.stack ?? details?.error?.stack ?? null }) + '\n';
  }
}
