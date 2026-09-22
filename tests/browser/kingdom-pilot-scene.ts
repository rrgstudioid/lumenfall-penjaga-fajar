import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { ImportedMapGround } from '../../lib/game/imported-map';
import { createTreeTrunkCollider } from '../../lib/game/tree-collision';

type Box = { name: string; min: number[]; max: number[] };
export async function buildPilot() {
  const base = '/dev-assets/kingdom-city-pilot-a3/',
    manifest = (await fetch(base + 'manifest.json').then((r) => r.json())) as {
      assets: { id: string; url: string; scale: number }[];
      materialExamples: { family: string; maps: Record<string, string> }[];
    };
  const loader = new GLTFLoader(),
    cache = new Map<string, T.Group>(),
    lods = new Map<string, T.Group[]>(),
    audit: Record<string, unknown>[] = [];
  const matCache = new Map<string, T.Material>(),
    texCache = new Map<string, T.Texture>();
  const materialKey = (m: T.Material) =>
    JSON.stringify({
      name: m.name,
      color: (m as T.MeshStandardMaterial).color?.getHex(),
      map:
        ((m as T.MeshStandardMaterial).map?.image as { src?: string })?.src ??
        (m as T.MeshStandardMaterial).map?.uuid,
      normal:
        ((m as T.MeshStandardMaterial).normalMap?.image as { src?: string })
          ?.src ?? (m as T.MeshStandardMaterial).normalMap?.uuid,
      rough:
        ((m as T.MeshStandardMaterial).roughnessMap?.image as { src?: string })
          ?.src ?? (m as T.MeshStandardMaterial).roughnessMap?.uuid,
    });
  function share(root: T.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      o.material = ms.map((m) => {
        for (const [k, v] of Object.entries(m))
          if (v instanceof T.Texture) {
            const im = v.image as {
                src?: string;
                width: number;
                height: number;
              },
              key = [
                im?.src ?? v.name,
                im?.width,
                im?.height,
                v.channel,
                v.colorSpace,
                v.wrapS,
                v.wrapT,
                v.repeat.toArray(),
                v.offset.toArray(),
              ].join('|');
            if (im?.src || v.name) {
              const old = texCache.get(key);
              if (old) (m as unknown as Record<string, unknown>)[k] = old;
              else texCache.set(key, v);
            }
          }
        const key = materialKey(m);
        if (!matCache.has(key)) matCache.set(key, m);
        return matCache.get(key)!;
      });
      if (o.material.length === 1) o.material = o.material[0];
      o.castShadow = true;
      o.receiveShadow = true;
    });
  }
  function inspect(id: string, root: T.Group) {
    root.updateMatrixWorld(true);
    let triangles = 0,
      vertices = 0,
      meshCount = 0,
      badNumbers = 0,
      missingNormals = 0,
      missingUV = 0,
      invalidIndices = 0,
      degenerate = 0;
    const materials = new Set<string>(),
      hierarchy: unknown[] = [],
      textures: unknown[] = [];
    root.traverse((o) => {
      hierarchy.push({
        name: o.name,
        type: o.type,
        position: o.position.toArray(),
        scale: o.scale.toArray(),
      });
      if (!(o instanceof T.Mesh)) return;
      meshCount++;
      const p = o.geometry.attributes.position,
        idx = o.geometry.index;
      vertices += p.count;
      triangles += (idx?.count ?? p.count) / 3;
      if (!o.geometry.attributes.normal) missingNormals++;
      if (!o.geometry.attributes.uv) missingUV++;
      for (const attr of Object.values(
        o.geometry.attributes,
      ) as T.BufferAttribute[])
        for (const n of attr.array) if (!Number.isFinite(n)) badNumbers++;
      if (idx) for (const n of idx.array) if (n >= p.count) invalidIndices++;
      const a = new T.Vector3(),
        b = new T.Vector3(),
        c = new T.Vector3();
      for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
        a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
        b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
        c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
        if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-18) degenerate++;
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m.name);
        for (const [role, t] of Object.entries(m))
          if (t instanceof T.Texture) {
            const im = t.image as {
              width: number;
              height: number;
              src?: string;
            };
            textures.push({
              material: m.name,
              role,
              width: im?.width,
              height: im?.height,
              source: im?.src ?? 'embedded',
              colorSpace: t.colorSpace,
            });
          }
      }
    });
    const b = new T.Box3().setFromObject(root);
    return {
      id,
      meshCount,
      vertices,
      triangles,
      bounds: { min: b.min.toArray(), max: b.max.toArray() },
      dimensions: b.getSize(new T.Vector3()).toArray(),
      materials: [...materials],
      textures,
      hierarchy,
      badNumbers,
      missingNormals,
      missingUV,
      invalidIndices,
      degenerate,
      negativeScale: hierarchy.some((x: any) =>
        x.scale.some((n: number) => n < 0),
      ),
    };
  }
  for (const a of manifest.assets) {
    const g = await loader.loadAsync(a.url);
    g.scene.name = a.id;
    share(g.scene);
    g.scene.scale.setScalar(a.scale);
    g.scene.updateMatrixWorld(true);
    cache.set(a.id, g.scene);
    audit.push(inspect(a.id, g.scene));
  }
  const id = (name: string) => 'env_model_' + name,
    treeId = 'env_package_tree_small_02_2k',
    rockId = 'env_package_boulder_01_2k';
  const simplifier = new SimplifyModifier();
  for (const name of [
    'roof_tower_roundtiles',
    'wall_plaster_straight',
    'wall_plaster_door_round',
    'doorframe_round_brick',
    'corner_exterior_brick',
  ]) {
    const source = cache.get(id(name))!,
      levels = [source];
    for (const ratio of [0.25, 0.5]) {
      const l = source.clone(true);
      l.traverse((o) => {
        if (o instanceof T.Mesh && o.geometry.attributes.position.count > 90) {
          o.geometry = simplifier.modify(
            o.geometry,
            Math.floor(o.geometry.attributes.position.count * ratio),
          );
          o.geometry.computeVertexNormals();
        }
      });
      levels.push(l);
      audit.push(inspect(id(name) + '_lod' + (levels.length - 1), l));
    }
    lods.set(id(name), levels);
  }
  const treeLevels = [cache.get(treeId)!];
  for (const level of [1, 2]) {
    const g = await loader.loadAsync(
      base + 'models/' + treeId + '/lod' + level + '.glb',
    );
    share(g.scene);
    treeLevels.push(g.scene);
    audit.push(inspect(treeId + '_lod' + level, g.scene));
  }
  lods.set(treeId, treeLevels);
  const root = new T.Group(),
    display = new T.Group(),
    debug = new T.Group(),
    collisionRoot = new T.Group();
  root.add(display, debug);
  debug.visible = false;
  const boxes: Box[] = [],
    debugMat = new T.MeshBasicMaterial({
      color: 0x35e5cb,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
  function box(name: string, min: number[], max: number[]) {
    boxes.push({ name, min, max });
    const m = new T.Mesh(
      new T.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
      debugMat,
    );
    m.position.set(
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    );
    debug.add(m);
  }
  const walkMat = new T.MeshBasicMaterial({ name: 'pilot-walk' }),
    groundMesh = new T.Mesh(
      new T.PlaneGeometry(180, 180),
      new T.MeshStandardMaterial({ color: '#687b52', roughness: 1 }),
    );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  root.add(groundMesh);
  const floorWalk = new T.Mesh(groundMesh.geometry, walkMat);
  floorWalk.rotation.copy(groundMesh.rotation);
  collisionRoot.add(floorWalk);
  const road = new T.Mesh(
    new T.PlaneGeometry(6, 38),
    new T.MeshStandardMaterial({ color: '#a69d82', roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.015, 4);
  root.add(road);
  const grid = new T.GridHelper(120, 40, 0x7c806a, 0x6f7f60);
  grid.position.y = 0.007;
  root.add(grid);
  let level = 0;
  const instances: {
    id: string;
    container: T.Group;
    position: number[];
    rotation: number;
    ground: boolean;
  }[] = [];
  function model(
    assetId: string,
    x: number,
    y: number,
    z: number,
    rotation = 0,
    owner = display,
    ground = false,
  ) {
    const container = new T.Group();
    container.position.set(x, y, z);
    container.rotation.y = rotation;
    owner.add(container);
    instances.push({
      id: assetId,
      container,
      position: [x, y, z],
      rotation,
      ground,
    });
    fill(instances.at(-1)!);
    return container;
  }
  function fill(inst: (typeof instances)[number]) {
    inst.container.clear();
    const source = lods.get(inst.id)?.[level] ?? cache.get(inst.id)!;
    const mesh = source.clone(true);
    if (inst.ground) {
      const b = new T.Box3().setFromObject(mesh);
      mesh.position.y -= b.min.y;
    }
    inst.container.add(mesh);
  }
  function wall(
    x: number,
    z: number,
    rot = 0,
    height = 0,
    owner = display,
    collision = true,
  ) {
    const obj = model(id('wall_plaster_straight'), x, height, z, rot, owner);
    if (collision) {
      const b = new T.Box3().setFromObject(obj);
      box('wall', b.min.toArray(), b.max.toArray());
    }
    return obj;
  }
  // Ray-sample the actual assembled door opening at capsule-relevant heights.
  function opening(asset: T.Group) {
    const ray = new T.Raycaster(),
      clear: number[] = [];
    asset.updateMatrixWorld(true);
    for (let x = -1.4; x <= 1.4; x += 0.025) {
      let ok = true;
      for (let y = 0.12; y <= 2.6; y += 0.08) {
        ray.set(new T.Vector3(x, y, 3), new T.Vector3(0, 0, -1));
        if (ray.intersectObject(asset, true).length) {
          ok = false;
          break;
        }
      }
      if (ok) clear.push(x);
    }
    const center = clear.filter((x) => Math.abs(x) < 1.35);
    let left = 0,
      right = 0;
    while (center.some((x) => Math.abs(x - (left - 0.025)) < 0.014))
      left -= 0.025;
    while (center.some((x) => Math.abs(x - (right + 0.025)) < 0.014))
      right += 0.025;
    return {
      left,
      right,
      width: right - left,
      checkedHeight: 2.6,
      step: 0.025,
    };
  }
  const doorAssembly = new T.Group();
  doorAssembly.add(
    cache.get(id('wall_plaster_door_round'))!.clone(),
    cache.get(id('doorframe_round_brick'))!.clone(),
  );
  const aperture = opening(doorAssembly);
  function door(x: number, z: number, owner = display, collision = true) {
    model(id('wall_plaster_door_round'), x, 0, z, 0, owner);
    model(id('doorframe_round_brick'), x, 0, z + 0.035, 0, owner);
    if (collision) {
      box(
        'door-left',
        [x - 1.5, 0, z - 0.48],
        [x + aperture.left, 4.5, z + 0.35],
      );
      box(
        'door-right',
        [x + aperture.right, 0, z - 0.48],
        [x + 1.5, 4.5, z + 0.35],
      );
      box(
        'door-lintel',
        [x + aperture.left, aperture.checkedHeight, z - 0.48],
        [x + aperture.right, 4.5, z + 0.35],
      );
    }
  }
  function tower(x: number, z: number, owner = display, collision = true) {
    for (const y of [0, 4.5]) {
      for (const dz of [-3, 3])
        for (const dx of [-1.5, 1.5])
          wall(x + dx, z + dz, dz > 0 ? 0 : Math.PI, y, owner, collision);
      for (const dx of [-3, 3])
        for (const dz of [-1.5, 1.5])
          wall(
            x + dx,
            z + dz,
            dx > 0 ? Math.PI / 2 : -Math.PI / 2,
            y,
            owner,
            collision,
          );
    }
    model(id('roof_tower_roundtiles'), x, 9, z, 0, owner);
  }
  function house(x: number, z: number, owner = display, collision = true) {
    for (const dx of [-1.5, 1.5])
      for (const dz of [-1.5, 1.5])
        model(id('floor_brick'), x + dx, 0.02, z + dz, 0, owner);
    door(x - 1.5, z + 3, owner, collision);
    wall(x + 1.5, z + 3, 0, 0, owner, collision);
    for (const dx of [-1.5, 1.5])
      wall(x + dx, z - 3, Math.PI, 0, owner, collision);
    for (const dx of [-3, 3])
      for (const dz of [-1.5, 1.5])
        wall(
          x + dx,
          z + dz,
          dx > 0 ? Math.PI / 2 : -Math.PI / 2,
          0,
          owner,
          collision,
        );
    model(id('roof_tower_roundtiles'), x, 4.5, z, 0, owner);
    for (const [dx, dz, rot] of [
      [-3, -3, 0],
      [3, -3, -Math.PI / 2],
      [3, 3, Math.PI],
      [-3, 3, Math.PI / 2],
    ])
      model(id('corner_exterior_brick'), x + dx, 0, z + dz, rot, owner);
  }
  door(0, 0);
  wall(-3, 0);
  wall(3, 0);
  tower(-9, 0);
  house(12, -10);
  const propList = [
    'barrel',
    'crate_wooden',
    'bench',
    'lantern_wall',
    'banner_1',
  ];
  for (const [i, name] of propList.entries())
    model(
      id(name),
      name === 'lantern_wall' ? 3 : i % 2 ? 3.5 : -3.7,
      name === 'lantern_wall' ? 2.3 : 0,
      name === 'lantern_wall' ? 0.15 : 5 + i * 2,
      0,
      display,
      name !== 'lantern_wall',
    );
  const tree = model(treeId, 7, 0, 9),
    rock = model(rockId, 11, 0, 9, 0, display, true);
  // Derive a conservative lower-trunk collider from sampled source bark/trunk slices.
  const trunkSource = cache.get(treeId)!.clone(true);
  trunkSource.traverse((o) => {
    if (o instanceof T.Mesh) {
      const wasArray = Array.isArray(o.material);
      const cloned = (
        wasArray ? (o.material as T.Material[]) : [o.material as T.Material]
      ).map((m) => {
        const c = m.clone();
        if (/trunk/.test(m.name)) c.name += ' bark';
        return c;
      });
      o.material = wasArray ? cloned : cloned[0];
    }
  });
  trunkSource.position.set(7, 0, 9);
  const trunk = createTreeTrunkCollider(trunkSource, 0);
  const tc = new T.Mesh(
    new T.CylinderGeometry(trunk.radius, trunk.radius, trunk.maxY, 16),
    debugMat,
  );
  tc.position.set(trunk.x, trunk.maxY / 2, trunk.z);
  debug.add(tc);
  const rb = new T.Box3().setFromObject(rock);
  box('rock-conservative-box', rb.min.toArray(), rb.max.toArray());
  const stairs = model(id('stairs_exterior_nofirststep'), -6, 0, 12);
  stairs.updateMatrixWorld(true);
  const stairProbe = new T.Group();
  stairs.traverse((o) => {
    if (o instanceof T.Mesh) {
      const walk = new T.Mesh(o.geometry, walkMat);
      walk.applyMatrix4(o.matrixWorld);
      stairProbe.add(walk);
    }
  });
  const sb = new T.Box3().setFromObject(stairs),
    sg = new ImportedMapGround(stairProbe, ['pilot-walk']);
  const lowAtMax =
    (sg.heightAt(-6, sb.max.z - 0.15) ?? 0) <
    (sg.heightAt(-6, sb.min.z + 0.15) ?? 0);
  const lowZ = lowAtMax ? sb.max.z : sb.min.z,
    highZ = lowAtMax ? sb.min.z : sb.max.z;
  const ramp = new T.BufferGeometry();
  ramp.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        sb.min.x,
        0,
        lowZ,
        sb.max.x,
        0,
        lowZ,
        sb.max.x,
        sb.max.y,
        highZ,
        sb.min.x,
        sb.max.y,
        highZ,
      ],
      3,
    ),
  );
  ramp.setIndex(lowAtMax ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  ramp.computeVertexNormals();
  collisionRoot.add(new T.Mesh(ramp, walkMat));
  debug.add(new T.Mesh(ramp, debugMat));
  const landing = model(
    id('stairs_exterior_platform'),
    -6,
    0,
    highZ + (lowAtMax ? -1.5 : 1.5),
  );
  landing.updateMatrixWorld(true);
  landing.traverse((o) => {
    if (o instanceof T.Mesh) {
      const m = new T.Mesh(o.geometry, walkMat);
      m.applyMatrix4(o.matrixWorld);
      collisionRoot.add(m);
    }
  });
  const treadHeights = new Set<number>();
  stairs.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const p = o.geometry.attributes.position, ix = o.geometry.index;
    for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
      const v = [0, 1, 2].map(j => new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + j) : i + j).applyMatrix4(o.matrixWorld));
      if (Math.max(...v.map(q => q.y)) - Math.min(...v.map(q => q.y)) < 0.001 && v[0].y > 0.01)
        treadHeights.add(Math.round(v[0].y * 10000) / 10000);
    }
  });
  const levels = [...treadHeights].sort((a, b) => a - b);
  const stairsMeasurement = {
    lowZ,
    highZ,
    rise: sb.max.y,
    run: Math.abs(highZ - lowZ),
    horizontalSurfaceHeights: levels,
    observedRiserIntervals: levels.slice(1).map((y, i) => Math.round((y - levels[i]) * 10000) / 10000),
    collision: 'authored walk ramp + source landing; render stair preserved',
    direction: lowAtMax ? -1 : 1,
  };
  collisionRoot.updateMatrixWorld(true);
  const ground = new ImportedMapGround(collisionRoot, ['pilot-walk']);
  function blocked(x: number, z: number) {
    const y = ground.heightAt(x, z) ?? 0,
      r = 0.45;
    return boxes.some(
      (b) =>
        y < b.max[1] - 0.01 &&
        y + 2.4 > b.min[1] + 0.01 &&
        Math.hypot(
          x - Math.max(b.min[0], Math.min(b.max[0], x)),
          z - Math.max(b.min[2], Math.min(b.max[2], z)),
        ) <
          r - 0.001,
    );
  }
  function move(from: { x: number; z: number }, dx: number, dz: number) {
    let p = { ...from };
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
    for (let i = 0; i < n; i++) {
      const candidates = [
        ground.move(p, dx / n, dz / n),
        ground.move(p, dx / n, 0),
        ground.move(p, 0, dz / n),
      ];
      const next = candidates.find((v) => !blocked(v.x, v.z));
      if (next) p = next;
    }
    return p;
  }
  const remapMats = new Map<string, T.MeshStandardMaterial>();
  for (const m of manifest.materialExamples) {
    const mat = new T.MeshStandardMaterial({
      name: 'LUMENFALL:' + m.family,
      roughness: 0.85,
      metalness: m.family === 'metal' ? 0.8 : 0,
    });
    for (const [role, url] of Object.entries(m.maps)) {
      const t = await new T.TextureLoader().loadAsync(url as string);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.colorSpace = role === 'color' ? T.SRGBColorSpace : T.NoColorSpace;
      t.flipY = false;
      const key = (
        {
          color: 'map',
          normal: 'normalMap',
          roughness: 'roughnessMap',
          metalness: 'metalnessMap',
        } as const
      )[role as 'color'];
      (mat as any)[key] = t;
    }
    remapMats.set(m.family, mat);
  }
  const family = (name: string) =>
    /plaster/i.test(name)
      ? 'plaster_brick'
      : /tile|roof/i.test(name)
        ? 'roof_tile'
        : /wood|furniture/i.test(name)
          ? 'wood'
          : /metal|iron/i.test(name)
            ? 'metal'
            : /cloth|fabric|banner/i.test(name)
              ? 'fabric_banner'
              : /brick|rock|stone/i.test(name)
                ? 'stone_architecture'
                : null;
  let remapped = false;
  const remapBindings: unknown[] = [];
  function setRemap(value: boolean) {
    remapped = value;
    display.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      if (!o.userData.sourceMaterial) o.userData.sourceMaterial = o.material;
      const original = o.userData.sourceMaterial as T.Material | T.Material[];
      const ms = Array.isArray(original) ? original : [original];
      const next = ms.map((m) => {
        const f = family(m.name);
        if (!f) return m;
        if (!remapBindings.some((x: any) => x.material === m.name))
          remapBindings.push({
            material: m.name,
            family: f,
            policy: 'CONTROLLED_REMAP_EXAMPLE',
            default: 'KEEP_SOURCE_MATERIAL',
            uv: 'source UV retained; atlas-to-tiling seams require artist review',
          });
        return value ? remapMats.get(f)! : m;
      });
      o.material = Array.isArray(original) ? next : next[0];
    });
  }
  const bench = new T.Group();
  root.add(bench);
  bench.visible = false;
  let mode = 'pilot';
  const instancedDisposables: T.InstancedMesh[] = [];
  function setMode(next: string) {
    for (const mesh of instancedDisposables.splice(0)) mesh.dispose();
    bench.clear();
    instances.splice(
      0,
      instances.length,
      ...instances.filter((x) => display.getObjectById(x.container.id)),
    );
    mode = next;
    display.visible = next === 'pilot';
    bench.visible = next !== 'pilot';
    if (next === 'pilot') return;
    for (let i = 0; i < 10; i++)
      house(-28 + (i % 5) * 13, -30 - Math.floor(i / 5) * 17, bench, false);
    for (let i = 0; i < 24; i++) wall(-34 + i * 3, 26, 0, 0, bench, false);
    for (let i = 0; i < 4; i++) tower(-35 + i * 24, 42, bench, false);
    for (let i = 0; i < 20; i++)
      model(
        treeId,
        -34 + (i % 10) * 7,
        0,
        16 + Math.floor(i / 10) * 6,
        0,
        bench,
      );
    for (let i = 0; i < 40; i++)
      model(
        id(propList[i % 5]),
        -32 + (i % 10) * 7,
        0,
        -5 - Math.floor(i / 10) * 4,
        0,
        bench,
        true,
      );
    bench.updateMatrixWorld(true);
    if (next === 'instanced') {
      const batches = new Map<
        string,
        {
          geometry: T.BufferGeometry;
          material: T.Material | T.Material[];
          matrices: T.Matrix4[];
        }
      >();
      bench.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const key =
          o.geometry.uuid +
          '|' +
          (Array.isArray(o.material)
            ? o.material.map((m) => m.uuid).join(',')
            : o.material.uuid);
        if (!batches.has(key))
          batches.set(key, {
            geometry: o.geometry,
            material: o.material,
            matrices: [],
          });
        batches.get(key)!.matrices.push(o.matrixWorld.clone());
      });
      bench.clear();
      for (const b of batches.values()) {
        const m = new T.InstancedMesh(
          b.geometry,
          b.material,
          b.matrices.length,
        );
        b.matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingBox();
        m.computeBoundingSphere();
        m.castShadow = true;
        m.receiveShadow = true;
        bench.add(m);
        instancedDisposables.push(m);
      }
    }
  }
  function setLod(next: number) {
    level = next;
    for (const i of instances.filter((x) =>
      display.getObjectById(x.container.id),
    ))
      fill(i);
    setRemap(remapped);
    if (mode !== 'pilot') setMode(mode);
  }
  function resources() {
    const mats = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    root.traverse((o) => {
      if (o instanceof T.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          mats.add(m);
          for (const v of Object.values(m))
            if (v instanceof T.Texture) textures.add(v);
        }
    });
    let bytes = 0;
    for (const t of textures) {
      const im = t.image as { width?: number; height?: number };
      bytes += ((im?.width ?? 0) * (im?.height ?? 0) * 4 * 4) / 3;
    }
    return {
      materials: mats.size,
      textures: textures.size,
      estimatedTextureMiB: bytes / 1048576,
      estimate:
        'RGBA8+mips; excludes driver overhead, framebuffer and character; not measured VRAM',
    };
  }
  function dispose() {
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>(),
      ts = new Set<T.Texture>();
    for (const object of [
      root,
      collisionRoot,
      ...cache.values(),
      ...[...lods.values()].flat(),
    ])
      object.traverse((o) => {
        if (o instanceof T.Mesh) {
          gs.add(o.geometry);
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            ms.add(m);
            for (const t of Object.values(m))
              if (t instanceof T.Texture) ts.add(t);
          }
        }
      });
    for (const m of remapMats.values()) {
      ms.add(m);
      for (const t of Object.values(m)) if (t instanceof T.Texture) ts.add(t);
    }
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
    ts.forEach((t) => t.dispose());
    instancedDisposables.forEach((m) => m.dispose());
    root.removeFromParent();
  }
  return {
    root,
    display,
    debug,
    boxes,
    ground,
    move,
    trunk,
    aperture,
    manifest,
    audit,
    remapBindings,
    setRemap,
    setLod,
    setMode,
    resources,
    dispose,
    cache,
    lods,
    stairs,
    stairsMeasurement,
    counts: { houses: 10, walls: 24, towers: 4, trees: 20, props: 40 },
  };
}
