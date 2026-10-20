import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  METEORFALL_PLATFORMS,
  METEORFALL_DECKS,
  METEORFALL_ENTRY,
  METEORFALL_EXIT,
  METEORFALL_BOUNDS,
  METEORFALL_MAGMA,
  METEORFALL_OBSTACLES,
  METEORFALL_WALLS,
  meteorDesignHeight,
  meteorGroundHeight,
  meteorTopPatches,
  meteorBridgePoint,
  meteorStrip,
  meteorSafe,
  type MeteorPoint,
  type MeteorPlatform,
} from './meteorfall-citadel-layout';
import { MeteorfallNavigation } from './meteorfall-citadel-navigation';
import { createMeteorfallMaterials } from './meteorfall-citadel-materials';
import { createMeteorfallSky } from './meteorfall-citadel-sky';
import { METEORFALL_QUALITY } from './meteorfall-citadel-quality';
import {
  createMagmaFootprints,
  MAGMA_FOOTPRINT_LIMIT,
} from './meteorfall-citadel-footprints';
import { meteorCliffAccents } from './meteorfall-citadel-cliff-accents';
import { createMeteorfallEmbers } from './meteorfall-citadel-embers';
import type { GraphicsQuality } from './graphics-quality';

function geometry(positions: number[], uvs?: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute(
    'uv',
    new T.Float32BufferAttribute(
      uvs ??
        positions.flatMap((_, i) =>
          i % 3 === 0 ? [positions[i] / 12, positions[i + 2] / 12] : [],
        ),
      2,
    ),
  );
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
/** Stable planar UVs per rock face; XZ-only UVs collapse on vertical cliffs. */
function projectStoneUV(source: T.BufferGeometry, tileSize = 12) {
  const g = source.index ? source.toNonIndexed() : source;
  if (g !== source) source.dispose();
  const p = g.getAttribute('position'),
    uv = new Float32Array(p.count * 2);
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    normal = new T.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    normal.crossVectors(b.sub(a), c.sub(a));
    const x = Math.abs(normal.x),
      y = Math.abs(normal.y),
      z = Math.abs(normal.z);
    for (let j = i; j < i + 3; j++) {
      uv[j * 2] = (x > y && x > z ? p.getZ(j) : p.getX(j)) / tileSize;
      uv[j * 2 + 1] = (y >= x && y >= z ? p.getZ(j) : p.getY(j)) / tileSize;
    }
  }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}
function topGeometry(p: MeteorPlatform) {
  const basalt: number[] = [],
    road: number[] = [];
  for (let x = p.x - p.width / 2; x < p.x + p.width / 2; x += 4)
    for (let z = p.z - p.depth / 2; z < p.z + p.depth / 2; z += 4) {
      for (const { polygon: poly, road: isRoad } of meteorTopPatches(p, x, z))
        for (let i = 1; i + 1 < poly.length; i++)
          for (const v of [poly[0], poly[i + 1], poly[i]])
            (isRoad ? road : basalt).push(
              v.x,
              meteorDesignHeight(v) ?? p.y,
              v.z,
            );
    }
  return { basalt: geometry(basalt), road: geometry(road) };
}
function cliffGeometry(p: MeteorPlatform) {
  const rim: MeteorPoint[] = [];
  p.polygon.forEach((a, i) => {
    const b = p.polygon[(i + 1) % 8],
      n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 12);
    for (let k = 0; k < n; k++)
      rim.push({
        x: a.x + ((b.x - a.x) * k) / n,
        z: a.z + ((b.z - a.z) * k) / n,
      });
  });
  const pos: number[] = [],
    count = rim.length,
    profile = [
      [1, 0],
      [1.025, -12],
      [0.83, -48],
      [0.46, -105],
      [0.03, -148],
    ];
  const vertex = (i: number, l: number) => {
    const v = rim[i % count],
      [s, h] = profile[l],
      j = l === 0 ? 0 : Math.sin(i * 13.7 + l * 4.1) * 5;
    return [
      p.x + (v.x - p.x) * s,
      l === 0 ? (meteorDesignHeight(v) ?? p.y) : p.y + h + j,
      p.z + (v.z - p.z) * s,
    ];
  };
  for (let l = 0; l < profile.length - 1; l++)
    for (let i = 0; i < count; i++) {
      const a = vertex(i, l),
        b = vertex(i + 1, l),
        c = vertex(i + 1, l + 1),
        d = vertex(i, l + 1);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  for (let i = 0; i < count; i++)
    pos.push(...vertex(i, 4), ...vertex(i + 1, 4), p.x, p.y - 155, p.z);
  return projectStoneUV(geometry(pos));
}
function stripGeometry(
  poly: MeteorPoint[],
  height: (p: MeteorPoint) => number,
) {
  const pos: number[] = [];
  for (let i = 1; i + 1 < poly.length; i++)
    for (const p of [poly[0], poly[i + 1], poly[i]])
      pos.push(p.x, height(p), p.z);
  return geometry(pos);
}
function disposeTree(root: T.Object3D) {
  const gs = new Set<T.BufferGeometry>(),
    ms = new Set<T.Material>(),
    ts = new Set<T.Texture>();
  root.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points) {
      if (o instanceof T.InstancedMesh) o.dispose();
      gs.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        ms.add(m);
        for (const v of Object.values(m)) if (v instanceof T.Texture) ts.add(v);
      }
    }
  });
  gs.forEach((g) => g.dispose());
  ms.forEach((m) => m.dispose());
  ts.forEach((t) => t.dispose());
  root.removeFromParent();
  root.clear();
}

