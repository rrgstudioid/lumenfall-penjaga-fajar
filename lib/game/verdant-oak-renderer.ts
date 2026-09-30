import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAINS_OAKS } from './verdant-plains-oaks';
import { plainsTerrainHeight, type PlainsPoint } from './verdant-plains-layout';
import type { PlainsQuality } from './verdant-plains-quality';
import { oakLod } from './verdant-oak-lod';

const PATH = '/assets/maps/verdant-plains-v2/oak/';
const COST = [23560, 10120, 3280, 2];
const BUDGET = { office: 40000, light: 80000, balanced: 180000, high: 300000 };

/** A map-owned forest: one active representation per placement, shared wind/materials. */
export async function createPlainsOaks(heightmap: T.Texture) {
  const root = new T.Group();
  const count = PLAINS_OAKS.length;
  root.name = `Giant oaks (${count})`;
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const time = { value: 0 };
  let disposed = false;
  const dispose = () => {
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
  };
  try {
    // Own partial successes too, so retry never leaves a hidden forest or leaked textures.
    const results = await Promise.allSettled([
      new GLTFLoader().loadAsync(PATH + 'oak.gltf').then((g) => {
        g.scene.updateMatrixWorld(true);
        g.scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            geometries.add(o.geometry);
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              materials.add(m);
              for (const v of Object.values(m))
                if (v instanceof T.Texture) textures.add(v);
            }
          }
        });
        return g;
      }),
      ...['impostor.png', 'impostor-normal.png'].map(async (name) => {
        const t = await new T.TextureLoader().loadAsync(PATH + name);
        textures.add(t);
        t.colorSpace =
          name === 'impostor.png' ? T.SRGBColorSpace : T.NoColorSpace;
        t.flipY = false;
        return t;
      }),
    ]);
    const failure = results.find((r) => r.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const model = (
      results[0] as PromiseFulfilledResult<
        Awaited<ReturnType<GLTFLoader['loadAsync']>>
      >
    ).value;
    const atlas = (results[1] as PromiseFulfilledResult<T.Texture>).value;
    const normals = (results[2] as PromiseFulfilledResult<T.Texture>).value;
    const windShader = (material: T.Material, leaf: boolean) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.oakTime = time;
        shader.uniforms.oakGround = { value: heightmap };
        shader.vertexShader =
          `uniform float oakTime; uniform sampler2D oakGround; attribute vec4 oakData;\n` +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          ${
            leaf
              ? ''
              : `if(position.y < 1.2) {
          vec3 oakWorld = (instanceMatrix * vec4(position,1.0)).xyz;
          // Same heightfield as terrain. Only the low root band follows local ground.
          vec2 grid = clamp((oakWorld.xz + 500.0) / (1000.0/512.0), 0.0, 511.9999);
          vec2 cell = floor(grid), f = fract(grid);
          float a = texture2D(oakGround,(cell+0.5)/513.0).r;
          float b = texture2D(oakGround,(cell+vec2(1.5,0.5))/513.0).r;
          float c = texture2D(oakGround,(cell+vec2(0.5,1.5))/513.0).r;
          float d = texture2D(oakGround,(cell+1.5)/513.0).r;
          float ground = f.x+f.y<=1.0 ? a+f.x*(b-a)+f.y*(c-a) : d+(1.0-f.x)*(c-d)+(1.0-f.y)*(b-d);
          transformed.y += clamp(ground-instanceMatrix[3].y,-0.8,0.8)/oakData.z * (1.0-smoothstep(0.0,1.2,position.y));
          }`
          }
          ${
            leaf
              ? `float sway = sin(oakTime*1.25+oakData.x+position.y*.5)+.35*sin(oakTime*2.1+position.x*.9);
          transformed.xz += vec2(0.13,0.065)*sway*smoothstep(5.0,19.0,position.y);`
              : `transformed.xz += vec2(0.016,0.008)*sin(oakTime*1.25+oakData.x+position.y*.5)*smoothstep(10.0,20.0,position.y);`
          }
        `,
        );
      };
      material.customProgramCacheKey = () => 'giant-oak-root-wind-' + leaf;
    };
    type Batch = {
      mesh: T.InstancedMesh;
      signature: string;
      lod: number;
      variant: number;
      shadow: boolean;
    };
    const batches: Batch[] = [];
    const addBatch = (
      geometry: T.BufferGeometry,
      material: T.Material,
      variant: number,
      lod: number,
      shadow = false,
    ) => {
      geometries.add(geometry);
      materials.add(material);
      geometry.setAttribute(
        'oakData',
        new T.InstancedBufferAttribute(new Float32Array(count * 4), 4),
      );
      const mesh = new T.InstancedMesh(geometry, material, count);
      mesh.name = `Oak ${variant} LOD${lod} ${shadow ? 'shadow' : 'visible'}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = shadow;
      mesh.receiveShadow = !shadow;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.raycast = () => {};
      root.add(mesh);
      batches.push({ mesh, signature: '', lod, variant, shadow });
      return mesh;
    };
    for (const o of model.scene.children) {
      if (!(o instanceof T.Mesh)) continue;
      const match = o.name.match(/Oak(\d)_L(\d)_(Bark|Foliage)/);
      if (!match) continue;
      const variant = Number(match[1]),
        lod = Number(match[2]),
        leaf = match[3] === 'Foliage',
        shadow = lod > 3;
      const material = (o.material as T.MeshStandardMaterial).clone();
      material.transparent = false;
      material.alphaTest = leaf ? 0.35 : 0;
      material.alphaToCoverage = leaf && !shadow;
      material.side = leaf ? T.DoubleSide : T.FrontSide;
      material.roughness = 0.9;
      material.metalness = 0;
      material.normalScale.setScalar(leaf ? 0.4 : 0.55);
      if (leaf) {
        material.color.setRGB(0.92, 0.93, 0.78);
        material.emissive.setRGB(0.09, 0.12, 0.025);
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.25;
      }
      material.colorWrite = !shadow;
      material.depthWrite = !shadow;
      windShader(material, leaf);
      const mesh = addBatch(
        o.geometry.clone().applyMatrix4(o.matrixWorld),
        material,
        variant,
        lod,
        shadow,
      );
      if (shadow) {
        const depth = new T.MeshDepthMaterial({
          depthPacking: T.RGBADepthPacking,
          map: material.map,
          alphaTest: material.alphaTest,
          side: material.side,
        });
        windShader(depth, leaf);
        materials.add(depth);
        mesh.customDepthMaterial = depth;
      }
    }
    // One fully camera-facing quad per far tree; select a baked azimuth/elevation.
    const farProjection = { value: new T.Matrix4() };
    const farMaterial = new T.MeshStandardMaterial({
      map: atlas,
      alphaTest: 0.3,
      alphaToCoverage: true,
      roughness: 0.9,
      side: T.DoubleSide,
    });
    farMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.oakNormals = { value: normals };
      shader.uniforms.oakProjection = farProjection;
      shader.vertexShader =
        'attribute vec4 oakData; varying vec4 vOakData;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv=(uv+oakData.xy)/vec2(8.0,4.0); vOakData=oakData;`,
      );
      shader.fragmentShader =
        'uniform sampler2D oakNormals; uniform mat4 oakProjection; varying vec4 vOakData;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec4 normalDepth = texture2D(oakNormals,vMapUv);
        vec3 baked = normalDepth.rgb*2.0-1.0;
        // Blender Z-up object normals -> glTF Y-up, then instance yaw.
        baked=vec3(baked.x,baked.z,-baked.y);
        float c=cos(vOakData.w),s=sin(vOakData.w);
        normal=normalize(mat3(viewMatrix)*vec3(c*baked.x+s*baked.z,baked.y,-s*baked.x+c*baked.z));
        float depth = max(0.01,vViewPosition.z+(0.5-normalDepth.a)*30.0*vOakData.z);
        vec4 oakClip=oakProjection*vec4(-vViewPosition.xy,-depth,1.0);
        gl_FragDepth=oakClip.z/oakClip.w*0.5+0.5;`,
      );
    };
    farMaterial.customProgramCacheKey = () => 'giant-oak-multiangle-normal';
    // GLTF UVs are top-origin; PNG loader flipY=false so invert plane UV too.
    const plane = new T.PlaneGeometry(30, 30),
      uv = plane.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    addBatch(plane, farMaterial, 0, 3);

    const centers = PLAINS_OAKS.map(
      (p) =>
        new T.Vector3(p.x, plainsTerrainHeight(p.x, p.z) + 10.5 * p.scale, p.z),
    );
    const baseMatrices = PLAINS_OAKS.map((p, i) =>
      new T.Matrix4().compose(
        new T.Vector3(p.x, centers[i].y - 10.5 * p.scale, p.z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), p.yaw),
        new T.Vector3().setScalar(p.scale),
      ),
    );
    const lods = new Int8Array(count).fill(3),
      effective = new Int8Array(count).fill(-1);
    const sphere = new T.Sphere(),
      frustum = new T.Frustum(),
      projection = new T.Matrix4();
    const matrix = new T.Matrix4(),
      rotation = new T.Quaternion(),
      facing = new T.Matrix4(),
      scale = new T.Vector3(),
      up = new T.Vector3(0, 1, 0),
      color = new T.Color();
    const cameraWorld = new T.Vector3();
    let lastCamera = '',
      triangles = 0,
      shadowCount = 0,
      cpuMs = 0,
      visibleCount = 0;
    function update(
      camera: T.Camera,
      player: PlainsPoint,
      seconds: number,
      quality: PlainsQuality,
    ) {
      const start = performance.now();
      time.value = seconds;
      camera.updateMatrixWorld();
      camera.getWorldPosition(cameraWorld);
      farProjection.value.copy(camera.projectionMatrix);
      const height = typeof window === 'undefined' ? 1080 : window.innerHeight;
      const key =
        camera.matrixWorld.elements.join(',') +
        ';' +
        camera.projectionMatrix.elements.join(',') +
        ';' +
        quality +
        ';' +
        height +
        ';' +
        Math.floor(player.x) +
        ';' +
        Math.floor(player.z);
      if (key === lastCamera) {
        cpuMs = performance.now() - start;
        return;
      }
      lastCamera = key;
      frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      const visible: { i: number; distance: number }[] = [];
      for (let i = 0; i < count; i++) {
        const p = PLAINS_OAKS[i],
          distance = cameraWorld.distanceTo(centers[i]);
        sphere.set(centers[i], 16 * p.scale);
        effective[i] = -1;
        if (!frustum.intersectsSphere(sphere)) continue;
        const pixels =
          (21 *
            p.scale *
            height *
            Math.abs(camera.projectionMatrix.elements[5])) /
          (2 *
            (camera instanceof T.PerspectiveCamera
              ? Math.max(1, distance)
              : 1));
        lods[i] = oakLod(pixels, lods[i], quality === 'light' || quality === 'office');
        effective[i] = lods[i];
        visible.push({ i, distance });
      }
      visible.sort((a, b) => a.distance - b.distance);
      visibleCount = visible.length;
      const shadowIds =
        quality === 'light' || quality === 'office'
          ? []
          : PLAINS_OAKS.map((p, i) => ({
              i,
              d: Math.hypot(p.x - player.x, p.z - player.z),
            }))
              .filter((p) => p.d < (quality === 'high' ? 75 : 55))
              .sort((a, b) => a.d - b.d)
              .slice(0, quality === 'high' ? 8 : 6)
              .map((p) => p.i);
      shadowCount = shadowIds.length;
      // Proxy contributes once to the main pass and once to the shadow pass.
      const shadowCost = shadowCount * (quality === 'high' ? 2140 : 1380) * 2;
      triangles = visible.reduce(
        (sum, p) => sum + COST[effective[p.i]],
        shadowCost,
      );
      for (
        let n = visible.length - 1;
        n >= 0 && triangles > BUDGET[quality];
        n--
      ) {
        const i = visible[n].i;
        while (effective[i] < 3 && triangles > BUDGET[quality]) {
          triangles -= COST[effective[i]] - COST[effective[i] + 1];
          effective[i]++;
        }
      }
      for (const batch of batches) {
        const ids = batch.shadow
          ? batch.lod === (quality === 'high' ? 5 : 4)
            ? shadowIds.filter((i) => PLAINS_OAKS[i].variant === batch.variant)
            : []
          : visible
              .filter(
                (p) =>
                  effective[p.i] === batch.lod &&
                  (batch.lod === 3 ||
                    PLAINS_OAKS[p.i].variant === batch.variant),
              )
              .map((p) => p.i);
        const data = batch.mesh.geometry.getAttribute(
          'oakData',
        ) as T.InstancedBufferAttribute;
        const signature = ids.join(',') + (batch.lod === 3 ? ';' + key : '');
        if (signature === batch.signature) continue;
        batch.signature = signature;
        batch.mesh.count = ids.length;
        batch.mesh.visible = ids.length > 0;
        ids.forEach((i, j) => {
          const p = PLAINS_OAKS[i];
          if (batch.lod === 3) {
            facing.lookAt(cameraWorld, centers[i], up);
            rotation.setFromRotationMatrix(facing);
            matrix.compose(centers[i], rotation, scale.setScalar(p.scale));
            const dx = cameraWorld.x - p.x,
              dz = cameraWorld.z - p.z;
            const az =
              ((Math.round((Math.atan2(dx, dz) - p.yaw) / (Math.PI / 4)) % 8) +
                8) %
              8;
            const elev =
              (Math.atan2(cameraWorld.y - centers[i].y, Math.hypot(dx, dz)) *
                180) /
              Math.PI;
            const row = elev < 27.5 ? 0 : elev < 55 ? 1 : 2;
            data.setXYZW(j, az, 3 - row, p.scale, p.yaw);
          } else {
            matrix.copy(baseMatrices[i]);
            data.setXYZW(j, p.windPhase, 0, p.scale, p.yaw);
          }
          batch.mesh.setMatrixAt(j, matrix);
          color
            .setRGB(p.tint, p.tint, p.tint)
            .offsetHSL(p.hue / (Math.PI * 2), 0, 0);
          batch.mesh.setColorAt(j, color);
        });
        batch.mesh.instanceMatrix.needsUpdate = true;
        data.needsUpdate = true;
        if (batch.mesh.instanceColor)
          batch.mesh.instanceColor.needsUpdate = true;
      }
      cpuMs = performance.now() - start;
    }
    return {
      root,
      update,
      dispose,
      metrics: () => ({
        count,
        visible: visibleCount,
        lods: [0, 1, 2, 3].map(
          (l) => Array.from(effective).filter((v) => v === l).length,
        ),
        triangles,
        shadowCount,
        cpuMs,
        drawCalls: batches
          .filter((b) => b.mesh.visible && b.mesh.count)
          .reduce((s, b) => s + (b.shadow ? 2 : 1), 0),
        textureBytes: [...textures].reduce(
          (s, t) =>
            s + ((t.image?.width ?? 0) * (t.image?.height ?? 0) * 4 * 4) / 3,
          0,
        ),
      }),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
