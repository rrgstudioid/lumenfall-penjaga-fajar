/** Destination identities, not permission tokens. Acquisition/use stays development-only. */
export const MAP_SCROLL_VERSION='MAP_INTRO_SCROLL_V2_EARLY_PRICE';
export const MAP_SCROLLS=Object.freeze([
  {region:'verdant-plains-v2',name:'Verdant Plains',intro:'main-verdant-bisikan',npc:'aruna-0',price:27},
  {region:'east-gate-arunika',name:'East Gate Arunika',intro:'field-east-gate-arunika-easy',npc:'field-npc-east-gate',price:45},
  {region:'ironveil-mines-exterior-v1',name:'Ironveil Exterior',intro:'dev-quest-v1-iron-exterior-intro',npc:'dev-ironveil-foreman-v1',price:78},
  {region:'ironveil-mines-interior-v1',name:'Ironveil Interior',intro:'dev-quest-v1-iron-interior-intro',npc:'dev-ironveil-surveyor-v1',price:114},
  {region:'sunken-ruins',name:'Sunken Ruins',intro:'field-sunken-ruins-easy',npc:'field-npc-sunken',price:null},
  {region:'meteorfall-citadel',name:'Meteorfall Citadel',intro:'field-meteorfall-citadel-easy',npc:'field-npc-meteor',price:null},
].map(row=>Object.freeze({...row,templateId:`map-scroll-v1-${row.region}`})));
export const mapScroll=(templateId:string)=>MAP_SCROLLS.find(row=>row.templateId===templateId);
export const mapScrollReceipt=(region:string)=>`map-scroll-v1:claimed:${region}`;
export const mapVisitReceipt=(region:string)=>`map-scroll-v1:visited:${region}`;
export function availableMapScrollPacks(hero:{completedQuests:string[];cityProgress:Record<string,number>;questClaimed?:boolean},npcId:string) {
  if(process.env.NODE_ENV==='production')return [];
  return MAP_SCROLLS.filter(row=>row.npc===npcId&&(hero.completedQuests.includes(row.intro)||
    (row.intro==='main-verdant-bisikan'&&hero.questClaimed===true))&&!hero.cityProgress[mapScrollReceipt(row.region)]);
}
