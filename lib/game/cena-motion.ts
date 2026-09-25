import { AnimationClip } from 'three';

export const CENA_LEGACY_MOTION_ASSET = '/assets/characters/cena/cena-legacy-motion.json';
export const CENA_LEGACY_CLIPS = ['Walk', 'Run', 'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03'] as const;
let motion: Promise<AnimationClip[]> | undefined;

export function loadCenaLegacyMotion() {
  motion ??= fetch(CENA_LEGACY_MOTION_ASSET).then(async response => {
    if (!response.ok) throw new Error(`Cena legacy motion HTTP ${response.status}`);
    const pack = await response.json() as { version: number; source: string; clips: Parameters<typeof AnimationClip.parse>[0][] };
    if (pack.version !== 1 || pack.source !== 'astra-hunyuan-rigged.glb') throw new Error('Unexpected Cena motion source');
    const clips = pack.clips.map(data => AnimationClip.parse(data));
    if (clips.length !== CENA_LEGACY_CLIPS.length || CENA_LEGACY_CLIPS.some(name => !clips.some(c => c.name === name))) {
      throw new Error('Incomplete Cena legacy motion pack');
    }
    if (clips.some(c => !c.uuid) || new Set(clips.map(c => c.uuid)).size !== clips.length) throw new Error('Cena motion clips must have distinct identities');
    return clips;
  }).catch(error => { motion = undefined; throw error; });
  return motion;
}
