/** Visual navigation only. Does not own quest progress, rewards or movement. */
export type QuestPoint = Readonly<{ x: number; z: number }>;
export type QuestDestination = QuestPoint & Readonly<{
  id: string; label: string; region: string; kind: 'hunt' | 'collect' | 'visit' | 'npc' | 'portal';
  eligible: boolean; alive?: boolean;
}>;
export type QuestNavigationResult = Readonly<{
  status: 'route' | 'unavailable' | 'complete'; reason: string;
  target: QuestDestination | null; waypoint: QuestPoint | null;
  path: readonly QuestPoint[]; pathDistance: number | null; straightDistance: number | null;
}>;
export function unavailableNavigation(reason: string, complete = false): QuestNavigationResult {
  return Object.freeze({status: complete ? 'complete' : 'unavailable', reason, target: null,
    waypoint: null, path: Object.freeze([]), pathDistance: null, straightDistance: null});
}
const distance = (a: QuestPoint, b: QuestPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const finitePoint = (p: QuestPoint) => Number.isFinite(p.x) && Number.isFinite(p.z);
export function resolveQuestNavigation(input: {
  position: QuestPoint; region: string; destinations: readonly QuestDestination[];
  previousId?: string; route: (to: QuestPoint) => readonly QuestPoint[];
}): QuestNavigationResult {
  if (!finitePoint(input.position)) return unavailableNavigation('Posisi belum tersedia');
  const eligible = input.destinations.filter(d => d.eligible && d.alive !== false && d.region === input.region && finitePoint(d));
  eligible.sort((a,b) => Number(b.id === input.previousId) - Number(a.id === input.previousId)
    || distance(input.position,a) - distance(input.position,b) || a.id.localeCompare(b.id));
  for (const d of eligible) {
    const points = input.route(d);
    // Reject partial routes or a planner's unreachable fallback.
    if (!points.length || points.some(p => !finitePoint(p)) || distance(points[points.length-1],d) > .01) continue;
    let length = 0, previous = input.position;
    for (const p of points) { length += distance(previous,p); previous = p; }
    if (!Number.isFinite(length)) continue;
    const path = Object.freeze(points.map(p => Object.freeze({x:p.x,z:p.z})));
    const target = Object.freeze({...d});
    return Object.freeze({status:'route',reason:'',target,path,waypoint:path.find(p=>distance(input.position,p)>.6)??path[path.length-1],
      pathDistance:length,straightDistance:distance(input.position,d)});
  }
  return unavailableNavigation(eligible.length ? 'Rute belum tersedia; tidak ada arah menembus penghalang' : 'Belum ada tujuan eligible di wilayah ini');
}

/** Pure filter for explicitly sourced objectives. Legacy ANY-KILL is a distinct contract. */
export function matchesQuestHunt(objective: {region:string; species?:string; variant?:string; level?:number; anyKill:boolean},
  target: {region:string; species:string; variant:string; level?:number; alive:boolean; dummy:boolean}) {
  return target.alive && !target.dummy && target.region === objective.region
    && (objective.anyKill || (!!objective.species && target.species === objective.species
      && (!objective.variant || target.variant === objective.variant) && (objective.level===undefined || target.level===objective.level)));
}
