import { BladeMaster7AFixture } from '../../lib/game/blade-master-7a-fixture.ts';
const payload = new BladeMaster7AFixture().run();
document.querySelector<HTMLPreElement>('#result')!.textContent = JSON.stringify(payload, null, 2);
(window as Window & { __bladeMaster7AFixture?: unknown }).__bladeMaster7AFixture = payload;
