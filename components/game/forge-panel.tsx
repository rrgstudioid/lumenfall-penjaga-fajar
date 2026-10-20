'use client';
import { JobText } from './job-presentation-context';
import { equipmentDetailComparison } from '@/lib/game/equipment-detail-presentation';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Hammer, ShieldCheck } from 'lucide-react';
import { CITIES, forgeAccessReason } from '@/lib/game/regions';
import {
  enhancementPreview,
  isEnhanceableEquipment,
  type Hero,
} from '@/lib/game/rules';
import { ITEM_CATALOG, RARITY_META, type ItemData } from '@/lib/game/items';
import { CHARACTER_SLOTS } from '@/lib/game/character-view';
import type { Game } from '@/lib/game/world';
import { ItemIcon } from './entry-icon';
import { ItemHover } from './item-hover';
import { EquipmentDetail, readEquipmentDetail } from './equipment-detail';
import { Progress } from '@/components/ui/progress';
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

/** Presentation over the existing inventory and enhancement transaction; no copied equipment state. */
export function ForgePanel({
  hero,
  npcId,
  game,
  onClose,
}: {
  hero: Hero;
  npcId: string | null;
  game: Game | null;
  onClose?: () => void;
}) {
  const equipment = hero.inventory.filter(isEnhanceableEquipment);
  const [selectedId, setSelectedId] = useState<string | null>(
    hero.equipment.mainHand ?? equipment[0]?.id ?? null,
  );
  const [confirmation, setConfirmation] = useState<{
    id: string;
    level: number;
    useSeal: boolean;
    useFateRune: boolean;
  } | null>(null);
  const [result, setResult] = useState<{
    ok: boolean; attempted: boolean; reason: string; uncertain?: boolean;
    before?: ItemData; after?: ItemData;
  } | null>(
    null,
  );
  const committing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [processing, setProcessing] = useState<ItemData | null>(null);
  const [useSeal, setUseSeal] = useState(hero.enhancementSealEnabled !== false);
  const [useFateRune, setUseFateRune] = useState(false);
  const hasSeal = hero.inventory.some((candidate) => candidate.itemType === 'eternalSeal' && candidate.quantity > 0 && !candidate.isLocked);
  const hasFateRune = hero.inventory.some((candidate) => candidate.itemType === 'fateRune' && candidate.quantity > 0 && !candidate.isLocked);
  const feedback = useRef<HTMLDivElement>(null);
  // Waiting is presentation only. Unmount/close cancels BEFORE the one atomic transaction.
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (processing || result) feedback.current?.scrollIntoView({ block: 'nearest' });
  }, [processing, result]);
  function cancelPreparation() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    committing.current = false;
    setProcessing(null);
  }
  const selected = equipment.find((item) => item.id === selectedId);
  const npc = CITIES[hero.currentCity]?.npcList.find(
    (candidate) => candidate.id === npcId,
  );
  const accessReason = forgeAccessReason(hero, npcId);
  // Reconcile selection before rendering a preview with unavailable materials.
  if (!hasSeal && useSeal) setUseSeal(false);
  if (!hasFateRune && useFateRune) setUseFateRune(false);
  const preview = selected ? enhancementPreview(hero, selected.id, useSeal, useFateRune) : null;
  const comparison =
    selected && preview
      ? equipmentDetailComparison(readEquipmentDetail(selected, game), readEquipmentDetail({
          ...selected,
          enhancementLevel: selected.enhancementLevel + 1,
        }, game))
      : [];
  const blocked =
    accessReason || !game
      ? accessReason || 'Forge Master belum tersedia.'
      : !selected
        ? 'Pilih equipment yang ingin ditempa.'
        : !preview
          ? 'Equipment sudah mencapai enhancement maksimal.'
          : preview.blockedReason;
  const material = preview ? ITEM_CATALOG[preview.materialId] : null;
  const confirmationValid = Boolean(
    confirmation &&
    selected?.id === confirmation.id &&
    selected.enhancementLevel === confirmation.level &&
    useSeal === confirmation.useSeal &&
    useFateRune === confirmation.useFateRune &&
    !blocked,
  );

  return (
    <div className="forge-panel" data-forge-npc={npcId ?? ''}>
      <div className="forge-intro">
        <Hammer size={20} />
        <span>
          <strong>{npc?.name ?? 'Forge Master'}</strong>
          <small>
            {CITIES[hero.currentCity].displayName} · Equipment terpasang maupun
            dalam inventory
          </small>
        </span>
        <span className="forge-gold">{hero.gold.toLocaleString()} GOLD</span>
      </div>
      {accessReason && (
        <p role="alert" className="forge-warning">
          {accessReason} Tutup panel dan temui Forge Master kembali.
        </p>
      )}
      <div ref={feedback}>
        {processing && (
          <output className="forge-working" aria-live="polite">
            <ItemHover as="div" item={processing} className="forge-working-art" aria-hidden="true">
              <ItemIcon item={processing} />
              <Hammer className="forge-working-hammer" size={32} />
            </ItemHover>
            <h3>Enhancing…</h3>
            <p><JobText>{processing.name}</JobText> +{processing.enhancementLevel} → +{processing.enhancementLevel + 1}</p>
            <Progress value={null} className="forge-wait-track" aria-label="Proses tempa" />
            <small>Menyiapkan tempa. Bahan digunakan saat proses selesai.</small>
            <button className="secondary-button" onClick={cancelPreparation}>Cancel forging</button>
          </output>
        )}
        {result && !processing && (
          <ItemHover as="section" item={result.after ?? result.before} className={`forge-result ${result.ok ? 'is-success' : ''}`} aria-live="polite">
            {result.before && <ItemIcon item={result.after ?? result.before} />}
            <h3>{result.uncertain ? 'Periksa hasil equipment' : !result.attempted ? 'Enhancement Not Started' : result.ok ? 'Enhancement Successful' : 'Enhancement Failed'}</h3>
            <p>{result.reason}</p>
            {result.before && result.attempted && <p className="forge-result-level">
              <JobText>{result.before.name}</JobText>: +{result.before.enhancementLevel} → {result.after ? `+${result.after.enhancementLevel}` : 'Destroyed'}
            </p>}
            {result.before && result.after && result.attempted && <dl className="forge-result-stats">
              {equipmentDetailComparison(readEquipmentDetail(result.before, game), readEquipmentDetail(result.after, game)).filter(row => row.before !== row.after).map(row => (
                <div key={row.id}><dt>{row.label}</dt><dd>{row.before} → {row.after}</dd></div>
              ))}
            </dl>}
            <small>{result.uncertain ? 'Jangan ulangi percobaan sebelum memeriksa inventory.' : result.attempted ? 'Bahan dan hasil equipment sudah diperbarui. Biaya: 0 GOLD.' : 'Tidak ada bahan atau GOLD yang digunakan.'}</small>
            <div className="forge-result-actions">
              {result.after && !blocked && <button className="primary-button" onClick={() => {
                if (committing.current || !selected) return;
                setConfirmation({ id: selected.id, level: selected.enhancementLevel, useSeal, useFateRune });
              }}>Enhance Again</button>}
              {onClose && <button className="secondary-button" onClick={onClose}>Close Forge</button>}
            </div>
          </ItemHover>
        )}
      </div>
      <div className="forge-layout">
        <section
          className="forge-equipment-list"
          aria-label="Equipment untuk ditempa"
        >
          <h3>
            Pilih equipment <small>{equipment.length}</small>
          </h3>
          {!equipment.length && (
            <p className="muted-copy">
              Belum ada equipment yang dapat ditempa.
            </p>
          )}
          {equipment.map((item) => (
            <ItemHover as="button" item={item}
              key={item.id}
              data-forge-item={item.id}
              aria-pressed={selectedId === item.id}
              className="forge-item"
              disabled={Boolean(processing)}
              style={
                {
                  '--forge-rarity': RARITY_META[item.rarity].color,
                } as CSSProperties
              }
              onClick={() => {
                  setSelectedId(item.id);
                  setResult(null);
              }}
            >
              <ItemIcon item={item} />
              <span>
                <strong>
                  <JobText>{item.name}</JobText> +{item.enhancementLevel}
                </strong>
                <small>
                  {RARITY_META[item.rarity].label} ·{' '}
                  {Object.values(hero.equipment).includes(item.id)
                    ? 'Terpasang'
                    : 'Inventory'}
                  {item.isLocked ? ' · Terkunci' : ''}
                  {item.enhancementLevel >= item.maxEnhancementLevel
                    ? ' · MAX'
                    : ''}
                </small>
              </span>
            </ItemHover>
          ))}
        </section>
        <section className="forge-detail" aria-label="Detail enhancement">
          {selected ? (
            <>
              <ItemHover as="div" item={selected}
                className="forge-item-heading"
                style={
                  {
                    '--forge-rarity': RARITY_META[selected.rarity].color,
                  } as CSSProperties
                }
              >
                <ItemIcon item={selected} />
                <div>
                  <span className="forge-rarity">
                    ◆ {RARITY_META[selected.rarity].label}
                  </span>
                  <h3>
                    <JobText>{selected.name}</JobText> +{selected.enhancementLevel}
                  </h3>
                  <small>
                    {CHARACTER_SLOTS.find(
                      (slot) => slot.id === selected.equipSlot,
                    )?.label ?? selected.equipSlot}{' '}
                    · Maksimal +{selected.maxEnhancementLevel}
                  </small>
                </div>
              </ItemHover>
              <div className="forge-stats">
                <h4>Stat saat ini → setelah berhasil</h4>
                <small>
                  Sumber rincian sama dengan tooltip equipment. Proyeksi stat bukan izin tempa; batas transaksi tetap berlaku.
                </small>
                <dl>
                  {comparison.map(row => (
                    <div key={row.id}>
                      <dt>{row.label}</dt>
                      <dd>
                        {row.before} <span>→</span>{' '}
                        {row.after}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <details className="forge-options" open>
                <summary>Rincian equipment</summary>
                <EquipmentDetail item={selected} game={game}/>
              </details>
              {preview && material && (
                <div className="forge-costs">
                  <ItemHover as="div" item={material} className="forge-material">
                    <ItemIcon item={material} />
                    <span>
                      {material.name}
                      <small>
                        Dimiliki {preview.materialOwned} / Dibutuhkan{' '}
                        {preview.materialRequired}
                      </small>
                    </span>
                  </ItemHover>
                  <p>
                    Biaya GOLD: <strong>0</strong> · Sistem tempa menggunakan
                    material.
                  </p>
                  <p>
                    Peluang sukses:{' '}
                    <strong>{Math.round(preview.finalChance * 100)}%</strong>{' '}
                    <small>
                      (dasar {Math.round(preview.baseChance * 100)}%
                      {preview.runeBonus ? ' + Fate Rune 8%' : ''})
                    </small>
                  </p>
                  {preview.runeBonus > 0 && (
                    <p>
                      Fate Rune Fragment ×1 otomatis terpakai pada setiap
                      percobaan.
                    </p>
                  )}
                  <p className="forge-risk">
                    {preview.protectedBySeal && <ShieldCheck size={15} />}{' '}
                    {preview.risk}

                  </p>
                  <small>
                    Material tetap terpakai saat gagal. Item, Rune, dan level enhancement tetap. Eternal Seal tidak terpakai.
                  </small>
                  <label className="forge-seal-toggle" aria-label="Gunakan Eternal Seal">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={true}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setUseSeal(enabled);
                        game?.setEnhancementSealEnabled(enabled);
                      }}
                    />
                    <span>
                      <strong>Gunakan Eternal Seal</strong>
                      <small>
                        {hasSeal
                          ? useSeal
                            ? 'Item selalu terlindungi; Seal tidak terpakai.'
                            : 'Enhancement tidak akan memakai Seal.'
                          : 'Tidak ada Eternal Seal di inventory.'}
                      </small>
                    </span>
                  </label>
                  <label className="forge-seal-toggle" aria-label="Gunakan Fate Rune">
                    <input
                      type="checkbox"
                      checked={useFateRune && hasFateRune}
                      disabled={Boolean(processing) || !hasFateRune}
                      onChange={(event) => {
                        setUseFateRune(event.target.checked);
                      }}
                    />
                    <span>
                      <strong>Gunakan Fate Rune</strong>
                      <small>
                        {hasFateRune
                          ? useFateRune
                            ? '+8% success chance aktif.'
                            : 'Tambahkan +8% success chance bila diaktifkan.'
                          : 'Tidak ada Fate Rune di inventory.'}
                      </small>
                    </span>
                  </label>
                </div>
              )}
              <div className="forge-actions">
                {blocked && <p className="forge-warning">{blocked}</p>}
                <button
                  className="primary-button"
                  disabled={Boolean(blocked || processing)}
                  onClick={() => {
                    if (committing.current) return;
                    setConfirmation({
                      id: selected.id,
                      level: selected.enhancementLevel,
                      useSeal,
                      useFateRune,
                    });
                  }}
                >
                  <Hammer size={17} />
                  Tempa{' '}
                  {preview
                    ? `+${selected.enhancementLevel} → +${selected.enhancementLevel + 1}`
                    : 'MAX'}
                </button>
              </div>
            </>
          ) : (
            <p className="muted-copy">
              Pilih equipment di sebelah kiri untuk melihat material, peluang
              sukses, dan preview stat.
            </p>
          )}
        </section>
      </div>
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DraggableAlertDialogContent windowId="forge-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi tempa equipment</AlertDialogTitle>
            <AlertDialogDescription>
              <JobText>{confirmationValid && selected && preview
                  ? `${selected.name} +${selected.enhancementLevel} → +${selected.enhancementLevel + 1}. Peluang sukses ${Math.round(preview.finalChance * 100)}%. Biaya ${preview.materialRequired} ${material?.name}, 0 GOLD.${preview.runeBonus ? ' Fate Rune terpakai dan menambah +8% success chance.' : ' Fate Rune tidak dipakai.'} ${preview.risk} Material tetap terpakai saat gagal.`
                : blocked ||
                  'Equipment berubah. Batalkan dan periksa preview kembali.'}</JobText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batalkan</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmationValid}
              onClick={() => {
                if (
                  !confirmation ||
                  !confirmationValid ||
                  committing.current ||
                  !game
                )
                  return;
                committing.current = true;
                const target = structuredClone(selected!);
                const request = { ...confirmation };
                setResult(null);
                setProcessing(target);
                setConfirmation(null);
                timer.current = setTimeout(() => {
                  timer.current = null;
                  try {
                    // Engine revalidates location, NPC, level and resources at execution time.
                    const outcome = game.enhanceItem(request.id, request.level, request.useSeal, request.useFateRune);
                    const after = game.hero.inventory.find(item => item.id === request.id);
                    setResult({ ...outcome, before: target, after: after ? structuredClone(after) : undefined });
                  } catch {
                    setResult({ ok: false, attempted: false, uncertain: true, reason: 'Proses terganggu. Periksa equipment dan bahan di inventory; tempa tidak akan diulang otomatis.' });
                  } finally {
                    committing.current = false;
                    setProcessing(null);
                  }
                }, 2400);
              }}
            >
              Konfirmasi Tempa
            </AlertDialogAction>
          </AlertDialogFooter>
        </DraggableAlertDialogContent>
      </AlertDialog>
    </div>
  );
}
