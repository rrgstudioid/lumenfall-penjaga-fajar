import { createWildsIconTree } from './whispering-wilds-icon-tree.ts';
import { createWildsMushrooms } from './whispering-wilds-mushrooms.ts';
import {
  createWildsBridges,
  drawWildsMinimapBridges,
  fitWildsBridgeTerrain,
} from './whispering-wilds-bridges.ts';
import { createWildsBoundary } from './whispering-wilds-boundary.ts';
import * as T from 'three';
import { buildWildsWaterGeometry } from './whispering-wilds-water.ts';
import { createWildsScenery } from './whispering-wilds-scenery.ts';

import { createWildsSky } from './whispering-wilds-sky.ts';
import {
  FOREST_ASSETS,
  createForestMaterial,
  type ForestTextures,
} from './forest-map-materials.ts';
import {
  WILDS_BOUNDS,
  WILDS_ENTRY,
  WILDS_LANDMARKS,
  WILDS_ALTAR,
  WILDS_LAKE_ISLAND,
  WILDS_CLEARINGS,
  WILDS_RIVER,
  WILDS_TRIBUTARIES,
  WILDS_BRIDGES,
  WILDS_FALLS,
  WILDS_PORTALS,
  WILDS_STEP,
  wildsHeightfield,
  wildsTerrainHeight,
  wildsGroundHeight,
  wildsWater,
  wildsLakeEdge,
  wildsIslandDistance,
  wildsProps,
  smooth,
  type WildsPoint,
} from './whispering-wilds-layout.ts';
import { WildsNavigation } from './whispering-wilds-navigation.ts';
import {
  WILDS_QUALITY,
  loadWildsQuality,
  type WildsQuality,
} from './whispering-wilds-quality.ts';
import { createWildsVfx } from './whispering-wilds-vfx.ts';
import { createWildsGrass } from './whispering-wilds-grass.ts';

