import * as T from 'three';
import { meteorGroundHeight } from './meteorfall-citadel-layout.ts';

export const METEORFALL_EMBER_LIMIT = 1024;
export const METEORFALL_EMBER_RADIUS = 90;
export const METEORFALL_EMBER_HEIGHT = 45;
const seed = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type Center = { x: number; y: number; z: number };

/** Frostfire's persistent world positions + bounded recycling, adapted to rising fire.
 * Camera motion changes only the recycling window, never translates live particles. */
export class MeteorfallEmberPool {
  readonly positions = new Float32Array(METEORFALL_EMBER_LIMIT * 3);
  readonly opacity = new Float32Array(METEORFALL_EMBER_LIMIT);
  private bases = new Float32Array(METEORFALL_EMBER_LIMIT);
  private floors = new Float32Array(METEORFALL_EMBER_LIMIT);
  private fresh = new Uint8Array(METEORFALL_EMBER_LIMIT).fill(1);
  private previous?: Center;
  private time = 0;
  private frame = 0;
  count = 0;

  setCount(count: number) {
    const next = Math.max(
      0,
      Math.min(METEORFALL_EMBER_LIMIT, Math.floor(count)),
    );
    if (next > this.count) this.fresh.fill(1, this.count, next);
    this.count = next;
  }

  update(center: Center, dt: number) {
    const radius = METEORFALL_EMBER_RADIUS,
      span = radius * 2;
    const reset =
      !this.previous ||
      Math.hypot(
        center.x - this.previous.x,
        center.y - this.previous.y,
        center.z - this.previous.z,
      ) > radius;
    const step = Math.max(0, dt),
      before = this.time;
    this.time += step;
    this.frame++;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      // Initialize in the new area only on entry, a large jump, or quality activation.
      if (this.fresh[i] || !this.previous || (reset && step > 0)) {
        this.positions[k] = center.x + (seed(i * 3) - 0.5) * span;
        this.positions[k + 2] = center.z + (seed(i * 3 + 1) - 0.5) * span;
        this.floors[i] =
          meteorGroundHeight({
            x: this.positions[k],
            z: this.positions[k + 2],
          }) ?? -8;
        this.bases[i] = Math.max(this.floors[i], center.y - 14);
        this.positions[k + 1] =
          this.bases[i] +
          0.2 +
          seed(i * 3 + 2) * (METEORFALL_EMBER_HEIGHT - 0.2);
        this.fresh[i] = 0;
      } else if (step > 0) {
        // Integrate the existing gentle drift/rise, without adding hero/camera deltas.
        this.positions[k] +=
          3 * (Math.sin(this.time * 0.12 + i) - Math.sin(before * 0.12 + i));
        this.positions[k + 1] += step * (0.5 + seed(i));
        let wrapped = false;
        for (const axis of [0, 2]) {
          const c = axis === 0 ? center.x : center.z;
          if (Math.abs(this.positions[k + axis] - c) > radius) {
            this.positions[k + axis] =
              c +
              ((((this.positions[k + axis] - c + radius) % span) + span) %
                span) -
              radius;
            wrapped = true;
          }
        }
        if (wrapped || (i + this.frame) % 8 === 0)
          this.floors[i] =
            meteorGroundHeight({
              x: this.positions[k],
              z: this.positions[k + 2],
            }) ?? -8;
        if (
          wrapped ||
          this.positions[k + 1] < this.floors[i] + 0.2 ||
          this.positions[k + 1] > this.bases[i] + METEORFALL_EMBER_HEIGHT
        ) {
          this.bases[i] = Math.max(this.floors[i], center.y - 14);
          this.positions[k + 1] =
            this.bases[i] +
            0.2 +
            (wrapped ? seed(i * 3 + 2) * (METEORFALL_EMBER_HEIGHT - 0.2) : 0);
        }
      }
      const edge = Math.max(
        Math.abs(this.positions[k] - center.x),
        Math.abs(this.positions[k + 2] - center.z),
      );
      const height =
        (this.positions[k + 1] - this.bases[i]) / METEORFALL_EMBER_HEIGHT;
      this.opacity[i] =
        (1 - smooth(radius * 0.8, radius, edge)) *
        smooth(0, 0.06, height) *
        (1 - smooth(0.85, 1, height));
    }
    if (step > 0 || !this.previous) this.previous = { ...center };
  }
}

export function createMeteorfallEmbers(count: number) {
  const pool = new MeteorfallEmberPool();
  pool.setCount(count);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(pool.positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'emberOpacity',
    new T.BufferAttribute(pool.opacity, 1).setUsage(T.DynamicDrawUsage),
  );
  const material = new T.PointsMaterial({
    color: '#ff9b36',
    size: 0.16,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float emberOpacity;varying float vEmberOpacity;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvEmberOpacity=emberOpacity;',
      );
    shader.fragmentShader =
      'varying float vEmberOpacity;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a*=vEmberOpacity;',
      );
  };
  material.customProgramCacheKey = () => 'meteorfall-world-embers-v1';
  const mesh = new T.Points(geometry, material);
  mesh.name = 'Meteorfall world-space embers';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  geometry.setDrawRange(0, pool.count);
  return {
    mesh,
    setCount(next: number) {
      pool.setCount(next);
      geometry.setDrawRange(0, pool.count);
    },
    update(camera: T.Camera, dt: number) {
      pool.update(camera.position, dt);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.emberOpacity.needsUpdate = true;
    },
  };
}
