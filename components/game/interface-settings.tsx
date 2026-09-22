'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  DEFAULT_UI_SCALE, MIN_UI_SCALE, MAX_UI_SCALE, UI_SCALE_STEP,
  INTERFACE_SCALE_EVENT, INTERFACE_STORAGE_KEY, normalizeUIScale, loadUIScale, saveUIScale,
} from '@/lib/game/interface-settings';

let currentScale = DEFAULT_UI_SCALE;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => currentScale;
const serverSnapshot = () => DEFAULT_UI_SCALE;

function applyScale(value: number, persist = false) {
  currentScale = normalizeUIScale(value);
  document.documentElement.style.setProperty('--lumenfall-ui-scale', String(currentScale / 100));
  if (persist) {
    try { saveUIScale(currentScale, window.localStorage); } catch { /* Storage may be blocked. */ }
  }
  // Layout coordinates remain viewport pixels. Only UI roots, not their parents, scale.
  window.dispatchEvent(new Event(INTERFACE_SCALE_EVENT));
  listeners.forEach(listener => listener());
}

/** Mount once, outside the simulation. Browser preferences are restored after hydration. */
export function InterfaceSettingsRuntime() {
  useEffect(() => {
    try { applyScale(loadUIScale(window.localStorage)); } catch { applyScale(DEFAULT_UI_SCALE); }
    const storage = (event: StorageEvent) => {
      if (event.key === INTERFACE_STORAGE_KEY || event.key === null) {
        try { applyScale(loadUIScale(window.localStorage)); } catch { /* Keep the applied value. */ }
      }
    };
    window.addEventListener('storage', storage);
    const player = document.querySelector('.player-card');
    const placeTracker = () => {
      if (player) document.documentElement.style.setProperty('--ui-player-bottom', `${player.getBoundingClientRect().bottom}px`);
    };
    const observer = new ResizeObserver(placeTracker);
    if (player) observer.observe(player);
    placeTracker();
    window.addEventListener(INTERFACE_SCALE_EVENT, placeTracker);
    window.addEventListener('resize', placeTracker);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener(INTERFACE_SCALE_EVENT, placeTracker);
      window.removeEventListener('resize', placeTracker);
      observer.disconnect();
    };
  }, []);
  return null;
}

export function InterfaceSettings() {
  const scale = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <section className="interface-settings" aria-label="Pengaturan antarmuka">
      <strong className="eyebrow">INTERFACE</strong>
      <div className="interface-scale-label">
        <label id="ui-scale-label" htmlFor="ui-scale">Ukuran UI</label>
        <output aria-live="polite">{scale}%</output>
      </div>
      <div className="interface-scale-controls">
        <button type="button" className="secondary-button" aria-label="Perkecil UI" disabled={scale <= MIN_UI_SCALE} onClick={() => applyScale(scale - UI_SCALE_STEP, true)}>−</button>
        <Slider id="ui-scale" aria-labelledby="ui-scale-label" min={MIN_UI_SCALE} max={MAX_UI_SCALE} step={UI_SCALE_STEP} value={[scale]} onValueChange={value => applyScale(Array.isArray(value) ? value[0] : value, true)} />
        <button type="button" className="secondary-button" aria-label="Perbesar UI" disabled={scale >= MAX_UI_SCALE} onClick={() => applyScale(scale + UI_SCALE_STEP, true)}>+</button>
      </div>
      <p className="muted-copy">Menu, teks, tombol, bar HP, hotbar, dan minimap berubah langsung. Tidak mengubah ukuran dunia game.</p>
      <button type="button" className="secondary-button" onClick={() => applyScale(DEFAULT_UI_SCALE, true)}>Reset ukuran UI · 100%</button>
    </section>
  );
}
