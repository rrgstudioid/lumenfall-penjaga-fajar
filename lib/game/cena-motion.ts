import { AnimationClip } from 'three';

export const CENA_LEGACY_MOTION_ASSET = '/assets/characters/cena/cena-legacy-motion.json';
export const CENA_LEGACY_CLIPS = ['Walk', 'Run', 'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03'] as const;
export const CENA_RUN_ASSET = '/assets/characters/cena/cena-run-f0.json';
export const CENA_RUNTIME_CLIPS = [...CENA_LEGACY_CLIPS, 'Run_Start', 'Run_Stop'] as const;
let motion: Promise<AnimationClip[]> | undefined;
let runMotion: Promise<AnimationClip[]> | undefined;

export function loadCenaRunMotion() {
  runMotion ??= fetch(CENA_RUN_ASSET).then(async response => {
    if (!response.ok) throw new Error(`Cena Run F0 HTTP ${response.status}`);
    const pack = await response.json() as { version: number; source: string; clips: Parameters<typeof AnimationClip.parse>[0][] };
    if (pack.version !== 1 || pack.source !== 'Cena_Textured_RunLibrary.blend') throw new Error('Unexpected Cena Run F0 source');
    const clips = pack.clips.map(data => AnimationClip.parse(data));
    if (clips.length !== 3 || ['Run_Start', 'Run', 'Run_Stop'].some(name => clips.filter(c => c.name === name).length !== 1)
      || new Set(clips.map(c => c.uuid)).size !== 3) throw new Error('Incomplete Cena Run F0 pack');
    return clips;
  }).catch(error => { runMotion = undefined; throw error; });
  return runMotion;
}

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
