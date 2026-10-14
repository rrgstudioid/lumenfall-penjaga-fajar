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
    texture.colorSpace = key.includes('basecolor')
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
    textureCache.acquire('head-basecolor.png'),
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
  const [base, mask, normal, head] = entries.map(
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
    head: head.value,
    release: () => {
      if (released) return;
      released = true;
      base.release();
      mask.release();
      normal.release();
      head.release();
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
  textures?: Awaited<ReturnType<typeof loadMaleTextures>>,
) {
  const mat = new T.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.7,
    metalness: 0,
    map: textures?.base ?? null,
    normalMap: textures?.normal ?? null,
    normalScale: new T.Vector2(0.5, 0.5),
  });
  mat.name = 'MAT_Hair';
  if (textures) {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        vec4 hairTexel=texture2D(map,vMapUv);
        diffuseColor.rgb *= clamp(hairTexel.rgb/vec3(.159,.058,.034),vec3(.35),vec3(2.2));
      `,
      );
    };
    mat.customProgramCacheKey = () => 'source-chibi-hair-v1';
  }
  return mat;
}
export function createMaleBodyMaterial(
  textures: Awaited<ReturnType<typeof loadMaleTextures>>,
  appearance: MaleAppearance,
) {
  const mat = new T.MeshStandardMaterial({
    map: textures.base,
    vertexColors: true,
    normalMap: textures.normal,
    normalScale: new T.Vector2(0.65, 0.65),
    roughness: 0.83,
    metalness: 0,
  });
  mat.name = 'MAT_Body';
  const tint = { value: new T.Color() };
  const mask = { value: textures.mask };
  const headAtlas = { value: textures.head };
  const sourceHair = { value: appearance.hairStyleId === 'hair_01' ? 1 : 0 };
  const scalpTransform = '#include <begin_vertex>';
  const depth = new T.MeshDepthMaterial({
    depthPacking: T.RGBADepthPacking,
    vertexColors: true,
  });
  const distance = new T.MeshDistanceMaterial({ vertexColors: true });
  for (const shadow of [depth, distance]) {
    shadow.onBeforeCompile = (shader) => {
      shader.uniforms.sourceHair = sourceHair;
      shader.vertexShader =
        'uniform float sourceHair; varying float vHiddenScalp;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        scalpTransform + '\n vHiddenScalp=color.b;',
      );
      shader.fragmentShader =
        'uniform float sourceHair; varying float vHiddenScalp;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        'void main() { if((vHiddenScalp>.75 && sourceHair>.5)||(vHiddenScalp>.25 && vHiddenScalp<.75 && sourceHair<.5)) discard;',
      );
    };
    shadow.customProgramCacheKey = () => 'source-chibi-scalp-shadow-v2';
  }
  mat.userData.depthMaterial = depth;
  mat.userData.distanceMaterial = distance;
  mat.addEventListener('dispose', () => {
    depth.dispose();
    distance.dispose();
  });
  mat.userData.setScalpVisible = (visible: boolean) => {
    sourceHair.value = visible ? 0 : 1;
  };
  mat.userData.setTextures = (next: typeof textures) => {
    mat.map = next.base;
    mat.normalMap = next.normal;
    mask.value = next.mask;
    headAtlas.value = next.head;
  };
  const apply = (a: MaleAppearance) => {
    sourceHair.value = a.hairStyleId === 'hair_01' ? 1 : 0;
    tint.value.set(
      MALE_SKIN_TONES.find((t) => t.id === a.skinToneId)?.color ?? '#e8b18f',
    );
  };
  mat.userData.applyAppearance = apply;
  apply(appearance);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.skinMask = mask;
    shader.uniforms.headAtlas = headAtlas;
    shader.uniforms.skinTint = tint;
    shader.uniforms.sourceHair = sourceHair;
    shader.vertexShader = 'uniform float sourceHair;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      scalpTransform,
    );
    // Soften the projected face's normals without carrying the source fringe's
    // creases into the bald head. The original Messy Spikes surface is unchanged.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      float cleanFace=step(.75,color.b)*color.g;
      objectNormal=normalize(mix(objectNormal,normalize(vec3(position.x*.6,.2,1.)),cleanFace*.65));
    `,
    );
    shader.fragmentShader =
      'uniform sampler2D skinMask; uniform sampler2D headAtlas; uniform vec3 skinTint; uniform float sourceHair;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      vec3 regions=texture2D(skinMask,vMapUv).rgb;
      // The owner's source mesh/atlas remain intact. Only the authored skin
      // mask can receive tint; cloth, rope, eyes and eyebrows retain their atlas.
      float alternate=step(.75,vColor.b);
      if((alternate>.5 && sourceHair>.5)||(vColor.b>.25 && vColor.b<.75 && sourceHair<.5)) discard;
      float cap=alternate;
      float forehead=cap;
      float skinAmount=max(mix(regions.r,1.0,cap),forehead)*step(.5,vColor.r);
      vec3 skinDetail=clamp(diffuseColor.rgb/vec3(.922,.356,.184),vec3(.68),vec3(1.2));
      diffuseColor.rgb=mix(diffuseColor.rgb,skinTint*mix(skinDetail,vec3(1.),max(cap,alternate)),skinAmount);
      if(alternate>.5){
        vec4 face=texture2D(headAtlas,vMapUv);
        diffuseColor.rgb=mix(skinTint,mix(face.rgb,skinTint,face.a),vColor.g);
      }

    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `vec3 smoothSkinNormal=normal;
      #include <normal_fragment_maps>
      normal=normalize(mix(normal,smoothSkinNormal,max(skinAmount*mix(.65,1.,alternate),cap)));`,
    );
  };
  mat.customProgramCacheKey = () => 'male-source-chibi-skin-v2';
  return mat;
}
