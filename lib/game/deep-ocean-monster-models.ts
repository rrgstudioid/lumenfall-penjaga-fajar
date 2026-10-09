import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MonsterDefinition } from './regions.ts';
const prefix = 'deep-ocean-underwater-v1-';
export const isOceanSpecies = (id: string) => id.startsWith(prefix);
/** Original compact aquatic meshes. One material/draw call per creature. */
export function createOceanMonster(
  def: Pick<MonsterDefinition, 'id' | 'visualScale'>,
) {
  const slug = def.id.slice(prefix.length),
    squid = slug.startsWith('giant-squid'),
    shark = slug === 'goblin-shark' || slug === 'megalodon';
  const marlyn = slug === 'marlyn',
    mega = slug === 'megalodon';
  const length = squid ? 4 : shark ? 6 : 5,
    width = squid ? 0.85 : shark ? 1.5 : 0.7,
    center = squid ? 1.65 : shark ? 1.3 : 1.15;
  const skin = new T.Color(
    squid
      ? '#973f51'
      : mega
        ? '#455e6e'
        : shark
          ? '#a17586'
          : marlyn
            ? '#276789'
            : '#829b98',
  );
  const belly = new T.Color(squid ? '#da9787' : '#c8d2c9'),
    finColor = skin.clone().multiplyScalar(0.77);
  const parts: T.BufferGeometry[] = [];
  const add = (g: T.BufferGeometry, color: T.Color) => {
    const geometry = g.index ? g.toNonIndexed() : g;
    if (geometry !== g) g.dispose();
    geometry.deleteAttribute('uv');
    const a = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < a.length; i += 3) {
      a[i] = color.r;
      a[i + 1] = color.g;
      a[i + 2] = color.b;
    }
    geometry.setAttribute('color', new T.BufferAttribute(a, 3));
    parts.push(geometry);
  };
  const body = new T.BufferGeometry(),
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rings = 12,
    sides = 10;
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j <= sides; j++) {
      const t = i / rings,
        angle = (j / sides) * Math.PI * 2;
      const radius =
        Math.pow(Math.sin(Math.PI * t), 0.65) *
        (squid ? 0.85 : 1) *
        (1 - 0.56 * t);
      positions.push(
        Math.cos(angle) * width * 0.5 * radius,
        center + Math.sin(angle) * width * 0.44 * radius,
        (t - 0.5) * length,
      );
      const c = skin
        .clone()
        .lerp(belly, T.MathUtils.smoothstep(-Math.sin(angle), 0, 0.8));
      colors.push(c.r, c.g, c.b);
      if (i < rings && j < sides) {
        const a = i * (sides + 1) + j;
        indices.push(
          a,
          a + 1,
          a + sides + 1,
          a + 1,
          a + sides + 2,
          a + sides + 1,
        );
      }
    }
  body.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  body.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  body.setIndex(indices);
  body.computeVertexNormals();
  const flat = body.toNonIndexed();
  body.dispose();
  parts.push(flat);
  const fin = (a: number[], b: number[], c: number[], color = finColor) => {
    // Thin double-sided wedge, with explicit faces so picking and shadows agree.
    const g = new T.BufferGeometry();
    g.setAttribute(
      'position',
      new T.Float32BufferAttribute([...a, ...b, ...c, ...c, ...b, ...a], 3),
    );
    g.computeVertexNormals();
    add(g, color);
  };
  const eye = (x: number, y: number, z: number) => {
    const g = new T.SphereGeometry(squid ? 0.14 : 0.095, 8, 5);
    g.translate(x, y, z);
    add(g, new T.Color('#080f16'));
  };
  if (squid) {
    for (const sign of [-1, 1]) {
      fin(
        [0, center, 1.6],
        [sign * 1.05, center, 1],
        [sign * 0.2, center, -0.5],
      );
      eye(sign * 0.32, center, -1.2);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10,
        long = i > 7,
        points = [];
      for (let k = 0; k < 5; k++)
        points.push(
          new T.Vector3(
            Math.cos(a) * (0.2 + k * 0.18),
            center + Math.sin(a) * (0.2 + k * 0.14),
            -1.4 - k * (long ? 1.05 : 0.65),
          ),
        );
      const g = new T.TubeGeometry(
        new T.CatmullRomCurve3(points),
        7,
        long ? 0.055 : 0.085,
        4,
        false,
      );
      add(g, i % 2 ? skin : belly);
    }
  } else {
    const tail = length * 0.5;
    for (const sign of [-1, 1]) {
      fin(
        [0, center, tail - 0.55],
        [0, center + sign * (shark ? 1.25 : 0.8), tail + 0.55],
        [0, center + sign * 0.15, tail + 0.2],
      );
      fin(
        [sign * width * 0.3, center, -0.5],
        [sign * (shark ? 1.8 : 0.9), center - 0.28, 0.7],
        [sign * width * 0.3, center, 1.1],
      );
      eye(sign * width * 0.25, center + 0.14, -length * 0.31);
      // Gill slits on both flanks.
      for (let i = 0; i < 4; i++)
        fin(
          [sign * width * 0.45, center - 0.22, -0.9 + i * 0.14],
          [sign * width * 0.45, center + 0.23, -0.9 + i * 0.14],
          [sign * width * 0.45, center - 0.22, -0.85 + i * 0.14],
          new T.Color('#35434b'),
        );
    }
    fin(
      [0, center + 0.2, -0.6],
      [0, center + (marlyn ? 1.4 : shark ? 1.5 : 0.65), 0.15],
      [0, center + 0.2, 1.05],
    );
    if (!mega) {
      const g = new T.ConeGeometry(
        marlyn ? 0.09 : shark ? 0.18 : 0.1,
        marlyn ? 2 : shark ? 1.2 : 0.5,
        7,
      );
      g.rotateX(-Math.PI / 2);
      g.translate(0, center, -length * 0.5 - (marlyn ? 0.6 : 0.15));
      add(g, skin);
    }
    // Dark mouth and small pale tooth row, especially visible on the boss.
    fin(
      [-0.25, center - 0.12, -length * 0.35],
      [0.25, center - 0.12, -length * 0.35],
      [0, center - 0.36, -length * 0.46],
      new T.Color('#1f2026'),
    );
    if (shark)
      for (let i = 0; i < 6; i++) {
        const g = new T.ConeGeometry(0.03, 0.13, 4);
        g.rotateX(Math.PI);
        g.translate((i - 2.5) * 0.065, center - 0.17, -length * 0.38);
        add(g, belly);
      }
  }
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  geometry.scale(def.visualScale, def.visualScale, def.visualScale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.05,
    emissive: skin,
    emissiveIntensity: 0.12,
  });
  const clock = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.oceanTime = clock;
    shader.vertexShader = 'uniform float oceanTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float swim=sin(oceanTime*${squid ? '2.4' : '3.4'}+position.z*${(0.9 / def.visualScale).toFixed(4)});
      transformed.x+=swim*${(0.1 * def.visualScale).toFixed(4)}*smoothstep(0.,${(length * 0.5 * def.visualScale).toFixed(4)},${squid ? '-' : ''}position.z);`,
    );
  };
  material.customProgramCacheKey = () => `ocean-${slug}-${def.visualScale}`;
  const mesh = new T.Mesh(geometry, material);
  mesh.name = def.id;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.labelHeight = geometry.boundingBox!.max.y + 0.65;
  mesh.userData.swimTime = clock;
  mesh.userData.navigationRadius =
    Math.max(
      Math.abs(geometry.boundingBox!.min.z),
      Math.abs(geometry.boundingBox!.max.z),
      Math.abs(geometry.boundingBox!.max.x),
    ) + 0.2;
  mesh.userData.combatShape = {
    radius: width * 0.5 * def.visualScale,
    halfLength: length * 0.34 * def.visualScale,
  };
  return mesh;
}

/** Nearest point on the horizontal body capsule; hover never changes damage range. */
export function oceanContactPoint(
  origin: { x: number; z: number },
  center: { x: number; z: number },
  yaw: number,
  shape?: { radius: number; halfLength: number },
) {
  if (!shape) return { x: center.x, z: center.z };
  const ax = Math.sin(yaw),
    az = Math.cos(yaw),
    projection = T.MathUtils.clamp(
      (origin.x - center.x) * ax + (origin.z - center.z) * az,
      -shape.halfLength,
      shape.halfLength,
    );
  const x = center.x + ax * projection,
    z = center.z + az * projection,
    dx = origin.x - x,
    dz = origin.z - z,
    d = Math.hypot(dx, dz);
  const scale = d ? Math.min(1, shape.radius / d) : 0;
  return { x: x + dx * scale, z: z + dz * scale };
}
