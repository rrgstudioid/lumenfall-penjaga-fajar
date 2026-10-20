import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';
const out=process.env.EQUIPMENT_CHECKPOINT;assert(out);
const server=await createServer({configFile:false,appType:'custom',cacheDir:path.join(out,'weapon-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false}});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts');
const core=await load('equipment-authoring-v1'),weapon=await load('weapon-progression-v1'),items=await load('items'),rules=await load('rules'),detail=await load('equipment-detail-presentation'),shop=await load('city-services');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/weapon-progression-approved.json',import.meta.url)));
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const range=(r,a)=>{assert(r);close(r.min,a[0]);close(r.max,a[1]);};
// Independent decimal rational authoring oracle: avoids rounded-display feedback and binary-half drift.
const roundProduct=(...values)=>{let n=1n,d=1n;for(const x of values){const [a,b='']=String(x).split('.');n*=BigInt(a+b);d*=10n**BigInt(b.length);}return Number((2n*n+d)/(2n*d));};
for(const family of new Set(fixture.rows.map(r=>r.family)))await test(family+' all approved rows, separate channels and +0/+5/+10/+15',()=>{
 for(const row of fixture.rows.filter(r=>r.family===family)){
  const authored=row.budget100.map((v,i)=>roundProduct(v,row.factor,family==='bow'&&i===1?1.21:1));
  assert.deepEqual(row.MATK??row.PATK,authored);
  for(const n of [0,5,10,15]){const got=core.resolveEquipmentCore(weapon.weaponProfileId(family,row.level),n);assert(got.ok);range(got.PATK,row.PATK.map(v=>v*(100+4*n)/100));
   if(row.MATK)range(got.MATK,row.MATK.map(v=>v*(100+4*n)/100));else assert.equal(got.MATK,null);
   assert(Object.isFrozen(got)&&Object.isFrozen(got.profile)&&Object.isFrozen(got.PATK));
  }
 }
});
await test('Bow authoring from original upper, never rounded display or runtime 1.21',()=>{
 for(const [L,low,high] of [[60,173,246],[80,228,324],[95,270,383]])range(core.resolveEquipmentCore(weapon.weaponProfileId('bow',L),0).PATK,[low,high]);
 range(core.resolveEquipmentCore(weapon.weaponProfileId('bow',24),0).PATK,[74,105]); // round(86.4*1.21), not round(86*1.21)=104
});
await test('27 exact Common field mappings preserve original requirements/prices/permissions; anchors stay on old versions',()=>{
 assert.equal(core.DEVELOPMENT_WEAPON_MAPPINGS.length,27);
 for(const m of core.DEVELOPMENT_WEAPON_MAPPINGS){const i=items.createItem(m.templateId,{sockets:[]});assert(core.resolveAuthoredEquipmentItem(i).ok,JSON.stringify(i));assert.equal(i.levelRequirement,m.level);assert.equal(i.buyValue,80+18*m.level);assert.equal(i.sellValue,20+4*m.level);assert.deepEqual(i.allowedJobs,items.ITEM_CATALOG[m.templateId].allowedJobs);}
 for(const id of ['field-verdant-plains-sword','field-ironveil-mines-sword','jayantara-two-hand-sword','field-meteorfall-citadel-sword','whispering-offhand-dagger','arcana-tome'])assert.equal(items.createItem(id).authoredEquipmentVersion,undefined,id);
 assert.equal(items.createItem('field-ironveil-mines-sword').levelRequirement,10);assert.equal(items.createItem('jayantara-two-hand-sword').levelRequirement,45);
});
await test('old/new/mixed parser, contradictory source and unknown versions fail visibly without conversion',()=>{
 for(const m of core.DEVELOPMENT_WEAPON_MAPPINGS){const modern=items.createItem(m.templateId,{sockets:[]}),old={...modern,id:'old',enhancementLevel:6,bonusStats:{str:2}};delete old.authoredEquipmentVersion;delete old.authoredEquipmentProfile;
  const copy=items.normalizeItem(JSON.parse(JSON.stringify(old)));assert.equal(copy.authoredEquipmentVersion,undefined);assert.equal(copy.enhancementLevel,6);assert.deepEqual(copy.baseStats,old.baseStats);assert.deepEqual(copy.bonusStats,old.bonusStats);
  assert(core.resolveAuthoredEquipmentItem(items.normalizeItem(JSON.parse(JSON.stringify(modern)))).ok);
  for(const delta of [{authoredEquipmentVersion:'UNKNOWN'},{authoredEquipmentProfile:'UNKNOWN'},{rarity:'epic'},{levelRequirement:99},{baseStats:{attack:999}},{authoredAttackVersion:'foreign'},{allowedJobs:[]},{requiredCoreJob:'mage'}])assert(!core.resolveAuthoredEquipmentItem({...modern,...delta}).ok);
 }
 for(const n of [NaN,Infinity,-1,16,.5])assert(!core.resolveEquipmentCore(weapon.weaponProfileId('staff',60),n).ok);
});
await test('separate MATK/PATK detail and Forge projections are pure; fixed options/Rune not enhanced twice',()=>{
 const i=items.createItem('field-ironveil-mines-staff',{sockets:[],bonusStats:{str:2,magicAttack:3}}),before=JSON.stringify(i);
 for(const n of [0,5,10,15]){const copy={...i,enhancementLevel:n},d=detail.equipmentDetail(copy,{development:true}),p=core.resolveAuthoredEquipmentItem(copy);assert(p.ok);
  assert.equal(d.core.find(x=>x.key==='attack').value,`${Number((12*(1+.04*n)).toFixed(4))}–${Number((13*(1+.04*n)).toFixed(4))}`);
  assert.equal(d.core.find(x=>x.key==='magicAttack').value,`${Number((33*(1+.04*n)).toFixed(4))}–${Number((37*(1+.04*n)).toFixed(4))}`);
  assert(Object.isFrozen(d));assert.equal(p.retainedBase.attack,undefined);assert.equal(items.calculateEquipmentStats(copy).str,2);assert.equal(items.calculateEquipmentStats(copy).magicAttack,3);
 }
 assert.equal(JSON.stringify(i),before);
 const h=rules.createV3AdventurerHero('forge-own');h.inventory.push(i);const snapshot=JSON.stringify(h);assert.match(rules.enhancementPreview(h,i.id).blockedReason,/HOLD/);assert.equal(rules.enhanceItem(h,i.id,0).attempted,false);assert.equal(JSON.stringify(h),snapshot);
 const d0=detail.equipmentDetail(i,{development:true}),d1=detail.equipmentDetail({...i,enhancementLevel:1},{development:true});const comparison=detail.equipmentDetailComparison(d0,d1);assert.equal(comparison.filter(x=>x.id.startsWith('core-')).length,2);assert.equal(comparison.find(x=>x.id.startsWith('options-magicAttack')).before,comparison.find(x=>x.id.startsWith('options-magicAttack')).after);
});
await test('actual city purchase and existing equip rules, old/new save roundtrip; mechanical funds, no rank/SP injected',()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const h=rules.createV3AdventurerHero('weapon-own');while(h.level<15)rules.gainXP(h,rules.xpNeeded(h.level));
 // Equipment permission is checked by original rules; no new permission inferred from range.
 h.gold=10000;const before=h.gold,result=shop.buyShopItem(h,'field-ironveil-mines-staff','equipment',1);assert(result.ok,JSON.stringify(result));assert.equal(h.gold,before-224);
 const i=h.inventory.find(x=>x.templateId==='field-ironveil-mines-staff');assert(i&&core.resolveAuthoredEquipmentItem(i).ok);
 // Existing compatibility permits non-dagger equipment before Core (null coreJob).
 // Preserve that behavior; the range marker adds no permission.
 assert.equal(rules.canEquipItem(i,h).ok,true);assert.equal(rules.canEquipItem({...i,authoredEquipmentVersion:undefined,authoredEquipmentProfile:undefined},h).ok,true);
 assert.equal(rules.canEquipItem(items.createItem('field-ironveil-mines-dagger'),h).ok,false);
 rules.saveCharacter(h,true);const loaded=rules.loadCharacter(h.slotId);assert(loaded);const restored=loaded.inventory.find(x=>x.id===i.id);assert(restored&&core.resolveAuthoredEquipmentItem(restored).ok);assert.equal(loaded.gold,h.gold);
});
after(async()=>{await server.close();});
