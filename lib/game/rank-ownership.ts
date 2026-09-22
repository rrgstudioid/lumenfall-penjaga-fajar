export type RankSource = {
  granted: number;
  paid: number;
  legacyUncertain?: true;
};
export type RankOwnership = {
  version: 1;
  active: Record<string, RankSource>;
  passive: Record<string, RankSource>;
};
export type RankHost = {
  skillLevels: Record<string, number>;
  passiveLevels: Record<string, number>;
  rankOwnership?: RankOwnership;
};
export type TreeScope = { id: string; architecture: 'legacy' | 'v2' };
export type TreeInvestmentRequirement = { tree: TreeScope; paidRanks: number };
const rank = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
export function rankSource(
  hero: RankHost,
  kind: 'active' | 'passive',
  id: string,
): RankSource {
  const total = rank(
    (kind === 'active' ? hero.skillLevels : hero.passiveLevels)[id],
  );
  const source =
    hero.rankOwnership?.version === 1
      ? hero.rankOwnership[kind]?.[id]
      : undefined;
  const granted = Math.min(total, rank(source?.granted));
  // Unknown origin is refundable, never silently confiscated. A one-time legacy windfall
  // is possible; metadata persists after normal save, so repeated reset cannot mint ranks.
  return {
    granted,
    paid: total - granted,
    ...(!source || source.legacyUncertain
      ? { legacyUncertain: true as const }
      : {}),
  };
}
export function normalizedRankOwnership(hero: RankHost): RankOwnership {
  const result: RankOwnership = { version: 1, active: {}, passive: {} };
  for (const kind of ['active', 'passive'] as const)
    for (const id of Object.keys(
      kind === 'active' ? hero.skillLevels : hero.passiveLevels,
    ))
      result[kind][id] = rankSource(hero, kind, id);
  return result;
}
export function buyRank(
  hero: RankHost,
  kind: 'active' | 'passive',
  id: string,
) {
  const source = rankSource(hero, kind, id),
    levels = kind === 'active' ? hero.skillLevels : hero.passiveLevels;
  hero.rankOwnership = normalizedRankOwnership(hero);
  levels[id] = rank(levels[id]) + 1;
  hero.rankOwnership[kind][id] = { ...source, paid: source.paid + 1 };
}
/** Grants only the missing ranks up to a floor; never converts paid ranks into free ranks. */
export function grantRank(
  hero: RankHost,
  kind: 'active' | 'passive',
  id: string,
  floor: number,
) {
  const source = rankSource(hero, kind, id),
    levels = kind === 'active' ? hero.skillLevels : hero.passiveLevels;
  const extra = Math.max(0, rank(floor) - rank(levels[id]));
  hero.rankOwnership = normalizedRankOwnership(hero);
  levels[id] = rank(levels[id]) + extra;
  hero.rankOwnership[kind][id] = { ...source, granted: source.granted + extra };
}
export function paidTreeInvestment(
  hero: RankHost,
  tree: TreeScope,
  nodes: readonly { id: string; maxLevel: number; tree?: TreeScope }[],
  excludeId?: string,
) {
  const seen = new Set<string>();
  let total = 0;
  for (const node of nodes) {
    if (
      seen.has(node.id) ||
      node.id === excludeId ||
      node.tree?.id !== tree.id ||
      node.tree.architecture !== tree.architecture
    )
      continue;
    seen.add(node.id);
    const kind = Object.hasOwn(hero.skillLevels, node.id)
      ? 'active'
      : 'passive';
    const source = rankSource(hero, kind, node.id);
    total += Math.min(source.paid, Math.max(0, node.maxLevel - source.granted));
  }
  return total;
}
