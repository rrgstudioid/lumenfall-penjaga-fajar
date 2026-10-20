import {rolloutDisabled} from './helpers/rollout-disabled.mjs';
// Explicit rollout-disabled compatibility fixture; not shipping-mode proof.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
assert(process.env.EQUIPMENT_CHECKPOINT);
const server=await createServer({configFile:false,plugins:[rolloutDisabled()],mode:'production',define:{'process.env.NODE_ENV':'"production"'},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},cacheDir:process.env.EQUIPMENT_CHECKPOINT+'/production-cache'});
try {
 const items=await server.ssrLoadModule('/lib/game/items.ts'),rules=await server.ssrLoadModule('/lib/game/rules.ts'),core=await server.ssrLoadModule('/lib/game/equipment-authoring-v1.ts'),{Game}=await server.ssrLoadModule('/lib/game/world.ts');
 const item=items.createItem(core.TRAINING_DAGGER_TEMPLATE,{sockets:[]});
 assert.equal(item.authoredEquipmentVersion,undefined);assert.equal(item.authoredEquipmentProfile,undefined);assert.equal(item.baseStats.attack,8);assert.equal(item.levelRequirement,1);
 const old=items.normalizeItem({...item,id:'old-own',enhancementLevel:6});assert.equal(old.authoredEquipmentVersion,undefined);assert.equal(old.enhancementLevel,6);
 const saved=items.normalizeItem({...item,id:'own-saved-new',authoredEquipmentVersion:core.EQUIPMENT_AUTHORING_VERSION,authoredEquipmentProfile:core.TRAINING_DAGGER_PROFILE,enhancementLevel:10});
 assert.equal(saved.id,'own-saved-new');assert(core.resolveAuthoredEquipmentItem(saved).ok);
 assert.equal(items.createItem('forest-vest').authoredEquipmentVersion,undefined);assert.equal(items.createItem('dragon-veil-wings').maxEnhancementLevel,0);
 for(const m of core.DEVELOPMENT_BODY_MAPPINGS){
  const fresh=items.createItem(m.templateId);assert.equal(fresh.authoredEquipmentVersion,undefined);
  const savedBody=items.normalizeItem({...fresh,authoredEquipmentVersion:core.EQUIPMENT_AUTHORING_VERSION,authoredEquipmentProfile:m.profile,enhancementLevel:5});
  assert.equal(savedBody.authoredEquipmentProfile,m.profile);assert.equal(savedBody.enhancementLevel,5);
  assert.deepEqual(items.calculateEnhancedBaseStats(savedBody),items.calculateEnhancedBaseStats({...fresh,enhancementLevel:5}));
  assert.equal(items.ITEM_CATALOG[m.templateId].authoredEquipmentVersion,undefined);
 }
 const hero=rules.createV3AdventurerHero('production-own');hero.inventory.push(saved);assert.match(rules.enhancementPreview(hero,saved.id).blockedReason,/HOLD/);
 for(const name of ['enableDevelopmentWarriorSpecializationReference','enableDevelopmentWarriorReference','enableDevelopmentAdventurerRanksReference'])assert.equal(Game.prototype[name].call({}).code,'DEVELOPMENT_ONLY');
 assert.equal(items.createItem('jayantara-two-hand-sword').levelRequirement,24);
 for(const m of core.DEVELOPMENT_WEAPON_MAPPINGS){
  const fresh=items.createItem(m.templateId,{sockets:[]});assert.equal(fresh.authoredEquipmentVersion,undefined);assert.equal(fresh.authoredEquipmentProfile,undefined);assert.equal(fresh.baseStats.attack,m.scalar);assert.equal(items.ITEM_CATALOG[m.templateId].authoredEquipmentVersion,undefined);
  const old=items.normalizeItem({...fresh,enhancementLevel:6});assert.equal(old.authoredEquipmentVersion,undefined);assert.equal(items.calculateEnhancedBaseStats(old).attack,m.scalar*(1+6*.08));
  const retained=items.normalizeItem({...fresh,authoredEquipmentVersion:core.EQUIPMENT_AUTHORING_VERSION,authoredEquipmentProfile:m.profile});assert(core.resolveAuthoredEquipmentItem(retained).ok);hero.inventory.push(retained);assert.match(rules.enhancementPreview(hero,retained.id).blockedReason,/HOLD/);
 }
 console.log(JSON.stringify({type:'PRODUCTION_TRANSFORM_GUARD_NOT_BROWSER',newDaggerCreation:'UNMARKED_COMPATIBILITY',savedOldRetained:true,savedNewFieldsRetained:true,developmentActivations:'CLOSED',newForge:'HOLD',oldForgeConfiguration:'UNCHANGED'}));
}finally{await server.close();}
