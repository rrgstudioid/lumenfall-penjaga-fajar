import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ARUNIKA_GRASS = {
  id: 'terrain.arunika.grass_medium_01', source: 'grass_medium_01_4k.blend.zip',
  tileSize: 4.8, normalStrength: .32, tuftNormalStrength: .38,
} as const;
const ROOT = '/assets/materials/terrain/arunika/grass-medium-01/';
const FILES = ['grass_ground_color_2k.webp', 'grass_ground_normal_rough_1k.webp',
  'grass_tuft_color_alpha_2k.webp', 'grass_tuft_normal_rough_1k.webp'];
let pending: Promise<T.Texture[]> | undefined;

/** Ground and instanced tufts share the same loaded source textures across visits. */
export function loadArunikaGrassTextures() {
  if (pending) return pending;
  const loader = new T.TextureLoader();
  pending = Promise.allSettled(FILES.map(async (file, index) => {
    const texture = await loader.loadAsync(ROOT+file);
    texture.name = file;
    texture.colorSpace = index % 2 === 0 ? T.SRGBColorSpace : T.NoColorSpace;
    texture.wrapS = texture.wrapT = index < 2 ? T.RepeatWrapping : T.ClampToEdgeWrapping;
    texture.anisotropy = 4; texture.flipY = true;
    // Normal/roughness data is RGBA: alpha is roughness, never transparency.
    texture.premultiplyAlpha = false;
    return texture;
  })).then(results => {
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
      throw failed.reason;
    }
    return results.map(result => (result as PromiseFulfilledResult<T.Texture>).value);
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}

/** Three crossing source-atlas cards, fitted within the old grass's .44 x .7 footprint. */
export function createArunikaTuftGeometry() {
  const pieces: T.BufferGeometry[] = [];
  const cards = [[435,1550,530,300],[1170,1555,480,230],[0,1790,410,215]];
  for (let i=0; i<3; i++) {
    const [x,y,w,h] = cards[i], plane = new T.PlaneGeometry(.44,.7,1,1), uv = plane.getAttribute('uv');
    for (let j=0; j<uv.count; j++) uv.setXY(j, (x+uv.getX(j)*w)/2048, 1-(y+(1-uv.getY(j))*h)/2048);
    plane.rotateY(i*Math.PI/3); pieces.push(plane);
  }
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

export async function enhanceArunikaGrassTufts(grass: T.InstancedMesh) {
  const previous = grass.material as T.MeshStandardMaterial;
  let disposed = false;
  const onDispose = () => { disposed = true; };
  previous.addEventListener('dispose', onDispose);
  let textures: T.Texture[];
  try { textures = await loadArunikaGrassTextures(); }
  finally { previous.removeEventListener('dispose', onDispose); }
  if (disposed || grass.material !== previous) return;
  const material = new T.MeshStandardMaterial({ map: textures[2], normalMap: textures[3],
    normalScale: new T.Vector2(ARUNIKA_GRASS.tuftNormalStrength, ARUNIKA_GRASS.tuftNormalStrength),
    roughness: .95, metalness: 0, side: T.DoubleSide, alphaTest: .42, transparent: false });
  material.name = 'foliage.arunika.grass_medium_01';
  material.userData.grassSource = ARUNIKA_GRASS.source;
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = 0.78 + 0.20 * texture2D(normalMap, vNormalMapUv).a;')
      // Broad blade/card normals otherwise shade the entire thin tuft like a dark wall.
      // Bias toward sky lighting while retaining the source normal details and shadows.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 grassSkyNormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        normal = normalize(mix(normal, grassSkyNormal, 0.70));
      `);
  };
  material.customProgramCacheKey = () => 'arunika-grass-tuft-v1';
  const oldGeometry = grass.geometry;
  grass.geometry = createArunikaTuftGeometry();
  grass.material = material;
  grass.receiveShadow = true;
  grass.userData.grassMaterialId = ARUNIKA_GRASS.id;
  grass.computeBoundingSphere();
  oldGeometry.dispose(); previous.dispose();
}
