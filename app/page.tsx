'use client';

import { useEffect, useRef, useState } from 'react';
import { isResourceEnabled } from '@/lib/game/gameplay-config';
import { getVisibleJobArchitecture, presentJobText } from '@/lib/game/job-presentation';
import { JobArchitecturePreview } from '@/components/game/job-architecture-preview';
import { V3JobTrainer } from '@/components/game/v3-job-trainer';
import { JobPresentationContext, JobText } from '@/components/game/job-presentation-context';
import { createPortal } from 'react-dom';
import './character-panels.css';
import './primary-hotbar.css';
import type { HotbarSlot } from '@/lib/game/hotbar';
import './drag-drop.css';
import './interface-scale.css';
import './forge-panel.css';
import './character-screen.css';
import './menu-presentation.css';
import { MenuPresentation, type MenuFlow, type SelectionMode } from '@/components/game/menu-presentation';
import { RuneForgePanel } from '@/components/game/rune-forge-panel';
import { RuneDetails } from '@/components/game/rune-details';
import { ForgePanel } from '@/components/game/forge-panel';
import { InterfaceSettings, InterfaceSettingsRuntime } from '@/components/game/interface-settings';
import { GameDragDropProvider, HotbarLayer } from '@/components/game/drag-drop-provider';
import { InventoryGrid } from '@/components/game/inventory-grid';
import { InventoryCombatPowerPreview } from '@/components/game/combat-power-preview';
import {
  PrimaryHotbar,
  PrimaryHotbarEditor,
} from '@/components/game/primary-hotbar';
import {
  Sun,
  Sword,
  Sparkles,
  FlaskConical,
  Coins,
  Backpack,
  ScrollText,
  Settings2,
  Volume2,
  VolumeX,
  Compass,
  ArrowUpRight,
  ChevronRight,
  Leaf,
  Heart,
  Trash2,
  LockKeyhole,
  Crown,
  Zap,
  Crosshair,
  X,
  Hammer,
  Gem,
  Move,
  ArrowLeftRight,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Camera,
  Orbit,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { DEFAULT_AUDIO_SETTINGS, loadAudioSettings, saveAudioSettings } from '@/lib/game/bgm';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  derivedStats,
  itemStats,
  characterLabel,
  freshHero,
  emptyEquipment,
  RUNE_OPTIMIZER_CRAFT_RECIPES,
  listCharacters,
  getLastPlayedCharacter,
  createNewCharacter,
  saveCharacter,
  deleteCharacter,
  isCompatibleCharacterSave,
  DEFAULT_APPEARANCE,
  normalizeCharacterName,
  validateCharacterName,
  maxHP,
  SPECIALIZATIONS,
  xpNeeded,
  type CharacterSlot,
  type CharacterAppearance,
  type CoreJobId,
  type ItemData,
  type MasteryChoice,
  type SpecializationId,
} from '@/lib/game/rules';
import {
  ITEM_CATALOG,
  RARITY_META,
  equipmentUsageDescription,
  type InventorySort,
} from '@/lib/game/items';
import { CharacterOverview, StatBlockList } from '@/components/game/character-overview';
import {
  DraggableAlertDialogContent,
  DraggableDialogContent,
  DraggableOverlay,
} from '@/components/game/draggable-window';
import { JobSkill } from '@/components/game/job-skill';
import { SkillIcon } from '@/components/game/skill-icon';
import { ItemIcon } from '@/components/game/entry-icon';
import { ItemHover } from '@/components/game/item-hover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Game, Snapshot } from '@/lib/game/world';
import { registerGameTools } from '@/lib/game/webmcp';
import { useBrowserInteractionGuard } from '@/hooks/use-browser-interaction-guard';
import {
  CITIES,
  FIELDS,
  FIELD_NPCS,
  getNpcServiceLabel,
  getNpcDescription,
  getAllQuestJournalEntries,
  getQuestRequirements,
  regionQuestStatus,
  unlockReason,
  type NpcDefinition,
  type QuestJournalEntry,
} from '@/lib/game/regions';
import { fieldShopStock, shopItemPrice, shopStock } from '@/lib/game/city-services';

const initial: Snapshot = {
  cameraMode: 'free',
  audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
  bgmStatus: 'idle',
  hotbarRuntime: {
    attackRemaining: 0,
    itemCooldowns: {},
    lastUsedIndex: -1,
    useSequence: 0,
  },
  hero: freshHero(),
  started: false,
  paused: false,
  dead: false,
  stamina: 100,
  cooldown: 0,
  notice: '',
  noticeId: 0,
  saved: true,
  nearShrine: false,
  enemies: [],
  bossActive: false,
  bossRespawn: 0,
  bossName: 'Field Boss',
  combo: 0,
  mana: 100,
  maxMana: 100,
  manaName: 'Mana',
  skillPoints: 0,
  skillViews: [],
  classQuest: 'Level 1/10 · Latih diri sebagai Adventurer',
  cityName: 'Kota Arunika',
  fieldName: 'Padang Arunika',
  recommendedLevel: '1–8',
  mapId: 'arunika',
  inCity: true,
};

const panelTitles: Record<string, string> = {
  pause: 'System Menu',
  bag: 'Perbekalan perjalanan',
  forge: 'Tempa / Enhance',
  character: 'Character',
  jobSkill: 'Job Skill',
  quest: 'Jurnal petualangan',
  map: 'Peta dunia & teleportasi',
  help: 'Bekal seorang penjaga',
  hotbar: 'Atur PrimaryHotbar',
  class: 'Jalur job Nusantara',
};
type PauseMenuView = 'main' | 'options' | 'audio' | 'graphics' | 'hotkey';
const defaultCreationAppearance: CharacterAppearance = { ...DEFAULT_APPEARANCE };
const questStatusLabel = (status: string) =>
  status === 'ready_to_complete'
    ? 'Siap diselesaikan'
    : status === 'completed'
      ? 'Selesai'
      : status === 'cooldown'
        ? 'Cooldown'
        : status === 'locked'
          ? 'Terkunci'
          : status === 'active'
            ? 'Aktif'
            : 'Tersedia';
const questCategoryLabel = (category: QuestJournalEntry['category']) =>
  category === 'main'
    ? 'Quest Utama'
    : category === 'class'
      ? 'Class/Job Quest'
      : category === 'daily'
        ? 'Daily Quest'
        : 'Side Quest';

