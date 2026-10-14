import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPlainsSky } from './verdant-plains-sky';
import { createColdMapMaterial } from './map-master-material';
import { createFrostWeather } from './frostfire-weather';
import { FrostFootprints, FOOTPRINT_LIMIT } from './frostfire-footprints';
import {
  FROSTFIRE_PATHS,
  FROSTFIRE_STEP,
  FROSTFIRE_ENTRY,
  FrostNavigation,
  frostHeight,
  frostGlacierProfile,
  frostIce,
  frostPathDistance,
  frostProps,
  frostSmooth,
  frostSurface,
  type FrostPoint,
} from './frostfire-highlands-layout';
const ROOT = '/assets/maps/frostfire-highlands-v2/',
  SHARED = '/assets/maps/verdant-plains-v2/';
export async function buildFrostfireHighlands() {
  const root = new T.Group();
  root.name = 'Frostfire Highlands';
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
  let disposed = false;
  let weather: ReturnType<typeof createFrostWeather> | undefined;
  let importedPromise: Promise<PromiseSettledResult<T.Group>[]> | undefined;
  const prints = new FrostFootprints();
  function dispose() {
    if (disposed) return;
    disposed = true;
    weather?.dispose();
    prints.reset();
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => {
      t.dispose();
      // GLTFLoader decodes embedded images as ImageBitmaps when available.
      const image = t.source.data;
      if (typeof image?.close === 'function') image.close();
    });
    root.clear();
  }
  try {
    const loader = new T.TextureLoader();
    const sources = [
      ROOT + 'snow_02-diff.webp',
      ROOT + 'snow_03-diff.webp',
      ROOT + 'snow_02-rough.webp',
      SHARED + 'rock.webp',
      SHARED + 'water-ocean-normal.webp',
      SHARED + 'sky-clouds.webp',
      ROOT + 'snow-sprite.webp',
      ROOT + 'wind-movement.webp',
    ];
    const assetLoader = new GLTFLoader();
    const modelLoads = Promise.allSettled(
      ['snow-rock-pile.glb', 'snowy-pine-tree.glb'].map(async (file) => {
        const scene = (await assetLoader.loadAsync(ROOT + file)).scene;
        scene.updateMatrixWorld(true);
        scene.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          ownGeometry(o.geometry);
          const source = Array.isArray(o.material) ? o.material : [o.material];
          source.forEach((m) => {
            ownMaterial(m);
            Object.values(m).forEach((v) => {
              if (v instanceof T.Texture) {
                textures.add(v);
                v.anisotropy = 4;
              }
            });
          });
        });
        return scene;
      }),
    );
    importedPromise = modelLoads;
    const [loaded, imported] = await Promise.all([
      Promise.allSettled(
        sources.map(async (url, i) => {
          const t = await loader.loadAsync(url);
          textures.add(t);
          t.wrapS = t.wrapT =
            i === 5 || i === 6 ? T.ClampToEdgeWrapping : T.RepeatWrapping;
          t.colorSpace =
            i === 0 || i === 1 || i === 3 ? T.SRGBColorSpace : T.NoColorSpace;
          t.anisotropy = 4;
          return t;
        }),
      ),
      modelLoads,
    ]);
    const failed = loaded.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const [snow, packed, rough, rock, water, clouds, sprite, wind] = loaded.map(
      (r) => (r as PromiseFulfilledResult<T.Texture>).value,
    );
    const profile = { snow, packed, rough, rock, water };
    const terrainMat = ownMaterial(createColdMapMaterial(profile, 'terrain')),
      glacierMat = ownMaterial(createColdMapMaterial(profile, 'glacier')),
      oceanMat = ownMaterial(createColdMapMaterial(profile, 'ocean'));
    const sky = createPlainsSky(clouds, true);
    sky.mesh.name = 'Frostfire UDS winter dawn';
    ownGeometry(sky.mesh.geometry);
    ownMaterial(sky.mesh.material);
    root.add(sky.mesh);
    const surfaces = new T.Group();
    surfaces.name = 'Frostfire collision surfaces';
    root.add(surfaces);
    // 8x8 chunks; every full-resolution triangle agrees with frostHeight().
    for (let cz = 0; cz < 8; cz++)
      for (let cx = 0; cx < 8; cx++) {
        const pos: number[] = [],
          mask: number[] = [],
          indices: number[] = [],
          normals: number[] = [];
        for (let j = 0; j <= 64; j++)
          for (let i = 0; i <= 64; i++) {
            const x = (cx * 64 + i) * FROSTFIRE_STEP - 500,
              z = (cz * 64 + j) * FROSTFIRE_STEP - 500,
              s = frostSurface(x, z);
            pos.push(x, s.height, z);
            normals.push(s.normal.x, s.normal.y, s.normal.z);
            mask.push(
              1 - frostSmooth(0, 5, frostPathDistance({ x, z })),
              1 - frostSmooth(-2, 1, frostIce({ x, z }).distance),
              frostGlacierProfile(x, z).ice,
            );
          }
        for (let j = 0; j < 64; j++)
          for (let i = 0; i < 64; i++) {
            const a = j * 65 + i;
            indices.push(a, a + 65, a + 1, a + 1, a + 65, a + 66);
          }
        const g = ownGeometry(new T.BufferGeometry());
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
        g.setAttribute('frostMask', new T.Float32BufferAttribute(mask, 3));
        g.setIndex(indices);
        g.computeBoundingSphere();
        const mesh = new T.Mesh(g, terrainMat);
        mesh.receiveShadow = true;
        mesh.name = `Frostfire terrain ${cx},${cz}`;
        surfaces.add(mesh);
      }
    const ocean = new T.Mesh(
      ownGeometry(new T.PlaneGeometry(3000, 3000)),
      oceanMat,
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1.5;
    ocean.name = 'Outer sea boundary';
    root.add(ocean);
    // Frozen falls are sculpted directly into the terrain, including their
    // shoulders and lake contact. No open-sided shells or intersecting caps.
    const props = frostProps(),
      boulders = props.filter((p) => p.kind === 'rock'),
      trees = props.filter((p) => p.kind === 'fir');
    const dummy = new T.Object3D();
    const failedModel = imported.find((result) => result.status === 'rejected');
    if (failedModel?.status === 'rejected') throw failedModel.reason;
    const [rockAsset, pineAsset] = imported.map(
      (result) => (result as PromiseFulfilledResult<T.Group>).value,
    );
    function placeAsset(asset: T.Group, kind: 'rock' | 'fir') {
      const box = new T.Box3().setFromObject(asset),
        center = box.getCenter(new T.Vector3()),
        size = box.getSize(new T.Vector3());
      // Pine: 7 m before per-instance variation. Rock: fit the existing footprint.
      const unitScale =
        kind === 'fir' ? 7 / size.y : 1.7 / Math.hypot(size.x, size.z);
      const height = size.y * unitScale;
      const bury = height * (kind === 'fir' ? 0.045 : 0.04);
      const footprint =
        kind === 'fir' ? Math.max(size.x, size.z) * unitScale * 0.5 : 0.85;
      const instances = kind === 'fir' ? trees : boulders;
      const normalize = new T.Matrix4()
        .makeScale(unitScale, unitScale, unitScale)
        .multiply(
          new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
        );
      asset.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        // Bake only the runtime copy; the supplied GLBs stay byte-for-byte intact.
        const geometry = ownGeometry(o.geometry.clone());
        geometry.applyMatrix4(
          new T.Matrix4().multiplyMatrices(normalize, o.matrixWorld),
        );
        geometry.computeBoundingSphere();
        const batch = new T.InstancedMesh(
          geometry,
          o.material,
          instances.length,
        );
        instances.forEach((p, i) => {
          let ground = frostHeight(p.x, p.z);
          // Use the lowest terrain contact around the base, hiding the pine's
          // small terrain pad even when it straddles a gentle slope.
          for (let side = 0; side < 12; side++) {
            const angle = (side * Math.PI) / 6;
            ground = Math.min(
              ground,
              frostHeight(
                p.x + Math.cos(angle) * footprint * p.scale,
                p.z + Math.sin(angle) * footprint * p.scale,
              ),
            );
          }
          dummy.position.set(p.x, ground - bury * p.scale, p.z);
          dummy.rotation.set(0, p.yaw, 0);
          dummy.scale.setScalar(p.scale);
          dummy.updateMatrix();
          batch.setMatrixAt(i, dummy.matrix);
        });
        batch.castShadow = true;
        batch.receiveShadow = true;
        batch.computeBoundingSphere();
        batch.name =
          kind === 'fir'
            ? 'Imported snowy pine trees'
            : 'Imported snowy rock piles';
        batch.userData.frostAsset = {
          file: kind === 'fir' ? 'snowy-pine-tree.glb' : 'snow-rock-pile.glb',
          height,
          bury,
          footprint,
        };
        root.add(batch);
      });
    }
    placeAsset(rockAsset, 'rock');
    placeAsset(pineAsset, 'fir');
    // Small offshore ice floes are visual only; navigation never permits the sea.
    const floeGeometry = ownGeometry(new T.CylinderGeometry(1, 1.15, 1, 7));
    const floes = new T.InstancedMesh(floeGeometry, glacierMat, 36);
    for (let i = 0; i < 36; i++) {
      const a = i * 2.399,
        x = Math.cos(a) * (465 + (i % 4) * 24),
        z = Math.sin(a) * (460 + (i % 5) * 13);
      dummy.position.set(x, 0.2, z);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(4 + (i % 6) * 2, 1.5 + (i % 4), 5 + (i % 4) * 2);
      dummy.updateMatrix();
      floes.setMatrixAt(i, dummy.matrix);
    }
    floes.computeBoundingSphere();
    root.add(floes);
    weather = createFrostWeather(sprite, wind);
    root.add(weather.mesh);
    const footprintGeometry = ownGeometry(new T.PlaneGeometry(0.25, 0.58));
    footprintGeometry.rotateX(-Math.PI / 2);
    const alphas = new T.InstancedBufferAttribute(
      new Float32Array(FOOTPRINT_LIMIT),
      1,
    ).setUsage(T.DynamicDrawUsage);
    footprintGeometry.setAttribute('printOpacity', alphas);
    const footprintMaterial = ownMaterial(
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        uniforms: {},
        vertexShader: `attribute float printOpacity;varying vec2 vUv;varying float vOpacity;void main(){vUv=uv;vOpacity=printOpacity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec2 vUv;varying float vOpacity;void main(){vec2 p=(vUv-.5)*2.;float sole=(1.-smoothstep(.65,1.,length(vec2(p.x,p.y*.85))));float arch=1.-.35*exp(-pow((p.y+.1)*5.,2.));float tread=.9+.1*sin(p.y*45.);float a=sole*arch*tread*vOpacity;if(a<.003)discard;gl_FragColor=vec4(.28,.39,.48,a);}`,
      }),
    );
    const footprints = new T.InstancedMesh(
      footprintGeometry,
      footprintMaterial,
      FOOTPRINT_LIMIT,
    );
    footprints.frustumCulled = false;
    footprints.raycast = () => {};
    footprints.name = 'Pooled local snow footprints';
    root.add(footprints);
    let time = 0;
    const normal = new T.Vector3(),
      up = new T.Vector3(0, 1, 0),
      yaw = new T.Quaternion(),
      rotation = new T.Quaternion();
    const navigation = new FrostNavigation();
    const mini = document.createElement('canvas');
    mini.width = mini.height = 256;
    const ctx = mini.getContext('2d')!;
    for (let j = 0; j < 256; j++)
      for (let i = 0; i < 256; i++) {
        const s = frostSurface((i / 256) * 1000 - 500, (j / 256) * 1000 - 500);
        ctx.fillStyle =
          s.kind === 'water'
            ? '#18465b'
            : s.kind === 'ice'
              ? '#76b9d1'
              : s.kind === 'rock'
                ? '#647888'
                : s.kind === 'packedSnow'
                  ? '#b9ced9'
                  : '#e0eaf0';
        ctx.fillRect(i, j, 1, 1);
      }
    const project = (n: number) => ((n + 500) / 1000) * 256;
    ctx.strokeStyle = '#a2b9c9';
    ctx.lineWidth = 1;
    for (const path of FROSTFIRE_PATHS) {
      ctx.beginPath();
      path.points.forEach((p, i) =>
        i
          ? ctx.lineTo(project(p.x), project(p.z))
          : ctx.moveTo(project(p.x), project(p.z)),
      );
      ctx.stroke();
    }
    return {
      root,
      surfaces,
      navigation,
      groundHeight: frostHeight,
      move: navigation.move.bind(navigation),
      entry: FROSTFIRE_ENTRY,
      dispose,
      update(
        camera: T.Camera,
        player: FrostPoint,
        dt: number,
        walking: boolean,
        pixelRatio: number,
      ) {
        if (disposed) return;
        time += Math.max(0, dt);
        sky.update(camera, time);
        oceanMat.userData.time.value = time;
        weather!.update(camera, dt, pixelRatio);
        prints.update(player, time, dt, walking);
        for (const i of prints.expiredSlots) alphas.setX(i, 0);
        for (const i of prints.activeSlots) {
          const p = prints.slots[i]!;
          const alpha =
            prints.opacity(p, time) *
            (1 -
              frostSmooth(45, 60, Math.hypot(player.x - p.x, player.z - p.z)));
          alphas.setX(i, alpha);
          normal.set(p.nx, p.ny, p.nz);
          rotation.setFromUnitVectors(up, normal);
          yaw.setFromAxisAngle(up, p.yaw);
          dummy.position.set(p.x, p.y, p.z);
          dummy.quaternion.copy(rotation).multiply(yaw);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          footprints.setMatrixAt(i, dummy.matrix);
        }
        if (prints.activeSlots.size || prints.expiredSlots.length)
          alphas.needsUpdate = true;
        if (prints.activeSlots.size)
          footprints.instanceMatrix.needsUpdate = true;
      },
      drawMinimap(target: CanvasRenderingContext2D, size: number) {
        target.drawImage(mini, 0, 0, size, size);
      },
      metrics: () => ({
        terrainChunks: surfaces.children.length,
        trees: trees.length,
        rocks: boulders.length,
        footprints: prints.count,
        footprintLimit: FOOTPRINT_LIMIT,
        snow: weather!.metrics(),
        textures: textures.size,
      }),
    };
  } catch (error) {
    if (importedPromise) await importedPromise;
    dispose();
    throw error;
  }
}
