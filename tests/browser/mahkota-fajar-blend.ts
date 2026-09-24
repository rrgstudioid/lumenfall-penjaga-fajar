import './kingdom-capital.css';
import * as T from 'three';
import { MapReviewMode } from './kingdom-capital-review';
import { buildBlenderCandidate } from './mahkota-fajar-blend-scene';
import { Game } from '../../lib/game/world';
import { freshHero, saveCharacter } from '../../lib/game/rules';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) throw Error('Local development only');

const city = await buildBlenderCandidate();
const hero = freshHero('slot-blend-candidate', 'adventurer', 'Mahkota Fajar Blend Review');
hero.inCity = false;
hero.x = 0;
hero.z = 90;
saveCharacter(hero, true);

let view = 'overview';
let reviewCamera: { position: T.Vector3; lookAt: T.Vector3 } | null = null;
const cameras: Record<string, { position: [number, number, number]; look: [number, number, number]; spawn?: [number, number] }> = {
  overview: { position: [620, 460, 520], look: [0, 35, -90] },
  top: { position: [0, 760, -90], look: [0, 35, -90] },
  gate: { position: [0, 18, 118], look: [0, 8, 60], spawn: [0, 90] },
  center: { position: [0, 25, 70], look: [0, 16, 0], spawn: [0, 48] },
  castle: { position: [0, 88, -105], look: [0, 35, -15], spawn: [0, -90] },
  street: { position: [-14, 12, 55], look: [0, 12, 20], spawn: [-10, 50] },
  player: { position: [0, 0, 0], look: [0, 0, 0] },
};

class BlenderCandidateGame extends Game {
  override get fieldTerrain() { return undefined; }
  override get isSandsLocation() { return false; }
  override get nearSanctuary() { return false; }
  override restoreSavedPosition() { this.hero.x = 0; this.hero.z = 90; }
  override buildTerrain() {}
  override buildShrine() { super.buildShrine(); this.shrine.visible = false; }
  override buildEnemies() { this.enemies = []; }
  override buildRegionDecor() {
    this.regionDecor = city.root;
    this.scene.add(city.root);
    this.treeColliders = [];
    this.scene.background = new T.Color('#b8c9bb');
    this.scene.fog = new T.Fog('#b8c9bb', 900, 2400);
    this.scene.traverse(object => {
      if (object instanceof T.HemisphereLight) object.intensity = 1.25;
      if (object instanceof T.DirectionalLight) object.intensity = 1.45;
    });
  }
  override groundHeight(x: number, z: number) { return city.groundHeight(x, z); }
  override groundDistance(a: T.Vector3, b: T.Vector3) { return Math.hypot(a.x - b.x, a.z - b.z); }
  override placeActor() { this.actor.position.set(this.hero.x, this.groundHeight(this.hero.x, this.hero.z), this.hero.z); }
  override moveHeroOnGround(from: { x: number; z: number }, dx: number, dz: number) { return city.move(from, dx, dz); }
  override emit() {}
  override save() {}
  override changeRegion() { return false; }
  override drawMap() {}
  override updateCamera(dt: number) {
    if (reviewCamera) {
      this.camera.position.copy(reviewCamera.position);
      this.camera.lookAt(reviewCamera.lookAt);
    } else if (view === 'player' || view === 'street') super.updateCamera(dt);
    else {
      const camera = cameras[view] ?? cameras.overview;
      this.camera.position.fromArray(camera.position);
      this.camera.lookAt(new T.Vector3().fromArray(camera.look));
    }
    this.camera.far = 1300;
    this.camera.updateProjectionMatrix();
  }
}

const game = new BlenderCandidateGame(document.querySelector('#world')!, document.querySelector('#labels')!, document.querySelector('#map')!, () => {}, () => game.pause(!game.paused));
await game.prepareWorld();
game.start();
game.bgm.configure({ ...game.bgm.settings, muted: true });
game.followView.distance = game.followView.targetDistance = 9;

function teleport(x: number, z: number) {
  game.clearInput();
  game.hero.x = x;
  game.hero.z = z;
  game.placeActor();
  game.cameraFocus.copy(game.actor.position);
}
function setView(name: string) {
  reviewCamera = null;
  view = name;
  const camera = cameras[name];
  if (camera?.spawn) teleport(...camera.spawn);
  if (name === 'player' || name === 'street') {
    game.cameraMode = 'follow';
    game.followView.distance = game.followView.targetDistance = name === 'street' ? 8 : 9;
    game.followView.pitch = game.followView.targetPitch = 0.22;
  }
  document.querySelector('#location')!.textContent = name === 'player' ? 'WASD berjalan · karakter runtime asli' : `${name} · inspeksi 1:1 dari Blender`;
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => { button.onclick = () => setView(button.dataset.view!); });

const districts = [
  { name: 'OUTER_FIELD', x: 0, z: 90, tier: 0 },
  { name: 'LOWER_CITY', x: 0, z: 38, tier: 1 },
  { name: 'CITY_CORE', x: 0, z: 5, tier: 2 },
  { name: 'UPPER_CITY', x: 0, z: -45, tier: 3 },
  { name: 'CASTLE', x: 0, z: -100, tier: 4 },
];
const review = new MapReviewMode({
  mapId: 'lumenfall-kingdom-capital-blend-v1',
  root: city.root,
  scene: game.scene,
  camera: game.camera as T.PerspectiveCamera,
  canvas: game.renderer.domElement,
  groundHeight: city.groundHeight,
  player: () => ({ x: game.hero.x, y: game.actor.position.y, z: game.hero.z }),
  setView,
  setReviewCamera(position, lookAt) { reviewCamera = { position, lookAt }; },
  clearReviewCamera() { reviewCamera = null; },
  objectRecords: city.reviewObjects(),
  districts,
});

const samples: number[] = [];
let last = performance.now();
function hud(t: number) {
  samples.push(t - last); last = t; if (samples.length > 90) samples.shift();
  const m = city.metrics();
  document.querySelector('#status')!.textContent = 'BLENDER CANDIDATE V1 · 1:1 PRESERVATION · DEV ONLY';
  document.querySelector('#metrics')!.textContent = `${(1000 / (samples.reduce((a, b) => a + b, 0) / samples.length)).toFixed(0)} FPS · ${game.renderer.info.render.calls} draws\n${game.renderer.info.render.triangles.toLocaleString()} tris\n${m.objects.toLocaleString()} objects · ${m.meshes.toLocaleString()} meshes\n${m.materials} materials · Pos ${game.hero.x.toFixed(1)}, ${game.actor.position.y.toFixed(1)}, ${game.hero.z.toFixed(1)}`;
  review.update();
  requestAnimationFrame(hud);
}
requestAnimationFrame(hud);

(window as unknown as { blendCandidate: unknown }).blendCandidate = {
  game,
  city,
  review,
  state: () => ({ ready: game.started, view, reviewEnabled: review.isEnabled(), position: game.actor.position.toArray(), metrics: city.metrics(), source: 'LUMENFALL_Medieval_City.blend', mapId: 'lumenfall-kingdom-capital-blend-v1' }),
};
addEventListener('pagehide', () => { review.destroy(); game.dispose(); city.dispose(); }, { once: true });
