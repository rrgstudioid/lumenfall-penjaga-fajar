import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  SUNKEN_BOUNDS,
  SUNKEN_ENTRY as Surface_SUNKEN_ENTRY,
  SUNKEN_PORTALS as Surface_SUNKEN_PORTALS,
  SUNKEN_OBSTACLES as Surface_SUNKEN_OBSTACLES,
  SUNKEN_LANDMARKS as Surface_SUNKEN_LANDMARKS,
  SUNKEN_REEFS as Surface_SUNKEN_REEFS,
  sunkenHash,
  sunkenMonsterWalkable,
  sunkenFloorDistance as Surface_sunkenFloorDistance,
  sunkenGroundHeight as Surface_sunkenGroundHeight,
  sunkenSafe as Surface_sunkenSafe,
} from './sunken-ruins-layout.ts';
import {
  DEEP_OCEAN_ENTRY,
  DEEP_OCEAN_PORTALS,
  DEEP_OCEAN_REEFS,
  deepOceanWalkable,
  deepOceanGroundHeight,
  deepOceanSafe,
} from './deep-ocean-layout.ts';
import { SUNKEN_WALL_COLLIDERS, SUNKEN_WALL } from './sunken-ruins-layout.ts';
import {
  SUNKEN_ARTIFACTS,
  SUNKEN_ARTIFACT_COLLIDERS,
  sunkenArtifactAsset,
} from './sunken-ruins-artifact-layout.ts';
import { createShelfWalls } from './sunken-ruins-wall-mesh.ts';
import { createSerpentKit } from './sea-serpent-model.ts';
import { trenchMonsterWalkable } from './abysal-trench-population.ts';
import { createSunkenTerrain } from './sunken-ruins-terrain.ts';
import { createSunkenPbrKit } from './sunken-ruins-pbr-kit.ts';
import { SunkenNavigation } from './sunken-ruins-navigation.ts';
import { createSunkenMaterials } from './sunken-ruins-materials.ts';
import { createSunkenVfx } from './sunken-ruins-vfx.ts';
import {
  SUNKEN_LIGHT,
  SUNKEN_QUALITY,
  DEEP_OCEAN_TRENCH_VIEW,
} from './sunken-ruins-quality.ts';
import {
  SUNKEN_CAMERA_BLOCKERS,
  sunkenCameraDistance,
} from './sunken-ruins-camera.ts';
import type { GraphicsQuality } from './graphics-quality.ts';
import { underwaterGridCoordinate } from './underwater-regions.ts';
import {
  ABYSAL_TRENCH_ENTRY,
  ABYSAL_TRENCH_PORTALS,
  abysalTrenchGroundHeight,
  abysalTrenchSafe,
  abysalTrenchWalkable,
  abysalTrenchPathDistance,
  abysalTrenchRockWeight,
  ABYSAL_TRENCH_ARENA,
} from './abysal-trench-layout.ts';

