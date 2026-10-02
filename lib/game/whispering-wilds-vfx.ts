import * as T from 'three';
import {
  wildsGroundHeight,
  wildsTerrainHeight,
  type WildsPoint,
} from './whispering-wilds-layout.ts';
import {
  WILDS_QUALITY,
  WILDS_GRASS_RENDER,
  type WildsQuality,
} from './whispering-wilds-quality.ts';
import { wildsGrassGround } from './whispering-wilds-grass.ts';
export type WildsEmitter = WildsPoint & { count: number; purple: boolean };
export function wildsEmitters(): WildsEmitter[] {
  const list: WildsEmitter[] = [];
  for (let z = -456; z <= 456; z += 24)
    for (let x = -456; x <= 456; x += 24)
      if (wildsGrassGround(x, z) !== undefined)
        list.push({ x, z, count: 48, purple: false });
  return list;
}
export const WILDS_FIREFLY_PALETTE = [
  '#ff345f',
  '#ff942e',
  '#ffe63d',
  '#53ff87',
  '#35eeff',
  '#6675ff',
  '#df4fff',
] as const;
export const fireflyColorIndex = (seed: number) =>
  ((seed % WILDS_FIREFLY_PALETTE.length) + WILDS_FIREFLY_PALETTE.length) %
  WILDS_FIREFLY_PALETTE.length;
