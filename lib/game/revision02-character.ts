import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterRig } from './character-animation.ts';
import { loadArmyRunningClip, replaceRunningClip } from './army-running.ts';

export const REVISION02_ASSET = '/assets/characters/male-revision-02/male-revision-02.glb';
export const REVISION02_TRIANGLES = 20394;
export const REVISION02_ANIMATED_ASSET = '/assets/characters/male-revision-02/male-revision-02-dual-sword.glb';
let source: Promise<{ scene: T.Group; animations: T.AnimationClip[] }> | undefined;

// Cache the download, but own geometry/materials/skeletons per actor so closing
// an equipment preview cannot dispose the world's character or the next clone.
export async function loadRevision02Character() {
  source ??= new GLTFLoader().loadAsync(REVISION02_ANIMATED_ASSET).then(g => ({ scene: g.scene, animations: g.animations })).catch(error => {
    source = undefined;
    throw error;
  });
  // A failed optional motion file cannot make the body disappear. The original
  // GLB (including Walk and all three combat clips) is retained unchanged.
  const [loaded,run]=await Promise.all([source,loadArmyRunningClip().catch(error=>{
    console.warn('Animasi Army Run gagal dimuat; memakai animasi lari sebelumnya.',error);return null;
  })]);
  const result = cloneCharacterSource(loaded.scene);
  result.userData.lumenfallAnimations = run?replaceRunningClip(loaded.animations,run):loaded.animations;
  result.userData.runningAnimationSource=run?'army-man-running-blender':'legacy-run';
  return result;
}

export function cloneCharacterSource(scene:T.Group) {
  const result = cloneSkeleton(scene) as T.Group;
  const materials = new Map<T.Material, T.Material>();
  const textures = new Map<T.Texture, T.Texture>();
  result.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    o.geometry = o.geometry.clone();
    const copy = (original: T.Material) => {
      let material = materials.get(original);
      if (!material) {
        material = original.clone(); materials.set(original, material);
        for (const [key, value] of Object.entries(material)) if (value instanceof T.Texture) {
          let texture = textures.get(value);
          if (!texture) { texture = value.clone(); textures.set(value, texture); }
          (material as unknown as Record<string, unknown>)[key] = texture;
        }
      }
      return material;
    };
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  return result;
}

const joints = {
  hips: 'Hips', spine: 'Spine', chest: 'Chest', neck: 'Neck', head: 'Head',
  rightUpperArm: 'UpperArmR', rightLowerArm: 'LowerArmR', rightHand: 'HandR',
  leftUpperArm: 'UpperArmL', leftLowerArm: 'LowerArmL', leftHand: 'HandL',
  rightUpperLeg: 'ThighR', rightLowerLeg: 'ShinR', rightFoot: 'FootR',
  leftUpperLeg: 'ThighL', leftLowerLeg: 'ShinL', leftFoot: 'FootL',
} as const;
type Joint = keyof typeof joints;
const cleanName = (name: string) => name.replace(/[. _]/g, '');

/** Retarget the game's existing poses; combat timing/movement remains in world.ts.
 * Canonical game-axis offsets are conjugated into each bone's bind frame.
 * Afterwards the old equipment pivots follow the actual skinned joints.
 */
