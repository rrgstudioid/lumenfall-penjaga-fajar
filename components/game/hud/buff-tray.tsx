'use client';

import {
  EyeOff,
  Flame,
  Shield,
  ShieldCheck,
  Skull,
  Snowflake,
  Zap,
} from 'lucide-react';
import type { CombatFeedbackIndicator } from '@/lib/game/world';
import { SkillIcon } from '../skill-icon';

/** A HUD emblem, distinct from the active Twin Assault skill shortcut. */
function TempoEmblem() {
  return (
    <svg
      className="hud-tempo-emblem"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M36 8C19 1 3 18 12 33M39 16C45 30 31 45 16 38"
        stroke="#378ab5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M31 8C16 7 7 22 14 32M38 21C38 32 27 40 17 35"
        stroke="#9ce7f5"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M17 30L30 10L33 9L34 13L22 33Z"
        fill="#ceeef1"
        stroke="#80b9c6"
      />
      <path
        d="M16 29L24 34M19 33L15 39M13 37L17 40"
        stroke="#eed18e"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M28 31L15 13L12 12L12 16L23 34"
        fill="#6cafcb"
        stroke="#a0d3df"
      />
      <path
        d="M21 34L29 30M26 34L30 39"
        stroke="#d5b775"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M39 7V13M36 10H42" stroke="#f1dda9" strokeWidth="1.3" />
    </svg>
  );
}

function StatusIcon({ id }: { id: string }) {
  const Icon =
    id === 'stealth'
      ? EyeOff
      : id === 'burn'
        ? Flame
        : id === 'poison'
          ? Skull
          : id === 'slow' || id === 'freeze'
            ? Snowflake
            : id === 'stun'
              ? Zap
              : id === 'superArmor'
                ? ShieldCheck
                : Shield;
  return <Icon size={28} strokeWidth={1.5} aria-hidden="true" />;
}

export function BuffTray({
  indicators,
  statuses,
}: {
  indicators: CombatFeedbackIndicator[];
  statuses: [string, number][];
}) {
  const cards: CombatFeedbackIndicator[] = [
    ...indicators,
    ...statuses.map(([id, remaining]) => ({
      id,
      label: id.toUpperCase(),
      remaining,
      tone: 'defensive' as const,
    })),
  ];
  const columns = Math.min(4, Math.max(1, cards.length));
  const rows = Math.ceil(cards.length / columns);
  return (
    <div
      className="hud-buffs"
      aria-label="Combat states"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cards.map((card, index) => {
        const tempo = card.id === 'v3-blade-master-tempo';
        const stacked = card.stacks !== undefined && (card.maxStacks ?? 0) > 0;
        return (
          <div
            key={card.id}
            className={`hud-buff hud-panel tone-${card.tone ?? 'offensive'}${tempo ? ' hud-buff-tempo' : ''}`}
            style={{
              gridColumn: columns - (index % columns),
              gridRow: rows - Math.floor(index / columns),
            }}
            title={
              card.id === 'stealth'
                ? 'Stealth combat state — bukan jaminan tidak terdeteksi musuh.'
                : card.label
            }
          >
            <b className="hud-buff-name">{card.label}</b>
            <div className="hud-buff-body">
              <span className="hud-buff-icon">
                {tempo ? (
                  <TempoEmblem />
                ) : card.iconSkillId ? (
                  <SkillIcon id={card.iconSkillId} size={30} />
                ) : (
                  <StatusIcon id={card.id} />
                )}
              </span>
              <div className="hud-buff-details">
                {card.remaining !== undefined && (
                  <span className="hud-buff-time">
                    {Math.max(0, card.remaining).toFixed(1)}
                    <small>s</small>
                  </span>
                )}
                {stacked && (
                  <span className="hud-buff-stacks">
                    {card.stacks}
                    <small> / {card.maxStacks}</small>
                  </span>
                )}
                {stacked && (
                  <meter
                    className="sr-only"
                    aria-label={`${card.label} stacks`}
                    min={0}
                    max={card.maxStacks}
                    value={card.stacks!}
                  />
                )}
                {stacked && (
                  <span className="hud-buff-pips" aria-hidden="true">
                    {Array.from({ length: card.maxStacks! }, (_, pip) => (
                      <i key={pip} data-filled={pip < card.stacks!} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
