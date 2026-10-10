import { resolveHeroSkill, skillLevel, type Hero } from './rules.ts';
import { statDisplayLabel, statDisplayValue } from './stat-presentation.ts';
import type { SkillDefinition } from './skills.ts';
import type { SkillDefinitionV3 } from './skill-progression-v3.ts';
import { weaponRequirementLabel } from './weapon-style.ts';
import { FURY_HARVEST_RECOVERY_PERCENT } from './berserker-v3.ts';
import { resolveThiefCanonicalRank, THIEF_V3_SKILL_MAP } from './thief-v3.ts';
import { canonicalSkillName, skillNodePresentation } from './skill-family-presentation.ts';
import { rogueSkillDetails } from './rogue-v3.ts';
import { assasinSkillDetails, ECLIPSE_DURATION, ECLIPSE_TICK_INTERVAL, ECLIPSE_STACK_MULTIPLIERS, EXECUTION_HP_THRESHOLD, EXECUTION_PAYOFF } from './assasin-v3.ts';
import { POISON_SLOW_CAP } from './assasin-poison.ts';
import { AMBUSH_DURATION, AMBUSH_FINAL_DAMAGE } from './rogue-ambush.ts';
import { BLADE_MASTER_MASTERY_MANA_REDUCTION_BY_RANK, BLADE_MASTER_MASTERY_MANA_SKILLS, BLADE_MASTER_V3_SKILLS } from './blade-master-v3.ts';

export type SkillPresentationRow = { label: string; value: string };

export type SkillPresentationModel = {
  skillName: string;
  description: string;
  skillType: string;
  currentRank: number;
  maxRank: number;
  status: 'LEARNED' | 'AVAILABLE' | 'LOCKED' | 'MAX RANK';
  requirements: SkillPresentationRow[];
  damage: SkillPresentationRow[];
  specialMechanics: SkillPresentationRow[];
  effects: SkillPresentationRow[];
  area: SkillPresentationRow[];
  resource: SkillPresentationRow[];
  nextRank: SkillPresentationRow[];
  isDamage: boolean;
};

const weaponLabels: Record<string, string> = {
  one_hand_sword: 'One-Hand Sword',
  two_hand_sword: 'Two-Hand Sword',
  dual_sword: 'Dual One-Hand Swords',
  any_sword: 'Any Sword',
  none: 'None',
};

const effectLabels: Record<string, string> = {
  armor_break: 'Armor Break',
  accuracy: 'Accuracy',
  criticalRate: 'Critical Rate',
  physicalDamagePercent: 'Physical Damage',
  damageReduction: 'Damage Reduction',
  displacementResistance: 'Displacement Resistance',
  blockRate: 'Block',
  temporary_max_hp: 'Max HP',
  dual_wield_unlock: 'Unlocks Dual Wield',
  dual_wield_accuracy: 'Dual Wield Accuracy',
  blade_focus: 'Blade Focus',
  flow_extension: 'Flow Duration',
  tempo_drive: 'Tempo Drive',
};
const jobLabels: Record<string, string> = {
  adventurer: 'Adventurer',
  warrior: 'Warrior',
  berserker: 'Berserker',
  blade_master: 'Blade Master',
};

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const effectLabel = (value: string) => effectLabels[value] ?? statDisplayLabel(value);
const coefficient = (value: number, precise = false) => `×${value.toFixed(precise && Math.abs(value * 100 - Math.round(value * 100)) > 1e-8 ? 3 : 2)}`;
const percentage = (value: number) => `${value % 1 === 0 ? value : value.toFixed(1)}%`;
const rankIndex = (rank: number, maxRank: number) => Math.min(Math.max(1, rank), maxRank) - 1;

function runtimeRankValue(runtime: SkillDefinition, rank: number) {
  return runtime.rankValues?.[rankIndex(rank, runtime.maxLevel)] ?? {};
}

