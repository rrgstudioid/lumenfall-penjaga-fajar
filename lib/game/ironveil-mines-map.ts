import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GraphicsQuality } from './graphics-quality';
import { createIronveilSky, IRONVEIL_CLOUD_ATLAS } from './ironveil-mines-sky';
import {
  IRONVEIL_ASSETS,
  createIronveilMaterials,
  type IronveilTextures,
} from './ironveil-mines-materials';
import {
  IRONVEIL_ID,
  IRONVEIL_BOUNDS,
  IRONVEIL_ENTRY,
  IRONVEIL_TRANSITION,
  IRONVEIL_PATHS,
  IRONVEIL_BOXES,
  IRONVEIL_STEP,
  ironveilHeightfield,
  ironveilGroundHeight,
  ironveilCypressBaseHeight,
  ironveilPathDistance,
  ironveilProps,
  IronveilNavigation,
  type IronveilPoint,
} from './ironveil-mines-layout';

const ROOT = '/assets/maps/ironveil-mines-exterior-v1/';
export async function buildIronveilMines(quality: GraphicsQuality = 'office') {
  const root = new T.Group();
  root.name = IRONVEIL_ID;
  const surfaces = new T.Group();
  surfaces.name = 'Ironveil walk surfaces';
  root.add(surfaces);
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const cameraBlockers: T.Object3D[] = [];
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
  let disposed = false,
    currentQuality = quality;
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
  try {
    const loader = new GLTFLoader(),
      tl = new T.TextureLoader();
    const loaded = await Promise.allSettled(
      Object.entries(IRONVEIL_ASSETS).map(async ([key, url]) => {
        const t = ownT(await tl.loadAsync(url));
        t.colorSpace = T.SRGBColorSpace;
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.anisotropy = 4;
        return [key, t] as const;
      }),
    );
    const failed = loaded.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const tex = Object.fromEntries(
      loaded.map(
        (r) =>
          (r as PromiseFulfilledResult<readonly [string, T.Texture]>).value,
      ),
    ) as IronveilTextures;
    const mat = createIronveilMaterials(tex);
    Object.values(mat).forEach(ownM);
    const clouds = ownT(await tl.loadAsync(IRONVEIL_CLOUD_ATLAS));
    // Reuse Verdant's URL, with a 1K GPU copy to stay within this map's budget.
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = cloudCanvas.height = 1024;
    const cloudContext = cloudCanvas.getContext('2d');
    if (!cloudContext)
      throw new Error('Unable to prepare Ironveil cloud atlas.');
    cloudContext.drawImage(clouds.image, 0, 0, 1024, 1024);
    clouds.image = cloudCanvas;
    clouds.needsUpdate = true;
    clouds.colorSpace = T.NoColorSpace;
    clouds.wrapS = clouds.wrapT = T.ClampToEdgeWrapping;
    const sky = createIronveilSky(clouds);
    ownG(sky.mesh.geometry);
    ownM(sky.mesh.material);
    root.add(sky.mesh);
    const modelURLs = {
      rock01: ROOT + 'owner-rock-01.glb',
      rock04: ROOT + 'owner-rock-04.glb',
      cypress: ROOT + 'cypress.glb',
      crate: ROOT + 'crate.glb',
      barrel: ROOT + 'barrel.glb',
      fence: ROOT + 'fence.glb',
      lantern: ROOT + 'lantern.glb',
      banner: '/assets/maps/verdant-plains-v2/banner.glb',
    };
    const models = new Map<string, T.Group>(),
      trimCache = new Map<string, T.Texture>();
    const results = await Promise.allSettled(
      Object.entries(modelURLs).map(async ([name, url]) => {
        const asset = await loader.loadAsync(url),
          model = asset.scene;
        models.set(name, model);
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            ownG(o.geometry);
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              ownM(m);
              for (const [slot, v] of Object.entries(m))
                if (v instanceof T.Texture) {
                  const index = asset.parser.associations.get(v)?.textures;
                  const definition =
                    index === undefined
                      ? undefined
                      : asset.parser.json.textures[index];
                  const source =
                    definition?.extensions?.EXT_texture_webp?.source ??
                    definition?.source;
                  const uri =
                    source === undefined
                      ? undefined
                      : asset.parser.json.images[source]?.uri;
                  if (
                    url.startsWith(ROOT) &&
                    (uri?.startsWith('trim-') ||
                      uri === 'owner-rock-basecolor.webp')
                  ) {
                    const key = `${uri}:${v.colorSpace}:${v.channel}:${v.wrapS}:${v.wrapT}`,
                      cached = trimCache.get(key);
                    if (cached) {
                      (m as unknown as Record<string, unknown>)[slot] = cached;
                      if (cached !== v) v.dispose();
                      continue;
                    }
                    trimCache.set(key, v);
                  }
                  ownT(v);
                }
            }
          }
        });
        model.updateMatrixWorld(true);
      }),
    );
    const modelFailure = results.find((r) => r.status === 'rejected');
    if (modelFailure?.status === 'rejected') throw modelFailure.reason;
    const box = ownG(new T.BoxGeometry(1, 1, 1));
    function mesh(
      g: T.BufferGeometry,
      m: T.Material,
      x = 0,
      y = 0,
      z = 0,
      parent: T.Object3D = root,
    ) {
      const o = new T.Mesh(g, m);
      o.position.set(x, y, z);
      o.receiveShadow = true;
      parent.add(o);
      return o;
    }
    function block(
      name: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      m: T.Material = mat.wood,
      parent: T.Object3D = root,
    ) {
      const o = mesh(box, m, x, y, z, parent);
      o.scale.set(w, h, d);
      o.name = name;
      o.userData.shadowEligible = true;
      return o;
    }
    function beam(
      a: T.Vector3,
      b: T.Vector3,
      width: number,
      depth = width,
      parent: T.Object3D = root,
    ) {
      const o = block(
        'Timber brace',
        0,
        0,
        0,
        width,
        a.distanceTo(b),
        depth,
        mat.wood,
        parent,
      );
      o.position.copy(a).add(b).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      );
      return o;
    }
    // The same triangles sampled by ironveilGroundHeight, split into 32 cullable patches.
    const heights = ironveilHeightfield();
    for (let row = 0; row < 128; row += 32)
      for (let col = 0; col < 256; col += 32) {
        const positions: number[] = [],
          masks: number[] = [],
          indices: number[] = [];
        for (let j = 0; j <= 32; j++)
          for (let i = 0; i <= 32; i++) {
            const x = (col + i) * IRONVEIL_STEP - 500,
              z = (row + j) * IRONVEIL_STEP;
            positions.push(x, heights[(row + j) * 257 + col + i], z);
            const d = ironveilPathDistance({ x, z });
            const path = 1 - T.MathUtils.smoothstep(d, 5, 10);
            const patch =
              0.5 +
              0.22 * Math.sin(x * 0.038 + Math.cos(z * 0.027) * 2) +
              0.18 * Math.cos(z * 0.059 + x * 0.019) +
              0.12 * Math.sin(x * 0.11) * Math.cos(z * 0.09);
            masks.push(path, T.MathUtils.clamp(patch, 0.05, 0.92));
          }
        for (let j = 0; j < 32; j++)
          for (let i = 0; i < 32; i++) {
            const a = j * 33 + i,
              b = a + 1,
              c = a + 33,
              d = c + 1;
            indices.push(a, c, b, b, c, d);
          }
        const g = ownG(new T.BufferGeometry());
        g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        g.setAttribute('ironveilMask', new T.Float32BufferAttribute(masks, 2));
        g.setIndex(indices);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        mesh(g, mat.terrain, 0, 0, 0, surfaces).name = 'Outdoor terrain';
      }
    function floor(name: string, x: number, z: number, w: number, d: number) {
      const g = ownG(new T.PlaneGeometry(w, d));
      g.rotateX(-Math.PI / 2);
      const mask = new Float32Array(g.attributes.position.count * 2);
      mask.fill(0);
      for (let i = 0; i < mask.length; i += 2) mask[i] = 1;
      g.setAttribute('ironveilMask', new T.BufferAttribute(mask, 2));
      const o = mesh(g, mat.terrain, x, 12, z, surfaces);
      o.name = name;
      return o;
    }
    floor('Mine staging', 220, -25, 80, 50);
    floor('Mine vestibule floor', 220, -56, 16, 12);
    // A continuous, sloping mountain heightfield replaces the former vertical
    // slab walls. Shared indexed vertices give the terrain continuous normals.
    const mountainMaterial = mat.cliff;
    // The free/inspection camera can see a steep perimeter from its outer side.
    mountainMaterial.side = T.DoubleSide;
    // Use the same UV scale and mask contract as Whispering Wilds terrain.
    function cliffAttributes(g: T.BufferGeometry) {
      const p = g.attributes.position;
      const uv: number[] = [];
      for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / 12, p.getZ(i) / 12);
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute(
        'forestMask',
        new T.Float32BufferAttribute(new Float32Array(p.count * 2), 2),
      );
    }
    const fade = (v: number) => {
      const t = T.MathUtils.clamp(v, 0, 1);
      return t * t * (3 - 2 * t);
    };
    const hash = (x: number, z: number) => {
      const v = Math.sin(x * 127.1 + z * 311.7 + 71.3) * 43758.5453;
      return v - Math.floor(v);
    };
    function noise(x: number, z: number) {
      const ix = Math.floor(x),
        iz = Math.floor(z),
        u = fade(x - ix),
        v = fade(z - iz);
      return (
        T.MathUtils.lerp(
          T.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u),
          T.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u),
          v,
        ) *
          2 -
        1
      );
    }
    const rimRise = (x: number, z: number) => {
      const depth = Math.hypot(
        Math.max(0, Math.abs(x) - 480),
        Math.max(0, z - 480),
      );
      const ridge =
        95 +
        25 * Math.sin(x * 0.023 + z * 0.017) ** 2 +
        8 * noise(x * 0.045, z * 0.045);
      return ridge * (1 - Math.exp(-depth / 8));
    };
    const mountainHeight = (x: number, z: number) => {
      // Distance from the outdoor field/staging keeps the existing walkable
      // ground clear, while the inaccessible terrain begins with a steep slope.
      const stagingDistance = Math.hypot(
        Math.max(0, Math.abs(x - 220) - 40),
        Math.max(0, -50 - z),
      );
      const depth = Math.max(0, Math.min(-z, stagingDistance));
      // Broad interlocking ridges and short, steep shoulders use the same
      // sin-squared ridge vocabulary as Whispering Wilds' terrain boundary.
      const ridge =
        125 +
        45 * Math.sin(x * 0.009 + z * 0.005) ** 2 +
        38 * Math.cos(z * 0.014 - x * 0.004) ** 2;
      // Alternate projecting ribs with deeper gullies. The rise continues
      // inland rather than ending along a straight, shelf-like crest.
      const shoulder =
        42 + 65 * Math.sin(x * 0.022 + 1.4 * Math.sin(x * 0.007)) ** 2;
      const rockDetail =
        10 * noise(x * 0.026, z * 0.026) +
        3.5 * noise(x * 0.071 + 19, z * 0.071 - 8);
      const rise = (ridge + rockDetail) * (1 - Math.exp(-depth / shoulder));
      // The entrance sits beneath the tallest local cliff mass. Fade by the
      // staging distance so its open floor and all shared ground seams stay put.
      const entranceButtress =
        130 *
        Math.exp(-(((x - 220) / 240) ** 2 + ((z + 100) / 230) ** 2)) *
        (1 - Math.exp(-depth / 22));
      // The mine is cut into a rocky shoulder connected to the terrain, with
      // enough rock above the frame instead of a separate triangular pediment.
      const portalRoof =
        (90 + 10 * Math.sin(x * 0.11) + 6 * Math.cos(x * 0.18)) *
        Math.exp(-(((x - 220) / 32) ** 2)) *
        fade((40 - Math.abs(x - 220)) / 12) *
        fade(-z / 25) *
        (1 - fade((-z - 65) / 70));
      return (
        12 +
        rise +
        entranceButtress +
        portalRoof +
        rimRise(x, z) * (1 - fade(-z / 60))
      );
    };
    // Five-unit terrain samples, including the exact opening edges. There are no
    // tall vertical boundary meshes, rectangular towers, or flat mountain roofs.
    const xs = [
      ...new Set([
        ...Array.from({ length: 201 }, (_, i) => i * 5 - 500),
        212,
        228,
      ]),
    ].sort((a, b) => a - b);
    const positions: number[] = [],
      indices: number[] = [],
      normals: number[] = [];
    for (let j = 0; j <= 100; j++)
      for (const x of xs) {
        const z = -500 + j * 5;
        positions.push(x, mountainHeight(x, z), z);
        const normal = new T.Vector3(
          mountainHeight(x - 0.4, z) - mountainHeight(x + 0.4, z),
          0.8,
          mountainHeight(x, z - 0.4) - mountainHeight(x, z + 0.4),
        ).normalize();
        normals.push(normal.x, normal.y, normal.z);
      }
    for (let j = 0; j < 100; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        const z = -500 + j * 5;
        if (xs[i] >= 180 && xs[i + 1] <= 260 && z >= -50) continue;
        const a = j * xs.length + i,
          b = a + 1,
          c = a + xs.length,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    const mountainGeometry = ownG(new T.BufferGeometry());
    mountainGeometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(positions, 3),
    );
    mountainGeometry.setAttribute(
      'normal',
      new T.Float32BufferAttribute(normals, 3),
    );
    mountainGeometry.setIndex(indices);
    cliffAttributes(mountainGeometry);
    mountainGeometry.computeBoundingSphere();
    const mountain = mesh(mountainGeometry, mountainMaterial);
    mountain.name = 'Mountain continuous terrain';
    cameraBlockers.push(mountain);
    // Only the small natural rock collar around the tunnel has an exposed cut
    // face. Its top is welded to the heightfield; the center is a real opening.
    const collarPositions: number[] = [],
      collarIndices: number[] = [];
    const collarX = xs.filter((x) => x >= 180 && x <= 260);
    for (const x of collarX) {
      const bottom = x >= 212 && x <= 228 ? 24 : 12;
      collarPositions.push(x, bottom, -50, x, mountainHeight(x, -50), -50);
    }
    for (let i = 0; i < collarX.length - 1; i++) {
      const x = collarX[i],
        xx = collarX[i + 1];
      // Duplicate bottom endpoints at the doorway corners to avoid diagonal
      // geometry across the clear opening.
      const floor = x >= 212 && xx <= 228 ? 24 : 12,
        k = collarPositions.length / 3;
      collarPositions.push(x, floor, -50, xx, floor, -50);
      collarIndices.push(
        k,
        k + 1,
        i * 2 + 1,
        k + 1,
        (i + 1) * 2 + 1,
        i * 2 + 1,
      );
    }
    const collarGeometry = ownG(new T.BufferGeometry());
    collarGeometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(collarPositions, 3),
    );
    collarGeometry.setIndex(collarIndices);
    cliffAttributes(collarGeometry);
    collarGeometry.computeVertexNormals();
    collarGeometry.computeBoundingSphere();
    const collar = mesh(collarGeometry, mountainMaterial);
    collar.name = 'Mountain mine rock collar';
    cameraBlockers.push(collar);
    // One indexed U-shaped heightfield closes the west, east and south edges.
    // Shared corner vertices and the northern height function avoid separate
    // overlapping strips, diagonal holes, or different materials at the joins.
    const perimeterHeight = (x: number, z: number): number =>
      z < 0
        ? mountainHeight(x, z)
        : ironveilGroundHeight(
            T.MathUtils.clamp(x, -480, 480),
            T.MathUtils.clamp(z, 0, 480),
          ) + rimRise(x, z);
    const rimPositions: number[] = [],
      rimNormals: number[] = [],
      rimIndices: number[] = [];
    const rimVertices = new Map<string, number>();
    function rimVertex(x: number, z: number) {
      const key = `${x},${z}`;
      const previous = rimVertices.get(key);
      if (previous !== undefined) return previous;
      const index = rimPositions.length / 3;
      rimVertices.set(key, index);
      rimPositions.push(x, perimeterHeight(x, z), z);
      const n = new T.Vector3(
        perimeterHeight(x - 0.4, z) - perimeterHeight(x + 0.4, z),
        0.8,
        perimeterHeight(x, z - 0.4) - perimeterHeight(x, z + 0.4),
      ).normalize();
      rimNormals.push(n.x, n.y, n.z);
      return index;
    }
    for (let z = 0; z < 500; z += 5) {
      for (let x = -500; x < 500; x += 5) {
        if (x >= -480 && x < 480 && z < 480) continue;
        const a = rimVertex(x, z),
          b = rimVertex(x + 5, z),
          c = rimVertex(x, z + 5),
          d = rimVertex(x + 5, z + 5);
        rimIndices.push(a, c, b, b, c, d);
      }
    }
    const rimGeometry = ownG(new T.BufferGeometry());
    rimGeometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(rimPositions, 3),
    );
    rimGeometry.setAttribute(
      'normal',
      new T.Float32BufferAttribute(rimNormals, 3),
    );
    rimGeometry.setIndex(rimIndices);
    cliffAttributes(rimGeometry);
    rimGeometry.computeBoundingSphere();
    const rimMesh = mesh(rimGeometry, mountainMaterial);
    rimMesh.name = 'Mountain perimeter terrain';
    cameraBlockers.push(rimMesh);
    // Non-playable mountain continuation: 550 units of broad shoulders,
    // secondary ridges and descending backs outside the 1000-unit play map.
    // Coarser rings reduce distant geometry, while the inner ring matches every
    // boundary vertex (including the north edge's extra doorway X samples).
    const sceneryHeight = (x: number, z: number) => {
      const depth = Math.hypot(
        Math.max(0, Math.abs(x) - 500),
        Math.max(0, Math.abs(z) - 500),
      );
      const firstRidge =
        (145 +
          55 * noise(x * 0.005, z * 0.005) +
          35 * Math.sin(x * 0.007 - z * 0.009) ** 2) *
        Math.exp(-(((depth - 150) / 125) ** 2)) *
        fade(depth / 70);
      const rearRidge =
        (175 + 55 * noise(x * 0.003 + 11, z * 0.003 - 7)) *
        Math.exp(-(((depth - 325) / 125) ** 2)) *
        fade(depth / 150);
      const broadBase =
        (perimeterHeight(x - 24, z) +
          perimeterHeight(x + 24, z) +
          perimeterHeight(x, z - 24) +
          perimeterHeight(x, z + 24)) /
        4;
      const height =
        T.MathUtils.lerp(perimeterHeight(x, z), broadBase, fade(depth / 100)) +
        firstRidge +
        rearRidge;
      return T.MathUtils.lerp(height, -35, fade((depth - 400) / 150));
    };
    const sceneryRings = [
      { distance: 0, segments: 200 },
      { distance: 30, segments: 100 },
      { distance: 70, segments: 100 },
      { distance: 120, segments: 100 },
      { distance: 180, segments: 75 },
      { distance: 240, segments: 50 },
      { distance: 300, segments: 50 },
      { distance: 360, segments: 50 },
      { distance: 420, segments: 50 },
      { distance: 480, segments: 50 },
      { distance: 550, segments: 50 },
    ];
    for (let side = 0; side < 4; side++) {
      const points: number[] = [],
        normals: number[] = [],
        indices: number[] = [];
      const rows: Array<Array<{ t: number; index: number }>> = [];
      for (const ring of sceneryRings) {
        const span = 500 + ring.distance;
        const steps =
          ring.distance === 0 && side === 0
            ? xs.map((x) => (x + 500) / 1000)
            : Array.from(
                { length: ring.segments + 1 },
                (_, i) => i / ring.segments,
              );
        const row: Array<{ t: number; index: number }> = [];
        for (const t of steps) {
          const along = -span + 2 * span * t;
          const x =
            side === 0
              ? along
              : side === 1
                ? span
                : side === 2
                  ? -along
                  : -span;
          const z =
            side === 0
              ? -span
              : side === 1
                ? along
                : side === 2
                  ? span
                  : -along;
          row.push({ t, index: points.length / 3 });
          points.push(x, sceneryHeight(x, z), z);
          const n = new T.Vector3(
            sceneryHeight(x - 0.4, z) - sceneryHeight(x + 0.4, z),
            0.8,
            sceneryHeight(x, z - 0.4) - sceneryHeight(x, z + 0.4),
          ).normalize();
          normals.push(n.x, n.y, n.z);
        }
        rows.push(row);
      }
      // Zipper strips join different resolutions without T-junctions.
      for (let r = 0; r < rows.length - 1; r++) {
        const inner = rows[r],
          outer = rows[r + 1];
        let i = 0,
          j = 0;
        while (i < inner.length - 1 || j < outer.length - 1) {
          if (
            i < inner.length - 1 &&
            (j === outer.length - 1 || inner[i + 1].t <= outer[j + 1].t)
          ) {
            indices.push(inner[i].index, inner[i + 1].index, outer[j].index);
            i++;
          } else {
            indices.push(inner[i].index, outer[j + 1].index, outer[j].index);
            j++;
          }
        }
      }
      const geometry = ownG(new T.BufferGeometry());
      geometry.setAttribute(
        'position',
        new T.Float32BufferAttribute(points, 3),
      );
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geometry.setIndex(indices);
      cliffAttributes(geometry);
      geometry.computeBoundingSphere();
      const continuation = mesh(geometry, mountainMaterial);
      continuation.name = 'Mountain outer range ' + side;
      cameraBlockers.push(continuation);
    }
    const entrance = new T.Group();
    entrance.name = 'Single mine entrance';
    root.add(entrance);
    // Open-ended tunnel lining: only the inner walls, roof and sealed back.
    // The old boxes had front caps coplanar with the rock collar at z=-50,
    // causing the flickering stone patches visible through the timber frame.
    const tunnelPositions: number[] = [],
      tunnelUVs: number[] = [],
      tunnelIndices: number[] = [];
    function tunnelQuad(points: number[][], uAxis: number, vAxis: number) {
      const start = tunnelPositions.length / 3;
      for (const p of points) {
        tunnelPositions.push(...p);
        tunnelUVs.push(p[uAxis] * 0.075, p[vAxis] * 0.075);
      }
      tunnelIndices.push(
        start,
        start + 1,
        start + 2,
        start,
        start + 2,
        start + 3,
      );
    }
    tunnelQuad(
      [
        [212, 12, -50],
        [212, 12, -62],
        [212, 24, -62],
        [212, 24, -50],
      ],
      2,
      1,
    );
    tunnelQuad(
      [
        [228, 12, -62],
        [228, 12, -50],
        [228, 24, -50],
        [228, 24, -62],
      ],
      2,
      1,
    );
    tunnelQuad(
      [
        [212, 24, -50],
        [212, 24, -62],
        [228, 24, -62],
        [228, 24, -50],
      ],
      0,
      2,
    );
    tunnelQuad(
      [
        [212, 12, -62],
        [228, 12, -62],
        [228, 24, -62],
        [212, 24, -62],
      ],
      0,
      1,
    );
    const tunnelGeometry = ownG(new T.BufferGeometry());
    tunnelGeometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(tunnelPositions, 3),
    );
    tunnelGeometry.setAttribute(
      'uv',
      new T.Float32BufferAttribute(tunnelUVs, 2),
    );
    tunnelGeometry.setIndex(tunnelIndices);
    tunnelGeometry.computeVertexNormals();
    const tunnelMaterial = ownM(
      new T.MeshStandardMaterial({
        map: tex.rock,
        color: '#343d36',
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    mesh(tunnelGeometry, tunnelMaterial, 0, 0, 0, entrance).name =
      'Continuous tunnel lining';
    cameraBlockers.push(...entrance.children);
    for (const x of [210.5, 229.5]) {
      block('Timber upright', x, 19, -48.8, 2, 14, 2, mat.wood, entrance);
      block('Stone footing', x, 13, -48.8, 2.8, 2, 2.8, mat.rock, entrance);
    }
    block('Mine lintel', 220, 27, -48.8, 23, 2, 2.7, mat.wood, entrance);
    for (const side of [-1, 1])
      beam(
        new T.Vector3(220 + side * 8.5, 20, -47.5),
        new T.Vector3(220 + side * 3.5, 26, -47.5),
        1,
        1,
        entrance,
      );
    // Decorative metal bolts, using one shared sphere geometry.
    const bolt = ownG(new T.SphereGeometry(0.22, 6, 4));
    for (const x of [210.5, 216, 224, 229.5])
      mesh(bolt, mat.metal, x, 27, -47.3, entrance);
    for (const x of [218.1, 221.9])
      block('Mine rail', x, 12.09, -40, 0.17, 0.16, 44, mat.metal, entrance);
    for (let z = -60; z <= -18; z += 2.5)
      block('Rail sleeper', 220, 12.025, z, 5, 0.05, 0.5, mat.wood, entrance);
    const interaction = mesh(
      ownG(new T.BoxGeometry(16, 12, 6)),
      ownM(
        new T.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      ),
      220,
      18,
      -51,
      entrance,
    );
    interaction.name = 'Mine entrance interaction';
    interaction.userData.ironveilEntrance = true;
    entrance.userData.ironveilEntrance = true;
    // Bake independent geometry for instancing, without modifying imported source buffers.
    function parts(name: string, override?: T.Material) {
      const source = models.get(name)!;
      source.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(source),
        size = bounds.getSize(new T.Vector3()),
        h = size.y || 1;
      // Uniform height normalization preserves the owner's proportions and UVs.
      const horizontal = 1 / h;
      const normalize = new T.Matrix4()
        .makeScale(horizontal, 1 / h, horizontal)
        .multiply(
          new T.Matrix4().makeTranslation(
            -(bounds.min.x + bounds.max.x) / 2,
            -bounds.min.y,
            -(bounds.min.z + bounds.max.z) / 2,
          ),
        );
      const out: Array<{ g: T.BufferGeometry; m: T.Material | T.Material[] }> =
        [];
      source.traverse((o) => {
        if (o instanceof T.Mesh) {
          const g = ownG(o.geometry.clone());
          g.applyMatrix4(normalize.clone().multiply(o.matrixWorld));
          const replace = (m: T.Material) => override ?? m;
          out.push({
            g,
            m: Array.isArray(o.material)
              ? o.material.map(replace)
              : replace(o.material),
          });
        }
      });
      return out;
    }
    const sourceParts = new Map<string, ReturnType<typeof parts>>();
    for (const name of Object.keys(modelURLs))
      sourceParts.set(name, parts(name));
    type Placement = IronveilPoint & { height: number; yaw: number };
    const matrix = new T.Matrix4(),
      q = new T.Quaternion();
    function instances(
      name: string,
      list: Placement[],
      parent: T.Object3D = root,
    ) {
      for (const part of sourceParts.get(name)!) {
        const o = new T.InstancedMesh(part.g, part.m, list.length);
        o.name = 'Ironveil ' + name + ' instances';
        list.forEach((p, i) => {
          matrix.compose(
            new T.Vector3(
              p.x,
              name === 'cypress'
                ? ironveilCypressBaseHeight(p)
                : ironveilGroundHeight(p.x, p.z),
              p.z,
            ),
            q.setFromAxisAngle(new T.Vector3(0, 1, 0), p.yaw),
            new T.Vector3(p.height, p.height, p.height),
          );
          o.setMatrixAt(i, matrix);
        });
        o.computeBoundingSphere();
        o.receiveShadow = true;
        o.userData.shadowEligible = true;
        parent.add(o);
      }
    }
    const props = ironveilProps();
    // The supplied meshes are low-poly enough to retain their real silhouettes
    // at every distance, with cell-level instancing and ordinary frustum culling.
    for (const kind of ['cypress', 'rock'] as const) {
      const cells = new Map<string, typeof props>();
      for (const p of props.filter((p) => p.kind === kind)) {
        const key = `${Math.floor(p.x / 100)},${Math.floor(p.z / 100)},${p.variant}`;
        const list = cells.get(key) ?? [];
        list.push(p);
        cells.set(key, list);
      }
      for (const list of cells.values()) {
        instances(
          kind === 'rock' ? ['rock01', 'rock04'][list[0].variant] : 'cypress',
          list,
        );
      }
    }
    // Imported props retain trim UVs; all duplicate crates/barrels share source materials.
    instances(
      'crate',
      IRONVEIL_BOXES.filter((b) => b.name === 'crate').map((b) => ({
        ...b,
        height: 2.4,
        yaw: 0,
      })),
    );
    instances(
      'barrel',
      IRONVEIL_BOXES.filter((b) => b.name === 'barrel').map((b) => ({
        ...b,
        height: 2.1,
        yaw: 0,
      })),
    );
    function model(
      name: string,
      x: number,
      y: number,
      z: number,
      height: number,
      yaw = 0,
      parent: T.Object3D = root,
    ) {
      const g = new T.Group();
      g.position.set(x, y, z);
      g.scale.setScalar(height);
      g.rotation.y = yaw;
      for (const part of sourceParts.get(name)!) {
        const o = new T.Mesh(part.g, part.m);
        o.receiveShadow = true;
        g.add(o);
      }
      parent.add(g);
      return g;
    }
    for (const x of [208.5, 231.5]) {
      model('lantern', x, 16, -46.7, 2, 0, entrance);
      mesh(bolt, mat.light, x, 16.9, -46.2, entrance).scale.set(1.7, 2.2, 1.7);
    }
    for (const x of [205, 235])
      model('banner', x, 12, -49, 8, Math.PI, entrance);
    for (const b of IRONVEIL_BOXES.filter((b) => b.name === 'shelter post'))
      block('Shelter post', b.x, 15, b.z, 0.9, 6, 0.9);
    block('Shelter roof', 190, 18.5, -40, 13, 0.65, 11).rotation.z = 0.08;
    // Side-parked cart: hollow box and four wheels, with a shared metal material.
    const cart = new T.Group();
    cart.name = 'Mine cart';
    cart.position.set(234, 12, -20);
    root.add(cart);
    block('Cart floor', 0, 1, 0, 4, 0.3, 5, mat.metal, cart);
    for (const x of [-1.9, 1.9])
      block('Cart side', x, 2, 0, 0.2, 2, 5, mat.metal, cart);
    for (const z of [-2.4, 2.4])
      block('Cart end', 0, 2, z, 4, 2, 0.2, mat.metal, cart);
    const wheel = ownG(new T.CylinderGeometry(0.65, 0.65, 0.3, 10));
    for (const x of [-2, 2])
      for (const z of [-1.7, 1.7])
        mesh(wheel, mat.metal, x, 0.65, z, cart).rotation.z = Math.PI / 2;
    instances('fence', [
      { x: -465, z: 355, height: 2, yaw: 0 },
      { x: 455, z: 410, height: 2, yaw: 0 },
    ]);
    const navigation = new IronveilNavigation();
    const cameraRay = new T.Raycaster(),
      cameraDirection = new T.Vector3();
    function constrainCamera(focus: T.Vector3, desired: T.Vector3) {
      cameraDirection.copy(desired).sub(focus);
      const distance = cameraDirection.length();
      if (distance < 0.01) return desired;
      cameraRay.set(focus, cameraDirection.normalize());
      cameraRay.far = distance;
      const hit = cameraRay.intersectObjects(cameraBlockers, false)[0];
      return hit
        ? focus
            .clone()
            .addScaledVector(
              cameraDirection,
              Math.max(0.5, hit.distance - 0.65),
            )
        : desired;
    }
    function update(
      camera: T.Camera,
      _player: IronveilPoint,
      time = performance.now() / 1000,
    ) {
      sky.update(camera, time);
    }
    function drawMinimap(ctx: CanvasRenderingContext2D, size: number) {
      const p = (v: number) => ((v + 500) * size) / 1000;
      ctx.fillStyle = '#74766c';
      ctx.fillRect(0, 0, size, size / 2);
      ctx.fillStyle = '#87715a';
      ctx.fillRect(0, size / 2, size, size / 2);
      ctx.fillStyle = '#be9c62';
      ctx.fillRect(p(180), p(-50), (80 * size) / 1000, (50 * size) / 1000);
      ctx.strokeStyle = '#d5b577';
      ctx.lineWidth = 1.5;
      for (const path of IRONVEIL_PATHS) {
        ctx.beginPath();
        path.points.forEach((q, i) =>
          i ? ctx.lineTo(p(q.x), p(q.z)) : ctx.moveTo(p(q.x), p(q.z)),
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#352b24';
      ctx.fillRect(p(220) - 3, p(-50) - 3, 6, 5);
      ctx.fillStyle = '#fff1ba';
      ctx.font = '9px Arial';
      ctx.fillText('Mine', p(220) + 5, p(-50));
    }
    return {
      root,
      surfaces,
      bounds: IRONVEIL_BOUNDS,
      entry: IRONVEIL_ENTRY,
      navigation,
      groundHeight: ironveilGroundHeight,
      move: navigation.move.bind(navigation),
      constrainCamera,
      update,
      drawMinimap,
      dispose,
      setQuality(value: GraphicsQuality) {
        currentQuality = value;
        root.traverse((o) => {
          if (o instanceof T.Mesh)
            o.castShadow =
              (value === 'balanced' || value === 'high') &&
              o.userData.shadowEligible === true;
        });
      },
      get quality() {
        return currentQuality;
      },
      metrics: () => ({
        props: props.length,
        cypresses: props.filter((p) => p.kind === 'cypress').length,
        rocks: props.filter((p) => p.kind === 'rock').length,
        pines: 0,
        shrubs: 0,
        grass: 0,
        mineEntrances: 1,
        transitionAvailable: IRONVEIL_TRANSITION.available,
        geometries: geometries.size,
        textures: textures.size,
        textureBytes: [...textures].reduce(
          (n, t) =>
            n + ((t.image?.width ?? 0) * (t.image?.height ?? 0) * 4 * 4) / 3,
          0,
        ),
        terrainTriangles: 65536,
        mountainTriangles: root.children
          .filter((o) => o.name.startsWith('Mountain'))
          .reduce(
            (n, o) =>
              n +
              ((o as T.Mesh).geometry?.index?.count ??
                (o as T.Mesh).geometry?.attributes.position.count ??
                0) /
                3,
            0,
          ),
      }),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
