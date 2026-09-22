import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildFieldTerrain } from '../lib/game/field-terrain-renderer.ts';
import { VERDANT_TERRAIN, EAST_GATE_TERRAIN } from '../lib/game/field-terrain.ts';
import assert from 'node:assert/strict';
import * as T from 'three';
const snapshot = {};
for (const terrain of [VERDANT_TERRAIN, EAST_GATE_TERRAIN]) {
  const { group } = buildFieldTerrain(terrain);
  const triangles = [], instances = [], materials = {};
  group.updateMatrixWorld(true);
  group.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.materialOnlyEffect) return;
    const geometry = mesh.geometry, p = geometry.attributes.position, index = geometry.index;
    if (mesh.isInstancedMesh) instances.push(Array.from(mesh.instanceMatrix.array));
    // Batching may change; triangle positions, winding, transforms and counts may not.
    for (let i=0;i<(index?.count ?? p.count);i+=3) {
      const tri=[];
      for(let j=0;j<3;j++) { const n=index ? index.getX(i+j) : i+j, v=new T.Vector3(p.getX(n),p.getY(n),p.getZ(n)).applyMatrix4(mesh.matrixWorld); tri.push(v.x.toFixed(4),v.y.toFixed(4),v.z.toFixed(4)); }
      triangles.push(tri.join(','));
    }
    const m=mesh.material;
    materials[m.name || m.type]=(materials[m.name || m.type]??0)+1;
  });
  snapshot[terrain.id]={geometryHash:createHash('sha256').update(triangles.sort().join('\n')).digest('hex'), triangles:triangles.length,
    instanceHash:createHash('sha256').update(JSON.stringify(instances)).digest('hex'), layout:JSON.stringify(terrain), materials};
}
const path='work/arunika-material/layout-before.json';
if(process.argv.includes('--record')) writeFileSync(path,JSON.stringify(snapshot,null,2));
else {
  const before=JSON.parse(readFileSync(path,'utf8'));
  for(const id of Object.keys(before)) for(const key of ['geometryHash','triangles','instanceHash','layout']) assert.equal(snapshot[id][key],before[id][key],id+' '+key);
  assert.deepEqual(snapshot['east-gate-arunika'].materials,before['east-gate-arunika'].materials);
  console.log('PASS: all existing triangles, transforms, instance placement and layout unchanged; East Gate materials unchanged.');
  writeFileSync('work/arunika-material/layout-after.json',JSON.stringify(snapshot,null,2));
}
