# Hunyuan character in local Lumenfall

The default male body is now `public/assets/characters/astra-hunyuan/astra-hunyuan-rigged.glb`.
Existing male saves and newly created male characters use the same model factory, including the equipment preview.
The female character loader and saved gameplay data are unchanged. The original revision-02 files are retained.

## Asset

- Source: the locally generated `exports/characters/astra-hunyuan-textured/astra-hunyuan-textured.glb`.
- 159,660 triangles, 20 bones, maximum four normalized skin weights per vertex.
- Embedded original 2048 × 2048 color texture.
- Twelve microscopic degenerate triangles were removed while welding duplicate seam vertices for binding. The visible shape and UV colors are preserved.
- Blender source: `work/hunyuan-character/rigged/astra-hunyuan-rigged.blend`.
- Rebuild: run `scripts/build-hunyuan-character.py` in Blender's background Python mode.

The generated mesh's narrow triangles prevented a complete direct heat-weight solve. A temporary regular voxel mesh is used only to calculate weights; weights are transferred to the original textured mesh. The final exported surface is not the voxel mesh.

The former procedural rectangular cape and its `CapePivot` have been removed from the character attachment hierarchy, so the Hunyuan body no longer carries the wooden-looking block on its back.

## Animation and attachments

Walk, Army Run, and DualSword_Attack_01/02/03 are baked to this character's fitted rest skeleton. Run preserves the source flight phase and corrects ground contact. Raw revision-02 running tracks must not replace the fitted clip because the bone lengths and rest positions differ.

The existing procedural idle and combat state machine remain in use. Weapon sockets are fitted to the fist centers, and runtime equipment follows the final skinned pose after animation mixing. The character is scaled to the existing 2.4-unit gameplay height.

The loader uses independent skeletons, geometry, materials and textures for the world and equipment-preview instances. Visual profile metadata lets the shared binding support Astra, the existing female model, and explicit revision-02 fixtures.

## Verification

The character regression suite passes 21 tests covering existing male and female rigs, texture presence, normalized weights, bounded animation deformation, both hand sockets, clone/disposal independence, and preserving character data. The current saved male character was also visually checked in localhost Arunika at idle, running, and attacking, with no browser warnings or errors observed.

A whole-project TypeScript check still reports pre-existing errors in `lib/game/items.ts`, `lib/game/ui-layout.ts`, and `tests/browser/real-components.tsx`; none are in the new character integration.

This task applies the character locally. It does not publish the production site.
