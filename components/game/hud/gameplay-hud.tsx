'use client';
import { isUnderwaterSubmap } from '@/lib/game/underwater-regions';
import { FROSTFIRE_ID } from '@/lib/game/frostfire-highlands-layout';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  Sword,
  Crown,
  Coins,
  ScrollText,
  ChevronRight,
  Sun,
  Flame,
  Moon,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Camera,
  RotateCcw,
  Sparkles,
  Heart,
  Star,
  MessageSquare,
  Minus,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  characterLabel,
  maxHP,
  xpNeeded,
  derivedStats,
  type Hero,
} from '@/lib/game/rules';
import { isResourceEnabled } from '@/lib/game/gameplay-config';
import type { QuestJournalEntry } from '@/lib/game/regions';
import type { Game, Snapshot } from '@/lib/game/world';
import type { HotbarSlot } from '@/lib/game/hotbar';
import { HUD_RESET_EVENT } from '@/lib/game/hud-layout';
import { isEditableTarget } from '@/lib/game/ui-input';
import type { ChatMessage } from '@/lib/game/chat';
import { PrimaryHotbar } from '../primary-hotbar';
import { HotbarLayer } from '../drag-drop-provider';
import { BuffTray } from './buff-tray';
import { ChatPanel } from '../chat/chat-panel';
import { HUDFrame, HUDLayoutProvider } from './hud-layout';
import { FPSCounter } from './fps-counter';

