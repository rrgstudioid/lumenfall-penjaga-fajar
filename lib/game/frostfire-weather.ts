import * as T from 'three';
import { frostHeight } from './frostfire-highlands-layout';
export const FROST_SNOW_COUNT = 2000,
  FROST_SNOW_RADIUS = 32,
  FROST_SNOW_HEIGHT = 32;
export const FROST_STORM = {
  windMultiplier: 5.5,
  fallMultiplier: 2.2,
  fogColor: '#e0d9d5',
  fogDensity: 0.006,
} as const;
// Sprite width/height in CSS pixels; framebuffer scaling is applied afterwards.
export const FROST_SNOW_SIZE = {
  minPx: 2,
  maxPx: 10,
  nearScale: 200,
  variation: 170,
} as const;
/** UDS texture inputs, browser-native bounded particle motion. No Unreal simulation. */
export function createFrostWeather(sprite: T.Texture, windMap: T.Texture) {
  // A smaller volume makes the reduced particle budget denser near the camera.
  const radius = FROST_SNOW_RADIUS,
    span = radius * 2;
  const geometry = new T.BufferGeometry(),
    positions = new Float32Array(FROST_SNOW_COUNT * 3),
    seeds = new Float32Array(FROST_SNOW_COUNT),
    floors = new Float32Array(FROST_SNOW_COUNT);
  for (let i = 0; i < FROST_SNOW_COUNT; i++) {
    seeds[i] = ((i * 16807 + 71) % 2147483647) / 2147483647;
    positions[i * 3] = ((i * 73.317) % span) - radius;
    positions[i * 3 + 1] = (i * 17.17) % FROST_SNOW_HEIGHT;
    positions[i * 3 + 2] = ((i * 97.719) % span) - radius;
  }
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute('seed', new T.BufferAttribute(seeds, 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uSprite: { value: sprite },
      uWind: { value: windMap },
      uTime: { value: 0 },
      uPixel: { value: 1 },
      uFogDensity: { value: FROST_STORM.fogDensity },
      uRadius: { value: radius },
      uSize: {
        value: new T.Vector4(
          FROST_SNOW_SIZE.minPx,
          FROST_SNOW_SIZE.maxPx,
          FROST_SNOW_SIZE.nearScale,
          FROST_SNOW_SIZE.variation,
        ),
      },
      uCenter: { value: new T.Vector2() },
    },
    vertexShader: `
    attribute float seed;uniform float uPixel,uTime,uFogDensity,uRadius;uniform vec4 uSize;uniform sampler2D uWind;uniform vec2 uCenter;varying float vOpacity;
    void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
      gl_PointSize=clamp((uSize.z+fract(seed*731.0)*uSize.w)/max(5.0,-p.z),uSize.x,uSize.y)*uPixel;
      float density=texture2D(uWind,position.xz*.007+vec2(uTime*.006,0.)).r;
      vOpacity=(1.-smoothstep(uRadius*.65,uRadius,length(position.xz-uCenter)))*(.56+density*.4);
      vOpacity*=exp(-dot(p.xyz,p.xyz)*uFogDensity*uFogDensity*.7);
    }`,
    fragmentShader: `uniform sampler2D uSprite;varying float vOpacity;void main(){vec4 flake=texture2D(uSprite,gl_PointCoord);float a=flake.a*vOpacity;if(a<.015)discard;gl_FragColor=vec4(.88,.95,1.,a);}`,
  });
  const mesh = new T.Points(geometry, material);
  mesh.name = 'Frostfire local wind-driven snow';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  let initialized = false,
    cx = 0,
    cz = 0,
    time = 0,
    frame = 0;
  function update(camera: T.Camera, dt: number, pixelRatio: number) {
    if (dt <= 0) return;
    time += dt;
    frame++;
    const x = camera.position.x,
      z = camera.position.z,
      ground = frostHeight(x, z),
      base = Math.max(ground, camera.position.y - 14);
    const reset = !initialized || Math.hypot(x - cx, z - cz) > radius;
    const windX = 3 + Math.sin(time * 0.27) * 2.2 + Math.sin(time * 0.73) * 1.4,
      windZ = -1.1 + Math.sin(time * 0.19) * 2;
    for (let i = 0; i < FROST_SNOW_COUNT; i++) {
      const k = i * 3,
        phase = i * 2.399;
      if (reset) {
        positions[k] = x + ((i * 73.317) % span) - radius;
        positions[k + 2] = z + ((i * 97.719) % span) - radius;
        floors[i] = frostHeight(positions[k], positions[k + 2]);
        positions[k + 1] =
          Math.max(base, floors[i]) + ((i * 17.17) % FROST_SNOW_HEIGHT);
      }
      positions[k] +=
        dt *
        FROST_STORM.windMultiplier *
        (windX + Math.sin(time * 1.4 + phase) * 1.3);
      positions[k + 2] +=
        dt *
        FROST_STORM.windMultiplier *
        (windZ + Math.cos(time * 0.9 + phase) * 1.1);
      positions[k + 1] -=
        dt * FROST_STORM.fallMultiplier * (1.4 + (i % 11) * 0.17);
      let wrapped = false;
      if (Math.abs(positions[k] - x) > radius) {
        positions[k] = x + ((positions[k] - x + radius + span) % span) - radius;
        wrapped = true;
      }
      if (Math.abs(positions[k + 2] - z) > radius) {
        positions[k + 2] =
          z + ((positions[k + 2] - z + radius + span) % span) - radius;
        wrapped = true;
      }
      // Strong wind crosses slopes quickly. Refresh a staggered eighth of
      // the cached ground samples each frame to keep flakes above the land.
      if (wrapped || (i + frame) % 8 === 0) {
        floors[i] = frostHeight(positions[k], positions[k + 2]);
      }
      if (positions[k + 1] < floors[i] + 0.2) {
        floors[i] = frostHeight(positions[k], positions[k + 2]);
        positions[k + 1] =
          Math.max(base, floors[i]) +
          FROST_SNOW_HEIGHT * (0.7 + ((i % 15) / 14) * 0.3);
      }
    }
    initialized = true;
    cx = x;
    cz = z;
    (geometry.getAttribute('position') as T.BufferAttribute).needsUpdate = true;
    material.uniforms.uTime.value = time;
    material.uniforms.uPixel.value = pixelRatio;
    material.uniforms.uCenter.value.set(x, z);
  }
  return {
    mesh,
    update,
    metrics: () => ({
      particles: FROST_SNOW_COUNT,
      radius: FROST_SNOW_RADIUS,
      height: FROST_SNOW_HEIGHT,
      windMultiplier: FROST_STORM.windMultiplier,
      fallMultiplier: FROST_STORM.fallMultiplier,
      fogDensity: FROST_STORM.fogDensity,
      spriteSizeCssPx: {
        min: FROST_SNOW_SIZE.minPx,
        max: FROST_SNOW_SIZE.maxPx,
      },
    }),
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
