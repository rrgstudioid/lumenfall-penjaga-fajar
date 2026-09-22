const result = document.querySelector<HTMLPreElement>('#result');
if (result) result.textContent = 'HARNESS_MODULE_BOOT: entry module executed; importing runtime…';
const startedAt = performance.now();
const timeout = window.setTimeout(() => {
  if (result?.textContent?.startsWith('HARNESS_MODULE_BOOT')) {
    result.textContent = `HARNESS_RUNTIME_IMPORT_TIMEOUT: ${Math.round(performance.now() - startedAt)}ms`;
  }
}, 8000);
import('./stun-smoke.ts?spv3_43=2').then(() => {
  window.clearTimeout(timeout);
}).catch((error) => {
  window.clearTimeout(timeout);
  if (result) result.textContent = `HARNESS_RUNTIME_IMPORT_FAILED\n${String(error?.stack ?? error)}`;
});