const PlayerStatusCard = memo(function PlayerStatusCard({
  hero,
  mana,
  maxMana,
  manaName,
  stamina,
  onOpen,
}: {
  hero: Hero;
  mana: number;
  maxMana: number;
  manaName: string;
  stamina: number;
  onOpen: () => void;
}) {
  const hp = maxHP(hero);
  return (
    <section className="hud-player hud-panel" aria-label="Status karakter">
      <button
        className="hud-portrait"
        aria-label="Lihat karakter"
        onClick={onOpen}
      >
        <Sword size={32} strokeWidth={1.3} />
        <span>Lv. {hero.level}</span>
      </button>
      <div className="hud-player-details">
        <strong>{hero.characterName}</strong>
        <small>
          <Sword size={15} strokeWidth={1.5} />
          {characterLabel(hero)}
        </small>
        <div className="hud-resource hud-health">
          <Heart size={14} fill="currentColor" />
          <Progress value={(hero.hp / hp) * 100} aria-label="HP karakter" />
          <span>
            {Math.ceil(hero.hp)} / {hp}
          </span>
        </div>
        <div className="hud-resource hud-mana">
          <Star size={14} fill="currentColor" />
          <Progress
            value={maxMana > 0 ? (mana / maxMana) * 100 : 0}
            aria-label={manaName}
          />
          <span>
            {manaName} {Math.floor(mana)}/{maxMana}
          </span>
        </div>
        {isResourceEnabled(hero, 'stamina') && (
          <Progress
            className="hud-stamina"
            value={(stamina / derivedStats(hero).staminaMax) * 100}
            aria-label="Stamina"
          />
        )}
      </div>
    </section>
  );
});
const QuestTracker = memo(function QuestTracker({
  quest,
  classQuest,
  onOpen,
}: {
  quest: QuestJournalEntry | null;
  classQuest: string;
  onOpen: () => void;
}) {
  return (
    <section className="hud-quest hud-panel" aria-label="Jurnal misi ringkas">
      <header>
        <span>
          <ScrollText size={14} /> JURNAL MISI
        </span>
      </header>
      {quest ? (
        <>
          <small className="hud-quest-state">
            {quest.status === 'ready_to_complete'
              ? 'Siap diselesaikan'
              : 'Aktif'}
          </small>
          <h2>{quest.title}</h2>
          <p>{quest.description}</p>
          <div className="hud-objectives">
            {quest.objectives.map((objective, index) => (
              <div key={index}>
                <span>{objective.targetName}</span>
                <b>
                  {quest.progress[index]?.current ?? 0} /{' '}
                  {quest.progress[index]?.required ?? 0}
                </b>
              </div>
            ))}
          </div>
          <Progress
            className="hud-quest-progress"
            value={
              quest.progress[0]?.required
                ? Math.min(
                    100,
                    (quest.progress[0].current / quest.progress[0].required) *
                      100,
                  )
                : 0
            }
            aria-label="Progres misi"
          />
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
      <div className="hud-rewards">
        <span>
          <Sparkles size={14} />
          {quest?.rewards.xp ?? 0} EXP
        </span>
        <span>
          <Coins size={14} />
          {quest?.rewards.gold ?? 0} GOLD
        </span>
      </div>
      {classQuest && (
        <small className="hud-class-quest">
          <Crown size={14} />
          {classQuest}
        </small>
      )}
      <button className="hud-journal-button" onClick={onOpen}>
        <ScrollText size={14} />
        Buka Jurnal
        <ChevronRight size={17} />
      </button>
    </section>
  );
});
const RightHUDCluster = memo(function RightHUDCluster({
  mapRef,
  mapDrawsGrid = false,
  gold,
  weatherLabel = 'Pagi yang tenang',
  muted,
  fullscreen,
  cameraMode,
  onMap,
  onSound,
  onFullscreen,
  onCamera,
}: {
  mapRef: RefObject<HTMLCanvasElement | null>;
  mapDrawsGrid?: boolean;
  gold: number;
  weatherLabel?: string;
  muted: boolean;
  fullscreen: boolean;
  cameraMode: Snapshot['cameraMode'];
  onMap: () => void;
  onSound: () => void;
  onFullscreen: () => void;
  onCamera: () => void;
}) {
  return (
    <aside className="hud-right">
      <div className="hud-minimap-frame">
      <button className="hud-minimap" onClick={onMap} aria-label="Buka peta">
        <canvas ref={mapRef} width={240} height={240} />
        {!mapDrawsGrid && <svg className="hud-map-grid" viewBox="0 0 240 240" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map(index => {
            const offset = index * 240 / 7;
            return <path key={index} d={`M${offset} 0V240 M0 ${offset}H240`} />;
          })}
        </svg>}
        <svg
          className="hud-compass-rim"
          viewBox="0 0 240 240"
          aria-hidden="true"
        >
          <rect x="6" y="6" width="228" height="228" />
          <rect x="10" y="10" width="220" height="220" />
          <path d="M6 30V6H30 M210 6H234V30 M234 210V234H210 M30 234H6V210" />
        </svg>
        {!mapDrawsGrid && <span className="hud-map-columns" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map(column => <span key={column}>{column}</span>)}
        </span>}
        {!mapDrawsGrid && <span className="hud-map-rows" aria-hidden="true">
          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(row => <span key={row}>{row}</span>)}
        </span>}
        <span className="hud-cardinal hud-cardinal-n" aria-hidden="true">N</span>
        <span className="hud-cardinal hud-cardinal-w" aria-hidden="true">W</span>
        <span className="hud-cardinal hud-cardinal-e" aria-hidden="true">E</span>
        <span className="hud-cardinal hud-cardinal-s" aria-hidden="true">S</span>
        <kbd>M</kbd>
      </button>
      </div>
      <div className="hud-weather">
        {weatherLabel==='Underground · Lantern light'?<Flame size={15} />:weatherLabel==='Chaotic blue night'?<Moon size={15} />:<Sun size={15} />}
        {weatherLabel}
      </div>
      <div className="hud-gold hud-panel">
        <Coins size={19} />
        <strong>{gold.toLocaleString('id-ID')}</strong>
        <small>GOLD</small>
      </div>
      <div className="hud-utilities">
        <button
          aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
          title="Volume"
          onClick={onSound}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
        <button
          aria-label={
            fullscreen ? 'Keluar dari fullscreen' : 'Aktifkan fullscreen'
          }
          title="Fullscreen"
          onClick={onFullscreen}
        >
          {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
        </button>
        <button
          aria-label={`Kamera ${cameraMode === 'free' ? 'Free' : 'Follow'} aktif. Ganti ke ${cameraMode === 'free' ? 'Follow' : 'Free'} Camera`}
          aria-pressed={cameraMode === 'follow'}
          title={`${cameraMode === 'free' ? 'Free' : 'Follow'} Camera`}
          onClick={onCamera}
        >
          <Camera size={19} />
        </button>
      </div>
    </aside>
  );
});
export function GameplayHUD({
  state,
  game,
  mapRef,
  visible,
  active,
  panel,
  modalOpen,
  fullscreen,
  quest,
  onOpen,
  onSound,
  onFullscreen,
  onEditHotbar,
}: {
  state: Snapshot;
  game: Game | null;
  mapRef: RefObject<HTMLCanvasElement | null>;
  visible: boolean;
  active: boolean;
  panel: string;
  modalOpen: boolean;
  fullscreen: boolean;
  quest: QuestJournalEntry | null;
  onOpen: (panel: string) => void;
  onSound: () => void;
  onFullscreen: () => void;
  onEditHotbar: (slot: HotbarSlot) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [chatExpanded, setChatExpanded] = useState(true);
  const chatFocusRequested = useRef(false);
  useEffect(() => {
    if (chatExpanded && chatFocusRequested.current) {
      chatFocusRequested.current = false;
      input.current?.focus();
    }
  }, [chatExpanded]);
  const available = visible && state.started && !state.dead;
  const chatFocus = useCallback(
    (focused: boolean) => {
      game?.setUIInputBlocked('chat', focused);
    },
    [game],
  );
  const localChat = useCallback(
    (message: ChatMessage) => game?.showPlayerChat(message.text) ?? false,
    [game],
  );
  const hudInteraction = useCallback(
    (dragging: boolean) => {
      if (dragging) input.current?.blur();
      game?.setUIInputBlocked('hud-drag', dragging);
    },
    [game],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !available ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        document.querySelector('[role="dialog"],[role="alertdialog"]') ||
        modalOpen ||
        document.body.hasAttribute('data-game-drag-pending') ||
        document.body.hasAttribute('data-hud-dragging')
      )
        return;
      if (event.key === 'Escape' && document.activeElement === input.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        input.current?.blur();
        return;
      }
      if (event.key === 'Enter' && !isEditableTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (chatExpanded) input.current?.focus();
        else {
          chatFocusRequested.current = true;
          setChatExpanded(true);
        }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
    };
  }, [available, modalOpen, chatExpanded]);
  useEffect(
    () => () => {
      game?.setUIInputBlocked('chat', false);
      game?.setUIInputBlocked('hud-drag', false);
    },
    [game],
  );
  const bindingEnabled = available && (panel === 'bag' || panel === 'jobSkill');
  const indicators = state.combatFeedback?.indicators ?? [];
  const statuses = Object.entries(state.hero.statusEffects).filter(
    ([status]) => !indicators.some((indicator) => indicator.id === status),
  );
  const buffCount = indicators.length + statuses.length;
  return (
    <HUDLayoutProvider
      buffCount={buffCount}
      draggable={available && !modalOpen}
      onInteraction={hudInteraction}
      chatCollapsed={!chatExpanded}
    >
      <div className="gameplay-hud hud-theme" hidden={!visible}>
        <HUDFrame id="player" label="Status karakter">
          <PlayerStatusCard
            hero={state.hero}
            mana={state.mana}
            maxMana={state.maxMana}
            manaName={state.manaName}
            stamina={state.stamina}
            onOpen={() => onOpen('character')}
          />
        </HUDFrame>
        <HUDFrame id="quest" label="Jurnal misi">
          <QuestTracker
            quest={quest}
            classQuest={state.classQuest}
            onOpen={() => onOpen('quest')}
          />
        </HUDFrame>
        <div className="hud-location">
          <h1>{state.inCity ? state.cityName : state.fieldName}</h1>
          <div className="hud-location-ornament">
            <span />
            <i aria-hidden="true" />
            <span />
          </div>
          <p>
            {state.inCity ? 'Kota aman' : state.mapId==='ironveil-mines-interior-v1' ? 'Underground' : state.mapId==='whispering-wilds-v2' ? 'Hunting Field' : state.mapId===FROSTFIRE_ID ? 'Frozen Highlands' : state.mapId==='verdant-plains-v2' ? 'Padang Arunika' : state.cityName}
            <b>·</b>{<>Lv. {state.recommendedLevel}</>}
          </p>
        </div>
        <HUDFrame id="right" label="Minimap">
          <RightHUDCluster
            mapDrawsGrid={state.mapId === 'sunken-ruins-underwater-v1' || isUnderwaterSubmap(state.mapId)}
            mapRef={mapRef}
            gold={state.hero.gold}
            weatherLabel={state.mapId==='ironveil-mines-interior-v1'?'Underground · Lantern light':state.mapId==='ironveil-mines-exterior-v1'?'Hot midday · Scattered clouds':state.mapId==='whispering-wilds-v2'?'Chaotic blue daylight':state.mapId===FROSTFIRE_ID?'Wind-driven snow':undefined}
            muted={state.audioSettings.muted}
            fullscreen={fullscreen}
            cameraMode={state.cameraMode}
            onMap={() => onOpen('map')}
            onSound={onSound}
            onFullscreen={onFullscreen}
            onCamera={() =>
              game?.setCameraMode(
                game.cameraMode === 'free' ? 'follow' : 'free',
              )
            }
          />
        </HUDFrame>
        <HUDFrame id="chat" label="Chat" resizable={chatExpanded}>
          {!chatExpanded && (
            <button
              className="hud-chat-collapsed"
              onClick={() => setChatExpanded(true)}
              aria-label="Buka chat"
            >
              <MessageSquare size={18} />
              <span>
                Chat <small>System · lokal</small>
              </span>
            </button>
          )}
          <div className="hud-chat-expanded" hidden={!chatExpanded}>
            <ChatPanel
              inputRef={input}
              onFocusChange={chatFocus}
              available={available && !modalOpen}
              mapId={state.mapId}
              mapName={state.inCity ? state.cityName : state.fieldName}
              notice={state.notice}
              noticeId={state.noticeId}
              sessionId={state.hero.characterId ?? state.hero.slotId}
              characterName={state.hero.characterName}
              onLocalMessage={localChat}
            />
            <button
              className="hud-chat-collapse"
              aria-label="Ringkas chat"
              onClick={() => {
                input.current?.blur();
                setChatExpanded(false);
              }}
            >
              <Minus size={16} />
            </button>
          </div>
        </HUDFrame>
        <HUDFrame id="fps" label="FPS" className="hud-fps" textOnly resizable={false}>
          {visible && <FPSCounter game={game} />}
        </HUDFrame>
        <HUDFrame
          id="buff"
          label="Buff / Tempo"
          className={!buffCount ? 'hud-empty-buffs' : ''}
        >
          <BuffTray indicators={indicators} statuses={statuses} />
        </HUDFrame>
        <div className="hud-exp">
          <strong>Lv. {state.hero.level}</strong>
          <Progress
            value={
              state.hero.level === 50
                ? 100
                : (state.hero.xp / xpNeeded(state.hero.level)) * 100
            }
            aria-label="Pengalaman level"
          />
          <span>
            {state.hero.level === 50
              ? 'LEVEL MAKSIMAL'
              : `${state.hero.xp} / ${xpNeeded(state.hero.level)} EXP`}
          </span>
          <small>
            {state.saved ? 'TERSIMPAN LOKAL' : 'PENYIMPANAN TIDAK TERSEDIA'}
          </small>
        </div>
      </div>
      <HotbarLayer>
        <div
          className={`hud-hotbar-layer hud-theme ${bindingEnabled ? 'hud-binding-layer' : ''}`}
          hidden={!visible}
        >
          <HUDFrame id="hotbar" label="Hotbar">
            <div className="hud-hotbar-cluster">
              <PrimaryHotbar
                embedded
                quickId="q"
                state={state}
                game={game}
                active={active}
                bindingEnabled={bindingEnabled}
                onEdit={onEditHotbar}
              />
              <div className="hud-primary-wrap hud-panel">
                <i className="hud-hotbar-crest" aria-hidden="true" />
                <i
                  className="hud-hotbar-crest hud-hotbar-crest-bottom"
                  aria-hidden="true"
                />
                <header className="hud-hotbar-controls">
                  <strong className="hud-hotbar-title">
                    PRIMARY HOTBAR <span aria-hidden="true">✣</span>
                  </strong>
                  <span>Combo x{state.combo || 1}</span>
                  <button
                    aria-label="Reset HUD"
                    title="Reset HUD"
                    disabled={!available || modalOpen}
                    onClick={() =>
                      window.dispatchEvent(new Event(HUD_RESET_EVENT))
                    }
                  >
                    <RotateCcw size={16} />
                  </button>
                </header>
                <PrimaryHotbar
                  embedded
                  state={state}
                  game={game}
                  active={active}
                  bindingEnabled={bindingEnabled}
                  onEdit={onEditHotbar}
                />
              </div>
              <PrimaryHotbar
                embedded
                quickId="e"
                state={state}
                game={game}
                active={active}
                bindingEnabled={bindingEnabled}
                onEdit={onEditHotbar}
              />
            </div>
          </HUDFrame>
        </div>
      </HotbarLayer>
    </HUDLayoutProvider>
  );
}
