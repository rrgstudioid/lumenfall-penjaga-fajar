'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, MapPin, Plus, Sparkles, Trash2, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { CharacterPreview } from './character-preview';
import {
  characterLabel, FACE_STYLE_PRESETS, HAIR_STYLE_PRESETS,
  HAIR_COLOR_PRESETS, SKIN_TONE_PRESETS,
  isCompatibleCharacterSave,
  type CharacterAppearance, type CharacterSlot, type Hero,
} from '@/lib/game/rules';
import { CITIES, FIELDS } from '@/lib/game/regions';

export type MenuFlow = 'main' | 'selection' | 'creation' | 'options' | 'loading' | 'world';
export type SelectionMode = 'new' | 'load';

function Wordmark({ compact = false }: { compact?: boolean }) {
  return <div className={`menu-wordmark ${compact ? 'menu-wordmark-compact' : ''}`}>
    <Sparkles aria-hidden="true" className="menu-crest" strokeWidth={1} />
    <span className="menu-logo">Lumen<span>fall</span></span>
    <span className="menu-subtitle">Penjaga Fajar</span>
  </div>;
}

function ScreenTitle({ children }: { children: ReactNode }) {
  return <header className="menu-screen-heading"><Wordmark compact /><h1>{children}</h1></header>;
}

function Back({ onClick, children = 'BACK' }: { onClick: () => void; children?: ReactNode }) {
  return <button className="fantasy-button menu-back" onClick={onClick}><ArrowLeft size={17} aria-hidden="true" />{children}</button>;
}

function ChoiceGroup({ label, value, choices, onChange, swatches = false }: {
  label: string; value: string; choices: readonly { id: string; label: string; color?: string }[];
  onChange: (value: string) => void; swatches?: boolean;
}) {
  return <fieldset className="menu-choice-group">
    <legend>{label}</legend>
    <div className={swatches ? 'menu-swatches' : 'menu-presets'}>
      {choices.map(choice => <button type="button" key={choice.id}
        className={swatches ? 'menu-swatch' : 'menu-preset'}
        style={choice.color ? { '--swatch-color': choice.color } as CSSProperties : undefined}
        aria-label={`${label}: ${choice.label}`} title={choice.label}
        aria-pressed={value === choice.id} onClick={() => onChange(choice.id)}>
        {swatches ? value === choice.id && <Check size={17} aria-hidden="true" /> : choice.label}
      </button>)}
    </div>
    {swatches && <small className="menu-choice-value">{choices.find(choice => choice.id === value)?.label}</small>}
  </fieldset>;
}

