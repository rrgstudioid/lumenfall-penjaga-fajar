import { ArmorBreakOwnershipFixture } from '../../lib/game/armor-break-ownership-fixture.ts';
const output = document.querySelector<HTMLPreElement>('#result')!;
const fixture = new ArmorBreakOwnershipFixture();
const payload = fixture.run();
(window as Window & { __armorBreakOwnershipFixture?: unknown }).__armorBreakOwnershipFixture = payload;
output.textContent = JSON.stringify(payload, null, 2);
