import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  WILDS_BRIDGES,
  wildsTerrainHeight,
  wildsWater,
} from './whispering-wilds-layout.ts';

const DECK_OVERHANG = 0.35;
/** Clip only soil overlapping the solid deck, not the riverbed beneath its arches.
 * A heightfield cannot describe both a buried abutment and a deck at the same XZ.
 * Deck collision already takes precedence here through wildsGroundHeight(). */
export function fitWildsBridgeTerrain(material: T.MeshStandardMaterial) {
  const centers = WILDS_BRIDGES.map(
    (b) => new T.Vector4(b.x, b.z, b.height, b.length / 2),
  );
  const axes = WILDS_BRIDGES.map(
    (b) =>
      new T.Vector4(
        b.axis.x,
        b.axis.z,
        b.width / 2 + DECK_OVERHANG - 0.08,
        0.8,
      ),
  );
  const compile = material.onBeforeCompile.bind(material),
    cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile(shader, renderer);
    shader.uniforms.uBridgeDeckCenters = { value: centers };
    shader.uniforms.uBridgeDeckAxes = { value: axes };
    shader.fragmentShader =
      `uniform vec4 uBridgeDeckCenters[${centers.length}];
      uniform vec4 uBridgeDeckAxes[${axes.length}];\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      for(int i=0;i<${centers.length};i++) {
        vec4 deck=uBridgeDeckCenters[i], axis=uBridgeDeckAxes[i];
        vec2 delta=vForestPosition.xz-deck.xy;
        if(abs(dot(delta,axis.xy))<deck.w &&
          abs(dot(delta,vec2(-axis.y,axis.x)))<axis.z &&
          vForestPosition.y>deck.z-axis.w) discard;
      }
      #include <map_fragment>`,
    );
  };
  material.customProgramCacheKey = () => cacheKey + '/fitted-bridge-decks-v1';
  material.needsUpdate = true;
}

/** 44 triangles with rounded vertex normals, instead of subdividing flat faces. */
function bevelledBox(
  w: number,
  h: number,
  d: number,
  _segments: number,
  radius: number,
) {
  const half = [w / 2, h / 2, d / 2],
    r = Math.min(radius, ...half.map((n) => n * 0.45));
  const inner = half.map((n) => n - r),
    positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [];
  const polygon = (points: number[][]) => {
    const a = new T.Vector3(...points[0]),
      b = new T.Vector3(...points[1]),
      c = new T.Vector3(...points[2]);
    const normal = b.sub(a).cross(c.sub(a));
    const center = points
      .reduce((sum, p) => sum.add(new T.Vector3(...p)), new T.Vector3())
      .multiplyScalar(1 / points.length);
    if (normal.dot(center) < 0) points.reverse();
    const axis =
      Math.abs(normal.x) > Math.abs(normal.y) &&
      Math.abs(normal.x) > Math.abs(normal.z)
        ? 0
        : Math.abs(normal.y) > Math.abs(normal.z)
          ? 1
          : 2;
    for (let i = 1; i < points.length - 1; i++)
      for (const p of [points[0], points[i], points[i + 1]]) {
        positions.push(...p);
        const n = new T.Vector3(
          ...p.map((v, j) => v - Math.max(-inner[j], Math.min(inner[j], v))),
        ).normalize();
        normals.push(n.x, n.y, n.z);
        const u = axis === 0 ? 2 : 0,
          v = axis === 1 ? 2 : 1;
        uv.push(p[u] / (2 * half[u]) + 0.5, p[v] / (2 * half[v]) + 0.5);
      }
  };
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const a = (axis + 1) % 3,
        b = (axis + 2) % 3;
      polygon(
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) => {
          const p = [0, 0, 0];
          p[axis] = sign * half[axis];
          p[a] = u * inner[a];
          p[b] = v * inner[b];
          return p;
        }),
      );
    }
  for (let free = 0; free < 3; free++)
    for (const sa of [-1, 1])
      for (const sb of [-1, 1]) {
        const a = (free + 1) % 3,
          b = (free + 2) % 3;
        polygon(
          [
            [-1, 0],
            [1, 0],
            [1, 1],
            [-1, 1],
          ].map(([s, t]) => {
            const p = [0, 0, 0];
            p[free] = s * inner[free];
            p[a] = sa * (t ? inner[a] : half[a]);
            p[b] = sb * (t ? half[b] : inner[b]);
            return p;
          }),
        );
      }
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const signs = [x, y, z];
        polygon(
          [0, 1, 2].map((axis) =>
            half.map((n, j) => signs[j] * (axis === j ? n : inner[j])),
          ),
        );
      }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return g;
}

