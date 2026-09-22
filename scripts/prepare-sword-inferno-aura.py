"""Pack the supplied Blue Inferno PNG sequence into a small transparent flipbook."""
import hashlib, json, sys
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
import numpy as np

archive_path = Path(sys.argv[1])
with ZipFile(archive_path) as archive:
    names = sorted(n for n in archive.namelist() if n.lower().endswith('.png'))
    frames = []
    for name in names:
        with archive.open(name) as entry:
            image = Image.open(entry).convert('RGB')
            image.thumbnail((384, 216), Image.Resampling.LANCZOS)
            frames.append(np.asarray(image).astype(np.float32) / 255)

    activity = np.maximum.reduce([frame.max(axis=2) for frame in frames]) > .025
    ys, xs = np.where(activity)
    crop = (max(0, int(xs.min()) - 3), max(0, int(ys.min()) - 3),
            min(activity.shape[1], int(xs.max()) + 4), min(activity.shape[0], int(ys.max()) + 4))
    tile_w, tile_h, columns, rows, padding = 160, 256, 7, 6, 2
    atlas = Image.new('RGBA', (tile_w * columns, tile_h * rows))
    for index, frame in enumerate(frames):
        alpha = frame.max(axis=2, keepdims=True)
        rgb = frame / np.maximum(alpha, 1 / 255)
        rgba = np.concatenate((rgb, alpha), axis=2)
        tile = Image.fromarray(np.uint8(np.clip(rgba * 255, 0, 255))).crop(crop).rotate(90, expand=True)
        tile.thumbnail((tile_w - 2 * padding, tile_h - 2 * padding), Image.Resampling.LANCZOS)
        x = (index % columns) * tile_w + (tile_w - tile.width) // 2
        y = (index // columns) * tile_h + (tile_h - tile.height) // 2
        atlas.paste(tile, (x, y), tile)

target = Path('public/assets/vfx/sword-inferno-13.webp')
target.parent.mkdir(parents=True, exist_ok=True)
atlas.save(target, 'WEBP', quality=86, method=6, alpha_quality=100)
source_hash = hashlib.file_digest(archive_path.open('rb'), 'sha256').hexdigest()
metadata = {
    'source': archive_path.name, 'sourceSha256': source_hash, 'sourceFrames': len(names),
    'sourceResolution': [3840, 2160], 'frames': len(frames), 'fps': 18,
    'columns': columns, 'rows': rows, 'tileSize': [tile_w, tile_h], 'padding': padding,
    'atlasSize': list(atlas.size), 'bytes': target.stat().st_size, 'cropOn384pxProxy': crop,
    'sourceUnmodified': True,
}
target.with_suffix('.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
