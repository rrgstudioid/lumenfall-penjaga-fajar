'use client';
import type { StatBlock } from '@/lib/game/items';
const number = (value: number) => Math.round(value * 10) / 10;
const statDisplayMeta: Partial<
  Record<keyof StatBlock, { label: string; unit?: string }>
> = {
  attackPercent: { label: 'Attack Power', unit: '%' },
  physicalDamage: { label: 'Physical Damage', unit: '%' },
  vit: { label: 'Vitality' },
  magicAttack: { label: 'Magic Attack' },
  magicDefense: { label: 'Magic Defense' },
  critRate: { label: 'Critical Rate', unit: '%' },
  critDamage: { label: 'Critical Damage', unit: '%' },
  bossDamage: { label: 'Damage terhadap Boss', unit: '%' },
  skillDamage: { label: 'Skill Damage', unit: '%' },
  damageReduction: { label: 'Damage Reduction', unit: '%' },
  blockRate: { label: 'Block Rate', unit: '%' },
  skillPower: { label: 'Skill Power' },
  physicalPenetration: { label: 'Physical Penetration', unit: '%' },
  magicPenetration: { label: 'Magic Penetration', unit: '%' },
  cooldownReduction: { label: 'Cooldown Reduction', unit: '%' },
  itemDropRate: { label: 'Item Drop Rate', unit: '%' },
};
export function StatBlockList({ value }: { value: StatBlock }) {
  return (
    <div className="co-stat-lines">
      {Object.entries(value)
        .filter(([, v]) => v)
        .map(([stat, v]) => (
          <span key={stat}>
            <small>
              {statDisplayMeta[stat as keyof StatBlock]?.label ??
                (stat === 'resourceEfficiency' || stat === 'maxMana'
                  ? 'Max MP'
                  : stat === 'mpRecovery'
                    ? 'MP Recovery'
                    : stat.replace(/([A-Z])/g, ' $1'))}
            </small>
            <b>
              +{number(v!)}
              {statDisplayMeta[stat as keyof StatBlock]?.unit ?? ''}
            </b>
          </span>
        ))}
    </div>
  );
}
