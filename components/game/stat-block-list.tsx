'use client';
import type { StatBlock } from '@/lib/game/items';
import { statDisplayLabel, statDisplayValue } from '@/lib/game/stat-presentation';
export function StatBlockList({ value }: { value: StatBlock }) {
  return (
    <div className="co-stat-lines">
      {Object.entries(value)
        .filter(([, v]) => v)
        .map(([stat, v]) => (
          <span key={stat}>
            <small>
              {statDisplayLabel(stat)}
            </small>
            <b>
              {statDisplayValue(stat, v!)}
            </b>
          </span>
        ))}
    </div>
  );
}
