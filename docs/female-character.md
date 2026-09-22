# Female RPG character

The supplied `female_body_base_for_rpg.glb` is an additional female character choice,
not a replacement for the existing male Revision 02 character.

## Asset and Blender project

- Original design, hair, UVs, 1K textures and 9,389 triangles retained.
- Converted with Blender 5.2.1 LTS (`D:/blender.exe`). Source GLB remains untouched.
- Editable rig: `work/female-character/female-rpg-rigged.blend`.
- Runtime asset: `public/assets/characters/female-rpg/female-rpg-rigged.glb`.
- Build script: `scripts/build-female-character.py`; inspection:
  `scripts/inspect-female-base.py`.
- 20-bone humanoid rig, automatic body skinning, rigid skull/hair/eye attachment,
  fitted hand sockets, retargeted Walk/Army Run and three Dual Sword attacks.
- Foot-ground height correction is baked for Run. Runtime cadence and original
  procedural idle use the existing character system. No gameplay speed/stat changes.
- Fingers retain the source's open-hand shape; this is a body/limb rig, not a full
  facial/finger rig. A dedicated gripping pose can be added separately.
- Attribution and modification notice: `public/assets/characters/female-rpg/credits.txt`.

## Selection and persistence

On an empty save slot, choose **Laki-laki** or **Perempuan**, then start. Occupied
slots show their saved model and cannot be converted by the creation control.
`Hero.gender` persists in the existing save format; absent/invalid values default
to male, preserving legacy saves. No saves are erased or auto-converted.
The equipment preview rebuild key includes gender. Each cloned body owns its own
geometry/material/texture resources; closing a preview does not dispose world assets.

## Verification

- Unit tests: save migration/roundtrip, exact triangle count, complete normalized
  skin weights, animation clips, finite motion, hand sockets and male regressions.
- Isolated Chrome test: `scripts/check-female-character-browser.mjs` covers empty
  slot selection, creation, actual W-key running, textured in-game views, combat,
  reload/reselect and preservation of the pre-existing male slot's level/gold.
- Screenshots and report: `work/female-character/`.
- Full TypeScript check retains the three pre-existing errors in `items.ts`,
  `ui-layout.ts`, and `tests/browser/real-components.tsx`; no new errors from this feature.

Local only, not published.
