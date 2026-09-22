# Temporary Arunika BGM

- Asset: `yokohama-town.mp3` (nama URL dipertahankan agar konfigurasi lama tetap kompatibel)
- User-supplied replacement: `BGM_KOTA_ARUNIKA.mp3`
- Purpose: temporary soundtrack exclusively for **Kota Arunika**, using its existing `city-arunika` music ID.
- Imported without transcoding or modifying the original file.
- Rights/license: not provided or verified. This is not an original Lumenfall composition or a royalty-free asset. Obtain suitable permission or replace it before public distribution.
- Repository distribution: on 2026-09-22, the project owner explicitly authorized distribution of all `public/` assets through the public LUMENFALL GitHub repository. This records the owner's authorization; third-party provenance and license terms have not been independently verified.

To replace this temporary soundtrack again, update the `city-arunika` entry in `lib/game/bgm.ts`. Other maps remain silent until their own music ID is assigned a track. Combat sound effects stay in the existing game sound system.
