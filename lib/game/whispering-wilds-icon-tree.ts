import * as T from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';
import {
  WILDS_LAKE_ISLAND,
  wildsHeightfield,
  wildsTerrainHeight,
} from './whispering-wilds-layout.ts';
import type { WildsQuality } from './whispering-wilds-quality.ts';

/** Small deterministic leaf atlas baked in memory; no downloaded tree textures. */
function bakeElderLeaves() {
  const size = 512,
    data = new Uint8Array(size * size * 4);
  let seed = 4096;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 34;
    data[i + 1] = 48;
    data[i + 2] = 27;
    data[i + 3] = 255;
  }
  for (let leaf = 0; leaf < 3400; leaf++) {
    const cx = random() * size,
      cy = random() * size,
      angle = random() * 6.28,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const length = 4 + random() * 9,
      width = length * 0.43,
      light = 0.7 + random() * 0.6;
    for (let dy = -15; dy <= 15; dy++)
      for (let dx = -15; dx <= 15; dx++) {
        const u = dx * c + dy * s,
          v = -dx * s + dy * c;
        if (
          Math.abs(u) >= length ||
          Math.abs(v) > width * Math.pow(1 - Math.abs(u) / length, 0.68)
        )
          continue;
        const shade =
          light * (v > 0 ? 1 : 0.72) * (Math.abs(v) < 0.45 ? 1.25 : 1);
        const x = (Math.floor(cx + dx) + size) % size,
          y = (Math.floor(cy + dy) + size) % size,
          i = (y * size + x) * 4;
        data[i] = Math.min(255, 130 * shade);
        data[i + 1] = Math.min(255, 153 * shade);
        data[i + 2] = Math.min(255, 93 * shade);
      }
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.name = 'Baked elder leaf atlas';
  return texture;
}

