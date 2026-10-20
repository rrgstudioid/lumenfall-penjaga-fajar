import type {Game} from './world';
import {FIELDS,regionNpcs,fieldForQuest,getAllQuestJournalEntries,getQuestReportLocation,unlockReason} from './regions';
import {earlyQuest,eligibleEarlyKill} from './early-quest-contract';
import {questMineRoute} from './quest-mine-route';
import {PLAINS_EXIT} from './verdant-plains-layout';
import {MINE_EXIT,MINE_ID,MINE_ROOMS} from './ironveil-interior-layout';
import {IRONVEIL_ID,IRONVEIL_TRANSITION} from './ironveil-mines-layout';
import {terrainRoute} from './field-terrain';
import {moveWithTreeCollisions} from './tree-collision';
import {matchesQuestHunt,resolveQuestNavigation,unavailableNavigation,type QuestDestination,type QuestPoint} from './quest-navigation';

/** Uses the same movement collision consumers on copies; never moves the actor. */
export function questRoute(game: Game, to: QuestPoint): readonly QuestPoint[] {
  const from = {x:game.hero.x,z:game.hero.z};
  const graph = game.meteorfall?.navigation ?? game.sunken?.navigation;
  const route = game.isMineInterior?questMineRoute(from,to):graph ? graph.route(from,to) : game.fieldTerrain ? terrainRoute(game.fieldTerrain,from,to) : [to];
  let p = from;
  for (const waypoint of route) {
    const steps = Math.max(1,Math.ceil(Math.hypot(waypoint.x-p.x,waypoint.z-p.z)/.3));
    const dx=(waypoint.x-p.x)/steps,dz=(waypoint.z-p.z)/steps;
    for(let n=0;n<steps;n++) {
      const next = moveWithTreeCollisions(p,dx,dz,game.treeColliders,
        (a,x,z)=>game.moveHeroOnGround(a,x,z),(x,z)=>game.groundHeight(x,z));
      if(Math.hypot(next.x-p.x-dx,next.z-p.z-dz)>1e-5) return [];
      p=next;
    }
  }
  return route;
}

/** Read-only bridge to the existing journal and currently loaded world. No enrollment, RNG or save. */
export function readDevelopmentQuestNavigation(game: Game, questId: string, previousId?: string) {
  if(process.env.NODE_ENV === 'production') return unavailableNavigation('DEVELOPMENT_ONLY');
  if(game.disposed || !game.started || game.dead || game.transitioning || !game.actor.visible)
    return unavailableNavigation('Navigasi ditangguhkan saat loading atau karakter mati');
  const q=getAllQuestJournalEntries(game.hero).find(q=>q.id===questId);
  if(!q || q.status==='completed' || q.status==='cooldown')return unavailableNavigation('Quest selesai',true);
  if(q.status==='locked' || q.category==='class')return unavailableNavigation('Quest belum tersedia untuk navigasi');
  const report=q.status==='ready_to_complete'||q.status==='available';
  const reporting=getQuestReportLocation(q);
  const reportLocation=q.status==='available'?{mapId:q.giverMapId,mapName:q.giverMapName,npcId:q.giverNpcId}:reporting;
  const destinationRegion=report?reportLocation.mapId:q.targetMapId;
  const region=game.activeLocationId;
  let destinations:QuestDestination[]=[];
  if(destinationRegion!==region) {
    // Only physical exits actually present in this loaded map. No invented world route.
    const portals: Array<QuestPoint & {id:string;destination?:string;name:string}> = game.portalLabels.map((p,i)=>({...p,id:`portal-${i}`}));
    if(game.isPlains)portals.push({...PLAINS_EXIT,id:'plains-exit',destination:'averion',name:'Averion'});
    if(game.isMineInterior)portals.push({...MINE_EXIT,id:'mine-exit',destination:IRONVEIL_ID,name:'Keluar tambang'});
    if(game.isIronveil)portals.push({...IRONVEIL_TRANSITION.anchor,id:'mine-entry',destination:MINE_ID,name:'Masuk tambang'});
    const direct=portals.filter(p=>p.destination===destinationRegion);
    // Returning to the field's registered hub is an honest next leg, not a promise of a full route.
    const exits=direct.length?direct:portals.filter(p=>p.destination===FIELDS[game.hero.currentField]?.cityId&&!game.hero.inCity);
    destinations=exits.filter(p=>p.destination===MINE_ID||!unlockReason(game.hero,p.destination!)).map(p=>({...p,
      region,kind:'portal',eligible:true,label:`${p.name} · lanjut ke ${report?reportLocation.mapName:q.targetMapName}`}));
    if(!destinations.length)return unavailableNavigation(`Rute antarwilayah belum tersedia; tujuan ${report?reportLocation.mapName:q.targetMapName}. Gunakan perjalanan yang sudah terbuka.`);
  } else if(report) {
    const npc=regionNpcs(region).find(n=>n.id===reportLocation.npcId);
    if(npc)destinations=[{...npc,label:`${q.status==='available'?'Temui':'Lapor ke'} ${npc.name}`,region,kind:'npc',eligible:true}];
  } else {
    const early=earlyQuest(q.id),index=early?.objectives.findIndex((o,i)=>(q.progress[i]?.current??0)<o.required)??-1;
    if(early&&index>=0){
      const o=early.objectives[index],label=`${o.targetName} (${q.progress[index]?.current??0}/${o.required})`;
      if(o.type==='visit'){
        const room=MINE_ROOMS.find(r=>r.id===o.room);
        if(room)destinations=[{id:`visit-${room.id}`,x:room.x,z:room.z,region,kind:'visit',label,eligible:o.region===region}];
      }else destinations=game.enemies.map(e=>({id:`enemy-${e.id}`,x:e.group.position.x,z:e.group.position.z,region,kind:o.type==='collect'?'collect':'hunt',label,alive:e.hp>0,
        eligible:!e.dummy&&!!e.definition&&eligibleEarlyKill(o,region,e.definition)}));
      return resolveQuestNavigation({position:game.hero,region,destinations,previousId,route:to=>questRoute(game,to)});
    }
    // The existing consumers count field kills, not the species/variant suggested by old prose.
    const field=fieldForQuest(q.id),anyKill=!!field||q.id==='main-verdant-bisikan';
    if(!anyKill)return unavailableNavigation('Sumber objective belum memiliki kontrak navigasi');
    destinations=game.enemies.map(e=>({id:`enemy-${e.id}`,label:`Area berburu · semua monster (${q.progress[0]?.current??0}/${q.progress[0]?.required??0})`,
      x:e.group.position.x,z:e.group.position.z,region,kind:'hunt',alive:e.hp>0,
      eligible:matchesQuestHunt({region:destinationRegion,anyKill:true},{region,species:e.definition?.id??'',variant:e.definition?.variant??'',alive:e.hp>0,dummy:!!e.dummy})}));
  }
  return resolveQuestNavigation({position:game.hero,region,destinations,previousId,route:to=>questRoute(game,to)});
}
