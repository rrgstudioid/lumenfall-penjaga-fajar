'use client';
import { JobText } from './job-presentation-context';
import { presentJobText } from '@/lib/game/job-presentation';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { Popover } from '@base-ui/react/popover';
import {
  Backpack,
  Plus,
  RefreshCcw,
  Shield,
  Swords,
  Sparkles,
  X,
  Heart,
  Droplets,
  Crown,
  CircleHelp,
  Gem,
  PawPrint,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { DraggableAlertDialogContent } from './draggable-window';
import {
  characterLabel,
  combatProfile,
  characterStatBreakdown,
  RESET_STATS_GOLD_COST,
  type Hero,
} from '@/lib/game/rules';
import {
  RARITY_META,
  RUNE_RARITY_RULES,
  type EquipSlot,
  type ItemData,
} from '@/lib/game/items';
import { ALL_PASSIVES, skillArchitectureAllowed } from '@/lib/game/skills';
import { JobArchitecturePreview } from './job-architecture-preview';
import { previewEquipmentChange } from '@/lib/game/character-view';
import {
  PRIMARY_ATTRIBUTES,
  COMBAT_STATS,
  SURVIVAL_STATS,
  ADVANCED_STATS,
  CHARACTER_STAT_ROWS,
  PAPER_DOLL_SLOTS,
  characterAttributeBreakdown,
  attributeEffects,
  characterNumber as fmt,
  readCharacterPower,
  type CharacterStat,
  type CombatPowerCalculator,
} from '@/lib/game/character-screen';
import { getInventorySlots } from '@/lib/game/drag-drop';
import type { Game } from '@/lib/game/world';
import { CharacterPreview } from './character-preview';
import { CombatPowerComparison, AttributeCombatPowerPreview } from './combat-power-preview';
import { StatBlockList } from './stat-block-list';
import { ItemIcon } from './entry-icon';
import { SkillIcon } from './skill-icon';
import { useGameDrag } from './drag-drop-provider';

const signed = (value: number) => `${value > 0 ? '+' : ''}${fmt(value)}`;
const rarityStyle = (item?: ItemData): CSSProperties =>
  ({
    '--item-color': item ? RARITY_META[item.rarity].color : '#63786c',
  }) as CSSProperties;

function Tip({
  children,
  content,
  disabled = false,
}: {
  children: ReactNode;
  content: ReactNode | (() => ReactNode);
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Tooltip.Root disabled={disabled} onOpenChange={setVisible}>
      <Tooltip.Trigger
        render={
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard access to stat help without nesting equipment buttons.
          <span className="cs-tip-target" tabIndex={0} />
        }
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={9} className="cs-floating-layer">
          <Tooltip.Popup className="cs-surface cs-tooltip">
            {typeof content === 'function'
              ? visible && !disabled
                ? content()
                : null
              : content}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ItemSummary({ item }: { item: ItemData }) {
  return (
    <div className="cs-item-summary" style={rarityStyle(item)}>
      <ItemIcon item={item} />
      <div>
        <strong>
          <JobText>{item.name}</JobText>
          {item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : ''}
        </strong>
        <small>
          {RARITY_META[item.rarity].label} · Lv. {item.levelRequirement}
        </small>
      </div>
    </div>
  );
}

export function CharacterScreen({
  hero,
  game,
  onInventory,
  combatPowerCalculator,
}: {
  hero: Hero;
  game: Game | null;
  onInventory: (item?: ItemData) => void;
  combatPowerCalculator?: CombatPowerCalculator;
}) {
  const [selectedSlot, setSelectedSlot] = useState<EquipSlot | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [equipConfirm, setEquipConfirm] = useState<ItemData | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const drag = useGameDrag();
  const breakdown = characterStatBreakdown(hero),
    final = breakdown.final;
  const profile = combatProfile(hero);
  const power = readCharacterPower(hero, combatPowerCalculator);
  const jobEmblem =
    ALL_PASSIVES.find(
      (p) => skillArchitectureAllowed(hero, p) && hero.specialization && p.specialization === hero.specialization,
    ) ?? ALL_PASSIVES.find((p) => skillArchitectureAllowed(hero, p) && p.job === hero.coreJob && !p.specialization);
  const candidate = hero.inventory.find((item) => item.id === candidateId);
  const preview =
    candidate && selectedSlot
      ? previewEquipmentChange(hero, candidate, selectedSlot)
      : null;
  const closeEquipment = () => {
    setSelectedSlot(null);
    setCandidateId(null);
  };

  function statDetail(stat: CharacterStat) {
    const sources = [
      { label: 'Base + attributes', stats: breakdown.base },
      ...breakdown.columns,
    ];
    return (
      <>
        <strong>{stat.label}</strong>
        <p>Nilai efektif dari perhitungan karakter saat ini.</p>
        <dl>
          {sources
            .filter((source) => source.stats[stat.id] !== 0)
            .map((source) => (
              <div key={source.label}>
                <dt>{source.label}</dt>
                <dd>
                  {fmt(source.stats[stat.id])}
                  {stat.unit}
                </dd>
              </div>
            ))}
          <div className="cs-total">
            <dt>Total</dt>
            <dd>
              {fmt(final[stat.id])}
              {stat.unit}
            </dd>
          </div>
        </dl>
        <small>
          Bonus, pengali, dan batas stat sudah diterapkan. Tidak ada formula
          terpisah di UI.
        </small>
      </>
    );
  }
  function statRows(rows: CharacterStat[]) {
    return rows.map((stat) => (
      <Tip key={stat.id} disabled={drag.isDragging} content={statDetail(stat)}>
        <span className="cs-stat-row" data-character-stat={stat.id}>
          <span>{stat.label}</span>
          <b>
            {fmt(final[stat.id])}
            <small>{stat.unit}</small>
          </b>
        </span>
      </Tip>
    ));
  }
  function equip(item: ItemData, slot: EquipSlot) {
    const result = previewEquipmentChange(hero, item, slot);
    if (!result.validation.ok) return;
    if (
      slot === 'mainHand' &&
      item.handedness === 'two_hand' &&
      hero.equipment.offHand &&
      !result.hero.equipment.offHand
    ) {
      setEquipConfirm(item);
      closeEquipment();
      return;
    }
    if (game?.equipItem(item.id, slot)) closeEquipment();
  }
  function itemDetails(item: ItemData) {
    return (
      <div className="cs-item-details">
        <p className="cs-requirement">
          Requires Lv. {item.levelRequirement} ·{' '}
          <JobText>{(item.requiredSpecialJob ??
            item.requiredCoreJob ??
            item.allowedJobs.join(' / ')) ||
            'All jobs'}</JobText>{' '}
          · {item.handedness.replaceAll('_', ' ')}
        </p>
        <h4>Base stats</h4>
        <StatBlockList value={item.baseStats} />
        <h4>Unique stats</h4>
        {item.uniqueStatsLocked ? (
          <>
            <p>Unique Stats terkunci.</p>
            <button
              className="cs-button"
              disabled={
                !game ||
                !hero.inventory.some(
                  (i) => i.itemType === 'magnifier' && i.quantity > 0,
                )
              }
              onClick={() => game?.unlockUniqueStats(item.id)}
            >
              Unlock · 1 Magnifier
            </button>
          </>
        ) : (
          <>
            <StatBlockList value={item.bonusStats} />
            {item.uniqueEffect && (
              <p className="cs-unique">✦ <JobText>{item.uniqueEffect}</JobText></p>
            )}
            {!item.uniqueEffect && !Object.keys(item.bonusStats).length && (
              <small>Belum ada Unique Stats.</small>
            )}
          </>
        )}
        <h4>Rune & sockets</h4>
        {item.sockets.length ? (
          item.sockets.map((socket) => (
            <div
              className="cs-socket"
              key={socket.id}
              style={{
                color: socket.rune?.runeRarity
                  ? RUNE_RARITY_RULES[socket.rune.runeRarity].color
                  : undefined,
              }}
            >
              {socket.rune ? (
                <ItemIcon item={socket.rune} />
              ) : (
                <Gem size={16} />
              )}
              <div>
                <JobText>{socket.rune?.name ?? 'Empty socket'}</JobText>
                {socket.rune && (
                  <small>
                    {socket.rune.runeRarity} · <JobText>{socket.rune.uniqueEffect}</JobText>{' '}
                    {socket.rune.affixes
                      .map(
                        (a) =>
                          `${a.label} +${a.value}${a.unit === 'percent' ? '%' : ''}`,
                      )
                      .join(' · ')}
                  </small>
                )}
              </div>
            </div>
          ))
        ) : (
          <small>Tidak memiliki socket.</small>
        )}
        {selectedSlot === 'pet' && hero.pet?.id === item.id && (
          <div className="cs-pet-detail">
            <h4>Companion · Lv. {hero.pet.level}</h4>
            <p>
              {hero.pet.passive} · EXP {hero.pet.exp}/{hero.pet.maxExp}
            </p>
            <StatBlockList value={hero.pet.bonusStats} />
            <button
              className="cs-button"
              disabled={!game}
              onClick={() => game?.evolvePet()}
            >
              Evolusi pet
            </button>
          </div>
        )}
        <small>Modifikasi Rune tersedia di NPC Forge Master.</small>
      </div>
    );
  }
  function equipmentEditor(
    slot: EquipSlot,
    label: string,
    equipped?: ItemData,
  ) {
    const candidates = hero.inventory.filter(
      (item) =>
        !item.isEquipped &&
        (item.equipSlot === slot ||
          (slot.startsWith('ring') && item.itemType.startsWith('ring')) ||
          (slot.startsWith('earring') && item.itemType.startsWith('earring'))),
    );
    return (
      <>
        <div className="cs-popup-heading">
          <div>
            <span className="cs-eyebrow">EQUIPMENT</span>
            <Popover.Title>{label}</Popover.Title>
          </div>
          <Popover.Close
            className="cs-icon-button"
            aria-label="Close equipment"
          >
            <X size={18} />
          </Popover.Close>
        </div>
        <Popover.Description className="cs-muted">
          Pilih untuk preview, lalu Equip untuk menerapkan.
        </Popover.Description>
        <div className="cs-popup-scroll">
          {equipped ? (
            <section className="cs-equipped-detail">
              <small className="cs-eyebrow">CURRENTLY EQUIPPED</small>
              <ItemSummary item={equipped} />
              <details>
                <summary>Stats, requirements & sockets</summary>
                {itemDetails(equipped)}
              </details>
              <div className="cs-actions">
                <button
                  className="cs-button"
                  disabled={!game}
                  onClick={() => {
                    if (game?.unequipItem(slot)) closeEquipment();
                  }}
                >
                  Unequip
                </button>
                <button
                  className="cs-button"
                  onClick={() => onInventory(equipped)}
                >
                  Rune / Inventory
                </button>
              </div>
            </section>
          ) : (
            <p className="cs-empty">Slot kosong. Pilih item dari inventory.</p>
          )}
          <h4 className="cs-list-title">
            Available equipment <span>{candidates.length}</span>
          </h4>
          {candidates.length ? (
            <div className="cs-candidates">
              {candidates.map((item) => (
                <Tip
                  key={item.id}
                  disabled={drag.isDragging}
                  content={() => {
                    const comparison = previewEquipmentChange(hero, item, slot);
                    return (
                      <>
                        <ItemSummary item={item} />
                        <p>Compare dengan <JobText>{equipped?.name ?? 'slot kosong'}</JobText></p>
                        <CombatPowerComparison comparison={comparison.combatPower} />
                        {comparison.validation.ok ? (
                          <dl>
                            {CHARACTER_STAT_ROWS.filter(
                              (s) =>
                                comparison.before[s.id] !==
                                comparison.after[s.id],
                            ).map((s) => (
                              <div key={s.id}>
                                <dt>{s.label}</dt>
                                <dd
                                  className={
                                    comparison.after[s.id] >
                                    comparison.before[s.id]
                                      ? 'cs-good'
                                      : 'cs-bad'
                                  }
                                >
                                  {fmt(comparison.before[s.id])} →{' '}
                                  {fmt(comparison.after[s.id])}
                                  {s.unit}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="cs-bad">
                            {comparison.validation.reason}
                          </p>
                        )}
                        <small>
                          Belum diterapkan. Klik untuk preview model dan
                          konfirmasi Equip.
                        </small>
                      </>
                    );
                  }}
                >
                  <button
                    aria-pressed={candidateId === item.id}
                    className="cs-candidate"
                    onClick={() => setCandidateId(item.id)}
                    onPointerDown={(event) =>
                      drag.begin(event, {
                        dragType: 'item',
                        refId: item.id,
                        inventorySlot: getInventorySlots(hero).indexOf(item.id),
                      })
                    }
                  >
                    <ItemSummary item={item} />
                  </button>
                </Tip>
              ))}
            </div>
          ) : (
            <p className="cs-empty">Belum ada item lain untuk slot ini.</p>
          )}
          {candidate && preview && (
            <section
              className="cs-comparison"
              aria-label="Equipment comparison"
            >
              <ItemSummary item={candidate} />
              <p className={preview.validation.ok ? 'cs-good' : 'cs-bad'}>
                {preview.validation.ok
                  ? 'Preview saja — belum disimpan'
                  : preview.validation.reason}
              </p>
              <CombatPowerComparison comparison={preview.combatPower} />
              {preview.validation.ok && (
                <dl>
                  {CHARACTER_STAT_ROWS.filter(
                    (stat) =>
                      preview.after[stat.id] !== preview.before[stat.id],
                  ).map((stat) => (
                    <div key={stat.id}>
                      <dt>{stat.label}</dt>
                      <dd>
                        {fmt(preview.before[stat.id])} →{' '}
                        {fmt(preview.after[stat.id])}
                        {stat.unit}{' '}
                        <b
                          className={
                            preview.after[stat.id] > preview.before[stat.id]
                              ? 'cs-good'
                              : 'cs-bad'
                          }
                        >
                          (
                          {signed(
                            preview.after[stat.id] - preview.before[stat.id],
                          )}
                          )
                        </b>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {preview.validation.ok &&
                CHARACTER_STAT_ROWS.every(
                  (stat) => preview.after[stat.id] === preview.before[stat.id],
                ) && <small>Tidak mengubah statistik efektif.</small>}
              <details>
                <summary>Item details</summary>
                {itemDetails(candidate)}
              </details>
              <div className="cs-actions">
                <button
                  className="cs-button cs-button-primary"
                  disabled={!game || !preview.validation.ok}
                  onClick={() => equip(candidate, slot)}
                >
                  Equip
                </button>
                <button
                  className="cs-button"
                  onClick={() => setCandidateId(null)}
                >
                  Cancel preview
                </button>
              </div>
            </section>
          )}
        </div>
      </>
    );
  }

  return (
    <Tooltip.Provider delay={220}>
      <div className="cs-dashboard" data-character-dashboard>
        <header className="cs-header" data-character-header>
          <div className="cs-identity">
            <span
              className="cs-job-emblem"
              style={{ '--job-color': profile.color } as CSSProperties}
            >
              {jobEmblem ? (
                <SkillIcon id={jobEmblem.id} />
              ) : (
                <Swords size={26} />
              )}
            </span>
            <div>
              <span className="cs-eyebrow">
                CHARACTER <kbd>C</kbd>
              </span>
              <h2>{hero.characterName}</h2>
              <p>
                <span>Lv. {hero.level}</span>
                <i />
                {characterLabel(hero)}
              </p>
              <JobArchitecturePreview hero={hero} compact />
            </div>
          </div>
          <Tip
            content={
              <>
                <strong>Combat Power Breakdown</strong>
                {power ? (
                  <dl>
                    {power.contributions.map((source, i) => (
                      <div key={`${source.label}-${i}`}>
                        <dt>{source.label}</dt>
                        <dd>{fmt(source.value)}</dd>
                      </div>
                    ))}
                    <div><dt>Total</dt><dd>{fmt(power.total)}</dd></div>
                  </dl>
                ) : (
                  <p>
                    Combat Power tidak tersedia untuk data karakter ini.
                  </p>
                )}
                <small>Dinilai dari damage, kemampuan bertahan, dan skill yang aktif. Bukan rarity equipment.</small>
              </>
            }
          >
            <div className="cs-power">
              <Crown size={21} />
              <div>
                <span>COMBAT POWER</span>
                <b>{power ? fmt(power.total) : '—'}</b>
                {!power && <small>Belum tersedia</small>}
              </div>
              <CircleHelp size={13} />
            </div>
          </Tip>
        </header>
        <div className="cs-columns">
          <section
            className="cs-attributes"
            aria-label="Attributes and resources"
          >
            <h3 className="cs-section-heading">
              <Sparkles size={15} /> Attributes
            </h3>
            <div className="cs-attribute-list">
              {PRIMARY_ATTRIBUTES.map((attribute) => (
                <div className="cs-attribute" key={attribute.id}>
                  {(() => {
                    const layers = characterAttributeBreakdown(hero, attribute.id);
                    return (
                  <>
                  <Tip
                    content={
                      <>
                        <strong>
                          {attribute.name} · {attribute.short}
                        </strong>
                        <p>Base: {layers.base} · Allocated: {layers.allocated} · Bonus: {fmt(layers.bonus)} · Final: {fmt(layers.final)}</p>
                        <small>
                          Dampak efektif +1 point pada karakter ini:
                        </small>
                        <AttributeCombatPowerPreview hero={hero} attribute={attribute.id} />
                        <dl>
                          {attributeEffects(hero, attribute.id).map(
                            (effect) => (
                              <div key={effect.id}>
                                <dt>{effect.label}</dt>
                                <dd>
                                  {signed(effect.delta)}
                                  {effect.unit}
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                        {!attributeEffects(hero, attribute.id).length && (
                          <p>
                            Tidak ada perubahan efektif; batas stat dapat sudah
                            tercapai.
                          </p>
                        )}
                      </>
                    }
                  >
                    <span className="cs-attribute-info">
                      <span
                        className={`cs-attribute-symbol cs-attribute-${attribute.id}`}
                      >
                        {attribute.short}
                      </span>
                      <span>
                        <b>{attribute.name}</b>
                        <small>Base {layers.base} · Allocated {layers.allocated}</small>
                      </span>
                      <strong>{fmt(layers.final)}</strong>
                    </span>
                  </Tip>
                  <button
                    className="cs-add-point"
                    disabled={!game || hero.statPoints < 1}
                    aria-label={`Add ${attribute.name}`}
                    onClick={() => game?.allocateStatPoint(attribute.id)}
                  >
                    <Plus size={15} />
                  </button>
                  </>
                    );
                  })()}
                </div>
              ))}
            </div>
            <div className="cs-points">
              <span>Available points</span>
              <strong>{hero.statPoints}</strong>
            </div>
            <button
              className="cs-button cs-reset"
              disabled={!game || hero.gold < RESET_STATS_GOLD_COST}
              onClick={() => {
                closeEquipment();
                setResetOpen(true);
              }}
            >
              <RefreshCcw size={13} /> Reset Stats{' '}
              <small>{fmt(RESET_STATS_GOLD_COST)} G</small>
            </button>
            <div className="cs-resources">
              <h3 className="cs-section-heading">Resources</h3>
              {[
                {
                  id: 'hp',
                  label: 'Health',
                  value: hero.hp,
                  max: final.maxHP,
                  icon: <Heart size={13} />,
                },
                {
                  id: 'mp',
                  label: 'Mana',
                  value: hero.mana,
                  max: final.maxMana,
                  icon: <Droplets size={13} />,
                },
              ].map((resource) => (
                <div
                  className={`cs-resource cs-resource-${resource.id}`}
                  key={resource.id}
                >
                  <div>
                    <span>
                      {resource.icon}
                      {resource.label}
                    </span>
                    <b>
                      {fmt(resource.value)} <small>/ {fmt(resource.max)}</small>
                    </b>
                  </div>
                  <progress
                    className="cs-resource-track"
                    aria-label={resource.label}
                    value={Math.max(0, resource.value)}
                    max={Math.max(1, resource.max)}
                  />
                </div>
              ))}
            </div>
          </section>
          <section className="cs-loadout" aria-label="Equipment and live model">
            <div className="cs-loadout-heading">
              <span className="cs-eyebrow">
                {preview?.validation.ok ? 'UNSAVED PREVIEW' : 'LIVE EQUIPMENT'}
              </span>
              <button
                className="cs-icon-button"
                aria-label="Open Inventory"
                onClick={() => onInventory()}
              >
                <Backpack size={17} />
              </button>
            </div>
            <div className="cs-paper-doll">
              <CharacterPreview
                hero={preview?.validation.ok ? preview.hero : hero}
              />
              <div className="cs-model-ring" aria-hidden="true" />
              {PAPER_DOLL_SLOTS.map((slot) => {
                const equipped = hero.inventory.find(
                  (item) => item.id === hero.equipment[slot.id],
                );
                return (
                  <Popover.Root
                    key={slot.id}
                    open={selectedSlot === slot.id}
                    onOpenChange={(open) => {
                      setCandidateId(null);
                      setSelectedSlot(open ? slot.id : null);
                      if (open) setAdvancedOpen(false);
                    }}
                  >
                    <div
                      className="cs-slot-position"
                      style={{
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        ...rarityStyle(equipped),
                      }}
                    >
                      <Tip
                        disabled={selectedSlot !== null || drag.isDragging}
                        content={
                          equipped ? (
                            <>
                              <ItemSummary item={equipped} />
                              <p>
                                {slot.label} ·{' '}
                                {equipped.handedness.replaceAll('_', ' ')}
                              </p>
                              <StatBlockList value={equipped.baseStats} />
                              {equipped.uniqueStatsLocked ? (
                                <small>Unique Stats terkunci.</small>
                              ) : (
                                <StatBlockList value={equipped.bonusStats} />
                              )}
                              <small>
                                Klik untuk detail, compare, atau unequip.
                              </small>
                            </>
                          ) : (
                            <>
                              <strong>{slot.label}</strong>
                              <p>Slot kosong. Klik untuk memilih equipment.</p>
                            </>
                          )
                        }
                      >
                        <Popover.Trigger
                          className={`cs-equipment-slot ${equipped ? 'is-equipped' : ''}`}
                          data-equipment-slot={slot.id}
                          data-drop-type="equipment"
                          data-drop-slot={slot.id}
                          data-drop-item={equipped?.id ?? ''}
                          aria-label={`${slot.label}: ${presentJobText(hero, equipped?.name ?? 'Empty')}`}
                        >
                          {equipped ? (
                            <ItemIcon item={equipped} />
                          ) : slot.id === 'pet' ? (
                            <PawPrint size={22} />
                          ) : slot.id === 'mainHand' ? (
                            <Swords size={22} />
                          ) : slot.id === 'head' ? (
                            <Crown size={22} />
                          ) : slot.id.startsWith('ring') ||
                            slot.id.startsWith('earring') ||
                            slot.id === 'necklace' ? (
                            <Gem size={20} />
                          ) : (
                            <Shield size={22} />
                          )}
                          {!!equipped?.enhancementLevel && (
                            <b className="cs-enhancement">
                              +{equipped.enhancementLevel}
                            </b>
                          )}
                        </Popover.Trigger>
                      </Tip>
                      <span className="cs-slot-label">{slot.label}</span>
                    </div>
                    {selectedSlot === slot.id && (
                      <Popover.Portal>
                        <Popover.Positioner
                          side={slot.x < 50 ? 'left' : 'right'}
                          sideOffset={10}
                          collisionPadding={12}
                          className="cs-floating-layer"
                        >
                          <Popover.Popup className="cs-surface cs-equipment-popup">
                            {equipmentEditor(slot.id, slot.label, equipped)}
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    )}
                  </Popover.Root>
                );
              })}
            </div>
            <p className="cs-loadout-note">
              {preview?.validation.ok
                ? 'Preview tidak mengubah equipment atau save.'
                : 'Klik slot untuk detail & equipment.'}
            </p>
          </section>
          <section className="cs-combat" aria-label="Combat and survival stats">
            <h3 className="cs-section-heading">
              <Swords size={15} /> Combat Stats
            </h3>
            <div className="cs-stat-list">{statRows(COMBAT_STATS)}</div>
            <h3 className="cs-section-heading cs-survival-heading">
              <Shield size={15} /> Survival
            </h3>
            <div className="cs-stat-list">{statRows(SURVIVAL_STATS)}</div>
            <Popover.Root
              open={advancedOpen}
              onOpenChange={(open) => {
                setAdvancedOpen(open);
                if (open) closeEquipment();
              }}
            >
              <Popover.Trigger className="cs-button cs-advanced">
                Advanced Stats <Plus size={14} />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner
                  side="left"
                  sideOffset={12}
                  collisionPadding={12}
                  className="cs-floating-layer"
                >
                  <Popover.Popup className="cs-surface cs-advanced-popup">
                    <div className="cs-popup-heading">
                      <Popover.Title>Advanced Stats</Popover.Title>
                      <Popover.Close
                        className="cs-icon-button"
                        aria-label="Close advanced stats"
                      >
                        <X size={18} />
                      </Popover.Close>
                    </div>
                    <Popover.Description className="cs-muted">
                      Bonus tambahan yang aktif pada karakter.
                    </Popover.Description>
                    <div className="cs-popup-scroll">
                      {statRows(ADVANCED_STATS)}
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </section>
        </div>
        <footer className="cs-footer">
          <span>Hover untuk rincian stat</span>
          <span>Equipment & stats tersimpan melalui sistem game</span>
        </footer>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <DraggableAlertDialogContent
            windowId="character-reset-confirm"
            className="co-confirm"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Reset seluruh stat karakter?</AlertDialogTitle>
              <AlertDialogDescription>
                STR, VIT, DEX, dan INT yang dialokasikan akan dikembalikan
                menjadi Stat Point sesuai sistem game. Job, skill, dan equipment
                tetap sama.
                <br />
                Biaya: {fmt(RESET_STATS_GOLD_COST)} GOLD · Saldo:{' '}
                {fmt(hero.gold)} GOLD
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!game || hero.gold < RESET_STATS_GOLD_COST}
                onClick={() => {
                  game?.respecStats();
                  setResetOpen(false);
                }}
              >
                Reset Stats
              </AlertDialogAction>
            </AlertDialogFooter>
          </DraggableAlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={!!equipConfirm}
          onOpenChange={(open) => {
            if (!open) setEquipConfirm(null);
          }}
        >
          <DraggableAlertDialogContent
            windowId="character-equip-two-hand-confirm"
            className="co-confirm"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Pasang senjata two-hand?</AlertDialogTitle>
              <AlertDialogDescription>
                Off Hand akan dilepas dan tetap tersimpan di inventory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (equipConfirm)
                    game?.equipItem(equipConfirm.id, 'mainHand');
                  setEquipConfirm(null);
                }}
              >
                Equip
              </AlertDialogAction>
            </AlertDialogFooter>
          </DraggableAlertDialogContent>
        </AlertDialog>
      </div>
    </Tooltip.Provider>
  );
}
