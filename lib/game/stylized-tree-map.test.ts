import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildStylizedTreeDecor, placeStylizedTree } from './stylized-tree-map.ts';
import { CITIES, FIELDS, FIELD_NPCS } from './regions.ts';
import { FIELD_TERRAINS } from './field-terrain.ts';
import { moveWithTreeCollisions, type TreeCollider } from './tree-collision.ts';

const directory = new URL('../../public/assets/maps/stylized-tree/meshes/', import.meta.url);
const sources = new Map<string, T.Group>();
for (const file of (await readdir(directory)).filter(file => file.endsWith('.glb'))) {
  const bytes = await readFile(new URL(file, directory));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  sources.set(file, scene);
}
type Family = Parameters<typeof placeStylizedTree>[1]['family'];
const epsilon = 1e-5;

await test('all eight real GLBs fit the player scale and keep their base on elevated or lowered ground', () => {
  assert.equal(sources.size, 8);
  for (const [file, source] of sources) {
    const family = file.split('-')[0] as Family;
    const original = new T.Box3().setFromObject(source);
    for (const groundY of [-4, 0, 9.1]) {
      const placement = { family, x: 12, z: -19, scale: 1.22, rotation: 1.7 };
      const tree = placeStylizedTree(source, placement, groundY, 'arunika', true);
      const bounds = new T.Box3().setFromObject(tree);
      const size = bounds.getSize(new T.Vector3());
      assert.ok(size.y >= 2.4 && size.y <= 6 + epsilon, `${file}: height ${size.y}`);
      assert.ok(size.x <= 7.2 + epsilon && size.z <= 7.2 + epsilon, `${file}: canopy exceeds city limit`);
      assert.ok(Math.abs(bounds.min.y - groundY) < epsilon, `${file}: base ${bounds.min.y}, ground ${groundY}`);
      assert.equal(tree.position.x, placement.x);
      assert.equal(tree.position.z, placement.z);
      const collider = tree.userData.trunkCollider as TreeCollider;
      assert.ok(collider.radius >= .12 && collider.radius < .6, `${file}: trunk radius ${collider.radius}`);
      assert.equal(collider.minY, groundY);
      assert.ok(Math.hypot(collider.x - placement.x, collider.z - placement.z) < .4, `${file}: collider follows trunk`);
    }
    assert.deepEqual(new T.Box3().setFromObject(source), original, 'cached model is unchanged');
  }
});

await test('centimeter GLBs and corrected meter exports result in identical world dimensions', () => {
  for (const [file, source] of sources) {
    const meters = source.clone(true);
    meters.scale.multiplyScalar(.01);
    const placement = { family: file.split('-')[0] as Family, x: -8, z: 15, scale: 1.05, rotation: .6 };
    const legacy = placeStylizedTree(source, placement, 7, 'verdant-plains', false);
    const corrected = placeStylizedTree(meters, placement, 7, 'verdant-plains', false);
    const before = new T.Box3().setFromObject(legacy), after = new T.Box3().setFromObject(corrected);
    assert.ok(before.min.distanceTo(after.min) < epsilon, file);
    assert.ok(before.max.distanceTo(after.max) < epsilon, file);
    for (const key of ['x', 'z', 'radius', 'minY', 'maxY']) assert.ok(Math.abs(legacy.userData.trunkCollider[key] - corrected.userData.trunkCollider[key]) < epsilon, `${file}: collider units`);
    const originalMesh = source.getObjectsByProperty('type', 'Mesh')[0] as T.Mesh;
    const placedMesh = corrected.getObjectsByProperty('type', 'Mesh')[0] as T.Mesh;
    assert.notEqual(placedMesh.geometry, originalMesh.geometry);
    assert.deepEqual(placedMesh.geometry.attributes.position.array, originalMesh.geometry.attributes.position.array);
    assert.deepEqual(placedMesh.geometry.index?.array, originalMesh.geometry.index?.array);
    assert.notEqual(placedMesh.material, originalMesh.material);
    assert.equal((placedMesh.material as T.Material).type, (originalMesh.material as T.Material).type);
  }
});

await test('the shared world builder applies bounded sizes and correct elevation across every city and field', async () => {
  // Only browser image decoding/network are mocked; placements, real mesh
  // dimensions, material assignment, terrain filters and transforms run normally.
  const meshMock = mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => {
    const scene = sources.get(url.split('/').at(-1)!);
    assert.ok(scene, url);
    return { scene };
  });
  const textureMock = mock.method(T.TextureLoader.prototype, 'loadAsync', async () => new T.Texture());
  try {
    const regions = [...Object.keys(CITIES).map(id => ({ id, inCity: true })), ...Object.keys(FIELDS).map(id => ({ id, inCity: false }))];
    const groundHeight = (x: number, z: number) => 9 + x * .06 - z * .025;
    for (const { id, inCity } of regions) {
      const group = await buildStylizedTreeDecor(id, inCity, groundHeight, FIELD_TERRAINS[id]);
      const maxHeight = id === 'sands-location' ? 5.5 : inCity ? 6 : 8;
      const radius = id === 'sands-location' ? 3.3 : inCity ? 3.6 : 4.2;
      assert.ok(group.children.length > 0, `${id}: trees were not lost`);
      const colliders = group.children.map(tree => tree.userData.trunkCollider as TreeCollider);
      const accessPoints = inCity
        ? [...CITIES[id].npcList, { x: 0, z: 7 }, { x: 0, z: 51 }]
        : [FIELDS[id].entry, FIELDS[id].exit, FIELD_NPCS[id]].filter(Boolean);
      for (const access of accessPoints) for (const collider of colliders) {
        assert.ok(Math.hypot(access.x - collider.x, access.z - collider.z) > collider.radius + 2.5, `${id}: tree blocks spawn/NPC/teleport access`);
      }
      const heights: number[] = [];
      for (const tree of group.children) {
        const bounds = new T.Box3().setFromObject(tree), size = bounds.getSize(new T.Vector3());
        heights.push(size.y);
        assert.ok(size.y > 2.4 && size.y <= maxHeight + epsilon, `${id}/${tree.name}: height ${size.y}`);
        assert.ok(size.x <= radius * 2 + epsilon && size.z <= radius * 2 + epsilon, `${id}/${tree.name}: canopy`);
        assert.ok(Math.abs(bounds.min.y - groundHeight(tree.position.x, tree.position.z)) < epsilon, `${id}/${tree.name}: elevation`);
        assert.equal(tree.userData.decorativeTree, true);
        const collider = tree.userData.trunkCollider as TreeCollider;
        const flat = (p: { x: number; z: number }, dx: number, dz: number) => ({ x: p.x + dx, z: p.z + dz });
        const blocked = moveWithTreeCollisions({ x: collider.x - 2, z: collider.z }, 4, 0, colliders, flat, groundHeight);
        assert.ok(blocked.x < collider.x && collider.x - blocked.x >= collider.radius + .447, `${id}/${tree.name}: trunk stops a dash`);
        const underCanopy = moveWithTreeCollisions({ x: collider.x - 2, z: collider.z + collider.radius + .7 }, 4, 0, colliders, flat, groundHeight);
        assert.ok(underCanopy.x > collider.x + 1.9, `${id}/${tree.name}: space below leaves remains open`);
      }
      console.log(`${id}: ${heights.length} trees, height ${Math.min(...heights).toFixed(2)}–${Math.max(...heights).toFixed(2)} units`);
    }
  } finally {
    meshMock.mock.restore();
    textureMock.mock.restore();
  }
});
