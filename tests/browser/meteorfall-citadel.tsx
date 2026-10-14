// Local-only full application fixture. Owner saves and preferences are never read or written.
import { createRoot } from "react-dom/client";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import "../../app/globals.css";
if (
  !import.meta.env.DEV ||
  !["localhost", "127.0.0.1"].includes(location.hostname)
)
  throw new Error("Local review only");
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
Object.defineProperty(window, "localStorage", { value: new MemoryStorage() });
Object.defineProperty(window, "sessionStorage", { value: new MemoryStorage() });
const [rules, { Game }, { default: Home }, layout] = await Promise.all([
  import("../../lib/game/rules"),
  import("../../lib/game/world"),
  import("../../app/page"),
  import("../../lib/game/meteorfall-citadel-layout"),
]);
const hero = rules.createV3AdventurerHero("slot-1");
hero.characterName = "Meteorfall Review";
hero.level = 42;
hero.currentField = layout.METEORFALL_ID;
hero.currentCity = "jayantara";
hero.inCity = false;
Object.assign(hero, layout.METEORFALL_ENTRY);
rules.saveCharacter(hero, true);
const three = await import("three");
const qa = {
  three,
  rules,
  game: null as InstanceType<typeof Game> | null,
  layout,
  cloneActor(): ReturnType<typeof cloneSkeleton> {
    const actor = qa.game!.actor;
    const data = new Map<typeof actor, typeof actor.userData>();
    actor.traverse((o) => {
      data.set(o as typeof actor, o.userData);
      o.userData = {};
    });
    try {
      return cloneSkeleton(actor);
    } finally {
      data.forEach((value, object) => {
        object.userData = value;
      });
    }
  },
};
Object.assign(window, { __meteorfallQA: qa });
// oxlint-disable-next-line typescript/unbound-method
const start = Game.prototype.start;
Game.prototype.start = function () {
  qa.game = this;
  return start.call(this);
};
createRoot(document.getElementById("root")!).render(<Home />);
