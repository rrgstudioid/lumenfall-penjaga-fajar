import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ImportedMapGround } from './imported-map';
import {
  Stage03Collision,
  type StageBlocker,
} from './stage03-collision';
type ReviewObjectRecord = {
  center: [number, number, number]; size: [number, number, number]; rotation: number;
  assetId: string; assetName: string; family: string; chunk: string; zone: string; sourcePack: string;
};

export type StageAnchor = {
  id: string;
  kind: string;
  position: [number, number, number];
  facing: number;
  radius: number;
};
type Asset = {
  id: string;
  url: string;
  triangles: number;
  bytes: number;
  lods?: (Asset & { distance: number })[];
};
export type StageManifest = {
  mapId: string;
  phase: string;
  bounds: { min: number[]; max: number[] };
  chunks: Asset[];
  modules: (Asset & { kind: string })[];
  placements: {
    id: string;
    module: string;
    position: number[];
    scale: number[];
    rotation?: number;
    sector: number;
  }[];
  collision: Asset;
  blockers: StageBlocker[];
  boundary: { center: number[]; radius: number };
  anchors: StageAnchor[];
  records: { id: string; group: string; min: number[]; max: number[] }[];
  payloadBytes?: number;
  cameraVolumes?: { id: string; min: number[]; max: number[] }[];
  cameraWall?: { center: number[]; radius: number; minY: number; maxY: number };
  textures?: Record<string, { color: string; normal: string; orm: string }>;
};
export async function buildStage03(
  onProgress: (text: string) => void = () => {},
  base = '/assets/maps/averion/',
) {
  const response = await fetch(base + 'manifest.json');
  if (!response.ok) throw Error(`Manifest HTTP ${response.status}`);
  const manifest: StageManifest = await response.json();
  if (!['averion', 'lumenfall-kingdom-capital-stage03-v1'].includes(manifest.mapId))
    throw Error('Invalid Stage03 manifest');
  const root = new T.Group();
  root.name = manifest.mapId;
  const owned = new Set<T.Object3D>(),
    extraGeometry = new Set<T.BufferGeometry>(),
    materials = new Map<string, T.Material>();
  const textures = new Set<T.Texture>();
  const loader = new GLTFLoader();
  const dispose = () => {
    const geometry = new Set(extraGeometry),
      mats = new Set<T.Material>(materials.values());
    for (const r of [...owned, root])
      r.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometry.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            mats.add(m);
        }
      });
    for (const m of mats) {
      for (const v of Object.values(m))
        if (v instanceof T.Texture) textures.add(v);
      m.dispose();
    }
    for (const t of textures) t.dispose();
    for (const g of geometry) g.dispose();
    root.clear();
    owned.clear();
  };
  try {
    const load = async (a: Asset) => {
      onProgress(`Memuat ${a.id}…`);
      // Static hosts need no special Content-Encoding rule for the compact map package.
      // Also accept already-decoded responses from the legacy review fixture server.
      const response = await fetch(base + a.url);
      if (!response.ok) throw Error(`${a.id}: HTTP ${response.status}`);
      let data = await response.arrayBuffer();
      const magic = new Uint8Array(data, 0, Math.min(2, data.byteLength));
      if (magic[0] === 0x1f && magic[1] === 0x8b) {
        data = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
      const gltf = await loader.parseAsync(data, base);
      owned.add(gltf.scene);
      gltf.scene.updateMatrixWorld(true);
      return gltf.scene;
    };
    const collisionRoot = await load(manifest.collision);
    collisionRoot.traverse((o) => {
      if (o instanceof T.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.name = 'S03_GROUND';
      }
    });
    const ground = new ImportedMapGround(collisionRoot, ['S03_GROUND']);
    const spawnAnchor = manifest.anchors.find((a) => a.id === 'spawn');
    if (!spawnAnchor) throw Error('Missing Stage03 spawn');
    const spawn = { x: spawnAnchor.position[0], z: spawnAnchor.position[2] };
    const collision = new Stage03Collision(
      manifest.blockers,
      manifest.boundary,
      (x, z) => ground.heightAt(x, z),
      spawn,
    );
    if (!collision.valid(spawn))
      throw Error('Stage03 spawn has no safe collision surface');
    for (const a of manifest.anchors) {
      const y = ground.heightAt(a.position[0], a.position[2]);
      if (y !== undefined) a.position[1] = y;
    }
    const normalize = (m: T.Material) => {
      const found = materials.get(m.name);
      if (found) return found;
      materials.set(m.name, m);
      return m;
    };
    const lods: T.LOD[] = [];
    // Batch each chunk by family. Dedicated review records retain original building IDs.
    async function batch(a: Asset) {
      const source = await load(a),
        chunk = new T.Group();
      chunk.name = a.id;
      const batches = new Map<T.Material, T.BufferGeometry[]>();
      source.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        const slices = o.geometry.groups.length
          ? o.geometry.groups
          : [
              {
                start: 0,
                count:
                  o.geometry.index?.count ??
                  o.geometry.attributes.position.count,
                materialIndex: 0,
              },
            ];
        for (const slice of slices) {
          const mat = normalize(mm[slice.materialIndex ?? 0]);
          let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          if (g.index) {
            const unindexed = g.toNonIndexed();
            g.dispose();
            g = unindexed;
          }
          for (const name of Object.keys(g.attributes))
            if (!['position', 'normal', 'uv', 'color'].includes(name))
              g.deleteAttribute(name);
          if (!g.attributes.normal) g.computeVertexNormals();
          if (!g.attributes.uv)
            g.setAttribute(
              'uv',
              new T.BufferAttribute(
                new Float32Array(g.attributes.position.count * 2),
                2,
              ),
            );
          if (!g.attributes.color)
            g.setAttribute(
              'color',
              new T.BufferAttribute(
                new Float32Array(g.attributes.position.count * 4).fill(1),
                4,
              ),
            );
          else if (g.attributes.color.itemSize === 3) {
            const attr = g.getAttribute('color'),
              colors = new Float32Array(g.attributes.position.count * 4).fill(
                1,
              );
            for (let i = 0; i < g.attributes.position.count; i++) {
              colors[i * 4] = attr.getX(i);
              colors[i * 4 + 1] = attr.getY(i);
              colors[i * 4 + 2] = attr.getZ(i);
            }
            g.setAttribute('color', new T.BufferAttribute(colors, 4));
          }
          for (const name of Object.keys(g.attributes)) {
            const attr = g.getAttribute(name);
            const values = new Float32Array(slice.count * attr.itemSize);
            for (let i = 0; i < slice.count; i++) {
              const j = slice.start + i;
              values[i * attr.itemSize] = attr.getX(j);
              if (attr.itemSize > 1)
                values[i * attr.itemSize + 1] = attr.getY(j);
              if (attr.itemSize > 2)
                values[i * attr.itemSize + 2] = attr.getZ(j);
              if (attr.itemSize > 3)
                values[i * attr.itemSize + 3] = attr.getW(j);
            }
            g.setAttribute(name, new T.BufferAttribute(values, attr.itemSize));
          }
          g.clearGroups();
          extraGeometry.add(g);
          const list = batches.get(mat) ?? [];
          list.push(g);
          batches.set(mat, list);
        }
      });
      for (const [m, gg] of batches) {
        const geo = mergeGeometries(gg, false);
        if (!geo) throw Error(`Batch failed: ${a.id}/${m.name}`);
        extraGeometry.add(geo);
        if (m instanceof T.MeshStandardMaterial) m.vertexColors = true;
        m.shadowSide = T.FrontSide;
        const mesh = new T.Mesh(geo, m);
        mesh.castShadow =
          a.id !== 'shell' &&
          !['S03_paving', 'S03_ground', 'S03_water', 'S03_fabric'].includes(
            m.name,
          );
        mesh.receiveShadow = true;
        chunk.add(mesh);
        for (const g of gg) {
          g.dispose();
          extraGeometry.delete(g);
        }
      }
      return chunk;
    }
    for (const a of manifest.chunks) {
      const near = await batch(a);
      if (!a.lods?.length) {
        root.add(near);
        continue;
      }
      const lod = new T.LOD(),
        center = new T.Box3().setFromObject(near).getCenter(new T.Vector3());
      lod.position.copy(center);
      lod.name = a.id;
      near.position.copy(center).negate();
      lod.addLevel(near, 0);
      for (const asset of a.lods) {
        const level = await batch(asset);
        level.position.copy(center).negate();
        lod.addLevel(level, asset.distance, 0.12);
      }
      root.add(lod);
      lods.push(lod);
    }
    const instanceGroups: {
      object: T.InstancedMesh;
      near: T.BufferGeometry;
      far: T.BufferGeometry;
      small: boolean;
    }[] = [];
    for (const a of manifest.modules) {
      const source = await load(a);
      source.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        for (let sector = 0; sector < 8; sector++) {
          const places = manifest.placements.filter(
            (p) => p.module === a.kind && p.sector === sector,
          );
          if (!places.length) continue;
          const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
          extraGeometry.add(geo);
          if (!geo.attributes.color)
            geo.setAttribute(
              'color',
              new T.BufferAttribute(
                new Float32Array(geo.attributes.position.count * 4).fill(1),
                4,
              ),
            );
          const mat = normalize(
            Array.isArray(o.material) ? o.material[0] : o.material,
          );
          const inst = new T.InstancedMesh(geo, mat, places.length);
          inst.name = `${a.kind}-${sector}`;
          const matrix = new T.Matrix4();
          places.forEach((p, i) => {
            matrix.compose(
              new T.Vector3().fromArray(p.position),
              new T.Quaternion().setFromAxisAngle(
                new T.Vector3(0, 1, 0),
                p.rotation ?? 0,
              ),
              new T.Vector3().fromArray(p.scale),
            );
            inst.setMatrixAt(i, matrix);
          });
          inst.computeBoundingSphere();
          inst.castShadow = !(a.kind.startsWith('tree') && mat.name === 'S03_wood');
          inst.receiveShadow = true;
          root.add(inst);
          const pieces = a.kind.startsWith('tree')
            ? [[-0.18, 0.65, 0, 0.30], [0.18, 0.68, 0.04, 0.28], [0, 0.83, -0.04, 0.20]]
            : [[-0.18, 0.4, 0, 0.28], [0.17, 0.45, 0, 0.28], [0, 0.62, 0.12, 0.27]];
          const parts = pieces.map(([x, y, z, r]) => {
            const geometry = new T.IcosahedronGeometry(r, 0);
            if (a.kind === 'tree-spire') geometry.scale(0.65, 1.25, 0.65);
            geometry.translate(x, y, z);
            return geometry;
          });
          const far = mergeGeometries(parts, false)!;
          for (const part of parts) part.dispose();
          extraGeometry.add(far);
          far.setAttribute(
            'color',
            new T.BufferAttribute(
              new Float32Array(far.attributes.position.count * 4).fill(1),
              4,
            ),
          );
          if (a.kind !== 'tower' && mat.name === 'S03_foliage')
            instanceGroups.push({
              object: inst,
              near: geo,
              far,
              small: a.kind === 'shrub',
            });
        }
      });
    }
    if (manifest.textures) {
      const textureLoader = new T.TextureLoader(),
        cache = new Map<string, T.Texture>();
      const texture = async (url: string) => {
        if (cache.has(url)) return cache.get(url)!;
        const t = await textureLoader.loadAsync(base + url);
        cache.set(url, t);
        textures.add(t);
        return t;
      };
      for (const [family, files] of Object.entries(manifest.textures)) {
        const mat = materials.get('S03_' + family);
        if (!(mat instanceof T.MeshStandardMaterial)) continue;
        const color = await texture(files.color);
        color.colorSpace = T.SRGBColorSpace;
        const normal = await texture(files.normal);
        const orm = await texture(files.orm);
        for (const t of [color, normal, orm]) {
          t.wrapS = t.wrapT = T.RepeatWrapping;
          t.anisotropy = 4;
        }
        mat.map = color;
        mat.color.set('white');
        mat.normalMap = normal;
        mat.normalScale.set(0.45, 0.45);
        mat.roughnessMap = orm;
        mat.metalnessMap = orm;
        mat.aoMap = orm;
        mat.aoMapIntensity = 0.45;
        mat.needsUpdate = true;
      }
    }
    root.updateMatrixWorld(true);
    const proxies = new T.Group();
    proxies.name = 'Stage03 camera proxies';
    for (const b of manifest.blockers) {
      if (b.kind !== 'polygon') continue;
      const shape = new T.Shape(
        b.points.map((p) => new T.Vector2(p[0], -p[1])),
      );
      const geo = new T.ExtrudeGeometry(shape, {
        depth: b.maxY - b.minY,
        bevelEnabled: false,
      });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, b.minY, 0);
      extraGeometry.add(geo);
      const mesh = new T.Mesh(
        geo,
        new T.MeshBasicMaterial({ side: T.DoubleSide }),
      );
      proxies.add(mesh);
    }
    owned.add(proxies);
    for (const volume of manifest.cameraVolumes ?? []) {
      const min = new T.Vector3().fromArray(volume.min);
      const max = new T.Vector3().fromArray(volume.max);
      const size = max.clone().sub(min);
      const geo = new T.BoxGeometry(size.x, Math.max(size.y, 0.1), size.z);
      geo.translate(...min.add(max).multiplyScalar(0.5).toArray());
      extraGeometry.add(geo);
      proxies.add(new T.Mesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide })));
    }
    if (manifest.cameraWall) {
      const w = manifest.cameraWall;
      const geo = new T.CylinderGeometry(w.radius, w.radius, w.maxY-w.minY, 96, 1, true);
      geo.translate(w.center[0], (w.minY+w.maxY)/2, w.center[1]);
      extraGeometry.add(geo);
      proxies.add(new T.Mesh(geo, new T.MeshBasicMaterial({side: T.DoubleSide})));
    }
    proxies.updateMatrixWorld(true);
    const ray = new T.Raycaster();
    const constrainCamera = (focus: T.Vector3, desired: T.Vector3) => {
      const direction = desired.clone().sub(focus);
      const length = direction.length();
      direction.normalize();
      let hitDistance = Infinity;
      for (const offset of [new T.Vector3(), new T.Vector3(.22,0,0), new T.Vector3(-.22,0,0), new T.Vector3(0,.22,0), new T.Vector3(0,-.22,0)]) {
        ray.set(focus.clone().add(offset), direction);
        ray.far = length;
        const hit = ray.intersectObjects(proxies.children, false)[0];
        if (hit) hitDistance = Math.min(hitDistance, hit.distance);
      }
      return Number.isFinite(hitDistance)
        ? focus
            .clone()
            .addScaledVector(direction, Math.max(0.4, hitDistance - 0.35))
        : desired;
    };
    const records: ReviewObjectRecord[] = manifest.records.map((r) => ({
      assetId: r.id,
      assetName: r.id,
      chunk: r.group,
      zone: r.group,
      family: 'ARCHITECTURE',
      sourcePack: 'Stage03 working derivative',
      rotation: 0,
      center: [
        (r.min[0] + r.max[0]) / 2,
        (r.min[2] + r.max[2]) / 2,
        -(r.min[1] + r.max[1]) / 2,
      ],
      size: [r.max[0] - r.min[0], r.max[2] - r.min[2], r.max[1] - r.min[1]],
    }));
    return {
      root,
      manifest,
      spawn,
      anchors: manifest.anchors,
      collision,
      groundHeight: (x: number, z: number) => {
        const y = ground.heightAt(x, z);
        if (y === undefined)
          throw Error('No Stage03 ground at requested position');
        return y;
      },
      move: (p: { x: number; z: number }, dx: number, dz: number) =>
        collision.move(p, dx, dz),
      constrainCamera,
      updateLOD(camera: T.Camera) {
        for (const lod of lods) lod.update(camera);
        for (const item of instanceGroups) {
          const d = Math.max(
            0,
            camera.position.distanceTo(item.object.boundingSphere!.center) -
              item.object.boundingSphere!.radius,
          );
          item.object.geometry = d > 75 ? item.far : item.near;
          item.object.visible = !item.small || d < 60;
        }
      },
      metrics: () => ({
        triangles:
          manifest.chunks.reduce(
            (n, a) =>
              n +
              a.triangles +
              (a.lods ?? []).reduce((s, l) => s + l.triangles, 0),
            0,
          ) + manifest.modules.reduce((n, a) => n + a.triangles, 0),
        materials: materials.size,
        payload:
          manifest.payloadBytes ??
          manifest.chunks.reduce((n, a) => n + a.bytes, 0),
        textures: [...textures].reduce(
          (n, t) =>
            n + ((t.image?.width ?? 0) * (t.image?.height ?? 0) * 4 * 4) / 3,
          0,
        ),
        placements: manifest.placements.length,
      }),
      reviewObjects: () => records,
      dispose,
    };
  } catch (e) {
    dispose();
    throw e;
  }
}
