import { IronChargeRuntimeFixture } from '../../lib/game/iron-charge-fixture.ts';

const out = document.querySelector<HTMLPreElement>('#result')!;
const fixture = new IronChargeRuntimeFixture();
const run = () => {
  const before = performance.now();
  const a = fixture.castIronCharge(3.7);
  const b = fixture.castIronCharge(6);
  const c = fixture.controlLockCase();
  const d = fixture.recoveryCase();
  const e = fixture.castIronCharge(6, true);
  const basic = fixture.basicAttackCase();
  const payload = { a, b, c, d, e, basic, elapsedMs: performance.now() - before, consoleErrors: [], pageErrors: [], requestFailures: [] };
  (window as typeof window & { __ironChargeFixture?: unknown }).__ironChargeFixture = payload;
  out.textContent = JSON.stringify(payload, null, 2);
  return payload;
};
document.querySelector('#run')!.addEventListener('click', run);
run();
