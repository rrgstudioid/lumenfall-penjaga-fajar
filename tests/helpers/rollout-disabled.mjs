/** Compatibility counterfactual, NOT the shipping candidate. Existing isolation
 * assertions remain useful with the release policy disabled; shipping-mode
 * acceptance is covered separately by public-rollout.test.mjs. */
export const rolloutDisabled=()=>({name:'explicit-rollout-disabled-fixture',enforce:'pre',transform(source,id){
 if(!id.replaceAll('\\','/').endsWith('/lib/game/public-rollout.ts'))return;
 return source.replace(/(equipment|quests|combat): true/g,'$1: false');
}});
