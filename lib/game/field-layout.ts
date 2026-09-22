import { FIELDS, FIELD_NPCS, WORLD_CONFIG, type FieldDefinition } from './regions.ts';
import { FIELD_TERRAINS, terrainSafe, terrainWalkable, terrainBridge, nearestTerrainPoint } from './field-terrain.ts';
import { sandsWorldPoint } from './sands-coordinates.ts';

// Field area doubles; city axes grow independently. Player/combat units stay unchanged.
export const FIELD_LAYOUT = Object.freeze({ areaMultiplier: 2, oldHalfExtent: 45, normalCount: 36, eliteCount: 5, bossCount: 1 });
export const FIELD_SCALE = Math.sqrt(FIELD_LAYOUT.areaMultiplier);
export const CITY_SCALE = WORLD_CONFIG.cityScale;
export const regionScale = (inCity: boolean) => inCity ? CITY_SCALE : FIELD_SCALE;
export const regionHalfExtent = (inCity: boolean) => FIELD_LAYOUT.oldHalfExtent * regionScale(inCity);
export type MonsterSpawn = { id: number; x: number; z: number; definition: FieldDefinition['fieldBoss'] };
export function isFieldSafe(fieldId: string, x: number, z: number, margin = 0) {
  const terrain=FIELD_TERRAINS[fieldId];
  if(terrain)return terrainSafe(terrain,{x,z},margin);
  const camp = FIELD_NPCS[fieldId];
  if(fieldId==='sands-location') {
    const {entry,exit}=FIELDS[fieldId];
    return Math.hypot(x-entry.x,z-entry.z)<7+margin || Math.hypot(x-exit.x,z-exit.z)<5+margin || Boolean(camp&&Math.hypot(x-camp.x,z-camp.z)<7+margin);
  }
  return Math.hypot(x, z) < 4.7 + margin || Math.hypot(x, z - 30) < 7 + margin ||
    Boolean(camp && Math.hypot(x - camp.x, z - camp.z) < 7 + margin);
}
export function isFieldWater(x: number, z: number, margin = 0) {
  return ((x / FIELD_SCALE - 24) / (11.8 + margin)) ** 2 + ((z / FIELD_SCALE + 3) / (7.5 + margin)) ** 2 < 1;
}
export function fieldSpawns(field: FieldDefinition): MonsterSpawn[] {
  const terrain=FIELD_TERRAINS[field.id];
  if(terrain) {
    // Keep original IDs/species order so existing respawn saves attach to new homes.
    const zones=terrain.spawnZones??[{x:25,z:25},{x:-22,z:27},{x:-34,z:-26},{x:30,z:-31}];
    const used:Array<{x:number;z:number}>=[];
    const normals=Array.from({length:FIELD_LAYOUT.normalCount},(_,id)=>{
      const species=id%field.normalMonsters.length, zone=zones[species],index=Math.floor(id/4),layoutScale=field.id==='verdant-plains'?2:1;
      let p={x:zone.x+(index%3-1)*9*layoutScale,z:zone.z+(Math.floor(index/3)-1)*10*layoutScale};
      p=nearestTerrainPoint(terrain,p,1.6,true);
      // Bounded deterministic search avoids camp, props, banks and duplicate spawns.
      if(terrainBridge(terrain,p,-1)||used.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<4)||Math.hypot(p.x-terrain.arena.x,p.z-terrain.arena.z)<17) {
        outer:for(let r=2;r<45;r+=2)for(let i=0;i<24;i++) {
          const q={x:zone.x+Math.cos(i*Math.PI/12)*r,z:zone.z+Math.sin(i*Math.PI/12)*r};
          if(terrainWalkable(terrain,q,1.6,true)&&!terrainBridge(terrain,q,-1)&&!used.some(a=>Math.hypot(q.x-a.x,q.z-a.z)<5)&&Math.hypot(q.x-terrain.arena.x,q.z-terrain.arena.z)>17){p=q;break outer;}
        }
      }
      used.push(p);return {id,...p,definition:field.normalMonsters[species]};
    });
    const eliteDefaults=field.id==='verdant-plains'
      ? [[-46,-16],[-32,-43],[39,-16],[45,8],[-48,1]].map(([x,z])=>({x:x*2,z:z*2}))
      : [[-46,-16],[-32,-43],[39,-16],[45,8],[-48,1]].map(([x,z])=>({x,z}));
    const elites=(terrain.eliteSpawns??eliteDefaults).map((p,i)=>({id:90+i,...nearestTerrainPoint(terrain,p,2,true),definition:field.eliteMonsters[i%field.eliteMonsters.length]}));
    return [...normals,...elites,{id:100,x:terrain.arena.x,z:terrain.arena.z,definition:field.fieldBoss}];
  }
  if(field.id==='sands-location') {
    // The imported GLB is a narrow, finite island. Keep combat actors on its
    // walkable footprint instead of using the much larger legacy field lattice.
    const points:Array<{x:number;z:number}>=[];
    // The imported island has a narrow footprint. Use two extra rows as a
    // deterministic overflow so the 36 normal slots never wrap onto an old
    // coordinate when an entrance/safe zone removes candidates.
    for(let row=0;row<8;row++) for(let col=0;col<6;col++) {
      const point=sandsWorldPoint(-10+col*4,-28+row*10);
      if(!isFieldSafe(field.id,point.x,point.z,2)&&Math.hypot(point.x,point.z+30)>5) points.push(point);
    }
    const normals=Array.from({length:FIELD_LAYOUT.normalCount},(_,i)=>{
      const point=points[i];
      return {id:i,x:point.x,z:point.z,definition:field.normalMonsters[i%field.normalMonsters.length]};
    });
    const elitePoints=[[-12,-20],[12,-20],[-10,18],[10,18], [0,24]] as const;
    const elites=elitePoints.map(([x,z],i)=>({id:90+i,...sandsWorldPoint(x,z),definition:field.eliteMonsters[i%field.eliteMonsters.length]}));
    return [...normals,...elites,{id:100,...sandsWorldPoint(0,-26),definition:field.fieldBoss}];
  }
  const spawns: MonsterSpawn[] = [];
  // Deterministic lattice: stable instance IDs/saves, spread across the expanded field.
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const x = -54 + col * 15 + (row % 2 ? 3 : 0), z = -54 + row * 15;
    if (isFieldSafe(field.id, x, z, 5) || isFieldWater(x, z, 3) || Math.hypot(x, z + 32 * FIELD_SCALE) < 13) continue;
    spawns.push({ id: spawns.length, x, z, definition: field.normalMonsters[spawns.length % field.normalMonsters.length] });
  }
  // Sample the entire lattice, rather than filling only the northern rows.
  const normals = Array.from({ length: FIELD_LAYOUT.normalCount }, (_, i) => {
    const point = spawns[Math.floor(i * spawns.length / FIELD_LAYOUT.normalCount)];
    return { ...point, id: i, definition: field.normalMonsters[i % field.normalMonsters.length] };
  });
  const elites = [[-48,-8],[-30,-34],[48,-36],[48,35],[6,54]].map(([x,z],i) => ({ id:90+i,x,z,definition:field.eliteMonsters[i % field.eliteMonsters.length] }));
  return [...normals,...elites,{id:100,x:0,z:-32*FIELD_SCALE,definition:field.fieldBoss}];
}
export const monsterRespawnKey = (definitionId: string, instanceId: number, fieldId?:string) => `${fieldId&&FIELDS[fieldId]?.contentFamilyId?`${fieldId}:`:''}${definitionId}:spawn:${instanceId}`;
export function restoreRespawnDeadline(state: Record<string,number>, definitionId: string, instanceId: number, fieldId?:string) {
  // New fields sharing a species must never inherit another region's death timer.
  if(fieldId&&FIELDS[fieldId]?.contentFamilyId)return state[monsterRespawnKey(definitionId,instanceId,fieldId)]??0;
  // Old saves used one key per species. Preserve that first spawn without hiding every copy.
  return state[monsterRespawnKey(definitionId, instanceId)] ?? ((instanceId < 4 || instanceId === 90 || instanceId === 100) ? state[definitionId] ?? 0 : 0);
}
