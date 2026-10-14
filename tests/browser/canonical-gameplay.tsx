import { createRoot } from 'react-dom/client';
import { createV3AdventurerHero, derivedStats, chooseV3Warrior, learnSkill, characterStatBreakdown, parseSave } from '../../lib/game/rules';
import { createItem, emptyEquipment } from '../../lib/game/items';
import { totalSkillPoints } from '../../lib/game/canonical-config';
import { encodeCharacterV2 } from '../../lib/game/save-v2';
import { Game } from '../../lib/game/world';
import { resolveCombatDamage } from '../../lib/game/combat-resolver';
import { CharacterOverview } from '../../components/game/character-overview';
import { GameDragDropProvider } from '../../components/game/drag-drop-provider';
import { JobPresentationContext } from '../../components/game/job-presentation-context';
import '../../app/globals.css';
import '../../app/character-screen.css';
import '../../app/character-panels.css';
const hero = createV3AdventurerHero('canonical-browser', 'Canonical Browser');
hero.level = 80; hero.equipment = emptyEquipment(); hero.skillProgressionV3!.totalEarnedSP = totalSkillPoints(80);
chooseV3Warrior(hero); learnSkill(hero,'v3-warrior-strike'); hero.gameplayContractVersion=2;
const sword=createItem('field-verdant-plains-sword',{id:'browser-main',enhancementLevel:3});
hero.inventory=[sword]; hero.equipment.mainHand=sword.id;
const stats=derivedStats(hero), breakdown=characterStatBreakdown(hero);
// Execute the actual world HP sink against its existing training dummy branch.
// Rendering/audio only are stubbed; mitigation and damage bonuses remain production code.
const target={hp:10000,max:10000,dummy:true,boss:false,definition:{defense:70,magicDefense:30},group:{position:{x:0,y:0,z:0}}};
const runtime={hero,combatTime:0,float:()=>{},effect:()=>{}};
const actual=Game.prototype.hurtEnemy.call(runtime as unknown as Game,target as never,100,0,'magic');
const expected=resolveCombatDamage({rawDamage:100,damageType:'magic',attackerLevel:80,physicalDefense:70,magicDefense:30,magicPenetration:stats.magicPenetration});
const loaded=parseSave(JSON.stringify(encodeCharacterV2(hero)))!;
const evidence={worldMagicDamage:actual,expected,worldMatches:actual===expected,sp80:totalSkillPoints(80),sp100:totalSkillPoints(100),
  displayMatches:JSON.stringify(breakdown.final)===JSON.stringify(stats),saveRoundtrip:loaded?.characterId===hero.characterId&&loaded?.gold===hero.gold,
  physicalAttack:stats.physicalAttack,magicAttack:stats.magicAttack,criticalDamage:stats.criticalDamage,castStat:stats.castStat};
createRoot(document.getElementById('root')!).render(<>
  <h1>Canonical gameplay verification</h1><pre id="canonical-results">{JSON.stringify(evidence,null,2)}</pre>
  <JobPresentationContext.Provider value={hero}><GameDragDropProvider game={null}>
    <CharacterOverview hero={hero} game={null} onInventory={()=>{}} />
  </GameDragDropProvider></JobPresentationContext.Provider>
</>);
