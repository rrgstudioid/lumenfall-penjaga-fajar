// Tests capture prototype methods only to restore them after loader stubs.
/* oxlint-disable typescript/unbound-method */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createArunikaTuftGeometry, enhanceArunikaGrassTufts, loadArunikaGrassTextures } from './arunika-grass-material.ts';

await test('grass cards stay inside the old tuft footprint, with six triangles and atlas UVs', () => {
  const geometry = createArunikaTuftGeometry();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new T.Vector3());
  assert.ok(size.x <= .441 && size.z <= .441 && size.y <= .701);
  assert.equal(geometry.index!.count/3, 6);
  const uv = geometry.getAttribute('uv');
  for(let i=0;i<uv.count;i++) { assert.ok(uv.getX(i)>=0 && uv.getX(i)<=1); assert.ok(uv.getY(i)>=0 && uv.getY(i)<=1); }
  geometry.dispose();
});

await test('source grass loads once, retries failure and preserves instance placements', async () => {
  const original = T.TextureLoader.prototype.loadAsync;
  let requests = 0, fail = true;
  T.TextureLoader.prototype.loadAsync = async function(url: string) {
    requests++;
    if(fail && url.includes('ground_normal'))throw new Error('test grass failure');
    return new T.Texture();
  };
  try {
    const mesh = new T.InstancedMesh(new T.ConeGeometry(.22,.7,3),new T.MeshStandardMaterial(),4);
    mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(10,2,20));
    const before = Array.from(mesh.instanceMatrix.array), fallback = mesh.material, oldGeo = mesh.geometry;
    await assert.rejects(enhanceArunikaGrassTufts(mesh),/test grass failure/);
    assert.equal(mesh.material, fallback); assert.equal(mesh.geometry, oldGeo);
    fail = false;
    await enhanceArunikaGrassTufts(mesh);
    assert.deepEqual(Array.from(mesh.instanceMatrix.array),before);
    assert.equal(mesh.count,4);
    assert.equal(mesh.geometry.index!.count/3,6);
    const material = mesh.material as T.MeshStandardMaterial;
    assert.equal(material.alphaTest,.42); assert.equal(material.transparent,false); assert.equal(material.side,T.DoubleSide);
    assert.equal(material.map?.colorSpace,T.SRGBColorSpace);
    assert.equal(material.normalMap?.colorSpace,T.NoColorSpace);
    await loadArunikaGrassTextures(); assert.equal(requests,8);
    const removed = new T.InstancedMesh(new T.ConeGeometry(.22,.7,3),new T.MeshStandardMaterial(),1);
    const promise = enhanceArunikaGrassTufts(removed); (removed.material as T.Material).dispose(); await promise;
    assert.equal(removed.userData.grassMaterialId,undefined);
  } finally { T.TextureLoader.prototype.loadAsync = original; }
});
