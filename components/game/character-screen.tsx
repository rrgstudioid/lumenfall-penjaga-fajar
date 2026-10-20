'use client';
import { JobText } from './job-presentation-context';
import { presentJobText } from '@/lib/game/job-presentation';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  Feather,
  Hand,
  Shirt,
  Footprints,
  Columns2,
  Circle,
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
  type EquipSlot,
  type ItemData,
} from '@/lib/game/items';
import { ALL_PASSIVES, skillArchitectureAllowed } from '@/lib/game/skills';
import { JobArchitecturePreview } from './job-architecture-preview';
import {
  getEquipmentCandidatesForSlot,
  getDaggerEquipmentLabel,
  previewEquipmentChange,
} from '@/lib/game/character-view';
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
  characterStatNote,
  characterResourceBreakdown,
  type CharacterStat,
  type CombatPowerCalculator,
} from '@/lib/game/character-screen';
import { getInventorySlots } from '@/lib/game/drag-drop';
import type { Game } from '@/lib/game/world';
import { CharacterPreview } from './character-preview';
import { CombatPowerComparison, AttributeCombatPowerPreview } from './combat-power-preview';
import { StatBlockList } from './stat-block-list';
import { ItemIcon } from './entry-icon';
import { EquipmentDetail } from './equipment-detail';
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
  side = 'top',
}: {
  children: ReactNode;
  content: ReactNode | (() => ReactNode);
  disabled?: boolean;
  side?: 'top' | 'right';
}) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  return (
    <Tooltip.Root disabled={disabled} onOpenChange={(open, details) => {
      // Scrolling under a stationary pointer must not replace keyboard stat help.
      const focused = triggerRef.current?.ownerDocument.activeElement;
      if (open && details.reason === 'trigger-hover' && focused !== triggerRef.current
        && focused?.matches('.cs-tip-target:focus-visible')) {
        details.cancel();
        return;
      }
      setVisible(open);
    }}>
      <Tooltip.Trigger
        aria-describedby={visible && !disabled ? tooltipId : undefined}
        render={
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard access to stat help without nesting equipment buttons.
          <span ref={triggerRef} className="cs-tip-target" tabIndex={0} />
        }
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={9} className="cs-floating-layer">
          <Tooltip.Popup id={tooltipId} role="tooltip" className="cs-surface cs-tooltip">
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
  const range=game?.getDevelopmentAdventurerRange();
  const rangeSelected=range!==null && range!==undefined;
  const main=range?.ok ? range.value : null;
  const breakdown = characterStatBreakdown(hero),
    final = breakdown.final;
  const profile = combatProfile(hero);
  const resourceBreakdown = characterResourceBreakdown(hero);
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
    if(stat.id==='physicalAttack' && rangeSelected)return <>
      <strong>Physical Attack</strong>
      {main ? <dl><div><dt>Base Physical Attack</dt><dd>{main.base}</dd></div>
        <div><dt>Bonus STR</dt><dd>{main.bonusSTR}</dd></div>
        <div><dt>Main-hand weapon</dt><dd>{main.weapon.min}–{main.weapon.max}</dd></div>
        {'OFF' in main && main.OFF && <div><dt>Off-hand weapon · 50%</dt><dd>{main.OFF.min}–{main.OFF.max}</dd></div>}
        <div><dt>Total</dt><dd>{main.MAIN.min}–{main.MAIN.max}</dd></div></dl>
        : <p>Range unavailable for the current equipment or character context.</p>}
      <small>Physical Attack range; skill coefficients are applied separately.</small>
    </>;
    const sources = [
      { label: 'Base + attributes', stats: breakdown.base },
      ...breakdown.columns,
    ];
    return (
      <>
        <strong>{stat.label}</strong>
        <p>{characterStatNote(stat.id, final) ?? 'Nilai hasil resolver karakter saat ini.'}</p>
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
          Breakdown mengikuti resolver sumber. Batas dan eligibility pada impact
          tetap mengikuti consumer; tidak ada formula damage terpisah di UI.
        </small>
      </>
    );
  }
  function statRows(rows: CharacterStat[], tooltipSide: 'top' | 'right' = 'top') {
    return rows.map((stat) => (
      <Tip key={stat.id} disabled={drag.isDragging} content={statDetail(stat)} side={tooltipSide}>
        <span className="cs-stat-row" data-character-stat={stat.id}>
          <span>{stat.label}</span>
          <b>
            {stat.id==='physicalAttack' && rangeSelected ? main ? `${main.MAIN.min}–${main.MAIN.max}` : '—' : fmt(final[stat.id])}
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
        <EquipmentDetail item={item} game={game} unlockAction={<button className="cs-button" disabled={!game || !hero.inventory.some(i=>i.itemType==='magnifier'&&i.quantity>0)} onClick={()=>game?.unlockUniqueStats(item.id)}>Unlock · 1 Magnifier</button>}/>
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
    const candidates = getEquipmentCandidatesForSlot(hero, slot);
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
          {slot === 'accessory' && 'Untuk wings dan aksesori tambahan. '}
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
                        <EquipmentDetail item={item} game={game} compact/>
                        <p>Compare dengan <JobText>{equipped?.name ?? 'slot kosong'}</JobText></p>
                        <CombatPowerComparison comparison={comparison.combatPower} />
                        {rangeSelected && <small>Legacy CP comparison; validated Physical Attack range is shown after Equip.</small>}
                        {comparison.validation.ok ? (
                          <dl>
                            {CHARACTER_STAT_ROWS.filter(
                              (s) =>
                                (!rangeSelected || s.id!=='physicalAttack') && comparison.before[s.id] !==
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
              {rangeSelected && <p>Legacy CP comparison. Physical Attack range is shown after validated equipment is applied.</p>}
              {preview.validation.ok && (
                <dl>
                  {CHARACTER_STAT_ROWS.filter(
                    (stat) =>
                      (!rangeSelected || stat.id!=='physicalAttack') && preview.after[stat.id] !== preview.before[stat.id],
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
                CHARACTER_STAT_ROWS.filter(stat=>!rangeSelected || stat.id!=='physicalAttack').every(
                  (stat) => preview.after[stat.id] === preview.before[stat.id],
                ) && <small>{rangeSelected ? 'Stat lain yang ditampilkan tetap; range Physical Attack divalidasi setelah Equip.' : 'Tidak mengubah statistik efektif.'}</small>}
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
              {getDaggerEquipmentLabel(hero) && <p>{getDaggerEquipmentLabel(hero)}</p>}
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
                <small>{rangeSelected ? 'Combat Power uses the legacy calculation; it does not evaluate this Physical Attack range.' : 'Dinilai dari damage, kemampuan bertahan, dan skill yang aktif. Bukan rarity equipment.'}</small>
              </>
            }
          >
            <div className="cs-power">
              <Crown size={21} />
              <div>
                <span>COMBAT POWER</span>
                <b>{power ? fmt(power.total) : '—'}</b>
                {rangeSelected && <small>Legacy calculation</small>}
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
                        {!rangeSelected && <AttributeCombatPowerPreview hero={hero} attribute={attribute.id} />}
                        {rangeSelected && <p>{hero.statPoints>0 ? attribute.id==='str' ? '+1 STR adds 1 to both Physical Attack endpoints.' : '+1 does not add raw Physical Attack; existing resource and combat effects remain.' : 'No available point. STR affects both Physical Attack endpoints; no allocation preview.'}</p>}
                        <dl>
                          {(!rangeSelected || hero.statPoints>0 ? attributeEffects(hero, attribute.id) : []).filter(effect=>!rangeSelected || effect.id!=='physicalAttack').map(
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
              <small className="cs-eyebrow" style={{display:'block'}}>HP base {fmt(resourceBreakdown.hp.base)} + growth {fmt(resourceBreakdown.hp.growth)}/level + VIT {fmt(resourceBreakdown.hp.primaryContribution)}</small>
              {resourceBreakdown.mana.levelFoundation !== null && <small className="cs-eyebrow" style={{display:'block'}}>Mana level {fmt(resourceBreakdown.mana.levelFoundation)} + Bonus INT {fmt(resourceBreakdown.mana.primaryContribution!)}</small>}
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
              <span className="cs-equipped-count" aria-label="Equipment terpasang">
                {PAPER_DOLL_SLOTS.filter((slot) => hero.inventory.some((item) => item.id === hero.equipment[slot.id])).length}
                <span> / {PAPER_DOLL_SLOTS.length}</span>
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
                      className={`cs-slot-position ${slot.id === 'accessory' ? 'cs-accessory-position' : ''}`}
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
                              <EquipmentDetail item={equipped} game={game} compact/>
                              <small>
                                Klik untuk detail, compare, atau unequip.
                              </small>
                            </>
                          ) : (
                            <>
                              <strong>{slot.label}</strong>
                              {slot.hint && <p>{slot.hint}</p>}
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
                          ) : slot.id === 'accessory' ? (
                            <Feather size={22} />
                          ) : slot.id === 'chest' ? (
                            <Shirt size={22} />
                          ) : slot.id === 'gloves' ? (
                            <Hand size={22} />
                          ) : slot.id === 'legs' ? (
                            <Columns2 size={22} />
                          ) : slot.id === 'boots' ? (
                            <Footprints size={22} />
                          ) : slot.id.startsWith('ring') ? (
                            <Circle size={20} />
                          ) : slot.id.startsWith('earring') ||
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
                        Nilai sumber karakter. Lihat tooltip untuk efek aktif dan batas consumer.
                    </Popover.Description>
                    <div className="cs-popup-scroll">
                      {/* Keep focused stat help beside the popup, clear of its close button. */}
                      {statRows(ADVANCED_STATS, 'right')}
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