export async function buildMeteorfallCitadel(initialQuality: GraphicsQuality) {
  const root = new T.Group();
  root.name = 'Meteorfall Citadel';
  const surfaces = new T.Group();
  surfaces.name = 'Meteorfall walkable top surfaces';
  root.add(surfaces);
  const loaded: T.Object3D[] = [];
  const pending = await Promise.allSettled([
    createMeteorfallMaterials(),
    ...[
      '/assets/maps/meteorfall-citadel/meteor-monolith.glb',
      '/assets/maps/ironveil-mines-exterior-v1/rock.glb',
      '/assets/maps/ironveil-mines-exterior-v1/rock-face.glb',
    ].map(async (url) => {
      const g = await new GLTFLoader().loadAsync(url);
      loaded.push(g.scene);
      return g.scene;
    }),
  ]);
  const failure = pending.find((r) => r.status === 'rejected');
  if (failure?.status === 'rejected') {
    loaded.forEach(disposeTree);
    if (pending[0].status === 'fulfilled')
      (
        pending[0].value as Awaited<
          ReturnType<typeof createMeteorfallMaterials>
        >
      ).dispose();
    throw failure.reason;
  }
  // Completion order is not request order; keep the meteor distinct from reused rocks.
  loaded.splice(
    0,
    loaded.length,
    ...pending
      .slice(1)
      .map((r) => (r as PromiseFulfilledResult<T.Object3D>).value),
  );
  const mat = (
    pending[0] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof createMeteorfallMaterials>>
    >
  ).value;
  let disposed = false,
    quality = initialQuality,
    time = 0;
  const navigation = new MeteorfallNavigation(),
    details: T.Object3D[] = [],
    cameraBlockers: T.Object3D[] = [];
  const add = (
    g: T.BufferGeometry,
    m: T.Material,
    parent: T.Object3D = root,
    name = '',
  ) => {
    const mesh = new T.Mesh(g, m);
    mesh.name = name;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = new T.BoxGeometry(1, 1, 1),
    dummy = new T.Object3D();
  const batch = (
    g: T.BufferGeometry,
    m: T.Material,
    transforms: {
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      yaw?: number;
    }[],
    parent: T.Object3D,
    name: string,
  ) => {
    const mesh = new T.InstancedMesh(g, m, transforms.length);
    mesh.name = name;
    transforms.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.rotation.set(0, p.yaw ?? 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  try {
    const rocks = loaded.slice(1).map((scene) => {
      scene.updateMatrixWorld(true);
      let geo: T.BufferGeometry | undefined;
      scene.traverse((o) => {
        if (!geo && o instanceof T.Mesh)
          geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      });
      if (!geo) throw new Error('Meteorfall reuse rock has no mesh');
      geo.computeBoundingBox();
      const b = geo.boundingBox!,
        s = b.getSize(new T.Vector3()),
        c = b.getCenter(new T.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      geo.scale(1 / s.x, 1 / s.y, 1 / s.z);
      return projectStoneUV(geo, 1);
    });
    for (const p of METEORFALL_PLATFORMS) {
      const top = topGeometry(p);
      add(top.basalt, mat.basalt, surfaces, p.name + ' top');
      add(top.road, mat.road, surfaces, p.name + ' roads');
      const shell = add(
        cliffGeometry(p),
        mat.basalt,
        root,
        p.name + ' tapered cliff',
      );
      shell.castShadow = false;
      const accents: T.Object3D[] = [];
      for (let type = 0; type < 2; type++) {
        const transforms = meteorCliffAccents(p, type);
        accents.push(
          batch(
            rocks[type],
            mat.basalt,
            transforms,
            root,
            p.name + ' cliff accents',
          ),
        );
      }
      accents.forEach((o) => {
        o.userData.center = p;
        details.push(o);
      });
    }
    for (const b of METEORFALL_DECKS) {
      // Landing interiors are cut out. A 0.001-unit seam guard covers float32
      // endpoint rounding, without the old 20-unit coplanar landing overlap.
      const start = meteorBridgePoint(b, -0.001 / b.length),
        end = meteorBridgePoint(b, 1 + 0.001 / b.length);
      const deck = add(
        stripGeometry(
          meteorStrip(start, end, b.deckWidth),
          (v) =>
            b.yA +
            ((b.yB - b.yA) *
              ((v.x - b.a.x) * b.axis.x + (v.z - b.a.z) * b.axis.z)) /
              b.length,
        ),
        mat.road,
        surfaces,
        b.id + ' ramp',
      );
      deck.userData.bridge = true;
      const rail: Parameters<typeof batch>[2] = [],
        supports: Parameters<typeof batch>[2] = [],
        yaw = Math.atan2(b.axis.x, b.axis.z),
        sections = Math.ceil(b.length / 8);
      const channels: T.BufferGeometry[] = [];
      for (const side of [-1, 1]) {
        const a = meteorBridgePoint(b, 0, side * (b.clearWidth / 2 + 1)),
          c = meteorBridgePoint(b, 1, side * (b.clearWidth / 2 + 1));
        channels.push(
          stripGeometry(
            meteorStrip(a, c, 1.8),
            (v) => meteorDesignHeight(v)! + 0.08,
          ),
        );
        for (let i = 0; i < sections; i++) {
          const p = meteorBridgePoint(
              b,
              (i + 0.5) / sections,
              side * (b.deckWidth / 2 - 0.55),
            ),
            h = b.yA + ((b.yB - b.yA) * (i + 0.5)) / sections;
          rail.push({
            x: p.x,
            y: h + 0.7,
            z: p.z,
            sx: 1,
            sy: 1.4,
            sz: b.length / sections - 0.3,
            yaw,
          });
          if (i % 3 === 0)
            supports.push({
              x: p.x,
              y: h - 3,
              z: p.z,
              sx: 2,
              sy: 10,
              sz: 2,
              yaw,
            });
        }
      }
      batch(
        box,
        mat.masonry,
        [...rail, ...supports],
        root,
        b.id + ' parapets and supports',
      );
      add(
        mergeGeometries(channels)!,
        mat.magma,
        root,
        b.id + ' magma channels',
      );
      channels.forEach((g) => g.dispose());
    }
    // Open crown: twelve reusable pylons, perimeter walls, and a clear south gate.
    const pylons = METEORFALL_OBSTACLES.map((p) => ({
      x: p.x,
      z: p.z,
      y: 40 + p.height / 2,
      sx: 5.2,
      sy: p.height,
      sz: 5.2,
    }));
    const towers = batch(box, mat.masonry, pylons, root, 'Twelve crown pylons');
    towers.castShadow = true;
    cameraBlockers.push(towers);
    cameraBlockers.push(
      batch(
        box,
        mat.trim,
        pylons.map((p) => ({
          ...p,
          y: p.y + p.sy / 2 - 1,
          sx: 7,
          sy: 1,
          sz: 7,
        })),
        root,
        'Pylon cornices',
      ),
    );
    const spires = batch(
      new T.ConeGeometry(1, 1, 4),
      mat.basalt,
      pylons.map((p) => ({ ...p, y: p.y + p.sy / 2 + 4, sx: 5, sy: 8, sz: 5 })),
      root,
      'Crown silhouettes',
    );
    cameraBlockers.push(spires);
    const walls = METEORFALL_WALLS.map((w) => ({
      x: (w.a.x + w.b.x) / 2,
      z: (w.a.z + w.b.z) / 2,
      y: 44.5,
      sx: 3.6,
      sy: 9,
      sz: Math.hypot(w.a.x - w.b.x, w.a.z - w.b.z),
      yaw: Math.atan2(w.b.x - w.a.x, w.b.z - w.a.z),
    }));
    const wall = batch(box, mat.masonry, walls, root, 'Open fortress ring');
    cameraBlockers.push(wall);
    cameraBlockers.push(
      batch(
        box,
        mat.trim,
        walls.map((w) => ({ ...w, y: 49.2, sy: 0.65, sx: 4 })),
        root,
        'Fortress coping',
      ),
    );
    const crenels = walls.flatMap((w) =>
      Array.from({ length: 6 }, (_, i) => {
        const t = (i - 2.5) / 6;
        return {
          ...w,
          x: w.x + Math.sin(w.yaw) * w.sz * t,
          z: w.z + Math.cos(w.yaw) * w.sz * t,
          y: 50.5,
          sy: 2,
          sz: 3.2,
        };
      }),
    );
    cameraBlockers.push(
      batch(box, mat.masonry, crenels, root, 'Fortress battlements'),
    );
    for (const id of ['S', 'C', 'N', 'NW']) {
      const p = METEORFALL_PLATFORMS.find((p) => p.id === id)!,
        r = id === 'N' ? 55 : id === 'C' ? 42 : 30;
      const disk = add(new T.CircleGeometry(r, 64), mat.paving);
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(p.x, p.y + 0.12, p.z);
      for (const radius of [r, r * 0.91]) {
        const ring = add(
          new T.RingGeometry(radius - 0.4, radius + 0.4, 64),
          mat.floorTrim,
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, p.y + 0.15, p.z);
      }
      const pos: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        pos.push(
          p.x,
          p.y + 0.17,
          p.z,
          p.x + Math.sin(a - 0.13) * r * 0.18,
          p.y + 0.17,
          p.z + Math.cos(a - 0.13) * r * 0.18,
          p.x + Math.sin(a) * r * (i % 2 ? 0.58 : 0.8),
          p.y + 0.17,
          p.z + Math.cos(a) * r * (i % 2 ? 0.58 : 0.8),
        );
        pos.push(
          p.x,
          p.y + 0.17,
          p.z,
          p.x + Math.sin(a) * r * (i % 2 ? 0.58 : 0.8),
          p.y + 0.17,
          p.z + Math.cos(a) * r * (i % 2 ? 0.58 : 0.8),
          p.x + Math.sin(a + 0.13) * r * 0.18,
          p.y + 0.17,
          p.z + Math.cos(a + 0.13) * r * 0.18,
        );
      }
      add(geometry(pos), mat.floorTrim);
    }
    const meteor = loaded[0];
    meteor.name = 'Tripo meteor monolith';
    const bound = new T.Box3().setFromObject(meteor),
      size = bound.getSize(new T.Vector3()),
      center = bound.getCenter(new T.Vector3());
    meteor.position.sub(center);
    const holder = new T.Group();
    holder.add(meteor);
    holder.scale.setScalar(62 / size.y);
    holder.position.set(0, 143, -350);
    root.add(holder);
    root.updateMatrixWorld(true);
    // Bake only the runtime copy so the shared fissure shader uses world-scale rock coordinates.
    meteor.traverse((o) => {
      if (o instanceof T.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
        const g = projectStoneUV(
          o.geometry.clone().applyMatrix4(o.matrixWorld),
        );
        o.geometry.dispose();
        const mesh = add(g, mat.basalt, root, 'Meteor monolith facets');
        mesh.castShadow = false;
      }
    });
    holder.removeFromParent();
    const beam = add(
      new T.CylinderGeometry(0.8, 1.2, 200, 8),
      mat.glow,
      root,
      'Meteor beam',
    );
    beam.position.set(0, 145, -350);
    beam.raycast = () => {};
    for (const pool of METEORFALL_MAGMA) {
      const y = meteorDesignHeight(pool)!;
      const disk = add(
        new T.CircleGeometry(pool.radius, 40),
        mat.magma,
        root,
        pool.id + ' exposed magma',
      );
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(pool.x, y + 0.1, pool.z);
      const p = METEORFALL_PLATFORMS.find((p) => p.id === pool.id)!,
        edge = { x: p.x + (p.x < 0 ? -p.width / 2 : p.width / 2), z: pool.z };
      add(
        stripGeometry(meteorStrip(pool, edge, 4), () => y + 0.09),
        mat.magma,
        root,
        pool.id + ' outfall channel',
      );
      const fall = add(
        new T.PlaneGeometry(4, 105, 1, 8),
        mat.magma,
        root,
        pool.id + ' lava outfall',
      );
      fall.position.set(edge.x, y - 52, edge.z);
      fall.rotation.y = p.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      fall.material.side = T.DoubleSide;
    }
    const portal = add(
      new T.TorusGeometry(2, 0.15, 8, 40),
      mat.glow,
      root,
      'Return to Jayantara',
    );
    portal.position.set(METEORFALL_EXIT.x, 2.3, METEORFALL_EXIT.z);
    portal.userData.destination = METEORFALL_EXIT.destination;
    const sky = createMeteorfallSky(mat.sky);
    root.add(sky.mesh);
    const footprints = createMagmaFootprints();
    root.add(footprints.mesh);
    const seed = (i: number) => {
      const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const embers = createMeteorfallEmbers(METEORFALL_QUALITY[quality].embers);
    root.add(embers.mesh);
    const smokeMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv;varying float vDistance;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vDistance=length(p.xyz);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `varying vec2 vUv;varying float vDistance;uniform float uTime;void main(){float d=length((vUv-.5)*2.);float a=(1.-smoothstep(.25,1.,d))*.09*(1.-smoothstep(80.,160.,vDistance));float n=.7+.3*sin(vUv.x*18.+uTime*.2)*sin(vUv.y*15.-uTime*.3);gl_FragColor=vec4(.14,.08,.09,a*n);}`,
    });
    const smoke = Array.from({ length: 28 }, (_, i) => {
      const pool = METEORFALL_MAGMA[i % 4],
        mesh = add(
          new T.PlaneGeometry(18, 24),
          smokeMat,
          root,
          'Local volcanic smoke',
        );
      mesh.position.set(
        pool.x + (seed(i) - 0.5) * 15,
        (meteorDesignHeight(pool) ?? 0) + 12 + Math.floor(i / 4) * 6,
        pool.z,
      );
      mesh.raycast = () => {};
      return mesh;
    });
    root.updateMatrixWorld(true);
    const ray = new T.Raycaster(),
      direction = new T.Vector3(),
      cameraResult = new T.Vector3();
    const setQuality = (next: GraphicsQuality) => {
      quality = next;
      embers.setCount(METEORFALL_QUALITY[next].embers);
    };
    setQuality(quality);
    // Source scenes for reused rocks are no longer needed; cloned geometry is map-owned.
    loaded.slice(1).forEach(disposeTree);
    return {
      root,
      surfaces,
      bounds: METEORFALL_BOUNDS,
      entry: METEORFALL_ENTRY,
      navigation,
      safe: meteorSafe,
      groundHeight: (x: number, z: number) => meteorGroundHeight({ x, z }),
      move: (from: MeteorPoint, dx: number, dz: number, radius = 0.45) =>
        navigation.move(from, dx, dz, radius),
      setQuality,
      constrainCamera(focus: T.Vector3, camera: T.Vector3) {
        direction.copy(camera).sub(focus);
        const length = direction.length();
        ray.set(focus, direction.normalize());
        ray.far = length + 0.5;
        const hit = ray.intersectObjects(cameraBlockers, true)[0];
        cameraResult.copy(camera);
        if (hit)
          cameraResult
            .copy(focus)
            .addScaledVector(direction, Math.max(0.8, hit.distance - 0.6));
        const h = meteorDesignHeight(cameraResult);
        if (h !== undefined) cameraResult.y = Math.max(cameraResult.y, h + 1.2);
        return cameraResult;
      },
      update(camera: T.Camera, hero: MeteorPoint, dt: number, walking = false) {
        time += dt;
        const q = METEORFALL_QUALITY[quality];
        mat.update(time);
        footprints.update(hero, time, dt, walking);
        sky.update(camera, time, q.cloudLayers);
        for (const object of details) {
          const p = object.userData.center;
          object.visible =
            Math.hypot(camera.position.x - p.x, camera.position.z - p.z) <
            q.detailDistance + 150;
        }
        embers.update(camera, dt);
        smokeMat.uniforms.uTime.value = time;
        smoke.forEach((s, i) => {
          s.visible =
            i < q.smoke && s.position.distanceTo(camera.position) < 160;
          s.quaternion.copy(camera.quaternion);
        });
      },
      drawMinimap(ctx: CanvasRenderingContext2D, size: number) {
        const scale = size / 1000;
        ctx.save();
        ctx.fillStyle = '#200d17';
        ctx.fillRect(0, 0, size, size);
        ctx.translate(size / 2, size / 2);
        ctx.scale(scale, scale);
        for (const b of METEORFALL_DECKS) {
          ctx.strokeStyle = '#e87436';
          ctx.lineWidth = b.deckWidth;
          ctx.beginPath();
          ctx.moveTo(b.a.x, b.a.z);
          ctx.lineTo(b.b.x, b.b.z);
          ctx.stroke();
          ctx.strokeStyle = '#65545b';
          ctx.lineWidth = b.clearWidth;
          ctx.stroke();
        }
        for (const p of METEORFALL_PLATFORMS) {
          ctx.fillStyle = p.id === 'S' ? '#716754' : '#59545f';
          ctx.strokeStyle = '#bd592d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          p.polygon.forEach((v, i) =>
            i ? ctx.lineTo(v.x, v.z) : ctx.moveTo(v.x, v.z),
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        for (const p of METEORFALL_MAGMA) {
          ctx.fillStyle = '#ff721d';
          ctx.beginPath();
          ctx.arc(p.x, p.z, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#d9aa59';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -350, 55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
      metrics() {
        let triangles = 0,
          drawCalls = 0;
        root.traverse((o) => {
          if (o instanceof T.Mesh && o.visible) {
            triangles +=
              ((o.geometry.index?.count ??
                o.geometry.attributes.position.count) /
                3) *
              (o instanceof T.InstancedMesh ? o.count : 1);
            drawCalls++;
          }
        });
        return {
          layoutVersion: 1,
          platforms: 11,
          bridges: 14,
          causeways: 1,
          triangles,
          drawCalls,
          quality,
          embers: METEORFALL_QUALITY[quality].embers,
          emberSpace: 'world',
          smokeCap: METEORFALL_QUALITY[quality].smoke,
          skyDrawCalls: 1,
          additionalPointLights: 0,
          footprints: footprints.count(time),
          footprintLimit: MAGMA_FOOTPRINT_LIMIT,
          textureMemoryMiB:
            (6 * 1024 * 1024 * 4 * 4) / 3 / 1024 / 1024 +
            (2048 * 2048 * 4 * 4) / 3 / 1024 / 1024,
          blenderCleanup: false,
        };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        disposeTree(root);
        mat.dispose();
        navigation.clearCache();
      },
    };
  } catch (error) {
    disposeTree(root);
    loaded.forEach(disposeTree);
    mat.dispose();
    throw error;
  }
}
