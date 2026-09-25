import * as T from 'three';

/** Reduce the source's deep forward fold through the whole spine, not by
 * shortening the neck or rotating the gameplay actor. Called at bake time in
 * the authored glTF frame (+Y up, +Z forward). Pelvis and legs are untouched.
 */
export function balanceCenaRunTorso(spine: T.Object3D[], neck: T.Object3D, head: T.Object3D) {
  const gaze = head.getWorldQuaternion(new T.Quaternion());
  const children = [...spine.slice(1), neck];
  const direction = (i: number) => children[i].getWorldPosition(new T.Vector3()).sub(spine[i].getWorldPosition(new T.Vector3()));
  const desired = spine.map((_, i) => {
    const d = direction(i);
    return Math.atan2(d.z, d.y) * .35;
  });
  for (let i = 0; i < spine.length; i++) {
    const bone = spine[i], d = direction(i);
    const correction = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), desired[i] - Math.atan2(d.z, d.y));
    const world = bone.getWorldQuaternion(new T.Quaternion()).premultiply(correction);
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world)).normalize();
    bone.updateWorldMatrix(false, true);
  }
  // Keep the original forward gaze while the torso becomes more upright.
  head.quaternion.copy(head.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(gaze)).normalize();
  head.updateWorldMatrix(false, true);
}

/** Offline Run-only pose correction. No translations, scaling or mesh edits. */
export function balanceCenaRunNeck(neck: T.Object3D, head: T.Object3D, neckRest: T.Quaternion, headRest: T.Quaternion) {
  const gaze = head.getWorldQuaternion(new T.Quaternion());
  const alignedNeck = gaze.clone().multiply(headRest.clone().invert()).multiply(neckRest);
  const cervical = neck.getWorldQuaternion(new T.Quaternion()).slerp(alignedNeck, .65);
  neck.quaternion.copy(neck.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(cervical)).normalize();
  neck.updateWorldMatrix(false, true);
  head.quaternion.copy(head.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(gaze)).normalize();
  head.updateWorldMatrix(false, true);
}