function positionalEffectRows(runtime: SkillDefinition, rank: number): SkillPresentationRow[] {
  return (runtime.rankEffects?.[rankIndex(rank, runtime.maxLevel)]?.modifiers ?? []).flatMap(modifier => {
    const position = modifier.condition?.targetPosition;
    const damage = modifier.action?.damagePercent;
    return position && damage !== undefined
      ? [{ label: `${position === 'side' ? 'Flank' : titleCase(position)} Final Damage`, value: `+${percentage(damage)}` }]
      : [];
  });
}

function rowsForEffects(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  const rows: SkillPresentationRow[] = [];
  const assasin=assasinSkillDetails(definition.id,rank);
  if (assasin) return [
    ...(assasin.profile ? [
      {label:'Poison Base Damage / Tick',value:`${assasin.profile.baseDamageMin} – ${assasin.profile.baseDamageMax}`},
      {label:'Poison PATK Scaling',value:coefficient(assasin.profile.patkCoefficient,true)},
      {label:'Poison Bonus DEX',value:coefficient(assasin.profile.dexCoefficient,true)},
      {label:'Poison Skill Power Factor',value:`×${assasin.profile.skillPowerFactor}`},
      {label:'Thrown Dagger Accuracy',value:`+${assasin.accuracy}`},
    ] : []),
    ...(assasin.distance !== undefined ? [{label:'Backward Movement',value:`${assasin.distance} m · collision-safe, no iframe / invulnerability`}] : []),
    ...(assasin.duration !== undefined ? [{label:'Concealment Duration',value:`${assasin.duration}s`}] : []),
    ...(assasin.mechanics?.crippling ? [{label:'Additional Movement Slow',value:`+${assasin.mechanics.crippling.bonusPPByRank[rankIndex(rank,definition.maxRank)]}% · ${assasin.mechanics.crippling.duration}s`},
      {label:'Slow Caps',value:`PvE ${POISON_SLOW_CAP.pve}% / PvP ${POISON_SLOW_CAP.pvp}%`}] : []),
    ...(assasin.eclipse ? [
      {label:'Eclipse Base Damage / Tick',value:`${assasin.eclipse.min} – ${assasin.eclipse.max}`},
      {label:'Eclipse PATK Scaling',value:coefficient(assasin.eclipse.physical,true)},
      {label:'Eclipse Bonus DEX',value:coefficient(assasin.eclipse.dex,true)},
      {label:'Eclipse Skill Power Factor',value:'×10'},
    ] : []),
  ];
  const rogue = rogueSkillDetails(definition.id, rank);
  if (rogue) return [
    ...(rogue.accuracy !== undefined ? [{ label: 'Accuracy', value: `+${rogue.accuracy}` }, { label: 'Critical Rate', value: `+${rogue.crit}%` }] : []),
    ...(rogue.distance !== undefined ? [{ label: 'Movement Distance', value: `${rogue.distance} m` }] : []),
    ...(rogue.duration !== undefined ? [{ label: 'Concealment Duration', value: `${rogue.duration}s` }] : []),
    ...(rogue.ambush?.interaction?.mode === 'POSITION_OVERRIDE' ? [{ label: 'Front', value: 'Normal damage' }, ...positionalEffectRows(runtime, rank)] : []),
  ];
  const thief = resolveThiefCanonicalRank(definition.id, rank);
  if (thief) {
    const v = thief.values;
    const fields = [
      ['Accuracy', v.accuracy, ''], ['Skill Accuracy', v.skillAccuracy, ''],
      ['Core Thief Mana Reduction', v.coreThiefManaReductionPercent, '%'],
      ['Attack Speed', v.attackSpeedPercent, '%'], ['Critical Rate', v.criticalRatePercentagePoints, '%'],
      ['Evasion', v.evasion, ''], ['Movement Speed', v.movementSpeedPercent, '%'],
      ['Duration', v.durationSeconds, 's'], ['Critical Rate against target', v.weakpointCritPercentagePoints, '%'],
      ['Your Weakpoint Final Damage Payoff', v.ownWeakpointFinalDamagePercent, '%'],
      ['Flank Final Damage', v.flankFinalDamagePercent, '%'], ['Rear Final Damage', v.rearFinalDamagePercent, '%'],
      ['Reposition Distance', v.repositionDistanceMeters, ' m'],
    ] as const;
    return fields.filter(([, value]) => value !== undefined).map(([label, value, unit]) => ({ label, value: `${unit === 's' || unit === ' m' || value! < 0 ? '' : '+'}${value}${unit}` }));
  }
  if (definition.id === 'v3-blade-master-twin-blade-mastery') {
    const accuracy = runtime.rankEffects?.[rankIndex(rank, runtime.maxLevel)]?.modifiers?.[0]?.stats?.flat?.accuracy ?? 0;
    const affected = BLADE_MASTER_V3_SKILLS
      .filter((skill) => BLADE_MASTER_MASTERY_MANA_SKILLS.has(skill.id))
      .map((skill) => skill.name)
      .join(', ');
    return [
      { label: 'Capability', value: 'Unlocks Dual Wield at Rank 1' },
      { label: 'Accuracy', value: `+${accuracy}` },
      { label: 'Mana Reduction', value: `${BLADE_MASTER_MASTERY_MANA_REDUCTION_BY_RANK[rankIndex(rank, BLADE_MASTER_MASTERY_MANA_REDUCTION_BY_RANK.length)]}%` },
      { label: 'Affected Skills', value: affected },
    ];
  }
  for (const effect of [...(definition.effects?.buffs ?? []), ...(definition.effects?.debuffs ?? [])]) {
    rows.push({ label: effectLabel(effect), value: effectLabel(effect) });
  }
  const rankEffect = runtime.rankEffects?.[rankIndex(rank, runtime.maxLevel)];
  const buffs = rankEffect?.temporaryBuffs ?? [];
  for (const buff of buffs) {
    const stats = buff.modifier.stats;
    for (const [key, value] of Object.entries(stats?.flat ?? {})) rows.push({ label: effectLabel(key), value: statDisplayValue(key, value!) });
    for (const [key, value] of Object.entries(stats?.percent ?? {})) rows.push({ label: effectLabel(key), value: `+${value}%` });
    if (buff.modifier.action?.damagePercent !== undefined) rows.push({ label: 'Physical Damage', value: `+${buff.modifier.action.damagePercent}%` });
  }
  return rows;
}

