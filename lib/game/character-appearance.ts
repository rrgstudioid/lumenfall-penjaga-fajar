/** Cosmetic data only. No progression, equipment, or simulation state lives here. */
export const MALE_BODY_ASSET_REVISION = 'source-chibi-bald-3';
export const MALE_HAIR_ASSET_REVISION = 'source-chibi-bald-3';
export const MALE_HAIR_STYLES = [
  ['hair_01', 'Messy Spikes'],
  ['hair_02', 'Crew Cut'],
  ['hair_03', 'Mohawk'],
  ['hair_04', 'Undercut'],
  ['hair_05', 'Ponytail'],
  ['hair_06', 'Bowl Cut'],
  ['hair_07', 'Curtain Bangs'],
  ['hair_08', 'Cornrows'],
  ['hair_09', 'Very Long Hair'],
  ['hair_10', 'Long Hair Tied'],
].map(([id, label]) => ({ id, label }));
export const MALE_SKIN_TONES = [
  { id: 'skin_01', label: 'Very Fair', color: '#f9dfcc' },
  { id: 'skin_02', label: 'Fair', color: '#f5d6bd' },
  { id: 'skin_03', label: 'Medium', color: '#e8b18f' },
  { id: 'skin_04', label: 'Tan', color: '#c9825d' },
  { id: 'skin_05', label: 'Dark', color: '#8d543f' },
];
export const MALE_HAIR_COLORS = [
  ['source_brown', 'Original Brown', '#704434'],
  ['black', 'Black', '#171719'],
  ['dark_brown', 'Dark Brown', '#3b2419'],
  ['brown', 'Brown', '#6a4024'],
  ['light_brown', 'Light Brown', '#b48762'],
  ['blonde', 'Blonde', '#e3c27e'],
  ['platinum', 'Platinum', '#e8dfc7'],
  ['white', 'White', '#f0eee3'],
  ['grey', 'Grey', '#aeb8c6'],
  ['red', 'Red', '#a52b35'],
  ['orange', 'Orange', '#d57331'],
  ['pink', 'Pink', '#e194b4'],
  ['purple', 'Purple', '#8453ad'],
  ['blue', 'Blue', '#386cc4'],
  ['cyan', 'Cyan', '#40bbbd'],
  ['green', 'Green', '#4b9759'],
].map(([id, label, color]) => ({ id, label, color }));

export type MaleAppearance = {
  appearanceVersion: 2;
  gender: 'male';
  faceStyleId: string;
  hairStyleId: string;
  hairColorId: string;
  skinToneId: string;
  hairColor: string;
};
const hairAliases: Record<string, string> = {
  hair_default: 'hair_01',
  hair_wild: 'hair_01',
  hair_short: 'hair_02',
  hair_swept: 'hair_07',
};
const skinAliases: Record<string, string> = {
  tone_01: 'skin_02',
  tone_02: 'skin_03',
  tone_03: 'skin_04',
  tone_04: 'skin_05',
};
const legacyColors: Record<string, string> = {
  silver: '#aeb8c6',
  dark_red: '#6e252d',
};
export function validHairColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
export function normalizeMaleAppearance(value: unknown): MaleAppearance {
  const v =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const hair =
    typeof v.hairStyleId === 'string'
      ? (hairAliases[v.hairStyleId] ?? v.hairStyleId)
      : '';
  const skin =
    typeof v.skinToneId === 'string'
      ? (skinAliases[v.skinToneId] ?? v.skinToneId)
      : '';
  const preset = MALE_HAIR_COLORS.find((p) => p.id === v.hairColorId);
  const legacy =
    typeof v.hairColorId === 'string' &&
    Object.hasOwn(legacyColors, v.hairColorId)
      ? legacyColors[v.hairColorId]
      : undefined;
  const color = validHairColor(v.hairColor)
    ? v.hairColor.toLowerCase()
    : (preset?.color ?? legacy ?? '#704434');
  return {
    appearanceVersion: 2,
    gender: 'male',
    faceStyleId: ['face_default', 'face_soft', 'face_sharp'].includes(
      String(v.faceStyleId),
    )
      ? String(v.faceStyleId)
      : 'face_default',
    hairStyleId: MALE_HAIR_STYLES.some((p) => p.id === hair) ? hair : 'hair_01',
    skinToneId: MALE_SKIN_TONES.some((p) => p.id === skin) ? skin : 'skin_03',
    hairColor: color,
    hairColorId:
      MALE_HAIR_COLORS.find((p) => p.color === color)?.id ?? 'custom',
  };
}
