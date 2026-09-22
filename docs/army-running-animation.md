# Army Running → Lumenfall Revision 02

## Scope

Local integration of the running animation supplied by the user. No soldier mesh,
texture, platform, character replacement, save migration, map modification or
combat timing change. The existing `Walk`, three Dual Sword attack clips and
procedural idle are retained. Movement is still always-run, with unchanged speed.

## Blender workflow

- Source: `C:/ProgramData/Epic/EpicGamesLauncher/VaultCache/FabLibrary/Army_man_Running-3a6c17b7/VaultCache/FabLibrary/Army_man_Running-3a6c17b7/glb/converted/army_man_running.glb`.
- Blender 5.2.1 LTS, executable `D:/blender.exe`.
- Inspection: `scripts/inspect-army-running.py`.
- Reproducible retarget/bake: `scripts/retarget-army-running.py`.
- Source's 10.4167-second clip repeats every 50 frames at 60fps. Export one
  seamless 0.833333-second cycle, sampled from source frame 12.5.
- Map 19 Mixamo bones onto the actual Revision 02 bind skeleton. Calibrate arm
  directions for T-pose vs A-pose; preserve child translations and bone lengths.
- Bake cyclic pelvis motion and target boot-sole ground correction. No accumulated
  root displacement. Keep the source's brief airborne running phases.
- Editable character + baked action: `work/army-running/revision02-army-running.blend`
  (about 753 KB; unused source datablocks removed from this scratch project).
- Motion-only runtime export:
  `public/assets/animations/army-running/army-running-revision02.glb` (36,124 bytes).
- Source GLB and both existing character GLBs remain untouched.

## Runtime

`army-running.ts` loads/caches the independent clip, validates its bone names,
keeps rotations and pelvis translation only, and replaces only `Run`.
`revision02-character.ts` clones the existing character independently for each
world/preview instance. If the optional motion cannot load, the previous Run is
used and subsequent character loads retry; the character does not disappear.

At 1x playback, measured support-foot travel on the normalized character is about
5.2 world units/second. Cadence eases toward actual speed / 5.2 (about 1.455x at
the normal 7.564 movement speed), bounded for extreme status effects. This adjusts
only playback, never character displacement, controls, collisions or saved stats.
Existing animation crossfades are kept. Equipment sockets follow the final bones.

## Verification

- Animation/character tests cover loop seam, finite unit quaternions, unchanged
  clips, independent caches/resources, load-failure recovery, motion articulation,
  grip sockets, actor transforms, running cadence and idle/attack return.
- `scripts/check-army-running-browser.mjs`: isolated Chrome save, real W-key
  movement, imported Run active, idle after key release, screenshots from front,
  side and three-quarter, and attack/idle transition. No player save is accessed.
- Browser report and screenshots: `work/army-running/`.
- Production build succeeds. Full TypeScript check still reports the existing
  unrelated errors in items.ts:856, ui-layout.ts:64 and
  tests/browser/real-components.tsx:177; no new animation errors.

Not published; available in local Lumenfall on port 3001.
