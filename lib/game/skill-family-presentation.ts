import type { Hero } from './rules.ts';
import type { SkillDefinition } from './skills.ts';
import { heroFamilyContext, skillFamilyDefinitions } from './skill-family-runtime.ts';
import { getFamilyPath, resolveSkillFamily } from './skill-family.ts';
import { canPurchaseSkillRank, getSkillFamilyNodeState, skillCostThroughRank } from './skill-progression-v3.ts';

const displayJob = (id: string) => id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const canonicalSkillName = (id: string) => skillFamilyDefinitions[id]?.name ?? 'Skill prerequisite';

/** Read-only projection of canonical progression; never purchases or repairs state. */
export function skillNodePresentation(hero: Hero, skillId: string) {
  const context = heroFamilyContext(hero), definition = skillFamilyDefinitions[skillId];
  if (!context || !definition) return null;
  const rank = context.state.skillRanks[skillId] ?? 0;
  const purchase = canPurchaseSkillRank(context, skillId);
  const states = definition.familyId ? getSkillFamilyNodeState(context, skillId) : [];
  const labels: string[] = [];
  if (states.includes('REPLACED')) labels.push('REPLACED · Completed');
  else if (states.includes('BRANCH_EXCLUDED')) labels.push('BRANCH EXCLUDED');
  else {
    if (rank > 0) labels.push(states.includes('ACTIVE') ? 'ACTIVE' : 'LEARNED');
    if (rank >= definition.maxRank) labels.push('MAX RANK');
    if (states.includes('BRANCH_SELECTED')) labels.push('BRANCH SELECTED');
    if (!rank && purchase.ok) labels.push('AVAILABLE');
  }
  const requirementName = canonicalSkillName(purchase.requiredSkillId ?? '');
  let reason = '';
  switch (purchase.reason) {
    case 'REQUIRES_LEVEL': reason = `Requires Lv. ${purchase.requiredLevel}`; labels.push('LOCKED — LEVEL'); break;
    case 'REQUIRES_SKILL': reason = `Requires ${requirementName} R${purchase.requiredRank}`; labels.push('LOCKED — PREREQUISITE'); break;
    case 'INSUFFICIENT_SP': reason = `Requires ${purchase.requiredSP} SP`; labels.push('LOCKED — SP'); break;
    case 'WRONG_JOB': case 'WRONG_SPECIALIZATION': case 'WRONG_ANCESTRY':
      reason = `Requires ${displayJob(purchase.requiredJobId ?? definition.jobId)}`; labels.push('LOCKED — JOB'); break;
    case 'REQUIRES_JOB_INVESTMENT': reason = `Requires ${purchase.requiredSP} SP invested in ${displayJob(purchase.requiredJobId ?? definition.jobId)}`; labels.push('LOCKED — PREREQUISITE'); break;
    case 'REPLACED': reason = 'Sudah berevolusi; anggota family aktif menggantikan skill ini.'; break;
    case 'BRANCH_EXCLUDED': reason = 'Mutually exclusive · cabang lain dipilih. Ubah pilihan melalui Skill Reset.'; break;
    case 'MAX_RANK': reason = 'Rank maksimum.'; break;
    case 'INVALID_FAMILY': case 'INVALID_SKILL': reason = 'Data progression belum tersedia.'; labels.push('UNAVAILABLE'); break;
  }
  return { definition, rank, purchase, states, labels,
    reason, cost: rank < definition.maxRank ? skillCostThroughRank(definition, rank + 1) - skillCostThroughRank(definition, rank) : 0,
    active: definition.familyId ? states.includes('ACTIVE') : rank > 0,
    replaced: states.includes('REPLACED'), excluded: states.includes('BRANCH_EXCLUDED'),
    branchPurchase: rank === 0 && definition.familyStage === 'BRANCH' && definition.isMutuallyExclusive === true,
  };
}

/** Edges/roots/order all come from metadata, never a UI-owned skill-ID graph. */
export function skillFamilyOverview(hero: Hero, runtimeSkills: readonly SkillDefinition[]) {
  const context = heroFamilyContext(hero);
  if (!context) return [];
  const runtimeById = new Map(runtimeSkills.map(skill => [skill.id, skill]));
  const ids = [...new Set(runtimeSkills.flatMap(skill => context.skills[skill.id]?.familyId ? [context.skills[skill.id].familyId!] : []))];
  return ids.map(familyId => {
    const definitions = Object.values(context.skills).filter(d => d.familyId === familyId && runtimeById.has(d.id));
    const root = definitions.find(d => d.familyStage === 'ROOT');
    const progress = resolveSkillFamily(context, familyId);
    const active = progress.activeSkillId ? context.skills[progress.activeSkillId] : undefined;
    const depths = definitions.map(d => ({ definition: d, depth: (getFamilyPath(d.id, context.skills)?.length ?? 1) - 1 }));
    return { id: familyId, name: displayJob(familyId.replace(/^thief_/, '')), rootId: root?.id,
      role: root?.familyRole, active, rank: active ? context.state.skillRanks[active.id] ?? 0 : 0,
      stages: [...new Set(depths.map(d => d.depth))].sort((a, b) => a - b).map(depth => depths.filter(d => d.depth === depth).map(d => runtimeById.get(d.definition.id)!)),
      progress: ['ROOT', 'UPGRADE', 'BRANCH'].map(stage => ({ stage,
        complete: definitions.some(d => d.familyStage === stage && progress.history.includes(d.id)),
      })),
      available: definitions.filter(d => canPurchaseSkillRank(context, d.id).ok).map(d => d.name),
    };
  });
}
export type SkillFamilyOverview = ReturnType<typeof skillFamilyOverview>[number];
