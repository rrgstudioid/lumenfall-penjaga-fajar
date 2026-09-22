import { BerserkerV3RuntimeFixture } from '../../lib/game/berserker-v3-fixture.ts';

const output = document.querySelector<HTMLPreElement>('#output')!;
const status = document.querySelector<HTMLElement>('#status')!;

const run = () => {
  const fixture = new BerserkerV3RuntimeFixture();
  fixture.setTargets(8, true, ['target-8']);
  const raging = fixture.earthSplitter(5, 0);
  fixture.advance(2);
  const fury = fixture.furyHarvest(5);
  const trance = fixture.trance(3);
  const breaker = fixture.ironChargeImpact();
  const breakerFollowup = fixture.breakerEntry(1);
  const payload = {
    name: 'SPV3-5 Berserker V3 clean runtime fixture',
    worldImported: false,
    cases: { raging, fury, trance, breaker, breakerFollowup },
    trace: fixture.trace,
    browserErrors: [],
  };
  (window as Window & { __berserkerFixture?: unknown }).__berserkerFixture = payload;
  output.textContent = JSON.stringify(payload, null, 2);
  status.textContent = 'BERSERKER_FIXTURE_READY';
};

run();
