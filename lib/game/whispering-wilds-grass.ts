import * as T from 'three';
import {
  WILDS_BRIDGES,
  WILDS_LANDMARKS,
  WILDS_PORTALS,
  wildsTerrainHeight,
  wildsGroundHeight,
  wildsWater,
  wildsIslandDistance,
  wildsIconTreeObstacles,
  wildsProps,
  type WildsPoint,
} from './whispering-wilds-layout.ts';
import {
  WILDS_QUALITY,
  WILDS_GRASS_RENDER,
  type WildsQuality,
} from './whispering-wilds-quality.ts';
import { wildsMushrooms } from './whispering-wilds-mushroom-layout.ts';

let obstacles: ReturnType<typeof wildsProps> | undefined;
export const WILDS_GRASS_COLOR = '#39e8ee';
export const WILDS_GRASS_EMISSION = 0.18; // Previous 0.12, increased by 50%.
/** Shared dry-ground mask for grass and its hovering fireflies. */
export function wildsGrassGround(x: number, z: number): number | undefined {
  obstacles ??= [
    ...wildsIconTreeObstacles(),
    ...wildsProps(),
    ...wildsMushrooms(),
  ];
  const p = { x, z };
  if (Math.abs(x) > 480 || Math.abs(z) > 480 || wildsIslandDistance(p) > -5)
    return;
  for (const b of WILDS_BRIDGES) {
    const dx = x - b.x,
      dz = z - b.z;
    if (
      Math.abs(dx * b.axis.x + dz * b.axis.z) < b.length / 2 + 1.1 &&
      Math.abs(-dx * b.axis.z + dz * b.axis.x) < b.width / 2 + 1.3
    )
      return;
  }
  if (wildsWater(p).distance < 2.6) return;
  const sanctuary = WILDS_LANDMARKS[3];
  if (Math.hypot(x - sanctuary.x + 9, z - sanctuary.z + 29) < 26) return;
  if (WILDS_PORTALS.some((q) => Math.hypot(x - q.x, z - q.z) < 6)) return;
  if (obstacles.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius + 0.7))
    return;
  const h = wildsTerrainHeight(x, z);
  const slope =
    Math.max(
      Math.abs(wildsTerrainHeight(x + 1, z) - wildsTerrainHeight(x - 1, z)),
      Math.abs(wildsTerrainHeight(x, z + 1) - wildsTerrainHeight(x, z - 1)),
    ) / 2;
  if (slope > 0.65) return;
  return h;
}

