import * as T from 'three';
import { WILDS_NIGHT } from './whispering-wilds-sky.ts';
import { buildWildsWaterGeometry } from './whispering-wilds-water.ts';
import {
  wildsRawHeight,
  WILDS_NORTH_SEA_LEVEL,
  WILDS_SOUTH_SEA_LEVEL,
} from './whispering-wilds-layout.ts';

/** Non-playable continuation beyond the authoritative 1000-unit heightfield.
 * The shared height function joins the border exactly; southern slopes end in sea. */
export function createWildsBoundary(
  terrain: T.Material,
  normalMap: T.Texture,
  riverMaterial: T.Material,
) {
  const root = new T.Group();
  root.name = 'Boundary hills, upper northern sea and southern sea';
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [];
  // Four sectors allow ordinary frustum culling of the surrounding landscape.
  for (let side = 0; side < 4; side++) {
    const positions: number[] = [],
      uv: number[] = [],
      masks: number[] = [],
      indices: number[] = [];
    const rings = side === 2 ? 96 : 24;
    for (let ring = 0; ring <= rings; ring++)
      for (let i = 0; i <= 512; i++) {
        const span = 500 + ((ring * 24) / rings) ** 2 * 1.05,
          a = -span + (2 * span * i) / 512;
        const x = side === 0 ? a : side === 1 ? span : side === 2 ? -a : -span;
        const z = side === 0 ? -span : side === 1 ? a : side === 2 ? span : -a;
        positions.push(x, wildsRawHeight(x, z), z);
        uv.push(x / 12, z / 12);
        masks.push(0, 0);
        if (ring < rings && i < 512) {
          const n = ring * 513 + i;
          indices.push(n, n + 1, n + 513, n + 1, n + 514, n + 513);
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('forestMask', new T.Float32BufferAttribute(masks, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    // Consistent central-difference normals on the join, sector seams and slopes.
    const normals: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i],
        z = positions[i + 2],
        n = new T.Vector3(
          wildsRawHeight(x - 1, z) - wildsRawHeight(x + 1, z),
          2,
          wildsRawHeight(x, z - 1) - wildsRawHeight(x, z + 1),
        ).normalize();
      normals.push(n.x, n.y, n.z);
    }
    g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    g.computeBoundingSphere();
    geometries.push(g);
    const mesh = new T.Mesh(g, terrain);
    mesh.name = 'Boundary hills ' + side;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (side === 2) {
      // Clip the continuation against these exact scenery triangles, including
      // the shared z=500 edge. Navigation remains inside the original map.
      const riverGeo = buildWildsWaterGeometry(g);
      geometries.push(riverGeo);
      const river = new T.Mesh(riverGeo, riverMaterial);
      river.name = 'Southern river continuation beyond G';
      root.add(river);
    }
  }
  const seaMat = new T.MeshStandardMaterial({
    color: '#123347',
    emissive: '#081925',
    emissiveIntensity: 0.4,
    roughness: 0.35,
    metalness: 0.05,
    fog: false,
    normalMap,
    normalScale: new T.Vector2(0.2, 0.2),
  });
  const time = { value: 0 };
  seaMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSeaTime = time;
    shader.uniforms.uSeaHorizon = { value: new T.Color(WILDS_NIGHT.horizon) };
    shader.vertexShader = 'varying vec3 vSeaPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSeaPosition=position;',
    );
    shader.fragmentShader =
      'varying vec3 vSeaPosition;uniform float uSeaTime;uniform vec3 uSeaHorizon;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec2 p=vSeaPosition.xz;
      float wave=sin(p.x*.17+p.y*.29-uSeaTime*.75+sin(p.x*.07-p.y*.09)*1.5);
      float wave2=sin(p.x*.09-p.y*.23+uSeaTime*.4);
      float crest=pow(max(0.,wave*.65+wave2*.35),5.);
      float nearSea=1.-smoothstep(250.,1800.,length(vViewPosition));
      totalEmissiveRadiance+=vec3(.008,.020,.030)*crest*nearSea;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `outgoingLight=mix(outgoingLight,uSeaHorizon,smoothstep(250.,1400.,length(vViewPosition)));
      #include <opaque_fragment>`,
    );
  };
  seaMat.customProgramCacheKey = () => 'wilds-open-sea-v1';
  materials.push(seaMat);
  const seaGeo = new T.PlaneGeometry(10000, 10000);
  seaGeo.rotateX(-Math.PI / 2);
  const uv = seaGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) * 400, uv.getY(i) * 400);
  geometries.push(seaGeo);
  const sea = new T.Mesh(seaGeo, seaMat);
  sea.name = 'Open southern sea';
  sea.position.y = WILDS_SOUTH_SEA_LEVEL;
  root.add(sea);
  // The northern sea is an elevated fantasy basin behind the upland ridge.
  // Its southern edge meets the main channel exactly at the terrain boundary.
  // Hills occlude it everywhere else, leaving one spillway to the waterfalls.
  const northGeo = new T.PlaneGeometry(10000, 4500);
  northGeo.rotateX(-Math.PI / 2);
  northGeo.translate(0, 0, -2750);
  const northUv = northGeo.getAttribute('uv'),
    northPositions = northGeo.getAttribute('position');
  for (let i = 0; i < northUv.count; i++)
    northUv.setXY(i, northPositions.getX(i) / 18, northPositions.getZ(i) / 18);
  const count = northGeo.getAttribute('position').count;
  northGeo.setAttribute(
    'waterDepth',
    new T.Float32BufferAttribute(new Float32Array(count).fill(3), 1),
  );
  northGeo.setAttribute(
    'waterFlow',
    new T.Float32BufferAttribute(new Float32Array(count), 1),
  );
  geometries.push(northGeo);
  const northSea = new T.Mesh(northGeo, riverMaterial);
  northSea.name = 'Northern source sea';
  northSea.position.set(0, WILDS_NORTH_SEA_LEVEL, 0);
  root.add(northSea);
  return {
    root,
    geometries,
    materials,
    update: (seconds: number) => {
      time.value = seconds;
    },
  };
}
