import './kingdom-pilot.css';
import * as T from 'three';
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
Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  configurable: false,
});
Object.defineProperty(window, 'sessionStorage', {
  value: new MemoryStorage(),
  configurable: false,
});
const status = document.querySelector('#status')!,
  metrics = document.querySelector('#metrics')!;
const [{ Game }, rules, { buildPilot }] = await Promise.all([
  import('../../lib/game/world'),
  import('../../lib/game/rules'),
  import('./kingdom-pilot-scene'),
]);
const pilot = await buildPilot();
const hero = rules.freshHero('slot-1', 'adventurer', 'Asset Pilot');
hero.inCity = false;
hero.x = 0;
hero.z = 6;
hero.gender = 'male';
if (hero.appearance) hero.appearance.gender = 'male';
rules.saveCharacter(hero, true);
let view = 'player',
  mode = 'pilot',
  spotName = 'gate';
const spots: Record<string, { x: number; z: number; yaw: number }> = {
  gate: { x: 0, z: 5, yaw: 0 },
  house: { x: 10.5, z: -3, yaw: 0 },
  wall: { x: -5, z: 8, yaw: 0 },
  street: { x: 0, z: 18, yaw: 0 },
  nature: { x: 8, z: 14, yaw: 0 },
  stairs: { x: -6, z: 17, yaw: 0 },
};
class PilotGame extends Game {
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
    this.hero.z = 6;
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
    this.regionDecor = pilot.root;
    this.scene.add(pilot.root);
    this.treeColliders = [pilot.trunk];
    this.scene.fog = new T.Fog('#b6c7b7', 125, 230);
    this.scene.background = new T.Color('#b6c7b7');
  }
  override groundHeight(x: number, z: number) {
    return pilot.ground.heightAt(x, z) ?? 0;
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
    return pilot.move(from, dx, dz);
  }
  override emit() {}
  override save() {}
  override changeRegion() {
    return false;
  }
  override drawMap() {}
  override updateCamera(dt: number) {
    if (view === 'player') {
      super.updateCamera(dt);
      // Pilot-only obstruction probe against authored simple colliders, not render meshes.
      const target = this.actor.position.clone().add(new T.Vector3(0, 1.8, 0));
      const delta = this.camera.position.clone().sub(target),
        length = delta.length();
      const ray = new T.Ray(target, delta.normalize());
      let distance = length;
      for (const box of pilot.boxes) {
        const hit = ray.intersectBox(
          new T.Box3(new T.Vector3(...box.min), new T.Vector3(...box.max)),
          new T.Vector3(),
        );
        if (hit)
          distance = Math.min(
            distance,
            Math.max(0.6, hit.distanceTo(target) - 0.25),
          );
      }
      this.camera.position.copy(target).addScaledVector(delta, distance);
      this.camera.position.y = Math.max(0.4, this.camera.position.y);
      this.camera.lookAt(target);
    } else {
      this.camera.position.set(
        mode === 'pilot' ? 40 : 84,
        mode === 'pilot' ? 34 : 82,
        mode === 'pilot' ? 48 : 98,
      );
      this.camera.lookAt(0, 0, mode === 'pilot' ? 0 : -5);
      this.camera.far = 350;
      this.camera.updateProjectionMatrix();
    }
  }
}
const g = new PilotGame(
  document.querySelector('#world')!,
  document.querySelector('#labels')!,
  document.querySelector('#map')!,
  () => {},
  () => g.pause(!g.paused),
);
await g.prepareWorld();
g.start();
g.bgm.configure({ ...g.bgm.settings, muted: true });
g.followView.targetDistance = 10;
g.followView.distance = 10;
function teleport(x: number, z: number, yaw = 0) {
  g.clearInput();
  g.hero.x = x;
  g.hero.z = z;
  g.placeActor();
  g.cameraFocus.copy(g.actor.position);
  g.yaw = yaw;
  g.followView.yaw = yaw;
  g.followView.targetYaw = yaw;
  g.direction.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}
