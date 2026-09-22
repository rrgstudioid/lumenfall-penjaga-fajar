'use client';
import { JobText } from './job-presentation-context';
import { presentJobText } from '@/lib/game/job-presentation';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Move,
  Settings2,
  LockKeyhole,
  Ban,
  GripHorizontal,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clampPrimaryHotbarLayout,
  getPrimaryHotbarEntries,
  primaryHotbarAssignmentReason,
  resolvePrimaryHotbarEntry,
  resolveQuickHotbarEntry,
  hotbarAssignment,
  hotbarSlotLabel,
  hotbarSlots,
  isQuickHotbarId,
  type HotbarSlot,
  type QuickHotbarId,
} from '@/lib/game/hotbar';
import type { Hero } from '@/lib/game/rules';
import { itemCooldownKey, RARITY_META } from '@/lib/game/items';
import type { Game, Snapshot } from '@/lib/game/world';
import { useGameDrag } from './drag-drop-provider';
import { EntryIcon as HotbarIcon } from './entry-icon';
import { INTERFACE_SCALE_EVENT } from '@/lib/game/interface-settings';
import {
  readUILayout,
  resetUILayoutEntries,
  saveWindowPosition,
  saveWindowScale,
  UI_LAYOUT_RESET_EVENT,
  type WindowPosition,
} from '@/lib/game/ui-layout';

const keyLabel = hotbarSlotLabel;
const HOTBAR_MIN_SCALE = 0.5;
const HOTBAR_MAX_SCALE = 1.5;
// Keep the compact size already used by the existing PrimaryHotbar as the
// default, while allowing each HUD bar to be enlarged independently.
const HOTBAR_DEFAULT_SCALE = 0.75;
const hotbarLayoutId = (quickId?: QuickHotbarId) =>
  quickId ? `quick-hotbar-${quickId}` : 'primary-hotbar';