export async function buildWhisperingWilds(
  quality: WildsQuality = loadWildsQuality(),
) {
  const root = new T.Group(),
    surfaces = new T.Group();
  root.name = 'Whispering Wilds';
  surfaces.name = 'Ground and bridge raycast surfaces';
  root.add(surfaces);
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const geo = <G extends T.BufferGeometry>(g: G) => {
    geometries.add(g);
    return g;
  };
  const mat = <M extends T.Material>(m: M) => {
    materials.add(m);
    return m;
  };
  let disposed = false,
    vfx: ReturnType<typeof createWildsVfx> | undefined,
    grass: ReturnType<typeof createWildsGrass> | undefined;
  function dispose() {
    if (disposed) return;
    disposed = true;
    vfx?.dispose();
    grass?.dispose();
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => {
      t.dispose();
      const image = t.source.data;
      if (typeof image?.close === 'function') image.close();
    });
    root.clear();
  }
  try {
    const loader = new T.TextureLoader();
    const loadTexture = async (url: string, linear = false) => {
      const t = await loader.loadAsync(url);
      textures.add(t);
      t.colorSpace = linear ? T.NoColorSpace : T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    };
    const entries = Object.entries(FOREST_ASSETS),
      results = await Promise.allSettled(
        entries.map(
          async ([key, url]) =>
            [key, await loadTexture(url, key === 'water')] as const,
        ),
      );
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const tx = Object.fromEntries(
      results.map(
        (r) =>
          (r as PromiseFulfilledResult<readonly [string, T.Texture]>).value,
      ),
    ) as ForestTextures;
    const terrainMat = mat(createForestMaterial(tx, 'terrain')),
      rockMat = mat(createForestMaterial(tx, 'rock')),
      woodMat = mat(createForestMaterial(tx, 'wood')),
      stoneMat = mat(createForestMaterial(tx, 'stone')),
      waterMat = mat(createForestMaterial(tx, 'water'));
    fitWildsBridgeTerrain(terrainMat);
    tx.chaoticSky.wrapT = T.ClampToEdgeWrapping;
    const sky = createWildsSky(tx.chaoticSky);
    geo(sky.mesh.geometry);
    mat(sky.mesh.material);
    root.add(sky.mesh);
    const chunks: Array<{
      x: number;
      z: number;
      shore: boolean;
      meshes: T.Mesh[];
    }> = [];
    const heights = wildsHeightfield();
    // Sample once; all LODs reuse the same authoritative masks and heights.
    const masks = new Float32Array(513 * 513 * 2);
    for (let j = 0; j < 513; j++)
      for (let i = 0; i < 513; i++) {
        const x = i * WILDS_STEP - 500,
          z = j * WILDS_STEP - 500,
          n = (j * 513 + i) * 2;
        masks[n] = 0;
        masks[n + 1] =
          1 - smooth(0, 16, Math.abs(wildsWater({ x, z }).distance));
      }
    for (let cz = 0; cz < 16; cz++)
      for (let cx = 0; cx < 16; cx++) {
        const meshes: T.Mesh[] = [];
        let shore = false;
        for (let j = 0; j <= 32; j += 4)
          for (let i = 0; i <= 32; i += 4) {
            const p = {
              x: (cx * 32 + i) * WILDS_STEP - 500,
              z: (cz * 32 + j) * WILDS_STEP - 500,
            };
            if (Math.abs(wildsWater(p).distance) < 15) shore = true;
          }
        for (const stride of [1, 2, 4]) {
          const n = 32 / stride,
            pos: number[] = [],
            uv: number[] = [],
            mask: number[] = [],
            indices: number[] = [],
            normals: number[] = [];
          for (let j = 0; j <= n; j++)
            for (let i = 0; i <= n; i++) {
              const gx = cx * 32 + i * stride,
                gz = cz * 32 + j * stride,
                x = gx * WILDS_STEP - 500,
                z = gz * WILDS_STEP - 500,
                index = gz * 513 + gx;
              pos.push(x, heights[index], z);
              uv.push(x / 12, z / 12);
              mask.push(masks[index * 2], masks[index * 2 + 1]);
            }
          for (let j = 0; j < n; j++)
            for (let i = 0; i < n; i++) {
              const a = j * (n + 1) + i;
              indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
            }
          // Downward skirts hide different-resolution seams without altering collision.
          const edge: number[] = [];
          for (let i = 0; i <= n; i++) edge.push(i);
          for (let j = 1; j <= n; j++) edge.push(j * (n + 1) + n);
          for (let i = n - 1; i >= 0; i--) edge.push(n * (n + 1) + i);
          for (let j = n - 1; j > 0; j--) edge.push(j * (n + 1));
          const base = pos.length / 3;
          for (const a of edge) {
            pos.push(pos[a * 3], pos[a * 3 + 1] - 12, pos[a * 3 + 2]);
            uv.push(uv[a * 2], uv[a * 2 + 1]);
            mask.push(mask[a * 2], mask[a * 2 + 1]);
          }
          for (let k = 0; k < edge.length; k++) {
            const next = (k + 1) % edge.length;
            indices.push(
              edge[k],
              base + k,
              edge[next],
              edge[next],
              base + k,
              base + next,
            );
          }
          for (let k = 0; k < pos.length; k += 3) {
            const x = pos[k],
              z = pos[k + 2],
              normal = new T.Vector3(
                wildsTerrainHeight(x - 1, z) - wildsTerrainHeight(x + 1, z),
                2,
                wildsTerrainHeight(x, z - 1) - wildsTerrainHeight(x, z + 1),
              ).normalize();
            normals.push(normal.x, normal.y, normal.z);
          }
          const g = geo(new T.BufferGeometry());
          g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
          g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
          g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
          g.setAttribute('forestMask', new T.Float32BufferAttribute(mask, 2));
          g.setIndex(indices);
          g.computeBoundingSphere();
          const mesh = new T.Mesh(g, terrainMat);
          mesh.name = `Forest terrain ${cx},${cz} LOD ${stride}`;
          mesh.receiveShadow = true;
          mesh.visible = stride === 1;
          surfaces.add(mesh);
          meshes.push(mesh);
        }
        chunks.push({
          x: cx * 62.5 - 468.75,
          z: cz * 62.5 - 468.75,
          shore,
          meshes,
        });
      }
    function mesh(
      g: T.BufferGeometry,
      m: T.Material,
      x: number,
      y: number,
      z: number,
      parent: T.Group = root,
    ) {
      const o = new T.Mesh(geo(g), m);
      o.position.set(x, y, z);
      o.receiveShadow = true;
      parent.add(o);
      return o;
    }
    const waterMesh = mesh(buildWildsWaterGeometry(), waterMat, 0, 0, 0);
    waterMesh.name = 'Moonlit river';
    const lake = WILDS_LANDMARKS[1];
    const bridges = createWildsBridges(woodMat, stoneMat);
    bridges.geometries.forEach(geo);
    bridges.materials.forEach(mat);
    bridges.textures.forEach((texture) => textures.add(texture));
    root.add(bridges.root);
    bridges.colliders.forEach((collider) => surfaces.add(collider));
    const iconTree = createWildsIconTree();
    iconTree.geometries.forEach(geo);
    iconTree.materials.forEach(mat);
    iconTree.textures.forEach((texture) => textures.add(texture));
    iconTree.setDetail(quality);
    root.add(iconTree.root);
    const mushrooms = await createWildsMushrooms();
    mushrooms.geometries.forEach(geo);
    mushrooms.materials.forEach(mat);
    mushrooms.textures.forEach((texture) => textures.add(texture));
    root.add(mushrooms.root);
    const scenery = createWildsScenery(stoneMat);
    scenery.geometries.forEach(geo);
    scenery.materials.forEach(mat);
    root.add(scenery.root);
    const boundary = createWildsBoundary(terrainMat, tx.water, waterMat);
    boundary.geometries.forEach(geo);
    boundary.materials.forEach(mat);
    root.add(boundary.root);
    const crystalMat = mat(
      new T.MeshStandardMaterial({
        color: '#708dde',
        emissive: '#3558c9',
        emissiveIntensity: 0.9,
        roughness: 0.45,
      }),
    );
    const purpleMat = mat(
      new T.MeshStandardMaterial({
        color: '#8970bf',
        emissive: '#6a36a8',
        emissiveIntensity: 0.8,
        roughness: 0.65,
      }),
    );
    for (let i = 0; i < 6; i++) {
      const c = WILDS_CLEARINGS[i % 5],
        a = i * 2.4,
        x = c.x + Math.cos(a) * (c.rx + 5),
        z = c.z + Math.sin(a) * (c.rz + 5);
      for (let j = 0; j < 3; j++) {
        const px = x + j * 1.1,
          pz = z + Math.sin(j * 3) * 1.2;
        const o = mesh(
          new T.OctahedronGeometry(1, 0),
          i % 3 === 0 ? purpleMat : crystalMat,
          px,
          wildsGroundHeight(px, pz) + 1.1,
          pz,
        );
        o.scale.set(0.7, 1.5 + j * 0.4, 0.7);
        o.rotation.z = (j - 1) * 0.25;
      }
    }
    for (let i = 0; i < 15; i++) {
      const c = WILDS_CLEARINGS[i % 5],
        a = i * 2.399,
        x = c.x + Math.cos(a) * c.rx,
        z = c.z + Math.sin(a) * c.rz;
      for (let j = 0; j < 3; j++) {
        const px = x + j * 0.6,
          pz = z + j * 0.3;
        const o = mesh(
          new T.SphereGeometry(0.65, 10, 6),
          i % 4 === 0 ? purpleMat : crystalMat,
          px,
          wildsGroundHeight(px, pz) + 0.22,
          pz,
        );
        o.scale.y = 0.5;
      }
    }
    const rocks = wildsProps().filter((p) => p.kind === 'rock'),
      rockGeo = geo(new T.IcosahedronGeometry(1, 1)),
      rockBatch = new T.InstancedMesh(rockGeo, rockMat, rocks.length),
      dummy = new T.Object3D();
    rocks.forEach((p, i) => {
      dummy.position.set(
        p.x,
        wildsGroundHeight(p.x, p.z) + p.height * 0.35,
        p.z,
      );
      dummy.scale.set(p.height * 0.7, p.height * 0.6, p.height * 0.65);
      dummy.rotation.set(0.1, p.yaw, 0.15);
      dummy.updateMatrix();
      rockBatch.setMatrixAt(i, dummy.matrix);
    });
    root.add(rockBatch);
    rockBatch.receiveShadow = true;
    const portalMat = mat(
      new T.MeshStandardMaterial({
        color: '#e4b977',
        emissive: '#b47b30',
        emissiveIntensity: 1.2,
        roughness: 0.5,
      }),
    );
    for (const p of WILDS_PORTALS) {
      const group = new T.Group();
      group.position.set(p.x, wildsGroundHeight(p.x, p.z), p.z);
      group.userData.destination = p.destination;
      group.scale.setScalar(1.7);
      root.add(group);
      const ring = mesh(
        new T.TorusGeometry(2.3, 0.18, 8, 32),
        portalMat,
        0,
        2.6,
        0,
        group,
      );
      ring.name = p.name;
      mesh(new T.BoxGeometry(6, 0.4, 4), stoneMat, 0, -0.2, 0, group);
      const hitMat = mat(
        new T.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      mesh(new T.BoxGeometry(5, 6, 1), hitMat, 0, 3, 0, group);
    }
    vfx = createWildsVfx(quality);
    root.add(vfx.root);
    grass = createWildsGrass(quality);
    root.add(grass.root);
    const navigation = new WildsNavigation();
    let currentQuality = quality,
      time = 0,
      visibleChunks = 0,
      previousLod = -1;
    const accents = [WILDS_LANDMARKS[0], WILDS_LANDMARKS[5]].map((p, i) => {
      const light = new T.PointLight(i ? '#7c4cda' : '#428bdb', 8, 18, 2);
      light.position.set(p.x, wildsGroundHeight(p.x, p.z) + 3, p.z);
      light.visible = false;
      root.add(light);
      return light;
    });
    function update(
      camera: T.Camera,
      player: WildsPoint,
      dt: number,
      dpr = 1,
      free = false,
    ) {
      if (disposed) return;
      time += Math.min(0.1, Math.max(0, dt));
      sky.update(camera, time);
      mushrooms.update(time);
      boundary.update(time);
      waterMat.userData.waterTime.value = time;
      tx.water.offset.set(time * 0.002, -time * 0.012);
      vfx!.update(camera, player, dt, dpr, free);
      grass!.update(camera, player, dt, free);
      if (time - previousLod < 0.15) return;
      previousLod = time;
      iconTree.setDetail(currentQuality, camera);
      visibleChunks = 0;

      const profile = WILDS_QUALITY[currentQuality];
      for (const chunk of chunks) {
        const d = Math.hypot(
            chunk.x - camera.position.x,
            chunk.z - camera.position.z,
          ),
          level = chunk.shore || d < 140 ? 0 : d < 280 ? 1 : 2;
        chunk.meshes.forEach((m, i) => {
          m.visible = i === level;
        });
        visibleChunks++;
      }
      accents.forEach(
        (l) =>
          (l.visible =
            profile.shadow > 0 && l.position.distanceTo(camera.position) < 55),
      );
    }
    function drawMinimap(ctx: CanvasRenderingContext2D, size: number) {
      const project = (n: number) => ((n + 500) / 1000) * size;
      ctx.fillStyle = '#091321';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#293f39';
      ctx.beginPath();
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2,
          p = { x: Math.cos(a) * 500, z: Math.sin(a) * 500 },
          r = 500 - wildsIslandDistance(p);
        const x = project(Math.cos(a) * r),
          z = project(Math.sin(a) * r);
        if (i) ctx.lineTo(x, z);
        else ctx.moveTo(x, z);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3277a0';
      for (const line of [WILDS_RIVER, ...WILDS_TRIBUTARIES]) {
        ctx.lineWidth = line === WILDS_RIVER ? size * 0.034 : size * 0.008;
        ctx.beginPath();
        line.forEach((p, i) =>
          i
            ? ctx.lineTo(project(p.x), project(p.z))
            : ctx.moveTo(project(p.x), project(p.z)),
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#3277a0';
      ctx.beginPath();
      for (let i = 0; i < 80; i++) {
        const a = (i / 80) * Math.PI * 2,
          r = wildsLakeEdge(a),
          x = project(lake.x + Math.cos(a) * lake.rx * r),
          z = project(lake.z + Math.sin(a) * lake.rz * r);
        if (i) ctx.lineTo(x, z);
        else ctx.moveTo(x, z);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#293f39';
      ctx.beginPath();
      ctx.ellipse(
        project(WILDS_LAKE_ISLAND.x),
        project(WILDS_LAKE_ISLAND.z),
        (size * WILDS_LAKE_ISLAND.rx) / 1000,
        (size * WILDS_LAKE_ISLAND.rz) / 1000,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      drawWildsMinimapBridges(ctx, size);
      ctx.strokeStyle = '#78e8ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(
        project(WILDS_ALTAR.x),
        project(WILDS_ALTAR.z),
        (size * WILDS_ALTAR.radius) / 1000,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.fillStyle = '#a6c6f5';
      for (const p of WILDS_LANDMARKS) {
        ctx.beginPath();
        ctx.arc(project(p.x), project(p.z), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Landmark crown inside the island; bridges stay visible beneath it.
      const treeX = project(WILDS_LAKE_ISLAND.x),
        treeZ = project(WILDS_LAKE_ISLAND.z);
      ctx.fillStyle = '#163f30';
      ctx.strokeStyle = '#b4d6aa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(treeX, treeZ, Math.max(3.5, size * 0.016), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#d6c89d';
      ctx.beginPath();
      ctx.moveTo(treeX, treeZ + 3);
      ctx.lineTo(treeX, treeZ - 2);
      ctx.moveTo(treeX - 2, treeZ - 1);
      ctx.lineTo(treeX, treeZ + 1);
      ctx.lineTo(treeX + 2, treeZ - 1);
      ctx.stroke();
      ctx.fillStyle = '#ddc893';
      for (const p of WILDS_PORTALS)
        ctx.fillRect(project(p.x) - 2, project(p.z) - 2, 4, 4);
    }
    return {
      root,
      surfaces,
      bounds: WILDS_BOUNDS,
      entry: WILDS_ENTRY,
      navigation,
      groundHeight: wildsGroundHeight,
      move: navigation.move.bind(navigation),
      safe: () => true,
      update,
      drawMinimap,
      dispose,
      get quality() {
        return currentQuality;
      },
      setQuality(q: WildsQuality) {
        currentQuality = q;
        vfx!.setQuality(q);
        grass!.setQuality(q);
        previousLod = -1;
      },
      setVfxEnabled(value: boolean) {
        vfx!.setEnabled(value);
      },
      metrics: () => ({
        size: 1000,
        terrainChunks: chunks.length,
        visibleChunks,
        visibleTreeCells: 1,
        trees: 1,
        iconTree: iconTree.metrics(),
        mushrooms: mushrooms.metrics(),
        rocks: rocks.length,
        landmarks: 6,
        bridges: WILDS_BRIDGES.length,
        waterfalls: WILDS_FALLS.length,
        sky: 'Chaotic Skies 03 / blue night',
        skyDrawCalls: 1,
        particles: vfx!.metrics(),
        grass: grass!.metrics(),
        sourceAssetsUnmodified: true,
      }),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
