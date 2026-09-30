'use client';

import { useState } from 'react';
import { Check, Gauge, Leaf, Mountain, Sparkles } from 'lucide-react';
import type { Game } from '@/lib/game/world';
import { DEFAULT_PLAINS_QUALITY, PLAINS_QUALITY_LABELS, type PlainsQuality } from '@/lib/game/verdant-plains-quality';

const PRESETS = [
  { id: 'office', Icon: Leaf, title: 'Fokus kelancaran', description: 'Pilihan ringan untuk PC kantor.', range: 'Rumput 100 m', shadow: 'Tanpa bayangan' },
  { id: 'light', Icon: Gauge, title: 'Jangkauan lebih luas', description: 'Padang rumput luas dengan detail ringan.', range: 'Rumput 250 m', shadow: 'Tanpa bayangan' },
  { id: 'balanced', Icon: Mountain, title: 'Dunia lebih hidup', description: 'Rumput lebih lebat dengan bayangan lembut.', range: 'Rumput 250 m', shadow: 'Bayangan aktif' },
  { id: 'high', Icon: Sparkles, title: 'Detail maksimal', description: 'Tampilan terkaya untuk PC bertenaga.', range: 'Rumput 250 m', shadow: 'Bayangan detail' },
] as const;

export function GraphicsPresets({ game }: { game: Game | null }) {
  const [selected, setSelected] = useState<PlainsQuality>(() => game?.plains?.quality ?? DEFAULT_PLAINS_QUALITY);
  return <fieldset className="graphics-presets" disabled={!game?.plains}>
    <legend>Kualitas grafis</legend>
    <p className="graphics-presets-intro">Pilih tampilan yang nyaman untuk PC kamu.</p>
    <div className="graphics-preset-grid">
      {PRESETS.map(({ id, Icon, title, description, range, shadow }) => <label key={id} className={`graphics-preset-card${selected === id ? ' is-selected' : ''}`}>
        <input type="radio" name="graphics-preset" value={id} checked={selected === id}
          aria-label={`Preset ${PLAINS_QUALITY_LABELS[id]}`} aria-describedby={`graphics-preset-${id}`}
          onChange={() => {
            if (!game?.plains) return;
            game.setPlainsQuality(id);
            setSelected(game.plains.quality);
          }} />
        <span className="graphics-preset-top">
          <span className="graphics-preset-icon"><Icon size={22} strokeWidth={1.5} aria-hidden="true" /></span>
          <strong>{PLAINS_QUALITY_LABELS[id]}</strong>
          <span className="graphics-preset-check" aria-hidden="true">{selected === id && <Check size={14} />}</span>
        </span>
        <span className="graphics-preset-tag">{id === 'office' ? 'UNTUK PC KANTOR' : title}</span>
        <span className="graphics-preset-description" id={`graphics-preset-${id}`}>{description}</span>
        <span className="graphics-preset-specs"><span>{range}</span><span>{shadow}</span></span>
        <span className="graphics-preset-action">{selected === id ? 'Aktif' : 'Pilih preset'}</span>
      </label>)}
    </div>
    <output className="graphics-preset-status"><Check size={14} aria-hidden="true" />
      <span><strong>{PLAINS_QUALITY_LABELS[selected]}</strong> aktif. Perubahan langsung diterapkan.</span>
    </output>
    <p className="graphics-presets-note">HUD tetap tajam pada semua preset.</p>
  </fieldset>;
}
