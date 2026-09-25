import './kingdom-capital.css';
import * as T from 'three';
import { Game } from '../../lib/game/world';
import { freshHero } from '../../lib/game/rules';
import { buildStage03 } from './mahkota-fajar-stage03-scene';
import { MapReviewMode } from './kingdom-capital-review';

if (
  !import.meta.env.DEV ||
  !['localhost', '127.0.0.1'].includes(location.hostname)
)
  throw Error('Development candidate only');
let cleanup: () => void = () => {};
const status = document.querySelector<HTMLElement>('#status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
let generation = 0;
async function launch() {
  cleanup();
  const token = ++generation;
  retry.hidden = true;
  status.textContent = 'Memuat collision dan kota…';
  let city: Awaited<ReturnType<typeof buildStage03>> | undefined;
  let game: Game | undefined;
  try {
    city = await buildStage03((text) => (status.textContent = text));
    const map = city;
    let view = 'player';
    let reviewCamera: { position: T.Vector3; lookAt: T.Vector3 } | null = null;
    const targets: Record<string, [number, number, number]> = {
      center: [0, 1, 1],
      guild: [0, 12, -75],
      merchant: [-75, 4, -12],
      potion: [-45, 4, -16],
      weapon: [-80, 4, 19],
      armor: [-45, 4, 20],
      training: [-51, 1, -57],
      job: [55, 10, -54],
      forge: [69, 4, -10],
      warp: [0, 4, 68],
      bank: [65, 4, 34],
      inn: [-48, 4, 64],
      residential: [49, 3, 67],
      edge: [97, -1, 43],
    };
    class Stage03Game extends Game {
      private safeCameraDistance = 9;
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
        this.hero = freshHero(
          'stage03-preview',
          'adventurer',
          'Penjelajah Mahkota Fajar',
        );
        this.hero.inCity = false;
        this.hero.x = map.spawn.x;
        this.hero.z = map.spawn.z;
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
        this.regionDecor = map.root;
        this.scene.add(map.root);
        this.treeColliders = [];
        this.scene.background = new T.Color('#b9d5e3');
        this.scene.fog = new T.Fog('#b9d5e3', 350, 650);
      }
      override groundHeight(x: number, z: number) {
        return map.groundHeight(x, z);
      }
      override groundDistance(a: T.Vector3, b: T.Vector3) {
        return Math.hypot(a.x - b.x, a.z - b.z);
      }
      override placeActor() {
        if (!map.collision.valid(this.hero)) {
          this.hero.x = map.spawn.x;
          this.hero.z = map.spawn.z;
        }
        this.actor.position.set(
          this.hero.x,
          map.groundHeight(this.hero.x, this.hero.z),
          this.hero.z,
        );
      }
      override moveHeroOnGround(
        p: { x: number; z: number },
        dx: number,
        dz: number,
      ) {
        return map.move(p, dx, dz);
      }
      override emit() {}
      override save() {}
      override changeRegion() {
        return false;
      }
      override drawMap() {}
      override updateCamera(dt: number) {
        this.camera = this.followCamera;
        this.camera.far = 650;
        if (reviewCamera) {
          this.camera.position.copy(reviewCamera.position);
          this.camera.lookAt(reviewCamera.lookAt);
        } else if (view === 'player') {
          super.updateCamera(dt);
          const focus = this.actor.position
            .clone()
            .add(new T.Vector3(0, 1.65, 0));
          const constrained = map.constrainCamera(focus, this.camera.position);
          const direction = constrained.clone().sub(focus);
          const allowed = direction.length();
          this.safeCameraDistance = allowed < this.safeCameraDistance
            ? allowed
            : this.safeCameraDistance + (allowed - this.safeCameraDistance) * (1 - Math.exp(-8 * dt));
          this.camera.position.copy(focus).addScaledVector(direction.normalize(), this.safeCameraDistance);
        } else if (view === 'front') {
          this.camera.position.set(0, 12, 32);
          this.camera.lookAt(0, 12, -65);
        } else if (view === 'guild') {
          this.camera.position.set(27, 29, -24);
          this.camera.lookAt(0, 14, -75);
        } else if (view === 'street') {
          this.camera.position.set(0, map.groundHeight(0, 19) + 2.2, 19);
          this.camera.lookAt(0, 2.2, -50);
        } else if (view === 'top') {
          this.camera.position.set(0, 305, 0);
          this.camera.lookAt(0, 0, 0);
        } else if (view === 'overview') {
          this.camera.position.set(0, 190, 215);
          this.camera.lookAt(0, 0, 0);
        } else {
          const target = new T.Vector3().fromArray(
            targets[view] ?? targets.center,
          );
          this.camera.position.copy(target).add(new T.Vector3(24, 22, 32));
          this.camera.lookAt(target);
        }
        this.camera.updateProjectionMatrix();
        map.updateLOD(this.camera);
        this.worldLightRig.traverse((o) => {
          if (o instanceof T.DirectionalLight) {
            o.position
              .copy(this.actor.position)
              .add(new T.Vector3(-25, 45, 20));
            o.target.position.copy(this.actor.position);
            o.target.updateMatrixWorld();
          }
        });
      }
    }
    const g = new Stage03Game(
      document.querySelector('#world')!,
      document.querySelector('#labels')!,
      document.querySelector('#map')!,
      () => {},
      () => g.pause(!g.paused),
      'stage03-preview-no-save',
    );
    game = g;
    g.renderer.setPixelRatio(1);
    // Three resets its default counters after the shadow pass. Include both passes in QA/HUD.
    g.renderer.info.autoReset = false;
    let shadowTriangles = 0;
    const renderShadow = g.renderer.shadowMap.render.bind(g.renderer.shadowMap);
    g.renderer.shadowMap.render = (...args) => {
      const before = g.renderer.info.render.triangles;
      renderShadow(...args);
      shadowTriangles = g.renderer.info.render.triangles - before;
    };
    const renderFrame = g.renderer.render.bind(g.renderer);
    g.renderer.render = (scene, camera) => {
      g.renderer.info.reset();
      renderFrame(scene, camera);
    };
    g.renderer.toneMappingExposure = 1;
    g.cameraMode = 'follow';
    g.camera = g.followCamera;
    g.worldLightRig.traverse((o) => {
      if (o instanceof T.HemisphereLight) {
        o.intensity = 1.2;
        o.color.set('#eef5ff');
        o.groundColor.set('#687b55');
      }
      if (o instanceof T.DirectionalLight) {
        o.intensity = 2;
        o.shadow.bias = -0.0015;
        o.shadow.normalBias = 0.12;
        o.shadow.mapSize.set(2048, 2048);
        Object.assign(o.shadow.camera, {
          left: -35,
          right: 35,
          top: 35,
          bottom: -35,
          far: 150,
        });
      }
    });
    g.followView.distance = g.followView.targetDistance = 9;
    await g.prepareWorld();
    g.bgm.configure({ ...g.bgm.settings, muted: true });
    g.start();
    function setView(name: string) {
      reviewCamera = null;
      view = name;
      g.clearInput();
      document.querySelector('#location')!.textContent =
        `Stage03 · ${name} · WASD bergerak · F8 review`;
    }
    const review = new MapReviewMode({
      mapId: map.manifest.mapId,
      root: map.root,
      scene: g.scene,
      camera: g.followCamera,
      canvas: g.renderer.domElement,
      groundHeight: map.groundHeight,
      player: () => ({ x: g.hero.x, y: g.actor.position.y, z: g.hero.z }),
      setView,
      setReviewCamera(position, lookAt) {
        reviewCamera = { position, lookAt };
      },
      clearReviewCamera() {
        reviewCamera = null;
      },
      objectRecords: map.reviewObjects(),
      districts: Object.entries(targets).map(([name, p]) => ({
        name,
        x: p[0],
        z: p[2],
        tier: 0,
      })),
    });
    document
      .querySelectorAll<HTMLButtonElement>('[data-view]')
      .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
    const samples: number[] = [];
    let last = performance.now(),
      frame = 0;
    function hud(now: number) {
      if (token !== generation) return;
      samples.push(now - last);
      last = now;
      if (samples.length > 1800) samples.shift();
      const m = map.metrics();
      document.querySelector('#metrics')!.textContent =
        `${g.renderer.info.render.calls} draw calls · ${g.renderer.info.render.triangles.toLocaleString()} tris\n${m.materials} materials · ${(m.payload / 1048576).toFixed(1)} MiB assets\n${(1000 / (samples.reduce((a, b) => a + b, 0) / samples.length)).toFixed(0)} FPS · ${g.hero.x.toFixed(1)}, ${g.hero.z.toFixed(1)}`;
      review.update();
      frame = requestAnimationFrame(hud);
    }
    frame = requestAnimationFrame(hud);
    status.textContent = 'STAGE03 · DEVELOPMENT CANDIDATE · 250 × 250';
    const api = {
      game: g,
      city: map,
      review,
      samples,
      setView,
      teleport(id: string) {
        const a = map.anchors.find((a) => a.id === id);
        if (!a) throw Error('Unknown anchor');
        if (!map.collision.valid({ x: a.position[0], z: a.position[2] }))
          throw Error(`Unsafe anchor ${id}`);
        g.hero.x = a.position[0];
        g.hero.z = a.position[2];
        g.placeActor();
        g.cameraFocus.copy(g.actor.position);
      },
      reload: launch,
      state: () => ({
        ready: g.started,
        phase: map.manifest.phase,
        position: g.actor.position.toArray(),
        metrics: map.metrics(),
        calls: g.renderer.info.render.calls,
        triangles: g.renderer.info.render.triangles,
        primaryTriangles: g.renderer.info.render.triangles - shadowTriangles,
        shadowTriangles,
      }),
    };
    Object.assign(window, { stage03: api });
    cleanup = () => {
      cancelAnimationFrame(frame);
      review.destroy();
      g.scene.remove(map.root);
      g.dispose();
      map.dispose();
      document.querySelector('#labels')!.replaceChildren();
      document.querySelector('#world')!.replaceChildren();
    };
  } catch (error) {
    game?.dispose();
    city?.dispose();
    status.textContent = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    retry.hidden = false;
    console.error(error);
  }
}
retry.onclick = () => void launch();
addEventListener(
  'pagehide',
  () => {
    generation++;
    cleanup();
  },
  { once: true },
);
void launch();
