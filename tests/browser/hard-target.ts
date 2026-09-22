// Development-only visual fixture: real input handler/picking/basic attack/target UI.
// A small scene replaces world assets/AI only. No localStorage access or skill registration.
import * as T from 'three';
import { Game } from '../../lib/game/world';
import { freshHero } from '../../lib/game/rules';
import { FIELDS } from '../../lib/game/regions';
import '../../app/globals.css';

const style = document.createElement('style');
style.textContent =
  'body{margin:0;background:#182320;color:#f5dfb0;font:16px sans-serif}#scene{position:relative;width:100vw;height:80vh}canvas{display:block}aside{padding:16px}h1{font-size:20px}button{border:1px solid #cfa75a;padding:8px 16px;margin:10px 0}output{display:block;white-space:pre-wrap}.current-target-frame{top:16px}';
document.head.appendChild(style);
const host = document.querySelector<HTMLDivElement>('#scene')!,
  output = document.querySelector<HTMLOutputElement>('#result')!;
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(host.clientWidth, host.clientHeight);
host.appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color('#253933');
const camera = new T.PerspectiveCamera(
  42,
  host.clientWidth / host.clientHeight,
  0.1,
  100,
);
camera.position.set(0, 9, 12);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
scene.add(new T.HemisphereLight('#fff5d0', '#223e31', 3));
const floor = new T.Mesh(
  new T.PlaneGeometry(40, 40),
  new T.MeshStandardMaterial({ color: '#43574a' }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const hero = freshHero();
// Default is a real public-style legacy hero; opt-in V2 keeps the old fixture available.
if (new URLSearchParams(location.search).get('architecture') === 'v2_test')
  hero.progressionArchitecture = 'v2_test';
const actor = new T.Group();
actor.position.set(0, 0, 1.4);
scene.add(actor);
const body = new T.Mesh(
  new T.CapsuleGeometry(0.3, 0.7),
  new T.MeshStandardMaterial({ color: '#abcbe2' }),
);
body.position.y = 0.7;
actor.add(body);
const game = Object.create(Game.prototype) as Game;
Object.assign(game, {
  hero,
  scene,
  camera,
  renderer,
  actor,
  labelHost: host,
  direction: new T.Vector3(0, 0, -1),
  pointer: new T.Vector2(),
  raycaster: new T.Raycaster(),
  currentTarget: null,
  started: true,
  paused: false,
  dead: false,
  disposed: false,
  hotbarInteracting: false,
  regionBuildToken: 1,
  combatTime: 0,
  attackTimer: 0,
  combo: 0,
  comboWindow: 0,
  enemies: [],
  characterModel: { animator: { play() {} } },
  effect() {},
  ring() {},
  sound() {},
  save() {},
  emit() {},
  tryNpcInteraction() {
    return false;
  },
  moveEnemy() {},
  rand() {
    return 1;
  },
  message(text: string) {
    output.textContent = text;
  },
  float() {},
});
const report = () => {
  const t = game.currentTargetView();
  output.textContent = t
    ? `${t.name}: ${t.hp}/${t.maxHP} HP | selected rings: ${game.enemies.filter((e) => e.group.getObjectByName('current-target-ring')).length}`
    : 'No selected target';
};
const setup = () => {
  game.clearCurrentTarget();
  for (const enemy of game.enemies) {
    game.unregisterTargetEnemy(enemy);
    scene.remove(enemy.group);
    enemy.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    enemy.ring.geometry.dispose();
    (enemy.ring.material as T.Material).dispose();
  }
  game.enemies = [];
  for (const [i, x] of [-1.6, 1.6].entries()) {
    const group = new T.Group();
    group.position.set(x, 0, 0);
    const mesh = new T.Mesh(
      new T.CapsuleGeometry(0.6, 1.2),
      new T.MeshStandardMaterial({ color: i ? '#b67558' : '#789760' }),
    );
    mesh.position.y = 1.2;
    group.add(mesh);
    scene.add(group);
    const enemy: Game['enemies'][number] = {
      id: i + 1,
      hp: 1000,
      max: 1000,
      group,
      home: group.position.clone(),
      respawnKey: `2d-${i}`,
      respawnDeadline: 0,
      respawn: 0,
      cooldown: 0,
      windup: 0,
      flash: 0,
      ring: new T.Mesh(),
      attack: 10,
      attackRange: 2,
      movementSpeed: 2,
      stun: 0,
      slow: 0,
      root: 0,
      poison: 0,
      poisonTick: 0,
      defenseDown: 0,
      marked: false,
      weakPoint: false,
      boss: false,
      definition: {
        ...FIELDS['verdant-plains'].normalMonsters[0],
        name: i ? 'Fixture B' : 'Fixture A',
        level: 15,
        defense: 0,
        magicDefense: 0,
        variant: 'normal',
      },
    };
    game.enemies.push(enemy);
    game.registerTargetEnemy(enemy);
  }
  report();
};
game.pointermove = (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  game.pointer.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    (-(e.clientY - r.top) / r.height) * 2 + 1,
  );
};
renderer.domElement.addEventListener('pointerdown', (e) => {
  game.handleWorldPointerDown(e);
  report();
});
document.querySelector('#remove')!.addEventListener('click', () => {
  const enemy = game.getCurrentTarget();
  if (enemy) {
    game.unregisterTargetEnemy(enemy);
    scene.remove(enemy.group);
  }
  report();
});
document.querySelector('#reset')!.addEventListener('click', setup);
setup();
const clock = new T.Clock();
renderer.setAnimationLoop(() => {
  game.attackTimer = Math.max(0, game.attackTimer - clock.getDelta());
  game.updateTargetPresentation();
  renderer.render(scene, camera);
});
window.addEventListener(
  'pagehide',
  () => {
    renderer.setAnimationLoop(null);
    game.clearCurrentTarget();
    game.targetPresentation?.dispose();
    renderer.dispose();
  },
  { once: true },
);