export function createRevision02Binding(rig: CharacterRig, actor: T.Group, fallback: T.Mesh[], equipped: Set<string>, profile={assetKind:'male-revision-02',visualName:'MaleRevision02Visual',triangles:REVISION02_TRIANGLES}) {
  const rest = new Map<Joint, { q: T.Quaternion; p: T.Vector3 }>();
  for (const key of Object.keys(joints) as Joint[]) rest.set(key, { q: rig[key].quaternion.clone(), p: rig[key].position.clone() });
  type Binding = { key: Joint; bone: T.Bone; q: T.Quaternion; p: T.Vector3; frame: T.Quaternion; inverse: T.Quaternion; anchor: T.Vector3 };
  let bindings: Binding[] = [];
  let visual: T.Group | undefined;
  let hipsParentInverse = new T.Quaternion();
  let modelScale = 1;
  const delta = new T.Quaternion(), q = new T.Quaternion(), parentQ = new T.Quaternion();
  const p = new T.Vector3(), move = new T.Vector3();

  function attach(model: T.Group) {
    const visualProfile = model.userData.characterVisualProfile ?? profile;
    const bones = new Map<string, T.Bone>();
    model.traverse(o => { if (o instanceof T.Bone) bones.set(cleanName(o.name), o); });
    for (const name of Object.values(joints)) if (!bones.has(name)) throw new Error(`Revision 02 missing bone ${name}`);
    const box = new T.Box3().setFromObject(model);
    modelScale = actor.userData.heightMeters / box.getSize(new T.Vector3()).y;
    visual = new T.Group(); visual.name = visualProfile.visualName;
    visual.rotation.y = Math.PI; // authored GLB +Z -> Lumenfall -Z
    visual.scale.setScalar(modelScale); visual.position.y = -box.min.y * modelScale;
    visual.add(model); rig.root.add(visual); rig.root.updateWorldMatrix(true, true);
    const rootInverse = rig.root.getWorldQuaternion(new T.Quaternion()).invert();
    const rootMatrixInverse = rig.root.matrixWorld.clone().invert();
    const socket = (name: string) => { let found: T.Object3D | undefined; model.traverse(o => { if (cleanName(o.name) === name) found = o; }); return found; };
    bindings = (Object.keys(joints) as Joint[]).map(key => {
      const bone = bones.get(joints[key])!;
      const frame = rootInverse.clone().multiply(bone.getWorldQuaternion(new T.Quaternion()));
      let anchor = new T.Vector3();
      const hand = key === 'rightHand' ? socket('WeaponSocketR') : key === 'leftHand' ? socket('WeaponSocketL') : undefined;
      if (hand) anchor = bone.worldToLocal(hand.getWorldPosition(new T.Vector3()));
      else {
        const offset = key === 'head' ? .235 : key === 'chest' ? .12 : key.endsWith('Foot') ? -.13 : 0;
        anchor.set(0, offset, key.endsWith('Foot') ? -.04 : 0).applyQuaternion(frame.clone().invert());
      }
      if (key === 'hips') hipsParentInverse = rootInverse.clone().multiply(bone.parent!.getWorldQuaternion(new T.Quaternion())).invert();
      return { key, bone, q: bone.quaternion.clone(), p: bone.position.clone(), frame, inverse: frame.clone().invert(), anchor };
    });
    // Keep the rest frame independent of actor placement at asynchronous load time.
    actor.userData.revision02Origin = new T.Vector3().setFromMatrixPosition(visual.matrixWorld).applyMatrix4(rootMatrixInverse).toArray();
    model.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      o.castShadow = true; o.receiveShadow = true;
      if (equipped.has('head') && o.name.startsWith('Hair')) o.visible = false;
      if (equipped.has('boots') && o.name.startsWith('Boot')) o.visible = false;
      if (equipped.has('gloves') && cleanName(o.name).startsWith('Wristcuff')) o.visible = false;
    });
    for (const mesh of fallback) mesh.visible = false;
    // Existing equipment geometry is preserved, with torso/head shells fitted
    // to the slimmer revision-02 base instead of the old capsule body.
    actor.traverse(o => {
      if (o.name === 'equipment:chest') o.scale.set(.88, .65, .88);
      if (o.name === 'equipment:head') o.scale.setScalar(.78);
    });
    actor.userData.assetKind = visualProfile.assetKind;
    actor.userData.animationType = 'skinned-procedural-retarget';
    actor.userData.baseTriangles = visualProfile.triangles;
  }

  function syncAttachments() {
    if (!visual || actor.userData.disposed) return;
    // Equipment sockets are driven from the final skinned pose, including a
    // native imported animation that may have just updated the bones.
    rig.root.updateWorldMatrix(true, true);
    for (const b of bindings) {
      const joint = rig[b.key], parent = joint.parent!;
      p.copy(b.anchor); b.bone.localToWorld(p);
      q.copy(b.bone.getWorldQuaternion(q)).multiply(b.inverse);
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(p); parent.getWorldQuaternion(parentQ).invert();
      joint.position.copy(p); joint.quaternion.copy(parentQ).multiply(q);
      joint.updateWorldMatrix(false, false);
    }
  }
  function update() {
    if (!visual || actor.userData.disposed) return;
    for (const b of bindings) {
      const original = rest.get(b.key)!;
      delta.copy(rig[b.key].quaternion).multiply(q.copy(original.q).invert());
      b.bone.quaternion.copy(b.q).multiply(b.inverse).multiply(delta).multiply(b.frame);
      b.bone.position.copy(b.p);
      if (b.key === 'hips') {
        move.copy(rig.hips.position).sub(original.p).applyQuaternion(hipsParentInverse).divideScalar(modelScale);
        b.bone.position.add(move);
      }
    }
    syncAttachments();
  }
  return { attach, update, syncAttachments };
}
