import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneCharacterSource } from './revision02-character.ts';
import { applyCenaChinContour } from './cena-chin.ts';
import { disposeCharacterModel } from './character-model.ts';

await test('chin smoothing changes only the feathered lower face, preserving source, rig and all other features', async () => {
  const bytes = await readFile(new URL('../../public/assets/characters/cena/cena-rigged.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const source = scene.getObjectByName('Cena_OBJ003') as T.SkinnedMesh;
  const originalPositions = source.geometry.attributes.position.array.slice();
  const clone = cloneCharacterSource(scene);
  const mesh = clone.getObjectByName('Cena_OBJ003') as T.SkinnedMesh;
  const rigBefore = mesh.skeleton.bones.map(b => [b.name, ...b.position.toArray(), ...b.quaternion.toArray()]);
  applyCenaChinContour(clone);
  const p = mesh.geometry.attributes.position, before = source.geometry.attributes.position;
  let changed = 0, maxDisplacement = 0;
  for (let i = 0; i < p.count; i++) {
    const a = new T.Vector3().fromBufferAttribute(before, i), b = new T.Vector3().fromBufferAttribute(p, i);
    const distance = a.distanceTo(b);
    if (distance > 0) {
      changed++; maxDisplacement = Math.max(maxDisplacement, distance);
      assert.ok(a.y > 1.773 && a.y < 1.828 && Math.abs(a.x) < .098 && a.z > .075, 'only lower face moves');
    } else if (a.y <= 1.773 || a.y >= 1.828 || Math.abs(a.x) >= .098 || a.z <= .075) {
      const n1 = new T.Vector3().fromBufferAttribute(source.geometry.attributes.normal, i);
      const n2 = new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, i);
      assert.deepEqual(n2.toArray(), n1.toArray(), 'outside shading preserved exactly');
    }
    assert.ok(b.toArray().every(Number.isFinite));
  }
  assert.ok(changed > 30 && changed < 1000, `localized sculpt: ${changed} vertices`);
  assert.ok(maxDisplacement > .001 && maxDisplacement <= .006001);
  for (const name of ['skinIndex', 'skinWeight', 'color']) assert.deepEqual(mesh.geometry.attributes[name].array, source.geometry.attributes[name].array);
  assert.deepEqual(mesh.geometry.index!.array, source.geometry.index!.array);
  assert.deepEqual(mesh.skeleton.bones.map(b => [b.name, ...b.position.toArray(), ...b.quaternion.toArray()]), rigBefore);
  assert.deepEqual(source.geometry.attributes.position.array, originalPositions, 'source stays unchanged');
  for (const name of ['Cena_OBJ003_1', 'Cena_OBJ003_2', 'Cena_OBJ003_3', 'Cena_OBJ003_4']) {
    assert.deepEqual((clone.getObjectByName(name) as T.Mesh).geometry.attributes.position.array,
      (scene.getObjectByName(name) as T.Mesh).geometry.attributes.position.array);
  }
  const once = p.array.slice(); applyCenaChinContour(clone);
  assert.deepEqual(p.array, once, 'idempotent: cannot repeatedly shrink the chin');
  console.log({ changedChinVertices: changed, maximumLocalDisplacement: maxDisplacement });
  disposeCharacterModel(clone); disposeCharacterModel(scene);
});