function rowsForMechanics(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  const rows: SkillPresentationRow[] = [];
  if (runtime.vanish) return [
    { label: 'Duration', value: 'No Time Limit' },
    { label: 'Cooldown Begins', value: 'When Vanish Ends' },
    { label: 'Breaks On', value: 'Offensive Action / Successful Direct Damage' },
    { label: 'Stealth', value: 'Miss / Evade and periodic DoT do not break Vanish. No cleanse or invulnerability. Death, job change and explicit Reveal end Vanish.' },
    ...(runtime.vanish.job === 'rogue' ? [
      { label: 'Effect', value: 'Opening offensive action grants Ambush before the attack snapshots its effects.' },
      { label: 'Ambush', value: '4s · +15% Final Damage for eligible Rogue attacks; Backpierce uses Rear only. Consumed on first successful damaging impact.' },
    ] : []),
  ];
  const assasin=assasinSkillDetails(definition.id,rank);
  if (assasin) {
    const config=assasin.mechanics;
    return [
      ...(assasin.hands.length ? [{label:'Sequence',value:assasin.hands.map(hand=>hand==='BOTH'?'Both Daggers':hand==='OFF'?'Off Hand':'Main Hand').join(' → ')},
        {label:'Hit Distribution',value:assasin.weights.map(weight=>`${Math.round(weight*100)}%`).join(' / ')},
        {label:'Direct Impact',value:`${runtime.weaponMode?.startsWith('THROWN') ? 'Thrown Dagger · ' : ''}Can Crit · weapon is not consumed`}] : []),
      ...(config?.normalPoison ? [{label:'Your Poison',value:config.normalPoison==='REFRESH_OR_APPLY'
        ? 'Successful hit: 0 own stacks → apply 1; existing own Poison → refresh only, no extra stack.'
        : `+1 stack per successful hit; maximum +${config.maxPoisonStacksGrantedPerExecution} per execution. At 5: refresh only. Evade grants none.`}] : []),
      ...(config?.execution ? [{label:'Requires',value:`Target HP ≤${EXECUTION_HP_THRESHOLD*100}% and your normal Poison`},
        {label:'Own Poison Final Damage',value:EXECUTION_PAYOFF.map((value,i)=>`${i+1}: +${Math.round(value*100)}%`).join(' / ')},
        {label:'Consumption',value:'Successful damaging hit consumes all YOUR normal Poison; Evade consumes none. Venom Eclipse remains.'}] : []),
      ...(config?.eclipse ? [{label:'Ultimate DoT',value:`${ECLIPSE_DURATION}s · tick every ${ECLIPSE_TICK_INTERVAL}s · no Crit · separate from normal Poison`},
        {label:'Own Poison Snapshot',value:ECLIPSE_STACK_MULTIPLIERS.map((value,i)=>`${i}: ×${value.toFixed(2)}`).join(' / ')},
        {label:'Normal Poison Refresh',value:`Successful application refreshes existing own Poison to ${ECLIPSE_DURATION}s. No consumption, no stack creation, no extra Slow.`}] : []),
      ...(assasin.passive ? [{label:'Poison Profile',value:'Uses current learned Venom Mastery rank and caster stats on successful application/refresh. Normal Poison ticks cannot Crit.'}] : []),
    ];
  }
  const rogue = rogueSkillDetails(definition.id, rank);
  if (rogue) return [
    ...(rogue.hands.length ? [{ label: 'Sequence', value: rogue.hands.map(hand => hand === 'MAIN' ? 'Main Hand' : hand === 'OFF' ? 'Off Hand' : 'Both Daggers').join(' → ') },
      { label: 'Hit Distribution', value: rogue.weights.map(weight => `${Math.round(weight * 100)}%`).join(' / ') }] : []),
    ...(rogue.ambush?.requiresAmbush ? [{ label: 'Requires Ambush', value: 'Active Ambush or an offensive opening from Rogue Vanish' }] : []),
    ...(rogue.ambush?.ambushEligible ? [{ label: 'Ambush Interaction', value: rogue.ambush.interaction?.mode === 'POSITION_OVERRIDE'
      ? `Counts as ${titleCase(rogue.ambush.interaction.position === 'side' ? 'flank' : rogue.ambush.interaction.position)}; uses that positional bonus only, with no additional default Ambush multiplier. Consumed on first successful damaging hit.`
      : `+${percentage(Math.round((AMBUSH_FINAL_DAMAGE - 1) * 100))} Final Damage for the execution; consumed on first successful damaging hit` }] : []),
    ...(rogue.ambush?.generator ? [{ label: 'Ambush Generation', value: rogue.ambush.generator.source === 'SLIPSTEP' ? `Finish movement at Flank / Rear of selected target → Ambush ${AMBUSH_DURATION}s` : `Configured successful effect → Ambush ${AMBUSH_DURATION}s` }] : []),
  ];
  const thief = resolveThiefCanonicalRank(definition.id, rank);
  if (thief) {
    if (definition.familyRole === 'PASSIVE') return [{ label: 'Family Effects', value: 'Only the active member contributes; predecessors do not stack.' }];
    const sequence = runtime.rankEffects?.[rank - 1]?.hitSequence;
    if (sequence) rows.push({ label: 'Sequence', value: sequence.map(hit => hit.weaponHand === 'OFF' ? 'Off Hand' : 'Main Hand').join(' → ') });
    if (sequence && sequence.length > 1) rows.push({ label: 'Hit Distribution', value: sequence.map(hit => `${Math.round((hit.sharedContributionWeight ?? 0) * 100)}%`).join(' / ') });
    const identity = THIEF_V3_SKILL_MAP[definition.id]?.branchIdentity;
    if (identity) rows.push({ label: 'Branch Identity', value: identity });
    if (thief.mechanics.weakpoint || thief.mechanics.weakpointPayoff) rows.push({ label: 'Weakpoint Ownership', value: 'This caster only; not Armor Break.' });
    if (thief.mechanics.positional) rows.push({ label: 'Position', value: 'Target-facing Front / Flank / Rear; front still deals normal damage.' });
    if (thief.mechanics.movement?.direction === 'PLAYER_INPUT_LEFT_RIGHT') rows.push({ label: 'Reposition', value: 'Player-directed left/right movement after sequence; no input means no reposition. No iframe, no invulnerability.' });
    if (thief.mechanics.movement?.direction === 'BACKWARD') rows.push({ label: 'Reposition', value: 'Backward movement; no iframe or invulnerability.' });
    if (thief.mechanics.areaShape) rows.push({ label: 'Area Effects', value: 'No Stun · No Poison' });
    rows.push({ label: 'Family', value: 'Evolution replaces the previous member; cooldown is shared.' });
    return rows;
  }
  const tags = definition.effects?.tags ?? [];
  if (runtime.hitSequence?.some((hit) => hit.weaponHand)) {
    const hands = runtime.hitSequence.map((hit) => hit.weaponHand === 'MAIN' ? 'Main Hand' : hit.weaponHand === 'OFF' ? 'Off Hand' : 'Both Swords');
    rows.push({ label: 'Sequence', value: hands.join(' → ') });
  } else if (tags.some((tag) => tag.includes('dual-sequence'))) rows.push({ label: 'Sequence', value: 'Main Hand → Off Hand' });
  if (tags.some((tag) => tag.includes('dual-combined'))) rows.push({ label: 'Weapon Contribution', value: 'Both Swords' });
  if (tags.some((tag) => tag.includes('single-main'))) rows.push({ label: 'Weapon Contribution', value: 'Main Hand' });
  if (tags.some((tag) => tag.includes('flow-eligible'))) rows.push({ label: 'Flow', value: 'Successful skill +1 Flow' });
  if (tags.some((tag) => tag.includes('tempo'))) rows.push({ label: 'Tempo', value: 'Successful skill +1 Tempo' });
  if (tags.some((tag) => tag.includes('counter'))) rows.push({ label: 'Counter Payoff', value: 'After successful Block / Parry' });
  const counter = tags.find((tag) => tag.startsWith('counter-payoff:'));
  if (counter) rows.push({ label: 'Damage', value: `+${counter.split(':')[1].split(',')[rankIndex(rank, runtime.maxLevel)]}% after Block / Parry` });
  const armor = tags.find((tag) => tag.startsWith('armor-break-payoff:'));
  if (armor) rows.push({ label: 'Your Armor Break', value: `Final Damage +${armor.split(':')[1]}%` });
  if (runtime.armorBreakStrengthByRank) {
    rows.push({ label: 'Defense', value: `-${runtime.armorBreakStrengthByRank[rankIndex(rank, runtime.maxLevel)]}%` });
    rows.push({ label: 'Duration', value: `${runtime.statuses?.[0]?.duration ?? 0}s` });
  }
  if (tags.includes('fury-harvest-recovery')) {
    rows.push({ label: 'Restore HP', value: `${FURY_HARVEST_RECOVERY_PERCENT[rankIndex(rank, FURY_HARVEST_RECOVERY_PERCENT.length)]}% Max HP` });
    rows.push({ label: 'Recovery', value: 'Per successful target' });
    rows.push({ label: 'Recovery Target Cap', value: '5' });
  }
  if (definition.stunProfile) {
    rows.push({ label: 'Stun Chance', value: percentage(definition.stunProfile.chance[rankIndex(rank, runtime.maxLevel)] * 100) });
    rows.push({ label: 'Stun Duration', value: `${definition.stunProfile.pveDuration}s PvE` });
    if (definition.stunProfile.minimumTravelDistance > 0) rows.push({ label: 'Minimum Stun Distance', value: `${definition.stunProfile.minimumTravelDistance} m` });
  }
  return rows;
}

