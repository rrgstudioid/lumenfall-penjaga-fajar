import { MINE_RAIL_SECTIONS, railSleepers } from './ironveil-interior-rails';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GraphicsQuality } from './graphics-quality';
import {
  MINE_TEXTURES,
  createMineMaterials,
} from './ironveil-interior-materials';
import {
  MINE_ID,
  MINE_ENTRY,
  MINE_EXIT,
  MINE_HUD_MINIMAP_VIEW_SIZE,
  MINE_ROOMS,
  mineTimberFrames,
  MINE_BLOCKERS,
  MINE_LANDMARKS,
  MINE_BRIDGE,
  MineNavigation,
  mineGroundHeight,
  mineCeiling,
  mineDistance,
  mineLanterns,
  mineLineOfSight,
  mineBakedLight,
  drawMineLocalMinimap,
  type MinePoint,
} from './ironveil-interior-layout';

const ROOT = '/assets/maps/ironveil-mines-interior-v1/';
const SHARED = '/assets/maps/ironveil-mines-exterior-v1/';
const POOL = { office: 4, light: 6, balanced: 8, high: 10 };
export async function buildIronveilInterior(
  quality: GraphicsQuality = 'office',
) {
  const root = new T.Group();
  root.name = MINE_ID;
  const surfaces = new T.Group();
  surfaces.name = 'Interior walk surfaces';
  root.add(surfaces);
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const cells = new Map<string, T.Object3D[]>();
  let disposed = false,
    currentQuality = quality;
  const ownG = <G extends T.BufferGeometry>(g: G) => {
    geometries.add(g);
    return g;
  };
  const ownM = <M extends T.Material>(m: M) => {
    materials.add(m);
    return m;
  };
  const ownT = (t: T.Texture) => {
    textures.add(t);
    return t;
  };
  function track(o: T.Object3D) {
    o.traverse((n) => {
      if (n instanceof T.Mesh) {
        ownG(n.geometry);
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          ownM(m);
          for (const value of Object.values(m))
            if (value instanceof T.Texture) ownT(value);
        }
      }
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    root.clear();
  }
  const cellKey = (x: number, z: number) =>
    `${Math.floor((x + 500) / 50)}:${Math.floor((z + 500) / 50)}`;
  const cellAdd = (o: T.Object3D, x: number, z: number) => {
    const key = cellKey(x, z);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(o);
  };
  try {
    const gltf = new GLTFLoader(),
      tl = new T.TextureLoader();
    const jobs = Object.entries(MINE_TEXTURES).map(async ([k, url]) => {
      const t = ownT(await tl.loadAsync(url));
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
      return [k, t] as const;
    });
    const loaded = await Promise.allSettled(jobs);
    const failed = loaded.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const tex = Object.fromEntries(
      loaded.map(
        (r) =>
          (r as PromiseFulfilledResult<readonly [string, T.Texture]>).value,
      ),
    ) as Record<keyof typeof MINE_TEXTURES, T.Texture>;
    const mat = createMineMaterials(tex);
    Object.values(mat).forEach(ownM);
    const packages = await Promise.allSettled(
      ['cave-shell.glb', 'crate.glb', 'barrel.glb', 'owner-rock-01.glb'].map(
        async (name) => {
          const asset = await gltf.loadAsync(
            (name === 'cave-shell.glb' ? ROOT : SHARED) + name,
          );
          track(asset.scene);
          return asset.scene;
        },
      ),
    );
    const error = packages.find((r) => r.status === 'rejected');
    if (error?.status === 'rejected') throw error.reason;
    const [shell, crate, barrel, rock] = packages.map(
      (r) => (r as PromiseFulfilledResult<T.Group>).value,
    );
    let shellTriangles = 0;
    const shellMeshes: T.Mesh[] = [];
    shell.traverse((o) => {
      if (o instanceof T.Mesh) shellMeshes.push(o);
    });
    for (const mesh of shellMeshes) {
      if (!(mesh instanceof T.Mesh)) continue;
      const kind = mesh.userData.surface as 'floor' | 'rock' | 'bridge';
      mesh.material = mat[kind];
      shellTriangles +=
        (mesh.geometry.index?.count ??
          mesh.geometry.attributes.position.count) / 3;
      (kind === 'floor' || kind === 'bridge' ? surfaces : root).add(mesh);
      cellAdd(
        mesh,
        mesh.userData.cellX * 50 - 475,
        mesh.userData.cellZ * 50 - 475,
      );
    }
    const box = ownG(new T.BoxGeometry(1, 1, 1)),
      sphere = ownG(new T.IcosahedronGeometry(1, 0));
    const batches = new Map<
      string,
      {
        geometry: T.BufferGeometry;
        material: T.Material;
        matrices: T.Matrix4[];
        colors: T.Color[];
        x: number;
        z: number;
      }
    >();
    const dummy = new T.Object3D();
    function instance(
      geometry: T.BufferGeometry,
      material: T.Material,
      p: T.Vector3,
      scale: T.Vector3,
      yaw = 0,
      rotation?: T.Quaternion,
      bake = true,
    ) {
      const key = `${cellKey(p.x, p.z)}:${geometry.uuid}:${material.uuid}`;
      if (!batches.has(key))
        batches.set(key, {
          geometry,
          material,
          matrices: [],
          colors: [],
          x: p.x,
          z: p.z,
        });
      dummy.position.copy(p);
      dummy.scale.copy(scale);
      dummy.rotation.set(0, yaw, 0);
      if (rotation) dummy.quaternion.copy(rotation);
      dummy.updateMatrix();
      const batch = batches.get(key)!;
      batch.matrices.push(dummy.matrix.clone());
      batch.colors.push(
        bake ? new T.Color(...mineBakedLight(p)) : new T.Color(1, 1, 1),
      );
    }
    function beam(
      a: T.Vector3,
      b: T.Vector3,
      width: number,
      material: T.Material = mat.wood,
    ) {
      const delta = b.clone().sub(a),
        q = new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          delta.clone().normalize(),
        );
      instance(
        box,
        material,
        a.clone().add(b).multiplyScalar(0.5),
        new T.Vector3(width, delta.length(), width),
        0,
        q,
      );
    }
    const at = (p: MinePoint, dy = 0) =>
      new T.Vector3(p.x, mineGroundHeight(p.x, p.z) + dy, p.z);
    function frame(p: MinePoint, width: number, height: number, yaw = 0) {
      const c = at(p),
        side = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const a = c.clone().addScaledVector(side, -width / 2),
        b = c.clone().addScaledVector(side, width / 2),
        top = new T.Vector3(0, height, 0);
      beam(a, a.clone().add(top), 1.1);
      beam(b, b.clone().add(top), 1.1);
      beam(a.clone().add(top), b.clone().add(top), 1.3);
      for (const sign of [-1, 1])
        beam(
          c
            .clone()
            .addScaledVector(side, (sign * width) / 2)
            .add(new T.Vector3(0, height - 4, 0)),
          c
            .clone()
            .addScaledVector(side, sign * (width / 2 - 4))
            .add(top),
          0.65,
        );
    }
    // Entrance is a dark closed recess behind a single 16 x 12 timber threshold.
    frame({ x: 0, z: 449.4 }, 17.2, 12.8);
    const door = new T.Mesh(
      ownG(new T.PlaneGeometry(16, 12)),
      ownM(new T.MeshBasicMaterial({ color: '#050504', side: T.DoubleSide })),
    );
    door.name = 'Single interior exit';
    door.position.set(0, 6, 449.75);
    door.userData.ironveilInteriorExit = true;
    root.add(door);
    cellAdd(door, 0, 449);
    // Continuous I-section steel rails: shared cross-sections eliminate the old
    // independently offset box ends. Sleepers use one arc-length clock per route.
    const railMaterial = ownM(
      new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }),
    );
    const railCells = new Map<
      string,
      { positions: number[]; colors: number[]; x: number; z: number }
    >();
    const profile = [
      [-0.15, 0.035],
      [0.15, 0.035],
      [0.15, 0.075],
      [0.045, 0.075],
      [0.045, 0.19],
      [0.11, 0.19],
      [0.11, 0.26],
      [-0.11, 0.26],
      [-0.11, 0.19],
      [-0.045, 0.19],
      [-0.045, 0.075],
      [-0.15, 0.075],
    ];
    let railTriangles = 0;
    for (const [routeIndex, sections] of MINE_RAIL_SECTIONS.entries()) {
      for (const p of railSleepers(sections)) {
        // The main route supplies the shared sleepers at each switch toe.
        if (routeIndex > 0 && p.distance < 7) continue;
        const len = Math.hypot(p.nx, p.nz);
        beam(
          at(
            { x: p.x - (p.nx / len) * 2.1, z: p.z - (p.nz / len) * 2.1 },
            0.04,
          ),
          at(
            { x: p.x + (p.nx / len) * 2.1, z: p.z + (p.nz / len) * 2.1 },
            0.04,
          ),
          0.13,
        );
      }
      for (const side of [-1, 1]) {
        const rings = sections.map((p) =>
          profile.map(([offset, h]) => {
            const x = p.x + p.nx * (side * 1.4 + offset),
              z = p.z + p.nz * (side * 1.4 + offset);
            return [x, mineGroundHeight(x, z) + h, z];
          }),
        );
        for (let i = 1; i < sections.length; i++) {
          const p = sections[i],
            key = cellKey(p.x, p.z);
          if (!railCells.has(key))
            railCells.set(key, { positions: [], colors: [], x: p.x, z: p.z });
          const batch = railCells.get(key)!;
          const light = mineBakedLight({
              ...p,
              y: mineGroundHeight(p.x, p.z) + 0.2,
            }),
            intensity = Math.min(0.85, 0.22 + light[0] * 0.65);
          for (let j = 0; j < profile.length; j++) {
            const k = (j + 1) % profile.length;
            const color = new T.Color(
              j === 6 ? '#bdc5cc' : j >= 4 && j <= 8 ? '#7d8790' : '#594b41',
            ).multiplyScalar(intensity);
            for (const vertex of [
              rings[i - 1][j],
              rings[i][j],
              rings[i][k],
              rings[i - 1][j],
              rings[i][k],
              rings[i - 1][k],
            ]) {
              batch.positions.push(...vertex);
              batch.colors.push(color.r, color.g, color.b);
            }
            railTriangles += 2;
          }
        }
      }
    }
    for (const batch of railCells.values()) {
      const geometry = ownG(new T.BufferGeometry());
      geometry.setAttribute(
        'position',
        new T.Float32BufferAttribute(batch.positions, 3),
      );
      geometry.setAttribute(
        'color',
        new T.Float32BufferAttribute(batch.colors, 3),
      );
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, railMaterial);
      mesh.name = 'Continuous steel rails';
      root.add(mesh);
      cellAdd(mesh, batch.x, batch.z);
    }
    for (const f of mineTimberFrames()) frame(f, f.width, f.height, f.yaw);
    // Bridge deck shares the analytic floor, with a visible dark fissure under it.
    const bp = MINE_BRIDGE,
      along = new T.Vector3(1, 0, -1).normalize(),
      across = new T.Vector3(1, 0, 1).normalize(),
      bc = at(bp);
    // The clipped floor is the deck. Separate plank meshes would intersect the
    // gentle slope and produce a diagonal seam; thin joins follow its surface.
    for (let i = -13; i <= 13; i += 1.2) {
      const center = bc.clone().addScaledVector(along, i),
        a = center.clone().addScaledVector(across, -8.9),
        b = center.clone().addScaledVector(across, 8.9);
      a.y = mineGroundHeight(a.x, a.z) + 0.018;
      b.y = mineGroundHeight(b.x, b.z) + 0.018;
      beam(a, b, 0.035, mat.metal);
    }
    for (const side of [-1, 1]) {
      const p = bc.clone().addScaledVector(across, side * 9.5);
      beam(
        p
          .clone()
          .addScaledVector(along, -15)
          .add(new T.Vector3(0, 1.7, 0)),
        p
          .clone()
          .addScaledVector(along, 15)
          .add(new T.Vector3(0, 1.7, 0)),
        0.25,
      );
      for (const d of [-14, 0, 14]) {
        const q = p.clone().addScaledVector(along, d);
        beam(q, q.clone().add(new T.Vector3(0, 2, 0)), 0.35);
      }
    }
    // Reused GLBs keep source UVs/trim textures. One instanced batch per cell/mesh.
    function imported(
      source: T.Group,
      p: MinePoint,
      size: number,
      yaw: number,
      dy = 0,
    ) {
      source.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(source),
        extent = bounds.getSize(new T.Vector3()),
        center = bounds.getCenter(new T.Vector3()),
        scale = size / Math.max(extent.x, extent.y, extent.z);
      const base = new T.Matrix4().compose(
        at(p, dy),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw),
        new T.Vector3(scale, scale, scale),
      );
      base.multiply(
        new T.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z),
      );
      source.traverse((o) => {
        if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
        // Imported props use the same baked field, without adding unoccluded dynamic light.
        const original = o.material as T.MeshStandardMaterial;
        let material = converted.get(original);
        if (!material) {
          material = ownM(
            new T.MeshBasicMaterial({
              map: original.map,
              color: original.color,
              side: T.DoubleSide,
            }),
          );
          converted.set(original, material);
        }
        const matrix = base.clone().multiply(o.matrixWorld),
          pos = new T.Vector3(),
          quat = new T.Quaternion(),
          sz = new T.Vector3();
        matrix.decompose(pos, quat, sz);
        instance(o.geometry, material, pos, sz, 0, quat);
      });
    }
    const converted = new Map<T.Material, T.MeshBasicMaterial>();
    MINE_BLOCKERS.filter((p) => p.kind !== 'landmark').forEach((p, i) =>
      imported(
        p.kind === 'rock' ? rock : p.kind === 'crate' ? crate : barrel,
        p,
        p.radius * 1.8,
        i * 1.79,
      ),
    );
    // Chamber landmarks, built beside the usable room center rather than across routes.
    for (const [index, r] of MINE_ROOMS.entries()) {
      const p = MINE_LANDMARKS[index],
        c = at(p);
      if (r.id === 'D' || r.id === 'S4') {
        for (let i = 0; i < 9; i++) {
          const q = c
            .clone()
            .add(
              new T.Vector3(Math.sin(i * 2.4) * 8, 2, Math.cos(i * 2.4) * 7),
            );
          instance(
            sphere,
            mat.mineral,
            q,
            new T.Vector3(1.3, 3 + (i % 3), 1.5),
            i,
            undefined,
            false,
          );
        }
      } else if (['N1', 'W1', 'W2'].includes(r.id)) {
        frame(p, 13, 16);
        beam(
          c.clone().add(new T.Vector3(-6, 16, 0)),
          c.clone().add(new T.Vector3(12, 18, -3)),
          1.1,
        );
        beam(
          c.clone().add(new T.Vector3(11, 18, -3)),
          c.clone().add(new T.Vector3(11, 4, -3)),
          0.12,
          mat.metal,
        );
        for (const side of [-1, 1])
          beam(
            c.clone().add(new T.Vector3(side * 6, 0, 0)),
            c.clone().add(new T.Vector3(side * 6, 12, 7)),
            0.7,
          );
      } else if (r.id === 'W3' || r.id === 'S1') {
        for (let i = 0; i < 5; i++)
          beam(
            c.clone().add(new T.Vector3(i * 2 - 6, 0.4, -3)),
            c.clone().add(new T.Vector3(i * 2 - 2, 1.8, 5)),
            0.7,
          );
      } else if (r.id === 'E2') {
        for (let i = 0; i < 3; i++)
          instance(
            box,
            mat.wood,
            c.clone().add(new T.Vector3(i * 4, 0.4, 0)),
            new T.Vector3(2, 0.5, 4),
            0.3,
          );
      } else {
        // Ore cart with open box, wheels, and ore; kept outside the rail centerline.
        instance(
          box,
          mat.metal,
          c.clone().add(new T.Vector3(0, 1.2, 0)),
          new T.Vector3(3, 0.3, 4),
        );
        for (const side of [-1, 1]) {
          instance(
            box,
            mat.wood,
            c.clone().add(new T.Vector3(side * 1.5, 2, 0)),
            new T.Vector3(0.2, 1.6, 4),
          );
          instance(
            box,
            mat.wood,
            c.clone().add(new T.Vector3(0, 2, side * 2)),
            new T.Vector3(3, 1.6, 0.2),
          );
          for (const z of [-1.3, 1.3])
            instance(
              sphere,
              mat.metal,
              c.clone().add(new T.Vector3(side * 1.65, 0.75, z)),
              new T.Vector3(0.3, 0.7, 0.7),
            );
        }
        for (let i = 0; i < 4; i++)
          instance(
            sphere,
            mat.rock,
            c
              .clone()
              .add(new T.Vector3(Math.sin(i) * 0.8, 1.8, Math.cos(i) * 1.2)),
            new T.Vector3(0.7, 0.65, 0.8),
            index,
          );
      }
    }
    const lanterns = mineLanterns();
    for (const l of lanterns) {
      const p = new T.Vector3(l.x, l.y, l.z);
      const mount = new T.Vector3(l.mount.x, l.mount.y, l.mount.z),
        hook = p.clone().add(new T.Vector3(0, 1.25, 0));
      if (l.support === 'wall') {
        const yaw = Math.atan2(p.x - mount.x, p.z - mount.z);
        // Wall plate embeds into the shell; angled iron bracket carries the lantern.
        instance(box, mat.metal, mount, new T.Vector3(0.65, 1.25, 0.22), yaw);
        beam(mount, hook, 0.16, mat.metal);
        beam(
          mount.clone().add(new T.Vector3(0, -0.55, 0)),
          mount.clone().lerp(hook, 0.65),
          0.1,
          mat.metal,
        );
      } else beam(mount, hook, 0.075, mat.metal);
      beam(hook, p.clone().add(new T.Vector3(0, 0.73, 0)), 0.075, mat.metal);
      for (const h of [-0.65, 0.65])
        instance(
          box,
          mat.metal,
          p.clone().add(new T.Vector3(0, h, 0)),
          new T.Vector3(0.9, 0.16, 0.75),
        );
      for (const x of [-0.38, 0.38])
        instance(
          box,
          mat.metal,
          p.clone().add(new T.Vector3(x, 0, 0)),
          new T.Vector3(0.1, 1.25, 0.7),
        );
      instance(
        sphere,
        mat.flame,
        p,
        new T.Vector3(0.32, 0.55, 0.3),
        0,
        undefined,
        false,
      );
    }
    let propTriangles = railTriangles;
    for (const batch of batches.values()) {
      const mesh = new T.InstancedMesh(
        batch.geometry,
        batch.material,
        batch.matrices.length,
      );
      mesh.name = 'Cell instanced mining props';
      batch.matrices.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, batch.colors[i]);
      });
      mesh.computeBoundingSphere();
      root.add(mesh);
      cellAdd(mesh, batch.x, batch.z);
      propTriangles +=
        ((batch.geometry.index?.count ??
          batch.geometry.attributes.position.count) /
          3) *
        batch.matrices.length;
    }
    const ambient = new T.AmbientLight('#b5ac9f', 0.65);
    root.add(ambient);
    const lights = Array.from({ length: 10 }, () => {
      const l = new T.PointLight('#ffb45e', 0, 65, 1.3);
      root.add(l);
      return { light: l, index: -1 };
    });
    let lastSelection = -100,
      lastCell = '',
      visibleCells = new Set<string>(),
      cameraDistance = 0;
    const navigation = new MineNavigation();
    function cameraValid(p: T.Vector3) {
      return (
        mineDistance(p.x, p.z) > 0.7 &&
        p.y > mineGroundHeight(p.x, p.z) + 0.5 &&
        p.y < mineCeiling(p.x, p.z) - 0.8
      );
    }
    function constrainCamera(
      focus: T.Vector3,
      desired: T.Vector3,
      dt = 1 / 60,
    ) {
      const vector = desired.clone().sub(focus);
      const length = vector.length();
      if (!length) return focus.clone();
      vector.normalize();
      let allowed = length;
      for (let d = 0.2; d <= length; d += 0.25) {
        if (!cameraValid(focus.clone().addScaledVector(vector, d))) {
          allowed = Math.max(0.25, d - 0.55);
          break;
        }
      }
      // Retract immediately for safety; restore the requested zoom gradually.
      cameraDistance = cameraDistance
        ? Math.min(
            allowed,
            T.MathUtils.lerp(cameraDistance, allowed, 1 - Math.exp(-dt * 7)),
          )
        : allowed;
      const p = focus.clone().addScaledVector(vector, cameraDistance);
      return p;
    }
    function update(camera: T.Camera, player: MinePoint, time = 0) {
      const key = cellKey(player.x, player.z);
      if (key !== lastCell) {
        lastCell = key;
        visibleCells = new Set();
        // Connectivity through actual floor portals; never render a disconnected cell island.
        const queue = [key],
          distance = new Map([[key, 0]]);
        while (queue.length) {
          const k = queue.shift()!,
            d = distance.get(k)!;
          visibleCells.add(k);
          if (d >= 5) continue;
          const [cx, cz] = k.split(':').map(Number);
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const next = `${cx + dx}:${cz + dz}`;
            if (distance.has(next) || !cells.has(next)) continue;
            let open = false;
            for (let t = 2; t < 50; t += 4) {
              const x = dx
                  ? (cx + (dx > 0 ? 1 : 0)) * 50 - 500
                  : cx * 50 - 500 + t,
                z = dz ? (cz + (dz > 0 ? 1 : 0)) * 50 - 500 : cz * 50 - 500 + t;
              if (mineDistance(x, z) > 0) {
                open = true;
                break;
              }
            }
            if (open) {
              distance.set(next, d + 1);
              queue.push(next);
            }
          }
        }
        // One ring overlap around portal cells avoids missing walls at cell corners.
        const expanded = new Set(visibleCells);
        for (const k of visibleCells) {
          const [x, z] = k.split(':').map(Number);
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
              expanded.add(`${x + dx}:${z + dz}`);
        }
        visibleCells = expanded;
        for (const [k, objects] of cells)
          for (const object of objects) object.visible = visibleCells.has(k);
      }
      const count = POOL[currentQuality],
        activePool = lights.slice(0, count);
      if (time - lastSelection > 0.25 || time < lastSelection) {
        lastSelection = time;
        const selected = lanterns
          .map((l, index) => ({
            index,
            d:
              Math.hypot(l.x - player.x, l.z - player.z) -
              (lights.some((p) => p.index === index) ? 8 : 0),
          }))
          .filter((l) => l.d < 75 && mineLineOfSight(player, lanterns[l.index]))
          .sort((a, b) => a.d - b.d)
          .slice(0, count)
          .map((l) => l.index);
        for (const pool of activePool)
          if (
            pool.index >= 0 &&
            !selected.includes(pool.index) &&
            pool.light.intensity < 0.05
          )
            pool.index = -1;
        for (const index of selected) {
          if (activePool.some((p) => p.index === index)) continue;
          const free = activePool.find((p) => p.index < 0);
          if (free) {
            free.index = index;
            const l = lanterns[index];
            free.light.position.set(l.x, l.y, l.z);
          }
        }
        for (const pool of activePool)
          (pool.light.userData as { wanted?: boolean }).wanted =
            selected.includes(pool.index);
      }
      for (const [i, pool] of lights.entries()) {
        const target = i < count && pool.light.userData.wanted ? 25 : 0;
        pool.light.intensity = T.MathUtils.lerp(
          pool.light.intensity,
          target,
          0.13,
        );
        pool.light.visible = i < count;
      }
    }
    const setQuality = (value: GraphicsQuality) => {
      currentQuality = value;
      lastSelection = -100;
    };
    return {
      root,
      surfaces,
      navigation,
      groundHeight: mineGroundHeight,
      move: (p: MinePoint, dx: number, dz: number) =>
        navigation.move(p, dx, dz),
      constrainCamera,
      update,
      setQuality,
      anchors: { entry: MINE_ENTRY, respawn: MINE_ENTRY, exit: MINE_EXIT },
      drawMinimap: (
        ctx: CanvasRenderingContext2D,
        size: number,
        player: MinePoint,
        enemies: MinePoint[],
        direction: MinePoint,
      ) =>
        drawMineLocalMinimap(
          ctx,
          size,
          player,
          { enemies, direction },
          MINE_HUD_MINIMAP_VIEW_SIZE,
        ),
      metrics: () => ({
        textureMiB:
          [...textures].reduce(
            (sum, t) =>
              sum +
              ((t.image?.width ?? 0) * (t.image?.height ?? 0) * 4 * 4) / 3,
            0,
          ) / 1048576,
        shellTriangles,
        propTriangles,
        totalTriangles: shellTriangles + propTriangles,
        lanterns: lanterns.length,
        wallLanterns: lanterns.filter((l) => l.support === 'wall').length,
        beamLanterns: lanterns.filter((l) => l.support === 'beam').length,
        floorLanterns: 0,
        lightPool: POOL[currentQuality],
        activeLights: lights.filter(
          (l) => l.light.visible && l.light.intensity > 0.02,
        ).length,
        cells: cells.size,
        visibleCells: visibleCells.size,
        sky: false,
      }),
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
