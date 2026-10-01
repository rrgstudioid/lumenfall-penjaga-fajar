// Local-only full application fixture. Owner saves and preferences are never read or written.
import { createRoot } from 'react-dom/client';
import '../../app/globals.css';
if (
  !import.meta.env.DEV ||
  !['localhost', '127.0.0.1'].includes(location.hostname)
)
  throw new Error('Local review only');
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
const [rules, { Game }, { default: Home }, layout] = await Promise.all([
  import('../../lib/game/rules'),
  import('../../lib/game/world'),
  import('../../app/page'),
  import('../../lib/game/whispering-wilds-layout'),
]);
const hero = rules.createV3AdventurerHero('slot-1');
hero.characterName = 'Forest Review';
hero.level = 16;
hero.currentField = layout.WILDS_ID;
hero.currentCity = 'arunika';
hero.inCity = false;
Object.assign(hero, layout.WILDS_ENTRY);
rules.saveCharacter(hero, true);
const three = await import('three');
const qa = { three, game: null as InstanceType<typeof Game> | null, layout };
Object.assign(window, { __wildsQA: qa });
// oxlint-disable-next-line typescript/unbound-method
const start = Game.prototype.start;
Game.prototype.start = function () {
  qa.game = this;
  return start.call(this);
};
createRoot(document.getElementById('root')!).render(<Home />);
