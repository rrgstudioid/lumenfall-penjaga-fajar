// Tests capture prototype methods only to restore them after loader stubs.
/* oxlint-disable typescript/unbound-method */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { VERDANT_TERRAIN, EAST_GATE_TERRAIN, terrainPathDistance, insideBoundary } from './field-terrain.ts';
import { buildArunikaTerrainMask } from './arunika-terrain-mask.ts';
import { enhancePadangTerrainSurface, ARUNIKA_TERRAIN_MATERIAL } from './arunika-terrain-material.ts';
import { buildFieldTerrain } from './field-terrain-renderer.ts';

await test('spatial mask has strong rocky interiors, dominant grass and protected roads', () => {
  const snapshot = JSON.stringify(VERDANT_TERRAIN);
  const mask = buildArunikaTerrainMask(VERDANT_TERRAIN);
  assert.equal(JSON.stringify(VERDANT_TERRAIN), snapshot, 'layout data must not change');
  assert.ok(mask.coverage.rocky > .2 && mask.coverage.rocky < .3);
  assert.ok(mask.coverage.grass > .5 && mask.coverage.grass < .65);
  let opaque = 0, roadSamples = 0;
  for (let z = 0; z < mask.size; z++) for (let x = 0; x < mask.size; x++) {
    const p = { x: mask.bounds[0] + (x+.5) / mask.size / mask.bounds[2], z: mask.bounds[1] + (z+.5) / mask.size / mask.bounds[3] };
    if (!insideBoundary(VERDANT_TERRAIN, p)) continue;
    const i = (z*mask.size+x)*4;
    if (mask.data[i] === 255) opaque++;
    if (terrainPathDistance(VERDANT_TERRAIN, p) < 1.6) {
      roadSamples++; assert.equal(mask.data[i], 0); assert.equal(mask.data[i+1], 255);
    }
  }
  assert.ok(opaque > 20000, 'rock patch opacity must not be limited to 34%');
  assert.ok(roadSamples > 1000);
  for (const [key, value] of Object.entries(mask.coverage)) {
    assert.ok(Math.abs(ARUNIKA_TERRAIN_MATERIAL.coverage[key as keyof typeof mask.coverage] - value) < .00001);
  }
});

await test('load failure, retry, geometry preservation, regional isolation and shader layering', async () => {
  const original = T.TextureLoader.prototype.loadAsync;
  let fail = true, requests = 0;
  T.TextureLoader.prototype.loadAsync = async function (url: string) {
    requests++;
    if (fail && url.includes('nor_gl')) throw new Error('simulated image failure');
    return new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  };
  try {
    const { surface } = buildFieldTerrain(VERDANT_TERRAIN), material = surface.material as T.MeshStandardMaterial;
    const fallback = material.map;
    const positions = Array.from(surface.geometry.attributes.position.array), indices = Array.from(surface.geometry.index!.array);
    await assert.rejects(enhancePadangTerrainSurface(surface), /simulated image failure/);
    assert.equal(material.map, fallback); assert.equal(material.normalMap, null);
    fail = false;
    await enhancePadangTerrainSurface(surface);
    assert.equal(requests, 12, 'failed request must not poison the cache; grass textures load once');
    assert.equal(material.userData.terrainMaterialRevision, 4);
    assert.equal(material.userData.roadMaterialId, 'arunika.path_dirt');
    assert.equal(material.userData.grassSource, 'grass_medium_01_4k.blend.zip');
    assert.equal((material.normalMap as T.Texture | null)?.flipY, true);
    assert.equal((material.normalMap as T.Texture | null)?.colorSpace, T.NoColorSpace);
    assert.equal(material.roughnessMap?.colorSpace, T.NoColorSpace);
    assert.deepEqual(Array.from(surface.geometry.attributes.position.array), positions);
    assert.deepEqual(Array.from(surface.geometry.index!.array), indices);
    assert.equal(material.displacementMap, null);
    const east = buildFieldTerrain(EAST_GATE_TERRAIN).surface, eastMap = (east.material as T.MeshStandardMaterial).map;
    await enhancePadangTerrainSurface(east, EAST_GATE_TERRAIN);
    assert.equal((east.material as T.MeshStandardMaterial).map, eastMap);
    assert.equal(requests, 12);
    const shader = { uniforms: {}, vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as T.WebGLRenderer);
    assert.ok(shader.fragmentShader.indexOf('vec3 rockyAlbedo') > shader.fragmentShader.indexOf('#include <color_fragment>'));
    assert.ok(shader.fragmentShader.includes('normalize(rockyNormal), rockyWeight)'));
    assert.ok(shader.fragmentShader.includes('0.22 * rockyRoughness, rockyWeight)'));
    assert.ok(shader.vertexShader.includes('vArunikaXZ = position.xz'));
    assert.ok(!shader.vertexShader.includes('vTerrainWorldPosition = worldPosition.xyz'));
    const disposed = buildFieldTerrain(VERDANT_TERRAIN).surface;
    const pending = enhancePadangTerrainSurface(disposed);
    (disposed.material as T.Material).dispose();
    await pending;
    assert.equal((disposed.material as T.Material).userData.terrainMaterialRevision, undefined);
  } finally { T.TextureLoader.prototype.loadAsync = original; }
});

await test('manifest points to available 2K runtime images, not the broken legacy PNGs', () => {
  const root = new URL('../../public/assets/materials/terrain/arunika/rocky-terrain-02/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.revision, 2);
  for (const file of Object.values(manifest.runtimeMaps) as string[]) assert.ok(readFileSync(new URL(file, root)).length > 0);
  assert.match(manifest.runtimeMaps.normalOpenGL, /v2\.webp$/);
});
