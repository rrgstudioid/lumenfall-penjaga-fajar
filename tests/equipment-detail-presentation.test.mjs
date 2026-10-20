// Presentation/source proof only. No Game constructor, gameplay activation or catalog mutation.
import test,{after} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {createServer} from 'vite';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const output=process.env.EQUIPMENT_CHECKPOINT;assert(output);
const server=await createServer({configFile:false,appType:'custom',cacheDir:path.join(output,'presentation-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}}});

const items=await server.ssrLoadModule('/lib/game/items.ts'),p=await server.ssrLoadModule('/lib/game/equipment-detail-presentation.ts'),core=await server.ssrLoadModule('/lib/game/equipment-authoring-v1.ts'),rules=await server.ssrLoadModule('/lib/game/rules.ts'),view=await server.ssrLoadModule('/lib/game/character-view.ts');
const copy=id=>({...structuredClone(items.ITEM_CATALOG[id]),id:'test-'+id,quantity:1});
const newDagger=()=>({...copy(core.TRAINING_DAGGER_TEMPLATE),authoredEquipmentVersion:core.EQUIPMENT_AUTHORING_VERSION,authoredEquipmentProfile:core.TRAINING_DAGGER_PROFILE});
const detail=i=>p.equipmentDetail(i,{development:true});
await test('authored Dagger core range and enhancement are one contribution; compatibility is explicit',()=>{
 const i={...newDagger(),enhancementLevel:10};const d=detail(i);assert.equal(d.core.length,1);assert.equal(d.core[0].value,'11.2–15.4');assert.equal(d.core[0].base,'8–11');assert.equal(d.core[0].enhancement,'3.2–4.4');assert(d.notes.some(x=>x.includes('compatibility')));assert(d.diagnostics.some(x=>x.includes(core.EQUIPMENT_AUTHORING_VERSION)));
});
await test('Iron and Jay new exact markers versus grandfather scalar, +N does not invent range',()=>{
 const iron={...copy('field-ironveil-mines-sword'),levelRequirement:10,authoredAttackVersion:'IRON_SWORD_LV10_BASE_V1'};
 const jay={...copy('jayantara-two-hand-sword'),levelRequirement:45,authoredAttackVersion:'JAYANTARA_LV45_BASE_V1'};
 assert.equal(detail(iron).core[0].value,'32–36');assert.equal(detail(jay).core[0].value,'196–204');assert.equal(detail(jay).intrinsic.find(r=>r.key==='str').value,'+4');
 for(const [i,level,scalar] of [[iron,8,'14'],[jay,24,'46']]){const old={...i,levelRequirement:level,authoredAttackVersion:undefined};assert.equal(detail(old).core[0].value,scalar);assert.match(detail(old).core[0].label,/scalar/);assert.match(detail({...i,enhancementLevel:1}).core[0].label,/scalar/);}
});
await test('armor fixed base+template bonus stay intrinsic; not all bonusStats are options',()=>{
 const d=detail(copy('arunika-head'));assert.equal(d.core[0].label,'Physical Defense');assert.equal(d.core[0].value,'3');assert.deepEqual(d.intrinsic.map(r=>[r.key,r.value]),[['hp','+8'],['vit','+1']]);assert.equal(d.options.length,0);assert.equal(d.description,null);
});
await test('mixed template+rolled provenance remains neutral without guessed subtraction',()=>{
 const d=detail({...copy('arunika-head'),bonusStats:{vit:3,maxMana:10}});assert.equal(d.options.length,0);assert.deepEqual(d.uncertain.map(r=>[r.key,r.value]),[['vit','+3'],['maxMana','+10']]);assert.equal(d.intrinsic.filter(r=>r.key==='vit').length,0);
});
await test('instance options, locked values, Rune and empty socket counted once',()=>{
 const i={...newDagger(),bonusStats:{critRate:2},sockets:[{id:'s1',rune:{name:'Mechanical Rune',affixes:[{stat:'vit',value:2}],uniqueEffect:null}},{id:'s2',rune:null}]};const d=detail(i);
 assert.equal(d.options[0].value,'+2%');assert.equal(d.sockets[0].rows[0].value,'+2');assert.equal(d.sockets[1].name,null);assert(![...d.intrinsic,...d.options,...d.core].some(r=>r.key==='vit'));
 const locked=detail({...i,uniqueStatsLocked:true});assert.equal(locked.options.length,0);assert(locked.locked);assert.equal(locked.sockets[0].rows[0].value,'+2');
});
await test('jewelry/support/Wings use actual retained scalar stats, no guessed magic range',()=>{
 for(const id of ['fajar-necklace','arcana-tome','resi-orb','dragon-veil-wings']){const i=copy(id),d=detail(i);assert.equal(d.core.length,0);assert.equal(d.sets.length,0);assert.equal(d.intrinsic.length,Object.entries(i.baseStats).filter(([,n])=>n).length+Object.entries(i.bonusStats).filter(([,n])=>n).length);}
});
await test('flavor retained, generated stat description removed, effect descriptor not active promise',()=>{
 const d=detail({...copy('arunika-head'),description:'Existing custom flavor.',uniqueEffect:'Critical attacks recover Mana.'});assert.equal(d.description,'Existing custom flavor.');assert.match(d.effects[0].status,/belum terverifikasi/);assert.equal(detail(copy('arunika-head')).description,null);
});
const ids=['arunika-head','forest-vest','arunika-legs','arunika-boots'],pieces=ids.map(copy),set={id:'UI fixture',level:15,pieces:ids,bonuses:{2:{},3:{},4:{}},enabled:true};
await test('set fixture0/2/3/4 cumulative flags; no live registry membership inferred',()=>{
 for(const n of [0,2,3,4]){const owner={inventory:pieces,equipment:Object.fromEntries(pieces.slice(0,n).map(i=>[i.equipSlot,i.id]))};const d=p.equipmentSetPresentation(pieces[0],owner,[set])[0];assert.equal(d.count,n);assert.deepEqual(d.thresholds.map(t=>t.active),[n>=2,n>=3,n>=4]);assert.equal(p.equipmentDetail(pieces[0],{owner}).sets.length,0);}
});
await test('inventory alone, duplicate identity and invalid slot cannot inflate set count',()=>{
 assert.equal(p.equipmentSetPresentation(pieces[0],{inventory:pieces,equipment:{}},[set])[0].count,0);
 assert.equal(p.equipmentSetPresentation(pieces[0],{inventory:pieces,equipment:{head:pieces[0].id,legs:pieces[0].id}},[set])[0].count,1);
 assert.equal(p.equipmentSetPresentation(pieces[0],{inventory:[...pieces,pieces[0]],equipment:{head:pieces[0].id}},[set])[0].count,0);
 assert.equal(p.equipmentSetPresentation(pieces[0],{inventory:pieces,equipment:{offHand:pieces[0].id}},[set])[0].count,0);
 assert.equal(p.equipmentSetPresentation(pieces[0],{inventory:pieces,equipment:{}},[{...set,enabled:false}]).length,0);
});
await test('equipped requires exact current owned instance, not only copied id',()=>{
 const i=copy('arunika-head'),owner={inventory:[i],equipment:{head:i.id}};assert(p.equipmentDetail(i,{owner}).equipped);assert(!p.equipmentDetail({...i},{owner}).equipped);assert(!p.equipmentDetail(i,{owner:{...owner,equipment:{}}}).equipped);
});
await test('presentation and legal equipment preview preserve actor, item, RNG and storage',()=>{
 const hero=rules.createV3AdventurerHero('detail-purity'),i=copy('arunika-head');hero.inventory.push(i);const before=JSON.stringify(hero),oldRandom=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('Presentation RNG');};
 try{for(let n=0;n<50;n++){const d=p.equipmentDetail(i,{owner:hero,development:true});assert(Object.isFrozen(d)&&Object.isFrozen(d.intrinsic));const preview=view.previewEquipmentChange(hero,i,'head');assert(preview.validation.ok);assert.equal(preview.hero.equipment.head,i.id);}assert.equal(JSON.stringify(hero),before);assert.equal(draws,0);}finally{Math.random=oldRandom;}
});
await test('unknown authored source visibly unavailable; input not normalized or mutated',()=>{
 const i={...newDagger(),authoredEquipmentVersion:'UNKNOWN'},before=JSON.stringify(i);const d=detail(i);assert(d.notes.some(n=>n.includes('belum tersedia')));assert.match(d.core[0].label,/scalar/);assert.equal(JSON.stringify(i),before);assert(d.diagnostics.length);
});
await test('shared renderer orders sources and hides diagnostics behind disclosure, no false set',async()=>{
 const {EquipmentDetail}=await server.ssrLoadModule('/components/game/equipment-detail.tsx');
 const i={...newDagger(),description:'Mechanical fixture flavor',baseStats:{attack:8,hp:9},bonusStats:{vit:2},uniqueEffect:'Descriptor only',sockets:[{id:'empty',rune:null}]};
 const html=renderToStaticMarkup(React.createElement(EquipmentDetail,{item:i,game:null}));
 const keys=['core','intrinsic','description','options','retained','runes'];let last=-1;
 for(const key of keys){const index=html.indexOf(`data-equipment-section="${key}"`);assert(index>last,`${key} order`);last=index;}
 assert(html.includes('<details class="eq-detail-inspection">'));assert(html.indexOf(core.EQUIPMENT_AUTHORING_VERSION)>html.indexOf('<summary>Inspeksi development</summary>'));assert(!html.includes('data-equipment-section="set"'));
 const compact=renderToStaticMarkup(React.createElement(EquipmentDetail,{item:i,game:null,compact:true}));assert(!compact.includes(core.EQUIPMENT_AUTHORING_VERSION));assert(compact.includes('8–11'));
});
await test('returned DTO is detached and deeply immutable',()=>{
 const i=newDagger(),before=JSON.stringify(i),d=detail(i);assert.throws(()=>{d.core[0].value='forged';},TypeError);assert.throws(()=>d.notes.push('fake'),TypeError);assert.equal(JSON.stringify(i),before);assert.deepEqual(detail(i),d);
});

await test('Forge comparison retains authored range and legacy intrinsic sources without changing permission',()=>{
 const dagger=newDagger(),head=copy('arunika-head');
 const before=JSON.stringify([dagger,head]);
 const compare=i=>p.equipmentDetailComparison(detail(i),detail({...i,enhancementLevel:1}));
 assert.deepEqual(compare(dagger).map(r=>[r.before,r.after]),[['8–11','8.32–11.44']]);
 assert.deepEqual(compare(head).map(r=>[r.label,r.before,r.after]),[['Physical Defense','3','3.24'],['Max HP','+8','+8.64'],['VIT','+1','+1']]);
 const hero=rules.createV3AdventurerHero('forge-display');hero.inventory.push(dagger);
 assert.match(rules.enhancementPreview(hero,dagger.id).blockedReason,/HOLD/);
 assert.equal(JSON.stringify([dagger,head]),before);
});
after(()=>server.close());