function bakeBridgeMasonry() {
  const size = 512,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 64),
        sx = (x + (row % 2) * 64) % size,
        column = Math.floor(sx / 128);
      const edge = Math.min(sx % 128, 127 - (sx % 128), y % 64, 63 - (y % 64));
      const mottling =
        Math.sin(x * 0.27 + Math.sin(y * 0.23)) * 4 +
        Math.sin(x * 0.083 + y * 0.12) * 5;
      const stone = 150 + 18 * Math.sin(row * 3.7 + column * 9.3) + mottling;
      const value = edge < 2 ? 84 : edge < 4 ? stone - 13 : stone;
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value + 2;
      data[i + 2] = value - 4;
      data[i + 3] = 255;
    }
  const t = new T.DataTexture(data, size, size, T.RGBAFormat);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  t.name = 'Baked bridge masonry';
  return t;
}

/** Locally authored bridge kit: bevelled timbers, stone vaults and fitted piers.
 * Every crossing still uses the same flat walkable deck and layout orientation. */
export function createWildsBridges(
  woodSource: T.MeshStandardMaterial,
  stoneSource: T.MeshStandardMaterial,
) {
  const root = new T.Group();
  root.name = 'Crafted Wilds bridges';
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [],
    colliders: T.Mesh[] = [];
  const wood = woodSource.clone(),
    stone = stoneSource.clone();
  const masonry = bakeBridgeMasonry();
  stone.map = masonry;
  stone.bumpMap = masonry;
  stone.bumpScale = 0.06;
  wood.color.set('#b49a76');
  wood.emissive.set('#21170c');
  wood.emissiveIntensity = 0.16;
  stone.color.set('#d5d3ca');
  stone.emissive.set('#263238');
  stone.emissiveIntensity = 0.12;
  const iron = new T.MeshStandardMaterial({
    color: '#33434b',
    metalness: 0.55,
    roughness: 0.56,
  });
  const lamp = new T.MeshStandardMaterial({
    color: '#dcc18a',
    emissive: '#b99148',
    emissiveIntensity: 0.45,
    roughness: 0.65,
  });
  const palette = [wood, stone, iron, lamp];
  palette.forEach((m) => {
    m.vertexColors = true;
    materials.push(m);
  });
  for (const [id, b] of WILDS_BRIDGES.entries()) {
    const group = new T.Group();
    group.name = `Crafted ${b.kind} bridge ${id + 1}`;
    group.position.set(b.x, b.height, b.z);
    group.rotation.y = -Math.atan2(b.axis.z, b.axis.x);
    root.add(group);
    const buckets: T.BufferGeometry[][] = palette.map(() => []);
    const dummy = new T.Object3D();
    let part = 0;
    const add = (
      g: T.BufferGeometry,
      material: number,
      x: number,
      y: number,
      z: number,
      rotation?: T.Quaternion,
    ) => {
      const geo = g.index ? g.toNonIndexed() : g;
      if (geo !== g) g.dispose();
      dummy.position.set(x, y, z);
      dummy.scale.set(1, 1, 1);
      dummy.quaternion.copy(rotation ?? new T.Quaternion());
      dummy.updateMatrix();
      geo.applyMatrix4(dummy.matrix);
      if (material === 1) {
        const pos = geo.getAttribute('position'),
          normal = geo.getAttribute('normal'),
          uv = geo.getAttribute('uv');
        for (let i = 0; i < pos.count; i++) {
          const nx = Math.abs(normal.getX(i)),
            ny = Math.abs(normal.getY(i)),
            nz = Math.abs(normal.getZ(i));
          uv.setXY(
            i,
            (ny > nx && ny > nz
              ? pos.getX(i)
              : nx > nz
                ? pos.getZ(i)
                : pos.getX(i)) / 8,
            (ny > nx && ny > nz ? pos.getZ(i) : pos.getY(i)) / 8,
          );
        }
      }
      const color = new T.Color().setScalar(
        0.83 + 0.17 * (0.5 + 0.5 * Math.sin(++part * 7.13)),
      );
      const colors = new Float32Array(geo.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      geo.setAttribute('color', new T.BufferAttribute(colors, 3));
      buckets[material].push(geo);
    };
    const box = (
      w: number,
      h: number,
      d: number,
      m: number,
      x: number,
      y: number,
      z: number,
      bevel = 0.06,
    ) =>
      add(
        bevelledBox(w, h, d, 1, Math.min(bevel, w / 4, h / 4, d / 4)),
        m,
        x,
        y,
        z,
      );
    const beam = (
      a: T.Vector3,
      end: T.Vector3,
      thickness: number,
      m: number,
    ) => {
      const delta = end.clone().sub(a),
        center = a.clone().add(end).multiplyScalar(0.5);
      add(
        bevelledBox(thickness, delta.length(), thickness, 1, 0.04),
        m,
        center.x,
        center.y,
        center.z,
        new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          delta.normalize(),
        ),
      );
    };
    const m = b.kind === 'wood' ? 0 : 1,
      width = b.width + DECK_OVERHANG * 2;
    // A continuous lower slab closes the tiny joints between individually bevelled boards/pavers.
    box(b.length, 0.45, width, m, 0, -0.48, 0, 0.09);
    if (b.kind === 'wood') {
      const count = Math.ceil(b.length / 1.15),
        pitch = b.length / count;
      for (let i = 0; i < count; i++)
        box(
          pitch - 0.035,
          0.28,
          width,
          m,
          -b.length / 2 + (i + 0.5) * pitch,
          -0.14,
          0,
          0.045,
        );
      for (const side of [-1, 1])
        box(b.length, 0.7, 0.6, 0, 0, -0.75, side * 3.7, 0.1);
    } else {
      const count = Math.ceil(b.length / 2.6),
        pitch = b.length / count;
      for (let i = 0; i < count; i++)
        for (let j = 0; j < 3; j++)
          box(
            pitch - 0.035,
            0.28,
            width / 3 - 0.035,
            1,
            -b.length / 2 + (i + 0.5) * pitch,
            -0.14,
            ((j - 1) * width) / 3,
            0.06,
          );
    }
    const spanCount = b.kind === 'wood' ? 3 : Math.ceil(b.length / 26),
      span = b.length / spanCount;
    const waterGap = b.height - wildsWater(b).height;
    if (b.kind === 'stone') {
      const low = -Math.max(7, waterGap + 2),
        rise = Math.min(8, -low - 2.2);
      for (let i = 0; i < spanCount; i++) {
        const shape = new T.Shape(),
          half = span / 2 - 1.1;
        shape.moveTo(-half, -0.6);
        shape.lineTo(half, -0.6);
        shape.lineTo(half, low);
        for (let j = 1; j <= 24; j++) {
          const a = (j / 24) * Math.PI;
          shape.lineTo(half * Math.cos(a), low + rise * Math.sin(a));
        }
        shape.closePath();
        const g = new T.ExtrudeGeometry(shape, {
          depth: width - 0.8,
          steps: 1,
          bevelEnabled: true,
          bevelSegments: 1,
          bevelSize: 0.08,
          bevelThickness: 0.08,
          curveSegments: 24,
        });
        add(g, 1, -b.length / 2 + (i + 0.5) * span, 0, -(width - 0.8) / 2);
        // Individually cut arch stones read clearly from either bank.
        for (const side of [-1, 1])
          for (let j = 0; j < 15; j++) {
            const a = ((j + 0.5) / 15) * Math.PI,
              x = half * Math.cos(a),
              y = low + rise * Math.sin(a);
            const q = new T.Quaternion().setFromAxisAngle(
              new T.Vector3(0, 0, 1),
              Math.atan2(rise * Math.cos(a), -half * Math.sin(a)),
            );
            add(
              bevelledBox(span / 15 + 0.08, 0.48, 0.24, 1, 0.04),
              1,
              -b.length / 2 + (i + 0.5) * span + x,
              y + 0.15,
              (side * (width - 0.8)) / 2,
              q,
            );
          }
      }
    }
    for (let i = 0; i <= spanCount; i++) {
      const along = -b.length / 2 + i * span;
      for (const side of [-1, 1]) {
        const across = side * (b.kind === 'wood' ? 3.8 : 3.7);
        const wx = b.x + b.axis.x * along - b.axis.z * across,
          wz = b.z + b.axis.z * along + b.axis.x * across;
        // Bank-side foundations can be shallow, but their heads must always
        // remain beneath the floor rather than protruding through its pavers.
        const bottom = Math.min(
            wildsTerrainHeight(wx, wz) - b.height - 0.8,
            -1.1,
          ),
          height = -0.65 - bottom;
        box(
          b.kind === 'wood' ? 0.8 : 2.3,
          height,
          b.kind === 'wood' ? 0.8 : 2.3,
          m,
          along,
          bottom + height / 2,
          across,
          0.1,
        );
        if (b.kind === 'wood') {
          box(1, 0.22, 1, 2, along, -1, across, 0.05);
          if (i < spanCount)
            beam(
              new T.Vector3(
                along,
                Math.min(-0.85, Math.max(bottom + 1, -4)),
                across,
              ),
              new T.Vector3(along + span * 0.48, -0.65, across),
              0.3,
              0,
            );
        }
      }
      box(
        b.kind === 'wood' ? 1.1 : 2.7,
        0.65,
        width - 0.2,
        m,
        along,
        -1,
        0,
        0.12,
      );
    }
    const railSegments = Math.ceil(b.length / 5),
      railPitch = b.length / railSegments;
    for (const side of [-1, 1]) {
      const z = side * (b.width / 2 + 0.35);
      box(b.length, 0.23, b.kind === 'wood' ? 0.3 : 0.55, m, 0, 1.65, z, 0.07);
      box(b.length, 0.18, 0.22, m, 0, 0.55, z, 0.05);
      for (let i = 0; i <= railSegments; i++) {
        const x = -b.length / 2 + i * railPitch;
        box(
          b.kind === 'wood' ? 0.4 : 0.6,
          1.7,
          b.kind === 'wood' ? 0.4 : 0.6,
          m,
          x,
          0.85,
          z,
          0.07,
        );
        box(0.68, 0.18, 0.68, m, x, 1.77, z, 0.06);
        if (b.kind === 'wood') {
          box(0.46, 0.13, 0.46, 2, x, 0.28, z, 0.025);
          if (i < railSegments)
            beam(
              new T.Vector3(x + 0.15, 0.58, z),
              new T.Vector3(x + railPitch - 0.15, 1.5, z),
              0.15,
              0,
            );
        } else if (i < railSegments) {
          for (const t of [0.33, 0.67])
            box(0.18, 1, 0.2, 1, x + t * railPitch, 1.05, z, 0.045);
        }
        if (i === 0 || i === railSegments) {
          box(0.62, 0.75, 0.62, 2, x, 2.2, z, 0.07);
          box(0.42, 0.46, 0.42, 3, x, 2.2, z, 0.05);
          add(new T.ConeGeometry(0.53, 0.35, 4), m, x, 2.73, z);
        }
      }
    }
    buckets.forEach((parts, i) => {
      if (!parts.length) return;
      const g = mergeGeometries(parts)!;
      parts.forEach((p) => p.dispose());
      geometries.push(g);
      const mesh = new T.Mesh(g, palette[i]);
      mesh.name = `Bridge ${id + 1} ${['timber', 'masonry', 'ironwork', 'lantern glass'][i]}`;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    });
    const deck = new T.BoxGeometry(b.length, 0.5, b.width);
    geometries.push(deck);
    const collider = new T.Mesh(deck, palette[m]);
    collider.position.set(b.x, b.height - 0.25, b.z);
    collider.rotation.copy(group.rotation);
    collider.name = 'Walkable bridge deck';
    collider.visible = false;
    collider.userData.bridge = true;
    colliders.push(collider);
  }
  return { root, geometries, materials, textures: [masonry], colliders };
}

