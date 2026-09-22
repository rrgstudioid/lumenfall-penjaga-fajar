import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ArunikaMaterials, ARUNIKA_SURFACES, addArunikaSurfaceUv, setArunikaShrineMaterials } from './arunika-surface-materials.ts';
import { buildFieldTerrain } from './field-terrain-renderer.ts';
import { VERDANT_TERRAIN, EAST_GATE_TERRAIN } from './field-terrain.ts';

test('all surface families are lightweight, distinctly named and share one region-owned clock',()=>{
  const palette=new ArunikaMaterials();
  for(const kind of Object.keys(ARUNIKA_SURFACES) as Array<keyof typeof ARUNIKA_SURFACES>) {
    const mat=palette.get(kind),shader={uniforms:{} as Record<string,unknown>,vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
    assert.equal(mat,palette.get(kind));assert.equal(mat.name,'arunika.'+kind);
    assert.equal(mat.map,null);assert.equal(mat.normalMap,null);assert.equal(mat.displacementMap,null);
    mat.onBeforeCompile(shader as Parameters<typeof mat.onBeforeCompile>[0],{} as T.WebGLRenderer);
    assert.equal(shader.uniforms.uATime,palette.time);
    assert.ok(shader.vertexShader.includes('instanceMatrix*aWorld'));
    assert.ok(!shader.vertexShader.includes('vAP=worldPosition.xyz'));
    assert.ok(shader.fragmentShader.includes('float roughnessFactor=aRough;'));
  }
  assert.notEqual(palette.get('temple_stone'),palette.get('rock_natural'));
  assert.notEqual(palette.get('roof_tiles'),palette.get('wood_planks'));
  let disposed=0;for(const mat of palette.cache.values())mat.addEventListener('dispose',()=>disposed++);
  palette.dispose();assert.equal(disposed,Object.keys(ARUNIKA_SURFACES).length);assert.equal(palette.cache.size,0);
});

test('upright and horizontal boxes have finite, noncollapsed physical UVs without changing vertices',()=>{
  const geo=new T.BoxGeometry(4,3,2).toNonIndexed(),before=Array.from(geo.attributes.position.array);
  addArunikaSurfaceUv(geo);
  assert.deepEqual(Array.from(geo.attributes.position.array),before);
  const uv=geo.attributes.arunikaUv;
  for(let i=0;i<uv.count;i+=3) {
    const area=(uv.getX(i+1)-uv.getX(i))*(uv.getY(i+2)-uv.getY(i))-(uv.getX(i+2)-uv.getX(i))*(uv.getY(i+1)-uv.getY(i));
    assert.ok(Math.abs(area)>.1);
  }
});

test('Padang static objects are assigned by function; East Gate does not adopt the palette',()=>{
  const palette=new ArunikaMaterials(),padang=buildFieldTerrain(VERDANT_TERRAIN,palette);
  const names=new Set<string>();let extra=0;
  padang.group.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    const mat=object.material as T.Material;
    if(mat.userData.arunikaSurface) {
      names.add(mat.userData.arunikaSurface);
      assert.ok(object.geometry.attributes.arunikaUv);
    }
    if(object.userData.materialOnlyEffect)extra++;
    if(object.name==='landscape-static'||object.name==='landscape-instanced')assert.ok(mat.userData.arunikaSurface);
  });
  for(const kind of ['temple_stone','rock_natural','cliff_rock','distant_rock','wood_planks','wood_beams','wood_props','roof_tiles','fabric_canvas','fabric_banner','soil_tilled','crop_foliage','flower_foliage','fire_effect','embers','water_river','water_pond','waterfall','distant_water'])assert.ok(names.has(kind),kind);
  assert.equal(extra,4,'only decorative fuel and one ember batch added inside the existing campfire');
  const east=buildFieldTerrain(EAST_GATE_TERRAIN,palette);
  east.group.traverse(object=>{if(object instanceof T.Mesh)assert.equal((object.material as T.Material).userData.arunikaSurface,undefined);});
});

test('shared shrine restores original materials after travelling away, including repeated visits',()=>{
  const shrine=new T.Group(),stone=new T.MeshStandardMaterial({color:'gray'}),crystal=new T.MeshStandardMaterial({color:'cyan'});
  const base=new T.Mesh(new T.CylinderGeometry(3,3,.3,8),stone),gem=new T.Mesh(new T.OctahedronGeometry(.7),crystal);
  shrine.add(base,gem);const vertices=Array.from(base.geometry.attributes.position.array);
  for(let i=0;i<3;i++) {
    const palette=new ArunikaMaterials();setArunikaShrineMaterials(shrine,palette);
    assert.equal(base.material.name,'arunika.shrine_stone');assert.equal(gem.material.name,'arunika.crystal_material');
    setArunikaShrineMaterials(shrine,null);palette.dispose();
    assert.equal(base.material,stone);assert.equal(gem.material,crystal);
    assert.deepEqual(Array.from(base.geometry.attributes.position.array),vertices);
  }
});