function nextRankRows(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  if (rank >= definition.maxRank) return [];
  const current = runtimeRankValue(runtime, rank);
  const next = runtimeRankValue(runtime, rank + 1);
  const rows: SkillPresentationRow[] = [];
  const add = (label: string, before: number | undefined, after: number | undefined, format: (value: number) => string = String) => {
    if (before !== undefined && after !== undefined && before !== after) rows.push({ label, value: `${format(before)} → ${format(after)}` });
  };
  const currentMin = runtime.baseDamageMinByRank?.[rankIndex(rank, runtime.maxLevel)];
  const nextMin = runtime.baseDamageMinByRank?.[rankIndex(rank + 1, runtime.maxLevel)];
  const currentMax = runtime.baseDamageMaxByRank?.[rankIndex(rank, runtime.maxLevel)];
  const nextMax = runtime.baseDamageMaxByRank?.[rankIndex(rank + 1, runtime.maxLevel)];
  if (currentMin !== undefined && nextMin !== undefined && currentMax !== undefined && nextMax !== undefined) {
    rows.push({ label: 'Base Damage', value: `${currentMin}–${currentMax} → ${nextMin}–${nextMax}` });
  }
  add('Physical Attack', current.physicalCoefficient, next.physicalCoefficient, coefficient);
  for (const stat of ['str', 'dex', 'vit', 'int'] as const) add(`Bonus ${stat.toUpperCase()}`, current.statScaling?.[stat], next.statScaling?.[stat], value => coefficient(value, runtime.tags?.includes('v3-rogue')));
  add('Mana', current.manaCost, next.manaCost);
  add('Cooldown', current.cooldown, next.cooldown, (value) => `${value}s`);
  add('Radius', current.radius, next.radius, (value) => `${value} m`);
  add('Max Targets', current.maxTargets, next.maxTargets);
  if (definition.stunProfile) add('Stun Chance', definition.stunProfile.chance[rankIndex(rank, definition.maxRank)] * 100, definition.stunProfile.chance[rankIndex(rank + 1, definition.maxRank)] * 100, percentage);
  return rows;
}