/** Small overhead deck/rail symbol, oriented and scaled from the actual crossing. */
export function drawWildsMinimapBridges(
  ctx: CanvasRenderingContext2D,
  size: number,
) {
  for (const b of WILDS_BRIDGES) {
    const length = (b.length * size) / 1000,
      width = Math.max(3.4, (b.width * size) / 1000);
    ctx.save();
    ctx.translate(((b.x + 500) * size) / 1000, ((b.z + 500) * size) / 1000);
    ctx.rotate(Math.atan2(b.axis.z, b.axis.x));
    ctx.fillStyle = '#17282d';
    ctx.fillRect(-length / 2 - 1, -width / 2 - 1, length + 2, width + 2);
    ctx.fillStyle = b.kind === 'stone' ? '#ddd3b5' : '#c09b64';
    ctx.fillRect(-length / 2, -width / 2, length, width);
    ctx.strokeStyle = '#685746';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = -length / 2 + 2; x < length / 2; x += 3) {
      ctx.moveTo(x, -width / 2);
      ctx.lineTo(x, width / 2);
    }
    ctx.stroke();
    ctx.strokeStyle = '#f3e5c2';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-length / 2, -width / 2);
    ctx.lineTo(length / 2, -width / 2);
    ctx.moveTo(-length / 2, width / 2);
    ctx.lineTo(length / 2, width / 2);
    ctx.stroke();
    ctx.restore();
  }
}
