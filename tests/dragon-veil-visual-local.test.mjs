import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';
const output=process.env.EQUIPMENT_CHECKPOINT;assert(output);
const server=await createServer({configFile:false,appType:'custom',cacheDir:path.join(output,'visual-test-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false,ws:false},resolve:{alias:{'@':process.cwd()}}});
const visual=await server.ssrLoadModule('/lib/game/dragon-veil-visual.ts'),icons=await server.ssrLoadModule('/lib/game/item-icons.ts');
const renderer=await server.ssrLoadModule('/lib/game/dragon-veil-model.ts'),T=await import('three');
await test('exact identities and slots select only four visual pieces; Gloves/unknown/female handling stays separate',()=>{
 const layers=[{slot:'head',item:{templateId:'dragon-veil-head'}},{slot:'chest',item:{templateId:'dragon-veil-armor'}},{slot:'legs',item:{templateId:'dragon-veil-pants'}},{slot:'boots',item:{templateId:'dragon-veil-boots'}},{slot:'gloves',item:{templateId:'arunika-gloves'}}];
 const original=JSON.stringify(layers);assert.deepEqual(visual.dragonVeilLoadout(layers),{head:'dragon-veil-head',chest:'dragon-veil-armor',legs:'dragon-veil-legs',boots:'dragon-veil-boots'});
 assert.deepEqual(visual.dragonVeilLoadout([{slot:'gloves',item:{templateId:'dragon-veil-armor'}},{slot:'chest',item:{templateId:'arunika-chest'}}]),{});assert.equal(JSON.stringify(layers),original);
});
await test('icons resolve original four pieces and pants alias after OWNER restored the catalog',async()=>{
 const {ITEM_CATALOG}=await server.ssrLoadModule('/lib/game/items.ts');
 for(const name of ['head','armor','legs','boots']){const id='dragon-veil-'+name;assert.equal(icons.getItemIconPath(id),'/assets/icons/items/'+id+'.webp');assert.equal(ITEM_CATALOG[id].rarity,'ancient');assert.equal(ITEM_CATALOG[id].source.sourceId,'aruna-developer-materials');}
 assert.equal(icons.getItemIconPath('dragon-veil-pants'),'/assets/icons/items/dragon-veil-legs.webp');assert.equal(icons.getItemIconPath('unknown-dragon'),icons.FALLBACK_ITEM_ICON);
 assert(ITEM_CATALOG['arunika-gloves'].equipSlot==='gloves');
});
await test('OWNER public restoration enables original visuals and icons in production',()=>{
 const mode=process.env.NODE_ENV;process.env.NODE_ENV='production';try{assert.deepEqual(visual.dragonVeilLoadout([{slot:'chest',item:{templateId:'dragon-veil-armor'}}]),{chest:'dragon-veil-armor'});assert.equal(icons.getItemIconPath('dragon-veil-armor'),'/assets/icons/items/dragon-veil-armor.webp');}finally{process.env.NODE_ENV=mode;}
});
function skin(name='pelvis',offset=0){const mesh=new T.SkinnedMesh(new T.BufferGeometry(),new T.MeshStandardMaterial());const bone=new T.Bone();bone.name=name;mesh.add(bone);mesh.bind(new T.Skeleton([bone],[new T.Matrix4().makeTranslation(offset,0,0)]));mesh.skeleton.boneInverses[0].makeTranslation(offset,0,0);return mesh;}
await test('mesh binding reuses body bones, not gameplay stats; rejects incompatible bind pose',()=>{
 const template=skin(),body=skin(),bound=renderer.bindDragonVeilMesh(template,body);assert.equal(bound.skeleton.bones[0],body.skeleton.bones[0]);assert.notEqual(bound.skeleton,body.skeleton);assert.equal(bound.geometry,template.geometry);assert.equal(bound.material,template.material);
 assert.throws(()=>renderer.bindDragonVeilMesh(skin('other'),body),/skeleton mismatch/);assert.throws(()=>renderer.bindDragonVeilMesh(skin('pelvis',1),body),/bind pose mismatch/);bound.skeleton.dispose();
});
await test('historical GLB and icon payloads are valid and cover every supported LOD',()=>{
 for(const name of ['head','armor','legs','boots'])for(let lod=0;lod<4;lod++){const bytes=fs.readFileSync(`public/assets/equipment/dragon-veil/${name}-lod${lod}.glb`);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert(json.skins.length>0);assert(json.meshes.length>0);}
 for(const name of ['head','armor','legs','boots']){const b=fs.readFileSync(`public/assets/icons/items/dragon-veil-${name}.webp`);assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}
});
after(()=>server.close());
