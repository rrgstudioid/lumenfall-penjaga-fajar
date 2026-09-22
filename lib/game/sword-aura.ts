import * as T from 'three';
import type { ItemData } from './items.ts';

// Prepared from the supplied FootageCrate PNG sequence; no video playback.
export const SWORD_AURA = Object.freeze({
  url: '/assets/vfx/sword-flame-13.webp', columns: 8, rows: 7, frames: 52, fps: 15,
  minimumEnhancement: 5, sizeMultiplier: 2.5, widthMultiplier: 1, planeCount: 4,
});
export const SWORD_INFERNO_AURA = Object.freeze({
  url: '/assets/vfx/sword-inferno-13.webp', columns: 7, rows: 6, frames: 41, fps: 18,
  minimumEnhancement: 10, sizeMultiplier: 1.25, widthMultiplier: 1.8, planeCount: 3,
});
export const WEAPON_ENERGY_AURA = Object.freeze({
  url: '/assets/vfx/weapon-energy-ball.webp', columns: 8, rows: 7, frames: 50, fps: 18,
  minimumEnhancement: 10, sizeMultiplier: 1, widthMultiplier: .8, planeCount: 8,
});
export function hasSwordAura(item: Pick<ItemData, 'equipmentType' | 'enhancementLevel'>) {
  return (item.equipmentType === 'one_hand_sword' || item.equipmentType === 'two_hand_sword')
    && item.enhancementLevel >= SWORD_AURA.minimumEnhancement;
}

type Atlas = { texture: T.Texture; ready: boolean; copies: Map<T.Texture, () => void> };
let atlas: Atlas | null = null;
let infernoAtlas: Atlas | null = null;
let energyAtlas: Atlas | null = null;

// Independent UV offsets share one decoded image / GPU texture source. Releasing
// the last model releases the cache too; late load callbacks cannot revive it.
type AuraConfig = typeof SWORD_AURA | typeof SWORD_INFERNO_AURA | typeof WEAPON_ENERGY_AURA;
function acquireAtlas(config: AuraConfig, onReady: () => void, onDispose: () => void) {
  const cached = config === SWORD_INFERNO_AURA ? infernoAtlas : config === WEAPON_ENERGY_AURA ? energyAtlas : atlas;
  if (!cached) {
    const entry: Atlas = { texture: new T.Texture(), ready: false, copies: new Map() };
    if (config === SWORD_INFERNO_AURA) infernoAtlas = entry;
    else if (config === WEAPON_ENERGY_AURA) energyAtlas = entry;
    else atlas = entry;
    entry.texture = new T.TextureLoader().load(config.url, texture => {
      entry.ready = true;
      for (const [copy, ready] of entry.copies) {
        copy.source = texture.source; copy.needsUpdate = true; ready();
      }
    }, undefined, () => { /* Keep the effect hidden if its image cannot load. */ });
  }
  const entry = (config === SWORD_INFERNO_AURA ? infernoAtlas : config === WEAPON_ENERGY_AURA ? energyAtlas : atlas)!;
  const texture = new T.Texture(); texture.source = entry.texture.source;
  texture.name = config === SWORD_INFERNO_AURA ? 'SwordInferno13Atlas' : config === WEAPON_ENERGY_AURA ? 'WeaponEnergyBallAtlas' : 'SwordFlame13Atlas';
  texture.colorSpace = T.SRGBColorSpace;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  texture.repeat.set(1 / config.columns, 1 / config.rows);
  texture.offset.set(0, 1 - 1 / config.rows);
  entry.copies.set(texture, onReady);
  texture.addEventListener('dispose', () => {
    entry.copies.delete(texture); onDispose();
    if (!entry.copies.size) {
      entry.texture.dispose();
      if (atlas === entry) atlas = null;
      if (infernoAtlas === entry) infernoAtlas = null;
      if (energyAtlas === entry) energyAtlas = null;
    }
  });
  if (entry.ready) { texture.needsUpdate = true; onReady(); }
  return texture;
}