export function primaryHotbarSlotView(state: Snapshot, index: HotbarSlot) {
  const entry = isQuickHotbarId(index)
    ? resolveQuickHotbarEntry(state.hero, index)
    : resolvePrimaryHotbarEntry(
        state.hero,
        hotbarAssignment(state.hero, index),
      );
  const skill = state.skillViews.find((skill) => skill.id === entry?.id);
  const remaining =
    entry?.kind === 'item'
      ? (state.hotbarRuntime.itemCooldowns[
          entry.item ? itemCooldownKey(entry.item) : entry.id
        ] ?? 0)
      : (skill?.remaining ??
        (entry?.id === 'basic-attack'
          ? state.hotbarRuntime.attackRemaining
          : 0));
  const insufficient = !!skill && state.mana < skill.manaCost;
  const locked = !!entry?.skill && !skill?.unlocked;
  const emptyItem = entry?.kind === 'item' && !entry.quantity;
  const unavailable = entry
    ? primaryHotbarAssignmentReason(state.hero, entry)
    : null;
  const reason =
    unavailable ??
    (remaining > 0
      ? `Cooldown ${Math.ceil(remaining)} dtk.`
      : insufficient
        ? `${state.manaName} tidak cukup.`
        : null);
  return { entry, skill, remaining, insufficient, locked, emptyItem, reason };
}
type Drag = {
  kind: 'panel' | 'resize';
  edge?: 'left' | 'right' | 'top' | 'bottom';
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  origin: WindowPosition;
  position: WindowPosition;
  originScale: number;
  scale: number;
  originRect: { width: number; height: number; right: number; bottom: number };
};
export function PrimaryHotbar({
  state,
  game,
  active,
  bindingEnabled = false,
  onEdit,
  quickId,
}: {
  state: Snapshot;
  game: Game | null;
  active: boolean;
  bindingEnabled?: boolean;
  onEdit: (index: HotbarSlot) => void;
  quickId?: QuickHotbarId;
}) {
  const { begin: beginEntryDrag, isDragging } = useGameDrag();
  const panel = useRef<HTMLElement>(null),
    drag = useRef<Drag | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const layoutId = hotbarLayoutId(quickId);
  const legacyLayout = quickId
    ? state.hero.quickHotbars[quickId].position
    : state.hero.primaryHotbarLayout;
  const [savedLayout, setSavedLayout] = useState<{
    x: number;
    y: number;
    scale?: number;
  } | null>(null);
  const [localScale, setLocalScale] = useState(HOTBAR_DEFAULT_SCALE);
  const [dragKind, setDragKind] = useState<Drag['kind'] | null>(null);
  const editMode = state.hotbarEditMode === true;
  const interactive = active || bindingEnabled;
  useEffect(() => {
    const reset = () => {
      setSavedLayout(null);
      setLocalScale(HOTBAR_DEFAULT_SCALE);
    };
    try {
      const saved = readUILayout(window.localStorage)[layoutId];
      setSavedLayout(saved ? { x: saved.x, y: saved.y, scale: saved.scale } : null);
      setLocalScale(
        Math.min(
          HOTBAR_MAX_SCALE,
          Math.max(HOTBAR_MIN_SCALE, saved?.scale ?? HOTBAR_DEFAULT_SCALE),
        ),
      );
    } catch {
      setSavedLayout(null);
      setLocalScale(HOTBAR_DEFAULT_SCALE);
    }
    window.addEventListener(UI_LAYOUT_RESET_EVENT, reset);
    return () => window.removeEventListener(UI_LAYOUT_RESET_EVENT, reset);
  }, [layoutId]);
  useEffect(() => {
    const resize = () => {
      if (!panel.current) return;
      const rect = panel.current.getBoundingClientRect();
      const primaryRect = document
        .querySelector('[data-hotbar-id="primary"]')
        ?.getBoundingClientRect();
      const primaryTop = primaryRect
        ? clampPrimaryHotbarLayout(
            state.hero.primaryHotbarLayout,
            { width: window.innerWidth, height: window.innerHeight },
            primaryRect,
          ).y
        : window.innerHeight - 190;
      const stored = savedLayout ?? legacyLayout;
      setPosition(
        clampPrimaryHotbarLayout(
          stored ??
            (quickId
              ? {
                  x:
                    window.innerWidth / 2 +
                    (quickId === 'q' ? -rect.width - 6 : 6),
                  y: primaryTop - rect.height - 8,
                }
              : null),
          { width: window.innerWidth, height: window.innerHeight },
          rect,
        ),
      );
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener(INTERFACE_SCALE_EVENT, resize);
    const observer = new ResizeObserver(resize);
    if (panel.current) observer.observe(panel.current);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener(INTERFACE_SCALE_EVENT, resize);
      observer.disconnect();
    };
  }, [legacyLayout, quickId, savedLayout, state.hero.primaryHotbarLayout, localScale]);
  useEffect(() => {
    const cancel = () => {
      if (drag.current && panel.current) {
        setPosition(
          clampPrimaryHotbarLayout(
            drag.current.origin,
            { width: window.innerWidth, height: window.innerHeight },
            panel.current.getBoundingClientRect(),
          ),
        );
        setLocalScale(drag.current.originScale);
      }
      drag.current = null;
      game?.setHotbarInteraction(false);
      setDragKind(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    if (!editMode || !interactive) cancel();
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', cancel);
    window.addEventListener(INTERFACE_SCALE_EVENT, cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', cancel);
      window.removeEventListener(INTERFACE_SCALE_EVENT, cancel);
      game?.setHotbarInteraction(false);
    };
  }, [game, editMode, interactive]);
  const begin = (event: ReactPointerEvent<HTMLElement>, kind: Drag['kind']) => {
    if (event.button !== 0 || !editMode || !interactive || !panel.current)
      return;
    event.stopPropagation();
    const rect = panel.current.getBoundingClientRect();
    const edge = kind === 'resize'
      ? (event.currentTarget.dataset.windowResizeEdge as Drag['edge'])
      : undefined;
    if (kind === 'resize' && !edge) return;
    drag.current = {
      kind,
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      origin: { x: rect.x, y: rect.y },
      position: { x: rect.x, y: rect.y },
      originScale: localScale,
      scale: localScale,
      originRect: {
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    game?.setHotbarInteraction(true);
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !panel.current)
      return;
    const dx = event.clientX - current.startX,
      dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true;
    event.preventDefault();
    setDragKind(current.kind);
    if (current.kind === 'panel') {
      current.position = clampPrimaryHotbarLayout(
        { x: current.origin.x + dx, y: current.origin.y + dy },
        { width: window.innerWidth, height: window.innerHeight },
        panel.current.getBoundingClientRect(),
      );
      setPosition(current.position);
      return;
    }
    const edge = current.edge;
    if (!edge) return;
    const horizontal = edge === 'left' || edge === 'right';
    const delta = horizontal ? dx : dy;
    const signedDelta = edge === 'left' || edge === 'top' ? -delta : delta;
    const baseSize = horizontal ? current.originRect.width : current.originRect.height;
    let nextScale = current.originScale * (1 + signedDelta / baseSize);
    const available = horizontal
      ? edge === 'right'
        ? window.innerWidth - current.origin.x - 8
        : current.originRect.right - 8
      : edge === 'bottom'
        ? window.innerHeight - current.origin.y - 8
        : current.originRect.bottom - 8;
    nextScale = Math.min(
      nextScale,
      current.originScale * Math.max(0.25, available / baseSize),
    );
    nextScale = Math.min(HOTBAR_MAX_SCALE, Math.max(HOTBAR_MIN_SCALE, nextScale));
    const visualRatio = nextScale / current.originScale;
    const nextWidth = current.originRect.width * visualRatio;
    const nextHeight = current.originRect.height * visualRatio;
    current.scale = nextScale;
    current.position = clampPrimaryHotbarLayout(
      {
        x: edge === 'left' ? current.originRect.right - nextWidth : current.origin.x,
        y: edge === 'top' ? current.originRect.bottom - nextHeight : current.origin.y,
      },
      { width: window.innerWidth, height: window.innerHeight },
      { width: nextWidth, height: nextHeight },
    );
    setLocalScale(nextScale);
    setPosition(current.position);
  };
  const end = (event: ReactPointerEvent<HTMLElement>, cancel = false) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    // Capture returns the release-click to the header, never to a slot.
    // Do not swallow the player's next deliberate slot click after panel movement.
    game?.setHotbarInteraction(false);
    if (current.moved && !cancel) {
      const nextLayout = {
        x: current.position.x,
        y: current.position.y,
        scale: current.scale,
      };
      setSavedLayout(nextLayout);
      saveWindowPosition(layoutId, current.position, window.localStorage);
      saveWindowScale(layoutId, current.scale, window.localStorage);
    } else if (cancel) {
      setPosition(current.origin);
      setLocalScale(current.originScale);
    }
    setDragKind(null);
  };
  return (
    <TooltipProvider delay={300}>
      <section
        ref={panel}
        aria-label={
          quickId ? `QuickHotbar${quickId.toUpperCase()}` : 'PrimaryHotbar'
        }
        data-hotbar-id={quickId ?? 'primary'}
        className={`primary-hotbar-panel ${quickId ? `quick-hotbar-panel quick-hotbar-${quickId}` : ''} ${editMode ? 'is-editing' : ''} ${dragKind === 'panel' ? 'is-moving' : ''} ${dragKind === 'resize' ? 'is-resizing' : ''}`}
        style={
          {
            ...(position
              ? {
                left: position.x,
                top: position.y,
                bottom: 'auto',
                transform: 'none',
              }
              : {}),
            '--hotbar-local-scale': localScale,
            '--primary-hotbar-scale': localScale,
            '--quick-hotbar-scale': localScale,
          } as CSSProperties
        }
        onPointerMove={move}
        onPointerUp={(event) => end(event)}
        onPointerCancel={(event) => end(event, true)}
        onLostPointerCapture={(event) => end(event, true)}
      >
        {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
          <button
            key={edge}
            type="button"
            className={`primary-hotbar-resize-handle is-${edge}`}
            data-window-resize-handle
            data-window-resize-edge={edge}
            aria-label={`Ubah ukuran hotbar dari sisi ${edge}`}
            disabled={!interactive || !editMode}
            onPointerDown={(event) => begin(event, 'resize')}
          >
            {edge === 'left' || edge === 'right' ? (
              <GripVertical size={11} />
            ) : (
              <GripHorizontal size={11} />
            )}
          </button>
        ))}
        <header className="primary-hotbar-header">
          <button
            type="button"
            className="primary-drag-handle"
            data-drag-handle
            aria-label={`${quickId ? quickId.toUpperCase() : 'Primary'} — geser panel`}
            disabled={!interactive || !editMode}
            onPointerDown={(event) => begin(event, 'panel')}
          >
            <GripHorizontal size={16} />
            <span>{quickId ? quickId.toUpperCase() : 'PRIMARY HOTBAR'}</span>
            <Move size={13} />
          </button>
          {!quickId && (
            <>
              <span className="primary-combo">
                {state.combo ? `Combo ×${state.combo}` : '1 — 0'}
              </span>
              <button
                type="button"
                className="primary-edit-toggle"
                aria-label="Edit Mode hotbar"
                aria-pressed={editMode}
                disabled={!interactive}
                onClick={() => game?.setHotbarEditMode(!editMode)}
              >
                Edit {editMode ? 'ON' : 'OFF'}
              </button>
            </>
          )}
          <button
            type="button"
            className="primary-settings"
            aria-label={
              quickId
                ? `Atur QuickHotbar${quickId.toUpperCase()}`
                : 'Atur PrimaryHotbar'
            }
            title="Isi slot / Reset Layout"
            disabled={!state.started || state.dead}
            onClick={() => onEdit(quickId ?? 0)}
          >
            <Settings2 size={17} />
          </button>
        </header>
        <div className="primary-hotbar-scroll">
          <div className="primary-hotbar-slots">
            {(quickId
              ? [quickId]
              : Array.from({ length: 10 }, (_, i) => i)
            ).map((index) => {
              const id = hotbarAssignment(state.hero, index);
              const view = primaryHotbarSlotView(state, index),
                { entry, skill, reason, remaining } = view;
              return (
                <Tooltip
                  key={index}
                  disabled={!!dragKind || isDragging}
                  disableHoverablePopup
                >
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        data-primary-slot={!quickId ? index : undefined}
                        data-quick-slot={quickId}
                        data-drop-type="hotbar"
                        data-drop-slot={index}
                        data-drag-source={
                          id && editMode ? 'hotbar-binding' : undefined
                        }
                        data-hotbar-category={quickId ? 'quick' : undefined}
                        data-window-no-drag
                        className={`primary-slot ${view.locked ? 'is-locked' : ''} ${view.insufficient ? 'insufficient-resource' : ''} ${view.emptyItem ? 'item-depleted' : ''}`}
                        style={
                          entry?.item
                            ? ({
                                '--entry-rarity':
                                  RARITY_META[entry.item.rarity].color,
                                borderColor: 'var(--entry-rarity)',
                              } as CSSProperties)
                            : undefined
                        }
                        aria-label={`Slot ${keyLabel(index)}: ${presentJobText(state.hero, entry?.name ?? 'Kosong')}`}
                        aria-disabled={!active && !bindingEnabled}
                        disabled={!active && !bindingEnabled}
                        onPointerDown={(event) =>
                          id &&
                          editMode &&
                          (active || bindingEnabled) &&
                          beginEntryDrag(event, {
                            dragType: 'hotbar-binding',
                            refId: id,
                            hotbarSlot: index,
                          })
                        }
                        onClick={() => {
                          if (!interactive) return;
                          // Empty-slot “+” is a drop target only for now; it
                          // must not open the slot editor.
                          if (editMode) {
                            if (entry) onEdit(index);
                          }
                          else if (active) {
                            if (isQuickHotbarId(index))
                              game?.activateQuickHotbarSlot(index);
                            else game?.activatePrimaryHotbarSlot(index);
                          }
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (editMode && entry) onEdit(index);
                        }}
                      />
                    }
                  >
                    <kbd>{keyLabel(index)}</kbd>
                    <HotbarIcon entry={entry} />
                    <span className="primary-slot-name">
                      <JobText>{entry?.name ?? 'Kosong'}</JobText>
                    </span>
                    {skill && (
                      <small className="primary-skill-level">
                        Lv.{skill.level}
                      </small>
                    )}
                    {entry?.kind === 'item' && (
                      <b className="primary-quantity">{entry.quantity ?? 0}</b>
                    )}
                    {view.locked && (
                      <LockKeyhole className="primary-state-icon" />
                    )}
                    {(view.insufficient || view.emptyItem) && !view.locked && (
                      <Ban className="primary-state-icon" />
                    )}
                    {remaining > 0 && (
                      <span
                        className="primary-cooldown"
                        style={{
                          background: `conic-gradient(#080b12ce ${Math.min(1, remaining / (skill?.cooldown || entry?.item?.useCooldown || 1)) * 360}deg,transparent 0deg)`,
                        }}
                      >
                        <b>
                          {remaining < 10
                            ? remaining.toFixed(1)
                            : Math.ceil(remaining)}
                        </b>
                      </span>
                    )}
                    {state.hotbarRuntime.lastUsedIndex ===
                      (typeof index === 'number'
                        ? index
                        : index === 'q'
                          ? 10
                          : 11) && (
                      <i
                        key={state.hotbarRuntime.useSequence}
                        className="primary-use-flash"
                      />
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="primary-tooltip">
                    <HotbarIcon entry={entry} />
                    <strong>
                      <JobText>{entry?.name ?? `Slot ${keyLabel(index)} kosong`}</JobText>
                    </strong>
                    <p>
                      <JobText>{entry?.description ??
                        'Klik tombol Edit Mode di hotbar, lalu klik atau drag skill/item untuk mengisi slot.'}</JobText>
                    </p>
                    {skill && (
                      <p>
                        Lv.{skill.level} · Mana Cost: {skill.manaCost} MP · CD{' '}
                        {skill.cooldown.toFixed(1)}s
                      </p>
                    )}
                    {entry?.kind === 'item' && (
                      <p>
                        Jumlah: {entry.quantity} · Cooldown:{' '}
                        {entry.item?.useCooldown ?? 0}s
                      </p>
                    )}
                    {reason && <p className="primary-reason">{reason}</p>}
                    <small>
                      Edit Mode: drag klik kiri untuk memindahkan · Lepas ke
                      latar kosong untuk menghapus shortcut · Esc untuk batal
                    </small>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}

export function PrimaryHotbarEditor({
  hero,
  game,
  index,
  onIndexChange,
}: {
  hero: Hero;
  game: Game | null;
  index: HotbarSlot;
  onIndexChange: (index: HotbarSlot) => void;
}) {
  const [selected, setSelected] = useState('');
  const entries = getPrimaryHotbarEntries(hero);
  const entry = entries.find((entry) => entry.id === selected) ?? null;
  const reason = primaryHotbarAssignmentReason(hero, entry);
  const current = resolvePrimaryHotbarEntry(
    hero,
    hotbarAssignment(hero, index),
  );
  return (
    <div className="primary-editor">
      <div className="primary-editor-heading">
        <label htmlFor="primary-target-slot">
          Slot tujuan
          <Select
            value={String(index)}
            onValueChange={(value) =>
              onIndexChange(isQuickHotbarId(value) ? value : Number(value))
            }
          >
            <SelectTrigger id="primary-target-slot" aria-label="Slot tujuan">
              <SelectValue>
                Slot {keyLabel(index)} · <JobText>{current?.name ?? 'Kosong'}</JobText>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {hotbarSlots.map((i) => (
                <SelectItem key={i} value={String(i)}>
                  Slot {keyLabel(i)} ·{' '}
                  <JobText>{resolvePrimaryHotbarEntry(hero, hotbarAssignment(hero, i))
                    ?.name ?? 'Kosong'}</JobText>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <button
          className="secondary-button"
          disabled={!game?.hotbarEditMode}
          onClick={() => {
            game?.resetHotbarLayouts();
            resetUILayoutEntries(
              ['primary-hotbar', 'quick-hotbar-q', 'quick-hotbar-e'],
              window.localStorage,
            );
            window.dispatchEvent(new Event(UI_LAYOUT_RESET_EVENT));
          }}
        >
          <RotateCcw size={16} /> Reset Layout
        </button>
      </div>
      <p>
        Slot {keyLabel(index)}: <strong><JobText>{current?.name ?? 'Kosong'}</JobText></strong>.
        Pilih skill atau item di bawah. Assignment hanya referensi, bukan
        salinan item.
      </p>
      <div className="primary-entry-list">
        {entries.map((entry) => {
          const unavailable = primaryHotbarAssignmentReason(hero, entry);
          return (
            <button
              type="button"
              className={selected === entry.id ? 'selected' : ''}
              aria-pressed={selected === entry.id}
              key={entry.id}
              onClick={() => setSelected(entry.id)}
            >
              <HotbarIcon entry={entry} />
              <span>
                <strong><JobText>{entry.name}</JobText></strong>
                <small>
                  {entry.kind === 'skill'
                    ? `Active · Lv.${hero.skillLevels[entry.id] ?? 0}`
                    : entry.kind === 'item'
                      ? `Inventory · ${entry.quantity}`
                      : 'Aksi combat'}
                  {unavailable ? ` · ${unavailable}` : ''}
                </small>
              </span>
              {unavailable && <LockKeyhole size={15} />}
            </button>
          );
        })}
      </div>
      {entry && (
        <div className="primary-entry-detail">
          <strong><JobText>{entry.name}</JobText></strong>
          <p><JobText>{entry.description}</JobText></p>
          {reason && <p className="primary-reason">{reason}</p>}
        </div>
      )}
      <div className="primary-editor-actions">
        <button
          className="primary-button"
          disabled={!entry || !!reason || !game?.hotbarEditMode}
          onClick={() =>
            entry &&
            (isQuickHotbarId(index)
              ? game?.assignQuickHotbarSlot(index, entry.id)
              : game?.assignPrimaryHotbarSlot(index, entry.id))
          }
        >
          Pasang ke Slot {keyLabel(index)}
        </button>
        <button
          className="secondary-button"
          disabled={!hotbarAssignment(hero, index) || !game?.hotbarEditMode}
          onClick={() =>
            isQuickHotbarId(index)
              ? game?.removeQuickHotbarSlot(index)
              : game?.removePrimaryHotbarSlot(index)
          }
        >
          Kosongkan Slot
        </button>
      </div>
      {!!hero.primaryHotbarOverflow.length && (
        <details>
          <summary>
            Assignment lama tersimpan ({hero.primaryHotbarOverflow.length})
          </summary>
          <p>
            Assignment yang belum muat atau belum tersedia tetap disimpan. Item
            asli tetap berada di inventory.
          </p>
          <ul>
            {hero.primaryHotbarOverflow.map((id) => (
              <li key={id}>
                <JobText>{resolvePrimaryHotbarEntry(hero, id)?.name ?? id}</JobText>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
