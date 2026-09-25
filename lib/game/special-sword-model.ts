import * as T from 'three';

// Coordinates in the sword mesh's authoring frame, BEFORE the GLB's display
// rotation. The narrow handle is Z=80..100, between guard and star pommel.
export const CRIMSON_SWORD_GRIP = new T.Vector3(0, 0, 92);

const CRIMSON_GLOW_MATERIALS = /(?:sword|core|eye)/i;

/** Configure the imported Meteor Sword's existing orange emissive artwork for a runtime pulse. */
export function setupCrimsonSwordGlow(model: T.Object3D) {
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof T.MeshStandardMaterial) || !CRIMSON_GLOW_MATERIALS.test(material.name)) continue;
      material.userData.crimsonGlow = true;
      material.userData.baseEmissiveIntensity = material.emissiveIntensity;
      material.userData.baseEmissive = material.emissive.clone();
      // Keep the authored emissive map, while ensuring the pulse remains warm orange.
      material.emissive.setRGB(1, 0.22, 0.025);
      material.toneMapped = true;
    }
  });
  model.userData.crimsonGlowConfigured = true;
  return model;
}

/** Smooth two-second breathing glow for the Meteor Sword's orange emissive regions. */
export function updateCrimsonSwordGlow(model: T.Object3D, time: number) {
  const pulse = 0.5 - 0.5 * Math.cos((Math.max(0, time) % 2) * Math.PI);
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof T.MeshStandardMaterial) || !material.userData.crimsonGlow) continue;
      const base = material.userData.baseEmissiveIntensity as number;
      material.emissiveIntensity = base + pulse * 3.85;
    }
  });
}

export function setCrimsonSwordGripRoll(model: T.Object3D, roll = -Math.PI / 2) {
  // Roll around the source blade axis, keeping its tip direction and grip fixed.
  model.rotation.set(Math.PI / 2 + 0.08, 0, roll);
}

export function alignCrimsonSword(model: T.Group, targetLength: number, gripRoll = -Math.PI / 2): T.Group {
  const blade = model.getObjectByName('sword_swordTX_0');
  if (!(blade instanceof T.Mesh)) throw new Error('Crimson sword mesh is missing');
  model.updateMatrixWorld(true);
  blade.geometry.computeBoundingBox();
  const bounds = blade.geometry.boundingBox!;
  const sourceLength = bounds.max.z - bounds.min.z;
  if (!(sourceLength > 0)) throw new Error('Crimson sword length is invalid');

  // Cancel the complete exporter/presentation transform, not just scene.rotation.
  // Keep the eye/core meshes in the same frame as the blade.
  const source = new T.Group();
  source.name = 'CrimsonSwordSourceFrame';
  source.matrixAutoUpdate = false;
  source.matrix.copy(blade.matrixWorld).invert();
  source.matrix.premultiply(new T.Matrix4().makeTranslation(
    -CRIMSON_SWORD_GRIP.x, -CRIMSON_SWORD_GRIP.y, -CRIMSON_SWORD_GRIP.z,
  ));
  source.add(model);

  const fitted = new T.Group();
  fitted.name = 'AltiverseCrimsonSword';
  fitted.scale.setScalar(targetLength / sourceLength);
  // Source -Z becomes socket +Y (character forward), with a slight upward tilt.
  // Rotation/scale pivot on the actual handle; its centre stays in the palm.
  // Older rigs need a quarter-turn; Cena's authored grip already supplies it.
  setCrimsonSwordGripRoll(fitted, gripRoll);
  fitted.add(source);

  // VFX follows the fitted blade frame, not the old procedural sword's axis.
  // Z=42 is the guard/core; the pommel and handle are excluded from blade length.
  const bladeBaseZ = 42;
  const bladeSocket = new T.Group();
  bladeSocket.name = 'CrimsonBladeAuraSocket';
  bladeSocket.position.set(0, 0, bladeBaseZ - CRIMSON_SWORD_GRIP.z);
  bladeSocket.rotation.x = -Math.PI / 2; // Aura +Y runs down source -Z to the tip.
  // Existing aura dimensions use game units; leave the imported mesh's scale alone.
  bladeSocket.scale.setScalar(1 / fitted.scale.x);
  bladeSocket.userData = {
    bladeLength: (bladeBaseZ - bounds.min.z) * fitted.scale.x,
    bladeWidth: (bounds.max.x - bounds.min.x) * fitted.scale.x,
  };
  fitted.add(bladeSocket);
  fitted.traverse(object => {
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.specialWeaponModel = true;
  });
  return fitted;
}