function attachSwordAuraEffect(holder: T.Group, bladeLength: number, guardY: number,
  config: AuraConfig, name: string) {
  const effect = new T.Group();
  effect.name = name;
  effect.position.y = guardY + (bladeLength + .16) / 2;
  effect.visible = false; // Never display an untextured rectangle while loading.
  effect.userData = { frame: 0, enhancementAura: true, disposed: false, axis: 'blade-local-Y' };
  const map = acquireAtlas(config, () => { effect.visible = true; }, () => { effect.userData.disposed = true; effect.visible = false; });
  const material = new T.MeshBasicMaterial({
    map, transparent: true, opacity: .82, blending: T.AdditiveBlending,
    depthWrite: false, depthTest: true, side: T.DoubleSide, forceSinglePass: true, toneMapped: false,
  });
  const geometry = new T.PlaneGeometry(
    (bladeLength > 1.4 ? .64 : .52) * config.sizeMultiplier * config.widthMultiplier,
    (bladeLength + .3) * config.sizeMultiplier,
  );
  // Crossed cards wrap the blade without rotating away from it to face the camera.
  // Two triangles per card, no lights, shadows, body effect or extra particles.
  for (let i = 0; i < config.planeCount; i++) {
    const plane = new T.Mesh(geometry, material);
    plane.name = `${name}Plane${i + 1}`;
    plane.rotation.y = i * Math.PI / config.planeCount;
    if (name === 'WeaponEnergyBallAura' && i % 2 === 1) plane.rotation.x = Math.PI / 2;
    plane.renderOrder = 1;
    effect.add(plane);
  }
  holder.add(effect);
  return effect;
}

export function attachSwordAura(holder: T.Group, bladeLength: number, guardY: number) {
  const effect = attachSwordAuraEffect(holder, bladeLength, guardY, SWORD_AURA, 'EnhancedSwordFlame13');
  const geometry = (effect.children[0] as T.Mesh<T.PlaneGeometry>).geometry;
  // Keep the rear edge at the guard: enlarged flames extend toward the tip,
  // rather than growing backward into the hand/body from the blade midpoint.
  effect.position.y = guardY + geometry.parameters.height / 2;
  return effect;
}

export function fitSwordAuraToBlade(effect: T.Group, bladeSocket: T.Object3D,
  bladeLength: number, bladeWidth: number) {
  const geometry = (effect.children[0] as T.Mesh<T.PlaneGeometry>).geometry;
  bladeSocket.add(effect);
  // Small gripward adjustment for the fitted blade; keep the enlarged size.
  const backset = bladeLength * 0.22;
  effect.position.set(0, bladeLength * SWORD_AURA.sizeMultiplier / 2 - backset, 0);
  effect.quaternion.identity();
  const widthScale = bladeWidth * SWORD_AURA.sizeMultiplier / geometry.parameters.width;
  effect.scale.set(widthScale,
    bladeLength * SWORD_AURA.sizeMultiplier / geometry.parameters.height, widthScale);
}

export function attachSwordInfernoAura(holder: T.Group, bladeLength: number, guardY: number) {
  return attachSwordAuraEffect(holder, bladeLength, guardY, SWORD_INFERNO_AURA, 'EnhancedSwordInferno13');
}

export function attachWeaponEnergyAura(holder: T.Group) {
  const effect = attachSwordAuraEffect(holder, .16, -.16, WEAPON_ENERGY_AURA, 'WeaponEnergyBallAura');
  effect.scale.setScalar(2.7);
  for (const plane of effect.children) {
    plane.renderOrder = 3;
    ((plane as T.Mesh).material as T.MeshBasicMaterial).depthTest = false;
    ((plane as T.Mesh).material as T.MeshBasicMaterial).opacity = .95;
  }
  return effect;
}

export function updateSwordAuras(effects: T.Group[], time: number) {
  for (const effect of effects) {
    if (effect.userData.disposed) continue;
    const config = effect.name === 'EnhancedSwordInferno13' ? SWORD_INFERNO_AURA
      : effect.name === 'WeaponEnergyBallAura' ? WEAPON_ENERGY_AURA : SWORD_AURA;
    const frame = Math.floor(Math.max(0, time) * config.fps) % config.frames;
    effect.userData.frame = frame;
    const map = ((effect.children[0] as T.Mesh).material as T.MeshBasicMaterial).map!;
    map.offset.set((frame % config.columns) / config.columns,
      1 - (Math.floor(frame / config.columns) + 1) / config.rows);
  }
}
