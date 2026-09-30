'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- This keyboard-accessible two-axis SV surface cannot use a native one-dimensional range input. */
import { useState, type PointerEvent } from 'react';
import {
  clampColor,
  hexToHSV,
  hsvToHex,
  type HSV,
} from '@/lib/game/hair-color';
import { validHairColor } from '@/lib/game/character-appearance';

export function HairColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [selection, setSelection] = useState(() => ({
    hex: value,
    hsv: hexToHSV(value),
  }));
  // Preserve hue for grayscale edits, while external presets stay controlled.
  const hsv =
    selection.hex === value ? selection.hsv : hexToHSV(value, selection.hsv.h);
  const update = (patch: Partial<HSV>) => {
    const next = { ...hsv, ...patch },
      hex = hsvToHex(next);
    setSelection({ hex, hsv: next });
    setDraft(null);
    onChange(hex);
  };
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    update({
      s: clampColor(((e.clientX - rect.left) / rect.width) * 100, 100),
      v: clampColor((1 - (e.clientY - rect.top) / rect.height) * 100, 100),
    });
  };
  const rgb = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (
    <div className="hair-color-picker" aria-label="Hair colour picker">
      <div
        className="hair-color-sv"
        role="slider"
        tabIndex={0}
        aria-label="Hair saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s)}
        aria-valuetext={`Saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%`}
        aria-describedby="hair-color-help"
        style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 100, v: 100 }) }}
        onPointerDown={(e) => {
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          if (
            [
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
            ].includes(e.key)
          ) {
            e.preventDefault();
            update(
              e.key === 'Home'
                ? { s: 0 }
                : e.key === 'End'
                  ? { s: 100 }
                  : e.key === 'ArrowLeft'
                    ? { s: clampColor(hsv.s - step, 100) }
                    : e.key === 'ArrowRight'
                      ? { s: clampColor(hsv.s + step, 100) }
                      : e.key === 'ArrowUp'
                        ? { v: clampColor(hsv.v + step, 100) }
                        : { v: clampColor(hsv.v - step, 100) },
            );
          }
        }}
      >
        <span
          className="hair-color-cursor"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            background: value,
          }}
        />
      </div>
      <label className="hair-color-hue">
        Hue
        <input
          type="range"
          aria-label="Hair hue"
          min="0"
          max="360"
          step="1"
          value={hsv.h}
          onChange={(e) => update({ h: Number(e.target.value) })}
        />
      </label>
      <div className="hair-color-value">
        <span className="hair-color-sample" style={{ background: value }} />
        <label>
          HEX
          <input
            aria-label="Hair color hex"
            value={draft ?? value}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value);
              if (validHairColor(e.target.value))
                onChange(e.target.value.toLowerCase());
            }}
            onBlur={() => setDraft(null)}
          />
        </label>
      </div>
      <div className="hair-color-rgb">
        {['R', 'G', 'B'].map((label, i) => (
          <label key={label}>
            {label}
            <input
              type="number"
              aria-label={`Hair ${['red', 'green', 'blue'][i]}`}
              min="0"
              max="255"
              step="1"
              value={rgb[i]}
              onChange={(e) => {
                if (e.target.value === '') return;
                const next = [...rgb];
                next[i] = Math.round(clampColor(Number(e.target.value), 255));
                setDraft(null);
                onChange(
                  '#' +
                    next.map((n) => n.toString(16).padStart(2, '0')).join(''),
                );
              }}
            />
          </label>
        ))}
      </div>
      <small id="hair-color-help">
        Geser untuk memilih warna. Tombol panah mengatur saturasi dan kecerahan.
      </small>
    </div>
  );
}