export function resolveSkillPresentation(hero: Hero, definition: SkillDefinitionV3, runtime: SkillDefinition): SkillPresentationModel {
  if (definition.jobId === 'thief' || definition.jobId === 'rogue' || definition.jobId === 'assasin')
    return resolveLineagePresentation(hero, definition, runtime);
  const currentRank = skillLevel(hero, runtime);
  const rank = Math.max(1, currentRank);
  const values = runtimeRankValue(runtime, rank);
  const action = resolveHeroSkill(hero, runtime, rank);
  const isDamage = definition.skillType === 'ACTIVE_DAMAGE' || definition.skillType === 'ACTIVE_MOBILITY' || definition.skillType === 'ULTIMATE' || (runtime.tags?.includes('v3-thief') === true && !!definition.damageProfile);
  const status = currentRank >= definition.maxRank ? 'MAX RANK' : currentRank > 0 ? 'LEARNED' : hero.level >= (definition.unlockLevel ?? 0) ? 'AVAILABLE' : 'LOCKED';
  const isPassive = definition.skillType === 'PASSIVE' || definition.skillType === 'MASTERY';
  const requirements: SkillPresentationRow[] = [
    { label: 'Character Requirement', value: `Lv. ${definition.rankLevelRequirements?.[0] ?? definition.unlockLevel ?? 1}` },
    { label: 'Job Requirement', value: definition.jobRequirement ?? jobLabels[definition.jobId] ?? titleCase(definition.jobId) },
    { label: 'Skill Point Cost', value: `${Array.isArray(definition.spCostPerRank) ? definition.spCostPerRank[rankIndex(rank, definition.maxRank)] : definition.spCostPerRank ?? 0} SP` },
    { label: 'Prerequisite', value: definition.prerequisiteSkills?.map((entry) => `${entry.skillId.replace(/^v3-/, '').replaceAll('-', ' ')} R${entry.requiredRank}`).join(' + ') || 'None' },
    { label: 'Weapon', value: (definition.weaponRequirement ?? (runtime.tags?.includes('v3-thief') ? runtime.weaponRequirement : undefined))?.map((weapon) => weaponLabels[weapon] ?? weaponRequirementLabel(weapon as never)).join(' / ') || 'None' },
  ];
  if (definition.jobInvestmentRequirement) requirements.push({ label: 'Job Investment', value: `${definition.jobInvestmentRequirement.minimumSP} SP in ${titleCase(definition.jobInvestmentRequirement.jobId)}` });
  const baseDamageRange = runtime.baseDamageMinByRank && runtime.baseDamageMaxByRank
    ? `${runtime.baseDamageMinByRank[rankIndex(rank, runtime.maxLevel)] ?? 0} – ${runtime.baseDamageMaxByRank[rankIndex(rank, runtime.maxLevel)] ?? 0}`
    : null;
  const damage = isDamage ? [
    { label: 'Damage Type', value: 'Physical' },
    ...(baseDamageRange ? [{ label: 'Base Damage', value: baseDamageRange }] : []),
    { label: 'Hits', value: String(action.hitSequence.length) },
    ...(values.physicalCoefficient ? [{ label: 'Physical Attack', value: coefficient(values.physicalCoefficient) }] : []),
    ...(['str', 'dex', 'vit', 'int'] as const).filter((stat) => (values.statScaling?.[stat] ?? 0) !== 0).map((stat) => ({ label: `Bonus ${stat.toUpperCase()}`, value: coefficient(values.statScaling![stat]!, runtime.tags?.includes('v3-rogue')) })),
  ] : [];
  const area: SkillPresentationRow[] = [
    { label: 'Target Type', value: definition.targeting?.targetType === 'single' ? 'Single Target' : definition.targeting?.targetType === 'frontal_arc' ? 'Frontal Area' : definition.targeting?.targetType === 'area' ? 'Area Around You' : 'Self' },
    ...(action.range ? [{ label: 'Range', value: `${action.range} m` }] : []),
    ...(action.radius ? [{ label: 'Radius', value: `${action.radius} m` }] : []),
    ...(action.maxTargets ? [{ label: 'Max Targets', value: String(action.maxTargets) }] : []),
  ];
  const resource = isPassive ? [] : [{ label: 'Mana', value: `${action.manaCost} MP` }, { label: 'Cooldown', value: `${action.cooldown}s` }];
  const effects = rowsForEffects(definition, runtime, rank);
  return { skillName: definition.name, description: definition.presentation?.description ?? runtime.description, skillType: definition.skillType, currentRank, maxRank: definition.maxRank, status, requirements, damage, effects, specialMechanics: rowsForMechanics(definition, runtime, rank), area, resource, nextRank: nextRankRows(definition, runtime, rank), isDamage };
}

