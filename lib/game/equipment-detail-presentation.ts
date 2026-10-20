import { ITEM_CATALOG, calculateEnhancedBaseStats, calculateEquipmentUniqueStats, affixStats, equipmentUsageDescription, type ItemData, type StatBlock, type EquipSlot } from './items.ts';
import { ARMOR_SETS, validateArmorSet, type ArmorSet } from './equipment-layers.ts';
import { ironSwordAuthoredRange } from './iron-sword-range-v2.ts';
import { jayantaraAuthoredRange } from './jayantara-range-v3.ts';
import { hasEquipmentAuthoring, resolveAuthoredEquipmentItem } from './equipment-authoring-v1.ts';
import { statDisplayLabel, statDisplayValue } from './stat-presentation.ts';

export type DetailItem = Omit<ItemData, 'id' | 'quantity'> & Partial<Pick<ItemData, 'id' | 'quantity'>>;
type Owner = { inventory: readonly ItemData[]; equipment: Partial<Record<EquipSlot, string | null>> };
type Range = { min: number; max: number };
export type DetailRow = { key: string; label: string; value: string; base?: string; enhancement?: string };
const slotLabel: Partial<Record<EquipSlot,string>> = {mainHand:'Main Hand',offHand:'Off Hand',head:'Head',chest:'Armor',gloves:'Gloves',legs:'Legs',boots:'Boots',necklace:'Necklace',ring1:'Ring 1',ring2:'Ring 2',earring1:'Earring 1',earring2:'Earring 2',accessory:'Accessories',pet:'Pet'};
const number = (n: number) => Number(n.toFixed(4)).toString();
const rangeText = (r: Range) => `${number(r.min)}–${number(r.max)}`;
const nonzero = (block: StatBlock) => Object.entries(block).filter(([, n]) => n !== 0 && n !== undefined);
const row = (key: string, n: number): DetailRow => ({key, label: statDisplayLabel(key), value: Number.isFinite(n) ? statDisplayValue(key, n) : 'Tidak tersedia'});
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value); } return value; };
const slotMatches = (item: ItemData, slot: string) => item.allowedSlots?.includes(slot as EquipSlot) || item.equipSlot === slot ||
  item.equipmentType === 'ring' && ['ring1','ring2'].includes(slot) || item.equipmentType === 'earring' && ['earring1','earring2'].includes(slot);

/** Read-only display membership. No resolver call applies any set bonus here. */
export function equipmentSetPresentation(item: DetailItem, owner?: Owner, sets: readonly ArmorSet[] = ARMOR_SETS) {
  const valid: ItemData[] = [], seen = new Set<string>();
  for (const [slot,id] of Object.entries(owner?.equipment ?? {})) {
    const matches = owner?.inventory.filter(i => i.id === id) ?? [];
    if (!id || seen.has(id) || matches.length !== 1) continue;
    const owned = matches[0];
    if (owned.category !== 'armor' || !slotMatches(owned,slot)) continue;
    seen.add(id); valid.push(owned);
  }
  const setIds = new Set<string>();
  return sets.filter(set => {
    if (!set.enabled || !validateArmorSet(set) || !set.pieces.includes(item.templateId) || setIds.has(set.id)) return false;
    setIds.add(set.id); return true;
  }).map(set => {
    const pieces = set.pieces.map(id => ({id, name:ITEM_CATALOG[id]?.name ?? id, equipped:valid.some(i => i.templateId === id)}));
    const count = pieces.filter(p => p.equipped).length;
    return {id:set.id, name:set.id, count, total:pieces.length, pieces,
      thresholds:([2,3,4] as const).filter(n => set.bonuses[n] !== undefined).map(n => ({pieces:n, active:count>=n,
        bonuses:nonzero(set.bonuses[n] ?? {}).map(([key,n]) => row(key,n!))})), cumulative:true};
  });
}
export type SetDetail = ReturnType<typeof equipmentSetPresentation>[number];

