# LUMENFALL — Project Context

## Assistant identity

The assistant may be addressed as **Garda**. Communicate primarily in Indonesian unless the user asks otherwise.

## Project

This workspace contains LUMENFALL, a browser-based MMORPG prototype. Work includes combat systems, Warrior/Thief V2 development, world/map prototyping, asset catalogs, and Blender-based environment inspection.

## Current focus

The current map work is **Mahkota Fajar / Ibu Kota Mahkota Fajar**. The Blender candidate source is:

`C:\Users\USER\Documents\LUMENFALL_Medieval_City.blend`

The source Blender file is read-only. The runtime candidate is the development-only map `lumenfall-kingdom-capital-blend-v1`; do not overwrite the previous city map or publish it.

## Blender MCP

Use the configured `blender` MCP server for read-only scene inspection when appropriate. Before changing a Blender scene or source asset, state the intended change and confirm scope. Prefer read-only inspection and staging exports.

## Safety and scope

- Preserve existing user changes and do not reset or delete unrelated work.
- Do not publish unless the user explicitly asks.
- Do not modify original source assets or the original `.blend` file.
- Do not add gameplay, monsters, NPCs, quests, progression, or balance changes during map-ingest/review work unless explicitly requested.
- Keep development experiments isolated from production maps and assets.
- Report blockers and fidelity limitations honestly; do not silently redesign or rebalance.

## Working style

Inspect the existing runtime and reuse its architecture. Make the smallest scoped change, verify it in the actual browser/runtime when relevant, and report files changed, tests/build status, and known limitations.

## Mandatory publishing workflow

The local production source and the public Site must remain logically aligned. Publishing means promoting newly validated local development changes into the public production version so other people can access them; it is not a request to accumulate independent copies of the project, old archives, or duplicate assets.

Before every request to publish LUMENFALL:

- Inspect the currently deployed/public version and its package manifest when available.
- Compare local production output against the public version to identify changed, unchanged, duplicate, obsolete, and development-only files.
- Exclude old publish archives, generated release copies, experimental assets, unused maps, test fixtures, and other files not required by the production runtime.
- Calculate and report the exact upload archive size, file count, and a short summary of what is new versus already present in public.
- Do not upload or deploy until the owner explicitly approves that size and scope in the current conversation.
- If the platform requires a complete runtime archive for deployment, state that clearly and distinguish it from the incremental source changes; never claim that a patch-only upload is being performed when it is not.
- If the size is unexpectedly large or duplicate content is detected, stop and report the cause instead of proceeding.
