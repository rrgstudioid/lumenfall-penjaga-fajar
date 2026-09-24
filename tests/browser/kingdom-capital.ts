import './kingdom-capital.css';
import * as T from 'three';
import { MapReviewMode } from './kingdom-capital-review';
import {
  gateToPlaza,
  plazaToCastle,
  roads,
  districts,
  height as _height,
} from './kingdom-capital-layout';
const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = 'data:,';
document.head.appendChild(favicon);
if (
  !import.meta.env.DEV ||
  !['localhost', '127.0.0.1'].includes(location.hostname)
)
  throw Error('Local development only');
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
}
Object.defineProperty(window, 'localStorage', { value: new MemoryStorage() });
Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage() });
const [{ Game }, rules, { buildCapital }] = await Promise.all([
  import('../../lib/game/world'),
  import('../../lib/game/rules'),
  import('./kingdom-capital-scene'),
]);
const structureOnly = new URLSearchParams(location.search).has('structure');
const city = await buildCapital(structureOnly);
const hero = rules.freshHero('slot-1', 'adventurer', 'Capital Spatial Test');
hero.inCity = false;
hero.x = 0;
hero.z = 350;
rules.saveCharacter(hero, true);
let view = 'overview';
let reviewCamera: { position: T.Vector3; lookAt: T.Vector3 } | null = null;
const cameras: Record<
  string,
  { pos: number[]; look: number[]; spawn?: number[] }
> = {
  overview: { pos: [680, 650, 900], look: [0, 45, -10] },
  top: { pos: [0, 1550, 1], look: [0, 0, 0] },
  gate: { pos: [-28, 22, 390], look: [0, 25, 325], spawn: [0, 372] },
  inside: { pos: [0, 14, 317], look: [35, 163, -324], spawn: [0, 315] },
  plaza: { pos: [65, 77, 90], look: [0, 42, 20], spawn: [20, 65] },
  craft: { pos: [236, 32, 289], look: [200, 14, 245], spawn: [200, 230] },
  lower: { pos: [-160, 40, 230], look: [-225, 20, 160], spawn: [-160, 215] },
  upperhome: {
    pos: [-180, 100, -95],
    look: [-140, 91, -170],
    spawn: [-170, -115],
  },
  stairs: { pos: [134, 47, -65], look: [80, 90, -175], spawn: [125, -70] },
  terrace: { pos: [75, 102, -155], look: [35, 160, -300], spawn: [80, -175] },
  castle: { pos: [35, 144, -292], look: [0, 30, 230], spawn: [35, -280] },
  street: { pos: [-80, 14, 256], look: [-120, 38, 145], spawn: [-85, 249] },
  alley: {
    pos: [-250.1, 14, 180],
    look: [-250.1, 12, 169],
    spawn: [-250.1, 175],
  },
  wall: { pos: [-440, 105, 285], look: [-260, 45, 100] },
  silhouette: { pos: [40, 155, 700], look: [20, 80, -120] },
};
class CapitalGame extends Game {
  override get fieldTerrain() {
    return undefined;
  }
  override get isSandsLocation() {
    return false;
  }
  override get nearSanctuary() {
    return false;
  }
  override restoreSavedPosition() {
    this.hero.x = 0;
    this.hero.z = 350;
  }
  override buildTerrain() {}
  override buildShrine() {
    super.buildShrine();
    this.shrine.visible = false;
  }
  override buildEnemies() {
    this.enemies = [];
  }
  override buildRegionDecor() {
    this.regionDecor = city.root;
    this.scene.add(city.root);
    this.treeColliders = [];
    this.scene.background = new T.Color('#bccfc6');
    this.scene.fog = new T.Fog('#bccfc6', 1000, 2300);
    this.scene.traverse((o) => {
      if (o instanceof T.HemisphereLight) o.intensity = 2.1;
      if (o instanceof T.DirectionalLight) {
        o.intensity = 2.5;
        o.position.set(-180, 350, 220);
      }
    });
  }
  override groundHeight(x: number, z: number) {
    return city.groundHeight(x, z);
  }
  override groundDistance(a: T.Vector3, b: T.Vector3) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
  override placeActor() {
    this.actor.position.set(
      this.hero.x,
      this.groundHeight(this.hero.x, this.hero.z),
      this.hero.z,
    );
  }
  override moveHeroOnGround(
    from: { x: number; z: number },
    dx: number,
    dz: number,
  ) {
    return city.move(from, dx, dz);
  }
  override emit() {}
  override save() {}
  override changeRegion() {
    return false;
  }
  override drawMap() {}
  override updateCamera(dt: number) {
    if (reviewCamera) {
      this.camera.position.copy(reviewCamera.position);
      this.camera.lookAt(reviewCamera.lookAt);
    } else if (['player', 'street', 'alley'].includes(view)) super.updateCamera(dt);
    else {
      const c = cameras[view] ?? cameras.overview;
      this.camera.position.fromArray(c.pos);
      this.camera.lookAt(new T.Vector3().fromArray(c.look));
    }
    this.camera.far = 3000;
    this.camera.updateProjectionMatrix();
    city.visibility(
      this.camera,
      view === 'overview' ||
        view === 'top' ||
        view === 'silhouette' ||
        view === 'wall',
    );
  }
}
const g = new CapitalGame(
  document.querySelector('#world')!,
  document.querySelector('#labels')!,
  document.querySelector('#map')!,
  () => {},
  () => g.pause(!g.paused),
);
await g.prepareWorld();
g.start();
g.bgm.configure({ ...g.bgm.settings, muted: true });
g.followView.distance = g.followView.targetDistance = 12;
function teleport(x: number, z: number) {
  g.clearInput();
  g.hero.x = x;
  g.hero.z = z;
  g.placeActor();
  g.cameraFocus.copy(g.actor.position);
}
function setView(name: string) {
  reviewCamera = null;
  view = name;
  if (cameras[name]?.spawn)
    teleport(...(cameras[name].spawn as [number, number]));
  if (['player', 'street', 'alley'].includes(name)) {
    g.cameraMode = 'follow';
    g.followView.distance = g.followView.targetDistance =
      name === 'alley' ? 5 : 8;
    g.followView.pitch = g.followView.targetPitch = 0.22;
    if (name !== 'player') {
      g.yaw = name === 'alley' ? 0 : 0.4;
      g.actor.rotation.y = g.yaw;
      g.followView.yaw = g.followView.targetYaw = g.yaw;
    }
  }
  document.querySelector('#location')!.textContent = [
    'player',
    'street',
    'alley',
  ].includes(name)
    ? 'WASD berjalan · karakter & kamera runtime asli'
    : name + ' · inspeksi ruang';
}
document
  .querySelectorAll<HTMLButtonElement>('[data-view]')
  .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