/** Presentation only: never create/normalize an item, call prepare, enroll, or mutate the owner. */
export function equipmentDetail(item: DetailItem, context: {owner?: Owner; physicalRange?: Range | null; development?: boolean} = {}) {
  const enhanced = calculateEnhancedBaseStats(item), zero = calculateEnhancedBaseStats({...item,enhancementLevel:0});
  const template = ITEM_CATALOG[item.templateId];
  const core: DetailRow[] = [], intrinsic: DetailRow[] = [], uncertain: DetailRow[] = [], options: DetailRow[] = [];
  const notes: string[] = [], diagnostics: string[] = [];
  let physical: Range | null = ironSwordAuthoredRange(item) ?? (context.development ? jayantaraAuthoredRange(item) : null) ?? context.physicalRange ?? null;
  let basePhysical = physical;
  let magic: Range | null = null, baseMagic: Range | null = null;
  if (context.development && hasEquipmentAuthoring(item)) {
    const authored = resolveAuthoredEquipmentItem(item);
    if (authored.ok) {
      physical = authored.PATK; basePhysical = authored.profile.PATK ?? null;
      magic = authored.MATK; baseMagic = authored.profile.MATK ?? null;
      diagnostics.push(`${authored.version} / ${authored.profile.id}`, `Core enhancement ×${number(authored.multiplier)}`);
      if (authored.PATK) notes.push('Range item tersedia; jalur combat compatibility belum memakai range versi ini.');
    } else { physical=null; basePhysical=null; notes.push('Range versi item ini belum tersedia.'); diagnostics.push(authored.reason); }
  }
  if (item.authoredAttackVersion) diagnostics.push(item.authoredAttackVersion);
  if (physical) core.push({key:'attack',label:'Physical Attack',value:rangeText(physical),base:rangeText(basePhysical!),
    enhancement:rangeText({min:physical.min-basePhysical!.min,max:physical.max-basePhysical!.max})});
  if (magic) core.push({key:'magicAttack',label:'Magic Attack',value:rangeText(magic),base:rangeText(baseMagic!),
    enhancement:rangeText({min:magic.min-baseMagic!.min,max:magic.max-baseMagic!.max})});
  const coreKeys = item.category === 'weapon' ? ['attack','magicAttack'] : item.category === 'armor' ? ['defense','magicDefense'] : [];
  for (const [key,n] of nonzero(enhanced)) {
    if (key==='attack' && physical || key==='magicAttack' && magic) continue;
    if (coreKeys.includes(key)) {
      const label = ({attack:'Physical Attack · scalar',magicAttack:'Magic Attack · scalar',defense:'Physical Defense',magicDefense:'Magic Defense'} as Record<string,string>)[key];
      core.push({key,label,value:Number.isFinite(n)?number(n!):'Tidak tersedia',base:number(zero[key as keyof StatBlock]??0),enhancement:number(n!-(zero[key as keyof StatBlock]??0))});
      if (key==='attack'||key==='magicAttack') notes.push('Nilai scalar legacy; bukan range min–max.');
    } else (template && item.baseStats[key as keyof StatBlock] === template.baseStats[key as keyof StatBlock] ? intrinsic : uncertain).push(row(key,n!));
  }
  // createItem merges fixed template bonuses and random Unique Stats into one block.
  // Only exact template blocks or template-empty blocks are classifiable without inventing provenance.
  const bonus = item.uniqueStatsLocked ? {} : calculateEquipmentUniqueStats(item as ItemData);
  const templateBonus = template?.bonusStats ?? {};
  const byKey = (a: [string, unknown], b: [string, unknown]) => a[0].localeCompare(b[0]);
  const exactBonus = template && JSON.stringify(Object.entries(bonus).sort(byKey)) === JSON.stringify(Object.entries(templateBonus).sort(byKey));
  const target = exactBonus ? intrinsic : nonzero(templateBonus).length ? uncertain : options;
  for (const [key,n] of nonzero(bonus)) target.push(row(key,n!));
  if (uncertain.length) diagnostics.push('Base/bonus instance differs from template or mixes fixed and rolled values; retained without splitting.');
  const effects = item.uniqueEffect ? [{text:item.uniqueEffect,status:'Deskripsi efek; aktivasi runtime belum terverifikasi.'}] : [];
  if (item.uniqueEffectData) diagnostics.push(`Unique effect metadata: ${JSON.stringify(item.uniqueEffectData)}; metadata is not execution proof.`);
  if (item.affixes.length && ['weapon','armor','accessory'].includes(item.category)) diagnostics.push('Legacy equipment affixes retained in data but not used by current equipment stat resolver.');
  // Equipment descriptions are usually overwritten by this generator. Do not repeat numerical stats as lore.
  const generated = item.description === equipmentUsageDescription(item) || /(?:^| · )(?:Syarat:|Level:|Harga jual:)/.test(item.description);
  const sockets = item.sockets.map((socket,index) => ({id:socket.id,index:index+1,name:socket.rune?.name??null,
    rows:socket.rune ? nonzero(affixStats(socket.rune.affixes)).map(([key,n])=>row(key,n!)) : [],
    effect:socket.rune?.uniqueEffect ? {text:socket.rune.uniqueEffect,status:'Deskripsi Rune; aktivasi efek belum terverifikasi.'} : null}));
  const owned = item.id ? context.owner?.inventory.filter(i=>i.id===item.id) : [];
  const equipped = owned?.length===1 && owned[0]===item && Object.entries(context.owner?.equipment??{}).some(([slot,id])=>id===item.id&&slotMatches(owned[0],slot));
  const jobs = item.allowedJobFamily === 'THIEF_LINEAGE' ? 'Thief lineage' : item.requiredSpecialJob ?? item.requiredCoreJob ?? (item.allowedJobs.join(' / ')||'Semua class');
  return freeze({name:item.name,enhancement:item.enhancementLevel,equipped:Boolean(equipped),
    metadata:[`Lv. ${item.levelRequirement}`,item.equipmentType?.replaceAll('_',' ')??item.category,item.handedness==='none'?'':item.handedness.replaceAll('_',' '),
      `Slot: ${(item.allowedSlots??(item.equipSlot?[item.equipSlot]:[])).map(s=>slotLabel[s]??s).join(' / ')}`,`Class: ${jobs}`,
      ...(item.requiredGender?[`Gender: ${item.requiredGender}`]:[])],core,intrinsic,effects,description:generated?null:item.description,
    options,uncertain,locked:item.uniqueStatsLocked===true,sockets,sets:equipmentSetPresentation(item,context.owner),notes:[...new Set(notes)],diagnostics});
}
export type EquipmentDetailDTO = ReturnType<typeof equipmentDetail>;

/** Compare display sources, never flattened scalar totals or an enhancement permission. */
export function equipmentDetailComparison(before: EquipmentDetailDTO, after: EquipmentDetailDTO) {
  const groups = ['core', 'intrinsic', 'options', 'uncertain'] as const;
  return freeze(groups.flatMap(group => before[group].map((entry, index) => {
    const next = after[group].find(candidate => candidate.key === entry.key);
    return { id: `${group}-${entry.key}-${index}`, label: entry.label,
      before: entry.value, after: next?.value ?? 'Tidak tersedia' };
  })));
}
