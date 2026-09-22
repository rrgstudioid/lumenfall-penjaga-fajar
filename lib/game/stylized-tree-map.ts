import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneImportedMap, sandsWorldPoint } from './imported-map.ts';
import { insideBoundary, terrainPathDistance, terrainWater, type FieldTerrain, type GroundPoint } from './field-terrain.ts';
import { createTreeTrunkCollider } from './tree-collision.ts';

const loader = new GLTFLoader();
const textureLoader = new T.TextureLoader();
const sourceCache = new Map<string, Promise<T.Group>>();
const textureCache = new Map<string, Promise<T.Texture>>();

const MESH_BASE = '/assets/maps/stylized-tree/meshes/';
const TEXTURE_BASE = '/assets/materials/stylized-tree/';
const BARK_COLOR = 'T_Stylized_Bark_1_COLOR.png';
const BARK_NORMAL = 'T_Stylized_Bark_1_NORM.png';
type TreeFamily = 'acacia'|'beech'|'joshua'|'maple'|'oak'|'pine'|'spruce'|'willow';
type TreePlacement = GroundPoint & { family: TreeFamily; scale: number; rotation: number };

// World-unit targets relative to the 2.4-unit player and 4.4-unit city houses.
// Fit measured bounds, not a percentage of the imported scene: the original
// GLBs contain centimeter-sized coordinates, future UE exports use meters.
const TREE_HEIGHT: Record<TreeFamily, number> = {
  acacia: 5.5, beech: 6, joshua: 3.8, maple: 6.5,
  oak: 5.6, pine: 5.8, spruce: 7, willow: 6.2,
};
function treeLimits(regionId: string, inCity: boolean) {
  if (regionId === 'sands-location') return { height: 5.5, radius: 3.3 };
  return inCity ? { height: 6, radius: 3.6 } : { height: 8, radius: 4.2 };
}

/** Fit an independent copy without changing source geometry or materials. */
export function placeStylizedTree(source: T.Group, placement: TreePlacement, groundY: number, regionId: string, inCity: boolean) {
  const tree = cloneImportedMap(source);
  tree.name = `StylizedTree_${placement.family}`;
  tree.position.set(0, 0, 0);
  const bounds = new T.Box3().setFromObject(tree);
  const height = bounds.max.y - bounds.min.y;
  // Bound the full canopy around the trunk, including off-center crowns.
  // A radial limit remains valid at every placement rotation.
  const radius = Math.hypot(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)));
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(radius) || radius <= 0) {
    throw new Error(`Invalid bounds for stylized tree: ${placement.family}`);
  }
  const limits = treeLimits(regionId, inCity);
  const scale = Math.min(TREE_HEIGHT[placement.family] * placement.scale / height, limits.height / height, limits.radius / radius);
  tree.scale.multiplyScalar(scale);
  tree.rotation.y += placement.rotation;
  bounds.setFromObject(tree);
  // The measured minimum is local to the origin, so terrain elevation is
  // added once instead of being cancelled by a world-space minimum.
  tree.position.set(placement.x, groundY - bounds.min.y, placement.z);
  tree.updateWorldMatrix(true, true);
  tree.userData.decorativeTree = true;
  tree.userData.trunkCollider = createTreeTrunkCollider(tree, groundY);
  return tree;
}

const meshFiles: Record<TreeFamily, string> = {
  acacia: 'acacia-sm_stylized_tree_acacia_01.glb',
  beech: 'beech-sm_stylized_tree_beech_03.glb',
  joshua: 'joshua-sm_stylized_tree_joshua_02.glb',
  maple: 'maple-sm_stylized_tree_maple_04.glb',
  oak: 'oak-sm_stylized_tree_oak_02.glb',
  pine: 'pine-sm_stylized_tree_pine_03.glb',
  spruce: 'spruce-sm_stylized_tree_spruce_02.glb',
  willow: 'willow-sm_stylized_tree_willow_02.glb',
};

const leafFiles: Record<TreeFamily, { leaf: string; branch?: string }> = {
  acacia: { leaf: 'T_Leaf_Texture_Acacia.png', branch: 'T_Leaf_Texture_Acacia_Branch.png' },
  beech: { leaf: 'T_Leaf_Texture_Beech.png', branch: 'T_Leaf_Texture_Beech_Branch.png' },
  joshua: { leaf: 'T_Leaf_Texture_Joshua.png' },
  maple: { leaf: 'T_Leaf_Texture_Maple.png' },
  oak: { leaf: 'T_Leaf_Texture_Oak.png', branch: 'T_Leaf_Texture_Oak_Branch.png' },
  pine: { leaf: 'T_Leaf_Texture_Pine.png', branch: 'T_Leaf_Texture_Pine_Branch.png' },
  spruce: { leaf: 'T_Leaf_Texture_Spruce.png', branch: 'T_Leaf_Texture_Spruce_Branch.png' },
  willow: { leaf: 'T_Leaf_Texture_Willow.png' },
};

function loadTreeSource(family: TreeFamily) {
  const cached = sourceCache.get(family);
  if (cached) return cached;
  const request = loader.loadAsync(`${MESH_BASE}${meshFiles[family]}`).then(asset => asset.scene).catch(error => {
    sourceCache.delete(family);
    throw error;
  });
  sourceCache.set(family, request);
  return request;
}