export async function buildSunkenRuins(
  quality: GraphicsQuality,
  options: {
    slice?: boolean;
    deepOcean?: boolean;
    abysalTrench?: boolean;
  } = {},
) {
  const trench = !!options.abysalTrench;
  const deep = !!options.deepOcean || trench;
  const depthMin = trench ? 1680 : deep ? 740 : 0;
  const depthMax = trench ? 1810 : deep ? 820 : 75;
  const SUNKEN_ENTRY = trench
    ? ABYSAL_TRENCH_ENTRY
    : deep
      ? DEEP_OCEAN_ENTRY
      : Surface_SUNKEN_ENTRY;
  const SUNKEN_PORTALS = trench
    ? ABYSAL_TRENCH_PORTALS
    : deep
      ? DEEP_OCEAN_PORTALS
      : Surface_SUNKEN_PORTALS;
  const SUNKEN_OBSTACLES = deep ? [] : Surface_SUNKEN_OBSTACLES;
  const SUNKEN_LANDMARKS = deep ? [] : Surface_SUNKEN_LANDMARKS;
  const SUNKEN_REEFS = deep ? DEEP_OCEAN_REEFS : Surface_SUNKEN_REEFS;
  const sunkenGroundHeight = trench
    ? abysalTrenchGroundHeight
    : deep
      ? deepOceanGroundHeight
      : Surface_sunkenGroundHeight;
  const sunkenFloorDistance = trench
    ? (p: { x: number; z: number }) =>
        Math.max(0, abysalTrenchPathDistance(p)) * 0.6
    : deep
      ? (p: { x: number; z: number }) =>
          ((-sunkenGroundHeight(p.x, p.z) - depthMin) / (depthMax - depthMin)) *
          65
      : Surface_sunkenFloorDistance;
  const sunkenSafe = trench
    ? abysalTrenchSafe
    : deep
      ? deepOceanSafe
      : Surface_sunkenSafe;
  const root = new T.Group(),
    surfaces = new T.Group();
  root.name = trench ? 'Abysal Trench' : deep ? 'Deep Ocean' : 'Sunken Ruins';
  surfaces.name = 'Authoritative seabed';
  root.add(surfaces);
  const geometry = new Set<T.BufferGeometry>(),
    material = new Set<T.Material>();
  const materials = createSunkenMaterials([
      ...SUNKEN_REEFS,
      ...SUNKEN_OBSTACLES,
      ...(deep ? [] : SUNKEN_ARTIFACT_COLLIDERS),
    ]),
    navigation = new SunkenNavigation(
      trench ? abysalTrenchWalkable : deep ? deepOceanWalkable : undefined,
      SUNKEN_ENTRY,
    );
  const pbrKit = createSunkenPbrKit((m) => materials.adaptImported(m));
  const serpentKit = trench ? createSerpentKit() : undefined;
  const bossNavigation = new SunkenNavigation((p,r)=>trenchMonsterWalkable(p,r,true),ABYSAL_TRENCH_ARENA);
  const monsterNavigation = new SunkenNavigation(
    trench
      ? trenchMonsterWalkable
      : deep
        ? deepOceanWalkable
        : sunkenMonsterWalkable,
    SUNKEN_ENTRY,
  );
  const kit = new Map<string, T.BufferGeometry>(),
    distantKit = new Map<string, T.BufferGeometry>(),
    cells = new Map<string, T.Group>();
  let vfx: ReturnType<typeof createSunkenVfx> | undefined,
    disposed = false,
    elapsed = 0;
  let minimapCache: HTMLCanvasElement | undefined;
  const own = <G extends T.BufferGeometry>(g: G) => {
    geometry.add(g);
    return g;
  };
  const ownMat = <M extends T.Material>(m: M) => {
    material.add(m);
    return m;
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    vfx?.dispose();
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    geometry.forEach((g) => g.dispose());
    material.forEach((m) => m.dispose());
    pbrKit.dispose();
    serpentKit?.dispose();
    materials.dispose();
    if (minimapCache) minimapCache.width = minimapCache.height = 0;
    minimapCache = undefined;
    root.clear();
  }
  try {
    if (serpentKit) await serpentKit.load();
    if (!deep) {
      const gltf = await new GLTFLoader().loadAsync('/assets/maps/sunken-ruins/kit.glb');
      gltf.scene.updateMatrixWorld(true);
      const importedMaterials = new Set<T.Material>();
      gltf.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          kit.set(o.name, own(o.geometry.clone().applyMatrix4(o.matrixWorld)));
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            importedMaterials.add(m),
          );
        }
      });
      importedMaterials.forEach((m) => m.dispose());
      // Keep the original distant silhouettes and structures; replace marine prototypes nearby.
      kit.forEach((g, name) => distantKit.set(name, g));
      const marine = await new GLTFLoader().loadAsync(
        '/assets/maps/sunken-ruins/realism/marine-kit.glb',
      );
      marine.scene.updateMatrixWorld(true);
      marine.scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        kit.set(o.name, own(o.geometry.clone().applyMatrix4(o.matrixWorld)));
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      });
      const masonry = await new GLTFLoader().loadAsync(
        '/assets/maps/sunken-ruins/revision3/ruins-reef-kit.glb',
      );
      masonry.scene.updateMatrixWorld(true);
      masonry.scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        kit.set(o.name, own(o.geometry.clone().applyMatrix4(o.matrixWorld)));
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      });
      await pbrKit.load();
      if (!deep)
        for (const name of new Set(SUNKEN_ARTIFACTS.map((p) => p.name)))
          await pbrKit.load(sunkenArtifactAsset(name), [name]);
      for (const name of [
        'pillar',
        'arch',
        'reef_rock',
        'coral_branch',
        'coral_fan',
        'coral_plate',
        'coral_tube',
        'seaweed',
        'kelp',
        'fish',
        'jellyfish',
        'ray',
      ])
        if (!kit.has(name)) throw Error(`Sunken kit missing ${name}`);
    }
    await materials.load(deep, trench);
    const sand = materials.material(
        trench ? '#ffffff' : '#e1eadd',
        trench ? 'tectonic' : 'sand',
      ),
      stone = materials.material(trench ? '#8996a4' : '#ede8d8'),
      coral = materials.material('#ffffff', 'coral'),
      plant = materials.material('#74ac7c', 'plant');
    const dummy = new T.Object3D();
    type Placement = {
      name: string;
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      yaw: number;
      color: string;
      kind: 'stone' | 'coral' | 'plant';
    };
    const groups = new Map<string, Placement[]>();
    const covered = (x: number, z: number) =>
      !options.slice ||
      Math.hypot(x - SUNKEN_ENTRY.x, z - SUNKEN_ENTRY.z) < 160;
    const add = (
      name: string,
      x: number,
      z: number,
      sx = 1,
      sy = sx,
      sz = sx,
      yaw = 0,
      color = '#ffffff',
      kind: Placement['kind'] = 'stone',
      y = sunkenGroundHeight(x, z),
    ) => {
      if (!covered(x, z)) return;
      const key = `${Math.floor(x / 64)},${Math.floor(z / 64)}:${name}:${kind}`,
        list = groups.get(key) ?? [];
      list.push({ name, x, y, z, sx, sy, sz, yaw, color, kind });
      groups.set(key, list);
    };
    const hash = sunkenHash;
    sand.vertexColors = true;
    for (const mesh of createSunkenTerrain(
      sand,
      covered,
      sunkenGroundHeight,
      sunkenFloorDistance,
      deep ? () => -15 : undefined,
      trench ? abysalTrenchRockWeight : undefined,
    )) {
      own(mesh.geometry);
      surfaces.add(mesh);
    }
    if (!deep)
      for (const mesh of createShelfWalls(stone)) {
        own(mesh.geometry);
        root.add(mesh);
      }
    // Solid colonies stay visible at every quality; only soft flora uses density LOD.
    for (const p of SUNKEN_REEFS)
      add(
        p.name,
        p.x,
        p.z,
        p.scale,
        p.scale,
        p.scale,
        p.yaw,
        p.color,
        p.radius > 0 ? 'coral' : 'plant',
      );
    for (const o of SUNKEN_OBSTACLES)
      add(
        o.kind === 'pillar' ? 'pillar' : 'reef_rock',
        o.x,
        o.z,
        o.kind === 'pillar' ? 1.7 : 2.5,
        o.kind === 'pillar' ? o.height / 6.475 : 2,
        o.kind === 'pillar' ? 1.7 : 2.5,
        o.yaw,
      );
    for (const o of SUNKEN_LANDMARKS)
      add(o.name, o.x, o.z, o.scale, o.scale, o.scale, o.yaw);
    if (!deep)
      for (const p of SUNKEN_ARTIFACTS)
        add(
          p.name,
          p.x,
          p.z,
          1,
          1,
          1,
          p.yaw,
          '#ffffff',
          'stone',
          sunkenGroundHeight(p.x, p.z) - 0.18,
        );
    // Distant submerged buttresses are scenery outside the square navigation bounds.
    for (let i = 0; !deep && i < 24; i++) {
      const angle = (i * Math.PI) / 12,
        radius = 640 + Math.sin(i * 2.4) * 45;
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      if (Math.max(Math.abs(x), Math.abs(z)) < 530) continue;
      add('reef_rock', x, z, 13 + (i % 4), 16 + (i % 5), 18, angle, '#61969f');
    }
    for (const gate of SUNKEN_PORTALS) {
      if (!covered(gate.x, gate.z)) continue;
      if (!deep)
        add('arch', gate.x, gate.z, 1.4, 1.4, 1.4, gate.yaw, '#80b1bf');
      const energyMat = ownMat(
        new T.MeshBasicMaterial({
          color: '#38caff',
          transparent: true,
          opacity: 0.48,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      const portal = new T.Group();
      portal.position.set(gate.x, sunkenGroundHeight(gate.x, gate.z), gate.z);
      portal.rotation.y = gate.yaw;
      portal.userData.destination = gate.destination;
      portal.userData.portalId = gate.id;
      root.add(portal);
      const energy = new T.Mesh(own(new T.CircleGeometry(2.1, 32)), energyMat);
      energy.position.y = 3.6;
      portal.add(energy);
      for (const radius of [2.15, 1.6, 0.8]) {
        const ring = new T.Mesh(
          own(new T.TorusGeometry(radius, 0.065, 6, 48)),
          ownMat(new T.MeshBasicMaterial({ color: '#9ef8ff' })),
        );
        ring.position.y = 3.6;
        portal.add(ring);
      }
      const hit = new T.Mesh(
        own(new T.BoxGeometry(5.6, 8, 0.8)),
        ownMat(
          new T.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        ),
      );
      hit.position.y = 4;
      portal.add(hit);
    }
    for (const [key, placements] of groups) {
      const cellKey = key.split(':')[0];
      let cell = cells.get(cellKey);
      if (!cell) {
        cell = new T.Group();
        cell.name = `Reef sector ${cellKey}`;
        const [x, z] = cellKey.split(',').map(Number);
        cell.userData.center = { x: x * 64 + 32, z: z * 64 + 32 };
        root.add(cell);
        cells.set(cellKey, cell);
      }
      const type = placements[0].kind;
      // Stable spatial scatter keeps density LOD from removing whole rows of coral.
      if (type !== 'stone')
        placements.sort((a, b) => hash(a.x, a.z) - hash(b.x, b.z));
      const imported = pbrKit.prototypes.get(placements[0].name);
      const parts = imported ?? [
        {
          geometry: kit.get(placements[0].name)!,
          material: type === 'plant' ? plant : type === 'coral' ? coral : stone,
        },
      ];
      parts.forEach((part, partIndex) => {
        const instances = new T.InstancedMesh(
          part.geometry,
          part.material,
          placements.length,
        );
        instances.name = partIndex ? `${key}:part-${partIndex}` : key;
        instances.castShadow = type === 'stone' || type === 'coral';
        instances.receiveShadow = true;
        instances.userData = {
          prototype: placements[0].name,
          plant: type === 'plant',
          coral: type === 'coral',
          imported: !!imported,
          partIndex,
          total: placements.length,
        };
        placements.forEach((p, i) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, p.yaw, 0);
          dummy.scale.set(p.sx, p.sy, p.sz);
          dummy.updateMatrix();
          instances.setMatrixAt(i, dummy.matrix);
          instances.setColorAt(i, new T.Color(p.color));
        });
        instances.computeBoundingSphere();
        cell!.add(instances);
      });
    }
    if (!deep) {
      vfx = createSunkenVfx(kit, quality, sunkenGroundHeight);
      root.add(vfx.root);
    }
    const cameraBlockers = [
      ...(deep ? [] : SUNKEN_CAMERA_BLOCKERS),
      ...(deep
        ? []
        : SUNKEN_ARTIFACT_COLLIDERS.map((o) => ({
            ...o,
            minY: sunkenGroundHeight(o.x, o.z),
            maxY: sunkenGroundHeight(o.x, o.z) + o.height,
          }))),
      ...(deep
        ? []
        : SUNKEN_WALL_COLLIDERS.map((o) => ({
            ...o,
            minY: sunkenGroundHeight(o.x, o.z) - 1,
            maxY: sunkenGroundHeight(o.x, o.z) + o.height,
          }))),
      ...SUNKEN_REEFS.filter((p) => p.radius > 0).map((p) => ({
        x: p.x,
        z: p.z,
        radius: p.radius,
        minY: sunkenGroundHeight(p.x, p.z),
        maxY: sunkenGroundHeight(p.x, p.z) + p.height,
      })),
    ];
    for (const placements of groups.values())
      for (const p of placements)
        if (p.name === 'reef_rock')
          cameraBlockers.push({
            x: p.x,
            z: p.z,
            radius: p.sx * 1.5,
            minY: p.y,
            maxY: p.y + p.sy * 1.8,
          });
    const cameraDirection = new T.Vector3(),
      cameraResult = new T.Vector3();
    let cameraDistance = Infinity;
    function constrainCamera(focus: T.Vector3, desired: T.Vector3, dt: number) {
      const allowed = sunkenCameraDistance(
        focus,
        desired,
        cameraBlockers,
        sunkenGroundHeight,
      );
      cameraDistance =
        allowed < cameraDistance
          ? allowed
          : cameraDistance +
            (allowed - cameraDistance) * (1 - Math.exp(-8 * Math.max(0, dt)));
      cameraDirection.copy(desired).sub(focus).normalize();
      return cameraResult
        .copy(focus)
        .addScaledVector(cameraDirection, cameraDistance);
    }
    let visibleCells = 0;
    const terrainObserver = new T.Vector3();
    function update(
      camera: T.Camera,
      hero: { x: number; z: number },
      dt: number,
    ) {
      elapsed += Math.min(0.1, Math.max(0, dt));
      materials.time.value = elapsed;
      visibleCells = 0;
      // Ultra's extended sectors lie behind opaque fog; retain sector/camera margins below.
      const range =
        quality === 'high'
          ? SUNKEN_LIGHT.fogFar
          : SUNKEN_QUALITY[quality].range;
      for (const cell of cells.values()) {
        const center = cell.userData.center;
        const distance = Math.hypot(center.x - hero.x, center.z - hero.z);
        cell.visible = distance < range + 46;
        if (!cell.visible) continue;
        visibleCells++;
        for (const mesh of cell.children)
          if (mesh instanceof T.InstancedMesh) {
            const name = mesh.userData.prototype;
            // Near organic geometry, reduced mesh at middle distance, original silhouette far away.
            const detail =
              quality === 'office' ? 45 : quality === 'light' ? 50 : 80;
            mesh.geometry = mesh.userData.imported
              ? pbrKit.prototypes.get(
                  name +
                    (distance < detail ? '' : distance < 155 ? '_lod' : '_far'),
                )![mesh.userData.partIndex].geometry
              : distance < detail
                ? kit.get(name)!
                : distance < 155
                  ? (kit.get(name + '_lod') ?? kit.get(name)!)
                  : (kit.get(name + '_far') ??
                      distantKit.get(name) ??
                      kit.get(name))!;
            if (mesh.userData.plant)
              mesh.count = Math.max(
                1,
                Math.floor(
                  mesh.userData.total * SUNKEN_QUALITY[quality].plants,
                ),
              );
          }
      }
      // Fog uses camera depth. Culling terrain around the actor exposes square
      // tile edges when the camera looks toward the offshore slope, especially
      // on Low. Include the diagonal viewport and tile radius beyond the fog.
      camera.getWorldPosition(terrainObserver);
      const terrainRange =
        (deep && !trench
          ? DEEP_OCEAN_TRENCH_VIEW.fogFar
          : SUNKEN_LIGHT.fogFar) *
          1.35 +
        40;
      for (const mesh of surfaces.children) {
        const center = (mesh as T.Mesh).geometry.boundingSphere!.center;
        mesh.visible =
          Math.hypot(
            center.x - terrainObserver.x,
            center.z - terrainObserver.z,
          ) < terrainRange;
      }
      vfx?.update(
        { x: hero.x, y: sunkenGroundHeight(hero.x, hero.z), z: hero.z },
        dt,
      );
    }
    function drawMinimapRaster(ctx: CanvasRenderingContext2D, size: number) {
      const p = (v: number) => ((v + 500) * size) / 1000;
      ctx.fillStyle = '#062f47';
      ctx.fillRect(0, 0, size, size);
      // Sample the same height function used by terrain and grounding, north=-Z.
      // Continuous bathymetry and slope shading replace the old flat contour mask.
      const pixels = ctx.createImageData(size, size),
        step = 1000 / size;
      const heights = new Float64Array((size + 2) * (size + 2));
      const height = (x: number, y: number) =>
        heights[(y + 1) * (size + 2) + x + 1];
      for (let y = -1; y <= size; y++)
        for (let x = -1; x <= size; x++)
          heights[(y + 1) * (size + 2) + x + 1] = sunkenGroundHeight(
            (x + 0.5) * step - 500,
            (y + 0.5) * step - 500,
          );
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const h = height(x, y),
            depth = T.MathUtils.smoothstep(-h, depthMin, depthMax);
          const dx = (height(x + 1, y) - height(x - 1, y)) / (step * 2),
            dz = (height(x, y + 1) - height(x, y - 1)) / (step * 2);
          const shade = T.MathUtils.clamp(
            (1 - 0.24 * dx - 0.18 * dz) /
              Math.sqrt(1 + 0.18 * (dx * dx + dz * dz)),
            0.55,
            1.15,
          );
          const shallow = deep ? [104, 151, 157] : [197, 216, 182],
            abyss = [17, 53, 76],
            i = (y * size + x) * 4;
          const fault = trench
            ? abysalTrenchPathDistance({
                x: (x + 0.5) * step - 500,
                z: (y + 0.5) * step - 500,
              })
            : 0;
          for (let c = 0; c < 3; c++)
            pixels.data[i + c] =
              (trench
                ? fault < -2
                  ? [118, 146, 152][c]
                  : fault < 10
                    ? [67, 83, 96][c]
                    : [23, 37, 49][c]
                : T.MathUtils.lerp(shallow[c], abyss[c], depth)) * shade;
          pixels.data[i + 3] = 255;
        }
      ctx.putImageData(pixels, 0, 0);
      if (trench) {
        ctx.strokeStyle = '#a79769';
        ctx.lineWidth = Math.max(0.75, size / 500);
        ctx.beginPath();
        ctx.arc(
          p(ABYSAL_TRENCH_ARENA.x),
          p(ABYSAL_TRENCH_ARENA.z),
          (ABYSAL_TRENCH_ARENA.radius * size) / 1000,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      const dot = (
        o: { x: number; z: number; radius: number },
        color: string,
      ) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(
          p(o.x),
          p(o.z),
          Math.max(0.35, (o.radius * size) / 1000),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      };
      for (const reef of SUNKEN_REEFS)
        if (reef.radius > 0) dot(reef, '#567f74');
      for (const obstacle of SUNKEN_OBSTACLES) dot(obstacle, '#62757d');
      for (const landmark of SUNKEN_LANDMARKS) dot(landmark, '#a6a283');
      if (!deep) {
        for (const artifact of SUNKEN_ARTIFACT_COLLIDERS)
          dot(artifact, '#805c40');
        // Exact runtime wall segments, including the same open passages.
        for (const [color, width] of [
          ['#294959', 8],
          ['#dee0bc', 5],
        ] as const) {
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.7, (width * size) / 1000);
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (const { a, b } of SUNKEN_WALL.segments) {
            ctx.moveTo(p(a.x), p(a.z));
            ctx.lineTo(p(b.x), p(b.z));
          }
          ctx.stroke();
        }
      }
    }
    function drawMinimapLabels(ctx: CanvasRenderingContext2D, size: number) {
      // Coordinate labels use the shared HUD typography and frame placement.
      const p = (v: number) => ((v + 500) * size) / 1000;
      ctx.textBaseline = 'middle';
      for (const gate of SUNKEN_PORTALS) {
        ctx.fillStyle = '#35beff';
        ctx.beginPath();
        ctx.arc(p(gate.x), p(gate.z), 3, 0, Math.PI * 2);
        ctx.fill();
        if (gate.id === 'deep-ocean-g7' || gate.id === 'abysal-trench-f1') {
          ctx.font = `bold ${Math.max(9, size * 0.043)}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#e1fbff';
          ctx.fillText(
            underwaterGridCoordinate(gate),
            p(gate.x) + 4,
            p(gate.z) + (gate.id === 'abysal-trench-f1' ? 10 : -4),
          );
        }
      }
      ctx.font = `bold ${Math.max(8, size * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (!deep) {
        ctx.fillStyle = '#966238';
        for (const artifact of SUNKEN_ARTIFACTS)
          if (
            artifact.name === 'sunken-shipwreck' ||
            artifact.name === 'neptune-statue'
          )
            ctx.fillText(
              artifact.name === 'sunken-shipwreck' ? 'S' : 'N',
              p(artifact.x),
              p(artifact.z),
            );
      }
    }
    function drawMinimap(ctx: CanvasRenderingContext2D, size: number) {
      // The trench is explored without revealing its maze, arena or portals.
      // Grid, coordinates and compass are supplied by the shared HUD frame.
      if (trench) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        return;
      }
      if (!minimapCache) {
        minimapCache = document.createElement('canvas');
        minimapCache.width = minimapCache.height = 384;
        drawMinimapRaster(minimapCache.getContext('2d')!, 384);
      }
      ctx.drawImage(minimapCache, 0, 0, size, size);
      drawMinimapLabels(ctx, size);
    }
    return {
      root,
      surfaces,
      bounds: SUNKEN_BOUNDS,
      entry: SUNKEN_ENTRY,
      navigation,
      monsterNavigation,
      navigationForMonster: (boss:boolean) => trench && boss ? bossNavigation : monsterNavigation,
      attachSerpent: (body:T.Mesh) => serpentKit?.attach(body),
      groundHeight: sunkenGroundHeight,
      move: navigation.move.bind(navigation),
      safe: sunkenSafe,
      constrainCamera,
      update,
      drawMinimap,
      dispose,
      setQuality(q: GraphicsQuality) {
        quality = q;
        vfx?.setQuality(q);
      },
      portals: SUNKEN_PORTALS,
      metrics: () => ({
        deepOcean: deep,
        abysalTrench: trench,
        artifacts: deep ? 0 : SUNKEN_ARTIFACTS.length,
        size: 1000,
        slice: !!options.slice,
        sectors: cells.size,
        visibleSectors: visibleCells,
        terrainChunks: surfaces.children.length,
        instances: [...groups.values()].reduce((s, p) => s + p.length, 0),
        kitGeometries: kit.size,
        pbr: pbrKit.metrics(),
        solidReefColliders: SUNKEN_REEFS.filter((p) => p.radius > 0).length,
        layoutRevision: 13,
        ambience: vfx?.metrics() ?? {
          fish: 0,
          jellyfish: 0,
          rays: 0,
          particles: 0,
          shafts: 0,
        },
        sourceAssetsUnmodified: true,
      }),
    };
  } catch (e) {
    dispose();
    throw e;
  }
}
