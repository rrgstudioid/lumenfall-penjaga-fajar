// Full application, disposable saves/preferences; never reads the owner's storage.
import { createRoot } from 'react-dom/client';
import '../../app/globals.css';
if (
  !import.meta.env.DEV ||
  !['localhost', '127.0.0.1'].includes(location.hostname)
)
  throw Error('Local review only');
class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, String(v));
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
}
Object.defineProperty(window, 'localStorage', { value: new MemoryStorage() });
Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage() });
// A single optional reload replay, still entirely outside persistent browser storage.
let replayed = false;
if (
  new URLSearchParams(location.search).get('replay') === '1' &&
  window.name.startsWith('sunken-review:')
) {
  const entries = JSON.parse(
    window.name.slice('sunken-review:'.length),
  ) as Array<[string, string]>;
  for (const [key, value] of entries) localStorage.setItem(key, value);
  window.name = '';
  replayed = true;
}
const [rules, { Game }, { default: Home }, { FIELDS }, three] =
  await Promise.all([
    import('../../lib/game/rules'),
    import('../../lib/game/world'),
    import('../../app/page'),
    import('../../lib/game/regions'),
    import('three'),
  ]);
const params = new URLSearchParams(location.search);
const hero = rules.createV3AdventurerHero('slot-1');
hero.characterName = 'Sunken Review';
hero.level = Number(params.get('level')) || 32;
const mapId = params.get('map') ?? 'sunken-ruins';
if (!FIELDS[mapId]) throw Error(`Review map unavailable: ${mapId}`);
hero.currentField = mapId;
hero.currentCity = FIELDS[mapId].cityId;
hero.inCity = false;
if (params.get('gender') === 'female') {
  hero.gender = 'female';
  hero.appearance.gender = 'female';
}
Object.assign(hero, FIELDS[mapId].entry);
hero.lastSafePosition = { ...FIELDS[mapId].entry };
if (!replayed) rules.saveCharacter(hero, true);
const [sunken, plains, wilds] = await Promise.all([
  import('../../lib/game/sunken-ruins-layout'),
  import('../../lib/game/verdant-plains-layout'),
  import('../../lib/game/whispering-wilds-layout'),
]);
const qa = {
  deepLayout: await import('../../lib/game/deep-ocean-layout'),
  trenchLayout: await import('../../lib/game/abysal-trench-layout'),
  sunkenLayout: sunken,
  three,
  rules,
  FIELDS,
  combat: await import('./sunken-combat-fixture.mjs'),
  pathsByMap: {
    [sunken.SUNKEN_ID]: sunken.SUNKEN_PATHS,
    [plains.PLAINS_ID]: plains.PLAINS_PATHS,
    [wilds.WILDS_ID]: wilds.WILDS_PATHS,
  },
  game: null as InstanceType<typeof Game> | null,
};
Object.assign(window, { __sunkenQA: qa });
// oxlint-disable-next-line typescript/unbound-method
const start = Game.prototype.start;
Game.prototype.start = function () {
  qa.game = this;
  return start.call(this);
};
createRoot(document.getElementById('root')!).render(<Home />);