function loadTexture(file: string) {
  const cached = textureCache.get(file);
  if (cached) return cached;
  const request = textureLoader.loadAsync(`${TEXTURE_BASE}${file}`).then(texture => {
    texture.colorSpace = file.includes('_NORM') ? T.NoColorSpace : T.SRGBColorSpace;
    texture.wrapS = T.RepeatWrapping;
    texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }).catch(error => {
    textureCache.delete(file);
    throw error;
  });
  textureCache.set(file, request);
  return request;
}

function isLeafMaterial(material: T.Material) {
  const name = material.name.toLowerCase();
  return name.includes('leaf') || name.includes('foliage') || name.includes('needle') || name.includes('branch');
}

async function applyTreeMaterials(object: T.Object3D, family: TreeFamily) {
  const [bark, barkNormal, leaf, branch] = await Promise.all([
    loadTexture(BARK_COLOR),
    loadTexture(BARK_NORMAL),
    loadTexture(leafFiles[family].leaf),
    leafFiles[family].branch ? loadTexture(leafFiles[family].branch) : Promise.resolve(undefined),
  ]);
  object.traverse(child => {
    if (!(child instanceof T.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!(material instanceof T.MeshStandardMaterial)) continue;
      if (isLeafMaterial(material)) {
        material.map = material.name.toLowerCase().includes('branch') && branch ? branch : leaf;
        material.color.set('#ffffff');
        material.transparent = true;
        material.alphaTest = .28;
        material.side = T.DoubleSide;
        material.depthWrite = true;
        material.roughness = .92;
      } else {
        material.map = bark;
        material.normalMap = barkNormal;
        material.color.set('#ffffff');
        material.roughness = .9;
      }
      material.needsUpdate = true;
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function treePlacement(family: TreeFamily, x: number, z: number, scale: number, rotation: number): TreePlacement {
  return { family, x, z, scale, rotation };
}

const cityPlacements: TreePlacement[] = [
  treePlacement('oak', -35, -19, 1.2, .2),
  treePlacement('maple', 34, -18, 1.05, 1.1),
  treePlacement('beech', -33, 18, 1.1, 2.4),
  treePlacement('willow', 35, 18, 1.15, 3.2),
  treePlacement('pine', -24, 29, .95, 4.2),
  treePlacement('spruce', 24, 29, 1.05, 5.1),
];

const fieldPlacements: TreePlacement[] = [
  treePlacement('oak', -49, -17, 1.22, .4),
  treePlacement('maple', -43, -38, 1.08, 1.5),
  treePlacement('beech', -7, -52, 1.2, 2.1),
  treePlacement('pine', 18, -48, .95, 2.8),
  treePlacement('spruce', 48, -25, 1.05, 3.6),
  treePlacement('willow', 51, 8, 1.1, 4.3),
  treePlacement('acacia', 42, 35, 1.15, 5.2),
  treePlacement('oak', -40, 38, 1.08, 5.9),
];

const eastPlacements: TreePlacement[] = [
  treePlacement('acacia', -46, -25, 1.08, .2),
  treePlacement('oak', -29, -43, 1.18, 1.2),
  treePlacement('pine', 0, -50, .94, 2.2),
  treePlacement('maple', 31, -42, 1.08, 3.1),
  treePlacement('beech', 50, -17, 1.12, 3.8),
  treePlacement('willow', 47, 22, 1.12, 4.6),
  treePlacement('spruce', 21, 45, 1.02, 5.1),
  treePlacement('oak', -35, 37, 1.15, 5.8),
];

const sandsPlacements: Array<Omit<TreePlacement, 'x'|'z'> & { x: number; z: number }> = [
  { ...treePlacement('joshua', 0, 0, 1.12, .2), x: -10, z: -22 },
  { ...treePlacement('acacia', 0, 0, 1.02, 1.4), x: 8, z: -20 },
  { ...treePlacement('joshua', 0, 0, 1.18, 2.3), x: -9, z: 13 },
  { ...treePlacement('acacia', 0, 0, 1.06, 3.5), x: 9, z: 15 },
  { ...treePlacement('joshua', 0, 0, .98, 4.7), x: -4, z: 28 },
];

function placementForRegion(regionId: string, inCity: boolean, terrain?: FieldTerrain): TreePlacement[] {
  if (regionId === 'sands-location') return sandsPlacements.map(item => ({ ...item, ...sandsWorldPoint(item.x, item.z) }));
  const candidates = inCity ? cityPlacements : regionId === 'east-gate-arunika' ? eastPlacements : fieldPlacements;
  if (!terrain) return candidates;
  return candidates.filter(item => {
    const point = { x: item.x, z: item.z };
    return insideBoundary(terrain, point, 2.5) && !terrainWater(terrain, point, 2) && terrainPathDistance(terrain, point) > 6;
  });
}

export async function buildStylizedTreeDecor(regionId: string, inCity: boolean, groundHeight: (x: number, z: number) => number, terrain?: FieldTerrain): Promise<T.Group> {
  const placements = placementForRegion(regionId, inCity, terrain);
  const target = new T.Group();
  target.name = `StylizedTreeDecor_${regionId}`;
  if (!placements.length) return target;
  const families = Array.from(new Set(placements.map(item => item.family)));
  const sources = await Promise.all(families.map(async family => [family, await loadTreeSource(family)] as const));
  const sourceMap = new Map(sources);
  await Promise.all(families.map(family => applyTreeMaterials(sourceMap.get(family)!, family)));
  for (const placement of placements) {
    const source = sourceMap.get(placement.family);
    if (!source) continue;
    target.add(placeStylizedTree(source, placement, groundHeight(placement.x, placement.z), regionId, inCity));
  }
  return target;
}
