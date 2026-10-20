import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
await test('production transformed navigation rejects before reading Game or quest state',async()=>{
  const out=process.env.WARRIOR_REFERENCE_CHECKPOINT;assert(out);
  const server=await createServer({configFile:false,mode:'production',appType:'custom',define:{'process.env.NODE_ENV':'"production"'},
    optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(out,'prod-cache'),server:{middlewareMode:true,hmr:false}});
  try{
    const {readDevelopmentQuestNavigation}=await server.ssrLoadModule('/lib/game/quest-navigation-game.ts');
    const actor=new Proxy({}, {get(){throw Error('Production must not read actor');}});
    assert.equal(readDevelopmentQuestNavigation(actor,'anything').reason,'DEVELOPMENT_ONLY');
  }finally{await server.close();}
});
