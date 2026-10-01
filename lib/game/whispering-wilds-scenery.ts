import * as T from 'three';
import { WILDS_ALTAR, wildsTerrainHeight } from './whispering-wilds-layout.ts';

/** Map-owned cliff strata and landmark architecture, authored specifically for this field. */
export function createWildsScenery(stone: T.Material) {
  const root = new T.Group();
  root.name = 'Whispering Wilds sculpted landmarks';
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [];
  const own = <G extends T.BufferGeometry>(g: G) => {
    geometries.push(g);
    return g;
  };
  const material = <M extends T.Material>(m: M) => {
    materials.push(m);
    return m;
  };
  function mesh(
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const o = new T.Mesh(own(g), m);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    root.add(o);
    return o;
  }
  const cyan = material(
    new T.MeshBasicMaterial({ color: '#54c9ff', toneMapped: false }),
  );
  const blue = material(
    new T.MeshBasicMaterial({
      color: '#24659e',
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  // Broken circular sanctuary with six decorated supports and three pointed arches.
  const cx = WILDS_ALTAR.x,
    cz = WILDS_ALTAR.z,
    y = wildsTerrainHeight(cx, cz);
  const altar = mesh(
    new T.CylinderGeometry(WILDS_ALTAR.radius, 25, 1.2, 48),
    stone,
    cx,
    y - 0.4,
    cz,
  );
  altar.name = 'Forest Warden circular altar';
  for (let i = 0; i < 3; i++) {
    const a = Math.PI + (i * Math.PI) / 3,
      r = 19;
    const group = new T.Group();
    group.position.set(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    group.rotation.y = -a - Math.PI / 2;
    root.add(group);
    const add = (g: T.BufferGeometry, x: number, yy: number) => {
      const o = new T.Mesh(own(g), stone);
      o.position.set(x, yy, 0);
      o.receiveShadow = true;
      group.add(o);
    };
    for (const side of [-1, 1]) {
      add(new T.CylinderGeometry(0.95, 1.35, 14, 8), side * 5, 7);
      add(new T.BoxGeometry(3.4, 1.1, 3.4), side * 5, 0.7);
      add(new T.BoxGeometry(2.8, 1.1, 2.8), side * 5, 13.6);
      add(new T.ConeGeometry(1.5, 3, 4), side * 5, 16);
    }
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-5, 14, 0),
      new T.Vector3(-3.8, 17.5, 0),
      new T.Vector3(0, 21, 0),
      new T.Vector3(3.8, 17.5, 0),
      new T.Vector3(5, 14, 0),
    ]);
    add(new T.TubeGeometry(curve, 22, 0.85, 7, false), 0, 0);
  }
  for (const radius of [6, 11, 19]) {
    const ring = mesh(
      new T.TorusGeometry(radius, 0.09, 4, 80),
      cyan,
      cx,
      y + 0.26,
      cz,
    );
    ring.rotation.x = -Math.PI / 2;
  }
  const pool = mesh(new T.CircleGeometry(5.7, 48), blue, cx, y + 0.24, cz);
  pool.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      o = mesh(
        new T.BoxGeometry(0.22, 0.05, 1.2),
        cyan,
        cx + Math.cos(a) * 14,
        y + 0.24,
        cz + Math.sin(a) * 14,
      );
    o.rotation.y = -a;
  }
  return { root, geometries, materials };
}
