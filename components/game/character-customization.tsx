'use client';
import { useState } from 'react';
import Image from 'next/image';
import { HairColorPicker } from './hair-color-picker';
import type { CharacterAppearance } from '@/lib/game/rules';
import {
  MALE_HAIR_STYLES,
  MALE_HAIR_ASSET_REVISION,
  MALE_HAIR_COLORS,
  MALE_SKIN_TONES,
  normalizeMaleAppearance,
} from '@/lib/game/character-appearance';
export function CharacterCustomization({
  value,
  onChange,
}: {
  value: CharacterAppearance;
  onChange: (v: CharacterAppearance) => void;
}) {
  const a = normalizeMaleAppearance(value);
  const [section, setSection] = useState<'hair' | 'skin' | 'color'>('hair');
  const update = (patch: Partial<CharacterAppearance>) =>
    onChange({ ...a, ...patch });
  return (
    <div className="male-customization">
      <div
        className="customization-tabs"
        role="tablist"
        aria-label="Character appearance"
      >
        {(
          [
            ['hair', 'Hairstyle'],
            ['skin', 'Skin'],
            ['color', 'Hair Color'],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => {
              setSection(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'hair' && (
        <div className="customization-thumbnails" aria-label="Hairstyle">
          {MALE_HAIR_STYLES.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={a.hairStyleId === p.id}
              onClick={() => {
                update({ hairStyleId: p.id });
              }}
            >
              <Image
                src={`/assets/characters/male-v2/thumbnails/${p.id}.webp?v=${MALE_HAIR_ASSET_REVISION}`}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                unoptimized
              />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}
      {section === 'skin' && (
        <div className="customization-skins">
          {MALE_SKIN_TONES.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={a.skinToneId === p.id}
              onClick={() => update({ skinToneId: p.id })}
            >
              <span style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      )}
      {section === 'color' && (
        <>
          <div className="customization-colors">
            {MALE_HAIR_COLORS.map((p) => (
              <button
                type="button"
                key={p.id}
                aria-label={p.label}
                title={p.label}
                aria-pressed={a.hairColor === p.color}
                style={{ background: p.color }}
                onClick={() => {
                  update({ hairColor: p.color, hairColorId: p.id });
                }}
              />
            ))}
          </div>
          <HairColorPicker
            value={a.hairColor}
            onChange={(hairColor) =>
              update({ hairColor, hairColorId: 'custom' })
            }
          />
        </>
      )}
    </div>
  );
}
