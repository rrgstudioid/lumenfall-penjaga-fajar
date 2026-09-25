# Cena body-only runtime asset

Default male model. Source: owner's `Cena_Textured_ChinAligned.blend` checkpoint,
26 September 2026. See `docs/cena-character.md` for provenance and validation.

52 bones; 374,735 triangles; two fitted hand sockets. No source animation clips,
weapons, duplicated eyes/eyebrows, lights, or cameras. Procedural base color baked
to vertex colors with roughness retained; Blender micro-bump is not included.
Neck/chin correction and static finger grip are baked into the exported bind pose.
Existing runtime procedural animation drives mapped joints; Combo actions are disabled.

Generated with `scripts/export-cena-character.py` in a separate background Blender
process. Never run the export script inside the artist's live Blender session.
