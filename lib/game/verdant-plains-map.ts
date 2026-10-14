import * as T from 'three';
import { PLAINS_BOUNDARY_GLSL, plainsBoundaryClearance, plainsBoundaryPoint } from './verdant-plains-boundary';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPlainsOaks } from './verdant-oak-renderer';
import { grassBatchInRange, partitionPlainsGrass } from './verdant-grass-tiles';
import { createPlainsSky } from './verdant-plains-sky';
import { plainsOceanGeometry, plainsOceanMaterial } from './verdant-plains-ocean';
import {
  plainsBoulderGeometry,
  plainsBoulderMaterial,
  plainsGrassGeometry,
  plainsGrassMaterial,
} from './verdant-plains-visuals';
import {
  PLAINS_BOUNDS,
  PLAINS_ENTRY,
  PLAINS_EXIT,
  PLAINS_STEP,
  PLAINS_PATHS,
  PlainsNavigation,
  plainsHeightfield,
  plainsTerrainHeight,
  plainsGroundHeight,
  plainsCoast,
  plainsRoadDistance,
  plainsProps,
  plainsSafe,
  type PlainsPoint,
} from './verdant-plains-layout';

import {
  PLAINS_QUALITY,
  PLAINS_GRASS_FIELD,
  plainsGrassTileCount,
  plainsGrassRange,
  loadPlainsQuality,
  type PlainsQuality,
} from './verdant-plains-quality';
const ROOT = '/assets/maps/verdant-plains-v2/';

