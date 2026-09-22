'use client';
import { useState, type CSSProperties } from 'react';
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
  skillDamagePreview,
  skillHealingPreview,
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
import { getVisibleJobArchitecture } from '@/lib/game/job-presentation';
import { rankSource } from '@/lib/game/rank-ownership';
import { ADVENTURER_V3_SKILL_MAP } from '@/lib/game/adventurer-v3';
import { WARRIOR_V3_SKILL_MAP } from '@/lib/game/warrior-v3';
import { BERSERKER_V3_SKILL_MAP } from '@/lib/game/berserker-v3';
import { BLADE_MASTER_V3_SKILL_MAP } from '@/lib/game/blade-master-v3';
import { availableSkillPointsV3, skillCostThroughRank } from '@/lib/game/skill-progression-v3';
const v3Definitions = { ...ADVENTURER_V3_SKILL_MAP, ...WARRIOR_V3_SKILL_MAP, ...BERSERKER_V3_SKILL_MAP, ...BLADE_MASTER_V3_SKILL_MAP };
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
  const [stage, setStage] = useState<JobStageId>(
    (getVisibleJobArchitecture(hero).legacyProgression || hero.skillArchitectureVersion === 3) && hero.specialization
      ? 'specialization'
      : hero.coreJob
        ? 'core'
        : 'adventurer',
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const grantedLabels = ALL_SKILLS.flatMap(skill => {
    const granted = rankSource(hero, 'active', skill.id).granted;
    return granted ? [`${skill.name} Rank ${granted}`] : [];
  });
  const path = getJobProgression(hero),
    currentStage = path.find((entry) => entry.id === stage) ?? path[0];
  const nodes = getJobSkillNodes(hero, currentStage.id);
  const allNodes = [...nodes.active, ...nodes.passive];
  const selected =
    allNodes.find((skill) => skill.id === selectedId) ?? allNodes[0];
  const selectedActive =
    selected && 'slot' in selected ? (selected as SkillDefinition) : null;
  const selectedPassive =
    selected && !('slot' in selected) ? (selected as PassiveDefinition) : null;
  const resolvedSelected = selectedActive
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
  const level = selectedActive
    ? (hero.skillLevels[selectedActive.id] ?? 0)
    : selected
      ? (hero.passiveLevels[selected.id] ?? 0)
      : 0;
  const v3Definition = hero.skillArchitectureVersion === 3 && selected ? v3Definitions[selected.id] : undefined;
  const selectedIsMastery = v3Definition?.skillType === 'MASTERY';
  const nextRankCost = v3Definition ? skillCostThroughRank(v3Definition, level + 1) - skillCostThroughRank(v3Definition, level) : 1;
  const availableSP = hero.skillArchitectureVersion === 3 && hero.skillProgressionV3
    ? availableSkillPointsV3(hero.skillProgressionV3, v3Definitions) : hero.skillPoints;
  const learned = allNodes.filter(
    (skill) =>
      (hero.skillLevels[skill.id] ?? hero.passiveLevels[skill.id] ?? 0) > 0,
  ).length;
  const archived =
    nodes.active.length > 0 &&
    !activeSkills(hero).some((skill) => skill.id === nodes.active[0].id);
  const assignedKey = (skillId: string) => {
    const index = hero.primaryHotbar.indexOf(skillId);
    return index < 0 ? '—' : String((index + 1) % 10);
  };
  function node(skill: SkillDefinition | PassiveDefinition) {
    const isActive = 'slot' in skill,
      isV3Mastery = v3Definitions[skill.id]?.skillType === 'MASTERY',
      rank = isActive
        ? (hero.skillLevels[skill.id] ?? 0)
        : (hero.passiveLevels[skill.id] ?? 0);
    const state = getSkillStatus(skill.id, hero),
      can = canLearnSkill(skill.id, hero);
    return (
      <button
        key={skill.id}
        data-drag-source="skill"
        data-window-no-drag
        data-skill-id={skill.id}
        onPointerDown={(event) =>
          begin(event, { dragType: 'skill', refId: skill.id })
        }
        className={`js-node node-${state} ${selected?.id === skill.id ? 'selected' : ''}`}
        onClick={() => setSelectedId(skill.id)}
        title={
          isDragging
            ? undefined
            : `${skill.description} · ${can.reason || 'Dapat dipelajari'} · Klik untuk detail; drag active skill yang sudah dipelajari ke PrimaryHotbar.`
        }
        aria-pressed={selected?.id === skill.id}
      >
        <span className="js-node-type">
          {stage === 'mastery' || isV3Mastery
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
        {isActive && !isV3Mastery && (
          <small>Mana Cost: {skillCosts(hero, skill).manaCost} MP</small>
        )}
        <span className="js-node-rank">
          Lv. {rank} / {skill.maxLevel}
          <span>
            {state === 'maxed' ? (
              <Check size={14} />
            ) : can.ok ? (
              <Plus size={14} />
            ) : null}
          </span>
        </span>
        <small>
          {state === 'locked'
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
      className="job-skill"
      style={{ '--job-color': combatProfile(hero).color } as CSSProperties}
    >
      <div className="js-header">
        <span>
          <Crown size={20} />
          {characterLabel(hero)}
        </span>
        <p>Rangkai kekuatanmu. Tentukan cara bertarungmu.</p>
        <div className="js-header-actions">
          <b className="co-points">{availableSP} Skill Points</b>
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
        </div>
      </div>
      <div className="js-layout">
        <nav className="js-sidebar" aria-label="Job progression skill tree">
          {path.map((entry, index) => (
            <button
              key={entry.id}
              className={stage === entry.id ? 'selected' : ''}
              onClick={() => {
                setStage(entry.id);
                setSelectedId(null);
              }}
              aria-current={stage === entry.id ? 'step' : undefined}
            >
              <span className="js-stage-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>
                <b>{entry.name}</b>
                <small>
                  Lv. {entry.level} · {entry.status}
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
            {activeSkills(hero).map((skill) => (
              <span key={skill.id}>
                <kbd title="Tombol PrimaryHotbar; — berarti belum dipasang">
                  {assignedKey(skill.id)}
                </kbd>
                {skill.name}
              </span>
            ))}
          </div>
        </nav>
        <div className="js-tree-scroll">
          <div className="co-section-heading">
            <div>
              <span className="co-kicker">
                {stage === 'mastery'
                  ? 'SHAPE YOUR SKILLS'
                  : 'SKILL CONSTELLATION'}
              </span>
              <h2>{currentStage.name}</h2>
            </div>
            <small>
              {learned}/{allNodes.length} learned
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
          {!!nodes.active.length && (
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
                {status === 'available'
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
                <span>{selectedIsMastery ? 'Mastery' : selectedActive ? 'Active Skill' : 'Passive Skill'}</span>
                <b>
                  Lv. {level} <small>/ {selected.maxLevel}</small>
                </b>
              </div>
              <dl>
                <div>
                  <dt>Character requirement</dt>
                  <dd>Lv. {v3Definition?.rankLevelRequirements?.[Math.min(level, selected.maxLevel - 1)] ?? selected.unlockLevel}</dd>
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
                  <dd>{v3Definition ? `${nextRankCost} SP / rank` : selectedActive && rankSource(hero, 'active', selected.id).granted > 0 ? `Rank ${rankSource(hero, 'active', selected.id).granted} granted · 0 SP; rank lanjutan 1 SP` : '1 SP / level'}</dd>
                </div>
                <div>
                  <dt>Prerequisite</dt>
                  <dd>
                    {v3Definition ? [
                      ...(v3Definition.prerequisiteSkills ?? []).map(p => `${v3Definitions[p.skillId]?.name ?? p.skillId} R${p.requiredRank}`),
                      ...(v3Definition.jobInvestmentRequirement ? [`${v3Definition.jobInvestmentRequirement.minimumSP} SP di ${v3Definition.jobInvestmentRequirement.jobId}`] : []),
                    ].join(' + ') || 'Tidak ada' : selected.investmentRequirement
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
              </dl>
              {selectedActive && !selectedIsMastery && (
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
                        {selectedActive.weaponRequirement.join(', ') ||
                          'Any compatible weapon'}
                      </dd>
                    </div>
                  </dl>
                  <div className="js-effect-preview">
                    <small>BASE EFFECT PREVIEW · SEBELUM DEFENSE TARGET</small>
                    <strong>
                      {selectedActive.effect === 'heal'
                        ? `${skillHealingPreview(hero, selectedActive, Math.max(1, level))} HP`
                        : ['buff', 'parry', 'stealth', 'barrier'].includes(
                              selectedActive.effect,
                            )
                          ? `${resolvedSelected?.duration}s ${selectedActive.effect}`
                          : `${Math.round(skillDamagePreview(hero, selectedActive, Math.max(1, level)))} damage`}
                    </strong>
                    {level < selectedActive.maxLevel &&
                      [
                        'damage',
                        'aoe_damage',
                        'elemental',
                        'ultimate',
                        'dash_damage',
                        'rapid_damage',
                        'chain',
                        'execute',
                        'poison',
                      ].includes(selectedActive.effect) && (
                        <small>
                          Next level:{' '}
                          {Math.round(
                            skillDamagePreview(
                              hero,
                              selectedActive,
                              Math.max(1, level + 1),
                            ),
                          )}
                        </small>
                      )}
                  </div>
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
                    onClick={() =>
                      selectedActive
                        ? game?.learnSkill(selected.id)
                        : game?.learnPassive(selected.id)
                    }
                  >
                    {status === 'maxed' ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}{' '}
                    {status === 'maxed'
                      ? 'Maxed'
                      : level > 0
                        ? 'Naikkan Level'
                        : 'Pelajari'}
                    {status !== 'maxed' && <span>{nextRankCost} SP</span>}
                  </button>
                  {!validation.ok && (
                    <p className="js-reason">{validation.reason}</p>
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
