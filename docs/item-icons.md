# Lumenfall item icon integration

## Coverage and source

All 104 current `ITEM_CATALOG` templates have distinct, canonical 256×256 WebP files under `public/assets/icons/items/`. Total WebP payload: 1,553,162 bytes (about 1.48 MiB). One additional SVG fallback is reserved for unknown or missing assets.

The nine supplied September 11 reference sheets are extraction inputs, not runtime assets. The crop recipe in `scripts/extract-item-icons.py` identifies each illustration by its existing catalog ID. Labels, poster margins and rarity frames are excluded. Images preserve their aspect ratio and have transparent outer padding; painted interior backgrounds and item effects remain. These are sheet-resolution crops, not regenerated high-resolution transparent object cutouts. Some artwork meets the original frame edge, so that source limitation remains.

No current icon is missing or substituted with a different item's art. No gameplay fields, catalog IDs, rarity mappings, save schemas or prices were changed.

## Single icon source

`lib/game/item-icon-manifest.ts` maps catalog IDs to files. `getItemIconPath()` in `lib/game/item-icons.ts` accepts the catalog/template ID, including existing potion aliases. It never uses a unique inventory instance ID or display name.

`components/game/item-artwork.tsx` renders the asset and applies the item's existing rarity color separately. `ItemIcon`, `EntryIcon` and `EquipmentVisual` reuse it. Image failure uses the fallback and reports the affected ID once during development.

Integrated surfaces: Inventory grid and details, drag preview, PrimaryHotbar and tooltip, Character equipment, Shop buy/sell, storage, socket picker and installed Runes, Rune Optimizer and crafting, enhancement confirmation, recent drops and loot notifications. Skill artwork remains unchanged.

## Maintenance

Regenerate with Python + Pillow:

```text
python scripts/extract-item-icons.py --source-dir <directory-containing-the-nine-original-sheets>
node scripts/validate-item-icons.ts
```

The extraction script compares its crop recipe with the authoritative catalog and refuses incomplete or duplicate coverage. Review contact sheets and crop/hash provenance are written to ignored `work/item-icons/`. Add a new item's crop or final asset and manifest entry when extending the catalog; do not add a separate item database.

## Verification

- Asset validator: 104/104, zero errors.
- Existing game logic suite: 123 tests passed.
- TypeScript check and production build passed.
- Isolated Chrome browser test: 14 checks passed, zero captured JavaScript/console errors and zero HTTP errors.
- Browser checks include all 104 decoded inventory images, nine named representative items, inventory swap, reference-only hotbar drag, tooltip, potion quantity and cooldown, equipment, actual NPC shop, Rune picker, installation without duplication, optimizer artwork and reload persistence.
- Source contact sheets and runtime screenshots were visually inspected.

Run browser tests with `node scripts/test-item-icons-browser.mjs` while the local game runs on port 3001. Set `PLAYWRIGHT_MODULE` to the installed Playwright entry file if it is not a project dependency. The test uses an isolated browser profile and test inventory; it does not touch the user's saves or the public site.

Build retains the existing large-bundle warning. The icon update is local and has not been published.

## Changed files

Existing: `app/page.tsx`, `app/globals.css`, `app/layout.tsx`, `components/game/character-overview.tsx`, `components/game/entry-icon.tsx`, `components/game/equipment-visual.tsx`, `lib/game/world.ts` (loot presentation reference only).

Added: `components/game/item-artwork.tsx`, `lib/game/item-icons.ts`, `lib/game/item-icon-manifest.ts`, `scripts/extract-item-icons.py`, `scripts/validate-item-icons.ts`, `scripts/test-item-icons-browser.mjs`, this document, 104 WebP assets and the fallback SVG.

`app/layout.tsx` also declares the existing favicon SVG to prevent the browser's previous missing favicon request.
