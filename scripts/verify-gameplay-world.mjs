import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
// Execute production world methods without WebGL. This is NOT a browser test.
const server=await createServer({configFile:false,resolve:{alias:{'@':process.cwd()}},server:{middlewareMode:true},appType:'custom'});
try {
  const { Game }=await server.ssrLoadModule('/lib/game/world.ts');
  const { createV3AdventurerHero, derivedStats }=await server.ssrLoadModule('/lib/game/rules.ts');
  const { resolveCombatDamage }=await server.ssrLoadModule('/lib/game/combat-resolver.ts');
  const hero=createV3AdventurerHero('world-verification','World verification'); hero.level=80;
  const stats=derivedStats(hero);
  const runtime={hero,combatTime:0,float:()=>{},effect:()=>{}};
  const target={hp:10000,max:10000,dummy:true,boss:false,definition:{defense:70,magicDefense:30},group:{position:{x:0,y:0,z:0}}};
  const results=['physical','magic'].map(damageType=>{
    const actual=Game.prototype.hurtEnemy.call(runtime,target,100,0,damageType);
    const expected=resolveCombatDamage({rawDamage:100,damageType,attackerLevel:80,physicalDefense:70,magicDefense:30,
      physicalPenetration:stats.physicalPenetration,magicPenetration:stats.magicPenetration});
    assert.equal(actual,expected);
    return {damageType,actual,expected,pass:true};
  });
  mkdirSync('outputs/gameplay-migration',{recursive:true});
  writeFileSync('outputs/gameplay-migration/world-runtime.json',JSON.stringify({kind:'production-world-methods-with-render-stubs',results},null,2));
  console.log(JSON.stringify(results));
} finally { await server.close(); }