/** One deterministic, map-owned landmark. No imported forest or alpha layers. */
export function createWildsIconTree() {
  const root = new T.Group();
  root.name = 'Spirit Lake elder tree';
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [];
  let seed = 91273;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const barkParts: T.BufferGeometry[] = [];
  const branch = (
    points: number[][],
    radius: number,
    tip: number,
    segments = 22,
  ) => {
    const curve = new T.CatmullRomCurve3(
      points.map((p) => new T.Vector3(...p)),
    );
    const g = new T.TubeGeometry(curve, segments, 1, 9, false);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const t = Math.floor(i / 10) / segments,
        center = curve.getPointAt(t);
      const r =
        (radius * (1 - t) ** 1.25 + tip * t) *
        (1 + 0.075 * Math.cos((i % 10) * Math.PI * 1.2 + t * 5));
      pos.setXYZ(
        i,
        center.x + (pos.getX(i) - center.x) * r,
        center.y + (pos.getY(i) - center.y) * r,
        center.z + (pos.getZ(i) - center.z) * r,
      );
    }
    g.computeVertexNormals();
    barkParts.push(g);
  };
  const trunkPoints = [
    [0, -1, 0],
    [-2, 18, 1],
    [3, 35, -2],
    [-1, 52, 1],
    [3, 72, 2],
    [0, 94, 0],
  ];
  branch(trunkPoints, 8, 0.9, 38);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10 + random() * 0.15,
      c = Math.cos(a),
      s = Math.sin(a);
    branch(
      [
        [c * 2, 13, s * 2],
        [c * 7, 4, s * 7],
        [c * 12, 1.1, s * 12],
        [c * 18, -0.65, s * 18],
      ],
      3.2,
      0.12,
      15,
    );
  }
  const lobes: Array<{ center: T.Vector3; radius: T.Vector3 }> = [];
  for (let i = 0; i < 13; i++) {
    const a = i * 2.39996,
      c = Math.cos(a),
      s = Math.sin(a);
    const reach = 29 + random() * 17,
      y = 65 + (i % 3) * 12;
    const tip = new T.Vector3(c * reach, y + 12, s * reach);
    branch(
      [
        [0, 29 + i * 2.7, 0],
        [c * 11, y - 22, s * 11],
        [c * reach * 0.72, y - 2, s * reach * 0.72],
        tip.toArray(),
      ],
      3.8 - (i % 3) * 0.4,
      0.35,
      24,
    );
    for (let j = 0; j < 3; j++) {
      const side = a + (j - 1) * 0.72;
      const end = tip
        .clone()
        .add(
          new T.Vector3(
            Math.cos(side) * (5 + random() * 9),
            j * 3 + 3,
            Math.sin(side) * (5 + random() * 9),
          ),
        );
      branch(
        [
          [tip.x * 0.72, tip.y - 11, tip.z * 0.72],
          tip.toArray(),
          end.toArray(),
        ],
        1.25,
        0.09,
        12,
      );
      lobes.push({
        center: end,
        radius: new T.Vector3(
          10 + random() * 5,
          8 + random() * 5,
          10 + random() * 5,
        ),
      });
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 2.39996;
    lobes.push({
      center: new T.Vector3(
        Math.cos(a) * 12,
        103 + (i % 2) * 5,
        Math.sin(a) * 12,
      ),
      radius: new T.Vector3(14, 14, 14),
    });
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 2.39996;
    lobes.push({
      center: new T.Vector3(
        Math.cos(a) * 19,
        83 + (i % 2) * 7,
        Math.sin(a) * 19,
      ),
      radius: new T.Vector3(19, 16, 19),
    });
  }
  const barkGeo = mergeGeometries(barkParts)!;
  barkParts.forEach((g) => g.dispose());
  geometries.push(barkGeo);
  const bark = new T.MeshStandardMaterial({
    color: '#665849',
    roughness: 0.96,
  });
  bark.onBeforeCompile = (s) => {
    s.vertexShader =
      'varying vec2 vBarkUv; varying vec3 vBarkPosition;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvBarkUv=uv;vBarkPosition=position;',
    );
    s.fragmentShader =
      'varying vec2 vBarkUv; varying vec3 vBarkPosition;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float grain=sin(vBarkUv.x*120.+sin(vBarkUv.y*31.)*.9)+.4*sin(vBarkUv.x*281.+vBarkUv.y*12.);
      diffuseColor.rgb*=.76+.24*smoothstep(-.75,.8,grain);`,
    );
    s.fragmentShader = s.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float hue=vBarkPosition.y*.026+atan(vBarkPosition.z,vBarkPosition.x)*.045;
      vec3 rainbow=clamp(abs(fract(vec3(hue)+vec3(0.,.666667,.333333))*6.-3.)-1.,0.,1.);
      rainbow=mix(rainbow,vec3(1.),.06);
      float vein=pow(.5+.5*sin(vBarkUv.y*56.5487+sin(vBarkUv.x*24.)*.7),14.);
      float trunkMask=1.-smoothstep(9.,17.,length(vBarkPosition.xz));
      totalEmissiveRadiance+=rainbow*(.035+vein*1.15)*trunkMask;`,
    );
  };
  bark.customProgramCacheKey = () => 'wilds-elder-rainbow-bark-v2';
  const trunk = new T.Mesh(barkGeo, bark);
  trunk.name = 'Fluted trunk, buttress roots and spreading branches';
  trunk.castShadow = trunk.receiveShadow = true;
  root.add(trunk);
  const leafAtlas = bakeElderLeaves();
  const foliage = new T.MeshStandardMaterial({
    color: '#bac49e',
    roughness: 0.95,
    vertexColors: true,
    side: T.DoubleSide,
  });
  const coreMat = new T.MeshStandardMaterial({
    color: '#c1c9ac',
    map: leafAtlas,
    bumpMap: leafAtlas,
    bumpScale: 0.18,
    roughness: 1,
    vertexColors: true,
  });
  materials.push(bark, foliage, coreMat);
  let coreGeo: T.BufferGeometry = new T.IcosahedronGeometry(1, 3);
  const cp = coreGeo.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      y = cp.getY(i),
      z = cp.getZ(i);
    const noise = 1 + 0.11 * Math.sin(x * 9 + z * 7) * Math.cos(y * 13 - z * 3);
    cp.setXYZ(i, x * noise, y * noise, z * noise);
    const c = new T.Color().setScalar(0.8 + (0.2 * (y + 1)) / 2);
    colors.push(c.r, c.g, c.b);
  }
  coreGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const smoothCore = mergeVertices(coreGeo);
  coreGeo.dispose();
  coreGeo = smoothCore;
  coreGeo.computeVertexNormals();
  geometries.push(coreGeo);
  const cores = new T.InstancedMesh(coreGeo, coreMat, lobes.length),
    dummy = new T.Object3D();
  lobes.forEach((l, i) => {
    dummy.position.copy(l.center);
    dummy.scale.copy(l.radius).multiplyScalar(0.86);
    dummy.rotation.set(0, i * 1.71, 0.13 * Math.sin(i));
    dummy.updateMatrix();
    cores.setMatrixAt(i, dummy.matrix);
  });
  cores.castShadow = cores.receiveShadow = true;
  cores.name = 'Dense layered elder crown';
  root.add(cores);
  // Ten curved leaves in each spray, reused for the entire crown (no alpha test).
  const leafPos: number[] = [],
    leafColors: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.39996,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const ox = c * (i % 3) * 0.6,
      oz = s * (i % 3) * 0.6,
      oy = (random() - 0.5) * 1.9;
    const len = 1.4 + random() * 0.8,
      w = len * 0.43;
    const verts = [
      [0, 0.18, 0],
      [-w, 0, 0],
      [0, -0.12, -len],
      [w, 0, 0],
      [0, -0.22, len],
    ];
    const color = new T.Color().setHSL(
      0.24 + random() * 0.08,
      0.22 + random() * 0.14,
      0.22 + random() * 0.12,
    );
    for (const k of [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]) {
      const [x, y, z] = verts[k];
      leafPos.push(ox + x * c - z * s, oy + y, oz + x * s + z * c);
      leafColors.push(color.r, color.g, color.b);
    }
  }
  const leafGeo = new T.BufferGeometry();
  leafGeo.setAttribute('position', new T.Float32BufferAttribute(leafPos, 3));
  leafGeo.setAttribute('color', new T.Float32BufferAttribute(leafColors, 3));
  leafGeo.computeVertexNormals();
  geometries.push(leafGeo);
  const sprays = new T.InstancedMesh(leafGeo, foliage, 2200);
  for (let i = 0; i < 2200; i++) {
    const l = lobes[i % lobes.length],
      theta = random() * Math.PI * 2,
      y = random() * 2 - 1,
      r = Math.sqrt(1 - y * y);
    dummy.position.set(
      l.center.x + Math.cos(theta) * r * l.radius.x,
      l.center.y + y * l.radius.y,
      l.center.z + Math.sin(theta) * r * l.radius.z,
    );
    dummy.scale.setScalar(0.95 + random() * 0.5);
    dummy.rotation.set(random() * 2, random() * 6.28, random() * 2);
    dummy.updateMatrix();
    sprays.setMatrixAt(i, dummy.matrix);
  }
  sprays.name = 'Elder leaf sprays';
  sprays.receiveShadow = true;
  root.add(sprays);
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root),
    heights = wildsHeightfield();
  let northernPeak = -Infinity;
  for (let j = 0; j < 160; j++)
    for (let i = 0; i < 513; i++)
      northernPeak = Math.max(northernPeak, heights[j * 513 + i]);
  const base = wildsTerrainHeight(WILDS_LAKE_ISLAND.x, WILDS_LAKE_ISLAND.z);
  root.scale.setScalar((northernPeak - base) / box.max.y);
  root.position.set(WILDS_LAKE_ISLAND.x, base, WILDS_LAKE_ISLAND.z);
  const setDetail = (quality: WildsQuality, camera?: T.Camera) => {
    const count = { office: 1400, light: 1650, balanced: 1950, high: 2200 }[
      quality
    ];
    sprays.count =
      camera && camera.position.distanceTo(root.position) > 420
        ? Math.min(count, 1000)
        : count;
  };
  return {
    root,
    geometries,
    materials,
    textures: [leafAtlas],
    setDetail,
    metrics: () => ({
      peakElevation: northernPeak,
      height: northernPeak - base,
      leafSprays: sprays.count,
      drawCalls: 3,
      trunkParticles: 0,
      rainbowBark: true,
    }),
  };
}
