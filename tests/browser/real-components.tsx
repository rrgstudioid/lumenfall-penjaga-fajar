// Development-only harness. Real components/CSS/domain functions; no player save access.
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GameDragDropProvider } from '../../components/game/drag-drop-provider';
import { PrimaryHotbar } from '../../components/game/primary-hotbar';
import { InventoryGrid } from '../../components/game/inventory-grid';
import { JobSkill } from '../../components/game/job-skill';
import { DraggableDialogContent } from '../../components/game/draggable-window';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  commitDrop,
  type DragSource,
  type DropTarget,
} from '../../lib/game/drag-drop';
import {
  freshHero,
  createItem,
  consumeInventoryItem,
  learnSkill,
  activeSkills,
  skillCosts,
  isSkillUnlocked,
  parseSave,
} from '../../lib/game/rules';
import {
  resolvePrimaryHotbarEntry,
  hotbarAssignment,
  primaryHotbarKeyIndex,
  quickHotbarKey,
  resetHotbarLayouts,
  type HotbarSlot,
  type QuickHotbarId,
  type HotbarLayout,
} from '../../lib/game/hotbar';
import { DEFAULT_AUDIO_SETTINGS } from '../../lib/game/bgm';
import type { Game, Snapshot } from '../../lib/game/world';
import '../../app/globals.css';
import '../../app/character-panels.css';
import '../../app/primary-hotbar.css';
import '../../app/drag-drop.css';