export default function Home() {
  useBrowserInteractionGuard();

  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    map = useRef<HTMLCanvasElement>(null),
    game = useRef<Game | null>(null);
  const [state, setState] = useState(initial),
    [engine, setEngine] = useState<Game | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [panel, setPanel] = useState(''),
    [roster, setRoster] = useState<CharacterSlot[]>([]),
    [selectedSlot, setSelectedSlot] = useState('slot-1'),
    [loadingSlot, setLoadingSlot] = useState<string | null>(null),
    [flow, setFlow] = useState<MenuFlow>('main'),
    [selectionMode, setSelectionMode] = useState<SelectionMode>('new'),
    [creationName, setCreationName] = useState(''),
    [creationArchitecture, setCreationArchitecture] = useState<'v3_adventurer'>('v3_adventurer'),
    [creationAppearance, setCreationAppearance] = useState<CharacterAppearance>({ ...defaultCreationAppearance }),
    [creationError, setCreationError] = useState(''),
    [quitConfirmOpen, setQuitConfirmOpen] = useState(false),
    [lastPlayedCharacterId, setLastPlayedCharacterId] = useState<string | null>(null),
    [deleteTarget, setDeleteTarget] = useState<CharacterSlot | null>(null),
    [inventorySort, setInventorySort] = useState<InventorySort>('manual'),
    [selectedItemId, setSelectedItemId] = useState<string | null>(null),
    [hoveredItemId, setHoveredItemId] = useState<string | null>(null),
    [hoveredItemPosition, setHoveredItemPosition] = useState<{ x: number; y: number } | null>(null),
    [hotbarEditSlot, setHotbarEditSlot] = useState<HotbarSlot>(0),
    [discardTarget, setDiscardTarget] = useState<ItemData | null>(null),
    [equipConfirmTarget, setEquipConfirmTarget] = useState<ItemData | null>(
      null,
    ),
    [currentNpc, setCurrentNpc] = useState<NpcDefinition | null>(null),
    [activeNpcMenu, setActiveNpcMenu] = useState(false),
    [npcInteractionMode, setNpcInteractionMode] = useState(false),
    [shopMode, setShopMode] = useState<'buy' | 'sell'>('buy'),
    [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({}),
    [selectedSellItemId, setSelectedSellItemId] = useState<string | null>(null),
    [sellQuantity, setSellQuantity] = useState(1),
    [storageQuantities, setStorageQuantities] = useState<Record<string, number>>({}),
    [sellConfirmOpen, setSellConfirmOpen] = useState(false),
    [questClock, setQuestClock] = useState(0),
    [questFilter, setQuestFilter] = useState<
      'all' | 'active' | 'ready_to_complete' | 'locked' | 'completed' | 'class'
    >('all'),
    [selectedQuestId, setSelectedQuestId] = useState<string | null>(null),
    [questMarkerId, setQuestMarkerId] = useState<string | null>(null),
    [forgeTab, setForgeTab] = useState<'main' | 'rune-menu' | 'enhance' | 'rune' | 'crafting'>('main'),
    [pauseMenuView, setPauseMenuView] = useState<PauseMenuView>('main'),
    [isFullscreen, setIsFullscreen] = useState(false),
    [characterSelectionConfirmOpen, setCharacterSelectionConfirmOpen] = useState(false);

  const refreshRoster = () => {
    const next = listCharacters();
    setRoster(next);
    setLastPlayedCharacterId(getLastPlayedCharacter()?.characterId ?? null);
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  /* oxlint-disable react/react-compiler -- startup synchronization hydrates the game UI from browser storage. */
  useEffect(() => {
    refreshRoster();
    try { setState(previous => ({ ...previous, audioSettings: loadAudioSettings(window.localStorage) })); } catch { /* Device storage may be disabled. */ }
    setReady(true);
  }, []);
  /* oxlint-enable react/react-compiler */

  /* oxlint-disable react/react-compiler -- panel state must reset when its owner closes. */
  useEffect(() => {
    if (!loadingSlot) return;
    let cancelled = false;
    let instance: Game | null = null;
    import('@/lib/game/world')
      .then(async ({ Game }) => {
        if (cancelled || !host.current || !labels.current || !map.current)
          return;
        try {
          instance = new Game(
            host.current,
            labels.current,
            map.current,
            (snapshot) => {
              if (cancelled) return;
              setState(snapshot);
              if (!snapshot.forgeNpcId) setPanel(previous => previous === 'forge' ? '' : previous);
            },
            () => setPanel((p) => (p ? '' : 'pause')),
            loadingSlot,
          );
          game.current = instance;
          await instance.prepareWorld();
          if (cancelled) return;
          instance.start();
          setEngine(instance);
          setFlow('world');
          refreshRoster();
        } catch (cause) {
          if (cancelled) return;
          console.error(cause);
          setError(
            'Dunia belum dapat dimuat. Save tetap aman. Periksa koneksi dan WebGL, lalu coba Continue atau Load Game lagi.',
          );
          setLoadingSlot(null);
          setFlow('main');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError('Ada berkas yang belum termuat. Periksa koneksi lalu coba lagi.');
        setLoadingSlot(null);
        setFlow('main');
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      if (game.current === instance) game.current = null;
      setEngine(null);
    };
  }, [loadingSlot]);
  useEffect(() => {
    if (flow !== 'world') return;
    const updateClock = () => setQuestClock(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [flow]);
  useEffect(() => {
    // Restore the classic single-player pause behavior for every gameplay
    // panel, including NPC and Forge windows.  The pause menu opened from a
    // window blur is already paused by Game.blur(); this effect keeps all
    // other open/close paths in sync without creating a second pause system.
    const currentGame = game.current;
    const shouldPause = Boolean(panel || activeNpcMenu);
    if (currentGame?.started && currentGame.paused !== shouldPause)
      currentGame.pause(shouldPause);
    if (panel !== 'forge') currentGame?.closeForge();
  }, [panel, activeNpcMenu]);
  useEffect(() => {
    const onInventoryLayoutChanged = () => setInventorySort('manual');
    window.addEventListener('lumenfall:inventory-layout-changed', onInventoryLayoutChanged);
    return () => window.removeEventListener('lumenfall:inventory-layout-changed', onInventoryLayoutChanged);
  }, []);
  useEffect(() => {
    if (panel !== 'pause') setPauseMenuView('main');
  }, [panel]);
  useEffect(() => {
    // The inventory grid can unmount without firing pointerleave. Clear the
    // page-level tooltip state whenever the inventory is no longer visible so
    // its body portal cannot survive closing the panel with I or Escape.
    if (panel !== 'bag') {
      setHoveredItemId(null);
      setHoveredItemPosition(null);
    }
  }, [panel]);
  /* oxlint-enable react/react-compiler */
  useEffect(() => {
    const openNpcMenu = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const npc =
        Object.values(CITIES)
          .flatMap((city) => city.npcList)
          .find((entry) => entry.id === id) ??
        Object.values(FIELD_NPCS).find((entry) => entry.id === id) ??
        null;
      if (!npc) return;

      // Forge Master opens the forge choice directly.  Keep the NPC service
      // dialog out of this flow so the first screen is Enhancement / Rune Forge.
      if (npc.service === 'forge' && npc.services.includes('forge')) {
        if (!game.current?.openForge()) return;
        setCurrentNpc(null);
        setActiveNpcMenu(false);
        setNpcInteractionMode(false);
        setForgeTab('main');
        setPanel('forge');
        return;
      }
      setCurrentNpc(npc);
      setActiveNpcMenu(true);
      setNpcInteractionMode(true);
      setShopMode(npc.services.includes('buy') ? 'buy' : 'sell');
      setSelectedSellItemId(null);
      setSellQuantity(1);
    };
    window.addEventListener('lumenfall:npc', openNpcMenu);
    return () => window.removeEventListener('lumenfall:npc', openNpcMenu);
  }, []);
  useEffect(
    () =>
      registerGameTools(
        () => game.current,
        () => setPanel(''),
      ),
    [],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.body.hasAttribute('data-game-drag-pending')) return;
      // Close the currently visible gameplay panel with Escape. Confirmation
      // dialogs keep priority so Escape can cancel only that confirmation.
      if (event.key === 'Escape' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (document.querySelector('[role="alertdialog"]')) return;
        if (panel || activeNpcMenu) {
          event.preventDefault();
          event.stopImmediatePropagation();
          game.current?.closeNpcMenu();
          setActiveNpcMenu(false);
          setNpcInteractionMode(false);
          setCurrentNpc(null);
          setPanel('');
          return;
        }
      }
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !game.current?.started
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          'input,textarea,select,[contenteditable="true"],[role="alertdialog"]',
        )
      )
        return;
      // Confirmation/optimizer dialogs have priority; a menu hotkey never dismisses a pending transaction.
      if (
        document.querySelector('[role="alertdialog"]')
      )
        return;
      const menus: Record<string, string> = {
        i: 'bag',
        c: 'character',
        j: 'quest',
        k: 'jobSkill',
        m: 'map',
        h: 'help',
      };
      const next = menus[event.key.toLowerCase()];
      if (!next) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      game.current.closeNpcMenu();
      setActiveNpcMenu(false);
      setNpcInteractionMode(false);
      setCurrentNpc(null);
      setPanel((previous) => (previous === next ? '' : next));
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [activeNpcMenu, panel]);


  const hero = state.hero,
    hp = maxHP(hero),
    derived = derivedStats(hero),
    selectedCharacter =
      roster.find((slot) => slot.id === selectedSlot)?.hero ?? null,
    active =
      state.started &&
      !state.dead &&
      !activeNpcMenu,
    boss = state.enemies.find(
      (e) => e.boss && e.hp > 0 && Math.hypot(e.x - hero.x, e.z - hero.z) < 20,
    ),
    open = (next: string) => setPanel(next),
    act = (action: 'attack' | 'potion' | 'heal') =>
      game.current?.action(action);

  const selectedItem = selectedItemId
      ? (hero.inventory.find((item) => item.id === selectedItemId) ?? null)
      : null,
    hoveredItem = hoveredItemId
      ? (hero.inventory.find((item) => item.id === hoveredItemId) ?? null)
      : null,
    questEntries = getAllQuestJournalEntries(hero, questClock),
    filteredQuestEntries = questEntries.filter(
      (entry) =>
        questFilter === 'all' ||
        (questFilter === 'class'
          ? entry.category === 'class'
          : entry.status === questFilter),
    ),
    equippedForSelected = selectedItem?.equipSlot
      ? (hero.inventory.find(
          (item) =>
            Object.values(hero.equipment).includes(item.id) &&
            item.equipSlot === selectedItem.equipSlot,
        ) ?? null)
      : null;
  const activeJournalQuest =
    questEntries.find(
      (entry) =>
        entry.status === 'ready_to_complete' || entry.status === 'active',
    ) ?? null;
  const npcShopItems = currentNpc
      ? currentNpc.fieldId
        ? fieldShopStock(currentNpc.fieldId)
        : shopStock(hero, currentNpc.service)
      : [],
    selectedSellItem = selectedSellItemId
      ? (hero.inventory.find((item) => item.id === selectedSellItemId) ?? null)
      : null,
    npcQuestEntries = currentNpc?.services.includes('quest')
      ? questEntries.filter(
          (entry) =>
            entry.giverNpcId === currentNpc.id &&
            entry.status !== 'completed' &&
            entry.status !== 'cooldown',
        )
      : [];
  const hasCharacters = roster.some(slot => Boolean(slot.hero && isCompatibleCharacterSave(slot.hero)));
  const canContinue = Boolean(lastPlayedCharacterId && roster.some(slot => slot.hero?.characterId === lastPlayedCharacterId && isCompatibleCharacterSave(slot.hero)));
  const previewHero = selectedCharacter ?? {
    ...freshHero(selectedSlot),
    // Creation presents the body only. Starting equipment is still granted by createNewCharacter.
    equipment: emptyEquipment(),
    characterName: creationName || 'Preview Character',
    gender: creationAppearance.gender,
    appearance: creationAppearance,
  };

  const chooseSlot = (slotId: string) => {
    setSelectedSlot(slotId);
    setCreationError('');
    const chosen = roster.find(slot => slot.id === slotId)?.hero;
    if (!chosen && selectionMode === 'new') {
      setCreationName('');
      setCreationAppearance({ ...defaultCreationAppearance });
      setFlow('creation');
    }
  };
  const startSelectedCharacter = () => {
    const selected = roster.find(slot => slot.id === selectedSlot)?.hero;
    if (!isCompatibleCharacterSave(selected)) {
      setError('Karakter ini dibuat dengan development build lama dan sudah tidak kompatibel. Buat karakter baru.');
      setFlow('selection');
      setSelectionMode('load');
      return;
    }
    setError('');
    setFlow('loading');
    setLoadingSlot(selectedSlot);
  };
  const beginAdventure = () => {
    if (flow === 'creation') {
      const errorMessage = validateCharacterName(creationName);
      if (errorMessage) {
        setCreationError(errorMessage);
        return;
      }
      if (listCharacters().find(slot => slot.id === selectedSlot)?.hero) {
        setCreationError('Karakter belum dapat dibuat. Pilih slot kosong dan coba lagi.');
        return;
      }
      try {
        saveCharacter(createNewCharacter(selectedSlot, normalizeCharacterName(creationName), creationAppearance, creationArchitecture), true);
      } catch {
        setCreationError('Penyimpanan browser tidak tersedia atau penuh. Karakter belum disimpan.');
        return;
      }
      refreshRoster();
      startSelectedCharacter();
      return;
    }
    if (flow === 'selection' && selectionMode === 'load' && selectedCharacter) {
      startSelectedCharacter();
    }
  };
  const continueAdventure = () => {
    const last = roster.find(slot => slot.hero?.characterId === lastPlayedCharacterId && slot.hero);
    if (!last || !isCompatibleCharacterSave(last.hero)) {
      setError('Save terakhir adalah development build lama dan sudah tidak kompatibel. Buat karakter baru.');
      setFlow('selection');
      setSelectionMode('load');
      return;
    }
    setSelectedSlot(last.id);
    setError('');
    setFlow('loading');
    setLoadingSlot(last.id);
  };
  const openNewGame = () => {
    setSelectionMode('new');
    setCreationError('');
    const empty = roster.find(slot => !slot.hero)?.id ?? 'slot-1';
    setSelectedSlot(empty);
    setFlow('selection');
  };
  const openLoadGame = () => {
    if (!roster.some(slot => slot.hero)) return;
    setSelectionMode('load');
    setCreationError('');
    const first = roster.find(slot => slot.hero)?.id ?? 'slot-1';
    setSelectedSlot(first);
    setFlow('selection');
  };
  const returnToMainMenu = () => {
    game.current?.returnToMainMenu();
    setLoadingSlot(null);
    setEngine(null);
    setPanel('');
    setFlow('main');
    refreshRoster();
  };
  const toggleSound = () => {
    if (game.current) {
      game.current.setAudioSettings({ muted: !game.current.muted });
      if (!game.current.muted) game.current.sound(440, 0.14);
    } else {
      const audioSettings = { ...state.audioSettings, muted: !state.audioSettings.muted };
      try { saveAudioSettings(audioSettings, window.localStorage); } catch { /* Keep session preference. */ }
      setState(previous => ({ ...previous, audioSettings }));
    }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be denied by browser policy or unavailable in the current context.
    }
  };
  const muted = state.audioSettings.muted;
  const visibleJobs = getVisibleJobArchitecture(hero);
  const specialChoices = visibleJobs.specializationChoices.filter(
    (choice): choice is [string, (typeof SPECIALIZATIONS)[SpecializationId]] => Array.isArray(choice),
  );
  const openClassPanel = () => {
    open('character');
  };
  const closeNpcMenu = () => {
    setActiveNpcMenu(false);
    setNpcInteractionMode(false);
    setCurrentNpc(null);
    setSelectedSellItemId(null);
    setSellConfirmOpen(false);
    game.current?.closeNpcMenu();
  };
  // Each service keeps its own saved size/position using the same resize system.
  const resizableNpcWindowId = currentNpc?.service === 'consumable' ? 'general-merchant'
    : currentNpc?.service === 'storage' ? 'storage-keeper'
    : currentNpc?.service === 'equipment' ? 'equipment-merchant' : null;
  const isResizableNpc = resizableNpcWindowId !== null;

  return (
    <JobPresentationContext.Provider value={hero}><GameDragDropProvider game={engine}>
    <main className={`game-shell ${flow === 'world' ? 'in-world' : 'menu-mode'} flow-${flow}`}>
      <InterfaceSettingsRuntime />
      <div ref={host} className="world" data-world-surface />
      <div className="vignette" />
      <div ref={labels} className="world-labels" aria-hidden="true" />
      <header className="topbar">
        <div className="brand">
          <Sun size={31} strokeWidth={1.2} />
          <div>
            LUMENFALL<small>PENJAGA FAJAR</small>
          </div>
        </div>
        <div className="location">
          <span className="eyebrow">THE FIRST LIGHT</span>
          <h1>{state.inCity ? state.cityName : state.fieldName}</h1>
          <p>
            <span /> {state.inCity ? 'Kota aman' : state.cityName} <b>·</b> Lv.{' '}
            {state.recommendedLevel}
          </p>
        </div>
        <div className="top-tools">
          <span className="solo">
            <i /> SOLO ADVENTURE
          </span>
          <button
            className="icon-button"
            aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
            onClick={toggleSound}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Pengaturan dan jeda"
            onClick={() => open('pause')}
          >
            <Settings2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={isFullscreen ? 'Keluar dari fullscreen' : 'Aktifkan fullscreen'}
            title={isFullscreen ? 'Keluar dari fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            className="icon-button camera-mode-button"
            aria-label={`Kamera ${state.cameraMode === 'free' ? 'Free' : 'Follow'} aktif. Ganti ke ${state.cameraMode === 'free' ? 'Follow' : 'Free'} Camera`}
            aria-pressed={state.cameraMode === 'follow'}
            title={state.cameraMode === 'free' ? 'Free Camera · klik untuk Follow Camera' : 'Follow Camera · klik untuk Free Camera'}
            disabled={!ready}
            onClick={() => game.current?.setCameraMode(game.current.cameraMode === 'free' ? 'follow' : 'free')}
          >
            {state.cameraMode === 'free' ? <Orbit size={18} /> : <Camera size={18} />}
            <span>{state.cameraMode === 'free' ? 'Free' : 'Follow'}</span>
          </button>
        </div>
      </header>
      <DraggableOverlay
        windowId="hud-character"
        className="player-card glass"
        aria-label="Status karakter"
      >
        <button
          className="portrait"
          aria-label="Lihat karakter"
          onClick={() => open('character')}
        >
          <Sword size={28} />
          <span>{hero.level}</span>
        </button>
        <div className="player-stats">
          <div className="player-name" data-window-drag-handle>
            {hero.characterName}{' '}
            <small>{characterLabel(hero).toUpperCase()}</small>
          </div>
          <div className="bar-label">
            <Heart size={10} />
            <span>
              {Math.ceil(hero.hp)} <b>/ {hp}</b>
            </span>
          </div>
          <Progress
            className="hp-bar"
            value={(hero.hp / hp) * 100}
            aria-label="HP karakter"
          />
          <div className="resource-line">
            <Progress
              className="resource-bar"
              value={(state.mana / state.maxMana) * 100}
              aria-label={state.manaName}
            />
            <span>
              {state.manaName} {Math.floor(state.mana)}/{state.maxMana}
            </span>
          </div>
          {isResourceEnabled(hero, 'stamina') && <div className="stamina-line">
            <Progress
              className="stamina-bar"
              value={(state.stamina / derived.staminaMax) * 100}
              aria-label="Stamina"
            />
          </div>}
          {Object.keys(hero.statusEffects).length > 0 && (
            <div className="status-icons" aria-label="Status effect aktif">
              {Object.keys(hero.statusEffects).map((status) => (
                <span key={status} title={status === 'stealth' ? 'Stealth combat state — bukan jaminan tidak terdeteksi musuh.' : status} className={status === 'stealth' ? 'stealth-status-label' : undefined}>
                  {status === 'stealth' ? `STEALTH · ${Math.max(0,hero.statusEffects[status]).toFixed(1)}s` : status.slice(0, 3).toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </DraggableOverlay>
      {(state.combatFeedback?.indicators.length ?? 0) > 0 && (
        <div className="combat-feedback-strip" aria-label="Combat states">
          {state.combatFeedback?.indicators.map((indicator) => (
            <div
              className={`combat-feedback-indicator tone-${indicator.tone ?? 'offensive'}`}
              key={indicator.id}
              title={`${indicator.label}${indicator.remaining !== undefined ? ` · ${indicator.remaining.toFixed(1)}s` : ''}`}
            >
              {indicator.iconSkillId && <SkillIcon id={indicator.iconSkillId} size={20} />}
              <span className="combat-feedback-copy">
                <b>{indicator.label}</b>
                {indicator.stacks !== undefined && <small>{indicator.stacks} / {indicator.maxStacks ?? 3}</small>}
                {indicator.remaining !== undefined && <small>{indicator.remaining.toFixed(1)}s</small>}
              </span>
            </div>
          ))}
        </div>
      )}
      {state.combatFeedback?.event && (
        <output className={`combat-feedback-event event-${state.combatFeedback.event.tone}`}>
          {state.combatFeedback.event.label}
        </output>
      )}
      <DraggableOverlay
        windowId="hud-quest"
        className="quest-card"
        aria-label="Jurnal misi ringkas"
      >
        <div className="eyebrow" data-window-drag-handle>
          <span className="tiny-diamond" /> JURNAL MISI{' '}
          <span className="quest-index">01</span>
        </div>
        {activeJournalQuest ? (
          <>
            <div className="class-quest-mini">
              <ScrollText size={12} />{' '}
              {questStatusLabel(activeJournalQuest.status)}
            </div>
            <h2>{activeJournalQuest.title}</h2>
            <p>{activeJournalQuest.description}</p>
            <div className="quest-counter">
              <span>
                {activeJournalQuest.objectives
                  .map((objective) => objective.targetName)
                  .join(' · ')}
              </span>
              <strong>
                {activeJournalQuest.progress
                  .map(
                    (progress) => `${progress.current} / ${progress.required}`,
                  )
                  .join(' · ')}
              </strong>
            </div>
          </>
        ) : (
          <>
            <h2>Belum ada quest aktif.</h2>
            <p>
              Buka Jurnal Misi atau temui NPC quest untuk melihat misi yang
              tersedia.
            </p>
          </>
        )}
        <Progress
          className="quest-progress"
          value={
            activeJournalQuest?.progress.length
              ? Math.min(
                  (activeJournalQuest.progress[0].current /
                    activeJournalQuest.progress[0].required) *
                    100,
                  100,
                )
              : 0
          }
          aria-label="Progres misi"
        />
        <div className="reward">
          <span>
            <Sparkles size={12} /> {activeJournalQuest?.rewards.xp ?? 0} EXP
          </span>
          <span>
            <Coins size={12} /> {activeJournalQuest?.rewards.gold ?? 0} GOLD
          </span>
        </div>
        <div className="class-quest-mini">
          <Crown size={12} /> {state.classQuest}
        </div>
        <button className="text-button" onClick={() => open('quest')}>
          Buka jurnal <ChevronRight size={13} />
        </button>
      </DraggableOverlay>
      <aside className="map-panel">
        <button
          className="minimap"
          onClick={() => open('map')}
          aria-label="Buka peta"
        >
          <canvas ref={map} width={240} height={240} />
          <span className="north">N</span>
          <span className="map-compass">
            <Compass size={17} />
          </span>
          <kbd>M</kbd>
        </button>
        <div className="weather">
          <Sun size={13} />
          <span>Pagi yang tenang</span>
        </div>
        <div className="gold-counter">
          <Coins size={15} />
          {hero.gold.toLocaleString('id-ID')}
          <small>GOLD</small>
        </div>
      </aside>
      {boss && state.started && (
        <div className="boss-bar">
          <span>FIELD BOSS · LV. {boss.level}</span>
          <h2>{state.bossName}</h2>
          <Progress value={(boss.hp / boss.max) * 100} aria-label="HP boss" />
          <small>
            {Math.ceil(boss.hp)} / {boss.max}
          </small>
        </div>
      )}
      {!boss && state.started && !state.inCity && state.bossRespawn > 0 && (
        <div className="boss-bar boss-respawning">
          <span>FIELD BOSS RESPAWNING</span>
          <h2>{state.bossName}</h2>
          <small>Siap dalam {state.bossRespawn} detik</small>
        </div>
      )}
      {flow !== 'world' && <MenuPresentation
        flow={flow} ready={ready} canContinue={canContinue} hasCharacters={hasCharacters}
        roster={roster} selectedSlot={selectedSlot} selectionMode={selectionMode} previewHero={previewHero}
        appearance={creationAppearance} name={creationName} validation={validateCharacterName(creationName)}
        architecture={creationArchitecture} onArchitecture={setCreationArchitecture}
        error={creationError || error} muted={muted} fullscreen={isFullscreen}
        onContinue={continueAdventure} onNew={openNewGame} onLoad={openLoadGame}
        onOptions={() => setFlow('options')} onQuit={() => setQuitConfirmOpen(true)}
        onBack={() => { setCreationError(''); setError(''); setFlow(flow === 'creation' ? 'selection' : 'main'); }}
        onSlot={chooseSlot} onDelete={setDeleteTarget} onAppearance={setCreationAppearance}
        onName={name => { setCreationName(name); setCreationError(''); }}
        onEnter={startSelectedCharacter} onCreate={beginAdventure}
        onSound={toggleSound} onFullscreen={toggleFullscreen}
      />}
      {state.notice && state.started && (
        <output className="toast glass" key={state.noticeId}>
          {state.noticeItem ? <ItemIcon item={state.noticeItem} /> : <Sparkles size={16} />}
          <JobText>{state.notice}</JobText>
        </output>
      )}
      {active && state.nearShrine && (
        <button className="shrine-prompt glass" onClick={() => act('heal')}>
          <kbd>↖</kbd>
          <span>
            Pulihkan HP <small>Suaka Cahaya</small>
          </span>
          <Sparkles size={17} />
        </button>
      )}
      <footer className="game-footer">
        <div className="journey-note">
          <Leaf size={20} strokeWidth={1} />
          <div>
            Dunia menanti langkahmu.<small>ARUNIKA · CHAPTER ONE</small>
          </div>
        </div>
        {flow === 'world' && <HotbarLayer><PrimaryHotbar
          state={state}
          game={engine}
          active={active}
          bindingEnabled={state.started && !state.dead && !activeNpcMenu && (panel === 'bag' || panel === 'jobSkill')}
          onEdit={(index) => {
            engine?.setHotbarEditMode(true);
            setHotbarEditSlot(index);
            open('hotbar');
          }}
        />
        {(['q','e'] as const).map(quickId=><PrimaryHotbar
          key={quickId}
          quickId={quickId}
          state={state}
          game={engine}
          active={active}
          bindingEnabled={state.started && !state.dead && !activeNpcMenu && (panel === 'bag' || panel === 'jobSkill')}
          onEdit={(index)=>{engine?.setHotbarEditMode(true);setHotbarEditSlot(index);open('hotbar');}}
        />)}
        </HotbarLayer>}
        <div className="experience">
          <span>LV. {hero.level}</span>
          <Progress
            value={
              hero.level === 50 ? 100 : (hero.xp / xpNeeded(hero.level)) * 100
            }
            aria-label="Pengalaman level"
          />
          <small>
            {hero.level === 50
              ? 'LEVEL MAKSIMAL'
              : `${hero.xp} / ${xpNeeded(hero.level)} EXP`}
          </small>
          <span className="save-state">
            {state.saved ? 'TERSIMPAN LOKAL' : 'PENYIMPANAN TIDAK TERSEDIA'}
          </span>
        </div>
      </footer>
      {active && (
        <div className="touch-movement" aria-label="Kontrol gerak sentuh">
          {['w', 'a', 's', 'd'].map((key, index) => (
            <button
              key={key}
              className={`move-${key}`}
              aria-label={`Bergerak ${['maju', 'kiri', 'mundur', 'kanan'][index]}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                game.current?.setMove(key, true);
              }}
              onPointerUp={() => game.current?.setMove(key, false)}
              onPointerCancel={() => game.current?.setMove(key, false)}
            >
              {['↑', '←', '↓', '→'][index]}
            </button>
          ))}
        </div>
      )}

      <Dialog
        // A stale NPC event can outlive the gameplay view for one render
        // while Base UI is finishing a dialog transition.  Require both the
        // menu state and its resolved NPC data so the fallback "NPC /
        // Layanan perjalanan" panel can never be painted by itself.
        open={activeNpcMenu && Boolean(currentNpc) && state.started}
        disablePointerDismissal
        onOpenChange={(openState) => {
          if (!openState) closeNpcMenu();
        }}
      >
        {activeNpcMenu && currentNpc && state.started && (
          <DraggableDialogContent
            key={resizableNpcWindowId ?? 'npc-menu'}
            windowId={resizableNpcWindowId ?? 'npc-menu'}
            resizable={isResizableNpc}
            dragHandleSelector={isResizableNpc ? '.dialog-heading, [data-window-drag-handle]' : undefined}
            className={`game-dialog npc-menu-dialog${isResizableNpc ? ' general-merchant-dialog' : ''}`}
          >
          <span className="eyebrow">
            INTERAKSI NPC · {npcInteractionMode ? 'AKTIF' : 'NONAKTIF'}
          </span>
          <DialogTitle className="dialog-heading">
            {currentNpc?.name ?? 'NPC'}
          </DialogTitle>
          {isResizableNpc && (
            <span
              className="general-merchant-drag-handle"
              data-window-drag-handle
              role="presentation"
              title="Move window"
            >
              <Move size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
          )}
          {currentNpc && <div className="npc-service-badge">{getNpcServiceLabel(currentNpc, hero)}</div>}
          <DialogDescription className="dialog-subtitle">
            {currentNpc ? getNpcDescription(currentNpc, hero) : 'Layanan perjalanan.'}
          </DialogDescription>
          {currentNpc && (
            <div className="dialog-stack">
              <div className="npc-menu-tabs">
                {currentNpc.services.includes('buy') && (
                  <button
                    className={shopMode === 'buy' ? 'active' : ''}
                    onClick={() => setShopMode('buy')}
                  >
                    Buy
                  </button>
                )}
                {currentNpc.services.includes('sell') && (
                  <button
                    className={shopMode === 'sell' ? 'active' : ''}
                    onClick={() => setShopMode('sell')}
                  >
                    Sell
                  </button>
                )}
                {currentNpc.services.includes('teleport') && (
                  <button
                    onClick={() => {
                      closeNpcMenu();
                      setPanel('map');
                    }}
                  >
                    Teleport
                  </button>
                )}
                {currentNpc.services.includes('job') && (
                  <button
                    onClick={() => {
                      setActiveNpcMenu(false);
                      setNpcInteractionMode(false);
                      setPanel('class');
                    }}
                  >
                    Job
                  </button>
                )}
                {currentNpc.services.includes('pet') && (
                  <button
                    onClick={() => {
                      closeNpcMenu();
                      setPanel('character');
                    }}
                  >
                    Pet
                  </button>
                )}
                {currentNpc.services.includes('heal') && (
                  <button onClick={() => game.current?.cityAction('heal')}>
                    Heal
                  </button>
                )}
                {currentNpc.services.includes('tutorial') && (
                  <button onClick={() => game.current?.cityAction('tutorial')}>
                    Tutorial
                  </button>
                )}
              </div>
              {currentNpc.services.includes('buy') && shopMode === 'buy' && (
                <div className="npc-shop-list">
                  {npcShopItems.length ? (
                    npcShopItems.map((item) => (
                      <ItemHover as="article" item={item} buyPrice={shopItemPrice(item, currentNpc.service)}
                        className={`shop-row rarity-${item.rarity}`}
                        key={item.templateId}
                        data-shop-item={item.templateId}
                      >
                        <ItemIcon item={item} className="item-symbol" />
                        <div>
                          <strong><JobText>{item.name}</JobText></strong>
                          <small>
                            <span className="rarity-badge">
                              {RARITY_META[item.rarity].label}
                            </span>{' '}
                            · {item.potionType ? `Tier ${item.tier} · ` : ''}Lv.{' '}
                            {item.levelRequirement} ·{' '}
                            <JobText>{item.requiredCoreJob ??
                              item.jobRequirement ??
                              'Semua job'}</JobText>{' '}
                            · Stok Unlimited
                          </small>
                          {item.potionType && <small>{item.description}</small>}
                        </div>
                        <b>
                          {shopItemPrice(item, currentNpc.service)}{' '}
                          GOLD
                        </b>
                          <div className="shop-buy-controls">
                          <input
                            className="quantity-input"
                            type="number"
                            min={1}
                            max={item.maxStack}
                            value={buyQuantities[item.templateId] ?? 1}
                            aria-label={`Jumlah ${presentJobText(hero, item.name)} yang dibeli`}
                            onChange={(event) => setBuyQuantities((current) => ({
                              ...current,
                              [item.templateId]: Math.max(
                                1,
                                Math.min(item.maxStack, Number(event.target.value) || 1),
                              ),
                            }))}
                          />
                          <button
                          className="secondary-button"
                          onClick={() => game.current?.npcBuy(
                            item.templateId,
                            buyQuantities[item.templateId] ?? 1,
                          )}
                          >
                          Buy ×{buyQuantities[item.templateId] ?? 1}
                          </button>
                          </div>
                      </ItemHover>
                    ))
                  ) : (
                    <p className="muted-copy">
                      NPC ini belum memiliki item yang sesuai dengan job dan
                      wilayahmu.
                    </p>
                  )}
                </div>
              )}
              {currentNpc.services.includes('sell') && shopMode === 'sell' && (
                <div className="npc-sell-layout">
                  <div className="npc-shop-list">
                    {hero.inventory.map((item) => {
                      const equipped = Object.values(hero.equipment).includes(
                        item.id,
                      );
                      const blocked =
                        equipped ||
                        item.sockets.some((socket) => socket.rune) ||
                        item.isQuestItem ||
                        item.isSoulbound ||
                        !item.isSellable ||
                        item.sellValue <= 0 ||
                        (currentNpc.service === 'equipment' &&
                          !['weapon', 'armor', 'accessory'].includes(
                            item.category,
                          ));
                      return (
                        <ItemHover as="button" item={item}
                          className={`shop-row sell-row rarity-${item.rarity}`}
                          key={item.id}
                          disabled={blocked}
                          onClick={() => {
                            setSelectedSellItemId(item.id);
                            setSellQuantity(1);
                          }}
                        >
                          <ItemIcon item={item} className="item-symbol" />
                          <div>
                            <strong><JobText>{item.name}</JobText></strong>
                            <small>
                              Qty {item.quantity} ·{' '}
                              {blocked
                                ? 'Tidak dapat dijual'
                                : `${item.sellValue} GOLD/item`}
                            </small>
                          </div>
                        </ItemHover>
                      );
                    })}
                  </div>
                  {selectedSellItem ? (
                    <article
                      className={`item-detail rarity-${selectedSellItem.rarity}`}
                    >
                      <ItemHover as="div" item={selectedSellItem} className="item-detail-head">
                        <ItemIcon item={selectedSellItem} className="item-symbol" />
                        <div>
                          <span className="eyebrow rarity-badge">
                            {RARITY_META[selectedSellItem.rarity].label}
                          </span>
                          <h3><JobText>{selectedSellItem.name}</JobText></h3>
                        </div>
                      </ItemHover>
                      <p>
                        Jumlah dimiliki: {selectedSellItem.quantity} · Harga
                        satuan: {selectedSellItem.sellValue} GOLD
                      </p>
                      <div className="sell-quantity">
                        <label>
                          Jumlah
                          <input
                            className="quantity-input"
                            type="number"
                            min={1}
                            max={selectedSellItem.quantity}
                            value={sellQuantity}
                            onChange={(event) => setSellQuantity(Math.max(1, Math.min(selectedSellItem.quantity, Number(event.target.value) || 1)))}
                          />
                        </label>
                        <button onClick={() => setSellQuantity(1)}>
                          Jual 1
                        </button>
                        <button
                          onClick={() =>
                            setSellQuantity(
                              Math.max(
                                1,
                                Math.ceil(selectedSellItem.quantity / 2),
                              ),
                            )
                          }
                        >
                          Jual beberapa
                        </button>
                        <button
                          onClick={() =>
                            setSellQuantity(selectedSellItem.quantity)
                          }
                        >
                          Jual semua
                        </button>
                      </div>
                      <strong>
                        Total: {selectedSellItem.sellValue * sellQuantity} GOLD
                        ({sellQuantity}x)
                      </strong>
                      <div className="item-actions">
                        <button
                          className="primary-button"
                          onClick={() => setSellConfirmOpen(true)}
                        >
                          Jual
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => setSelectedSellItemId(null)}
                        >
                          Batal
                        </button>
                      </div>
                    </article>
                  ) : (
                    <p className="muted-copy">
                      Pilih item yang dapat dijual untuk melihat detail dan
                      jumlah.
                    </p>
                  )}
                </div>
              )}
              {currentNpc.services.includes('storage') && (
                <div className="storage-grid">
                  <section>
                    <h3>Inventory</h3>
                    {hero.inventory.map((item) => (
                      <ItemHover as="div" item={item} className="storage-item" key={item.id}>
                        <span><ItemIcon item={item} /> <JobText>{item.name}</JobText> ×{item.quantity}</span>
                        <input
                          className="quantity-input"
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={storageQuantities[item.id] ?? item.quantity}
                          aria-label={`Jumlah ${presentJobText(hero, item.name)} yang disimpan`}
                          onChange={(event) => setStorageQuantities((current) => ({ ...current, [item.id]: Math.max(1, Math.min(item.quantity, Number(event.target.value) || 1)) }))}
                        />
                        <button
                          disabled={Object.values(hero.equipment).includes(item.id)}
                          onClick={() => game.current?.cityAction('deposit', item.id, storageQuantities[item.id] ?? item.quantity)}
                        >Simpan</button>
                      </ItemHover>
                    ))}
                  </section>
                  <section>
                    <h3>Storage</h3>
                    {hero.storage.map((item) => (
                      <ItemHover as="div" item={item} className="storage-item" key={item.id}>
                        <span><ItemIcon item={item} /> <JobText>{item.name}</JobText> ×{item.quantity}</span>
                        <input
                          className="quantity-input"
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={storageQuantities[item.id] ?? item.quantity}
                          aria-label={`Jumlah ${presentJobText(hero, item.name)} yang diambil`}
                          onChange={(event) => setStorageQuantities((current) => ({ ...current, [item.id]: Math.max(1, Math.min(item.quantity, Number(event.target.value) || 1)) }))}
                        />
                        <button onClick={() => game.current?.cityAction('withdraw', item.id, storageQuantities[item.id] ?? item.quantity)}>Ambil</button>
                      </ItemHover>
                    ))}
                  </section>
                </div>
              )}
              {currentNpc.services.includes('quest') && (
                <div className="npc-shop-list">
                  {npcQuestEntries.map((entry) => {
                    const status = entry.status;
                    return (
                      <article className="shop-row" key={entry.id}>
                        <div>
                          <strong>{entry.title}</strong>
                          <small>{entry.description}</small>
                          <small>
                            Progress:{' '}
                            {entry.progress
                              .map(
                                (progress) =>
                                  `${progress.current}/${progress.required}`,
                              )
                              .join(' · ')}{' '}
                            · Status: {questStatusLabel(status)}
                          </small>
                        </div>
                        {status === 'available' && (
                          <button
                            className="secondary-button"
                            onClick={() =>
                              game.current?.cityAction('accept', entry.id)
                            }
                          >
                            Ambil Quest
                          </button>
                        )}
                        {status === 'ready_to_complete' && (
                          <button
                            className="primary-button"
                            onClick={() =>
                              game.current?.cityAction('complete', entry.id)
                            }
                          >
                            Selesaikan Quest
                          </button>
                        )}
                        {status === 'active' && (
                          <button className="secondary-button" disabled>
                            Belum selesai
                          </button>
                        )}
                        {status === 'locked' && (
                          <button className="secondary-button" disabled>
                            Syarat belum terpenuhi
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              <button className="secondary-button" onClick={closeNpcMenu}>
                Close
              </button>
            </div>
          )}
          {isResizableNpc && (
            <>
              <span className="general-merchant-resize-handle" data-window-resize-handle data-window-resize-edge="top" aria-label="Resize top edge" title="Resize vertically">
                <ArrowUpDown size={12} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="general-merchant-resize-handle" data-window-resize-handle data-window-resize-edge="bottom" aria-label="Resize bottom edge" title="Resize vertically">
                <ArrowUpDown size={12} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="general-merchant-resize-handle" data-window-resize-handle data-window-resize-edge="left" aria-label="Resize left edge" title="Resize horizontally">
                <ArrowLeftRight size={12} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="general-merchant-resize-handle" data-window-resize-handle data-window-resize-edge="right" aria-label="Resize right edge" title="Resize horizontally">
                <ArrowLeftRight size={12} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </>
          )}
          </DraggableDialogContent>
        )}
      </Dialog>

      {hoveredItem && hoveredItemPosition && typeof document !== 'undefined' && createPortal(
        <div
          className={`floating-item-tooltip rarity-${hoveredItem.rarity}`}
          style={{
            left: Math.max(8, hoveredItemPosition.x + 14),
            top: Math.max(8, hoveredItemPosition.y - 230),
          }}
          role="tooltip"
          aria-label={`Detail ${presentJobText(hero, hoveredItem.name)}`}
        >
          <div className="floating-item-title">
            <ItemIcon item={hoveredItem} className="item-symbol" />
            <div>
              <strong><JobText>{hoveredItem.name}</JobText></strong>
              <small>{RARITY_META[hoveredItem.rarity].label} · {hoveredItem.category}</small>
            </div>
          </div>
          <p><JobText>{['weapon', 'armor', 'accessory'].includes(hoveredItem.category)
            ? equipmentUsageDescription(hoveredItem)
            : hoveredItem.description}</JobText></p>
          <small>Qty {hoveredItem.quantity}</small>
          <InventoryCombatPowerPreview hero={hero} item={hoveredItem} />
        </div>,
        document.body,
      )}

      <AlertDialog open={sellConfirmOpen} onOpenChange={setSellConfirmOpen}>
        <DraggableAlertDialogContent windowId="sell-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi penjualan</AlertDialogTitle>
            <AlertDialogDescription>
              <JobText>{selectedSellItem
                ? `Jual ${sellQuantity}x ${selectedSellItem.name} dengan harga ${selectedSellItem.sellValue * sellQuantity} GOLD?`
                : 'Pilih item yang akan dijual.'}</JobText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedSellItem) {
                  game.current?.npcSell(selectedSellItem.id, sellQuantity);
                  setSelectedSellItemId(null);
                }
                setSellConfirmOpen(false);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </DraggableAlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={characterSelectionConfirmOpen}
        onOpenChange={setCharacterSelectionConfirmOpen}
      >
        <DraggableAlertDialogContent windowId="character-selection-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Return to Main Menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current adventure will be saved before leaving the world.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                returnToMainMenu();
                setCharacterSelectionConfirmOpen(false);
                setPauseMenuView('main');
                setPanel('');
                setRoster(listCharacters());
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </DraggableAlertDialogContent>
      </AlertDialog>

      <AlertDialog open={quitConfirmOpen} onOpenChange={setQuitConfirmOpen}>
        <DraggableAlertDialogContent windowId="quit-game-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Lumenfall?</AlertDialogTitle>
            <AlertDialogDescription>
              Browser build akan menyimpan sesi bila sedang bermain lalu kembali ke layar judul yang aman.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { returnToMainMenu(); setQuitConfirmOpen(false); }}>Quit Game</AlertDialogAction>
          </AlertDialogFooter>
        </DraggableAlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(panel)}
        modal={false}
        disablePointerDismissal={panel === 'bag' || panel === 'jobSkill' || panel === 'character'}
        onOpenChange={(openState) => {
          if (!openState) {
            setPanel('');
            game.current?.closeNpcMenu();
          }
        }}
      >
        <DraggableDialogContent
          windowId={panel ? `panel-${panel}` : 'panel'}
          dragHandleSelector={panel === 'character' ? '[data-character-header]' : undefined}
          initialFocus={panel === 'character' ? () => document.querySelector<HTMLElement>('.character-dialog [data-slot="dialog-close"]') : undefined}
          className={`game-dialog ${panel === 'pause' ? 'pause-dialog' : ''} ${panel === 'bag' || panel === 'jobSkill' ? 'binding-window' : ''} ${panel === 'bag' ? 'inventory-dialog' : panel === 'character' ? 'character-dialog' : panel === 'jobSkill' ? 'job-skill-dialog' : panel === 'forge' ? 'forge-dialog' : ''}`}
        >
          <span className={panel === 'character' ? 'sr-only' : 'eyebrow'}>
            LUMENFALL / {panel === 'pause' ? 'JEDA' : 'PERJALANANMU'}
          </span>
          <DialogTitle className={panel === 'character' ? 'sr-only' : 'dialog-heading'}>
            {panelTitles[panel] || 'Petualangan'}
          </DialogTitle>
          <DialogDescription className={panel === 'character' ? 'sr-only' : 'dialog-subtitle'}>
            {panel === 'pause'
              ? 'Tarik napas. Lembah akan menunggumu.'
              : panel === 'character'
                ? 'Kenali kekuatanmu. Siapkan langkah berikutnya. · C untuk tutup'
                : panel === 'jobSkill'
                  ? 'Skill aktif dan passive sesuai jalurmu. · K untuk tutup'
                  : 'Perjalanan besar dimulai dari langkah kecil.'}
          </DialogDescription>
          {panel === 'forge' && <>
            {forgeTab === 'main' ? (
              <section className="forge-main-menu" aria-label="Pilih layanan Forge Master">
                <p className="forge-main-prompt">Choose your forging path</p>
                <div className="forge-main-options">
                  <button className="forge-main-option" data-forge-choice="enhancement" onClick={() => setForgeTab('enhance')}>
                    <span className="forge-main-icon"><Hammer size={44} /></span>
                    <strong>ENHANCEMENT</strong>
                    <span>Upgrade equipment dan tingkatkan stat.</span>
                    <small>Upgrade Equipment</small>
                  </button>
                  <button className="forge-main-option" data-forge-choice="rune" onClick={() => setForgeTab('rune-menu')}>
                    <span className="forge-main-icon"><Gem size={44} /></span>
                    <strong>RUNE FORGE</strong>
                    <span>Kelola Rune, socket, optimizer, dan efek stat.</span>
                    <small>Runes & Sockets</small>
                  </button>
                </div>
              </section>
            ) : forgeTab === 'rune-menu' ? (
              <section className="forge-main-menu" aria-label="Pilih layanan Rune Forge">
                <p className="forge-main-prompt">Rune Forge Services</p>
                <div className="forge-main-options">
                  <button className="forge-main-option" data-forge-choice="rune-service" onClick={() => setForgeTab('rune')}>
                    <span className="forge-main-icon"><Gem size={44} /></span>
                    <strong>RUNE</strong>
                    <span>Pasang, lepas, dan reforging Rune.</span>
                    <small>Runes & Optimizer</small>
                  </button>
                  <button className="forge-main-option" data-forge-choice="crafting" onClick={() => setForgeTab('crafting')}>
                    <span className="forge-main-icon"><Hammer size={44} /></span>
                    <strong>CRAFTING</strong>
                    <span>Buat Rune Optimizer dari material dan GOLD.</span>
                    <small>Recipes & Materials</small>
                  </button>
                </div>
                <button className="forge-back-button" onClick={() => setForgeTab('main')}>← Back to Forge Master</button>
              </section>
            ) : (
              <>
                <button className="forge-back-button" onClick={() => setForgeTab('main')}>← Back to Forge Master</button>
                {forgeTab === 'enhance' ? <ForgePanel key={`${hero.currentCity}-${state.forgeNpcId}`} hero={hero} npcId={state.forgeNpcId ?? null} game={engine} onClose={() => { setPanel(''); game.current?.closeNpcMenu(); }} /> :
                  forgeTab === 'rune' ? <RuneForgePanel hero={hero} npcId={state.forgeNpcId ?? null} game={engine} /> :
                    <section className="forge-crafting-panel" aria-label="Crafting Rune Optimizer">
                      <div className="forge-crafting-heading"><Hammer size={22} /><div><h3>CRAFTING</h3><p>Forge Rune Optimizer dari material yang tersedia.</p></div></div>
                      {RUNE_OPTIMIZER_CRAFT_RECIPES.map((recipe) => {
                        const template = ITEM_CATALOG[recipe.templateId];
                        const material = ITEM_CATALOG[recipe.materialId];
                        const owned = hero.inventory.filter(item => item.templateId === recipe.materialId).reduce((sum, item) => sum + item.quantity, 0);
                        const canCraft = owned >= recipe.materialRequired && hero.gold >= recipe.goldCost;
                        return <ItemHover as="article" item={template} className="forge-crafting-row" data-forge-recipe={recipe.templateId} key={recipe.templateId}>
                          <ItemIcon item={template} className="item-symbol" />
                          <div><strong>{template.name}</strong><small><ItemHover item={material}>{recipe.materialRequired} × {material?.name ?? recipe.materialId}</ItemHover> · {recipe.goldCost.toLocaleString()} GOLD</small><small>Dimiliki: {owned}</small></div>
                          <button className="secondary-button" disabled={!canCraft} onClick={() => game.current?.craftRuneOptimizer(recipe.templateId)}>Craft</button>
                        </ItemHover>;
                      })}
                    </section>}
              </>
            )}
          </>}
          {panel === 'pause' && (
            <div className="dialog-stack pause-menu">
              {pauseMenuView === 'main' && (
                <>
                  <div className="adventure-menu-links">
                    <button className="primary-button" onClick={() => setPanel('')}>
                      Continue <ChevronRight size={17} />
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        game.current?.save();
                        game.current?.message('Adventure saved.');
                      }}
                    >
                      Save
                    </button>
                    <button className="secondary-button" onClick={() => setPauseMenuView('options')}>
                      Options <ChevronRight size={17} />
                    </button>
                    <button className="secondary-button" onClick={() => setPauseMenuView('hotkey')}>
                      Hotkey <ChevronRight size={17} />
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!state.started}
                      onClick={() => setCharacterSelectionConfirmOpen(true)}
                    >
              Back to Main Menu <ChevronRight size={17} />
                    </button>
                  </div>
                  <p className="muted-copy">
                    The world is paused while this menu is open. Choose Continue to return to the adventure.
                  </p>
                </>
              )}

              {pauseMenuView === 'hotkey' && (
                <>
                  <div className="pause-submenu-heading">
                    <span className="eyebrow">HOTKEY</span>
                    <button className="secondary-button" onClick={() => setPauseMenuView('main')}>
                      Back
                    </button>
                  </div>
                  <div className="adventure-menu-links">
                    {[
                      ['bag', 'Inventory', 'I'],
                      ['character', 'Character', 'C'],
                      ['jobSkill', 'Job Skill', 'K'],
                      ['quest', 'Jurnal Misi', 'J'],
                      ['help', 'Panduan', 'H'],
                      ['map', 'Map', 'M'],
                    ].map(([id, label, key]) => (
                      <button key={id} className="secondary-button" onClick={() => open(id)}>
                        {label}
                        {key && <kbd>{key}</kbd>}
                      </button>
                    ))}
                  </div>
                  <p className="muted-copy">Pilih menu untuk membukanya langsung.</p>
                </>
              )}

              {pauseMenuView === 'options' && (
                <>
                  <div className="pause-submenu-heading">
                    <span className="eyebrow">OPTIONS</span>
                    <button className="secondary-button" onClick={() => setPauseMenuView('main')}>
                      Back
                    </button>
                  </div>
                  <div className="adventure-menu-links">
                    <button className="secondary-button" onClick={() => setPauseMenuView('audio')}>
                      Audio <ChevronRight size={17} />
                    </button>
                    <button className="secondary-button" onClick={() => setPauseMenuView('graphics')}>
                      Graphics <ChevronRight size={17} />
                    </button>
                  </div>
                </>
              )}

              {pauseMenuView === 'audio' && (
                <>
                  <div className="pause-submenu-heading">
                    <span className="eyebrow">OPTIONS / AUDIO</span>
                    <button className="secondary-button" onClick={() => setPauseMenuView('options')}>
                      Back
                    </button>
                  </div>
                  <button className="secondary-button" onClick={toggleSound}>
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} Sound{' '}
                    {muted ? 'Off' : 'On'}
                  </button>
                  <section className="bgm-settings" aria-label="BGM audio settings">
                    <div className="bgm-volume-label">
                      <label id="bgm-volume-label" htmlFor="bgm-volume">
                        BGM Volume
                      </label>
                      <output>{Math.round(state.audioSettings.bgmVolume * 100)}%</output>
                    </div>
                    <Slider
                      id="bgm-volume"
                      aria-labelledby="bgm-volume-label"
                      min={0}
                      max={100}
                      step={1}
                      value={[Math.round(state.audioSettings.bgmVolume * 100)]}
                      onValueChange={(value) =>
                        game.current?.setAudioSettings({
                          bgmVolume: (Array.isArray(value) ? value[0] : value) / 100,
                        })
                      }
                    />
                    <p>Map music follows the current region.</p>
                    <output>
                      {muted
                        ? 'Sound is muted.'
                        : state.audioSettings.bgmVolume === 0
                          ? 'BGM volume 0% · sound effects remain active.'
                          : state.bgmStatus === 'error'
                            ? 'BGM could not be loaded. The game remains playable.'
                            : state.bgmStatus === 'blocked'
                              ? 'Browser interaction is required to play BGM.'
                              : state.bgmStatus === 'playing'
                                ? 'BGM is playing.'
                                : state.bgmStatus === 'loading'
                                  ? 'Loading BGM…'
                                  : 'No BGM for this map.'}
                    </output>
                    {['error', 'blocked'].includes(state.bgmStatus) && !muted && (
                      <button className="secondary-button" onClick={() => game.current?.retryBgm()}>
                        Retry BGM
                      </button>
                    )}
                  </section>
                </>
              )}

              {pauseMenuView === 'graphics' && (
                <>
                  <div className="pause-submenu-heading">
                    <span className="eyebrow">OPTIONS / GRAPHICS</span>
                    <button className="secondary-button" onClick={() => setPauseMenuView('options')}>
                      Back
                    </button>
                  </div>
                  <div className="adventure-menu-links">
                    <button className="secondary-button" onClick={toggleFullscreen}>
                      {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                      {isFullscreen ? 'Windowed mode' : 'Fullscreen'}
                    </button>
                  </div>
                  <InterfaceSettings />
                </>
              )}
            </div>
          )}
          {panel === 'hotbar' && (
            <PrimaryHotbarEditor
              hero={hero}
              game={engine}
              index={hotbarEditSlot}
              onIndexChange={setHotbarEditSlot}
            />
          )}
          {panel === 'class' && (
            <div className="dialog-stack class-panel">
              <JobArchitecturePreview hero={hero} />
              <V3JobTrainer
                hero={hero}
                onChooseWarrior={() => game.current?.chooseCoreJob('warrior')}
                onChooseSpecialization={(id) => game.current?.chooseSpecialization(id)}
              />
              {visibleJobs.v2 && !hero.coreJob && (
                <>
                  <span className="eyebrow">CORE JOB · LEVEL 15</span>
                  <p className="muted-copy">
                    Karakter ini memakai jalur V2. Warrior sudah tersedia;
                    Core Job lain akan dibuka pada pengembangan berikutnya.
                  </p>
                  <div className="class-choice-grid">
                    {visibleJobs.v2CoreChoices.map((job) => (
                      <button
                        key={job.id}
                        className="class-choice"
                        disabled={!job.available}
                        onClick={() => job.available && game.current?.chooseCoreJob(job.id as CoreJobId)}
                      >
                        <div><strong>{job.name}</strong><small>{job.status}</small></div>
                        <span>{job.id === 'warrior' ? 'Physical Combat · Mana' : 'Coming later'}</span>
                        <p>{job.id === 'warrior' ? 'Weapon discipline, guard, counter, and battlefield pressure.' : 'Belum memiliki Skill Tree V2 yang dapat dimainkan.'}</p>
                        {!job.available && <i><LockKeyhole size={12} /> Locked</i>}
                        {job.available && <i><Sparkles size={12} /> Available at Lv. 15</i>}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {visibleJobs.legacyProgression && !hero.coreJob && (
                <>
                  <span className="eyebrow">CLASS QUEST · LEVEL 10</span>
                  <p className="muted-copy">
                    Pilih Core Job. Semua skill menggunakan Mana; pilihan ini
                    menentukan senjata, role, dan dua Special Job.
                  </p>
                  <div className="class-choice-grid">
                    {visibleJobs.coreChoices.map((job) => (
                      <button
                        key={job.id}
                        className="class-choice"
                        disabled={hero.level < 10}
                        onClick={() =>
                          game.current?.chooseCoreJob(job.id as CoreJobId)
                        }
                      >
                        <div>
                          <strong>{job.name}</strong>
                          <small>{job.role}</small>
                        </div>
                        <span>
                          {job.resourceName} · {job.weapon}
                        </span>
                        <p>{job.description}</p>
                        <em>
                          {job.specializations
                            .map((id) => SPECIALIZATIONS[id].name)
                            .join(' / ')}
                        </em>
                        {hero.level < 10 && (
                          <i>
                            <LockKeyhole size={12} /> Lv. 10
                          </i>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {visibleJobs.legacyProgression && hero.coreJob && !hero.specialization && (
                <>
                  <span className="eyebrow">
                    SPECIALIZATION QUEST · LEVEL 25
                  </span>
                  <p className="muted-copy">
                    Bandingkan dua identitas Special Job sebelum memilih.
                    Pilihan ini menjadi bagian utama karakter.
                  </p>
                  <div className="class-choice-grid two-col">
                    {specialChoices.map(([id, job]) => (
                      <button
                        key={id}
                        className="class-choice"
                        disabled={hero.level < 25}
                        onClick={() =>
                          game.current?.chooseSpecialization(
                            id as SpecializationId,
                          )
                        }
                      >
                        <div>
                          <strong>{job.name}</strong>
                          <small>{job.role}</small>
                        </div>
                        <span>
                          {job.resourceName} · {job.weapon}
                        </span>
                        <p>{job.description}</p>
                        <em>Passive: {job.passiveName}</em>
                        {hero.level < 25 && (
                          <i>
                            <LockKeyhole size={12} /> Lv. 25
                          </i>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {visibleJobs.legacyProgression && hero.specialization && (
                <>
                  <span className="eyebrow">MASTERY QUEST · LEVEL 40</span>
                  <p className="muted-copy">
                    Mastery hanya mengubah perilaku skill. Tidak ada tombol
                    active skill tambahan.
                  </p>
                  <div className="mastery-list">
                    {state.skillViews.map((skill) => (
                      <div className="mastery-row" key={skill.id}>
                        <div>
                          <strong>{skill.name}</strong>
                          <small>
                            Level {skill.level}/5 · {skill.description}
                          </small>
                        </div>
                        <div>
                          {(
                            ['power', 'control', 'utility'] as MasteryChoice[]
                          ).map((choice) => (
                            <button
                              key={choice}
                              className={
                                hero.masteryChoices[skill.id] === choice
                                  ? 'selected'
                                  : ''
                              }
                              disabled={hero.level < 40}
                              onClick={() =>
                                game.current?.chooseMastery(skill.id, choice)
                              }
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {panel === 'bag' && (
            <div className="dialog-stack">
              <div className="balance">
                <Backpack size={18} /> {hero.inventory.filter((item) => !item.isEquipped).length}/
                {hero.inventoryCapacity} <span>slot terpakai · </span>
                <Coins size={16} /> {hero.gold} GOLD
              </div>
              <div className="inventory-toolbar">
                {hero.pendingLoot.length > 0 && (
                  <button
                    className="secondary-button"
                    onClick={() => game.current?.collectLoot()}
                  >
                    Ambil loot tersimpan ({hero.pendingLoot.length})
                  </button>
                )}
                <button
                  className="secondary-button inventory-sort-button"
                  title="Urutkan berdasarkan Tipe, Level, lalu Rarity"
                  aria-label="Sort inventory"
                  onClick={() => {
                    if (game.current?.sortInventoryLayout()) setInventorySort('manual');
                  }}
                >
                  Sort
                </button>
              </div>
              <InventoryGrid
                hero={hero}
                filter="all"
                sort={inventorySort}
                selectedId={selectedItemId}
                onSelect={setSelectedItemId}
                onHover={(id, position) => {
                  setHoveredItemId(id || null);
                  setHoveredItemPosition(position);
                }}
              />
              {selectedItem ? (
                <article
                  className={`item-detail rarity-${selectedItem.rarity}`}
                >
                  <div className="item-detail-head">
                    <ItemIcon item={selectedItem} className="item-symbol" />
                    <div>
                      <span className="eyebrow rarity-badge">
                        {RARITY_META[selectedItem.rarity].label} ·{' '}
                        {selectedItem.category}
                      </span>
                      <h3>
                        <JobText>{selectedItem.name}</JobText>
                        {selectedItem.enhancementLevel
                          ? ` +${selectedItem.enhancementLevel}`
                          : ''}
                      </h3>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setSelectedItemId(null)}
                      aria-label="Tutup detail item"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p>
                    <JobText>{['weapon', 'armor', 'accessory'].includes(selectedItem.category)
                      ? equipmentUsageDescription(selectedItem)
                      : selectedItem.description}</JobText>
                  </p>
                  {selectedItem.itemType === 'magnifier' && (
                    <p className="unique-stats-help">
                      Pilih equipment dengan ikon gembok di Inventory, lalu tekan
                      “Unlock Unique Stats”. Satu Arcane Magnifier akan dipakai
                      setelah konfirmasi berhasil.
                    </p>
                  )}
                  {selectedItem.potionType && (
                    <p>
                      Tier {selectedItem.tier} · Qty {selectedItem.quantity} ·
                      Harga jual: {selectedItem.sellValue} GOLD / item
                    </p>
                  )}
                  {['weapon', 'armor', 'accessory'].includes(
                    selectedItem.category,
                  ) && (
                    <div className="unique-stats-panel">
                      <span className="eyebrow">UNIQUE STATS</span>
                      {selectedItem.uniqueStatsLocked ? (
                        <p>🔒 Unique Stats tersembunyi. Gunakan Arcane Magnifier untuk membukanya.</p>
                      ) : Object.keys(selectedItem.bonusStats).length ? (
                        <StatBlockList value={selectedItem.bonusStats} />
                      ) : (
                        <small>Equipment ini tidak memiliki Unique Stats tersembunyi.</small>
                      )}
                    </div>
                  )}
                  {['weapon', 'armor', 'accessory'].includes(
                    selectedItem.category,
                  ) && (
                    <div className="affix-socket-panel">
                      {selectedItem.uniqueEffect && (
                        <p className="unique-effect">
                          ✦ <JobText>{selectedItem.uniqueEffect}</JobText>
                        </p>
                      )}
                      <span className="eyebrow">SOCKET RUNE</span>
                      {!selectedItem.sockets.length && <p>Tidak memiliki socket.</p>}
                      {selectedItem.sockets.map((socket, index) => (
                        <div className="socketed-rune" key={socket.id}>
                          <strong>Socket {index + 1}</strong>
                          {socket.rune ? <RuneDetails rune={socket.rune} /> : <span>○ Kosong</span>}
                        </div>
                      ))}
                      <p className="muted-copy">Modifikasi Rune hanya tersedia di NPC Forge Master.</p>
                      <small>Sumber item: {selectedItem.source.label}</small>
                    </div>
                  )}
                  {selectedItem.itemType === 'socketRune' && (
                    <div className="affix-socket-panel">
                      <span className="eyebrow">
                        {selectedItem.runeRarity?.toUpperCase()} RUNE ·{' '}
                        {selectedItem.runeTheme}
                      </span>
                      <div className="affix-list">
                        {selectedItem.affixes.map((affix) => (
                          <span key={affix.id}>
                            {affix.label} +{affix.value}
                            {affix.unit === 'percent' ? '%' : ''}
                          </span>
                        ))}
                      </div>
                      <small>
                        Sumber:{' '}
                        {selectedItem.runeSource ?? selectedItem.source.label}
                      </small>
                      {selectedItem.runeJobRequirement && (
                        <small>
                          Khusus Core Job: {selectedItem.runeJobRequirement}
                        </small>
                      )}
                      {selectedItem.uniqueEffect && (
                        <p className="unique-effect">
                          ✦ <JobText>{selectedItem.uniqueEffect}</JobText>
                        </p>
                      )}
                    </div>
                  )}
                  {selectedItem.itemType === 'runeOptimizer' && (
                    <div className="affix-socket-panel">
                      <span className="eyebrow">
                        {selectedItem.optimizerTier?.toUpperCase()} RUNE
                        OPTIMIZER
                      </span>
                      <small>
                        Qty {selectedItem.quantity} · Hanya digunakan di Forge Master.
                      </small>
                      <small>Sumber: {selectedItem.source.label}</small>
                    </div>
                  )}
                  {!['weapon', 'armor', 'accessory'].includes(selectedItem.category) && <div className="item-statline">
                    <span>
                      {Object.entries(itemStats(selectedItem))
                        .map(
                          ([stat, value]) =>
                            `${stat.toUpperCase()} +${Number(value).toFixed(1)}`,
                        )
                        .join(' · ') || 'Tanpa bonus stat'}
                    </span>
                    <span>
                      Syarat:{' '}
                      <JobText>{selectedItem.requiredSpecialJob ??
                        selectedItem.requiredCoreJob ??
                        'Semua job'}</JobText>{' '}
                      ·{' '}
                      {selectedItem.equipmentType ??
                        selectedItem.weaponType ??
                        selectedItem.equipSlot ??
                        selectedItem.category}
                    </span>
                    <span>Lv. {selectedItem.levelRequirement}</span>
                    <span>
                      {selectedItem.quantity > 1
                        ? `Qty ${selectedItem.quantity}`
                        : selectedItem.itemType}
                    </span>
                    <span>Jual {selectedItem.sellValue} GOLD</span>
                  </div>}
                  <div className="item-actions">
                    {selectedItem.equipSlot && (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          const offHand =
                            hero.equipment.offHand &&
                            hero.equipment.offHand !== selectedItem.id
                              ? hero.inventory.find(
                                  (item) => item.id === hero.equipment.offHand,
                                )
                              : null;
                          if (
                            selectedItem.equipSlot === 'mainHand' &&
                            (selectedItem.twoHanded ||
                              selectedItem.handedness === 'two_hand') &&
                            offHand &&
                            !(
                              selectedItem.equipmentType === 'bow' &&
                              offHand.equipmentType === 'quiver'
                            )
                          )
                            setEquipConfirmTarget(selectedItem);
                          else game.current?.equipItem(selectedItem.id);
                        }}
                      >
                        Equip <ArrowUpRight size={15} />
                      </button>
                    )}
                    {selectedItem.useEffect ||
                    selectedItem.category === 'pet' ? (
                      <button
                        className="secondary-button"
                        onClick={() => game.current?.useItem(selectedItem.id)}
                      >
                        Use
                      </button>
                    ) : null}
                    {Object.values(hero.equipment).includes(
                      selectedItem.id,
                    ) && (
                      <button
                        className="secondary-button"
                        onClick={() =>
                          game.current?.unequipItem(
                            selectedItem.equipSlot ?? 'mainHand',
                          )
                        }
                      >
                        Unequip
                      </button>
                    )}
                    {['weapon', 'armor', 'accessory'].includes(
                      selectedItem.category,
                    ) && (
                      selectedItem.uniqueStatsLocked ? (
                        <button
                          className="secondary-button"
                          disabled={
                            selectedItem.isLocked ||
                            !hero.inventory.some(
                              (entry) =>
                                entry.itemType === 'magnifier' &&
                                entry.quantity > 0,
                            )
                          }
                          onClick={() => game.current?.unlockUniqueStats(selectedItem.id)}
                        >
                          Unlock Unique Stats · 1 Magnifier
                        </button>
                      ) : null
                    )}
                    {!selectedItem.isQuestItem && (
                      <button
                        className="danger-button"
                        onClick={() => setDiscardTarget(selectedItem)}
                      >
                        <Trash2 size={15} /> Discard
                      </button>
                    )}
                  </div>
                  <InventoryCombatPowerPreview hero={hero} item={selectedItem} />
                  {equippedForSelected &&
                    equippedForSelected.id !== selectedItem.id && (
                      <div className="compare-box">
                        <strong>
                          Compare dengan <JobText>{equippedForSelected.name}</JobText>
                        </strong>
                        <span>
                          {Array.from(
                            new Set([
                              ...Object.keys(itemStats(selectedItem)),
                              ...Object.keys(itemStats(equippedForSelected)),
                            ]),
                          )
                            .map((key) => {
                              const a = itemStats(selectedItem);
                              const b = itemStats(equippedForSelected);
                              return `${key}: ${Number(a[key as keyof typeof a] ?? 0).toFixed(1)} vs ${Number(b[key as keyof typeof b] ?? 0).toFixed(1)}`;
                            })
                            .join(' · ')}
                        </span>
                      </div>
                    )}
                </article>
              ) : (
                <p className="muted-copy">
                  Pilih item untuk melihat tooltip, perbandingan, equip, use,
                  atau discard. Untuk enhancement, temui Forge Master di kota.
                </p>
              )}
              <p className="muted-copy">Tempa / Enhance hingga +12 hanya melalui NPC Forge Master di kota.</p>
              <p className="muted-copy">
                <FlaskConical size={14} /> Health Potion ×{hero.potions} ·
                gunakan melalui Inventory atau PrimaryHotbar (tombol 1–0). Drag
                item ke slot lain untuk memindahkan posisinya.
              </p>
              <button className="secondary-button" disabled>
                Beli ramuan melalui Pedagang Umum
              </button>
              <p className="muted-copy">
                Equipment: Common, Uncommon, Rare, Epic, Legendary, dan Mythic.
                Field Boss dapat menjatuhkan equipment bersocket serta Rune
                unik.
              </p>
              <AlertDialog
                open={Boolean(discardTarget)}
                onOpenChange={(open) => !open && setDiscardTarget(null)}
              >
                <DraggableAlertDialogContent windowId="discard-item-confirm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Buang item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <JobText>{discardTarget?.name}</JobText> akan dihapus dari Inventory. Quest
                      Item tetap dilindungi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (discardTarget)
                          game.current?.discardItem(discardTarget.id);
                        setDiscardTarget(null);
                      }}
                    >
                      Buang item
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </DraggableAlertDialogContent>
              </AlertDialog>
              <AlertDialog
                open={Boolean(equipConfirmTarget)}
                onOpenChange={(open) => !open && setEquipConfirmTarget(null)}
              >
                <DraggableAlertDialogContent windowId="equip-two-hand-confirm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Pasang senjata dua tangan?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Senjata ini menggunakan dua tangan. Off Hand akan dilepas
                      dengan aman dan tetap berada di Inventory.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (equipConfirmTarget)
                          game.current?.equipItem(
                            equipConfirmTarget.id,
                            'mainHand',
                          );
                        setEquipConfirmTarget(null);
                      }}
                    >
                      Pasang senjata
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </DraggableAlertDialogContent>
              </AlertDialog>
            </div>
          )}
          {panel === 'character' && (
            <CharacterOverview
              hero={hero}
              game={engine}
              onInventory={(item) => {
                if (item) setSelectedItemId(item.id);
                setPanel('bag');
              }}
            />
          )}
          {panel === 'jobSkill' && (
            <JobSkill
              hero={hero}
              game={engine}
              onMark={(npcId) => {
                setQuestMarkerId(npcId);
                setPanel('map');
              }}
            />
          )}
          {panel === 'quest' && (
            <div className="dialog-stack quest-journal">
              <div className="quest-filter-row">
                {(
                  [
                    ['all', 'Semua Quest'],
                    ['active', 'Quest Aktif'],
                    ['ready_to_complete', 'Siap Diselesaikan'],
                    ['locked', 'Quest Terkunci'],
                    ['completed', 'Quest Selesai'],
                    ['class', 'Class/Job Quest'],
                  ] as const
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    className={questFilter === filter ? 'active' : ''}
                    onClick={() => setQuestFilter(filter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="quest-journal-list">
                {filteredQuestEntries.map((entry) => {
                  const requirements = getQuestRequirements(entry, hero);
                  const rewardText =
                    [
                      entry.rewards.xp ? `${entry.rewards.xp} EXP` : '',
                      entry.rewards.gold ? `${entry.rewards.gold} GOLD` : '',
                      entry.rewards.items
                        .map((item) => `${item.templateId} x${item.quantity}`)
                        .join(', '),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Tidak ada reward tambahan';
                  return (
                    <article
                      key={entry.id}
                      className={`journal-entry quest-card-entry quest-status-${entry.status} ${selectedQuestId === entry.id ? 'selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="quest-card-trigger"
                        onClick={() => setSelectedQuestId(entry.id)}
                      >
                        <div className="quest-entry-heading">
                          <span className="eyebrow">
                            {entry.status === 'locked' ? (
                              <LockKeyhole size={13} />
                            ) : entry.status === 'completed' ? (
                              <span>✓</span>
                            ) : entry.status === 'ready_to_complete' ? (
                              <Sparkles size={13} />
                            ) : entry.status === 'active' ? (
                              <Crosshair size={13} />
                            ) : (
                              <Zap size={13} />
                            )}{' '}
                            {questCategoryLabel(entry.category)}
                          </span>
                          <span className="quest-status-badge">
                            {questStatusLabel(entry.status)}
                          </span>
                        </div>
                        <h3>{entry.title}</h3>
                        <p>{entry.description}</p>
                        <small>
                          Pemberi: {entry.giverNpcName} · {entry.giverMapName} ·
                          Tujuan: {entry.targetMapName}
                        </small>
                        <div className="journal-bottom">
                          <span>
                            Objective:{' '}
                            {entry.progress
                              .map(
                                (progress) =>
                                  `${progress.current}/${progress.required}`,
                              )
                              .join(' · ')}
                          </span>
                          <span>Reward: {rewardText}</span>
                        </div>
                      </button>
                      {selectedQuestId === entry.id && (
                        <div className="quest-detail-panel">
                          <p>
                            <strong>NPC:</strong> {entry.giverNpcName} (
                            {entry.giverNpcRole})
                          </p>
                          <p>
                            <strong>Lokasi NPC:</strong> {entry.giverMapName}
                          </p>
                          <p>
                            <strong>Map tujuan:</strong> {entry.targetMapName}
                          </p>
                          <p>
                            <strong>Level:</strong> {entry.requiredLevel} ·
                            Rekomendasi {entry.recommendedLevel}
                          </p>
                          {entry.requiredQuestIds.length > 0 && (
                            <p>
                              <strong>Quest prasyarat:</strong>{' '}
                              {entry.requiredQuestIds.join(', ')}
                            </p>
                          )}
                          {requirements.length > 0 && (
                            <div className="quest-requirements">
                              <strong>Syarat belum terpenuhi</strong>
                              {requirements.map((requirement) => (
                                <span key={requirement}>• {requirement}</span>
                              ))}
                            </div>
                          )}
                          <div className="item-actions">
                            {entry.status === 'available' && (
                              <button
                                className="secondary-button"
                                onClick={() => {
                                  setQuestMarkerId(entry.giverNpcId);
                                  setPanel('map');
                                }}
                              >
                                Temui NPC / Tandai di Map
                              </button>
                            )}
                            {entry.status === 'locked' && (
                              <button className="secondary-button" disabled>
                                Syarat belum terpenuhi
                              </button>
                            )}
                            {entry.status === 'ready_to_complete' && (
                              <button
                                className="primary-button"
                                onClick={() => {
                                  setPanel('');
                                  setTimeout(
                                    () =>
                                      game.current?.openNpc(entry.giverNpcId),
                                    0,
                                  );
                                }}
                              >
                                Selesaikan Quest
                              </button>
                            )}
                            {entry.category === 'class' && (
                              <button
                                className="secondary-button"
                                onClick={openClassPanel}
                              >
                                Buka panel job <Crown size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                {filteredQuestEntries.length === 0 && (
                  <p className="muted-copy">
                    Tidak ada quest pada kategori ini.
                  </p>
                )}
              </div>
            </div>
          )}
          {panel === 'map' && (
            <div className="dialog-stack world-services">
              <div className="region-summary">
                <span className="eyebrow">LOKASI SAAT INI</span>
                <h3>{state.inCity ? state.cityName : state.fieldName}</h3>
                <p>
                  {state.inCity
                    ? 'Kota hub · layanan NPC, storage, shop, healer, dan quest.'
                    : `${state.cityName} · level rekomendasi ${state.recommendedLevel}`}
                </p>
                {!state.inCity && (
                  <button
                    className="secondary-button"
                    onClick={() => game.current?.changeRegion(hero.currentCity)}
                  >
                    Kembali ke kota <ChevronRight size={16} />
                  </button>
                )}
              </div>
              <div className="region-grid">
                {Object.values(CITIES).map((city) => {
                  const unlocked = hero.unlockedCities.includes(city.id);
                  return (
                    <article
                      className={`region-card ${unlocked ? '' : 'locked'}`}
                      key={city.id}
                    >
                      <span className="eyebrow">
                        KOTA · CHAPTER {city.chapter}
                      </span>
                      <h3>{city.displayName}</h3>
                      <p>Lv. {city.recommendedLevel}</p>
                      <button
                        className="secondary-button"
                        disabled={!unlocked}
                        onClick={() => game.current?.changeRegion(city.id)}
                      >
                        {unlocked ? 'Masuk kota' : unlockReason(hero, city.id)}
                      </button>
                    </article>
                  );
                })}
              </div>
              <span className="eyebrow">FIELD MAP</span>
              <div className="region-grid">
                {Object.values(FIELDS).map((field) => {
                  const unlocked = hero.unlockedFields.includes(field.id);
                  return (
                    <article
                      className={`region-card ${unlocked ? '' : 'locked'}`}
                      key={field.id}
                    >
                      <span className="eyebrow">{field.codename}</span>
                      <h3>{field.displayName}</h3>
                      <p>
                        Lv. {field.recommendedLevel} ·{' '}
                        {field.cityId === hero.currentCity
                          ? 'wilayah terhubung'
                          : 'frontier'}
                      </p>
                      <button
                        className="secondary-button"
                        disabled={!unlocked}
                        onClick={() => game.current?.changeRegion(field.id)}
                      >
                        {unlocked
                          ? 'Teleport field'
                          : unlockReason(hero, field.id)}
                      </button>
                    </article>
                  );
                })}
              </div>
              {state.inCity && (
                <>
                  <span className="eyebrow">
                    NPC {state.cityName.toUpperCase()}
                  </span>
                  <div className="npc-grid">
                    {CITIES[hero.currentCity].npcList.map((npc) => {
                      const trackedStatus = npc.services.includes('quest')
                        ? hero.activeQuests
                            .map((id) =>
                              regionQuestStatus(hero, id, questClock),
                            )
                            .find(
                              (status) =>
                                status === 'ready_to_complete' ||
                                status === 'active',
                            )
                        : undefined;
                      const marked =
                        questMarkerId === npc.id &&
                        questEntries.some(
                          (entry) =>
                            entry.giverNpcId === npc.id &&
                            entry.status !== 'completed' &&
                            entry.status !== 'locked',
                        );
                      return (
                        <button
                          className={`npc-card ${marked ? 'quest-marked' : ''}`}
                          key={npc.id}
                          onClick={() => {
                            setPanel('');
                            setTimeout(() => game.current?.openNpc(npc.id), 0);
                          }}
                        >
                          <strong>
                            {marked
                              ? '⌖ '
                              : trackedStatus === 'ready_to_complete'
                                ? '? '
                                : trackedStatus === 'active'
                                  ? '! '
                                  : ''}
                            {npc.name}
                          </strong>
                          <small>
                            {marked ? 'Quest ditandai · ' : ''}
                            {getNpcServiceLabel(npc, hero)} · Klik saat berada dekat NPC
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {!state.inCity && FIELD_NPCS[hero.currentField] && (
                <>
                  <span className="eyebrow">FIELD CAMP NPC</span>
                  <article className="region-summary">
                    <h3>{FIELD_NPCS[hero.currentField].name}</h3>
                    <p>{FIELD_NPCS[hero.currentField].description}</p>
                    <div className="npc-actions">
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setPanel('');
                          setTimeout(
                            () =>
                              game.current?.openNpc(
                                FIELD_NPCS[hero.currentField].id,
                              ),
                            0,
                          );
                        }}
                      >
                        Interaksi di camp
                      </button>
                    </div>
                  </article>
                  <p className="muted-copy">
                    Dekati dan klik NPC field secara langsung untuk membuka Buy,
                    Sell, atau Teleport.
                  </p>
                </>
              )}
            </div>
          )}
          {panel === 'help' && (
            <div className="dialog-stack">
              <div className="help-rows">
                {[
                  ['W A S D / panah', 'Bergerak mengikuti arah kamera'],
                  ['Klik kiri', 'Basic attack · tidak memakai Mana'],
                  ['Klik kanan + geser', 'Putar kamera · tidak menyerang'],
                  [
                    '1 · 2 · 3 · 4',
                    'Posisi awal 4 active skill; bisa dipindah di PrimaryHotbar',
                  ],
                  ['F', 'Guard / block · timing dapat menjadi parry'],
                  ['Gerak', 'Karakter selalu berlari dengan kecepatan sedang; Shift tidak diperlukan'],
                  ['1–0 / Q / E', 'PrimaryHotbar / QuickHotbar Q dan E'],
                  ['Tombol Edit Mode', 'Aktif/nonaktif Edit Mode ketiga hotbar'],
                  [
                    'I / C / J / K / M / H',
                    'Inventori / karakter / Jurnal Misi / Job Skill / peta / panduan',
                  ],
                  ['Esc', 'Jeda dan lanjutkan'],
                ].map(([key, description]) => (
                  <div key={key}>
                    <kbd>{key}</kbd>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
              <p className="muted-copy">
                Semua active skill menggunakan Mana. Pulihkan Mana dengan potion
                atau healer. Skill gagal digunakan jika cooldown, Mana, atau
                weapon requirement belum terpenuhi.
              </p>
            </div>
          )}
        </DraggableDialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(openState) => {
          if (!openState) setDeleteTarget(null);
        }}
      >
        <DraggableDialogContent
          windowId="delete-character-confirm"
          className="game-dialog delete-dialog"
        >
          <span className="delete-emblem">
            <Trash2 size={24} />
          </span>
          <DialogTitle className="dialog-heading">Hapus karakter?</DialogTitle>
          <DialogDescription className="dialog-subtitle">
            Semua progres <b>{deleteTarget?.hero?.characterName}</b> di slot ini
            akan dihapus dari browser: level, GOLD, item, quest, dan progres
            class. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
          <div className="delete-actions">
            <button
              className="secondary-button"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </button>
            <button
              className="danger-button"
              onClick={() => {
                if (deleteTarget) {
                  deleteCharacter(deleteTarget.id);
                  refreshRoster();
                }
                setDeleteTarget(null);
              }}
            >
              Hapus permanen <Trash2 size={15} />
            </button>
          </div>
        </DraggableDialogContent>
      </Dialog>
      {state.dead && (
        <section className="death-screen">
          <div className="glass">
            <Heart size={34} strokeWidth={1} />
            <span className="eyebrow">CAHAYAMU BELUM PADAM</span>
            <h2>Bangkit sekali lagi.</h2>
            <p>
              Setiap penjaga pernah terjatuh.
              <br />
              Level, GOLD, job, dan perjalananmu tetap terjaga.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setPanel('');
                game.current?.respawn();
              }}
            >
              Kembali ke suaka <ArrowUpRight size={17} />
            </button>
          </div>
        </section>
      )}
    </main>
    </GameDragDropProvider></JobPresentationContext.Provider>
  );
}
