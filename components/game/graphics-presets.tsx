'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Game } from '@/lib/game/world';
import {
  loadGraphicsQuality,
  type GraphicsQuality,
} from '@/lib/game/graphics-quality';
import { PLAINS_QUALITY_LABELS } from '@/lib/game/verdant-plains-quality';

export function GraphicsPresets({ game }: { game: Game | null }) {
  const [selected, setSelected] = useState<GraphicsQuality>(
    () => game?.graphicsQuality ?? loadGraphicsQuality(),
  );
  return (
    <fieldset
      className="graphics-presets"
      disabled={!game}
      aria-label="Graphics"
    >
      <div className="graphics-preset-grid">
        {(Object.keys(PLAINS_QUALITY_LABELS) as GraphicsQuality[]).map((id) => (
          <label
            key={id}
            className={`graphics-preset-card${selected === id ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name="graphics-preset"
              value={id}
              checked={selected === id}
              aria-label={PLAINS_QUALITY_LABELS[id]}
              onChange={() => {
                if (!game) return;
                game.setGraphicsQuality(id);
                setSelected(game.graphicsQuality);
              }}
            />
            <span className="graphics-preset-top">
              <strong>{PLAINS_QUALITY_LABELS[id]}</strong>
              <span className="graphics-preset-check" aria-hidden="true">
                {selected === id && <Check size={14} />}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
