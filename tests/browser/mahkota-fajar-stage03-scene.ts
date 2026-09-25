import { buildStage03 as buildMap } from '../../lib/game/averion-map';
export type { StageAnchor, StageManifest } from '../../lib/game/averion-map';
export const buildStage03 = (progress: (text: string) => void = () => {}, base = '/stage03-assets/') => buildMap(progress, base);
