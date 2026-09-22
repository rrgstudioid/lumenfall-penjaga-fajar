import * as T from 'three';
import { VERDANT_TERRAIN, type FieldTerrain } from './field-terrain.ts';
import { ARUNIKA_GRASS, loadArunikaGrassTextures } from './arunika-grass-material.ts';
import { ARUNIKA_DIRT_GLSL, ARUNIKA_NOISE_GLSL } from './arunika-surface-materials.ts';

export const ARUNIKA_TERRAIN_MATERIAL = {
  id: 'terrain.arunika.rocky_grass', revision: 4, tileSize: 12, normalStrength: .58,
  baseRoughness: .94, minRockRoughness: .76,
  coverage: { rocky: .281923, road: .056687, transition: .074723, grass: .586667 },
} as const;
const ROOT = '/assets/materials/terrain/arunika/rocky-terrain-02/';
const FILES = ['rocky_terrain_02_diff_2k.jpg', 'rocky_terrain_02_nor_gl_2k_v2.webp', 'rocky_terrain_02_rough_2k_v2.webp', 'arunika_surface_mask_v2.webp'];
let textures: Promise<T.Texture[]> | undefined;

function loadRockyTextures() {
  if (textures) return textures;
  const loader = new T.TextureLoader();
  textures = Promise.allSettled(FILES.map(async (file, i) => {
    const texture = await loader.loadAsync(ROOT + file);
    texture.name = file;
    texture.wrapS = texture.wrapT = i === 3 ? T.ClampToEdgeWrapping : T.RepeatWrapping;
    if (i === 3) { texture.minFilter = texture.magFilter = T.LinearFilter; texture.generateMipmaps = false; }
    texture.anisotropy = 4;
    texture.colorSpace = i === 0 ? T.SRGBColorSpace : T.NoColorSpace;
    // All runtime images have the same top-down row convention, including EXR conversions.
    texture.flipY = true;
    return texture;
  })).then(results => {
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
      throw failure.reason;
    }
    return results.map(result => (result as PromiseFulfilledResult<T.Texture>).value);
  }).catch(error => { textures = undefined; throw error; });
  return textures;
}

