import type { SkillDefinitionV3, SkillProgressionContextV3, SkillProgressionV3State } from './skill-progression-v3.ts';

/** Opt-in metadata. Rank costs/gates/numbers still belong to the skill definition. */
export type SkillFamilyMetadata = {
  familyId?: string;
  familyStage?: 'ROOT' | 'UPGRADE' | 'BRANCH' | 'EVOLUTION';
  familyRole?: 'ACTIVE' | 'PASSIVE' | 'UTILITY';
  replacesSkillId?: string;
  familyPredecessorId?: string;
  familyPredecessorRank?: number;
  familyNextOptions?: string[];
  branchGroupId?: string;
  branchChoiceId?: string;
  isMutuallyExclusive?: boolean;
  /** Explicit opt-in only: descendants do not inherit mechanics automatically. */
  familyMechanics?: Record<string, { eligible: boolean; sourceScope: 'SKILL' | 'FAMILY' }>;
};

export type SkillFamilyProgress = {
  activeSkillId: string | null;
  history: string[];
  chosenBranches: Record<string, string>;
};
export type SkillFamilyState = Record<string, SkillFamilyProgress>;
type Registry = Record<string, SkillDefinitionV3>;
export type FamilyContext = Pick<SkillProgressionContextV3, 'state' | 'skills' | 'level'>;
const parentId = (node: SkillFamilyMetadata) => node.familyPredecessorId ?? node.replacesSkillId;
const positiveRank = (state: SkillProgressionV3State, id: string) => Math.max(0, state.skillRanks[id] ?? 0);

export function getSkillFamily(skillId: string, skills: Registry) {
  const familyId = skills[skillId]?.familyId;
  return familyId ? { familyId, nodes: Object.values(skills).filter(s => s.familyId === familyId) } : null;
}

/** Fail closed on incomplete metadata, cross-family edges and cycles. */
export function getFamilyPath(skillId: string, skills: Registry): SkillDefinitionV3[] | null {
  const leaf = skills[skillId];
  if (!leaf?.familyId) return null;
  const path: SkillDefinitionV3[] = [], seen = new Set<string>();
  const branchChoices = new Map<string, string>();
  let node: SkillDefinitionV3 | undefined = leaf;
  while (node) {
    if (seen.has(node.id) || node.familyId !== leaf.familyId || !node.familyStage || !node.familyRole || node.familyRole !== leaf.familyRole) return null;
    if ((node.skillType === 'PASSIVE' || node.skillType === 'MASTERY') !== (node.familyRole === 'PASSIVE')) return null;
    if (node.replacesSkillId && node.familyPredecessorId && node.replacesSkillId !== node.familyPredecessorId) return null;
    if (node.familyStage === 'BRANCH' && (!node.branchGroupId || !node.branchChoiceId)) return null;
    if (node.branchGroupId && node.branchChoiceId && (node.isMutuallyExclusive || node.familyStage === 'BRANCH')) {
      const choice = branchChoices.get(node.branchGroupId);
      if (choice && choice !== node.branchChoiceId) return null;
      branchChoices.set(node.branchGroupId, node.branchChoiceId);
    }
    seen.add(node.id);
    path.unshift(node);
    const predecessor = parentId(node);
    if (!predecessor) return node.familyStage === 'ROOT' ? path : null;
    if (node.familyStage === 'ROOT') return null;
    const parent: SkillDefinitionV3 | undefined = skills[predecessor];
    if (!parent || (parent.familyNextOptions && !parent.familyNextOptions.includes(node.id))) return null;
    node = parent;
  }
  return null;
}

export function familyNodeEligible(context: FamilyContext, node: SkillDefinitionV3, rank = 1) {
  const { state, level } = context;
  const jobs = new Set(['adventurer', state.chosenCoreJob, state.chosenSpecialization, state.chosenAdvancedJob]);
  return jobs.has(node.jobId) && (!node.jobRequirement || jobs.has(node.jobRequirement))
    && !(node.ancestryRequirement ?? []).some(job => !jobs.has(job))
    && level >= (node.rankLevelRequirements?.[rank - 1] ?? node.unlockLevel ?? 1)
    && !(node.prerequisiteSkills ?? []).some(p => positiveRank(state, p.skillId) < p.requiredRank)
    && (!parentId(node) || positiveRank(state, parentId(node)!) >= (node.familyPredecessorRank ?? 1));
}

/** Rank ownership is authority; persisted active IDs can never grant a skill. */
export function resolveSkillFamily(context: FamilyContext, familyId: string): SkillFamilyProgress {
  const saved = context.state.skillFamilies?.[familyId];
  const candidates = Object.values(context.skills).filter(s => s.familyId === familyId)
    .map(s => getFamilyPath(s.id, context.skills))
    .filter((path): path is SkillDefinitionV3[] => !!path && path.every(node => {
      const rank = positiveRank(context.state, node.id);
      return rank > 0 && rank <= node.maxRank && familyNodeEligible(context, node, rank);
    }));
  // Only relevant for malformed saves: retain the recorded branch, then prefer
  // the deepest valid chain, then stable ID order. Never activate two paths.
  const preference = (path: SkillDefinitionV3[]) => path.reduce((n, s) => n +
    (s.branchGroupId && saved?.chosenBranches?.[s.branchGroupId] === s.branchChoiceId ? 1 : 0), 0);
  candidates.sort((a, b) => preference(b) - preference(a) || b.length - a.length || a.at(-1)!.id.localeCompare(b.at(-1)!.id));
  const path = candidates[0] ?? [];
  return {
    activeSkillId: path.at(-1)?.id ?? null,
    history: path.map(s => s.id),
    chosenBranches: Object.fromEntries(path.filter(s => s.branchGroupId && s.branchChoiceId).map(s => [s.branchGroupId!, s.branchChoiceId!])),
  };
}

