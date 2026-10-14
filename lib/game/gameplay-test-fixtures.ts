import { equipItem, unequipItem, resolveHeroSkill, type Hero } from './rules.ts';
/** Synthetic fixture preparation only. Calls the unmodified production gate and
 * re-equips the original legal items afterwards for subsequent combat assertions. */
export function promoteFixture(hero:Hero, transition:(hero:Hero)=>boolean):boolean {
 const equipment={...hero.equipment};
 for(const slot of Object.keys(equipment) as Array<keyof typeof equipment>)if(equipment[slot])unequipItem(hero,slot);
 const accepted=transition(hero);
 for(const slot of Object.keys(equipment) as Array<keyof typeof equipment>){const id=equipment[slot];if(id&&!equipItem(hero,id,slot).ok)throw Error('Fixture cannot re-equip '+id);}
 return accepted;
}

export function resolveFixtureSkill(...args:Parameters<typeof resolveHeroSkill>){args[8]??=()=>.5;return resolveHeroSkill(...args);}

// Explicit legacy roster: these ten records own the legacy skill trees.
export const LEGACY_SPECIALIZATION_IDS = ['gatotkaca','garda','caroq','anom','srikandi','jagawana','resi','pujangga','pandita','bajra'] as const;
import { SPECIALIZATIONS, type CoreJobId } from './skills.ts';
export const LEGACY_SPECIALIZATIONS = Object.fromEntries(LEGACY_SPECIALIZATION_IDS.map(id=>[id,SPECIALIZATIONS[id]])) as Record<typeof LEGACY_SPECIALIZATION_IDS[number], Omit<(typeof SPECIALIZATIONS)['garda'],'coreJob'> & {coreJob:CoreJobId}>;

import { createV3AdventurerHero, chooseV3Warrior, chooseV3Berserker, learnSkill } from './rules.ts';
export function legalJobResetFixture(){
 const hero=createV3AdventurerHero('synthetic-job-reset');hero.level=60;hero.skillProgressionV3!.totalEarnedSP=119;
 unequipItem(hero,'mainHand');
 if(!chooseV3Warrior(hero)||!chooseV3Berserker(hero))throw Error('Illegal job-reset fixture');
 for(const id of ['v3-warrior-strike','v3-warrior-strike'])if(!learnSkill(hero,id))throw Error('Illegal skill purchase');
 hero.gold=1500;hero.allocatedStats={str:7,vit:5,dex:3,int:2};hero.statPoints=118-17;
 return hero;
}
