import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneImportedMap, ImportedMapGround, SANDS_MAP_ANCHOR, SANDS_MAP_SCALE, sandsWorldPoint } from './imported-map.ts';

const bytes = await readFile(new URL('../../public/assets/maps/sands-location.glb', import.meta.url));
const loader = new GLTFLoader();
// Node has no browser image decoder. Geometry/material tests use placeholder
// textures; actual image decoding and appearance are checked in the browser.
loader.register(() => ({ name: 'test_textures', loadTexture: async () => new T.Texture() }));
const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const meshes = (root: T.Object3D) => {
  const result: T.Mesh[] = [];
  root.traverse(object => { if (object instanceof T.Mesh) result.push(object); });
  return result;
};

await test('Sands keeps the original asset and all four single-material primitives drawable', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e405ad906455004e8aadc1f8e620a8fadef43149d424198d4e73d277324df911');
  const original = meshes(scene), copy = meshes(cloneImportedMap(scene));
  assert.equal(copy.length, 4);
  let triangles = 0;
  copy.forEach((mesh, index) => {
    const source = original[index];
    assert.ok(!Array.isArray(mesh.material));
    assert.equal(mesh.geometry.groups.length, 0);
    assert.notEqual(mesh.geometry, source.geometry);
    assert.notEqual(mesh.material, source.material);
    const material = mesh.material as T.MeshStandardMaterial;
    const sourceMaterial = source.material as T.MeshStandardMaterial;
    assert.equal(material.map, sourceMaterial.map);
    assert.equal(material.roughness, sourceMaterial.roughness);
    assert.equal(material.side, sourceMaterial.side);
    assert.deepEqual(material.color, sourceMaterial.color);
    triangles += mesh.geometry.index!.count / 3;
  });
  assert.equal(triangles, 23931);
});

await test('multi-material meshes retain their groups and independent materials', () => {
  const source = new T.Group();
  const mesh = new T.Mesh(new T.BoxGeometry(), [new T.MeshBasicMaterial(), new T.MeshBasicMaterial()]);
  source.add(mesh);
  const copy = meshes(cloneImportedMap(source))[0];
  assert.ok(Array.isArray(copy.material));
  assert.notEqual(copy.material[0], mesh.material[0]);
  assert.deepEqual(copy.geometry.groups, mesh.geometry.groups);
});

await test('indexed ground heights match the original transformed mesh, not a flat plane', () => {
  const ground = new ImportedMapGround(cloneImportedMap(scene), ['map_2_terrain1']);
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
  for (let x = -14; x <= 16; x += 1.37) for (let z = -42; z <= 41; z += 1.73) {
    ray.ray.origin.set(x, 100, z);
    const hit = ray.intersectObjects(ground.surfaces, false)[0];
    const height = ground.heightAt(x, z);
    if (hit) assert.ok(height !== undefined && Math.abs(height - hit.point.y) < .0001);
    else assert.equal(height, undefined);
  }
  const entry = sandsWorldPoint(0, 35);
  assert.ok(Math.abs(ground.heightAt(entry.x, entry.z)! - 9.097) < .01);
  assert.equal(ground.heightAt(100, 100), undefined);
  for (const [dx, dz] of [[.1, 0], [-.1, 0], [0, .1], [0, -.1]]) {
    const point = ground.move(entry, dx, dz);
    assert.ok(Math.hypot(point.x, point.z - 35) > .09, 'Entrance allows movement');
  }
  assert.deepEqual(ground.move({ x: 100, z: 100 }, 1, 1), { x: 100, z: 100 });
});

await test('the elevated bridge deck is walkable above the terrain below it', () => {
  const map = cloneImportedMap(scene);
  map.scale.set(SANDS_MAP_SCALE, 1, SANDS_MAP_SCALE);
  map.position.set(SANDS_MAP_ANCHOR.x * (1 - SANDS_MAP_SCALE), 0, SANDS_MAP_ANCHOR.z * (1 - SANDS_MAP_SCALE));
  const terrain = new ImportedMapGround(map, ['map_2_terrain1']);
  const walkable = new ImportedMapGround(map, ['map_2_terrain1', 'map_2_object1']);
  const deck = sandsWorldPoint(1.5, 25);
  assert.ok((walkable.heightAt(deck.x, deck.z) ?? 0) - (terrain.heightAt(deck.x, deck.z) ?? 0) > 6);
  let point = sandsWorldPoint(1.5, 25.5);
  for (let i = 0; i < 8; i++) point = walkable.move(point, 0, -.2);
  assert.ok(point.z < deck.z);
  assert.ok((walkable.heightAt(point.x, point.z) ?? 0) > (terrain.heightAt(point.x, point.z) ?? 0) + 5);
});

await test('leaving and re-entering cannot dispose the cached source geometry or material', () => {
  const original = meshes(scene);
  let disposed = 0;
  for (const mesh of original) {
    mesh.geometry.addEventListener('dispose', () => disposed++);
    (mesh.material as T.Material).addEventListener('dispose', () => disposed++);
  }
  for (const mesh of meshes(cloneImportedMap(scene))) {
    mesh.geometry.dispose();
    (mesh.material as T.Material).dispose();
  }
  assert.equal(disposed, 0);
  assert.equal(meshes(cloneImportedMap(scene)).length, 4);
});