export async function buildVerdantPlains(
  quality: PlainsQuality = loadPlainsQuality(),
) {
  const root = new T.Group();
  root.name = 'verdant-plains-v2';
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const ownGeometry = <G extends T.BufferGeometry>(g: G) => {
    geometries.add(g);
    return g;
  };
  const ownMaterial = <M extends T.Material>(m: M) => {
    materials.add(m);
    return m;
  };
  const ownTexture = (t: T.Texture) => {
    textures.add(t);
    return t;
  };
  let disposed = false;
  let oaks: Awaited<ReturnType<typeof createPlainsOaks>> | undefined;
  function dispose() {
    if (disposed) return;
    disposed = true;
    oaks?.dispose();
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
    const loader = new T.TextureLoader(),
      gltf = new GLTFLoader();
    // AllSettled ensures a partial failed load owns and releases every completed resource.
    const loaded = await Promise.allSettled(
      [
        'grass',
        'dirt',
        'sand',
        'rock',
        'wood',
        'water-normal',
        'water-ocean-normal',
        'water-color',
        'boulder-color',
        'boulder-height',
        'sky-clouds',
      ].map(async (name) => {
        const t = ownTexture(await loader.loadAsync(ROOT + name + '.webp'));
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.anisotropy = 4;
        t.colorSpace =
          name.endsWith('normal') ||
          name.endsWith('height') ||
          name === 'sky-clouds'
            ? T.NoColorSpace
            : T.SRGBColorSpace;
        return t;
      }),
    );
    const failed = loaded.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const [
      grass,
      dirt,
      sand,
      rock,
      wood,
      waterNormal,
      waterOcean,
      waterColor,
      boulderColor,
      boulderHeight,
      skyClouds,
    ] = loaded.map((r) => (r as PromiseFulfilledResult<T.Texture>).value);
    skyClouds.wrapS = skyClouds.wrapT = T.ClampToEdgeWrapping;
    const sky = createPlainsSky(skyClouds);
    ownGeometry(sky.mesh.geometry);
    ownMaterial(sky.mesh.material);
    root.add(sky.mesh);
    const models = new Map<string, T.Group>();
    const modelResults = await Promise.allSettled(
      ['shrub', 'banner'].map(async (name) => {
        const model = (await gltf.loadAsync(ROOT + name + '.glb')).scene;
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            ownGeometry(o.geometry);
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              ownMaterial(m);
              for (const v of Object.values(m))
                if (v instanceof T.Texture) ownTexture(v);
            }
          }
        });
        models.set(name, model);
        return model;
      }),
    );
    const modelFailure = modelResults.find((r) => r.status === 'rejected');
    if (modelFailure?.status === 'rejected') throw modelFailure.reason;
    sand.repeat.set(200, 200);
    const terrainWind = { value: 0 };
    const terrainMaterial = ownMaterial(
      new T.MeshStandardMaterial({ roughness: 0.96, color: '#eef0ce', bumpMap: sand, bumpScale: .16 }),
    );
    terrainMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uGrass: { value: grass },
        uDirt: { value: dirt },
        uSand: { value: sand },
        uRock: { value: rock },
        uMeadowTime: terrainWind,
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec3 surface; varying vec3 vSurface; varying vec2 vPlainsXZ;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSurface=surface; vPlainsXZ=position.xz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D uGrass,uDirt,uSand,uRock; uniform float uMeadowTime; varying vec3 vSurface; varying vec2 vPlainsXZ;\n' + PLAINS_BOUNDARY_GLSL,
        )
        .replace(
          '#include <map_fragment>',
          `
        // Clip the hidden heightfield at every LOD. Keep a small buried overlap
        // beneath the rock foot, without exposed meadow shelves behind it.
        if(max(abs(vPlainsXZ.x),abs(vPlainsXZ.y))>450.0 && plainsBoundaryClearance(vPlainsXZ)<-.5) discard;
        vec3 grassColor=texture2D(uGrass,vPlainsXZ/9.0).rgb*vec3(.95,1.4,.82);
        // Horizon LOD: wind/shading detail on the terrain continues beyond mesh grass.
        // Derivative filtering prevents subpixel blade patterns from shimmering.
        float meadowDistance=distance(cameraPosition.xz,vPlainsXZ);
        float detail=1.0-smoothstep(.08,.65,max(length(dFdx(vPlainsXZ)),length(dFdy(vPlainsXZ))));
        float streak=sin(vPlainsXZ.x*21.0+sin(vPlainsXZ.y*5.0)*2.0)*sin(vPlainsXZ.y*31.0);
        float meadowWave=sin(dot(vPlainsXZ,vec2(.16,.09))-uMeadowTime*1.75);
        // A filtered under-canopy meadow replaces bare-looking gaps beyond blade resolution.
        vec3 meadowBase=mix(grassColor,vec3(.32,.43,.12),.55);
        grassColor=mix(grassColor,meadowBase*(1.0+detail*streak*.12+meadowWave*.04),smoothstep(24.0,100.0,meadowDistance));
        vec3 groundColor=mix(grassColor,texture2D(uDirt,vPlainsXZ/7.0).rgb*vec3(1.8,1.65,1.3),clamp(vSurface.x,0.0,1.0));
        // Use the waterline sand finish across the entire beach.
        float sandGrain=dot(texture2D(uSand,vPlainsXZ/7.0).rgb,vec3(.299,.587,.114));
        float fineGrain=dot(texture2D(uSand,vPlainsXZ/1.3).rgb,vec3(.333));
        vec3 beachSand=vec3(1.20,1.025,1.06)*vec3(.69,.59,.50)*(.56+1.25*sandGrain+.18*fineGrain);
        groundColor=mix(groundColor,beachSand,clamp(vSurface.y,0.0,1.0));
        groundColor=mix(groundColor,texture2D(uRock,vPlainsXZ/13.0).rgb,clamp(vSurface.z,0.0,1.0));
        diffuseColor.rgb*=groundColor*(.94+.06*sin(vPlainsXZ.x*.039)*sin(vPlainsXZ.y*.034));
      `,
        )
        .replace('#include <normal_fragment_maps>', `
          #ifdef USE_BUMPMAP
            normal=perturbNormalArb(-vViewPosition,normal,dHdxy_fwd()*clamp(vSurface.y,0.0,1.0),faceDirection);
          #endif
        `)
        .replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          // Soft diffuse bounce from bright beach sand; keep terrain shadows intact.
          totalEmissiveRadiance+=beachSand*vec3(.85,.65,.56)*.72*clamp(vSurface.y,0.0,1.0);
        `)
        .replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,.38,clamp(vSurface.y,0.0,1.0));
        `);
    };
    terrainMaterial.customProgramCacheKey = () => 'verdant-terrain-unified-beach-v7';
    const heights = plainsHeightfield(),
      mask = new Float32Array(513 * 513 * 3),
      grassMask = new Uint8Array(513 * 513);
    for (let z = 0; z < 513; z++)
      for (let x = 0; x < 513; x++) {
        const p = { x: x * PLAINS_STEP - 500, z: z * PLAINS_STEP - 500 },
          i = (z * 513 + x) * 3,
          coast = plainsCoast(p.x) - p.z;
        const roadDistance = plainsRoadDistance(p);
        mask[i] = T.MathUtils.clamp(1 - roadDistance / 3, 0, 1);
        if (plainsSafe(p, 1)) mask[i] = 0.9;
        mask[i + 1] =
          (1 - T.MathUtils.smoothstep(coast, 12, 34)) *
          (1 - mask[i]);
        // All hills keep meadow turf, including beyond the grass draw distance.
        mask[i + 2] = 0;
        grassMask[z * 513 + x] =
          255 *
          Math.min(
            T.MathUtils.smoothstep(roadDistance, 1.5, 5),
            T.MathUtils.smoothstep(coast, 24, 34),
            plainsSafe(p, 5) ? 0 : 1,
            T.MathUtils.smoothstep(plainsBoundaryClearance(p.x, p.z), 0.2, 2),
          );
      }
    const chunks: Array<{ lod: T.LOD; x: number; z: number }> = [];
    function chunkGeometry(cx: number, cz: number, step: number) {
      const pos: number[] = [],
        uv: number[] = [],
        surface: number[] = [],
        indices: number[] = [],
        n = 32 / step;
      for (let z = 0; z <= n; z++)
        for (let x = 0; x <= n; x++) {
          const ix = cx * 32 + x * step,
            iz = cz * 32 + z * step,
            k = iz * 513 + ix;
          pos.push(ix * PLAINS_STEP - 500, heights[k], iz * PLAINS_STEP - 500);
          uv.push(ix / 512, iz / 512);
          surface.push(mask[k * 3], mask[k * 3 + 1], mask[k * 3 + 2]);
        }
      for (let z = 0; z < n; z++)
        for (let x = 0; x < n; x++) {
          const k = z * (n + 1) + x;
          indices.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
        }
      // Vertical skirts hide cracks between independently selected resolutions.
      const edges = [
        Array.from({ length: n + 1 }, (_, i) => i),
        Array.from({ length: n + 1 }, (_, i) => i * (n + 1) + n),
        Array.from({ length: n + 1 }, (_, i) => n * (n + 1) + n - i),
        Array.from({ length: n + 1 }, (_, i) => (n - i) * (n + 1)),
      ];
      for (const edge of edges)
        for (let j = 1; j < edge.length; j++) {
          const a = edge[j - 1],
            b = edge[j],
            k = pos.length / 3;
          for (const v of [a, b]) {
            pos.push(pos[v * 3], pos[v * 3 + 1] - 12, pos[v * 3 + 2]);
            uv.push(uv[v * 2], uv[v * 2 + 1]);
            surface.push(
              surface[v * 3],
              surface[v * 3 + 1],
              surface[v * 3 + 2],
            );
          }
          indices.push(a, k, b, b, k, k + 1);
        }
      const g = ownGeometry(new T.BufferGeometry());
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('surface', new T.Float32BufferAttribute(surface, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      const normal = g.getAttribute('normal'),
        v = new T.Vector3();
      for (let i = 0; i < (n + 1) ** 2; i++) {
        const x = pos[i * 3],
          z = pos[i * 3 + 2];
        v.set(
          plainsTerrainHeight(x - 1, z) - plainsTerrainHeight(x + 1, z),
          2,
          plainsTerrainHeight(x, z - 1) - plainsTerrainHeight(x, z + 1),
        ).normalize();
        normal.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeBoundingSphere();
      return g;
    }
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const lod = new T.LOD();
        lod.autoUpdate = false;
        for (const [step, distance] of [
          [1, 0],
          [2, 110],
          [4, 240],
          [8, 440],
        ]) {
          const m = new T.Mesh(chunkGeometry(x, z, step), terrainMaterial);
          m.receiveShadow = true;
          lod.addLevel(m, distance);
        }
        root.add(lod);
        chunks.push({
          lod,
          x: (x + 0.5) * 62.5 - 500,
          z: (z + 0.5) * 62.5 - 500,
        });
      }
    // A continuous rounded escarpment shares its inner contour with collision.
    // The buried first ring overlaps the terrain; the seaward end sinks below
    // the existing ocean, so there is no box wall or open corner seam.
    const boundaryMaterial = ownMaterial(
      plainsBoulderMaterial(boulderColor, boulderHeight),
    );
    // The boulder shader's local UV scale is for small instanced stones.
    // This mesh uses world metres: keep the same rock texture at cliff scale.
    const compileBoundaryStone = boundaryMaterial.onBeforeCompile.bind(boundaryMaterial);
    boundaryMaterial.onBeforeCompile = (shader, renderer) => {
      compileBoundaryStone(shader, renderer);
      shader.vertexShader = shader.vertexShader.replace(
        'vStonePosition=position*2.5;', 'vStonePosition=position/14.0;',
      );
    };
    boundaryMaterial.customProgramCacheKey = () => 'verdant-boundary-stone-v1';
    const boundarySegments = 512;
    const boundaryRings = [
      [1.5, -1], [0, 0], [-1.8, 7], [-5, 16], [-11, 22],
      [-22, 30], [-42, 39], [-80, 52], [-150, 64], [-260, 48],
    ];
    const boundaryPositions: number[] = [], boundaryColors: number[] = [],
      boundaryUvs: number[] = [], boundaryIndices: number[] = [];
    const boundaryTint = new T.Color();
    for (let row = 0; row < boundaryRings.length; row++) {
      const [clearance, rise] = boundaryRings[row];
      for (let i = 0; i <= boundarySegments; i++) {
        const angle = (i % boundarySegments) / boundarySegments * Math.PI * 2;
        const foot = plainsBoundaryPoint(angle);
        const crag = row < 2 ? 0 : Math.min(6, row * 0.6)
          * Math.sin(foot.x / 13 + foot.z / 17 + row * 0.8);
        const p = plainsBoundaryPoint(angle, clearance + crag);
        const coast = plainsCoast(p.x) - p.z;
        const coastBlend = T.MathUtils.smoothstep(coast, -18, 24);
        const relief = 0.9 + 0.17 * Math.sin(foot.x / 31 + foot.z / 43)
          + 0.09 * Math.sin(foot.x / 11 - foot.z / 17 + row * 0.55);
        const base = plainsTerrainHeight(foot.x, foot.z);
        const y = row === 0 ? plainsTerrainHeight(p.x, p.z) - 0.8
          : (base + rise * relief) * coastBlend - 12 * (1 - coastBlend);
        boundaryPositions.push(p.x, y, p.z);
        boundaryTint.set(row < 2 ? '#879365' : row < 5 ? '#c1beb0' : '#b5b6a9');
        boundaryTint.multiplyScalar(0.96 + 0.04 * Math.sin(foot.x / 13 + foot.z / 19));
        boundaryColors.push(boundaryTint.r, boundaryTint.g, boundaryTint.b);
        boundaryUvs.push(p.x / 4, (p.z + y) / 4);
        if (row && i) {
          const k = row * (boundarySegments + 1) + i;
          boundaryIndices.push(k - boundarySegments - 2, k, k - 1,
            k - boundarySegments - 2, k - boundarySegments - 1, k);
        }
      }
    }
    const boundaryGeometry = ownGeometry(new T.BufferGeometry());
    boundaryGeometry.setAttribute('position', new T.Float32BufferAttribute(boundaryPositions, 3));
    boundaryGeometry.setAttribute('color', new T.Float32BufferAttribute(boundaryColors, 3));
    boundaryGeometry.setAttribute('uv', new T.Float32BufferAttribute(boundaryUvs, 2));
    boundaryGeometry.setIndex(boundaryIndices);
    boundaryGeometry.computeVertexNormals();
    const boundaryNormals = boundaryGeometry.getAttribute('normal');
    for (let row = 0; row < boundaryRings.length; row++) {
      const a = row * (boundarySegments + 1), b = a + boundarySegments;
      const normal = new T.Vector3().fromBufferAttribute(boundaryNormals, a)
        .add(new T.Vector3().fromBufferAttribute(boundaryNormals, b)).normalize();
      boundaryNormals.setXYZ(a, normal.x, normal.y, normal.z);
      boundaryNormals.setXYZ(b, normal.x, normal.y, normal.z);
    }
    boundaryGeometry.computeBoundingSphere();
    const boundary = new T.Mesh(boundaryGeometry, boundaryMaterial);
    boundary.name = 'Verdant natural rock boundary';
    boundary.receiveShadow = true;
    root.add(boundary);
    const boundaryRay = new T.Raycaster();
    const boundaryCameraDirection = new T.Vector3();
    const boundaryCameraPosition = new T.Vector3();
    let boundaryCameraDistance = Infinity;
    function constrainCamera(focus: T.Vector3, desired: T.Vector3, dt: number) {
      boundaryCameraDirection.copy(desired).sub(focus);
      const distance = boundaryCameraDirection.length();
      if (distance < 0.001) return desired;
      boundaryCameraDirection.multiplyScalar(1 / distance);
      let allowed = distance;
      if (plainsBoundaryClearance(focus.x, focus.z) < distance + 4) {
        boundary.updateWorldMatrix(true, false);
        boundaryRay.set(focus, boundaryCameraDirection);
        boundaryRay.far = distance + 0.65;
        const hit = boundaryRay.intersectObject(boundary, false)[0];
        if (hit) allowed = Math.max(0.3, Math.min(distance, hit.distance - 0.65));
        // A low orbit can pass underneath the raised rock foot. Keep that
        // camera on the meadow side too, instead of letting it enter the ridge.
        if (plainsBoundaryClearance(desired.x, desired.z) < 0.3) {
          let low = 0, high = distance;
          for (let i = 0; i < 16; i++) {
            const d = (low + high) / 2;
            if (plainsBoundaryClearance(focus.x + boundaryCameraDirection.x * d,
              focus.z + boundaryCameraDirection.z * d) > 0.3) low = d;
            else high = d;
          }
          allowed = Math.min(allowed, Math.max(0.1, low - 0.35));
        }
      }
      boundaryCameraDistance = allowed < boundaryCameraDistance ? allowed
        : boundaryCameraDistance + (allowed - boundaryCameraDistance) * (1 - Math.exp(-8 * dt));
      boundaryCameraPosition.copy(focus).addScaledVector(boundaryCameraDirection, boundaryCameraDistance);
      boundaryCameraPosition.y = Math.max(boundaryCameraPosition.y,
        plainsGroundHeight(boundaryCameraPosition.x, boundaryCameraPosition.z) + 1.2);
      return boundaryCameraPosition;
    }
    const waterTime = { value: 0 };
    const depthTexture = ownTexture(
      new T.DataTexture(heights, 513, 513, T.RedFormat, T.FloatType),
    );
    depthTexture.minFilter = depthTexture.magFilter = T.LinearFilter;
    depthTexture.needsUpdate = true;
    const oakLoad = createPlainsOaks(depthTexture).then(
      (forest) => {
        if (disposed) {
          forest.dispose();
          return {
            error: new Error('Verdant Plains map was disposed during loading'),
          };
        }
        oaks = forest;
        return { forest };
      },
      (error: unknown) => ({ error }),
    );
    const oceanGeometries = new Map<PlainsQuality, T.BufferGeometry>();
    function oceanGeometry(value: PlainsQuality) {
      let geometry = oceanGeometries.get(value);
      if (!geometry) {
        geometry = ownGeometry(plainsOceanGeometry(value));
        oceanGeometries.set(value, geometry);
      }
      return geometry;
    }
    const water = new T.Mesh(oceanGeometry(quality), ownMaterial(plainsOceanMaterial(
      depthTexture, waterNormal, waterOcean, waterColor, skyClouds, waterTime,
    )));
    water.name = 'Verdant layered water';
    root.add(water);
    const woodMaterial = ownMaterial(
      new T.MeshStandardMaterial({
        map: wood,
        color: '#a58a61',
        roughness: 0.94,
      }),
    );
    const cloth = ownMaterial(
      new T.MeshStandardMaterial({
        color: '#dccfac',
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    const blue = ownMaterial(
      new T.MeshStandardMaterial({
        color: '#31576a',
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    const stone = ownMaterial(
      new T.MeshStandardMaterial({ map: rock, color: '#bdb6a0', roughness: 1 }),
    );
    function box(
      parent: T.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: T.Material,
    ) {
      const m = new T.Mesh(ownGeometry(new T.BoxGeometry(w, h, d)), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    const camp = new T.Group();
    camp.name = 'Arunika Rest';
    camp.position.set(
      PLAINS_ENTRY.x,
      plainsGroundHeight(PLAINS_ENTRY.x, PLAINS_ENTRY.z),
      PLAINS_ENTRY.z,
    );
    root.add(camp);
    for (const x of [-8, 8]) {
      const tent = new T.Group();
      tent.position.set(x, 0, -5);
      camp.add(tent);
      const g = ownGeometry(new T.BufferGeometry());
      g.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [
            -2, 0, -2, 0, 3, -2, -2, 0, 2, 0, 3, -2, 0, 3, 2, -2, 0, 2, 0, 3,
            -2, 2, 0, -2, 0, 3, 2, 2, 0, -2, 2, 0, 2, 0, 3, 2,
          ],
          3,
        ),
      );
      g.computeVertexNormals();
      const canvas = new T.Mesh(g, cloth);
      canvas.castShadow = true;
      tent.add(canvas);
      box(tent, 0.12, 3.2, 0.12, 0, 1.6, -2, woodMaterial);
      box(tent, 0.12, 3.2, 0.12, 0, 1.6, 2, woodMaterial);
      box(tent, 0.14, 0.14, 4.5, 0, 3, 0, woodMaterial);
    }
    const banner = models.get('banner')!;
    const bannerBounds = new T.Box3().setFromObject(banner),
      bannerSize = bannerBounds.getSize(new T.Vector3());
    const bannerCenter = bannerBounds.getCenter(new T.Vector3());
    banner.scale.setScalar(4.6 / bannerSize.y);
    banner.position.set(
      -10.2 - bannerCenter.x * banner.scale.x,
      2.2 - bannerBounds.min.y * banner.scale.y,
      -10 - bannerCenter.z * banner.scale.z,
    );
    box(camp, 0.2, 7, 0.2, -12, 3.5, -10, woodMaterial);
    box(camp, 2.5, 0.16, 0.16, -10.9, 6.9, -10, woodMaterial);
    camp.add(banner);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        m = new T.Mesh(ownGeometry(new T.DodecahedronGeometry(0.4, 0)), stone);
      m.position.set(Math.cos(a) * 1.5, 0.15, -7 + Math.sin(a) * 1.5);
      camp.add(m);
    }
    for (const angle of [0.4, 2.3]) {
      const log = box(camp, 2.1, 0.3, 0.32, 0, 0.22, -7, woodMaterial);
      log.rotation.y = angle;
    }
    const flameMaterial = ownMaterial(
      new T.MeshBasicMaterial({
        color: '#ed9e3f',
        transparent: true,
        opacity: 0.85,
      }),
    );
    const flame = new T.Mesh(
      ownGeometry(new T.ConeGeometry(0.55, 1.2, 6)),
      flameMaterial,
    );
    flame.position.set(0, 0.7, -7);
    camp.add(flame);
    const waypoint = new T.Mesh(
      ownGeometry(new T.OctahedronGeometry(0.22)),
      ownMaterial(new T.MeshBasicMaterial({ color: '#8fe3db' })),
    );
    waypoint.position.set(-12, 7.5, -10);
    camp.add(waypoint);
    const gate = new T.Group();
    gate.name = 'Averion travel';
    gate.position.set(
      PLAINS_EXIT.x,
      plainsGroundHeight(PLAINS_EXIT.x, PLAINS_EXIT.z),
      PLAINS_EXIT.z,
    );
    gate.userData.destination = 'averion';
    root.add(gate);
    for (const side of [-1, 1]) {
      box(gate, 0.32, 5, 0.32, side * 5, 2.5, 0, woodMaterial);
      const banner = new T.Mesh(
        ownGeometry(new T.PlaneGeometry(1.8, 2.5)),
        blue,
      );
      banner.position.set(side * 4.1, 3.4, 0);
      banner.userData.destination = 'averion';
      gate.add(banner);
    }
    const trigger = box(
      gate,
      10,
      5,
      1,
      0,
      2.5,
      0,
      ownMaterial(
        new T.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      ),
    );
    trigger.castShadow = trigger.receiveShadow = false;
    trigger.userData.destination = 'averion';
    const impostorResponse = await fetch(ROOT + 'impostors.json');
    if (!impostorResponse.ok) throw Error('Missing vegetation LOD metadata');
    const impostors: Record<string, { size: number; centerY: number }> =
      await impostorResponse.json();
    const matrix = new T.Matrix4(),
      rotation = new T.Quaternion(),
      scale = new T.Vector3(),
      position = new T.Vector3(),
      up = new T.Vector3(0, 1, 0);
    const props = plainsProps();
    // Solid, shared boulders replace the vertical rock photograph cards.
    const boulderMaterial = ownMaterial(
      plainsBoulderMaterial(boulderColor, boulderHeight),
    );
    for (let variant = 0; variant < 3; variant++) {
      const placements = props
        .filter((p) => p.kind === 'rock')
        .filter((_, i) => i % 3 === variant);
      const mesh = new T.InstancedMesh(
        ownGeometry(plainsBoulderGeometry(variant)),
        boulderMaterial,
        placements.length,
      );
      mesh.name = `Boulders ${variant}`;
      placements.forEach((p, i) => {
        rotation.setFromAxisAngle(up, p.yaw);
        matrix.compose(
          position.set(p.x, plainsTerrainHeight(p.x, p.z) - 0.08, p.z),
          rotation,
          scale.setScalar(p.scale),
        );
        mesh.setMatrixAt(i, matrix);
      });
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    const vegetation: Array<{
      meshes: T.InstancedMesh[];
      card: T.InstancedMesh;
      placements: ReturnType<typeof plainsProps>;
      triangles: number;
    }> = [];
    for (const kind of ['shrub'] as const) {
      const model = models.get(kind)!;
      model.updateMatrixWorld(true);
      const placements = props.filter((p) => p.kind === kind),
        meshes: T.InstancedMesh[] = [];
      let triangles = 0;
      model.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const geometry = ownGeometry(
          o.geometry.clone().applyMatrix4(o.matrixWorld),
        );
        triangles +=
          (geometry.index?.count ?? geometry.getAttribute('position').count) /
          3;
        const mesh = new T.InstancedMesh(
          geometry,
          o.material,
          placements.length,
        );
        mesh.name = `${kind}:near`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        meshes.push(mesh);
        root.add(mesh);
      });
      const texture = ownTexture(
        await loader.loadAsync(ROOT + kind + '-far.png'),
      );
      texture.colorSpace = T.SRGBColorSpace;
      const material = ownMaterial(
        new T.MeshBasicMaterial({
          map: texture,
          alphaTest: 0.32,
          side: T.DoubleSide,
          // New tree cards already include this map's lighting and tone mapping.
          toneMapped: kind === 'shrub',
        }),
      );
      // One camera-facing card, never two intersecting sheets or a duplicate near tree.
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec2 toCamera=cameraPosition.xz-instanceMatrix[3].xz;
          vec2 right=normalize(vec2(toCamera.y,-toCamera.x));
          transformed.xz=right*position.x;
        `,
        );
      };
      material.customProgramCacheKey = () => 'plains-tree-billboard-v2';
      const geometry = ownGeometry(
        new T.PlaneGeometry(impostors[kind].size, impostors[kind].size),
      );
      geometry.translate(0, impostors[kind].centerY, 0);
      const card = new T.InstancedMesh(geometry, material, placements.length);
      card.name = `${kind}:far`;
      card.instanceMatrix.setUsage(T.DynamicDrawUsage);
      // Bounds stay conservative even when individual card matrices are hidden by near LOD.
      card.frustumCulled = false;
      root.add(card);
      vegetation.push({ meshes, card, placements, triangles });
    }
    const oakResult = await oakLoad;
    if ('error' in oakResult) throw oakResult.error;
    root.add(oakResult.forest.root);
    const navigation = new PlainsNavigation();
    // The existing visible character is ~369k triangles. A map-owned caster
    // keeps its silhouette shadow inexpensive without changing that model.
    const characterShadow = new T.Group();
    characterShadow.name = 'Character shadow proxy';
    root.add(characterShadow);
    const shadowMaterial = ownMaterial(
      new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    for (const [radius, length, x, y] of [
      [0.31, 0.85, 0, 1.03],
      [0.18, 0.05, 0, 1.88],
      [0.13, 0.58, -0.43, 1.05],
      [0.13, 0.58, 0.43, 1.05],
    ]) {
      const caster = new T.Mesh(
        ownGeometry(new T.CapsuleGeometry(radius, length, 3, 6)),
        shadowMaterial,
      );
      caster.position.set(x, y, 0);
      caster.castShadow = true;
      caster.raycast = () => {};
      characterShadow.add(caster);
    }
    // Restore original close-up density everywhere. Tiles only cull off-screen work;
    // they never change blade count/detail with distance.
    const wind = { value: 0 },
      grassPlayer = { value: new T.Vector2() },
      grassTrail = { value: new T.Vector2() };
    let grassTrailTime = -1;
    const densityTexture = ownTexture(
      new T.DataTexture(grassMask, 513, 513, T.RedFormat),
    );
    densityTexture.minFilter = densityTexture.magFilter = T.LinearFilter;
    densityTexture.needsUpdate = true;
    const grassGeometries: T.InstancedBufferGeometry[] = [];
    const grassTiles: T.Mesh<T.InstancedBufferGeometry>[] = [];
    const grassBatches: Array<{
      mesh: T.Mesh<T.InstancedBufferGeometry>;
      counts: Record<PlainsQuality, number>;
      bounds: T.Box3;
      minX: number;
      minZ: number;
      maxX: number;
      maxZ: number;
    }> = [];
    const grassRoot = new T.Group();
    grassRoot.name = 'Grass dense field';
    root.add(grassRoot);
    const tileSize = PLAINS_GRASS_FIELD.tileSize;
    const sharedGrass = ownGeometry(plainsGrassGeometry());
    const officeGrass = ownGeometry(plainsGrassGeometry(true));
    const initialRange = plainsGrassRange(quality);
    const grassRange = {
      value: new T.Vector2(initialRange.outerStart, initialRange.outer),
    };
    const maxGrass = plainsGrassTileCount('high');
    const patches = new Float32Array(maxGrass * 4);
    let grassSeed = 721;
    const grassRandom = () => {
      grassSeed = (Math.imul(grassSeed, 1664525) + 1013904223) >>> 0;
      return grassSeed / 4294967296;
    };
    for (let i = 0; i < maxGrass; i++)
      patches.set(
        [
          (grassRandom() - 0.5) * tileSize,
          (grassRandom() - 0.5) * tileSize,
          grassRandom() * Math.PI * 2,
          grassRandom(),
        ],
        i * 4,
      );
    const partitions = partitionPlainsGrass(patches, tileSize).map(
      (partition) => ({
        ...partition,
        attribute: new T.InstancedBufferAttribute(partition.patches, 4),
      }),
    );
    const sharedPatchBytes = patches.byteLength;
    const grassMaterial = ownMaterial(
      plainsGrassMaterial(
        depthTexture,
        densityTexture,
        grassPlayer,
        wind,
        grassTrail,
        grassRange,
      ),
    );
    for (let tz = 0; tz < 16; tz++)
      for (let tx = 0; tx < 16; tx++)
        for (const partition of partitions) {
          const originX = -500 + (tx + 0.5) * tileSize;
          const originZ = -500 + (tz + 0.5) * tileSize;
          const gridX = tx * 32 + partition.x * 16;
          const gridZ = tz * 32 + partition.z * 16;
          let low = Infinity,
            high = -Infinity,
            maximumMask = 0;
          // The mask/heightfield is static. Skip wholly forbidden tiles, conservatively
          // include a one-texel border for filtering and bounds for wind/terrain height.
          for (
            let iz = Math.max(0, gridZ - 1);
            iz <= Math.min(512, gridZ + 16 + 1);
            iz++
          )
            for (
              let ix = Math.max(0, gridX - 1);
              ix <= Math.min(512, gridX + 16 + 1);
              ix++
            ) {
              const k = iz * 513 + ix;
              low = Math.min(low, heights[k]);
              high = Math.max(high, heights[k]);
              maximumMask = Math.max(maximumMask, grassMask[k]);
            }
          if (maximumMask <= 38) continue;
          const geometry = ownGeometry(new T.InstancedBufferGeometry());
          for (const [name, attribute] of Object.entries(
            (quality === 'office' ? officeGrass : sharedGrass).attributes,
          ))
            geometry.setAttribute(name, attribute);
          geometry.setAttribute('aGrassPatch', partition.attribute);
          geometry.instanceCount = partition.counts[quality];
          // Include simultaneous wind and contact displacement, including tall blades.
          geometry.boundingBox = new T.Box3(
            new T.Vector3(partition.minX - 3, low - 1, partition.minZ - 3),
            new T.Vector3(partition.maxX + 3, high + 4, partition.maxZ + 3),
          );
          geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(
            new T.Sphere(),
          );
          const mesh = new T.Mesh(geometry, grassMaterial);
          mesh.name = `Grass tile ${tx},${tz}:${partition.x},${partition.z}`;
          mesh.position.set(originX, 0, originZ);
          // We cull the padded box below, avoiding a second, looser sphere test.
          mesh.frustumCulled = false;
          grassBatches.push({
            mesh,
            counts: partition.counts,
            bounds: geometry.boundingBox.clone().translate(mesh.position),
            minX: originX + partition.minX,
            minZ: originZ + partition.minZ,
            maxX: originX + partition.maxX,
            maxZ: originZ + partition.maxZ,
          });
          grassGeometries.push(geometry);
          grassTiles.push(mesh);
          grassRoot.add(mesh);
        }
    const grassFrustum = new T.Frustum(),
      grassProjection = new T.Matrix4();
    let visibleGrassTiles = 0;
    let submittedGrassInstances = 0;
    function updateGrassVisibility(camera: T.Camera, player: PlainsPoint) {
      grassFrustum.setFromProjectionMatrix(
        grassProjection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      grassRoot.updateMatrixWorld(true);
      visibleGrassTiles = 0;
      submittedGrassInstances = 0;
      // Grass roots and terrain are fixed in world space for this map.
      for (const { mesh, bounds, minX, minZ, maxX, maxZ } of grassBatches) {
        const inRange = grassBatchInRange(
          player.x,
          player.z,
          grassRange.value.y,
          minX,
          minZ,
          maxX,
          maxZ,
        );
        mesh.visible = inRange && grassFrustum.intersectsBox(bounds);
        if (mesh.visible) {
          visibleGrassTiles++;
          submittedGrassInstances += mesh.geometry.instanceCount;
        }
      }
    }
    let lastLod = '',
      lastVegetation = '',
      currentQuality = quality;
    function updateVegetation(player: PlainsPoint) {
      const key = `${Math.floor(player.x / 4)},${Math.floor(player.z / 4)},${currentQuality}`;
      if (key === lastVegetation) return;
      lastVegetation = key;
      const candidates = vegetation.flatMap((group, g) =>
        group.placements.map((p, i) => ({
          g,
          i,
          d: (p.x - player.x) ** 2 + (p.z - player.z) ** 2,
        })),
      );
      candidates.sort((a, b) => a.d - b.d);
      let budget =
        currentQuality === 'high'
          ? 50000
          : currentQuality === 'light' || currentQuality === 'office'
            ? 12000
            : 30000;
      const selected = vegetation.map(() => new Set<number>());
      for (const c of candidates) {
        if (c.d > 48 ** 2) break;
        const cost = vegetation[c.g].triangles;
        if (cost <= budget) {
          selected[c.g].add(c.i);
          budget -= cost;
        }
      }
      vegetation.forEach((group, g) => {
        let count = 0;
        group.placements.forEach((p, i) => {
          position.set(p.x, plainsTerrainHeight(p.x, p.z), p.z);
          const near = selected[g].has(i);
          if (near) {
            rotation.setFromAxisAngle(up, p.yaw);
            matrix.compose(position, rotation, scale.setScalar(p.scale));
            group.meshes.forEach((mesh) => mesh.setMatrixAt(count, matrix));
            count++;
          }
          rotation.identity();
          matrix.compose(
            position,
            rotation,
            scale.setScalar(near ? 0 : p.scale),
          );
          group.card.setMatrixAt(i, matrix);
        });
        group.card.instanceMatrix.needsUpdate = true;
        group.meshes.forEach((mesh) => {
          mesh.count = count;
          mesh.visible = count > 0;
          mesh.castShadow = PLAINS_QUALITY[currentQuality].shadow > 0;
          mesh.instanceMatrix.needsUpdate = true;
        });
      });
    }
    function update(camera: T.Camera, player: PlainsPoint, time: number) {
      sky.update(camera, time);
      wind.value = time;
      terrainWind.value = time;
      waterTime.value = time;
      characterShadow.position.set(
        player.x,
        plainsGroundHeight(player.x, player.z),
        player.z,
      );
      flame.scale.set(
        1 + 0.08 * Math.sin(time * 7),
        0.85 + 0.15 * Math.sin(time * 11),
        1,
      );
      grassPlayer.value.set(player.x, player.z);
      if (
        grassTrailTime < 0 ||
        grassTrail.value.distanceToSquared(grassPlayer.value) > 144
      ) {
        grassTrail.value.copy(grassPlayer.value);
      } else {
        const dt = Math.max(0, Math.min(0.1, time - grassTrailTime));
        grassTrail.value.lerp(grassPlayer.value, 1 - Math.exp(-dt * 7));
      }
      grassTrailTime = time;
      updateGrassVisibility(camera, player);
      updateVegetation(player);
      oaks!.update(camera, player, time, currentQuality);
      const lodKey = `${Math.floor(player.x / 12)},${Math.floor(player.z / 12)},${Math.floor(camera.position.x / 25)},${Math.floor(camera.position.z / 25)}`;
      if (lastLod !== lodKey) {
        lastLod = lodKey;
        for (const c of chunks) {
          const d = Math.min(
            Math.hypot(c.x - player.x, c.z - player.z),
            Math.hypot(c.x - camera.position.x, c.z - camera.position.z),
          );
          const level = d < 110 ? 0 : d < 240 ? 1 : d < 440 ? 2 : 3;
          c.lod.levels.forEach((l, i) => {
            l.object.visible = i === level;
          });
        }
      }
    }
    function drawMinimap(ctx: CanvasRenderingContext2D, size: number) {
      const p = (n: number) => ((n + 500) / 1000) * size;
      ctx.fillStyle = '#759266';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#428f99';
      ctx.beginPath();
      ctx.moveTo(0, size);
      for (let x = -500; x <= 500; x += 10) ctx.lineTo(p(x), p(plainsCoast(x)));
      ctx.lineTo(size, size);
      ctx.fill();
      ctx.strokeStyle = '#858577';
      ctx.lineWidth = Math.max(1.5, size * 0.012);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let boundaryPenDown = false;
      for (let i = 0; i <= 256; i++) {
        const q = plainsBoundaryPoint(i / 256 * Math.PI * 2);
        if (q.z >= plainsCoast(q.x) - 2) { boundaryPenDown = false; continue; }
        if (boundaryPenDown) ctx.lineTo(p(q.x), p(q.z));
        else ctx.moveTo(p(q.x), p(q.z));
        boundaryPenDown = true;
      }
      ctx.stroke();
      ctx.strokeStyle = '#d4c59a';
      ctx.lineWidth = 1.4;
      for (const path of PLAINS_PATHS) {
        ctx.beginPath();
        path.points.forEach((q, i) =>
          i ? ctx.lineTo(p(q.x), p(q.z)) : ctx.moveTo(p(q.x), p(q.z)),
        );
        ctx.stroke();
      }
      for (const [point, color] of [
        [PLAINS_ENTRY, '#ffdf8b'],
        [PLAINS_EXIT, '#bddbed'],
      ] as const) {
        ctx.fillStyle = color;
        ctx.fillRect(p(point.x) - 2, p(point.z) - 2, 4, 4);
      }
      ctx.font = '9px Arial';
      ctx.fillStyle = '#fff0c4';
      ctx.fillText(
        'Arunika Rest',
        p(PLAINS_ENTRY.x) + 5,
        p(PLAINS_ENTRY.z) - 5,
      );
      ctx.fillText('Averion ↑', p(PLAINS_EXIT.x) - 20, p(PLAINS_EXIT.z) - 7);
    }
    return {
      root,
      bounds: PLAINS_BOUNDS,
      entry: PLAINS_ENTRY,
      navigation,
      groundHeight: plainsGroundHeight,
      constrainCamera,
      move: navigation.move.bind(navigation),
      safe: plainsSafe,
      update,
      drawMinimap,
      dispose,
      get quality() {
        return currentQuality;
      },
      setQuality(value: PlainsQuality) {
        currentQuality = value;
        water.geometry = oceanGeometry(value);
        const range = plainsGrassRange(value);
        grassRange.value.set(range.outerStart, range.outer);
        characterShadow.visible = PLAINS_QUALITY[value].shadow > 0;
        lastVegetation = '';
        submittedGrassInstances = 0;
        grassBatches.forEach(({ mesh, counts }) => {
          const g = mesh.geometry;
          g.instanceCount = counts[value];
          if (mesh.visible) submittedGrassInstances += g.instanceCount;
          for (const [name, attribute] of Object.entries(
            (value === 'office' ? officeGrass : sharedGrass).attributes,
          ))
            g.setAttribute(name, attribute);
        });
        lastLod = '';
      },
      metrics: () => ({
        chunks: chunks.length,
        props: plainsProps().length,
        grass: grassGeometries.reduce((n, g) => n + g.instanceCount, 0),
        grassField: {
          density: PLAINS_QUALITY[currentQuality].grassDensity,
          radius: grassRange.value.y,
          tiles: grassTiles.length,
          visibleTiles: visibleGrassTiles,
          submittedTriangles:
            submittedGrassInstances * (currentQuality === 'office' ? 4 : 6),
          sharedPatchBytes,
          lod: false,
        },
        textures: textures.size,
        textureBytes: [...textures].reduce(
          (sum, t) =>
            sum + ((t.image?.width ?? 0) * (t.image?.height ?? 0) * 4 * 4) / 3,
          0,
        ),
        geometries: geometries.size,
        oaks: oaks!.metrics(),
      }),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