export function getActiveSkillForFamily(context: FamilyContext, familyId: string) {
  const id = resolveSkillFamily(context, familyId).activeSkillId;
  return id ? context.skills[id] : null;
}

export function isActiveFamilyMember(context: FamilyContext, skillId: string) {
  const family = context.skills[skillId]?.familyId;
  return !family || resolveSkillFamily(context, family).activeSkillId === skillId;
}

export function familyPurchaseBlock(context: FamilyContext, skillId: string): 'INVALID_FAMILY' | 'BRANCH_EXCLUDED' | 'REPLACED' | 'REQUIRES_SKILL' | null {
  const skill = context.skills[skillId];
  if (!skill?.familyId) return null;
  const path = getFamilyPath(skillId, context.skills);
  if (!path) return 'INVALID_FAMILY';
  const progress = resolveSkillFamily(context, skill.familyId);
  const learned = Object.values(context.skills).filter(s => s.familyId === skill.familyId && positiveRank(context.state, s.id) > 0);
  // All learned nodes must be ancestors of this purchase or the purchase itself.
  // This also rejects alternate roots and branches without trusting UI state.
  if (learned.some(s => !path.some(p => p.id === s.id)))
    return progress.history.includes(skillId) ? 'REPLACED' : 'BRANCH_EXCLUDED';
  const predecessor = parentId(skill);
  if (predecessor && positiveRank(context.state, predecessor) < (skill.familyPredecessorRank ?? 1)) return 'REQUIRES_SKILL';
  if (predecessor && !positiveRank(context.state, skillId) && progress.activeSkillId !== predecessor) return 'REQUIRES_SKILL';
  return null;
}

/** Repair configured families only. Removing invalid paid ranks frees existing
 * earned SP through normal spent-SP accounting, never by crediting earned SP. */
export function reconcileSkillFamilies(context: FamilyContext): void {
  const families = [...new Set(Object.values(context.skills).flatMap(s => s.familyId ? [s.familyId] : []))];
  if (!families.length) { delete context.state.skillFamilies; return; }
  let changed: boolean;
  do {
    changed = false;
    for (const family of families) {
      const progress = resolveSkillFamily(context, family);
      for (const node of Object.values(context.skills)) {
        if (node.familyId === family && positiveRank(context.state, node.id) && !progress.history.includes(node.id)) {
          delete context.state.skillRanks[node.id];
          changed = true;
        }
      }
    }
  } while (changed);
  context.state.skillFamilies = Object.fromEntries(families.map(id => [id, resolveSkillFamily(context, id)]));
}

export function normalizeSkillFamilyState(value: unknown): SkillFamilyState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries: [string, SkillFamilyProgress][] = [];
  for (const [id, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Record<string, unknown>;
    const branches = source.chosenBranches;
    entries.push([id, {
      activeSkillId: typeof source.activeSkillId === 'string' ? source.activeSkillId : null,
      history: Array.isArray(source.history) ? source.history.filter((s): s is string => typeof s === 'string') : [],
      chosenBranches: Object.fromEntries(branches && typeof branches === 'object' ? Object.entries(branches).filter((p): p is [string, string] => typeof p[1] === 'string') : []),
    }]);
  }
  return Object.fromEntries(entries);
}

export const familyBinding = (familyId: string) => `family:${familyId}`;
export const isFamilyBinding = (id: string) => id.startsWith('family:');
export function resolveFamilySkillReference(context: FamilyContext, reference: string, followPredecessor = false): string | null {
  const family = isFamilyBinding(reference) ? reference.slice(7) : followPredecessor ? context.skills[reference]?.familyId : undefined;
  return family ? resolveSkillFamily(context, family).activeSkillId : reference;
}

export function resolveFamilyCooldownKey(skillId: string, skills: Registry): string {
  const family = skills[skillId]?.familyId;
  return family ? familyBinding(family) : skillId;
}

/** Read older member keys too; an already-running cooldown must survive evolution. */
export function familyCooldownRemaining(skillId: string, skills: Registry, cooldowns: Record<string, number>): number {
  const family = getSkillFamily(skillId, skills);
  return Math.max(0, cooldowns[resolveFamilyCooldownKey(skillId, skills)] ?? 0,
    ...(family?.nodes ?? []).map(s => cooldowns[s.id] ?? 0));
}

export function familyMechanicSource(skillId: string, mechanicId: string, skills: Registry): string | null {
  const node = skills[skillId], policy = node?.familyMechanics?.[mechanicId];
  if (!policy?.eligible) return null;
  return policy.sourceScope === 'FAMILY' && node.familyId ? familyBinding(node.familyId) : skillId;
}
