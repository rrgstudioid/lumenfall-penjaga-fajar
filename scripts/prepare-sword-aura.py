"""Build a web flipbook from the supplied PNG archive without extracting 3 GB.

Only resizes/packs the supplied footage; the original ZIP is never modified.
"""
import argparse
import json
import hashlib
from pathlib import Path
from zipfile import ZipFile
from PIL import Image, ImageDraw
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--inspect', action='store_true')
args = parser.parse_args()
out = Path('work/sword-aura')
out.mkdir(parents=True, exist_ok=True)
with ZipFile(args.archive) as archive:
    names = sorted(n for n in archive.namelist() if n.lower().endswith('.png'))
    indices = [0, 3, 10, 25, 45, 65, 85, 105, 125, 140, 149, 152]
    sheet = Image.new('RGB', (6 * 220, 2 * 330), '#17242d')
    draw = ImageDraw.Draw(sheet)
    details = []
    for tile, index in enumerate(indices):
        with archive.open(names[min(index, len(names) - 1)]) as entry:
            im = Image.open(entry).convert('RGBA')
            details.append({'frame': index + 1, 'size': im.size, 'alpha': im.getchannel('A').getextrema(), 'bounds': im.getbbox()})
            im.thumbnail((210, 295), Image.Resampling.LANCZOS)
            x, y = (tile % 6) * 220, (tile // 6) * 330
            sheet.paste(im, (x + (220-im.width)//2, y + 22), im)
            draw.text((x + 8, y + 5), f'Frame {index+1}', fill='white')
    sheet.save(out / 'source-contact.png')
    print(json.dumps({'frames': len(names), 'samples': details}, indent=2))
    if not args.inspect:
        # Discard the black intro/outro; sample every other frame for a 15 fps loop.
        source_indices = list(range(16, 136, 2))
        frames = []
        for index in source_indices:
            with archive.open(names[index]) as entry:
                im = Image.open(entry).convert('RGB')
                im.thumbnail((192, 288), Image.Resampling.LANCZOS)
                frames.append(np.asarray(im).astype(np.float32) / 255)
        # Crossfade the end into the beginning, preserving moving flames at the seam.
        blend_frames = 8
        loop = frames[blend_frames:-blend_frames] + [
            frames[-blend_frames+i] * (1-(i+1)/blend_frames) + frames[i] * ((i+1)/blend_frames)
            for i in range(blend_frames)
        ]
        activity = np.maximum.reduce([frame.max(axis=2) for frame in loop]) > .025
        ys, xs = np.where(activity)
        crop = (max(0, int(xs.min())-3), max(0, int(ys.min())-3),
                min(activity.shape[1], int(xs.max())+4), min(activity.shape[0], int(ys.max())+4))
        tile_w, tile_h, columns, rows, padding = 128, 256, 8, 7, 2
        atlas = Image.new('RGBA', (tile_w*columns, tile_h*rows))
        for index, frame in enumerate(loop):
            # Unpremultiply black-background footage into colour + alpha. This
            # avoids opaque black rectangles in the transparent equipment preview.
            alpha = frame.max(axis=2, keepdims=True)
            rgb = frame / np.maximum(alpha, 1/255)
            rgba = np.concatenate((rgb, alpha), axis=2)
            tile = Image.fromarray(np.uint8(np.clip(rgba*255, 0, 255))).crop(crop)
            tile = tile.resize((tile_w-2*padding, tile_h-2*padding), Image.Resampling.LANCZOS)
            atlas.paste(tile, ((index % columns)*tile_w+padding, (index//columns)*tile_h+padding))
        target = Path('public/assets/vfx/sword-flame-13.webp')
        target.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(target, 'WEBP', quality=90, method=6, alpha_quality=100)
        with args.archive.open('rb') as original:
            source_hash = hashlib.file_digest(original, 'sha256').hexdigest()
        metadata = {
            'source': args.archive.name, 'sourceSha256': source_hash,
            'sourceFrames': len(names), 'sourceResolution': details[0]['size'],
            'sampledSourceFrames': [i+1 for i in source_indices], 'crossfadeFrames': blend_frames,
            'frames': len(loop), 'fps': 15, 'columns': columns, 'rows': rows,
            'tileSize': [tile_w, tile_h], 'padding': padding, 'atlasSize': atlas.size,
            'bytes': target.stat().st_size, 'cropOn192pxProxy': crop,
            'sourceUnmodified': True,
        }
        target.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n')
        atlas.thumbnail((512, 896), Image.Resampling.LANCZOS)
        atlas.save(out / 'packed-preview.png')
        print(json.dumps(metadata, indent=2))
