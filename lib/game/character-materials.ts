import * as T from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { CharacterAssetCache } from './character-asset-cache.ts';
import {
  MALE_SKIN_TONES,
  MALE_BODY_ASSET_REVISION,
  type MaleAppearance,
} from './character-appearance.ts';
const loader = new T.TextureLoader();
const textureCache = new CharacterAssetCache(
  async (key: string) => {
    const texture = await loader.loadAsync(
      '/assets/characters/male-v2/textures/' +
        key +
        `?v=${MALE_BODY_ASSET_REVISION}`,
    );
    texture.flipY = false;
    texture.colorSpace =
      key.includes('basecolor') || key === 'hair-detail.webp'
        ? T.SRGBColorSpace
        : T.NoColorSpace;
    texture.userData.sharedCharacter = true;
    return texture;
  },
  (t) => t.dispose(),
  (t) => (t.image.width * t.image.height * 4 * 4) / 3,
);
const contexts = new WeakMap<
  T.WebGLRenderer,
  { cache: CharacterAssetCache<T.Texture>; loader: KTX2Loader }
>();
function compressedCache(renderer: T.WebGLRenderer) {
  let context = contexts.get(renderer);
  if (context) return context;
  const ktx = new KTX2Loader()
    .setTranscoderPath('/assets/decoders/basis/')
    .setWorkerLimit(2)
    .detectSupport(renderer);
  const cache = new CharacterAssetCache<T.Texture>(
    async (key) => {
      let texture: T.Texture;
      try {
        texture = await ktx.loadAsync(
          '/assets/characters/male-v2/textures/' +
            key.replace(/\.(webp|png)$/, '.ktx2') +
            `?v=${MALE_BODY_ASSET_REVISION}`,
        );
      } catch {
        texture = await loader.loadAsync(
          '/assets/characters/male-v2/textures/' +
            key +
            `?v=${MALE_BODY_ASSET_REVISION}`,
        );
      }
      texture.flipY = false;
      texture.colorSpace = key.includes('basecolor')
        ? T.SRGBColorSpace
        : T.NoColorSpace;
      texture.userData.sharedCharacter = true;
      return texture;
    },
    (t) => t.dispose(),
    (t) =>
      t instanceof T.CompressedTexture
        ? t.mipmaps.reduce((n, m) => n + m.data.byteLength, 0)
        : (t.image.width * t.image.height * 4 * 4) / 3,
  );
  context = { cache, loader: ktx };
  contexts.set(renderer, context);
  return context;
}
/** Diagnostic estimate of resident texture payloads, not a driver VRAM reading. */
export function maleTextureCacheStats(renderer: T.WebGLRenderer) {
  const compressed = contexts.get(renderer)?.cache.stats();
  const shared = textureCache.stats();
  return compressed
    ? {
        entries: compressed.entries + shared.entries,
        users: compressed.users + shared.users,
        bytes: compressed.bytes + shared.bytes,
      }
    : shared;
}
export async function loadMaleTextures(
  size: 1024 | 2048,
  renderer?: T.WebGLRenderer,
) {
  const context = renderer ? compressedCache(renderer) : undefined,
    cache = context?.cache ?? textureCache;
  const entries = await Promise.allSettled([
    cache.acquire(`body-basecolor-${size}.webp`),
    cache.acquire('body-skin-mask.png'),
    cache.acquire(`body-normal-${size}.png`),
    textureCache.acquire('hair-detail.webp'),
  ]);
  if (entries.some((e) => e.status === 'rejected')) {
    entries.forEach((e) => {
      if (e.status === 'fulfilled') e.value.release();
    });
    if (context && !cache.stats().users) {
      cache.trim(true);
      context.loader.dispose();
      contexts.delete(renderer!);
    }
    if (!textureCache.stats().users) textureCache.trim(true);
    throw Error('Tekstur karakter gagal dimuat');
  }
  const [base, mask, normal, hair] = entries.map(
    (e) =>
      (
        e as PromiseFulfilledResult<
          Awaited<ReturnType<typeof textureCache.acquire>>
        >
      ).value,
  );
  let released = false;
  return {
    base: base.value,
    mask: mask.value,
    normal: normal.value,
    hair: hair.value,
    release: () => {
      if (released) return;
      released = true;
      base.release();
      mask.release();
      normal.release();
      hair.release();
      if (!textureCache.stats().users) textureCache.trim(true);
      if (context && !cache.stats().users) {
        cache.trim(true);
        context.loader.dispose();
        contexts.delete(renderer!);
      }
    },
  };
}
export function createMaleHairMaterial(
  appearance: MaleAppearance,
  textures: Awaited<ReturnType<typeof loadMaleTextures>>,
) {
  const mat = new T.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.7,
    metalness: 0,
    map: textures.hair,
  });
  mat.name = 'MAT_Hair';
  // The shared atlas contains neutral strand shading from the owner's hair GLB.
  // Keep every dye neutral (including white); never sample the body atlas.
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `vec3 detail=texture2D(map,vMapUv).rgb;
       diffuseColor.rgb *= clamp(detail/vec3(.16),vec3(.3),vec3(2.2));`,
    );
  };
  mat.customProgramCacheKey = () => 'owner-hair-detail-v1';
  return mat;
}
export function createMaleBodyMaterial(
  textures: Awaited<ReturnType<typeof loadMaleTextures>>,
  appearance: MaleAppearance,
) {
  const mat = new T.MeshStandardMaterial({
    map: textures.base,
    normalMap: textures.normal,
    normalScale: new T.Vector2(0.5, 0.5),
    roughness: 0.83,
    metalness: 0,
  });
  mat.name = 'MAT_Body';
  const tint = { value: new T.Color() };
  const mask = { value: textures.mask };
  // The supplied bald head is complete. All hairstyles share this one surface,
  // including shadow passes; there is no reconstructed/hidden alternate scalp.
  const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  const distance = new T.MeshDistanceMaterial();
  mat.userData.depthMaterial = depth;
  mat.userData.distanceMaterial = distance;
  mat.addEventListener('dispose', () => {
    depth.dispose();
    distance.dispose();
  });
  mat.userData.setTextures = (next: typeof textures) => {
    mat.map = next.base;
    mat.normalMap = next.normal;
    mask.value = next.mask;
  };
  const apply = (a: MaleAppearance) => {
    tint.value.set(
      MALE_SKIN_TONES.find((t) => t.id === a.skinToneId)?.color ?? '#e8b18f',
    );
  };
  mat.userData.applyAppearance = apply;
  apply(appearance);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.skinMask = mask;
    shader.uniforms.skinTint = tint;
    shader.fragmentShader =
      'uniform sampler2D skinMask; uniform vec3 skinTint;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       vec2 skinChannels=texture2D(skinMask,vMapUv).rg;
       float skinAmount=skinChannels.r;
       // Keep subtle value detail, but remove the source's orange chroma and
       // baked color patches. Lighting still supplies the anatomical shading.
       float skinLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
       float skinDetail=clamp(1.0+(skinLuma/.463-1.0)*.12,.94,1.04);
       skinDetail=mix(skinDetail,clamp(skinLuma/.463,.5,1.04),skinChannels.g);
       diffuseColor.rgb=mix(diffuseColor.rgb,skinTint*skinDetail,skinAmount);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps.replace(
        'mapN.xy *= normalScale;',
        'mapN.xy *= normalScale * mix(1.0,0.25,skinAmount);',
      ),
    );
  };
  mat.customProgramCacheKey = () => 'owner-bald-body-even-skin-v2';
  return mat;
}
