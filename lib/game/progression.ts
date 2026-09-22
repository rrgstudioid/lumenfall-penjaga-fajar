/** Explicit development path; no live activation or new XP curve. */
export const ABSOLUTE_MAX_LEVEL = 100;
export const LEGACY_CONTENT_CAP = 50;
export const V2_TEST_CONTENT_CAP = 80;
export type ProgressionArchitecture = 'legacy' | 'v2_test' | 'v3_adventurer';
export const PROGRESSION = Object.freeze({
  legacy: Object.freeze({
    contentCap: LEGACY_CONTENT_CAP,
    coreLevel: 10,
    specializationLevel: 25,
    advancedPlayable: false,
  }),
  v2_test: Object.freeze({
    contentCap: V2_TEST_CONTENT_CAP,
    coreLevel: 15,
    specializationLevel: 60,
    advancedPlayable: false,
  }),
  v3_adventurer: Object.freeze({
    contentCap: V2_TEST_CONTENT_CAP,
    coreLevel: 15,
    specializationLevel: 60,
    advancedPlayable: false,
  }),
});
export function progressionRules(hero: {
  progressionArchitecture?: ProgressionArchitecture;
}) {
  return PROGRESSION[
    hero.progressionArchitecture === 'v2_test'
      ? 'v2_test'
      : hero.progressionArchitecture === 'v3_adventurer'
        ? 'v3_adventurer'
        : 'legacy'
  ];
}
