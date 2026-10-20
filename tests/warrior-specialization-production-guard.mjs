// Production-mode transformed original modules; no Game construction or browser.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
assert(process.env.SPECIALIZATION_CHECKPOINT,'Explicit isolated production-guard cache directory required');
const server=await createServer({configFile:false,mode:'production',define:{'process.env.NODE_ENV':'"production"'},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},cacheDir:process.env.SPECIALIZATION_CHECKPOINT+'/production-guard-cache'});
try {
 const {createItem,normalizeItem,ITEM_CATALOG}=await server.ssrLoadModule('/lib/game/items.ts');
 const {Game}=await server.ssrLoadModule('/lib/game/world.ts');
 const item=createItem('jayantara-two-hand-sword',{sockets:[]});
 assert.equal(item.levelRequirement,24);assert.equal(item.authoredAttackVersion,undefined);
 assert.equal(ITEM_CATALOG['jayantara-two-hand-sword'].levelRequirement,24);
 for(const name of ['enableDevelopmentWarriorSpecializationReference','enableDevelopmentWarriorReference','enableDevelopmentAdventurerRanksReference'])
   assert.equal(Game.prototype[name].call({}).code,'DEVELOPMENT_ONLY');
 const saved=normalizeItem({...item,id:'own-authored-save',levelRequirement:45,authoredAttackVersion:'JAYANTARA_LV45_BASE_V1'});
 assert.equal(saved.levelRequirement,45);assert.equal(saved.id,'own-authored-save');
 console.log(JSON.stringify({utc:new Date().toISOString(),productionAcquisition:{level:item.levelRequirement,marker:item.authoredAttackVersion??null},guards:3,savedAuthoredFieldsRetained:true}));
} finally {await server.close();}
