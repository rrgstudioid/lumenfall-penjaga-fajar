# Ironveil Mines implementation

Ironveil Mines uses `ironveil-mines-exterior-v1` as its active field and `ironveil-mines-interior-v1` as a doorway-only sub-map. The retired `ironveil-mines` destination is no longer offered in the map menu. The current field is available from level 8, with recommended levels 8-16.

## Exterior

- The 1000 x 1000-unit map has an outdoor southern half and an inaccessible mountain mass in the north, with one mine entrance.
- Four open hunting pockets and connecting paths share the outdoor navigation domain. The mountains and map perimeter use explicit collision.
- The map uses the owner-supplied large cypress and rock assets. Placements avoid the main path and entrance. Original source assets remain untouched.
- Population: 120 normal monsters, eight elites, and one field boss. The entry and doorway staging areas are kept clear.
- The bright, hot daytime sky has clouds and a slightly blue horizon. Exterior scene fog is disabled.
- The entrance is an explicit click interaction within 4.5 units. It loads the interior rather than a placeholder message.

## Interior

- The 1000 x 1000-unit sub-map contains 14 chambers linked by a network of tunnels, loops, and shortcuts. The entrance and exit are the same southern doorway.
- Cave floor, walls, and ceiling enclose the playable space. Navigation and camera collision follow the cave geometry; the exterior sky is not visible.
- Rails and mining props guide exploration. Lanterns are mounted on cave walls or timber supports; none are placed on the floor.
- Population: 480 normal monsters across levels 12-24. Exterior and interior populations are independent.
- The interior is not a direct M-menu destination. M shows the local cave map, and the player leaves by clicking **To Outside Mines** at the doorway. Respawn uses the safe interior entrance area.
- Save restoration retains a valid interior location, and invalid positions recover to navigable cave floor or the entrance spawn.

## Source and assets

Exterior implementation lives in `lib/game/ironveil-mines-*.ts`; interior implementation lives in `lib/game/ironveil-interior-*.ts`. Region and travel integration is in `lib/game/regions.ts` and `lib/game/world.ts`. UI integration is in `app/page.tsx` and `components/game/`.

Runtime asset derivatives and provenance records are in `public/assets/maps/ironveil-mines-exterior-v1/` and `public/assets/maps/ironveil-mines-interior-v1/`. Asset preparation scripts are in `scripts/`; original source models and archives are not modified.

## Verification

Run the focused Node test suites in `lib/game/ironveil-*.test.ts` with `node --experimental-transform-types --test`. TypeScript checks use `node_modules/.bin/tsc.CMD --noEmit --incremental false`; the production build uses `node node_modules/vinext/dist/cli.js build`. Isolated browser checks are provided in `scripts/test-ironveil-browser.mjs` and `scripts/test-ironveil-interior-browser.mjs`.