const CELL = 32,
  GRID = 24,
  CACHE_LIMIT = WILDS_GRASS_RENDER.cacheCells;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function createWildsGrass(quality: WildsQuality) {
  const root = new T.Group();
  root.name = 'Dense meadow grass';
  // Eleven bent, tapered blades per tuft. Opaque geometry avoids alpha overdraw.
  const vertices: number[] = [],
    colors: number[] = [];
  for (let i = 0; i < 11; i++) {
    const a = i * 2.399,
      bx = Math.cos(a) * 0.45,
      bz = Math.sin(a) * 0.45;
    const h = 0.6 + hash(i + 1) * 0.4,
      w = 0.045 + hash(i + 11) * 0.045;
    const dx = Math.cos(a + 0.8),
      dz = Math.sin(a + 0.8);
    const points = [
      [bx - dx * w, 0, bz - dz * w],
      [bx + dx * w, 0, bz + dz * w],
      [
        bx + dx * 0.12 - dx * w * 0.55,
        h * 0.57,
        bz + dz * 0.12 - dz * w * 0.55,
      ],
      [
        bx + dx * 0.12 + dx * w * 0.55,
        h * 0.57,
        bz + dz * 0.12 + dz * w * 0.55,
      ],
      [bx + dx * 0.42, h, bz + dz * 0.42],
    ];
    for (const j of [0, 1, 2, 1, 3, 2, 2, 3, 4]) {
      vertices.push(...points[j]);
      // Neutral root-to-tip shading preserves every hue of the instance tint.
      const c = new T.Color().setScalar(0.36 + 0.64 * (points[j][1] / h));
      colors.push(c.r, c.g, c.b);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const uniforms = {
    uGrassTime: { value: 0 },
    uGrassFocus: { value: new T.Vector2() },
    uGrassRange: { value: WILDS_GRASS_RENDER.outer },
    uGrassFadeStart: { value: WILDS_GRASS_RENDER.outerStart },
    uGrassPlayer: { value: new T.Vector3() },
    uGrassTrail: { value: new T.Vector2() },
  };
  const material = new T.MeshLambertMaterial({
    vertexColors: true,
    side: T.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'uniform float uGrassTime,uGrassRange,uGrassFadeStart; uniform vec2 uGrassFocus,uGrassTrail; uniform vec3 uGrassPlayer;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vec3 origin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      float growth=1.-smoothstep(uGrassFadeStart,uGrassRange,distance(origin.xz,uGrassFocus));
      transformed.y*=growth;
      transformed.x+=sin(uGrassTime*1.25+origin.x*.16+origin.z*.11)*position.y*position.y*.13*growth;
      transformed.z+=cos(uGrassTime*.9+origin.z*.18)*position.y*position.y*.08*growth;
      // Same swept, smoothed footstep capsule as Verdant Plains. Translate the
      // world-space push back through the rotated/scaled instance basis.
      vec2 stepVector=uGrassPlayer.xz-uGrassTrail;
      float stepT=clamp(dot(origin.xz-uGrassTrail,stepVector)/max(dot(stepVector,stepVector),.0001),0.,1.);
      vec2 away=origin.xz-mix(uGrassTrail,uGrassPlayer.xz,stepT);
      float contact=(1.-smoothstep(.18,1.6,length(away)))*(1.-smoothstep(1.5,3.,abs(origin.y-uGrassPlayer.y)));
      float tip=clamp(position.y/.95,0.,1.);
      vec2 direction=normalize(away+vec2(.001,.002));
      vec3 push=vec3(direction.x,0.,direction.y)*contact*.95*tip*tip*growth;
      transformed.x+=dot(push,instanceMatrix[0].xyz)/dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz);
      transformed.z+=dot(push,instanceMatrix[2].xyz)/dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz);
      transformed.y*=1.-contact*.6*tip;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * ${WILDS_GRASS_EMISSION};`,
    );
    material.userData.grassUniforms = uniforms;
  };
  material.customProgramCacheKey = () => 'wilds-meadow-grass-v3-cyan-contact';
  const cells = new Map<
    string,
    {
      mesh: T.InstancedMesh;
      x: number;
      z: number;
      count: number;
      used: number;
      sphere: T.Sphere;
    }
  >();
  const dummy = new T.Object3D(),
    tint = new T.Color();
  const frustum = new T.Frustum(),
    projection = new T.Matrix4(),
    candidateBox = new T.Box3();
  let currentQuality = quality,
    time = 0,
    nextCheck = -1,
    disposed = false,
    visible = 0,
    tufts = 0;
  let trailReady = false;
  function createCell(cx: number, cz: number) {
    const mesh = new T.InstancedMesh(geometry, material, GRID * GRID);
    mesh.name = `Meadow grass ${cx},${cz}`;
    mesh.position.set(cx * CELL, 0, cz * CELL);
    mesh.raycast = () => {};
    let count = 0;
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++) {
        const seed = (cx + 16) * 919 + (cz + 16) * 131 + j * GRID + i;
        const x = ((i + 0.1 + hash(seed) * 0.8) / GRID) * CELL,
          z = ((j + 0.1 + hash(seed + 991) * 0.8) / GRID) * CELL;
        const height = wildsGrassGround(
          mesh.position.x + x,
          mesh.position.z + z,
        );
        if (height === undefined) continue;
        dummy.position.set(x, height - 0.12, z);
        dummy.rotation.y = hash(seed + 27) * Math.PI * 2;
        dummy.scale.setScalar(0.95 + hash(seed + 19) * 0.3);
        dummy.updateMatrix();
        mesh.setMatrixAt(count, dummy.matrix);
        tint
          .set(WILDS_GRASS_COLOR)
          .multiplyScalar(0.88 + hash(seed + 41) * 0.12);
        mesh.setColorAt(count, tint);
        count++;
      }
    mesh.count = count;
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 2;
    root.add(mesh);
    const cell = {
      mesh,
      x: (cx + 0.5) * CELL,
      z: (cz + 0.5) * CELL,
      count,
      used: time,
      sphere: mesh.boundingSphere!.clone().translate(mesh.position),
    };
    cells.set(`${cx},${cz}`, cell);
    return cell;
  }
  return {
    root,
    update(camera: T.Camera, player: WildsPoint, dt: number, free = false) {
      if (disposed) return;
      time += Math.min(0.1, Math.max(0, dt));
      uniforms.uGrassTime.value = time;
      const trail = uniforms.uGrassTrail.value;
      if (
        !trailReady ||
        Math.hypot(trail.x - player.x, trail.y - player.z) > 12
      ) {
        trail.set(player.x, player.z);
        trailReady = true;
      } else {
        const follow = 1 - Math.exp(-Math.max(0, Math.min(0.1, dt)) * 7);
        trail.x += (player.x - trail.x) * follow;
        trail.y += (player.z - trail.y) * follow;
      }
      uniforms.uGrassPlayer.value.set(
        player.x,
        wildsGroundHeight(player.x, player.z),
        player.z,
      );
      const focus = free ? camera.position : player;
      uniforms.uGrassFocus.value.set(focus.x, focus.z);
      const range = WILDS_QUALITY[currentQuality].grassRange;
      uniforms.uGrassRange.value = range;
      if (time < nextCheck) return;
      nextCheck = time + 0.1;
      frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      const candidates: { cx: number; cz: number; d: number }[] = [];
      const r = Math.ceil(range / CELL) + 1,
        cx = Math.floor(focus.x / CELL),
        cz = Math.floor(focus.z / CELL);
      for (let z = cz - r; z <= cz + r; z++)
        for (let x = cx - r; x <= cx + r; x++) {
          const d = Math.hypot(
            (x + 0.5) * CELL - focus.x,
            (z + 0.5) * CELL - focus.z,
          );
          const edgeDistance = Math.hypot(
            Math.max(0, Math.abs((x + 0.5) * CELL - focus.x) - CELL / 2),
            Math.max(0, Math.abs((z + 0.5) * CELL - focus.z) - CELL / 2),
          );
          if (
            x >= -16 &&
            x < 16 &&
            z >= -16 &&
            z < 16 &&
            edgeDistance < range
          ) {
            candidateBox.min.set(x * CELL, -75, z * CELL);
            candidateBox.max.set((x + 1) * CELL, 180, (z + 1) * CELL);
            if (d < 45 || frustum.intersectsBox(candidateBox))
              candidates.push({ cx: x, cz: z, d });
          }
        }
      candidates.sort((a, b) => a.d - b.d);
      cells.forEach((c) => {
        c.mesh.visible = false;
      });
      let built = 0;
      visible = 0;
      tufts = 0;
      for (const c of candidates) {
        let cell = cells.get(`${c.cx},${c.cz}`);
        if (!cell && built < 3) {
          cell = createCell(c.cx, c.cz);
          built++;
        }
        if (!cell) continue;
        cell.mesh.visible =
          cell.count > 0 && frustum.intersectsSphere(cell.sphere);
        cell.used = time;
        if (cell.mesh.visible) {
          visible++;
          tufts += cell.count;
        }
      }
      if (cells.size > CACHE_LIMIT) {
        for (const [key, c] of [...cells.entries()].sort(
          (a, b) => a[1].used - b[1].used,
        )) {
          if (c.mesh.visible) continue;
          c.mesh.removeFromParent();
          c.mesh.dispose();
          cells.delete(key);
          if (cells.size <= CACHE_LIMIT) break;
        }
      }
    },
    setQuality(q: WildsQuality) {
      currentQuality = q;
      nextCheck = -1;
    },
    metrics: () => ({
      visibleCells: visible,
      cachedCells: cells.size,
      visibleTufts: tufts,
      range: WILDS_QUALITY[currentQuality].grassRange,
      fadeStart: WILDS_GRASS_RENDER.outerStart,
      cacheLimit: CACHE_LIMIT,
      gpuTriangles: (tufts * geometry.getAttribute('position').count) / 3,
      maxHeight: 1.25,
      color: WILDS_GRASS_COLOR,
      emission: WILDS_GRASS_EMISSION,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      cells.forEach((c) => c.mesh.dispose());
      cells.clear();
      root.removeFromParent();
      root.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
