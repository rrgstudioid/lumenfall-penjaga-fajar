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

## CLASS DI LUMENFALL — design continuity authority

Owner instruction, 8 October 2026: until the project last discussed in **CLASS DI LUMENFALL** and its descendant conversations is complete, base reasoning, decisions, implementation prompts and reviews on those discussions, their reference material and the owner's design intent. Do not substitute a new independent design direction.

- Before proposing or authorizing a design-sensitive next step, consult the relevant recovered conversation evidence, owner confirmations and canonical handoff. Understand why the cited reference informed the design, not merely the resulting numbers or labels.
- Distinguish explicit owner decisions, assistant proposals, provisional values, prototype runtime data, superseded rules and unresolved details. Runtime presence or an assistant's `LOCK` label alone does not establish owner approval.
- Preserve later explicit owner corrections. If relevant sources conflict, report the narrow conflict and seek direction rather than silently selecting a value.
- Do not invent weapon ranges, coefficients, progression or other design data just to unblock implementation. Missing evidence requires targeted recovery or clarification, not promotion of prototype values to canonical data.
- Trace design-sensitive recommendations to their sources and explain their relationship to the existing design. Do not claim to have read the entire branch history or all references when only selected evidence is available.
- Whenever discussing or relying on a reference identified in CLASS DI LUMENFALL or its descendants, cross-check that reference on the internet rather than relying solely on memory or recovered chat summaries. Prefer official/primary sources; cite the supporting pages and distinguish relevant versions, dates and historical behavior from current behavior.
- Analyze the relationship between the verified reference and the resulting LUMENFALL design: what the owner retained, adapted or rejected, the problem addressed and the trade-offs, where supported by evidence. Clearly separate externally verified facts, the owner's stated rationale and assistant inference. Do not invent the owner's motivation when the discussion does not establish it.
- External verification informs understanding and flags discrepancies; it does not automatically override approved LUMENFALL decisions or authorize redesign. If the exact reference/version cannot be identified or verified, report that limitation and seek targeted clarification rather than silently substituting another reference.
- Approval of a work scope is not automatic approval of newly proposed numeric values. A held or unapproved proposal must not become an implementation contract.
- Work within the established project direction until the owner confirms completion or explicitly changes that direction. Afterwards, new topics may be considered under the owner's next instructions.

## Mandatory main integration — canonical design preservation

Owner instruction, 9 October 2026: integration must align the eventual `main` result with approved local project work while retaining relevant collaborator updates. It must not resurrect obsolete designs. The owner explicitly locked these four checks for future integration:

1. List the latest owner-approved decisions and implementations that must remain effective.
2. List superseded/obsolete designs that must not become active again.
3. Compare the actual final integration result against both lists, with traceable source evidence and explicit conflict resolution.
4. Verify that the approved local features still work together with the incoming collaborator updates.

- `main` is an incoming source, not automatic design authority. Resolve conflicts using owner decisions, later corrections and explicitly scoped exceptions; never blindly prefer either branch or replace dirty local work.
- Distinguish intentionally retained compatibility/legacy paths during staged migration from obsolete rules. Preserve authorized compatibility without allowing it to override the new system; this rule does not authorize global legacy deletion or activation of development-only formulas.
- Selective working-tree integration, a successful Git merge, and canonical feature parity are different claims. Zero commits behind alone does not prove design alignment. Record the actual source revision, verification scope and remaining limitations.
- These checks do not authorize commit, push, merge, rebase or publication. Perform those operations only when explicitly requested, and continue to follow the publishing workflow below.

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