export function createWildsVfx(quality: WildsQuality) {
  const root = new T.Group();
  root.name = 'Local rainbow fireflies';
  const emitters = wildsEmitters(),
    capacity = WILDS_QUALITY.high.fireflies,
    positions = new Float32Array(capacity * 3),
    colors = new Float32Array(capacity * 3),
    slopes = new Float32Array(capacity * 2),
    seeds = new Float32Array(capacity),
    fades = new Float32Array(capacity);
  const reactions = new Float32Array(capacity * 3),
    velocities = new Float32Array(capacity * 3),
    cooldowns = new Float32Array(capacity);
  const owners = new Int32Array(capacity).fill(-1),
    targets = new Float32Array(capacity),
    slotParticle = new Int16Array(capacity);
  const slotByEmitterParticle = new Map<number, number>(),
    freeSlots = Array.from(
      { length: WILDS_QUALITY[quality].fireflies },
      (_, index) => index,
    );
  const palette = WILDS_FIREFLY_PALETTE.map((color) => new T.Color(color));
  const geometry = new T.BufferGeometry();
  // Stable simulation slots; compact only visible slots into the GPU index list.
  const drawIndices = new T.BufferAttribute(
    new Uint16Array(capacity),
    1,
  ).setUsage(T.DynamicDrawUsage);
  geometry.setIndex(drawIndices);
  geometry.setDrawRange(0, 0);
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  geometry.setAttribute('seed', new T.BufferAttribute(seeds, 1));
  geometry.setAttribute('groundSlope', new T.BufferAttribute(slopes, 2));
  geometry.setAttribute(
    'reaction',
    new T.BufferAttribute(reactions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'fade',
    new T.BufferAttribute(fades, 1).setUsage(T.DynamicDrawUsage),
  );
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: T.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uFocus: { value: new T.Vector2() },
      uRange: { value: WILDS_GRASS_RENDER.outer },
      uFadeStart: { value: WILDS_GRASS_RENDER.outerStart },
    },
    vertexShader: `attribute float seed;attribute float fade;attribute vec2 groundSlope;attribute vec3 reaction;uniform float uTime,uDpr,uRange,uFadeStart;uniform vec2 uFocus;varying vec3 vColor;varying float vFade;
      void main(){float t=uTime;vec3 p=position;
      vec2 drift=vec2(
        sin(t*(.65+fract(seed)*.4)+seed)*.8+sin(t*1.47+seed*1.7)*.2,
        cos(t*(.55+fract(seed*.3)*.35)+seed*2.1)*.8+sin(t*1.1+seed*.7)*.25);
      p.xz+=drift+reaction.xz;
      p.y+=dot(groundSlope,drift+reaction.xz)+sin(t*(1.15+fract(seed)*.4)+seed*3.0)*.12+reaction.y;
      vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((1540.0+fract(seed)*490.0)/max(6.0,-mv.z),7.0,72.0)*uDpr;
      vFade=fade*smoothstep(2.0,7.0,-mv.z)*(1.-smoothstep(uFadeStart,uRange,distance(p.xz,uFocus)))*(.82+.18*sin(t*.7+seed));vColor=color;}`,
    fragmentShader: `varying vec3 vColor;varying float vFade;void main(){float r=length(gl_PointCoord-.5)*2.0;
      float halo=exp(-r*r*4.2)*.85;float core=exp(-r*r*65.0);
      float a=(halo+core)*vFade*(1.-smoothstep(.8,1.,r));
      if(r>1.0||a<.005)discard;gl_FragColor=vec4(mix(vColor,vec3(1.),core*.3)*2.8,a);}`,
  });
  const particles = new T.Points(geometry, material);
  particles.frustumCulled = false;
  particles.raycast = () => {};
  root.add(particles);
  let elapsed = 0,
    nextCheck = -1,
    currentQuality = quality,
    enabled = true,
    disposed = false,
    active = 0,
    submitted = 0,
    farthest = 0;
  const previousPlayer = new T.Vector2(NaN, NaN);
  let reacting = 0,
    collisions = 0;
  const activeEmitters = new Set<number>(),
    frustum = new T.Frustum(),
    matrix = new T.Matrix4(),
    sphere = new T.Sphere(new T.Vector3(), 20),
    pointSphere = new T.Sphere(new T.Vector3(), 2.5);
  const emitterHeights = emitters.map((e) => wildsGroundHeight(e.x, e.z) + 2);
  function update(
    camera: T.Camera,
    player: WildsPoint,
    dt: number,
    dpr: number,
    free = false,
  ) {
    if (disposed) return;
    const step = Math.min(0.1, Math.max(0, dt));
    elapsed += step;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uDpr.value = dpr;
    root.visible = enabled;
    if (!enabled) {
      submitted = 0;
      geometry.setDrawRange(0, 0);
      return;
    }
    const profile = WILDS_QUALITY[currentQuality];
    const focus = free ? camera.position : player;
    material.uniforms.uFocus.value.set(focus.x, focus.z);
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    if (elapsed >= nextCheck) {
      nextCheck = elapsed + 0.1;
      const nearby = emitters
        .map((e, id) => ({
          id,
          e,
          d: Math.hypot(e.x - focus.x, e.z - focus.z),
        }))
        .filter((a) => {
          sphere.center.set(a.e.x, emitterHeights[a.id], a.e.z);
          return (
            a.d < WILDS_GRASS_RENDER.outer + sphere.radius &&
            (a.d < 35 || frustum.intersectsSphere(sphere))
          );
        })
        .sort((a, b) => a.d - b.d);
      activeEmitters.clear();
      targets.fill(0);
      let wanted = 0;
      // Round-robin coverage avoids nearby clusters consuming the entire budget
      // before any fireflies at 110–250 m can be allocated.
      for (let j = 0; j < 48 && wanted < profile.fireflies; j++) {
        for (const { id, e, d } of nearby) {
          const count =
            d < 65 ? e.count : Math.max(1, Math.floor(e.count * 0.22));
          if (j >= count || wanted >= profile.fireflies) continue;
          wanted++;
          activeEmitters.add(id);
          const key = id * 48 + j;
          let slot = slotByEmitterParticle.get(key) ?? -1;
          if (slot < 0) slot = freeSlots.pop() ?? -1;
          if (slot < 0) break;
          if (owners[slot] < 0) {
            owners[slot] = id;
            slotParticle[slot] = j;
            slotByEmitterParticle.set(key, slot);
            const s = id * 97 + j * 13,
              angle = s * 2.399,
              spread = 2 + (s % 43) / 3.8;
            let x = e.x + Math.cos(angle) * spread,
              z = e.z + Math.sin(angle) * spread,
              ground = wildsGrassGround(x, z);
            if (ground === undefined) {
              x = e.x;
              z = e.z;
              ground = wildsGroundHeight(x, z);
            }
            positions.set([x, ground + 1.35 + (s % 17) / 50, z], slot * 3);
            slopes.set(
              [
                (wildsTerrainHeight(x + 1, z) - wildsTerrainHeight(x - 1, z)) /
                  2,
                (wildsTerrainHeight(x, z + 1) - wildsTerrainHeight(x, z - 1)) /
                  2,
              ],
              slot * 2,
            );
            palette[fireflyColorIndex(s)].toArray(colors, slot * 3);
            seeds[slot] = s * 0.17;
          }
          targets[slot] = d < 65 ? 1 : 0.35;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.seed.needsUpdate = true;
      geometry.attributes.groundSlope.needsUpdate = true;
    }
    active = 0;
    submitted = 0;
    farthest = 0;
    reacting = 0;
    if (
      !Number.isFinite(previousPlayer.x) ||
      Math.hypot(player.x - previousPlayer.x, player.z - previousPlayer.y) > 12
    )
      previousPlayer.set(player.x, player.z);
    const sx = player.x - previousPlayer.x,
      sz = player.z - previousPlayer.y,
      segmentLength = sx * sx + sz * sz;
    const playerY = wildsGroundHeight(player.x, player.z) + 1.25;
    for (let i = 0; i < profile.fireflies; i++) {
      fades[i] += (targets[i] - fades[i]) * Math.min(1, step * 5);
      if (owners[i] >= 0 && targets[i] === 0 && fades[i] < 0.01) {
        slotByEmitterParticle.delete(owners[i] * 48 + slotParticle[i]);
        owners[i] = -1;
        fades[i] = 0;
        reactions.fill(0, i * 3, i * 3 + 3);
        velocities.fill(0, i * 3, i * 3 + 3);
        cooldowns[i] = 0;
        freeSlots.push(i);
      }
      if (owners[i] >= 0) {
        active++;
        const k = i * 3,
          s = seeds[i],
          fraction = s - Math.floor(s),
          fraction3 = s * 0.3 - Math.floor(s * 0.3);
        const dx =
          Math.sin(elapsed * (0.65 + fraction * 0.4) + s) * 0.8 +
          Math.sin(elapsed * 1.47 + s * 1.7) * 0.2;
        const dz =
          Math.cos(elapsed * (0.55 + fraction3 * 0.35) + s * 2.1) * 0.8 +
          Math.sin(elapsed * 1.1 + s * 0.7) * 0.25;
        const x = positions[k] + dx + reactions[k],
          z = positions[k + 2] + dz + reactions[k + 2];
        const y =
          positions[k + 1] +
          slopes[i * 2] * (dx + reactions[k]) +
          slopes[i * 2 + 1] * (dz + reactions[k + 2]) +
          reactions[k + 1];
        const along = Math.max(
          0,
          Math.min(
            1,
            ((x - previousPlayer.x) * sx + (z - previousPlayer.y) * sz) /
              Math.max(0.0001, segmentLength),
          ),
        );
        let awayX = x - (previousPlayer.x + sx * along),
          awayZ = z - (previousPlayer.y + sz * along);
        const distance = Math.hypot(awayX, awayZ);
        cooldowns[i] = Math.max(0, cooldowns[i] - step);
        if (
          step > 0 &&
          cooldowns[i] === 0 &&
          fades[i] > 0.15 &&
          distance < 1.8 &&
          Math.abs(y - playerY) < 1.8
        ) {
          if (distance < 0.01) {
            awayX = Math.cos(s);
            awayZ = Math.sin(s);
          }
          const length = Math.max(0.01, Math.hypot(awayX, awayZ));
          velocities[k] += (awayX / length) * 5.5;
          velocities[k + 2] += (awayZ / length) * 5.5;
          velocities[k + 1] += 1.8;
          cooldowns[i] = 0.9;
          collisions++;
        }
        for (let axis = 0; axis < 3; axis++) {
          velocities[k + axis] +=
            (-reactions[k + axis] * 5.5 - velocities[k + axis] * 4.5) * step;
          reactions[k + axis] += velocities[k + axis] * step;
        }
        if (Math.hypot(reactions[k], reactions[k + 1], reactions[k + 2]) > 0.04)
          reacting++;
        const distanceToFocus = Math.hypot(x - focus.x, z - focus.z);
        pointSphere.center.set(x, y, z);
        if (
          fades[i] >= 0.01 &&
          distanceToFocus < WILDS_GRASS_RENDER.outer &&
          frustum.intersectsSphere(pointSphere)
        ) {
          drawIndices.setX(submitted++, i);
          farthest = Math.max(farthest, distanceToFocus);
        }
      }
    }
    previousPlayer.set(player.x, player.z);
    geometry.attributes.fade.needsUpdate = true;
    geometry.attributes.reaction.needsUpdate = true;
    drawIndices.needsUpdate = true;
    geometry.setDrawRange(0, submitted);
  }
  return {
    root,
    update,
    setQuality(q: WildsQuality) {
      currentQuality = q;
      owners.fill(-1);
      fades.fill(0);
      targets.fill(0);
      reactions.fill(0);
      velocities.fill(0);
      cooldowns.fill(0);
      slotByEmitterParticle.clear();
      freeSlots.length = 0;
      for (let i = 0; i < WILDS_QUALITY[q].fireflies; i++)
        freeSlots.push(i);
      previousPlayer.set(NaN, NaN);
      reacting = 0;
      nextCheck = -1;
      active = submitted = 0;
      geometry.setDrawRange(0, 0);
    },
    setEnabled(value: boolean) {
      enabled = value;
      root.visible = value;
    },
    metrics: () => ({
      emitters: emitters.length,
      activeClusters: activeEmitters.size,
      activeFireflies: active,
      gpuFireflies: submitted,
      renderRange: WILDS_GRASS_RENDER.outer,
      fadeStart: WILDS_GRASS_RENDER.outerStart,
      farthestRendered: farthest,
      fireflyCap: WILDS_QUALITY[currentQuality].fireflies,
      mistCap: 0,
      enabled,
      reactingFireflies: reacting,
      playerContacts: collisions,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
      root.clear();
    },
  };
}