const review = new MapReviewMode({
  mapId: 'lumenfall-kingdom-capital-v11',
  root: city.root,
  scene: g.scene,
  camera: g.camera as T.PerspectiveCamera,
  canvas: g.renderer.domElement,
  groundHeight: city.groundHeight,
  player: () => ({ x: g.hero.x, y: g.actor.position.y, z: g.hero.z }),
  setView,
  setReviewCamera(position, lookAt) {
    reviewCamera = { position, lookAt };
  },
  clearReviewCamera() {
    reviewCamera = null;
  },
  objectRecords: city.reviewObjects(),
  districts,
});
const frameTimes: number[] = [];
const hudMetrics = city.metrics(); // Static scene inventory; do not traverse every batch each frame.
let raf = 0,
  last = performance.now();
function hud(t: number) {
  frameTimes.push(t - last);
  last = t;
  if (frameTimes.length > 90) frameTimes.shift();
  document.querySelector('#status')!.textContent =
    `${structureOnly ? 'STRUCTURE GATE' : 'PLAYABLE PROTOTYPE'} · ${g.actor.userData.assetKind} · empat teras`;
  const m = hudMetrics;
  document.querySelector('#metrics')!.textContent =
    `${(1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length)).toFixed(0)} FPS · ${g.renderer.info.render.calls} draws\n${g.renderer.info.render.triangles.toLocaleString()} tris\n${m.buildings} bangunan · ${m.towers} tower\n${m.trees} pohon · ${m.props} props\nPos ${g.hero.x.toFixed(1)}, ${g.actor.position.y.toFixed(1)}, ${g.hero.z.toFixed(1)}`;
  review.update();
  raf = requestAnimationFrame(hud);
}
raf = requestAnimationFrame(hud);
let traversal: {
  name: string;
  points: PointAlias[];
  index: number;
  start: number;
  startSim: number;
  distance: number;
  last: { x: number; z: number };
  done: boolean;
  elapsed?: number;
  simulationSeconds?: number;
} | null = null;
type PointAlias = [number, number, number];
const traversalResults: unknown[] = [];
// Test driver only steers yaw and holds the existing W key. It never sets position during travel.
function beginWalk(name: string, points: PointAlias[]) {
  if (traversal && !traversal.done) throw Error('walk running');
  view = 'player';
  g.clearInput();
  traversal = {
    name,
    points,
    index: 1,
    start: performance.now(),
    startSim: g.elapsed,
    distance: 0,
    last: { x: g.hero.x, z: g.hero.z },
    done: false,
  };
  g.keys.add('w');
}
function steer() {
  if (traversal && !traversal.done) {
    const p = traversal.points[traversal.index];
    const dx = p[0] - g.hero.x,
      dz = p[1] - g.hero.z;
    traversal.distance += Math.hypot(
      g.hero.x - traversal.last.x,
      g.hero.z - traversal.last.z,
    );
    traversal.last = { x: g.hero.x, z: g.hero.z };
    if (Math.hypot(dx, dz) < 1.1) {
      traversal.index++;
      if (traversal.index >= traversal.points.length) {
        traversal.done = true;
        g.keys.delete('w');
        traversal.elapsed = (performance.now() - traversal.start) / 1000;
        traversal.simulationSeconds = g.elapsed - traversal.startSim;
        traversalResults.push({ ...traversal });
      }
    } else {
      g.yaw = Math.atan2(-dx, -dz);
      g.followView.yaw = g.followView.targetYaw = g.yaw;
    }
  }
  if (!g.disposed) requestAnimationFrame(steer);
}
requestAnimationFrame(steer);
const qa = {
  g,
  city,
  teleport,
  setView,
  beginWalk,
  gateToPlaza,
  plazaToCastle,
  roads,
  districts,
  state() {
    return {
      ready: g.started,
      view,
      position: g.actor.position.toArray(),
      fps: 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length),
      drawCalls: g.renderer.info.render.calls,
      triangles: g.renderer.info.render.triangles,
      metrics: city.metrics(),
      character: g.actor.userData.assetKind,
      characterHeight: g.actor.userData.heightMeters,
      traversal,
      traversalResults,
      structureOnly,
      reviewEnabled: review.isEnabled(),
    };
  },
  review,
};
(window as unknown as { capital: typeof qa }).capital = qa;
addEventListener(
  'pagehide',
  () => {
    cancelAnimationFrame(raf);
    review.destroy();
    g.dispose();
    city.dispose();
  },
  { once: true },
);
