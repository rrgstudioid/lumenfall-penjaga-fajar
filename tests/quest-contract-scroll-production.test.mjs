import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
await test('production rejects navigation, scroll acquisition/use/shop but preserves saved items and receipts',async()=>{
  const out=process.env.WARRIOR_REFERENCE_CHECKPOINT;assert(out);
  const server=await createServer({configFile:false,mode:'production',appType:'custom',define:{'process.env.NODE_ENV':'"production"'},
    optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(out,'prod-cache'),server:{middlewareMode:true,hmr:false}});
  try{
    const {readDevelopmentQuestNavigation}=await server.ssrLoadModule('/lib/game/quest-navigation-game.ts');
    const actor=new Proxy({}, {get(){throw Error('Production must not read actor');}});
    assert.equal(readDevelopmentQuestNavigation(actor,'anything').reason,'DEVELOPMENT_ONLY');
    const items=await server.ssrLoadModule('/lib/game/items.ts'),rules=await server.ssrLoadModule('/lib/game/rules.ts'),shops=await server.ssrLoadModule('/lib/game/city-services.ts'),scrolls=await server.ssrLoadModule('/lib/game/map-scroll-contract.ts');
    assert.deepEqual(scrolls.availableMapScrollPacks(actor,'anything'),[]);
    const row=scrolls.MAP_SCROLLS[0];assert.throws(()=>items.createItem(row.templateId),/DEVELOPMENT_ONLY/);
    const saved=items.normalizeItem({...items.ITEM_CATALOG[row.templateId],id:'owned-development-scroll',quantity:5});assert(saved);assert.equal(saved.quantity,5);assert.equal(saved.useEffect.type,'mapTeleport');
    const h=rules.freshHero();h.inventory.push(saved);h.cityProgress[scrolls.mapScrollReceipt(row.region)]=1;
    assert(!rules.consumeInventoryItem(h,saved.id).ok);assert.equal(h.inventory.find(i=>i.id===saved.id).quantity,5);
    for(const service of ['consumable','developer-materials','equipment'])assert(!shops.shopStock(h,service).some(i=>scrolls.mapScroll(i.templateId)));
    assert(!shops.buyShopItem(h,row.templateId,'consumable').ok);
    const loaded=rules.parseSave(JSON.stringify(h));assert.equal(loaded.inventory.find(i=>i.id===saved.id).quantity,5);assert.equal(loaded.cityProgress[scrolls.mapScrollReceipt(row.region)],1);
    const early=await server.ssrLoadModule('/lib/game/early-quest-contract.ts');
    const regions=await server.ssrLoadModule('/lib/game/regions.ts');
    assert.deepEqual(early.earlyQuests(),[]);assert.deepEqual(early.developmentQuestNpcs(),[]);
    assert(!regions.getQuestRegistry().some(q=>q.id.startsWith('dev-quest-v1-')));
    for(const f of Object.values(regions.FIELDS))assert(!regions.regionNpcs(f.id).some(n=>n.id.startsWith('dev-')));
    const source={id:'ironveil-mines-1',level:8,variant:'normal',attack:123};
    assert.deepEqual(early.questTargetLevel(source,'ironveil-mines-exterior-v1'),source);
    assert.throws(()=>items.createItem(early.MINE_SAMPLE_ID),/DEVELOPMENT_ONLY/);
    const sample=items.normalizeItem({...items.ITEM_CATALOG[early.MINE_SAMPLE_ID],id:'saved-sample',quantity:3});
    assert(sample);assert.equal(sample.quantity,3);assert.equal(sample.isQuestItem,true);
    h.inventory.push(sample);h.activeQuests.push('dev-quest-v1-iron-interior-survey');
    const restored=rules.parseSave(JSON.stringify(h));assert.equal(restored.inventory.find(i=>i.id==='saved-sample').quantity,3);assert(restored.activeQuests.includes('dev-quest-v1-iron-interior-survey'));
  }finally{await server.close();}
});
