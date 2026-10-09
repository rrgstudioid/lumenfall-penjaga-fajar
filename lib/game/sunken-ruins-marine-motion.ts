import {
  sunkenFloorDistance,
  sunkenGroundHeight,
} from './sunken-ruins-layout.ts';
import { SUNKEN_ARTIFACTS } from './sunken-ruins-artifact-layout.ts';

/** Habitats and time define wildlife positions. The observer only decides visibility. */
export const SUNKEN_HABITATS = Array.from({ length: 16 * 16 }, (_, i) => ({
  id: i,
  x: -480 + (i % 16) * 64,
  z: -480 + Math.floor(i / 16) * 64,
})).filter(
  (p) =>
    sunkenFloorDistance(p) < -8 &&
    SUNKEN_ARTIFACTS.every(
      (a) => Math.hypot(a.x - p.x, a.z - p.z) > a.radius + 30,
    ),
);

export function marinePose(
  habitat: { id: number; x: number; z: number },
  index: number,
  time: number,
  kind: 'fish' | 'jellyfish' | 'ray',
  heightAt = sunkenGroundHeight,
) {
  const phase = habitat.id * 2.399 + index * 0.71;
  const a = time * (kind === 'ray' ? 0.045 : 0.095) + habitat.id * 1.7;
  const radius = kind === 'ray' ? 24 : 12;
  const x =
    habitat.x +
    Math.cos(a) * radius +
    Math.sin(phase) * (kind === 'jellyfish' ? 18 : 3);
  const z = habitat.z + Math.sin(a) * radius + Math.cos(phase) * 3;
  return {
    x,
    z,
    y:
      heightAt(habitat.x, habitat.z) +
      (kind === 'ray' ? 12 : kind === 'jellyfish' ? 4 : 5) +
      Math.sin(time * 0.7 + phase) * 0.45 +
      (index % 3) * 0.6,
    // Exported fish face -X; the Blender ray faces +Z after glTF axis conversion.
    yaw: kind === 'ray' ? -a : Math.PI / 2 - a,
    phase,
  };
}
