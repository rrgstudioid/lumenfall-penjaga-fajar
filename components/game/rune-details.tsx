'use client';
import { JobText } from './job-presentation-context';

import { RUNE_RARITY_RULES, type ItemData } from '@/lib/game/items';
import { ItemIcon } from './entry-icon';
import { ItemHover } from './item-hover';

/** Read-only view of the actual owned Rune, shared by Forge and Inventory. */
export function RuneDetails({ rune }: { rune: ItemData }) {
  return (
    <div className="rune-details">
      <ItemHover as="div" item={rune} className="forge-rune">
        <ItemIcon item={rune} />
        <strong><JobText>{rune.name}</JobText></strong>
      </ItemHover>
      <small
        style={{
          color: rune.runeRarity
            ? RUNE_RARITY_RULES[rune.runeRarity].color
            : undefined,
        }}
      >
        {rune.runeRarity?.toUpperCase()} · {rune.runeTheme}
        {rune.runeQualityFixed ? ' · Quality tetap' : ''}
      </small>
      <div aria-label="Rune Stats">
        {rune.affixes.map((affix) => (
          <p key={affix.id}>
            {affix.label} +{affix.value}
            {affix.unit === 'percent' ? '%' : ''}
          </p>
        ))}
      </div>
      {rune.uniqueEffect && (
        <p className="unique-effect">✦ <JobText>{rune.uniqueEffect}</JobText></p>
      )}
      {rune.runeJobRequirement && (
        <small>Khusus job: <JobText>{rune.runeJobRequirement}</JobText></small>
      )}
      <small>Sumber: {rune.runeSource ?? rune.source.label}</small>
    </div>
  );
}
