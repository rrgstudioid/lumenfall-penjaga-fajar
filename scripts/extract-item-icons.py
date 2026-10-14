"""Extract the supplied Lumenfall sheets, never shipping posters or rarity frames.

Usage: python scripts/extract-item-icons.py --source-dir PATH
Rectangles are audited artwork interiors in the original 1448x1086 sheets.
The catalog remains authoritative; this is an art-production recipe only.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/assets/icons/items'
REVIEW = ROOT / 'work/item-icons'
SHEETS = {
    1: 'ChatGPT Image Sep 11, 2026, 01_17_00 AM (1).png',
    2: 'ChatGPT Image Sep 11, 2026, 01_17_00 AM (2).png',
    3: 'ChatGPT Image Sep 11, 2026, 01_17_01 AM (3).png',
    4: 'ChatGPT Image Sep 11, 2026, 01_17_01 AM (4).png',
    5: 'ChatGPT Image Sep 11, 2026, 01_17_02 AM (5).png',
    6: 'ChatGPT Image Sep 11, 2026, 01_17_03 AM (6).png',
    7: 'ChatGPT Image Sep 11, 2026, 01_17_03 AM (7).png',
    8: 'ChatGPT Image Sep 11, 2026, 01_17_03 AM (8).png',
    9: 'ChatGPT Image Sep 11, 2026, 01_17_03 AM (9).png',
}
RECIPES = []


def row(sheet, ids, xs, top, width, height):
    for item_id, left in zip(ids.split(), xs, strict=True):
        RECIPES.append((item_id, sheet, (left, top, left + width, top + height)))


row(1, 'lumut-fiber iron titanium vibranium meteorite-core', [44,326,606,886,1169], 110, 235, 222)
row(1, 'adventurer-pet-egg magnifier rice-meal arrows health-potion-1', [44,326,606,886,1169], 405, 235, 222)
row(1, 'health-potion-2 health-potion-3 mana-potion-1 mana-potion-2 mana-potion-3', [44,326,606,886,1169], 701, 235, 222)
row(2, 'rune-optimizer-basic rune-optimizer-refined rune-optimizer-rare rune-optimizer-epic rune-optimizer-legendary', [61,341,616,893,1170], 118, 214, 199)
row(2, 'rune-optimizer-red rune-optimizer-yellow rune-optimizer-magenta rune-optimizer-grey rune-optimizer-blue-vitality', [61,341,616,893,1170], 422, 214, 199)
row(2, 'rune-optimizer-blue-arcana rune-might rune-precision rune-focus rune-swiftness', [61,341,616,893,1170], 729, 214, 204)
row(3, 'rune-vitality rune-arcana rune-elements rune-shadows rune-fortune', [78,353,629,904,1178], 160, 191, 181)
row(3, 'rune-guardian fate-rune-fragment eternal-seal rune-bayangan-caroq rune-inti-bara', [78,353,629,904,1178], 445, 191, 184)
row(3, 'rune-mata-jayantara rune-raja-meteor rune-akar-purba', [174,474,775], 733, 196, 185)
row(3, 'rune-penjaga-langit', [1066], 740, 194, 174)
row(4, 'field-verdant-plains-sword field-verdant-plains-dagger field-verdant-plains-staff field-verdant-plains-bow field-verdant-plains-mace', [57,335,613,892,1170], 109, 224, 217)
row(4, 'field-ironveil-mines-sword field-ironveil-mines-dagger field-ironveil-mines-staff field-ironveil-mines-bow field-ironveil-mines-mace', [57,335,613,892,1170], 412, 224, 218)
row(4, 'legacy-fajar-blade', [605], 712, 239, 231)
row(5, 'garda-mace pujangga-wand anom-sword anom-dagger', [134,453,771,1087], 128, 229, 216)
row(5, 'jagawana-bow bajra-knuckle caroq-daggers resi-staff', [133,452,770,1085], 425, 229, 224)
row(5, 'pandita-relic', [262], 732, 233, 220)
row(5, 'srikandi-bow', [602], 733, 239, 221)
row(5, 'guntur-knuckle', [949], 732, 235, 222)
row(6, 'field-whispering-wilds-sword field-whispering-wilds-dagger field-whispering-wilds-staff field-whispering-wilds-bow field-whispering-wilds-mace', [60,342,621,900,1179], 125, 210, 200)
row(6, 'whispering-offhand-dagger field-frostfire-highlands-sword field-frostfire-highlands-dagger field-frostfire-highlands-staff field-frostfire-highlands-bow', [62,344,623,902,1181], 413, 205, 207)
row(6, 'field-frostfire-highlands-mace', [62], 710, 205, 207)
row(7, 'field-sunken-ruins-sword field-sunken-ruins-dagger field-sunken-ruins-staff field-sunken-ruins-bow field-sunken-ruins-mace', [47,332,617,900,1185], 122, 216, 213)
row(7, 'field-meteorfall-citadel-sword field-meteorfall-citadel-dagger field-meteorfall-citadel-staff field-meteorfall-citadel-bow field-meteorfall-citadel-mace', [47,332,617,900,1185], 428, 216, 215)
row(7, 'jayantara-two-hand-sword', [606], 741, 238, 234)
row(8, 'arunika-head arunika-gloves forest-vest arunika-boots', [61,411,761,1111], 168, 280, 262)
row(8, 'arunika-legs', [211], 561, 282, 281)
row(8, 'ironveil-shield', [575], 561, 299, 281)
row(8, 'garda-shield', [963], 579, 264, 256)
row(9, 'arunika-ring1 arunika-ring2 arunika-earring2', [268,608,947], 115, 232, 204)
row(9, 'arunika-earring1 fajar-necklace hunter-quiver', [268,608,947], 411, 232, 204)
row(9, 'arcana-tome resi-orb pujangga-talisman', [268,608,950], 704, 232, 212)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    catalog = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {ITEM_CATALOG} from './lib/game/items.ts'; console.log(JSON.stringify(Object.fromEntries(Object.entries(ITEM_CATALOG).map(([id,i])=>[id,i.name]))))",
    ], cwd=ROOT, text=True, encoding='utf-8'))
    ids = [r[0] for r in RECIPES]
    assert len(ids) == len(set(ids)), 'Duplicate art mapping'
    assert set(ids) == set(catalog), {'missing': sorted(set(catalog)-set(ids)), 'unknown': sorted(set(ids)-set(catalog))}
    sources = {n: Image.open(args.source_dir / filename).convert('RGBA') for n, filename in SHEETS.items()}
    assert all(im.size == (1448,1086) for im in sources.values()), 'Unexpected source dimensions: re-audit crop coordinates'
    OUTPUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    manifest, provenance = {}, {}
    for item_id, sheet, box in RECIPES:
        crop = sources[sheet].crop(box)
        # Preserve aspect ratio and painted lighting. Only the outside padding is transparent.
        # A soft corner mask excludes the last curved frame corners without colour-keying dark art.
        mask = Image.new('L', crop.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((1,1,crop.width-2,crop.height-2), radius=12, fill=255)
        crop.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
        art = ImageOps.contain(crop, (236,236), Image.Resampling.LANCZOS)
        icon = Image.new('RGBA', (256,256))
        icon.alpha_composite(art, ((256-art.width)//2, (256-art.height)//2))
        target = OUTPUT / f'{item_id}.webp'
        icon.save(target, 'WEBP', quality=92, method=6)
        manifest[item_id] = f'/assets/icons/items/{item_id}.webp'
        provenance[item_id] = {'sheet': SHEETS[sheet], 'crop': box, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    (ROOT / 'lib/game/item-icon-manifest.ts').write_text(
        '// Generated by scripts/extract-item-icons.py. Keys are existing catalog template IDs.\n'
        'export const ITEM_ICON_MANIFEST: Readonly<Record<string, string>> = Object.freeze('
        + json.dumps(dict(sorted(manifest.items())), indent=2) + ');\n', encoding='utf-8')
    (REVIEW / 'extraction-report.json').write_text(json.dumps(provenance,indent=2), encoding='utf-8')
    for sheet in SHEETS:
        entries = [r for r in RECIPES if r[1] == sheet]
        contact = Image.new('RGB', (900, ((len(entries)+4)//5)*190), '#1b2026')
        draw = ImageDraw.Draw(contact)
        for i, (item_id, _, _) in enumerate(entries):
            art = Image.open(OUTPUT / f'{item_id}.webp').resize((148,148), Image.Resampling.LANCZOS)
            x, y = i%5*180, i//5*190
            contact.paste(art,(x+16,y),art)
            title = catalog[item_id]
            draw.text((x+4,y+152), title[:26], fill='#ecdfc8')
            draw.text((x+4,y+167), title[26:], fill='#ecdfc8')
        contact.save(REVIEW / f'sheet-{sheet}.jpg', quality=94)
    print(f'Created {len(manifest)} individual 256px WebP icons; exact catalog coverage verified.')


if __name__ == '__main__':
    main()
