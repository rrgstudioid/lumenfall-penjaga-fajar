import * as T from 'three';

export type BasicMapMaterialKind =
  | 'terrain'
  | 'path'
  | 'grass'
  | 'rock'
  | 'water'
  | 'wood'
  | 'sand';

const textureCache = new Map<BasicMapMaterialKind, T.Texture>();

const palettes: Record<BasicMapMaterialKind, readonly [number, number, number]> = {
  terrain: [207, 218, 159],
  path: [191, 184, 133],
  grass: [136, 174, 92],
  rock: [128, 137, 119],
  water: [70, 161, 168],
  wood: [121, 78, 47],
  sand: [218, 202, 142],
};

function noise(x: number, y: number, seed: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function getProceduralTexture(kind: BasicMapMaterialKind) {
  const cached = textureCache.get(kind);
  if (cached) return cached;

  const size = 64;
  const [r, g, b] = palettes[kind] ?? palettes.terrain;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const coarse = noise(Math.floor(x / 5), Math.floor(y / 5), kind.length);
      const fine = noise(x, y, kind.charCodeAt(0));
      const wave = kind === 'water' ? Math.sin((x + y) * 0.45) * 0.1 : 0;
      const variation = (coarse * 0.16 + fine * 0.06 - 0.1 + wave) * 255;
      data[index] = Math.max(0, Math.min(255, r + variation));
      data[index + 1] = Math.max(0, Math.min(255, g + variation));
      data[index + 2] = Math.max(0, Math.min(255, b + variation));
      data[index + 3] = 255;
    }
  }

  const texture = new T.DataTexture(data, size, size, T.RGBAFormat, T.UnsignedByteType);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = T.RepeatWrapping;
  texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(kind === 'water' ? 4 : 7, 7);
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  textureCache.set(kind, texture);
  return texture;
}

export function createBasicMapMaterial(
  kind: BasicMapMaterialKind,
  extra: T.MeshStandardMaterialParameters = {},
) {
  const defaults: T.MeshStandardMaterialParameters = {
    color: '#ffffff',
    map: getProceduralTexture(kind),
    roughness: kind === 'water' ? 0.28 : kind === 'rock' ? 0.86 : 0.94,
    metalness: kind === 'water' ? 0.12 : 0,
  };
  if (kind === 'water') {
    defaults.transparent = true;
    defaults.opacity = 0.88;
    defaults.side = T.DoubleSide;
  }
  return new T.MeshStandardMaterial({ ...defaults, ...extra });
}

/** Add lightweight XZ UVs to generated meshes that do not have source UVs. */
export function addPlanarUv(geometry: T.BufferGeometry, tileSize = 8) {
  const positions = geometry.getAttribute('position');
  if (!positions || geometry.getAttribute('uv')) return geometry;
  const uvs: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    uvs.push(positions.getX(i) / tileSize, positions.getZ(i) / tileSize);
  }
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  return geometry;
}
