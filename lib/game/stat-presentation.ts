/** Player-facing units only. Never use this metadata to roll items or calculate
 * modifiers: additive Critical Rate and multiplicative Final Damage both show %,
 * while Accuracy/Evasion and primary stats display flat numbers. */
const labels: Record<string, string> = {
  str: 'STR', vit: 'VIT', sta: 'VIT', dex: 'DEX', int: 'INT',
  critRate: 'Critical Rate', criticalRate: 'Critical Rate',
  critDamage: 'Critical Damage', criticalDamage: 'Critical Damage',
  attackSpeed: 'Attack Speed', movementSpeed: 'Movement Speed',
  physicalDamage: 'Physical Damage', physicalDamagePercent: 'Physical Damage',
  finalDamagePercent: 'Final Damage', damageReduction: 'Damage Reduction',
  attackPercent: 'Attack Power', hp: 'Max HP', maxHP: 'Max HP',
  maxHpPercent: 'Max HP', maxHPPercent: 'Max HP', maxMana: 'Max Mana', maxManaPercent: 'Max Mana',
  accuracy: 'Accuracy', evasion: 'Evasion', defense: 'Defense',
  mpRecovery: 'Mana Recovery', hpRecovery: 'HP Recovery',
};
const percentageStats = new Set([
  'critRate', 'criticalRate', 'critDamage', 'criticalDamage', 'attackSpeed', 'movementSpeed',
  'attackPercent', 'physicalDamage', 'physicalDamagePercent', 'finalDamagePercent',
  'damageReduction', 'blockRate', 'parryRate', 'bossDamage', 'eliteDamage', 'skillDamage',
  'physicalPenetration', 'magicPenetration', 'cooldownReduction', 'manaCostReduction',
  'maxManaPercent', 'maxHpPercent', 'maxHPPercent', 'expGain', 'goldDropRate', 'itemDropRate',
  'materialDropRate', 'elementalDamage', 'elementalResistance', 'weakPointDamage', 'rangedDamage', 'projectileDamage', 'resourceEfficiency',
]);
export const statDisplayLabel = (stat: string) => labels[stat] ?? stat.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
export const statDisplayUnit = (stat: string) => percentageStats.has(stat) ? '%' : '';
export const statDisplayValue = (stat: string, value: number, signed = true) =>
  `${signed && value >= 0 ? '+' : ''}${Number(value.toFixed(2))}${statDisplayUnit(stat)}`;
export const statBonusText = (stat: string, value: number) => `${statDisplayLabel(stat)} ${statDisplayValue(stat, value)}`;
