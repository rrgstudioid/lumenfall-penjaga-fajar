import * as T from 'three';

export const DRAGON_VEIL_WINGS_MODEL = '/assets/equipment/dragon-veil-wings/dragon-veil-wings.glb';

/** Authored Y-up mesh; rotate its forward clasp toward the character's back. */
export function fitDragonVeilWings(scene: T.Group) {
  const bounds = new T.Box3().setFromObject(scene);
  const size = bounds.getSize(new T.Vector3());
  if (!Number.isFinite(size.x) || size.x <= 0) throw new Error('Invalid Dragon Veil Wings bounds');
  const width = 2.8;
  const scale = width / size.x;
  const fitted = new T.Group();
  fitted.name = 'DragonVeilWings';
  // Center clasp spans source Z .23–.29; outer feathers sweep toward -Z.
  // Anchor that clasp, then turn the feather sweep away from the torso (+Z).
  scene.position.set(-(bounds.min.x + size.x / 2), -(bounds.min.y + size.y * .60), -.24);
  fitted.rotation.y = Math.PI;
  fitted.scale.setScalar(scale);
  fitted.add(scene);
  fitted.userData = { templateId: 'dragon-veil-wings', fittedWidth: width, animated: false };
  scene.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return fitted;
}
