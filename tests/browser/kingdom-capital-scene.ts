import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js';
import {
  perimeter,
  roads,
  districts,
  height,
  baseHeight,
  inside,
  roadDistance,
  project,
  pathLength,
  type Point,
} from './kingdom-capital-layout';

export async function buildCapital(structureOnly: boolean) {
  const root = new T.Group(),
    loader = new GLTFLoader(),
    textureLoader = new T.TextureLoader();
  const chunks = new Map<string, T.Group>(),
    batches = new Map<
      string,
      {
        g: T.BufferGeometry;
        m: T.Material | T.Material[];
        matrices: T.Matrix4[];
        chunk: T.Group;
      }
    >();
  const sourceModels = new Map<string, T.Group>(),
    matCache = new Map<string, T.Material>();
  const assetUse: Record<string, number> = {},
    counts = {
      buildings: 0,
      wallSegments: 0,
      towers: 0,
      gates: 1,
      stairSystems: 6,
      trees: 0,
      props: 0,
      instancedObjects: 0,
    };
  const colliders: {
      x: number;
      z: number;
      hx: number;
      hz: number;
      y: number;
      top: number;
      angle: number;
      tag: string;
    }[] = [],
    cells = new Map<string, number[]>();
  const terrainChunks: T.Mesh[] = [];
  const sharedBox = new T.BoxGeometry(1, 1, 1),
    cylinder = new T.CylinderGeometry(1, 1, 1, 12),
    cone = new T.ConeGeometry(1, 1, 4);
  function chunk(x: number, z: number) {
    const key = `${Math.floor(x / 128)}:${Math.floor(z / 128)}`;
    if (!chunks.has(key)) {
      const g = new T.Group();
      g.name = 'city-cell:' + key;
      root.add(g);
      chunks.set(key, g);
    }
    return chunks.get(key)!;
  }
  const temp = new T.Object3D();
  function add(
    g: T.BufferGeometry,
    m: T.Material | T.Material[],
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    angle = 0,
  ) {
    temp.position.set(x, y, z);
    temp.rotation.set(0, angle, 0);
    temp.scale.set(sx, sy, sz);
    temp.updateMatrix();
    const group = chunk(x, z),
      key =
        group.uuid +
        g.uuid +
        (Array.isArray(m) ? m.map((x) => x.uuid).join() : m.uuid);
    if (!batches.has(key))
      batches.set(key, { g, m, matrices: [], chunk: group });
    batches.get(key)!.matrices.push(temp.matrix.clone());
  }
  async function tex(url: string) {
    const t = await textureLoader.loadAsync(url);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  const stoneTex = await tex(
    '/dev-assets/kingdom-city-pilot-a3/materials/stone_architecture/color.png',
  );
  const rockSource = (
    await loader.loadAsync(
      '/dev-assets/kingdom-city-pilot-a3/models/env_package_boulder_01_2k/model.glb',
    )
  ).scene;
  let cliffTex = stoneTex;
  rockSource.traverse((o) => {
    if (o instanceof T.Mesh) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m.map) cliffTex = m.map;
    }
  });
  cliffTex.wrapS = cliffTex.wrapT = T.RepeatWrapping;
  const stone = new T.MeshStandardMaterial({
    map: stoneTex,
    color: '#c8bb96',
    roughness: 1,
  });
  const darkStone = new T.MeshStandardMaterial({
    map: stoneTex,
    color: '#a79577',
    roughness: 1,
  });
  const roofMat = new T.MeshStandardMaterial({
    color: '#a54d28',
    roughness: 0.9,
  });
  const grainMat = new T.MeshStandardMaterial({
    color: '#9d9941',
    roughness: 1,
  });
  const windowMat = new T.MeshStandardMaterial({
    color: '#293b3c',
    roughness: 0.8,
  });
  // World-space sampling avoids stretching a single brick across a 58m keep.
  function worldTiling(m: T.MeshStandardMaterial, metres: number) {
    m.onBeforeCompile = (s) => {
      s.uniforms.cityTexture = { value: m.map };
      s.vertexShader =
        'varying vec3 cityP; varying vec3 cityN;\n' + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 cp=vec4(transformed,1.0); vec3 cn=objectNormal;
 #ifdef USE_INSTANCING
 cp=instanceMatrix*cp;cn=mat3(instanceMatrix)*cn;
 #endif
 cityP=(modelMatrix*cp).xyz;cityN=normalize(mat3(modelMatrix)*cn);
 #include <project_vertex>`,
      );
      s.fragmentShader =
        'uniform sampler2D cityTexture; varying vec3 cityP; varying vec3 cityN;\n' +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        '#include <map_fragment>',
        `vec3 weights=pow(abs(normalize(cityN)),vec3(8.0));weights/=max(.001,weights.x+weights.y+weights.z);vec3 tp=cityP/${metres.toFixed(2)};diffuseColor.rgb*=texture2D(cityTexture,tp.zy).rgb*weights.x+texture2D(cityTexture,tp.xz).rgb*weights.y+texture2D(cityTexture,tp.xy).rgb*weights.z;`,
      );
    };
    m.customProgramCacheKey = () => `capital-world-tiles-${metres}`;
  }
  worldTiling(stone, 3);
  worldTiling(darkStone, 3);
  const roadMat = new T.MeshStandardMaterial({
    map: stoneTex,
    color: '#b9a88b',
    roughness: 1,
    side: T.DoubleSide,
  });
  const dirtMat = new T.MeshStandardMaterial({
    color: '#947754',
    roughness: 1,
    side: T.DoubleSide,
  });
  const grass = await tex(
    '/dev-prototypes/kingdom-capital-v11/textures/Upresia_Ground01.png',
  );
  const groundTex = await tex(
    '/dev-prototypes/kingdom-capital-v11/textures/default.png',
  );
  for (const t of [grass, groundTex]) {
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
  }
  const terrainMat = new T.MeshStandardMaterial({
    map: grass,
    color: '#c6d9aa',
    roughness: 1,
    vertexColors: true,
  });
  const floorTexture = await tex(
    '/dev-prototypes/kingdom-capital-v11/textures/Obj_FLGR01.png',
  );
  floorTexture.repeat.set(16, 16);
  const groundMat = new T.MeshStandardMaterial({
    map: floorTexture,
    color: '#ded5ba',
    roughness: 1,
  });
  terrainMat.onBeforeCompile = (s) => {
    s.uniforms.cityCliff = { value: cliffTex };
    s.vertexShader = 'varying vec3 cityNormal;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\ncityNormal=normalize(mat3(modelMatrix)*objectNormal);',
    );
    s.fragmentShader =
      'uniform sampler2D cityCliff; varying vec3 cityNormal;\n' +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>\nfloat slope=1.0-abs(normalize(cityNormal).y); vec4 rock=texture2D(cityCliff,vMapUv*.17); diffuseColor.rgb=mix(diffuseColor.rgb,rock.rgb*.73,smoothstep(.18,.6,slope));`,
    );
  };
  // Authored 1600x1600 landscape, 100 chunks. No Flyff height/placement data read.
  for (let iz = 0; iz < 10; iz++)
    for (let ix = 0; ix < 10; ix++) {
      const g = new T.PlaneGeometry(160, 160, 40, 40);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position,
        colors = [];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + ix * 160 - 720,
          z = p.getZ(i) + iz * 160 - 720,
          y =
            height(x, z) -
            Math.max(0, 1 - Math.max(0, roadDistance(x, z)) / 7) * 2;
        p.setXYZ(i, x, y, z);
        g.attributes.uv.setXY(i, x / 8, z / 8);
        const c = new T.Color(inside(x, z) ? '#d5d9b4' : '#ecedcc');
        colors.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      g.computeVertexNormals();
      const mesh = new T.Mesh(g, terrainMat);
      mesh.receiveShadow = false;
      mesh.userData.reviewTerrain = true;
      root.add(mesh);
      terrainChunks.push(mesh);
    }
  function collider(
    x: number,
    z: number,
    hx: number,
    hz: number,
    y: number,
    top: number,
    angle: number,
    tag: string,
  ) {
    const i = colliders.length;
    colliders.push({ x, z, hx, hz, y, top, angle, tag });
    const r = Math.hypot(hx, hz) + 1;
    for (let a = Math.floor((x - r) / 32); a <= Math.floor((x + r) / 32); a++)
      for (
        let b = Math.floor((z - r) / 32);
        b <= Math.floor((z + r) / 32);
        b++
      ) {
        const k = a + ':' + b;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k)!.push(i);
      }
  }
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m = stone,
    angle = 0,
    solid = false,
    tag = 'structure',
  ) {
    add(sharedBox, m, x, y + h / 2, z, w, h, d, angle);
    if (solid) collider(x, z, w / 2, d / 2, y, y + h, angle, tag);
  }
  const pilot = (await fetch(
    '/dev-assets/kingdom-city-pilot-a3/manifest.json',
  ).then((r) => r.json())) as { assets: { id: string; url: string }[] };
  const kit = (await fetch(
    '/dev-assets/kingdom-city-kit-v1/metadata/kit-manifest.json',
  ).then((r) => r.json())) as {
    assets: { assetId: string; viewerUrl: string }[];
  };
  const names = [
    'wall_plaster_straight',
    'wall_plaster_door_round',
    'doorframe_round_brick',
    'roof_tower_roundtiles',
    'stairs_exterior_nofirststep',
    'barrel',
    'crate_wooden',
    'bench',
    'lantern_wall',
    'banner_1',
    'anvil',
    'workbench',
    'stall_empty',
    'stall_cart_empty',
    'prop_wagon',
    'prop_woodenfence_single',
  ];
  for (const name of names) {
    const id = 'env_model_' + name,
      a = pilot.assets.find((a) => a.id === id),
      b = kit.assets.find((a) => a.assetId === id);
    const url = a?.url ?? b?.viewerUrl;
    if (!url) throw Error('Missing approved asset ' + id);
    const model = (await loader.loadAsync(url)).scene;
    model.scale.setScalar(1.5);
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.material = (
          Array.isArray(o.material) ? o.material : [o.material]
        ).map((m) => {
          if (!matCache.has(m.name)) matCache.set(m.name, m);
          return matCache.get(m.name)!;
        });
        if (o.material.length === 1) o.material = o.material[0];
      }
    });
    sourceModels.set(name, model);
  }
  function model(
    name: string,
    x: number,
    y: number,
    z: number,
    angle = 0,
    ground = false,
  ) {
    const source = sourceModels.get(name)!;
    assetUse[name] = (assetUse[name] ?? 0) + 1;
    let offset = 0;
    if (ground) offset = -new T.Box3().setFromObject(source).min.y;
    const parent = new T.Matrix4().compose(
      new T.Vector3(x, y + offset, z),
      new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), angle),
      new T.Vector3(1, 1, 1),
    );
    source.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const matrix = parent.clone().multiply(o.matrixWorld),
        group = chunk(x, z),
        key =
          group.uuid +
          o.geometry.uuid +
          (Array.isArray(o.material)
            ? o.material.map((x) => x.uuid).join()
            : o.material.uuid);
      if (!batches.has(key))
        batches.set(key, {
          g: o.geometry,
          m: o.material,
          matrices: [],
          chunk: group,
        });
      batches.get(key)!.matrices.push(matrix);
    });
  }
  function ribbon(r: (typeof roads)[number]) {
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1],
        b = r.points[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = -(b[1] - a[1]) / len,
        nz = (b[0] - a[0]) / len;
      const vertices = [],
        uv = [],
        idx = [];
      const steps = Math.ceil(len / 3);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps,
          x = T.MathUtils.lerp(a[0], b[0], t),
          z = T.MathUtils.lerp(a[1], b[1], t),
          y = T.MathUtils.lerp(a[2], b[2], t) + 0.12;
        for (const s of [-1, 1]) {
          vertices.push(
            x + ((nx * r.width) / 2) * s,
            y,
            z + ((nz * r.width) / 2) * s,
          );
          uv.push(((s + 1) * r.width) / 8, (t * len) / 4);
        }
        if (k < steps) {
          const n = k * 2;
          idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new T.Mesh(g, r.kind === 'outer' ? dirtMat : roadMat);
      root.add(m);
      if (r.stairs) {
        const rise = b[2] - a[2],
          n = Math.ceil(Math.abs(rise) / 0.24),
          stepRun = len / n,
          angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
        // Traversal uses the continuous stair ramp; visible 24cm risers sit on that same surface.
        // Box long axis is local Z: its rotation is +angle, not the former mirrored -angle.
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n,
            x = a[0] + (b[0] - a[0]) * t,
            z = a[1] + (b[1] - a[1]) * t,
            y = height(x, z),
            bottom = Math.min(baseHeight(x, z) - 2, y - 3);
          box(
            x,
            bottom,
            z,
            r.width,
            y + 0.13 - bottom,
            stepRun + 0.03,
            stone,
            angle,
          );
        }
        // Approved modular stair flights frame each side; main player lane remains unobstructed.
        const flights = Math.ceil(Math.abs(rise) / 1.5);
        for (let k = 0; k < flights; k++) {
          const t = k / flights,
            x = a[0] + (b[0] - a[0]) * t,
            z = a[1] + (b[1] - a[1]) * t;
          for (const side of [-1, 1])
            model(
              'stairs_exterior_nofirststep',
              x + nx * (r.width / 2 - 1.5) * side,
              height(x, z),
              z + nz * (r.width / 2 - 1.5) * side,
              angle + Math.PI,
            );
        }
        for (const side of [-1, 1])
          for (let k = 0; k < flights; k++) {
            const t = (k + 0.5) / flights,
              x = a[0] + (b[0] - a[0]) * t + nx * (r.width / 2 + 1) * side,
              z = a[1] + (b[1] - a[1]) * t + nz * (r.width / 2 + 1) * side,
              y = a[2] + rise * t;
            box(
              x,
              Math.min(baseHeight(x, z) - 2, y - 2),
              z,
              1.6,
              y + 1.5 - Math.min(baseHeight(x, z) - 2, y - 2),
              len / flights + 0.05,
              stone,
              angle,
            );
          }
      }
    }
  }
  roads.forEach(ribbon);
  // Solid retaining foundations under road spans crossing a terrace edge.
  for (const r of roads.filter((r) => !r.stairs))
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1],
        b = r.points[i],
        len = pathLength([a, b]),
        n = Math.ceil(len / 3),
        angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t,
          y = a[2] + (b[2] - a[2]) * t,
          base = Math.min(baseHeight(x, z) - 2, y - 3);
        if (!(x > 395 && x < 515 && Math.abs(z - 270) < 8))
          box(x, base, z, r.width, y - base, len / n + 0.1, darkStone, angle);
      }
    }
  // Civic square and high court define positive spaces, not leftover grass.
  box(0, 37.7, 20, 86, 0.45, 76, groundMat);
  box(35, 127.7, -282, 110, 0.45, 64, groundMat);
  add(cylinder, stone, 0, 39.2, 20, 9, 2, 9);
  add(cylinder, stone, 0, 42.5, 20, 2, 6, 2);
  add(cone, stone, 0, 47, 20, 3, 4, 3);
  collider(0, 20, 9, 9, 38, 49, 0, 'plaza-monument');
  function tower(x: number, z: number, y: number, h = 22) {
    counts.towers++;
    box(x, y, z, 9, h, 9, stone, 0, true, 'tower');
    for (const side of [-1, 1])
      for (let f = 0; f < 3; f++)
        model(
          'wall_plaster_straight',
          x + side * 4.55,
          y + f * 4.5,
          z,
          Math.PI / 2,
        );
    model('roof_tower_roundtiles', x, y + h, z);
  }
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      angle = -Math.atan2(b[1] - a[1], b[0] - a[0]),
      n = Math.ceil(len / 6);
    if (i !== 0) tower(a[0], a[1], height(a[0], a[1]), 22);
    if (len > 140)
      tower(
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        height((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
      );
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (Math.abs(x) < 15 && z > 300) continue;
      const y = height(x, z);
      counts.wallSegments++;
      box(x, y - 3, z, len / n + 0.3, 17, 4, stone, angle, true, 'outer-wall');
      for (const off of [-1.5, 1.5]) {
        const xx = x + Math.cos(angle) * off,
          zz = z - Math.sin(angle) * off;
        model('wall_plaster_straight', xx, y + 5, zz, angle);
        box(xx, y + 14, zz, 1.1, 1.6, 4.6, stone, angle);
      }
    }
  }
  // Replace the perimeter origin tower with an open gatehouse rather than a blocked gate.
  for (let i = colliders.length - 1; i >= 0; i--)
    if (
      colliders[i].tag === 'tower' &&
      Math.hypot(colliders[i].x, colliders[i].z - 335) < 1
    )
      colliders[i].top = colliders[i].y;
  tower(-18, 335, 10, 31);
  tower(18, 335, 10, 31);
  box(0, 29, 335, 30, 8, 12, stone);
  box(0, 37, 335, 30, 1.6, 13, darkStone);
  // Gate tower at center would occlude the entrance visually; omit its render batch transforms.
  for (const b of batches.values())
    b.matrices = b.matrices.filter((m) => {
      const p = new T.Vector3().setFromMatrixPosition(m);
      return !(
        Math.abs(p.x) < 5 &&
        Math.abs(p.z - 335) < 5 &&
        p.y > 10 &&
        p.y < 40 &&
        b.g !== sharedBox
      );
    });
  for (const side of [-1, 1]) {
    model('banner_1', side * 12, 23, 342, 0, true);
  }
  // Newly authored castle massing: no village house is used as hero castle.
  box(35, 128, -324, 58, 54, 45, stone, 0, true, 'castle-keep');
  box(35, 182, -324, 62, 3, 49, darkStone);
  for (const dx of [-34, 34])
    for (const dz of [-25, 25])
      tower(35 + dx, -324 + dz, 128, dx < 0 ? 50 : 59);
  box(35, 185, -326, 26, 25, 22, stone, 0, true, 'royal-crown');
  add(cone, roofMat, 35, 216, -326, 21, 22, 16, Math.PI / 4);
  for (let x = 10; x < 63; x += 9) box(x, 185, -299, 3, 3, 3, stone);
  // Facade massing communicates a royal entrance while the dedicated hero asset is pending.
  box(35, 128, -301.3, 12, 18, 0.5, windowMat);
  box(35, 146, -300.8, 16, 3, 1.5, stone);
  for (const x of [12, 23, 47, 58]) {
    box(x, 151, -301.3, 2.4, 9, 0.5, windowMat);
    box(x, 172, -301.3, 2.4, 7, 0.5, windowMat);
  }
  const royalBanner = new T.MeshStandardMaterial({
    color: '#244b42',
    roughness: 1,
  });
  for (const x of [4, 66]) box(x, 148, -302, 4, 19, 0.5, royalBanner);
  // River beside the eastern flank, approached by a bridge in the outskirts.
  const waterMat = new T.MeshStandardMaterial({
    color: '#3d8790',
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
    side: T.DoubleSide,
  });
  const riverVertices: number[] = [],
    riverIndices: number[] = [];
  for (let i = 0; i <= 180; i++) {
    const z = -720 + i * 8,
      x = 410 + 45 * Math.sin(z * 0.006);
    riverVertices.push(x - 15, -3.7, z, x + 15, -3.7, z);
    if (i < 180) {
      const n = i * 2;
      riverIndices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const riverGeometry = new T.BufferGeometry();
  riverGeometry.setAttribute(
    'position',
    new T.Float32BufferAttribute(riverVertices, 3),
  );
  riverGeometry.setIndex(riverIndices);
  riverGeometry.computeVertexNormals();
  root.add(new T.Mesh(riverGeometry, waterMat));
  box(455, 8, 270, 100, 2, 12, stone); // environment bridge, no progression link
  for (const z of [263, 277])
    box(455, 10, z, 100, 1.6, 1, stone, 0, true, 'bridge-parapet');
  const bridge = { minX: 405, maxX: 505, minZ: 264, maxZ: 276, y: 10 };
  const walkHeight = (x: number, z: number) =>
    x >= bridge.minX && x <= bridge.maxX && z >= bridge.minZ && z <= bridge.maxZ
      ? bridge.y
      : height(x, z);
  function nearSolid(x: number, z: number) {
    const y = walkHeight(x, z);
    for (const i of cells.get(Math.floor(x / 32) + ':' + Math.floor(z / 32)) ??
      []) {
      const c = colliders[i];
      if (y + 2.4 <= c.y || y >= c.top - 0.05) continue;
      const dx = x - c.x,
        dz = z - c.z,
        co = Math.cos(c.angle),
        si = Math.sin(c.angle),
        lx = dx * co - dz * si,
        lz = dx * si + dz * co;
      if (
        Math.hypot(
          Math.max(0, Math.abs(lx) - c.hx),
          Math.max(0, Math.abs(lz) - c.hz),
        ) < 0.45
      )
        return true;
    }
    return false;
  }
  function move(from: { x: number; z: number }, dx: number, dz: number) {
    let p = { ...from };
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
    for (let i = 0; i < n; i++) {
      for (const [mx, mz] of [
        [dx / n, dz / n],
        [dx / n, 0],
        [0, dz / n],
      ]) {
        const x = p.x + mx,
          z = p.z + mz;
        if (Math.abs(x) > 792 || Math.abs(z) > 792 || nearSolid(x, z)) continue;
        const dh = Math.abs(walkHeight(x, z) - walkHeight(p.x, p.z));
        if (dh > Math.hypot(mx, mz) * 1.1 + 0.15) continue;
        p = { x, z };
        break;
      }
    }
    return p;
  }
  const roofCache = new Map<string, T.BufferGeometry>();
  roofMat.map = await tex(
    '/dev-assets/kingdom-city-pilot-a3/materials/roof_tile/color.png',
  );
  roofMat.color.set('#c8a586');
  worldTiling(roofMat, 3);
  roofMat.needsUpdate = true;
  const buildingRecords: {
    x: number;
    z: number;
    y: number;
    width: number;
    depth: number;
    storeys: number;
  }[] = [];
  function house(
    x: number,
    z: number,
    w: number,
    d: number,
    storeys: number,
    variant: number,
  ) {
    const y = height(x, z),
      angle = 0;
    counts.buildings++;
    buildingRecords.push({ x, z, y, width: w, depth: d, storeys });
    const foot = Math.min(
      y - 2,
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map(
          (sz) => height(x + sx * (w / 2 + 2), z + sz * (d / 2 + 2)) - 1,
        ),
      ),
    );
    box(x, foot, z, w + 2, y - foot, d + 2, darkStone, angle);
    box(x, y - 0.08, z, w + 2, 0.09, d + 2, groundMat);
    collider(x, z, w / 2, d / 2, foot, y + storeys * 4.5, angle, 'building');
    for (let f = 0; f < storeys; f++) {
      for (let sx = -w / 2 + 1.5; sx < w / 2; sx += 3) {
        for (const sign of [-1, 1]) {
          model(
            sx < 0 && sx > -3 && sign === 1 && f === 0
              ? 'wall_plaster_door_round'
              : 'wall_plaster_straight',
            x + sx,
            y + f * 4.5,
            z + (sign * d) / 2,
            sign === 1 ? 0 : Math.PI,
          );
          if (f > 0 || sx > 0)
            box(
              x + sx,
              y + f * 4.5 + 1.8,
              z + sign * (d / 2 + 0.16),
              0.9,
              1.5,
              0.14,
              windowMat,
            );
        }
      }
      for (let sz = -d / 2 + 1.5; sz < d / 2; sz += 3)
        for (const sign of [-1, 1])
          model(
            'wall_plaster_straight',
            x + (sign * w) / 2,
            y + f * 4.5,
            z + sz,
            (sign * Math.PI) / 2,
          );
    }
    // Original gable massing on larger footprints; approved cap on selected compact buildings.
    if (w === 6 && d === 6)
      model('roof_tower_roundtiles', x, y + storeys * 4.5, z);
    else {
      const key = w + ':' + d;
      if (!roofCache.has(key)) {
        const verts = [
          -w / 2 - 1,
          0,
          -d / 2 - 1,
          w / 2 + 1,
          0,
          -d / 2 - 1,
          0,
          5,
          -d / 2 - 1,
          -w / 2 - 1,
          0,
          d / 2 + 1,
          w / 2 + 1,
          0,
          d / 2 + 1,
          0,
          5,
          d / 2 + 1,
        ];
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
        g.setAttribute(
          'uv',
          new T.Float32BufferAttribute([0, 0, 2, 0, 1, 0, 0, 2, 2, 2, 1, 2], 2),
        );
        g.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]);
        g.computeVertexNormals();
        roofCache.set(key, g);
      }
      add(roofCache.get(key)!, roofMat, x, y + storeys * 4.5, z);
    }
  }
  async function populate() {
    if (counts.buildings) return;
    for (let row = 0; row < 35; row++)
      for (let col = 0; col < 34; col++) {
        const x =
            -300 + col * 18 + (row % 2) * 7 + Math.sin(row * 1.7 + col) * 2.5,
          z = -338 + row * 19 + Math.cos(col) * 3;
        if (
          !inside(x, z) ||
          roadDistance(x, z) < 9.5 ||
          Math.hypot(x / 1.1, z - 20) < 58 ||
          Math.hypot((x - 35) * 1.1, z + 310) < 86
        )
          continue;
        if (
          (x > 16 && x < 99 && z > 155 && z < 230) ||
          (x > 172 && x < 229 && z > 218 && z < 274)
        )
          continue;
        if (z > 40 && Math.abs(x - ((335 - z) * 35) / 650) < 13) continue; // reserved gate-to-crown sightline
        if (
          Math.abs(height(x + 6, z) - height(x - 6, z)) > 3 ||
          Math.abs(height(x, z + 6) - height(x, z - 6)) > 3
        )
          continue;
        let closeWall = false;
        for (let i = 0; i < perimeter.length; i++) {
          const a = perimeter[i],
            b = perimeter[(i + 1) % perimeter.length];
          if (project(x, z, [a[0], a[1], 0], [b[0], b[1], 0]).d < 22)
            closeWall = true;
        }
        if (closeWall) continue;
        house(
          x,
          z,
          (col + row) % 4 === 0 ? 9 : 12,
          (col + row) % 3 === 0 ? 9 : 12,
          1 + ((col + row) % 3),
          col + row,
        );
      }
    // Service paths inside blocks; independent alley class, not a new perfect-grid arterial system.
    for (let z = -153; z < 270; z += 57) {
      const pts: Point[] = [];
      for (let x = -255; x < 260; x += 4)
        if (
          inside(x, z) &&
          roadDistance(x, z) > 10 &&
          !buildingRecords.some(
            (b) =>
              Math.abs(b.x - x) < b.width / 2 + 2.5 &&
              Math.abs(b.z - z) < b.depth / 2 + 2.5,
          )
        )
          pts.push([x, z, height(x, z)]);
      for (let i = 1; i < pts.length; i++)
        if (pts[i][0] - pts[i - 1][0] < 5) {
          const r = {
            name: 'Service alley',
            width: 3.5,
            points: [pts[i - 1], pts[i]],
            kind: 'alley' as const,
          };
          ribbon(r);
        }
    }
    // Dense market pockets, working craft yards, and distributed street furniture.
    function pavedYard(x: number, z: number, w: number, d: number) {
      const geometry = new T.PlaneGeometry(w, d, 20, 20);
      geometry.rotateX(-Math.PI / 2);
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = x + p.getX(i),
          pz = z + p.getZ(i);
        p.setXYZ(i, px, height(px, pz) + 0.08, pz);
        geometry.attributes.uv.setXY(i, px / 5, pz / 5);
      }
      geometry.computeVertexNormals();
      root.add(new T.Mesh(geometry, roadMat));
    }
    pavedYard(57, 192, 76, 70);
    pavedYard(200, 245, 54, 50);
    // A distinct forge canopy/chimney is spatial massing only, never a shop or Smith system.
    box(215, 10, 245, 5, 21, 5, darkStone, 0, true, 'forge-chimney');
    box(215, 31, 245, 6, 1, 6, stone);
    for (let i = 0; i < 26; i++) {
      const x = 25 + (i % 7) * 10,
        z = 165 + Math.floor(i / 7) * 17;
      if (roadDistance(x, z) < 4) continue;
      model(
        i % 3 ? 'stall_empty' : 'stall_cart_empty',
        x,
        height(x, z),
        z,
        Math.PI / 2,
        true,
      );
      counts.props++;
    }
    for (let i = 0; i < 18; i++) {
      const x = 185 + (i % 4) * 12,
        z = 225 + Math.floor(i / 4) * 10;
      model(
        i % 3 === 0 ? 'anvil' : i % 3 === 1 ? 'workbench' : 'prop_wagon',
        x,
        height(x, z),
        z,
        0,
        true,
      );
      counts.props++;
    }
    for (const r of roads.filter((r) => r.kind !== 'outer'))
      for (let j = 1; j < r.points.length; j++) {
        const a = r.points[j - 1],
          b = r.points[j],
          len = pathLength([a, b]),
          nx = -(b[1] - a[1]) / len,
          nz = (b[0] - a[0]) / len;
        for (let k = 10; k < len; k += 22) {
          const t = k / len;
          for (const side of [-1, 1]) {
            const x = a[0] + (b[0] - a[0]) * t + nx * (r.width / 2 + 2) * side,
              z = a[1] + (b[1] - a[1]) * t + nz * (r.width / 2 + 2) * side;
            const name = k % 44 < 22 ? 'barrel' : 'crate_wooden';
            model(name, x, height(x, z), z, 0, true);
            counts.props++;
            if (k % 44 < 22) {
              box(x, height(x, z), z, 0.25, 5, 0.25, darkStone);
              model('lantern_wall', x, height(x, z) + 3, z);
              counts.props++;
            }
          }
        }
      }
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI * 2) / 18,
        x = Math.cos(a) * 44,
        z = 20 + Math.sin(a) * 39;
      model(i % 2 ? 'bench' : 'banner_1', x, 38, z, -a, true);
      counts.props++;
    }
    // Outskirt farms: authored plots, fences and cottages (no gameplay crops/NPCs).
    for (let i = 0; i < 8; i++) {
      const x = -330 + (i % 4) * 65,
        z = 420 + Math.floor(i / 4) * 70,
        y = height(x, z);
      box(x, y - 0.15, z, 48, 0.3, 46, dirtMat);
      for (let a = -22; a < 23; a += 4)
        box(x + a, y + 0.15, z, 0.8, 0.5, 42, grainMat);
      house(x - 25, z + 28, 6, 6, 1, i);
      for (let f = -20; f < 25; f += 8) {
        model('prop_woodenfence_single', x + f, height(x + f, z + 24), z + 24);
        counts.props++;
      }
    }
    // Bake actual A3 tree into a transparent crossed impostor for repeated vegetation.
    const tg = (
      await loader.loadAsync(
        '/dev-assets/kingdom-city-pilot-a3/models/env_package_tree_small_02_2k/lod1.glb',
      )
    ).scene;
    const bakeScene = new T.Scene();
    bakeScene.add(tg, new T.HemisphereLight(0xffffff, 0x6d704c, 2));
    const sun = new T.DirectionalLight(0xfff1cf, 2);
    sun.position.set(4, 8, 5);
    bakeScene.add(sun);
    const bb = new T.Box3().setFromObject(tg),
      center = bb.getCenter(new T.Vector3());
    const cam = new T.OrthographicCamera(-3, 3, 2.7, -2.7, 0.1, 40);
    cam.position.set(center.x, 2.3, 12);
    cam.lookAt(center.x, 2.3, 0);
    const renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(512, 512);
    renderer.setClearColor(0, 0);
    renderer.render(bakeScene, cam);
    const image = new Image();
    image.src = renderer.domElement.toDataURL();
    await image.decode();
    root.userData.treeImpostor = image.src;
    const treeTex = new T.Texture(image);
    treeTex.colorSpace = T.SRGBColorSpace;
    treeTex.needsUpdate = true;
    renderer.dispose();
    const treeMat = new T.MeshBasicMaterial({
      map: treeTex,
      alphaTest: 0.15,
      side: T.DoubleSide,
    });
    const treeG = new T.PlaneGeometry(6, 5.4);
    treeG.translate(0, 2.3, 0);
    for (let i = 0; i < 1300; i++) {
      const x = Math.sin(i * 7.31) * 730,
        z = Math.cos(i * 3.17) * 735;
      if (
        roadDistance(x, z) < 7 ||
        Math.abs(x - (410 + 45 * Math.sin(z * 0.006))) < 27
      )
        continue;
      if (inside(x, z) && i % 5 !== 0) continue;
      if (nearSolid(x, z) || Math.hypot(x - 35, z + 310) < 75) continue;
      const y = height(x, z),
        scale = 2.1 + (i % 5) * 0.3;
      add(treeG, treeMat, x, y, z, scale, scale, scale, i);
      add(treeG, treeMat, x, y, z, scale, scale, scale, i + Math.PI / 2);
      collider(x, z, 0.5, 0.5, y, y + 5, 0, 'tree');
      counts.trees++;
    }
    const rock = rockSource;
    sourceModels.set('rock', rock);
    rock.updateMatrixWorld(true);
    for (let i = 0; i < 24; i++) {
      const x = -470 + Math.sin(i * 4) * 170,
        z = -370 + i * 28;
      model('rock', x, height(x, z), z, i, true);
      counts.props++;
    }
    flush();
  }
  function flush() {
    for (const group of chunks.values()) {
      for (const child of [...group.children]) {
        if (child instanceof T.InstancedMesh) child.dispose();
        group.remove(child);
      }
    }
    counts.instancedObjects = 0;
    for (const b of batches.values()) {
      if (!b.matrices.length) continue;
      const mesh = new T.InstancedMesh(b.g, b.m, b.matrices.length);
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.reviewBatch = true;
      b.chunk.add(mesh);
      counts.instancedObjects += b.matrices.length;
    }
  }
  flush();
  if (!structureOnly) await populate();
  function reviewObjects() {
    const items: {
      center: [number, number, number];
      size: [number, number, number];
      rotation: number;
      assetId: string;
      assetName: string;
      family: string;
      chunk: string;
      zone: string;
      sourcePack: string;
    }[] = [];
    const zoneFor = (x: number, z: number) =>
      z > 270 ? 'MAIN_GATE' :
      x > 120 && z > 150 ? 'CRAFT_DISTRICT' :
      z > 120 ? 'RESIDENTIAL_SOUTH' :
      Math.hypot(x, z - 20) < 62 ? 'CENTRAL_PLAZA' :
      z < -235 ? 'CASTLE_HILL' :
      z < -80 && x > 0 ? 'UPPER_CITY' :
      z < -80 ? 'UPPER_RESIDENTIAL' : 'MARKET';
    for (const b of buildingRecords)
      items.push({
        center: [b.x, b.y + b.storeys * 2.25, b.z],
        size: [b.width + 2, b.storeys * 4.5 + 2, b.depth + 2],
        rotation: 0,
        assetId: 'env_model_house_modular',
        assetName: 'Modular House Massing',
        family: 'BUILDING / HOUSE',
        chunk: `city-cell:${Math.floor(b.x / 128)}:${Math.floor(b.z / 128)}`,
        zone: zoneFor(b.x, b.z),
        sourcePack: 'kingdom-city-kit-v1 / authored massing',
      });
    for (const c of colliders) {
      const family = c.tag === 'tree' ? 'NATURE / TREE' :
        c.tag === 'tower' ? 'ARCHITECTURE / TOWER' :
        c.tag === 'outer-wall' ? 'ARCHITECTURE / WALL' :
        c.tag === 'building' ? 'BUILDING' : 'PROPS / STRUCTURE';
      if (c.tag === 'building') continue;
      items.push({
        center: [c.x, (c.y + c.top) / 2, c.z],
        size: [c.hx * 2, Math.max(1, c.top - c.y), c.hz * 2],
        rotation: c.angle,
        assetId: `runtime-${c.tag}`,
        assetName: c.tag,
        family,
        chunk: `city-cell:${Math.floor(c.x / 128)}:${Math.floor(c.z / 128)}`,
        zone: zoneFor(c.x, c.z),
        sourcePack: 'lumenfall-kingdom-capital-v11 runtime',
      });
    }
    return items;
  }
  function visibility(camera: T.Camera, overview: boolean) {
    const frustum = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    for (const group of chunks.values()) {
      const [cx, cz] = group.name.split(':').slice(1).map(Number);
      const center = new T.Vector3(
        cx * 128 + 64,
        height(cx * 128 + 64, cz * 128 + 64) + 40,
        cz * 128 + 64,
      );
      const royalLandmark = cz <= -2 && cx >= -1 && cx <= 1;
      group.visible =
        frustum.intersectsSphere(new T.Sphere(center, 150)) &&
        (overview || royalLandmark || center.distanceTo(camera.position) < 620);
    }
  }
  return {
    root,
    counts,
    assetUse,
    colliders,
    buildingRecords,
    groundHeight: walkHeight,
    move,
    populate,
    visibility,
    terrainChunks,
    reviewObjects,
    metrics() {
      const mats = new Set<string>();
      root.traverse((o) => {
        if (o instanceof T.Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            mats.add(m.uuid);
      });
      const segments = new Map<string, number>();
      for (const r of roads)
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1],
            b = r.points[i];
          segments.set(
            [a.slice(0, 2).join(','), b.slice(0, 2).join(',')].sort().join('/'),
            pathLength([a, b]),
          );
        }
      return {
        ...counts,
        mapDimensions: [1600, 1600],
        cityBounds: [680, 710],
        districts: districts.length,
        roadLength: [...segments.values()].reduce((a, b) => a + b, 0),
        uniqueMaterials: mats.size,
        chunks: chunks.size,
      };
    },
    dispose() {
      const gs = new Set<T.BufferGeometry>(),
        ms = new Set<T.Material>();
      root.traverse((o) => {
        if (o instanceof T.Mesh) {
          gs.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            ms.add(m);
          if (o instanceof T.InstancedMesh) o.dispose();
        }
      });
      gs.forEach((g) => g.dispose());
      ms.forEach((m) => {
        for (const t of Object.values(m))
          if (t instanceof T.Texture) t.dispose();
        m.dispose();
      });
      root.removeFromParent();
    },
  };
}
