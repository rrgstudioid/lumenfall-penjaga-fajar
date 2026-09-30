'use client';
import { useState, type CSSProperties } from 'react';
import { heroFamilyNodeStates, heroFamilySkillActive, skillFamilyDefinitions as v3Definitions } from '@/lib/game/skill-family-runtime';
import { skillFamilyOverview, skillNodePresentation, canonicalSkillName } from '@/lib/game/skill-family-presentation';
import { SkillFamilyBrowser } from './skill-family-browser';
import { LineageMechanics } from './lineage-mechanics';
import { resolvePrimaryHotbarEntry } from '@/lib/game/hotbar';
import {
  Crown,
  LockKeyhole,
  Check,
  Plus,
  ArrowRight,
  Target,
} from 'lucide-react';
import {
  activeSkills,
  canLearnSkill,
  getSkillStatus,
  characterLabel,
  combatProfile,
  skillCosts,
  resolveHeroSkill,
  type Hero,
  type MasteryChoice,
} from '@/lib/game/rules';
import {
  ALL_SKILLS,
  ALL_PASSIVES,
  PASSIVE_EFFECTS,
  type SkillDefinition,
  type PassiveDefinition,
} from '@/lib/game/skills';
import {
  getJobProgression,
  getJobSkillNodes,
  type JobStageId,
} from '@/lib/game/character-view';
import type { Game } from '@/lib/game/world';
import { StatBlockList } from './character-overview';
import { useGameDrag } from './drag-drop-provider';
import { SkillIcon } from './skill-icon';
import { DraggableAlertDialogContent } from './draggable-window';
import { getVisibleJobArchitecture, getV3SkillLineage } from '@/lib/game/job-presentation';
import { rankSource } from '@/lib/game/rank-ownership';
import { availableSkillPointsV3, skillCostThroughRank } from '@/lib/game/skill-progression-v3';
import { weaponRequirementLabel } from '@/lib/game/weapon-style';
import { resolveSkillPresentation, type SkillPresentationModel } from '@/lib/game/skill-presentation-v3';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function PresentationSection({ title, rows }: { title: string; rows: SkillPresentationModel['damage'] }) {
  if (!rows.length) return null;
  return (
    <section className="js-presentation-section">
      <span className="co-kicker">{title}</span>
      <dl>
        {rows.map((row) => (
          <div key={`${title}-${row.label}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function JobSkill({
  hero,
  game,
  onMark,
}: {
  hero: Hero;
  game: Game | null;
  onMark: (npcId: string) => void;
}) {
  const { begin, isDragging } = useGameDrag();
  const path = getJobProgression(hero);
  const panelContext = JSON.stringify([hero.characterId ?? hero.slotId, hero.skillArchitectureVersion,
    ...path.map(entry => [entry.id, entry.name, entry.done])]);
  const [navigation, setNavigation] = useState<{ context: string; stage: JobStageId; skillId: string | null; familyId: string | null } | null>(null);
  const currentNavigation = navigation?.context === panelContext ? navigation : null;
  const stage = currentNavigation?.stage ?? path.find(entry => entry.status === 'Current')?.id ?? 'adventurer';
  const selectedId = currentNavigation?.skillId ?? null;
  const familyId = currentNavigation?.familyId ?? null;
  const setStage = (nextStage: JobStageId) => setNavigation({ context: panelContext, stage: nextStage, skillId: null, familyId: null });
  const setSelectedId = (skillId: string) => setNavigation({ context: panelContext, stage, skillId, familyId });
  const [resetOpen, setResetOpen] = useState(false);
  const [branchChoice, setBranchChoice] = useState<{ id: string; actorId: string } | null>(null);
  const v3Lineage = hero.skillArchitectureVersion === 3 ? getV3SkillLineage(hero) : [];
  const thiefLineage = v3Lineage.some(entry => entry.jobId === 'thief');
  const skillRank = (skill: SkillDefinition | PassiveDefinition) => hero.skillArchitectureVersion === 3 && v3Definitions[skill.id]
    ? hero.skillProgressionV3?.skillRanks[skill.id] ?? 0
    : 'slot' in skill ? hero.skillLevels[skill.id] ?? 0 : hero.passiveLevels[skill.id] ?? 0;
  const grantedLabels = ALL_SKILLS.flatMap(skill => {
    const granted = rankSource(hero, 'active', skill.id).granted;
    return granted ? [`${skill.name} Rank ${granted}`] : [];
  });
  const currentStage = path.find((entry) => entry.id === stage) ?? path[0];
  const nodes = getJobSkillNodes(hero, currentStage.id);
  const allNodes = [...nodes.active, ...nodes.passive];
  const families = thiefLineage && currentStage.id === 'core' ? skillFamilyOverview(hero, nodes.active) : [];
  const family = families.find(entry => entry.id === familyId) ?? families[0];
  const visibleNodes = family ? family.stages.flat() : allNodes;
  const selected =
    visibleNodes.find((skill) => skill.id === selectedId) ?? visibleNodes.find(skill => skill.id === family?.active?.id) ?? visibleNodes[0];
  const selectedView = selected ? skillNodePresentation(hero, selected.id) : null;
  const pendingBranch = branchChoice ? skillNodePresentation(hero, branchChoice.id) : null;
  const branchAlternatives = pendingBranch ? Object.values(v3Definitions).filter(d => d.id !== pendingBranch.definition.id &&
    d.familyId === pendingBranch.definition.familyId && d.branchGroupId === pendingBranch.definition.branchGroupId) : [];
  const selectedActive =
    selected && 'slot' in selected ? (selected as SkillDefinition) : null;
  const selectedPassive =
    selected && !('slot' in selected) ? (selected as PassiveDefinition) : null;
  const resolvedSelected = selectedActive && !v3Definitions[selectedActive.id]
    ? resolveHeroSkill(
        hero,
        selectedActive,
        Math.max(1, hero.skillLevels[selectedActive.id] ?? 0),
      )
    : null;
  const status = selected ? getSkillStatus(selected.id, hero) : 'locked';
  const validation = selected
    ? canLearnSkill(selected.id, hero)
    : { ok: false, reason: 'Selesaikan job quest sebelumnya.' };
  const level = selected ? skillRank(selected) : 0;
  const v3Definition = hero.skillArchitectureVersion === 3 && selected ? v3Definitions[selected.id] : undefined;
  const presentation = v3Definition && selectedActive
    ? resolveSkillPresentation(hero, v3Definition, selectedActive)
    : null;
  const selectedIsMastery = v3Definition?.skillType === 'MASTERY' || v3Definition?.skillType === 'PASSIVE';
  const nextRankCost = v3Definition ? skillCostThroughRank(v3Definition, level + 1) - skillCostThroughRank(v3Definition, level) : 1;
  const availableSP = hero.skillArchitectureVersion === 3 && hero.skillProgressionV3
    ? availableSkillPointsV3(hero.skillProgressionV3, v3Definitions) : hero.skillPoints;
  const totalEarnedSP = hero.skillArchitectureVersion === 3 && hero.skillProgressionV3
    ? hero.skillProgressionV3.totalEarnedSP : hero.skillPoints;
  const spentSP = Math.max(0, totalEarnedSP - availableSP);
  const learned = allNodes.filter(skill => skillRank(skill) > 0).length;
  const archived =
    hero.skillArchitectureVersion !== 3 && nodes.active.length > 0 &&
    !activeSkills(hero).some((skill) => skill.id === nodes.active[0].id);
  const assignedKey = (skillId: string) => {
    const index = hero.primaryHotbar.findIndex(id => resolvePrimaryHotbarEntry(hero, id)?.id === skillId);
    return index < 0 ? '—' : String((index + 1) % 10);
  };
  const loadout = activeSkills(hero).filter(skill => hero.skillArchitectureVersion !== 3 ||
    skillRank(skill) > 0 && skill.usableFromHotbar !== false &&
    !['PASSIVE', 'MASTERY'].includes(v3Definitions[skill.id]?.skillType ?? '') && heroFamilySkillActive(hero, skill.id));
  const inspectLoadout = (skill: SkillDefinition) => {
    const owner = path.find(entry => getJobSkillNodes(hero, entry.id).active.some(node => node.id === skill.id));
    if (owner) setNavigation({ context: panelContext, stage: owner.id, skillId: skill.id,
      familyId: v3Definitions[skill.id]?.familyId ?? null });
  };
  function node(skill: SkillDefinition | PassiveDefinition) {
    const isActive = 'slot' in skill,
      isV3Mastery = v3Definitions[skill.id]?.skillType === 'MASTERY' || v3Definitions[skill.id]?.skillType === 'PASSIVE',
      rank = skillRank(skill);
    const state = getSkillStatus(skill.id, hero),
      can = canLearnSkill(skill.id, hero);
    const familyStates = heroFamilyNodeStates(hero, skill.id);
    const view = skillNodePresentation(hero, skill.id);
    const familyLabel = familyStates.includes('REPLACED') ? 'Sudah berevolusi'
      : familyStates.includes('BRANCH_EXCLUDED') ? 'Cabang lain dipilih'
      : familyStates.includes('ACTIVE') ? 'Family aktif' : null;
    return (
      <button
        key={skill.id}
        data-drag-source="skill"
        data-window-no-drag
        data-skill-id={skill.id}
        onPointerDown={(event) =>
          isActive && !isV3Mastery && rank > 0 && heroFamilySkillActive(hero, skill.id)
            ? begin(event, { dragType: 'skill', refId: skill.id }) : undefined
        }
        className={`js-node node-${state} ${view?.active ? 'family-active' : ''} ${view?.replaced ? 'family-replaced' : ''} ${view?.excluded ? 'family-excluded' : ''} ${selected?.id === skill.id ? 'selected' : ''}`}
        onClick={() => setSelectedId(skill.id)}
        title={
          isDragging
            ? undefined
            : `${skill.description} · ${view?.reason || can.reason || 'Dapat dipelajari'} · Klik untuk detail.`
        }
        aria-pressed={selected?.id === skill.id}
      >
        <span className="js-node-type">
          {v3Definitions[skill.id]?.skillType === 'ULTIMATE' ? 'ULTIMATE' : v3Definitions[skill.id]?.skillType === 'PASSIVE' ? 'PASSIVE' : stage === 'mastery' || isV3Mastery
            ? 'MASTERY'
            : isActive
              ? skill.tree?.architecture === 'v2'
                ? 'ACTIVE'
                : `ACTIVE · ${skill.slot}`
              : 'PASSIVE'}
        </span>
        <span className="js-node-icon">
          <SkillIcon id={skill.id} size={34} />
          {state === 'locked' && <LockKeyhole className="js-lock" size={12} />}
        </span>
        <strong>{skill.name}</strong>
        {view ? <small className="js-node-state">{view.labels.join(' · ')}</small> : familyLabel && <small>{familyLabel}</small>}
        {isActive && !isV3Mastery && (
          <small>Mana: {view ? skill.rankValues?.[Math.max(0, rank - 1)]?.manaCost ?? skill.manaCost : skillCosts(hero, skill).manaCost} MP</small>
        )}
        <span className="js-node-rank">
          Rank {rank} / {skill.maxLevel}
          <span>
            {state === 'maxed' ? (
              <Check size={14} />
            ) : can.ok ? (
              <Plus size={14} />
            ) : null}
          </span>
        </span>
        <small>
          {view ? view.reason || (rank < skill.maxLevel ? `${view.cost} SP → R${rank + 1}` : 'Rank maksimum') : state === 'locked'
            ? `Locked · Lv. ${skill.unlockLevel}`
            : state === 'available'
              ? 'Available'
              : state === 'maxed'
                ? 'Maxed'
                : 'Learned'}
        </small>
      </button>
    );
  }
  return (
    <div
      className={`job-skill ${thiefLineage ? 'js-thief-lineage' : ''}`}
      style={{ '--job-color': combatProfile(hero).color } as CSSProperties}
    >
      <div className="js-header">
        <span>
          <Crown size={20} />
          {hero.skillArchitectureVersion === 3 ? path.find(entry => entry.status === 'Current')?.name ?? 'Adventurer' : characterLabel(hero)}
        </span>
        <p>Rangkai kekuatanmu. Tentukan cara bertarungmu.</p>
        <div className="js-header-actions">
          <b className="co-points" title={`${availableSP} tersedia dari ${totalEarnedSP} SP total. Sudah terpakai ${spentSP}.`}>
            Available SP: {availableSP} <small>/ {totalEarnedSP}</small>
          </b>
          <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
            <AlertDialogTrigger className="js-reset" data-reset-skills disabled={hero.gold < 500}>
              RESET SKILL <small>500 Gold</small>
            </AlertDialogTrigger>
            <DraggableAlertDialogContent windowId="skill-reset-confirm">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset skill {characterLabel(hero)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Rank skill yang dibayar akan dikembalikan. {grantedLabels.length ? `${grantedLabels.join(', ')} tetap dimiliki. ` : ''}Biaya reset: 500 Gold.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => { game?.resetSkillPoints(); setResetOpen(false); }}>
                  Reset · 500 Gold
                </AlertDialogAction>
              </AlertDialogFooter>
            </DraggableAlertDialogContent>
          </AlertDialog>
          <AlertDialog open={!!branchChoice} onOpenChange={open => { if (!open) setBranchChoice(null); }}>
            <DraggableAlertDialogContent windowId="family-branch-confirm">
              <AlertDialogHeader>
                <AlertDialogTitle>Pilih {pendingBranch?.definition.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cabang ini menggantikan {canonicalSkillName(pendingBranch?.definition.familyPredecessorId ?? '')} sebagai anggota family aktif.
                  {' '}{branchAlternatives.map(d => d.name).join(' / ')} tidak dapat dipilih sampai Skill Reset.
                  {' '}Biaya: {pendingBranch?.cost ?? 0} SP. Rank ancestry tetap tersimpan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction disabled={!game?.started || !pendingBranch?.branchPurchase || !pendingBranch.purchase.ok || branchChoice?.actorId !== (hero.characterId ?? hero.slotId)}
                  onClick={() => {
                    if (branchChoice && branchChoice.actorId === (hero.characterId ?? hero.slotId)) {
                      const latest = skillNodePresentation(hero, branchChoice.id);
                      if (latest?.branchPurchase && latest.purchase.ok) game?.learnSkill(branchChoice.id);
                    }
                    setBranchChoice(null);
                  }}>Konfirmasi · {pendingBranch?.cost ?? 0} SP</AlertDialogAction>
              </AlertDialogFooter>
            </DraggableAlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="js-layout">
        <nav className="js-sidebar" aria-label="Job progression skill tree">
          {path.map((entry, index) => (
            <button
              key={entry.id}
              className={currentStage.id === entry.id ? 'selected' : ''}
              onClick={() => {
                setStage(entry.id);
              }}
              aria-current={currentStage.id === entry.id ? 'step' : undefined}
              data-job-stage={entry.id}
            >
              <span className="js-stage-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>
                <b>{entry.name}</b>
                <small>
                  {thiefLineage && entry.id === 'specialization' ? 'SPECIALIZATION · ' : ''}Lv. {entry.level} · {entry.status}
                </small>
              </span>
              {entry.status === 'Locked' ? (
                <LockKeyhole size={13} />
              ) : entry.done ? (
                <Check size={13} />
              ) : (
                <ArrowRight size={13} />
              )}
            </button>
          ))}
          <div className="js-sidebar-note">
            ACTIVE LOADOUT
            <br />
            {loadout.map((skill) => (
              <button type="button" className="js-loadout-skill" key={skill.id} data-loadout-skill={skill.id}
                onClick={() => inspectLoadout(skill)} aria-label={`Lihat ${skill.name}`}>
                <SkillIcon id={skill.id} size={18} />
                <kbd title="Tombol PrimaryHotbar; — berarti belum dipasang">
                  {assignedKey(skill.id)}
                </kbd>
                {skill.name}
              </button>
            ))}
          </div>
        </nav>
        <div className="js-tree-scroll">
          <div className="co-section-heading">
            <div>
              <span className="co-kicker">
                {stage === 'mastery'
                  ? 'SHAPE YOUR SKILLS'
                  : family ? 'CORE THIEF · SKILL FAMILIES' : 'SKILL CONSTELLATION'}
              </span>
              <h2>{currentStage.name}</h2>
              {v3Lineage.find(entry => entry.id === currentStage.id)?.description &&
                <p className="js-hint">{v3Lineage.find(entry => entry.id === currentStage.id)!.description}</p>}
            </div>
            <small>
              {family ? `${families.length} families · ` : ''}{learned}/{allNodes.length} learned
            </small>
          </div>
          {archived && stage !== 'mastery' && (
            <p className="js-hint">
              Skill aktif tahap ini telah digantikan oleh {characterLabel(hero)}
              . Passive yang dipelajari tetap memberi bonus.
            </p>
          )}
          {stage === 'mastery' && (
            <p className="js-hint">
              Advanced progression menggunakan Mastery level 40. Modifikasi
              empat skill yang sudah ada dengan Power, Control, atau Utility.
            </p>
          )}
          {thiefLineage && currentStage.id === 'specialization' && currentStage.done && <LineageMechanics specialization={hero.specialization} />}
          {family && <SkillFamilyBrowser families={families} selected={family} renderNode={node} onSelect={entry => {
            setNavigation({ context: panelContext, stage: currentStage.id, familyId: entry.id, skillId: entry.active?.id ?? entry.rootId ?? null });
          }} />}
          {!family && !!nodes.active.length && (
            <div className="js-constellation">
              <div className="js-root">
                <Crown size={24} />
                <span>{currentStage.name}</span>
              </div>
              <div className="js-tree-stem" />
              <div className="js-active-nodes">{nodes.active.map(node)}</div>
            </div>
          )}
          {!!nodes.passive.length && (
            <div className="js-passive-nodes">
              <span className="co-kicker">
                {stage === 'capstone' ? 'FINAL LEGACY' : 'PASSIVE TALENTS'}
              </span>
              {nodes.passive.map(node)}
            </div>
          )}
          {!allNodes.length && (
            <div className="js-stage-empty">
              <LockKeyhole size={40} />
              <h3>Jalur ini belum terbuka</h3>
              <p>
                {currentStage.requirements.length
                  ? currentStage.requirements.join(' · ')
                  : 'Pilih job melalui trainer untuk melihat skill jalur ini.'}
              </p>
              {currentStage.quest && (
                <button onClick={() => onMark(currentStage.quest!.giverNpcId)}>
                  <Target size={15} />
                  Temui{' '}
                  {currentStage.npc?.name ?? currentStage.quest.giverNpcName}
                </button>
              )}
            </div>
          )}
          <div className="js-legend">
            <span>○ Locked</span>
            <span>✦ Available</span>
            <span>● Learned</span>
            <span>✓ Maxed</span>
            {family && <><span>◆ Active</span><span>↗ Replaced</span><span>⊘ Branch Excluded</span></>}
          </div>
          <p className="js-hint">
            Klik kartu untuk detail. Drag active skill yang sudah dipelajari ke
            slot 1–0; skill tetap dimiliki di sini.
          </p>
        </div>
        <aside className="js-detail" aria-label="Skill detail">
          {selected ? (
            <>
              <span className={`co-status status-${status}`}>
                {selectedView ? selectedView.labels.join(' · ') : status === 'available'
                  ? 'Available'
                  : status === 'learned'
                    ? 'Learned'
                    : status === 'maxed'
                      ? 'Maxed'
                      : 'Locked'}
              </span>
              <div className="js-detail-emblem">
                <SkillIcon id={selected.id} size={42} />
              </div>
              <h3>{selected.name}</h3>
              <p>{selected.description}</p>
              <div className="js-skill-level">
                <span>{v3Definition?.skillType === 'ULTIMATE' ? 'Ultimate' : v3Definition?.skillType === 'PASSIVE' ? 'Passive Skill' : selectedIsMastery ? 'Mastery' : selectedActive ? 'Active Skill' : 'Passive Skill'}</span>
                <b>
                  Rank {level} <small>/ {selected.maxLevel}</small>
                </b>
              </div>
              {!v3Definition && <dl>
                <div>
                  <dt>Character requirement</dt>
                  <dd>Lv. {selected.unlockLevel}</dd>
                </div>
                <div>
                  <dt>Job requirement</dt>
                  <dd>
                    {selected.specialization ??
                      selected.job ??
                      characterLabel(hero)}
                  </dd>
                </div>
                <div>
                  <dt>Skill Point cost</dt>
                  <dd>{selectedActive && rankSource(hero, 'active', selected.id).granted > 0 ? `Rank ${rankSource(hero, 'active', selected.id).granted} granted · 0 SP; rank lanjutan 1 SP` : '1 SP / level'}</dd>
                </div>
                <div>
                  <dt>Prerequisite</dt>
                  <dd>
                    {selected.investmentRequirement
                      ? `${selected.investmentRequirement.paidRanks} paid SP · ${selected.investmentRequirement.tree.id} (granted rank tidak dihitung)`
                      : selected.prerequisites?.length
                        ? selected.prerequisites
                            .map(
                              (p) =>
                                `${ALL_SKILLS.find((s) => s.id === p.skillId)?.name ?? ALL_PASSIVES.find((s) => s.id === p.skillId)?.name ?? p.skillId} Rank ${p.requiredRank ?? 1}`,
                            )
                            .join(' + ')
                        : selected.prerequisiteSkillIds
                            ?.map(
                              (id) =>
                                `${ALL_PASSIVES.find((p) => p.id === id)?.name ?? ALL_SKILLS.find((s) => s.id === id)?.name ?? id}${stage === 'capstone' ? ' Lv. 3' : ''}`,
                            )
                            .join(', ') || 'Tidak ada'}
                  </dd>
                </div>
              </dl>}
              {presentation && (
                <div className="js-presentation" data-skill-presentation="v3">
                  <PresentationSection title="REQUIREMENTS" rows={presentation.requirements} />
                  <PresentationSection title={presentation.isDamage ? 'DAMAGE SCALING' : 'EFFECT'} rows={presentation.damage} />
                  <PresentationSection title={selectedIsMastery ? 'PASSIVE EFFECTS' : 'EFFECTS'} rows={presentation.effects} />
                  <PresentationSection title="SPECIAL MECHANIC" rows={presentation.specialMechanics} />
                  <PresentationSection title="AREA / TARGETING" rows={presentation.area} />
                  <PresentationSection title="RESOURCE" rows={presentation.resource} />
                  <PresentationSection title="NEXT RANK" rows={presentation.nextRank} />
                  {level >= selected.maxLevel && <span className="js-max-rank">MAX RANK</span>}
                  {(selectedActive?.rogueAmbush?.requiresAmbush || selectedActive?.assasin?.execution) && game?.started && level > 0 && !game.canCastSkill(selected.id).ok &&
                    <p className="js-reason" role="status">Cast unavailable: {game.canCastSkill(selected.id).reason}</p>}
                </div>
              )}
              {selectedActive && !selectedIsMastery && !v3Definition && (
                <>
                  <dl>
                    <div>
                      <dt>Cooldown</dt>
                      <dd>
                        {Math.round(
                          skillCosts(hero, selectedActive).cooldown * 10,
                        ) / 10}
                        s
                      </dd>
                    </div>
                    <div>
                      <dt>Mana Cost</dt>
                      <dd>
                        {skillCosts(hero, selectedActive).manaCost} MP
                        <small>
                          {' '}
                          · {Math.floor(hero.mana)} →{' '}
                          {Math.max(
                            0,
                            Math.floor(
                              hero.mana -
                                skillCosts(hero, selectedActive).manaCost,
                            ),
                          )}{' '}
                          MP
                          {hero.mana < skillCosts(hero, selectedActive).manaCost
                            ? ' · Mana tidak cukup.'
                            : ''}
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>Range / Radius</dt>
                      <dd>
                        {resolvedSelected?.range}m / {resolvedSelected?.radius}m
                      </dd>
                    </div>
                    <div>
                      <dt>Status effect</dt>
                      <dd>
                        {selectedActive.statusEffect ?? selectedActive.effect}
                      </dd>
                    </div>
                    {selectedActive.tree?.architecture === 'v2' &&
                      resolvedSelected && (
                        <>
                          <div>
                            <dt>Duration</dt>
                            <dd>{resolvedSelected.duration}s</dd>
                          </div>
                          {resolvedSelected.directionalMovement && <div><dt>Movement</dt><dd>{resolvedSelected.movementDistance}m · {resolvedSelected.directionalMovement.direction}</dd></div>}
                          {resolvedSelected.statuses.length > 0 && (
                            <div>
                              <dt>Applied status</dt>
                              <dd>
                                {resolvedSelected.statuses
                                  .map((s) => `${s.id} · ${s.duration}s`)
                                  .join(', ')}
                              </dd>
                            </div>
                          )}
                        </>
                      )}
                    <div>
                      <dt>Weapon</dt>
                      <dd>
                        {selectedActive.weaponRequirement
                          .map(weaponRequirementLabel)
                          .join(', ') ||
                          'Any compatible weapon'}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
              {selectedPassive && (
                <div className="js-effect-preview">
                  <small>BONUS PER LEVEL</small>
                  {selected.tree?.architecture === 'v2' ? (
                    <p>{selected.description}</p>
                  ) : (
                    <StatBlockList value={PASSIVE_EFFECTS[selected.id] ?? {}} />
                  )}
                </div>
              )}
              {stage === 'mastery' && selectedActive ? (
                <>
                  <div className="js-mastery-choices">
                    {(['power', 'control', 'utility'] as MasteryChoice[]).map(
                      (choice) => (
                        <button
                          key={choice}
                          disabled={
                            !hero.masteryQuestClaimed || hero.level < 40
                          }
                          className={
                            hero.masteryChoices[selected.id] === choice
                              ? 'selected'
                              : ''
                          }
                          onClick={() =>
                            game?.chooseMastery(selected.id, choice)
                          }
                        >
                          <strong>{choice}</strong>
                          <small>
                            {choice === 'power'
                              ? '+25% damage'
                              : choice === 'control'
                                ? '+45% stun duration'
                                : '−22% cooldown'}
                          </small>
                        </button>
                      ),
                    )}
                  </div>
                  {!hero.masteryQuestClaimed && (
                    <p className="js-reason">
                      Selesaikan Mastery Quest dengan Mahaguru Silsilah di Kota
                      Jayantara.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="js-learn"
                    disabled={!game?.started || !validation.ok}
                    onClick={() => {
                      if (selectedView?.branchPurchase) setBranchChoice({ id: selected.id, actorId: hero.characterId ?? hero.slotId });
                      else if (selectedActive) game?.learnSkill(selected.id);
                      else game?.learnPassive(selected.id);
                    }}
                  >
                    {status === 'maxed' ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}{' '}
                    {status === 'maxed'
                      ? 'Maxed'
                      : level > 0
                        ? `Rank ${level} → ${level + 1}`
                        : selectedView?.branchPurchase ? 'Pilih Cabang…' : 'Pelajari R1'}
                    {status !== 'maxed' && <span>{nextRankCost} SP</span>}
                  </button>
                  {!validation.ok && (
                    <p className="js-reason">{selectedView?.reason || validation.reason}</p>
                  )}
                </>
              )}
              {getVisibleJobArchitecture(hero).legacyProgression && selectedActive && hero.masteryChoices[selected.id] && (
                <p>Mastery: {hero.masteryChoices[selected.id]}</p>
              )}
            </>
          ) : (
            <p>Pilih node skill untuk melihat detail.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
