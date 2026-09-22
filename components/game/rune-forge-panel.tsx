'use client';
import { JobText } from './job-presentation-context';

import { useRef, useState, type CSSProperties } from 'react';
import { CITIES, forgeAccessReason } from '@/lib/game/regions';
import {
  runeForgeReason,
  runeReforgeDistribution,
  itemStats,
  type Hero,
  type RuneForgeRequest,
} from '@/lib/game/rules';
import {
  ITEM_CATALOG,
  RARITY_META,
  RUNE_OPTIMIZER_TIER_RULES,
  RUNE_REMOVAL_GOLD_COST,
  type ItemData,
  type SocketedRune,
} from '@/lib/game/items';
import type { Game } from '@/lib/game/world';
import { ItemIcon } from './entry-icon';
import { ItemHover } from './item-hover';
import { RuneDetails } from './rune-details';
import { DraggableAlertDialogContent } from './draggable-window';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Confirmation = {
  action: 'install' | 'remove' | 'roll';
  equipmentId: string;
  socketIndex: number;
  signature: string;
  runeId?: string;
  request?: RuneForgeRequest;
};

/** UI holds selection IDs only. Owned Runes and committed candidates come from Hero. */
export function RuneForgePanel({
  hero,
  npcId,
  game,
}: {
  hero: Hero;
  npcId: string | null;
  game: Game | null;
}) {
  const equipment = hero.inventory.filter((item) =>
    ['weapon', 'armor', 'accessory'].includes(item.category),
  );
  const pending = hero.runeForgePending;
  const [selectedId, setSelectedId] = useState(
    pending?.equipmentId ??
      equipment.find((item) => item.sockets.length)?.id ??
      equipment[0]?.id ??
      '',
  );
  const [socketIndex, setSocketIndex] = useState(pending?.socketIndex ?? 0);
  const [mode, setMode] = useState<'install' | 'roll'>(
    pending ? 'roll' : 'install',
  );
  const [runeId, setRuneId] = useState('');
  const [optimizerId, setOptimizerId] = useState('');
  // Availability and player intent are separate. Owning a Stabilizer never
  // turns this controlled switch on by itself.
  const [useStabilizer, setUseStabilizer] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const committing = useRef(false);
  const selected = equipment.find(
    (item) => item.id === (pending?.equipmentId ?? selectedId),
  );
  const index = pending?.socketIndex ?? socketIndex;
  const socket = selected?.sockets[index];
  const rune = socket?.rune;
  const availableRunes = hero.inventory.filter(
    (item) => item.itemType === 'socketRune',
  );
  const chosenRune = availableRunes.find((item) => item.id === runeId);
  const allOptimizers = hero.inventory.filter(
    (item) =>
      item.itemType === 'runeOptimizer' &&
      item.optimizerTier &&
      RUNE_OPTIMIZER_TIER_RULES[item.optimizerTier] &&
      item.quantity > 0,
  );
  // Never auto-select a locked stack when another usable optimizer exists.
  // The old behavior selected the first stack and then blocked the whole
  // action even though the player owned a valid unlocked optimizer.
  const optimizers = allOptimizers.filter((item) => !item.isLocked);
  const optimizer =
    optimizers.find((item) => item.id === optimizerId) ?? optimizers[0];
  const rule = optimizer?.optimizerTier
    ? RUNE_OPTIMIZER_TIER_RULES[optimizer.optimizerTier]
    : null;
  const stabilizerCount = hero.inventory
    .filter((item) => item.templateId === 'rune-stabilizer' && !item.isLocked)
    .reduce((sum, item) => sum + item.quantity, 0);
  const chromaticOptimizer = Boolean(
    optimizer?.optimizerTier && optimizer.optimizerTier !== 'basic',
  );
  const request: RuneForgeRequest = {
    equipmentId: selected?.id ?? '',
    socketIndex: index,
    optimizerItemId: optimizer?.id ?? '',
    stabilize: useStabilizer,
  };
  const access = forgeAccessReason(hero, npcId);
  const blockedRoll = !game
    ? 'Forge Master belum tersedia.'
    : runeForgeReason(hero, request, npcId);
  const blockedInstall =
    access ||
    (hero.hp <= 0
      ? 'Karakter harus hidup.'
      : !selected || !socket
        ? 'Pilih equipment dengan socket.'
        : selected.isLocked
          ? 'Equipment sedang terkunci.'
          : socket.rune
            ? 'Pilih socket kosong atau lepas Rune terlebih dahulu.'
            : !chosenRune
              ? 'Pilih Rune dari Inventory.'
              : chosenRune.isLocked
                ? 'Rune sedang terkunci.'
                : chosenRune.runeJobRequirement &&
                    chosenRune.runeJobRequirement !== hero.coreJob
                  ? 'Rune ini hanya dapat digunakan oleh job tertentu.'
                  : '');
  const npc = CITIES[hero.currentCity]?.npcList.find((n) => n.id === npcId);
  const signature = (item: ItemData | undefined) =>
    JSON.stringify(item?.sockets);
  const confirmationValid = Boolean(
    confirmation &&
    !access &&
    selected &&
    confirmation.equipmentId === selected.id &&
    confirmation.socketIndex === index &&
    signature(selected) === confirmation.signature &&
    !pending &&
    (confirmation.action === 'roll'
      ? !runeForgeReason(hero, confirmation.request!, npcId)
      : confirmation.action === 'install'
        ? !blockedInstall && chosenRune?.id === confirmation.runeId
        : rune &&
          !selected.isLocked &&
          !rune.isLocked &&
          hero.gold >= RUNE_REMOVAL_GOLD_COST),
  );
  const confirm = (action: Confirmation['action']) => {
    if (!selected) return;
    committing.current = false;
    setConfirmation({
      action,
      equipmentId: selected.id,
      socketIndex: index,
      signature: signature(selected),
      runeId: chosenRune?.id,
      request,
    });
  };
  const distribution =
    rune?.runeRarity && optimizer?.optimizerTier
      ? runeReforgeDistribution(
          rune.runeRarity,
          optimizer.optimizerTier,
          useStabilizer,
          rune.runeQualityFixed,
        )
      : null;
  const before = selected ? itemStats(selected) : {};
  const after =
    selected && chosenRune && chosenRune.runeTheme && chosenRune.runeRarity
      ? itemStats({
          ...selected,
          sockets: selected.sockets.map((entry, i) =>
            i === index
              ? {
                  ...entry,
                  rune: {
                    ...chosenRune,
                    sourceLabel: chosenRune.source.label,
                  } as SocketedRune,
                }
              : entry,
          ),
        })
      : before;
  const installPreview = chosenRune?.affixes
    .map(
      (a) =>
        a.label +
        ' ' +
        Number(before[a.stat] ?? 0).toFixed(1) +
        ' → ' +
        Number(after[a.stat] ?? 0).toFixed(1) +
        (a.unit === 'percent' ? '%' : ''),
    )
    .join(' · ');

  return (
    <div className="forge-panel rune-forge" data-forge-npc={npcId ?? ''}>
      <div className="forge-intro">
        <span>
          <strong>{npc?.name ?? 'Forge Master'} · Rune Forge</strong>
          <small>
            Rune memiliki quality dan stat sendiri. Base stats, Unique Stats,
            dan enhancement tetap aman.
          </small>
        </span>
        <span className="forge-gold">{hero.gold.toLocaleString()} GOLD</span>
      </div>
      {access && (
        <p role="alert" className="forge-warning">
          {access}
        </p>
      )}
      <div className="forge-layout">
        <section
          className="forge-equipment-list"
          aria-label="Equipment Rune Forge"
        >
          <h3>Pilih equipment</h3>
          {equipment.map((item) => (
            <ItemHover as="button" item={item}
              key={item.id}
              className="forge-item"
              data-rune-equipment={item.id}
              style={
                {
                  '--forge-rarity': RARITY_META[item.rarity].color,
                } as CSSProperties
              }
              disabled={Boolean(pending)}
              aria-pressed={item.id === selected?.id}
              onClick={() => {
                setSelectedId(item.id);
                setSocketIndex(0);
                setRuneId('');
                setUseStabilizer(false);
              }}
            >
              <ItemIcon item={item} />
              <span>
                <strong>
                  <JobText>{item.name}</JobText> +{item.enhancementLevel}
                </strong>
                <small>
                  {RARITY_META[item.rarity].label} · {item.sockets.length}{' '}
                  socket{item.isLocked ? ' · Terkunci' : ''}
                </small>
              </span>
            </ItemHover>
          ))}
        </section>
        <section className="forge-detail">
          <h3><JobText>{selected?.name ?? 'Pilih equipment'}</JobText></h3>
          <div className="rune-forge-tabs" aria-label="Socket Rune">
            {selected?.sockets.map((entry, i) => (
              <ItemHover as="button" item={entry.rune}
                key={entry.id}
                disabled={Boolean(pending)}
                aria-pressed={index === i}
                onClick={() => {
                  setSocketIndex(i);
                  setUseStabilizer(false);
                }}
              >
                Socket {i + 1} {entry.rune ? '●' : '○'}
              </ItemHover>
            ))}
          </div>
          {!selected?.sockets.length && <p>Tidak memiliki socket.</p>}
          {rune && <RuneDetails rune={rune} />}
          <div className="rune-forge-tabs" aria-label="Aksi Rune">
            <button
              disabled={Boolean(pending)}
              aria-pressed={mode === 'install'}
              onClick={() => {
                setMode('install');
                setUseStabilizer(false);
              }}
            >
              Pasang Rune
            </button>
            <button
              disabled={Boolean(pending)}
              aria-pressed={mode === 'roll'}
              onClick={() => {
                setMode('roll');
                setUseStabilizer(false);
              }}
            >
              Reroll Rune
            </button>
          </div>
          {pending ? (
            <section className="forge-costs" aria-label="Hasil Rune">
              <h4>Hasil Rune · Item dan GOLD sudah terpakai</h4>
              <p>
                {pending.optimizerName} ×1 · {pending.goldCost} GOLD
                {pending.stabilized ? ' · Rune Stabilizer ×1' : ''}
              </p>
              <div className="rune-compare">
                <div>
                  <h4>Saat ini</h4>
                  {rune && <RuneDetails rune={rune} />}
                </div>
                <div>
                  <h4>Hasil baru</h4>
                  <RuneDetails rune={pending.candidate} />
                </div>
              </div>
              <p>
                Keep Current atau menutup panel mempertahankan Rune lama. Biaya
                tidak dikembalikan.
              </p>
              <div className="rune-forge-tabs">
                <button
                  disabled={Boolean(access)}
                  onClick={() => game?.resolveRune(pending.id, false)}
                >
                  Keep Current
                </button>
                <button
                  className="primary-button"
                  disabled={Boolean(access)}
                  onClick={() => game?.resolveRune(pending.id, true)}
                >
                  Accept New
                </button>
              </div>
            </section>
          ) : mode === 'install' ? (
            <>
              {rune ? (
                <>
                  <p>
                    Rune kembali utuh ke Inventory; diperlukan satu slot kosong.
                  </p>
                  <button
                    className="secondary-button"
                    disabled={
                      Boolean(access || selected?.isLocked || rune.isLocked) ||
                      hero.gold < RUNE_REMOVAL_GOLD_COST
                    }
                    onClick={() => confirm('remove')}
                  >
                    Lepas Rune · {RUNE_REMOVAL_GOLD_COST} GOLD
                  </button>
                </>
              ) : (
                <>
                  <h4>Rune di Inventory</h4>
                  {!availableRunes.length && (
                    <p>Belum ada Rune di Inventory.</p>
                  )}
                  <div className="rune-inventory-list">
                    {availableRunes.map((item) => (
                      <ItemHover as="button" item={item}
                        className="forge-item"
                        key={item.id}
                        aria-pressed={runeId === item.id}
                        style={
                          {
                            '--forge-rarity': RARITY_META[item.rarity].color,
                          } as CSSProperties
                        }
                        disabled={
                          item.isLocked ||
                          Boolean(
                            item.runeJobRequirement &&
                            item.runeJobRequirement !== hero.coreJob,
                          )
                        }
                        onClick={() => setRuneId(item.id)}
                      >
                        <ItemIcon item={item} />
                        <span>
                          <strong><JobText>{item.name}</JobText></strong>
                          <small>
                            {item.runeRarity} · {item.runeTheme}
                          </small>
                          {item.runeJobRequirement &&
                            item.runeJobRequirement !== hero.coreJob && (
                              <small>
                                Rune ini hanya dapat digunakan oleh job
                                tertentu.
                              </small>
                            )}
                          {item.isLocked && <small>Terkunci</small>}
                        </span>
                      </ItemHover>
                    ))}
                  </div>
                  {chosenRune && (
                    <>
                      <RuneDetails rune={chosenRune} />
                      <p>Preview equipment: <JobText>{installPreview}</JobText></p>
                    </>
                  )}
                  <p className="forge-warning">{blockedInstall}</p>
                  <button
                    className="primary-button"
                    disabled={Boolean(blockedInstall) || !game}
                    onClick={() => confirm('install')}
                  >
                    Konfirmasi Pasang Rune · Gratis
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <label className="rune-optimizer-select">
                Rune Optimizer
                <select
                  aria-label="Pilih Rune Optimizer"
                  value={optimizer?.id ?? ''}
                  onChange={(e) => {
                    setOptimizerId(e.target.value);
                    setUseStabilizer(false);
                  }}
                >
                  {!optimizers.length && (
                    <option value="">
                      {allOptimizers.length
                        ? 'Semua Rune Optimizer sedang terkunci'
                        : 'Belum memiliki Rune Optimizer'}
                    </option>
                  )}
                  {optimizers.map((item) => (
                    <option key={item.id} value={item.id}>
                      <JobText>{item.name}</JobText> ×{item.quantity}
                      {item.isLocked ? ' · Terkunci' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {optimizer && (
                <ItemHover as="div" item={optimizer} className="forge-rune">
                  <ItemIcon item={optimizer} />
                  <p>{optimizer.description}</p>
                </ItemHover>
              )}
              <ItemHover as="label" item={ITEM_CATALOG['rune-stabilizer']} className="rune-stabilizer">
                <input
                  type="checkbox"
                  checked={useStabilizer}
                  disabled={
                    !chromaticOptimizer || !stabilizerCount
                  }
                  onChange={(e) => setUseStabilizer(e.target.checked)}
                />
                Rune Stabilizer (×{stabilizerCount}) · Mencegah penurunan
                quality
              </ItemHover>
              {distribution && (
                <details className="forge-options">
                  <summary>Peluang quality hasil</summary>
                  {Object.entries(distribution)
                    .filter(([, v]) => v > 0)
                    .map(([q, v]) => (
                      <p key={q}>
                        {q}: {(v * 100).toFixed(4)}%
                      </p>
                    ))}
                </details>
              )}
              <p>
                Biaya: {rule?.goldCost ?? 0} GOLD + 1 Optimizer
                {useStabilizer ? ' + 1 Rune Stabilizer' : ''}.
              </p>
              <p>
                Seluruh affix normal Rune diacak. Unique effect tetap. Biaya
                langsung terpakai saat roll dibuat, termasuk jika hasil ditolak.
              </p>
              {blockedRoll && <p className="forge-warning">{blockedRoll}</p>}
              <button
                className="primary-button"
                disabled={Boolean(blockedRoll)}
                onClick={() => confirm('roll')}
              >
                Gunakan Rune Optimizer
              </button>
            </>
          )}
        </section>
      </div>
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DraggableAlertDialogContent windowId="rune-socket-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Konfirmasi{' '}
              {confirmation?.action === 'roll'
                ? 'Reroll Rune'
                : confirmation?.action === 'remove'
                  ? 'Lepas Rune'
                  : 'Pasang Rune'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <JobText>{!confirmationValid
                ? 'Data berubah atau syarat belum terpenuhi. Batalkan dan periksa kembali.'
                : confirmation?.action === 'roll'
                  ? 'Gunakan ' +
                    optimizer?.name +
                    ' ×1, ' +
                    rule?.goldCost +
                    ' GOLD' +
                    (useStabilizer ? ' dan Rune Stabilizer ×1' : '') +
                    '? Biaya langsung terpakai saat hasil dibuat. Keep Current tidak mengembalikan biaya.'
                  : confirmation?.action === 'remove'
                    ? 'Lepas ' +
                      rune?.name +
                      '? Biaya ' +
                      RUNE_REMOVAL_GOLD_COST +
                      ' GOLD. Rune kembali utuh ke Inventory.'
                    : 'Pasang ' +
                      chosenRune?.name +
                      ' pada ' +
                      selected?.name +
                      '? ' +
                      installPreview}</JobText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUseStabilizer(false)}>
              Batalkan
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmationValid}
              onClick={() => {
                if (
                  !confirmation ||
                  !confirmationValid ||
                  !game ||
                  committing.current
                )
                  return;
                committing.current = true;
                if (confirmation.action === 'install')
                  game.socketRune(
                    confirmation.equipmentId,
                    confirmation.runeId!,
                    confirmation.socketIndex,
                  );
                else if (confirmation.action === 'remove')
                  game.removeRune(
                    confirmation.equipmentId,
                    confirmation.socketIndex,
                  );
                else game.rollRune(confirmation.request!);
                if (confirmation.action === 'roll') setUseStabilizer(false);
                setConfirmation(null);
              }}
            >
              Konfirmasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </DraggableAlertDialogContent>
      </AlertDialog>
    </div>
  );
}