export function MenuPresentation(props: {
  flow: Exclude<MenuFlow, 'world'>; ready: boolean; canContinue: boolean; hasCharacters: boolean;
  roster: CharacterSlot[]; selectedSlot: string; selectionMode: SelectionMode; previewHero: Hero;
  appearance: CharacterAppearance; name: string; validation: string | null; error: string;
  architecture: 'v2_test' | 'v3_adventurer';
  onArchitecture: (value: 'v2_test' | 'v3_adventurer') => void;
  muted: boolean; fullscreen: boolean;
  onContinue: () => void; onNew: () => void; onLoad: () => void; onOptions: () => void; onQuit: () => void;
  onBack: () => void; onSlot: (id: string) => void; onDelete: (slot: CharacterSlot) => void;
  onAppearance: (appearance: CharacterAppearance) => void; onName: (name: string) => void;
  onEnter: () => void; onCreate: () => void; onSound: () => void; onFullscreen: () => void;
}) {
  const { flow, roster, selectedSlot, selectionMode, previewHero, appearance } = props;
  const root = useRef<HTMLElement>(null);
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, [flow]);
  const selected = roster.find(slot => slot.id === selectedSlot);
  const titleScene = flow === 'main' || flow === 'options' || flow === 'loading';
  const update = (key: keyof CharacterAppearance, value: string) => props.onAppearance({ ...appearance, [key]: value });
  const destination = previewHero.inCity ? CITIES[previewHero.currentCity]?.displayName : FIELDS[previewHero.currentField]?.displayName;
  return <section ref={root} tabIndex={-1} className={`menu-presentation menu-${flow}`} aria-label={flow === 'main' ? 'Main Menu' : flow === 'selection' ? 'Character Selection' : flow === 'creation' ? 'Character Creation' : flow === 'loading' ? 'Loading World' : 'Options'}>
    <img className="menu-scenery" src={`/assets/menu/${titleScene ? 'vista' : 'terrace'}.webp`} alt="" fetchPriority="high" draggable={false} />
    <div className="menu-scene-shade" aria-hidden="true" />
    {flow === 'main' && <div className="menu-title-composition">
      <h1 className="sr-only">LUMENFALL · Penjaga Fajar</h1>
      <Wordmark />
      <nav className="menu-title-actions" aria-label="Main Menu actions">
        <button className="menu-title-action menu-continue" disabled={!props.ready || !props.canContinue} onClick={props.onContinue}>CONTINUE</button>
        <button className="menu-title-action" disabled={!props.ready} onClick={props.onNew}>NEW GAME</button>
        <button className="menu-title-action" disabled={!props.ready || !props.hasCharacters} onClick={props.onLoad}>LOAD GAME</button>
        <button className="menu-title-action" onClick={props.onOptions}>OPTIONS</button>
        <button className="menu-title-action" onClick={props.onQuit}>QUIT GAME</button>
      </nav>
      {props.ready && !props.canContinue && <p className="menu-title-note">Mulai perjalanan baru di New Game.</p>}
      {props.error && <p role="alert" className="menu-inline-error">{props.error}</p>}
    </div>}

    {flow === 'selection' && <>
      <ScreenTitle>Character Selection</ScreenTitle>
      <div className="menu-slot-panel">
        <p className="menu-mode-label">{selectionMode === 'new' ? 'NEW GAME · PILIH SLOT KOSONG' : 'LOAD GAME · PILIH PENJAGAMU'}</p>
        <div className="menu-slot-list">
          {roster.map((slot, index) => {
            const hero = slot.hero;
            const compatible = isCompatibleCharacterSave(hero);
            return <button key={slot.id} className={`menu-slot ${selectedSlot === slot.id ? 'is-selected' : ''} ${hero ? '' : 'is-empty'}`}
              aria-pressed={selectedSlot === slot.id} disabled={selectionMode === 'load' && !hero} onClick={() => props.onSlot(slot.id)}>
              <span className="menu-slot-sigil" aria-hidden="true">{hero ? <><Sparkles size={25} strokeWidth={1} /><small>0{index + 1}</small></> : <Plus size={30} strokeWidth={1} />}</span>
              <span className="menu-slot-copy"><strong>{hero?.characterName ?? 'Empty Slot'}</strong>
                {hero ? compatible ? <><span>Lv. {hero.level} · {characterLabel(hero)}</span><span className="menu-slot-location"><MapPin size={12} />{hero.inCity ? CITIES[hero.currentCity]?.displayName : FIELDS[hero.currentField]?.displayName}</span>
                  <span className="menu-slot-history"><span><Clock3 size={12} />{Math.floor(hero.playTimeSeconds / 3600)}h {Math.floor(hero.playTimeSeconds / 60) % 60}m</span><span><CalendarDays size={12} />{hero.lastPlayedAt ? new Date(hero.lastPlayedAt).toLocaleDateString('id-ID') : 'Belum dimainkan'}</span></span></> 
                  : <span className="menu-slot-incompatible">Old development save · create a new character</span>
                  : <span>Create New Character</span>}
              </span>
              {hero && <ChevronRight size={15} aria-hidden="true" />}
            </button>;
          })}
        </div>
        {selectionMode === 'new' && roster.every(slot => slot.hero) && <p className="menu-slot-help">Semua slot terisi. Hapus salah satu karakter untuk membuat penjaga baru.</p>}
      </div>
      <div className="menu-model-stage selection-model-stage">
        {selected?.hero ? <CharacterPreview hero={selected.hero} presentation="menu" /> : <div className="menu-empty-stage"><Sparkles size={30} strokeWidth={1} /><span>Perjalanan baru menantimu</span></div>}
      </div>
      <footer className="menu-screen-footer">
        <Back onClick={props.onBack} />
        <div className="menu-footer-actions">
          {selected?.hero && <button className="fantasy-button menu-delete" onClick={() => props.onDelete(selected)}><Trash2 size={15} />DELETE CHARACTER</button>}
          {selectionMode === 'load' ? <button className="fantasy-button fantasy-primary" disabled={!props.ready || !selected?.hero || !isCompatibleCharacterSave(selected.hero)} onClick={props.onEnter}><Sparkles size={17} />ENTER WORLD</button>
            : <button className="fantasy-button fantasy-primary" disabled={!props.ready || !!selected?.hero} onClick={() => props.onSlot(selectedSlot)}><Plus size={17} />CREATE CHARACTER</button>}
        </div>
      </footer>
    </>}

    {flow === 'creation' && <>
      <ScreenTitle>Character Creation</ScreenTitle>
      <div className="menu-customization menu-glass">
        <ChoiceGroup label="JALUR KARAKTER" value={props.architecture}
          choices={[{ id: 'v2_test', label: 'V2 · Klasik' }, { id: 'v3_adventurer', label: 'V3 · Warrior / Berserker' }]}
          onChange={value => props.onArchitecture(value as 'v2_test' | 'v3_adventurer')} />
        <p className="menu-slot-help">Pilihan berlaku untuk karakter baru ini. Karakter lama tetap pada jalurnya.</p>
        <fieldset className="menu-choice-group menu-gender-group"><legend>GENDER</legend><div className="menu-genders">
          <button type="button" aria-pressed={appearance.gender === 'male'} onClick={() => update('gender', 'male')}><span aria-hidden="true">♂</span>Male</button>
          <button type="button" aria-pressed={appearance.gender === 'female'} onClick={() => update('gender', 'female')}><span aria-hidden="true">♀</span>Female</button>
        </div></fieldset>
        <ChoiceGroup label="FACE STYLE" value={appearance.faceStyleId} choices={FACE_STYLE_PRESETS} onChange={value => update('faceStyleId', value)} />
        <ChoiceGroup label="HAIR STYLE" value={appearance.hairStyleId} choices={HAIR_STYLE_PRESETS} onChange={value => update('hairStyleId', value)} />
        <ChoiceGroup label="HAIR COLOR" value={appearance.hairColorId} choices={HAIR_COLOR_PRESETS} onChange={value => update('hairColorId', value)} swatches />
        <ChoiceGroup label="SKIN TONE" value={appearance.skinToneId} choices={SKIN_TONE_PRESETS} onChange={value => update('skinToneId', value)} swatches />
      </div>
      <div className="menu-model-stage creation-model-stage"><CharacterPreview hero={previewHero} presentation="menu" /></div>
      <form className="menu-name-area" onSubmit={event => { event.preventDefault(); if (!props.validation) props.onCreate(); }}>
        <div className="menu-name-panel menu-glass">
          <label htmlFor="menu-character-name">CHARACTER NAME</label>
          <input id="menu-character-name" value={props.name} onChange={event => props.onName(event.target.value)} maxLength={16} placeholder="Nama penjagamu" autoComplete="off" spellCheck={false} aria-describedby="menu-name-help menu-name-validation" aria-invalid={!!props.name && !!props.validation} />
          <p id="menu-name-help">3–16 karakter. Huruf, angka, spasi, _ ' atau -.</p>
          <p id="menu-name-validation" className={props.name && props.validation ? 'menu-inline-error' : 'menu-name-valid'} aria-live="polite">{props.error || (props.name ? props.validation || 'Nama valid. Perjalananmu siap dimulai.' : 'Semua penjaga memulai sebagai Adventurer.')}</p>
        </div>
        <button type="submit" className="fantasy-button fantasy-primary" disabled={!props.ready || !!props.validation}><Sparkles size={18} />CREATE CHARACTER</button>
      </form>
      <div className="menu-creation-back"><Back onClick={props.onBack} /></div>
      {appearance.gender === 'female' && <a className="menu-model-credit" href="/assets/characters/female-rpg/credits.txt" target="_blank" rel="noreferrer">Model credit · Ilya.Anchouz.Danilov</a>}
    </>}

    {flow === 'options' && <div className="menu-options-content">
      <ScreenTitle>Options</ScreenTitle>
      <div className="menu-glass menu-options-panel">
        <button className="fantasy-button" onClick={props.onSound}>{props.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}AUDIO · {props.muted ? 'OFF' : 'ON'}</button>
        <button className="fantasy-button" onClick={props.onFullscreen}><Maximize2 size={18} />{props.fullscreen ? 'WINDOWED MODE' : 'FULLSCREEN'}</button>
        <p>C · Character &nbsp; K · Skill &nbsp; J · Jurnal Misi<br />1–0 · Primary Hotbar &nbsp; Q / E · Hotbar</p>
      </div>
      <Back onClick={props.onBack} />
    </div>}

    {flow === 'loading' && <div className="menu-loading-content" role="status" aria-live="polite">
      <Wordmark /><h1>Loading...</h1><p>{previewHero.characterName} <span>·</span> {destination}</p><div className="menu-loading-line" />
      <span className="menu-loading-caption">Menyiapkan dunia dan karaktermu</span>
    </div>}
    {flow === 'main' && <footer className="menu-title-footer"><span>LUMENFALL · CHAPTER I</span><span>Progres tersimpan di browser ini</span></footer>}
  </section>;
}