/** Only the existing Padang surface material changes. No new mesh, displacement or collider. */
export async function enhancePadangTerrainSurface(surface: T.Mesh, terrain: FieldTerrain = VERDANT_TERRAIN) {
  if (terrain.id !== 'verdant-plains') return surface;
  if (!(surface.material instanceof T.MeshStandardMaterial)) throw new Error('Padang terrain is not a standard material');
  const material = surface.material;
  if (material.userData.terrainMaterialRevision === ARUNIKA_TERRAIN_MATERIAL.revision) return surface;
  let disposed = false;
  const onDispose = () => { disposed = true; };
  material.addEventListener('dispose', onDispose);
  let rockyColor: T.Texture, rockyNormal: T.Texture, rockyRoughness: T.Texture, maskTexture: T.Texture;
  let grassTextures: T.Texture[] | undefined;
  try {
    [rockyColor, rockyNormal, rockyRoughness, maskTexture] = await loadRockyTextures();
    grassTextures = await loadArunikaGrassTextures().catch(error => {
      console.warn('Grass Medium 01 gagal dimuat; material rocky tetap aktif dengan grass dasar.', error);
      return undefined;
    });
  }
  finally { material.removeEventListener('dispose', onDispose); }
  if (disposed || surface.material !== material || material.userData.terrainMaterialRevision === ARUNIKA_TERRAIN_MATERIAL.revision) return surface;
  const minX = Math.min(...terrain.boundary.map(p => p.x)), minZ = Math.min(...terrain.boundary.map(p => p.z));
  const bounds = new T.Vector4(minX, minZ, 1 / (Math.max(...terrain.boundary.map(p => p.x)) - minX),
    1 / (Math.max(...terrain.boundary.map(p => p.z)) - minZ));
  // Continuous shader detail replaces the blocky base map on this material only.
  // Its shared texture remains intact for every other region and the load fallback.
  material.map = null;
  material.normalMap = rockyNormal;
  material.normalScale.setScalar(ARUNIKA_TERRAIN_MATERIAL.normalStrength);
  material.roughnessMap = rockyRoughness;
  material.roughness = ARUNIKA_TERRAIN_MATERIAL.baseRoughness;
  material.metalness = 0;
  material.name = ARUNIKA_TERRAIN_MATERIAL.id;
  const previousCompile = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    Object.assign(shader.uniforms, {
      uRockyColor: { value: rockyColor }, uTerrainMask: { value: maskTexture },
      uTerrainBounds: { value: bounds }, uRockTileSize: { value: ARUNIKA_TERRAIN_MATERIAL.tileSize },
      ...(grassTextures ? { uGrassColor: { value: grassTextures[0] }, uGrassNR: { value: grassTextures[1] },
        uGrassTile: { value: ARUNIKA_GRASS.tileSize }, uGrassStrength: { value: ARUNIKA_GRASS.normalStrength } } : {}),
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vArunikaXZ;')
      // Independent of Three's conditional worldPosition declaration, including without shadows.
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvArunikaXZ = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uRockyColor;
        uniform sampler2D uTerrainMask;
        uniform vec4 uTerrainBounds;
        uniform float uRockTileSize;
        varying vec2 vArunikaXZ;
        ${ARUNIKA_NOISE_GLSL}
        ${ARUNIKA_DIRT_GLSL}
        ${grassTextures ? 'uniform sampler2D uGrassColor; uniform sampler2D uGrassNR; uniform float uGrassTile; uniform float uGrassStrength;' : ''}
        float arunikaNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          vec4 h = fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),
            dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
          return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
        }
      `)
      // The old 64px texture contains obvious 5px square blocks. Replace only its
      // local sampling with continuous, small-scale grass variation; retain vertex colors.
      .replace('#include <map_fragment>', `
        float grassDetail = arunikaNoise(vArunikaXZ * 2.8) * 0.65 + arunikaNoise(vArunikaXZ * 11.0) * 0.35;
        diffuseColor.rgb *= vec3(0.624, 0.701, 0.347) * mix(0.88, 1.10, grassDetail);
      `)
      // Blend AFTER vertex tint: original green must not recolor the rocky material.
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 terrainLayers = texture2D(uTerrainMask, (vArunikaXZ - uTerrainBounds.xy) * uTerrainBounds.zw).rgb;
        float rockyWeight = terrainLayers.r;
        float roadWeight = terrainLayers.g;
        float macro = terrainLayers.b;
        vec2 rockyUv = vArunikaXZ / uRockTileSize;
        vec2 rockyUvB = rockyUv + vec2(0.37, 0.61);
        float variation = smoothstep(0.25, 0.75, macro) * 0.35;
        vec3 rockyAlbedo = mix(texture2D(uRockyColor, rockyUv).rgb, texture2D(uRockyColor, rockyUvB).rgb, variation);
        rockyAlbedo *= mix(0.92, 1.16, macro);
        diffuseColor.rgb *= mix(0.86, 1.10, macro);
        ${grassTextures ? `
          vec2 grassUv = vArunikaXZ / uGrassTile;
          vec3 grassAlbedo = texture2D(uGrassColor, grassUv).rgb;
          vec4 grassNR = texture2D(uGrassNR, grassUv);
          // Source grass color replaces only the former green base, without the old vertex tint.
          diffuseColor.rgb = grassAlbedo * mix(0.94, 1.10, macro);
        ` : ''}
        float roadHeight, roadRoughness;
        vec3 roadAlbedo = arunikaDirt(vArunikaXZ, roadHeight, roadRoughness);
        diffuseColor.rgb = mix(diffuseColor.rgb, roadAlbedo, roadWeight);
        diffuseColor.rgb = mix(diffuseColor.rgb, rockyAlbedo, rockyWeight);
      `)
      .replace('#include <roughnessmap_fragment>', `
        float rockyRoughness = mix(texture2D(roughnessMap, rockyUv).r, texture2D(roughnessMap, rockyUvB).r, variation);
        float roughnessFactor = mix(mix(roughness, roadRoughness, roadWeight), 0.76 + 0.22 * rockyRoughness, rockyWeight);
        ${grassTextures ? 'roughnessFactor = mix(mix(0.78 + 0.20 * grassNR.a, roadRoughness, roadWeight), 0.76 + 0.22 * rockyRoughness, rockyWeight);' : ''}
      `)
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 rockyNormal = mix(texture2D(normalMap, rockyUv).xyz, texture2D(normalMap, rockyUvB).xyz, variation) * 2.0 - 1.0;
          rockyNormal.xy *= normalScale;
          vec3 baseNormal = vec3(0.0, 0.0, 1.0);
          ${grassTextures ? `
            vec3 grassNormal = grassNR.xyz * 2.0 - 1.0;
            grassNormal.xy *= uGrassStrength;
            baseNormal = normalize(mix(normalize(grassNormal), baseNormal, roadWeight));
          ` : ''}
          vec3 layeredNormal = normalize(mix(baseNormal, normalize(rockyNormal), rockyWeight));
          normal = normalize(tbn * layeredNormal);
        #endif
        // Surface-only dirt relief, weighted by the original road mask. No displacement.
        float pathRelief=roadHeight*roadWeight*(1.0-rockyWeight);
        vec3 pathDx=dFdx(-vViewPosition),pathDy=dFdy(-vViewPosition);
        vec3 pathR1=cross(pathDy,normal),pathR2=cross(normal,pathDx);
        float pathDet=dot(pathDx,pathR1);
        normal=normalize(abs(pathDet)*normal-sign(pathDet)*(dFdx(pathRelief)*pathR1+dFdy(pathRelief)*pathR2));
      `);
  };
  material.customProgramCacheKey = () => grassTextures ? 'arunika-rocky-grass-v4-path-dirt' : 'arunika-rocky-grass-v4-fallback';
  Object.assign(material.userData, { terrainMaterialId: ARUNIKA_TERRAIN_MATERIAL.id,
    terrainMaterialRevision: ARUNIKA_TERRAIN_MATERIAL.revision, rockyTerrainSource: 'rocky_terrain_02_4k.blend',
    coverage: ARUNIKA_TERRAIN_MATERIAL.coverage, tileSize: ARUNIKA_TERRAIN_MATERIAL.tileSize,
    grassMaterialId: grassTextures ? ARUNIKA_GRASS.id : null, grassSource: grassTextures ? ARUNIKA_GRASS.source : null,
    roadMaterialId: 'arunika.path_dirt' });
  material.needsUpdate = true;
  Object.assign(surface.userData, { terrainMaterialId: ARUNIKA_TERRAIN_MATERIAL.id, terrainMaterialFallback: 'terrain' });
  return surface;
}