function spot(name: string) {
  spotName = name;
  if (name === 'overview') {
    view = 'overview';
  } else {
    view = 'player';
    const s = spots[name];
    teleport(s.x, s.z, s.yaw);
  }
  document.querySelector('#location')!.textContent =
    name + ' · WASD / kamera runtime LUMENFALL';
  g.renderer.domElement.focus();
}
function setMode(next: string) {
  mode = next;
  pilot.setMode(next);
  view = next === 'pilot' ? 'player' : 'overview';
  if (next === 'pilot') spot('gate');
}
document
  .querySelectorAll<HTMLButtonElement>('[data-spot]')
  .forEach((b) => (b.onclick = () => spot(b.dataset.spot!)));
document.querySelector<HTMLInputElement>('#collision')!.onchange = (e) =>
  (pilot.debug.visible = (e.target as HTMLInputElement).checked);
document.querySelector<HTMLInputElement>('#remap')!.onchange = (e) =>
  pilot.setRemap((e.target as HTMLInputElement).checked);
document
  .querySelector('#lod')!
  .addEventListener('change', (e) =>
    pilot.setLod(Number((e.target as unknown as { value: string }).value)),
  );
for (const name of ['individual', 'instanced', 'pilot'])
  document
    .querySelector('#' + name)!
    .addEventListener('click', () => setMode(name));
let raf = 0,
  last = performance.now(),
  frames = 0,
  fps = 0;
const frameTimes: number[] = [];
function hud(now: number) {
  if (g.disposed) return;
  frames++;
  frameTimes.push(now);
  if (frameTimes.length > 240) frameTimes.shift();
  if (now - last > 1000) {
    fps = (frames * 1000) / (now - last);
    frames = 0;
    last = now;
    const r = g.renderer.info.render;
    status.textContent = `READY · ${g.actor.userData.assetKind} · ${fps.toFixed(0)} FPS`;
    metrics.textContent = `${mode} · ${r.calls} draw calls\n${r.triangles.toLocaleString()} rendered tris\nx ${g.hero.x.toFixed(2)} y ${g.actor.position.y.toFixed(2)} z ${g.hero.z.toFixed(2)}\nDoor sample: ${pilot.aperture.width.toFixed(2)} × 2.60 clear`;
  }
  raf = requestAnimationFrame(hud);
}
raf = requestAnimationFrame(hud);
const qa = {
  g,
  pilot,
  teleport,
  spot,
  setMode,
  setView(v: string) {
    view = v;
  },
  state() {
    return {
      ready: g.started,
      position: { x: g.hero.x, z: g.hero.z, y: g.actor.position.y },
      character: {
        asset: g.actor.userData.assetKind,
        height: g.actor.userData.heightMeters,
        loaded: g.actor.userData.modelStatus,
      },
      fps,
      mode,
      view,
      spot: spotName,
      drawCalls: g.renderer.info.render.calls,
      triangles: g.renderer.info.render.triangles,
      resources: pilot.resources(),
      memoryOnly: true,
      enemies: g.enemies.length,
    };
  },
  async benchmark(next: string) {
    setMode(next);
    await new Promise<void>((r) => setTimeout(r, 1500));
    const samples: { dt: number; drawCalls: number; triangles: number }[] = [];
    let prev = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        samples.push({
          dt: now - prev,
          drawCalls: g.renderer.info.render.calls,
          triangles: g.renderer.info.render.triangles,
        });
        prev = now;
        if (samples.length >= 90) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const sorted = samples.map((s) => s.dt).sort((a, b) => a - b),
      mean = samples.reduce((n, s) => n + s.dt, 0) / samples.length;
    return {
      mode: next,
      samples: samples.length,
      fps: 1000 / mean,
      meanFrameMs: mean,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      drawCalls: samples.at(-1)!.drawCalls,
      triangles: samples.at(-1)!.triangles,
      counts: pilot.counts,
      resources: pilot.resources(),
      materialSwitches:
        'NOT_DIRECTLY_INSTRUMENTED; draw calls + unique material count reported',
      viewport: [g.renderer.domElement.width, g.renderer.domElement.height],
      shadows: g.renderer.shadowMap.enabled,
      lod: Number(
        (document.querySelector('#lod') as Element & { value: string }).value,
      ),
    };
  },
};
(window as unknown as { kingdomPilot: typeof qa }).kingdomPilot = qa;
spot('gate');
addEventListener(
  'pagehide',
  () => {
    cancelAnimationFrame(raf);
    g.dispose();
    pilot.dispose();
  },
  { once: true },
);