/** Canonical information, not a simulated cast. No character stats, RNG,
 * temporary buffs, live Mana reductions or equipment damage enter these rows. */
function lineageRows(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  const i = rankIndex(rank, definition.maxRank), values = runtimeRankValue(runtime, rank);
  const passive = definition.skillType === 'PASSIVE' || definition.skillType === 'MASTERY';
  const damaging = !runtime.nonDamaging && !!definition.damageProfile;
  const sequence = runtime.rankEffects?.[i]?.hitSequence ?? runtime.hitSequence ?? [];
  const damage: SkillPresentationRow[] = damaging ? [
    ...(runtime.baseDamageMinByRank && runtime.baseDamageMaxByRank ? [{ label: 'Base Damage', value: `${runtime.baseDamageMinByRank[i]} – ${runtime.baseDamageMaxByRank[i]}` }] : []),
    { label: 'Physical Scaling', value: coefficient(values.physicalCoefficient ?? runtime.physicalCoefficient ?? 0, true) },
    ...(['str', 'dex'] as const).map(stat => ({ label: `Bonus ${stat.toUpperCase()}`, value: coefficient(values.statScaling?.[stat] ?? 0, true) })),
  ] : [];
  const range = values.range ?? runtime.range, radius = values.radius ?? runtime.areaRadius;
  const maxTargets = values.maxTargets ?? runtime.maxTargets;
  const area: SkillPresentationRow[] = passive ? [] : [
    { label: 'Target Type', value: runtime.targetType === 'single' ? 'Single Target' : runtime.targetType === 'area' ? 'Area Around You' : runtime.targetType === 'frontal_arc' ? 'Frontal Area' : 'Self' },
    ...(damaging ? [{ label: 'Hits', value: String(sequence.length || 1) }] : []),
    ...(range > 0 ? [{ label: 'Range', value: `${range} m` }] : []),
    ...(radius > 0 ? [{ label: 'Radius', value: `${radius} m` }] : []),
    ...(maxTargets ? [{ label: 'Target Cap', value: String(maxTargets) }] : []),
  ];
  const resource = passive ? [] : [
    { label: 'Mana', value: `${values.manaCost ?? runtime.manaCost} MP` },
    { label: 'Cooldown', value: `${values.cooldown ?? runtime.cooldown}s` },
  ];
  return { damage, area, resource, effects: rowsForEffects(definition, runtime, rank), specialMechanics: rowsForMechanics(definition, runtime, rank), isDamage: damaging };
}
function resolveLineagePresentation(hero: Hero, definition: SkillDefinitionV3, runtime: SkillDefinition): SkillPresentationModel {
  const currentRank = hero.skillProgressionV3?.skillRanks[definition.id] ?? hero.skillLevels[definition.id] ?? 0;
  const rank = Math.max(1, currentRank), rows = lineageRows(definition, runtime, rank);
  const view = skillNodePresentation(hero, definition.id);
  const requirements: SkillPresentationRow[] = [
    { label: 'Level', value: `Lv. ${definition.unlockLevel ?? runtime.unlockLevel}` },
    { label: 'Job', value: titleCase(definition.jobRequirement ?? definition.jobId) },
    { label: 'SP Cost', value: `${Array.isArray(definition.spCostPerRank) ? definition.spCostPerRank[rankIndex(rank, definition.maxRank)] : definition.spCostPerRank} SP / rank` },
    { label: 'Prerequisite', value: definition.prerequisiteSkills?.map(p => `${canonicalSkillName(p.skillId)} R${p.requiredRank}`).join(' + ') || 'None' },
    { label: 'Weapon', value: (definition.weaponRequirement ?? runtime.weaponRequirement).map(w => weaponRequirementLabel(w as never)).join(' / ') || 'None' },
  ];
  if (definition.jobInvestmentRequirement) requirements.push({ label: 'Job Investment', value: `${definition.jobInvestmentRequirement.minimumSP} SP in ${titleCase(definition.jobInvestmentRequirement.jobId)}` });
  const nextRank: SkillPresentationRow[] = [];
  if (currentRank > 0 && currentRank < definition.maxRank) {
    const next = lineageRows(definition, runtime, currentRank + 1);
    nextRank.push({ label: 'Rank', value: `R${currentRank} → R${currentRank + 1} · ${view?.cost ?? 0} SP` });
    for (const section of ['damage', 'area', 'resource', 'effects', 'specialMechanics'] as const) {
      for (const after of next[section]) {
        const before = rows[section].find(r => r.label === after.label);
        if (before?.value !== after.value) nextRank.push({ label: after.label, value: before ? `${before.value} → ${after.value}` : after.value });
      }
    }
  }
  return { skillName: definition.name, description: definition.presentation?.description ?? runtime.description,
    skillType: definition.skillType, currentRank, maxRank: definition.maxRank,
    status: currentRank >= definition.maxRank ? 'MAX RANK' : currentRank > 0 ? 'LEARNED' : view?.purchase.ok ? 'AVAILABLE' : 'LOCKED',
    requirements, nextRank, ...rows };
}