function newHero() {
  const hero = freshHero();
  hero.slotId = 'drag-regression-only';
  hero.level = 4;
  hero.skillPoints = 1;
  hero.mana = 0;
  hero.inventory = [
    createItem('mana-potion-1', { quantity: 3 }),
    ...hero.inventory,
  ];
  return hero;
}
function Harness() {
  const [, refresh] = useState(0);
  const [panel, setPanel] = useState('');
  const [selected, select] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [host] = useState(() => ({
    hero: newHero(),
    started: true,
    dead: false,
    blocked: false,
    cameraMode: 'follow', hotbarEditMode: false,
    commits: 0,
    uses: 0,
    clock: 10000,
    notice: '',
    resetFixture() {
      this.hero = newHero();
      this.commits = this.uses = 0;
      this.hotbarEditMode = false;
      this.emit();
    },
    restoreFixture(value: string) {
      const restored = parseSave(value);
      if (restored) this.hero = restored;
      this.emit();
    },
    emit() {
      refresh((n) => n + 1);
    },
    message(text: string) {
      this.notice = text;
      this.emit();
    },
    setHotbarInteraction(value: boolean) {
      this.blocked = value;
    },
    commitUIDrop(source: DragSource, target: DropTarget) {
      const result = commitDrop(this.hero, source, target, this.hotbarEditMode);
      if (result.ok) {
        this.hero = result.hero;
        this.commits++;
      }
      this.message(result.reason);
      return result.ok;
    },
    activatePrimaryHotbarSlot(index: HotbarSlot) {
      if (this.blocked || this.hotbarEditMode) return;
      const entry = resolvePrimaryHotbarEntry(
        this.hero,
        hotbarAssignment(this.hero, index),
      );
      const item = this.hero.inventory.find((i) => i.templateId === entry?.id);
      if (item) {
        const result = consumeInventoryItem(this.hero, item.id, this.clock);
        if (result.ok) this.uses++;
        this.message(result.reason);
      }
    },
    spendMana() {
      this.hero = { ...this.hero, mana: 0 };
      this.emit();
    },
    advanceTime() {
      this.clock += 5000;
      this.emit();
    },
    setHotbarEditMode(value: boolean) {
      this.hotbarEditMode = value;
      this.emit();
    },
    activateQuickHotbarSlot(id: QuickHotbarId) {
      this.activatePrimaryHotbarSlot(id);
    },
    saveQuickHotbarLayout(id: QuickHotbarId, position: HotbarLayout) {
      this.hero = {
        ...this.hero,
        quickHotbars: {
          ...this.hero.quickHotbars,
          [id]: { ...this.hero.quickHotbars[id], position },
        },
      };
      this.emit();
    },
    resetHotbarLayouts() {
      this.hero = resetHotbarLayouts(this.hero);
      this.emit();
    },
    learnSkill(id: string) {
      learnSkill(this.hero, id);
      this.emit();
    },
    savePrimaryHotbarLayout(layout: { x: number; y: number } | null) {
      this.hero = { ...this.hero, primaryHotbarLayout: layout };
      this.emit();
    },
  }));
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (event.code === 'KeyK' && !event.repeat) {
        setPanel((previous) => previous === 'jobSkill' ? '' : 'jobSkill');
        return;
      }
      if (panel) return;
      const quick = quickHotbarKey(event),
        index = primaryHotbarKeyIndex(event);
      if (quick) host.activateQuickHotbarSlot(quick);
      else if (index >= 0) host.activatePrimaryHotbarSlot(index);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [host, panel]);
  const hero = host.hero;
  const state: Snapshot = {
    cameraMode: 'follow', hotbarEditMode: host.hotbarEditMode,
    hero,
    started: true,
    paused: !!panel,
    dead: false,
    stamina: 100,
    cooldown: 0,
    notice: host.notice,
    noticeId: host.commits,
    saved: true,
    nearShrine: true,
    enemies: [],
    bossActive: false,
    bossRespawn: 0,
    bossName: '',
    combo: 0,
    mana: hero.mana,
    maxMana: 100,
    manaName: 'Mana',
    skillPoints: hero.skillPoints,
    skillViews: activeSkills(hero).map((skill) => ({
      ...skill,
      ...skillCosts(hero, skill),
      remaining: 0,
      level: hero.skillLevels[skill.id] ?? 0,
      unlocked: isSkillUnlocked(hero, skill),
    })),
    classQuest: '',
    cityName: 'Kota Arunika',
    fieldName: '',
    recommendedLevel: '',
    mapId: 'arunika',
    inCity: true,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    bgmStatus: 'idle',
    hotbarRuntime: {
      attackRemaining: 0,
      itemCooldowns: Object.fromEntries(
        Object.entries(hero.itemCooldowns).map(([id, until]) => [
          id,
          Math.max(0, (until - host.clock) / 1000),
        ]),
      ),
      lastUsedIndex: -1,
      useSequence: 0,
    },
  };
  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 100,
          display: 'flex',
          gap: 12,
        }}
      >
        <button onClick={() => setPanel('jobSkill')}>Test Job Skill</button>
        <button onClick={() => setPanel('inventory')}>Test Inventory</button>
        <button onClick={() => host.setHotbarEditMode(!host.hotbarEditMode)}>
          Edit Mode
        </button>
        <button onClick={() => host.resetHotbarLayouts()}>Reset Layout</button>
        <button onClick={() => host.spendMana()}>Spend Mana</button>
        <button onClick={() => host.advanceTime()}>Advance cooldown</button>
        <input aria-label="Typing test" style={{ width: 80 }} />
        <button onClick={() => host.resetFixture()}>Reset fixture</button>
        <button onClick={() => setSaved(JSON.stringify(hero))}>
          Snapshot fixture
        </button>
        <button disabled={!saved} onClick={() => host.restoreFixture(saved)}>
          Restore fixture
        </button>
      </nav>
      <GameDragDropProvider game={host as unknown as Game}>
        <Dialog
          open={!!panel}
          modal={false}
          disablePointerDismissal
          onOpenChange={(open) => !open && setPanel('')}
        >
          <DraggableDialogContent
            windowId={`test-${panel}`}
            className={`game-dialog binding-window ${panel === 'jobSkill' ? 'job-skill-dialog' : ''}`}
          >
            <DialogTitle className="dialog-heading">
              {panel === 'jobSkill' ? 'Job Skill' : 'Inventory'}
            </DialogTitle>
            <DialogDescription>
              Isolated test data — never your character save.
            </DialogDescription>
            {panel === 'jobSkill' ? (
              <JobSkill
                hero={hero}
                game={host as unknown as Game}
                onMark={() => {}}
              />
            ) : (
              <InventoryGrid
                hero={hero}
                filter="all"
                sort="manual"
                selectedId={selected}
                onSelect={select}
              />
            )}
          </DraggableDialogContent>
        </Dialog>
        <PrimaryHotbar
          state={state}
          game={host as unknown as Game}
          active={!panel}
          bindingEnabled={!!panel}
          onEdit={() => {}}
        />
        {(['q', 'e'] as const).map((quickId) => (
          <PrimaryHotbar
            key={quickId}
            quickId={quickId}
            state={state}
            game={host as unknown as Game}
            active={!panel}
            bindingEnabled={!!panel}
            onEdit={() => {}}
          />
        ))}
      </GameDragDropProvider>
      <div
        data-world-surface
        style={{ position: 'fixed', inset: '55px 0 200px', zIndex: -1 }}
      >
        Empty background
      </div>
      <output
        data-test-summary
        style={{
          position: 'fixed',
          top: 48,
          left: 8,
          zIndex: 90,
          pointerEvents: 'none',
        }}
      >
        Commits {host.commits} · Uses {host.uses} · {host.notice}
      </output>
      <pre
        data-test-state
        style={{
          position: 'fixed',
          left: 8,
          top: 78,
          maxWidth: 180,
          maxHeight: 300,
          overflow: 'auto',
          fontSize: 10,
        }}
      >
        {JSON.stringify({
          hero,
          commits: host.commits,
          uses: host.uses,
          selected,
        })}
      </pre>
    </>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Harness />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
