import * as T from 'three';

const baseHooks = new WeakMap<
  T.Material,
  { compile: T.Material['onBeforeCompile']; key: string }
>();

/** A steady, texture-colored emission step for every enhancement, +0 through +12. */
export function equipmentEmissiveStrength(enhancementLevel: number) {
  const level = Number.isFinite(enhancementLevel)
    ? T.MathUtils.clamp(Math.floor(enhancementLevel), 0, 12)
    : 0;
  return { level, intensity: level * 0.08 + level * level * 0.006 };
}

/** Configure an actor-owned material. Authored emissive maps/pulses stay intact. */
export function applyEquipmentEmissive(
  material: T.Material,
  enhancementLevel: number,
) {
  if (!(material instanceof T.MeshStandardMaterial)) return;
  const glow = equipmentEmissiveStrength(enhancementLevel);
  const existing = material.userData.equipmentEmissive;
  if (existing) {
    existing.level = glow.level;
    existing.intensity = glow.intensity;
    existing.uniform.value = glow.intensity;
    return;
  }
  if (!glow.level) return;
  const uniform = { value: glow.intensity };
  // Retain the method itself so clones invoke it with their own material as `this`.
  // oxlint-disable-next-line typescript/unbound-method
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  baseHooks.set(material, { compile: previous, key: previousKey });
  material.userData.equipmentEmissive = { ...glow, uniform };
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.equipmentEnhancementEmission = uniform;
    shader.fragmentShader =
      'uniform float equipmentEnhancementEmission;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * equipmentEnhancementEmission;',
    );
  };
  // Levels use a uniform, so they share one compiled shader program.
  material.customProgramCacheKey = () => previousKey + ':equipment-emissive-v1';
  material.needsUpdate = true;
}

/** Shared asset materials must be cloned; textures and geometry remain shared. */
export function cloneEquipmentEmissive(
  material: T.Material,
  enhancementLevel: number,
) {
  const copy = material.clone();
  const base = baseHooks.get(material);
  // The new owner binds this hook when compiling; binding the source here would leak its state.
  // oxlint-disable-next-line typescript/unbound-method
  copy.onBeforeCompile = base?.compile ?? material.onBeforeCompile;
  const key = base?.key ?? material.customProgramCacheKey();
  copy.customProgramCacheKey = () => key;
  delete copy.userData.equipmentEmissive;
  applyEquipmentEmissive(copy, enhancementLevel);
  return copy;
}

/** Only for independently loaded, actor-owned GLBs (Wings and Meteor Sword). */
export function applyEquipmentEmissiveToObject(
  root: T.Object3D,
  enhancementLevel: number,
) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      applyEquipmentEmissive(material, enhancementLevel);
  });
}
