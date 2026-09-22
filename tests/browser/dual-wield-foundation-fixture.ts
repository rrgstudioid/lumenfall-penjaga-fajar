import { DualWieldFoundationFixture } from '../../lib/game/dual-wield-foundation-fixture.ts';
const payload = new DualWieldFoundationFixture().run();
document.querySelector<HTMLPreElement>('#result')!.textContent = JSON.stringify(payload, null, 2);
(window as Window & { __dualWieldFoundationFixture?: unknown }).__dualWieldFoundationFixture = payload;
