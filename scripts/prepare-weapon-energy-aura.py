"""Pack the supplied blue energy ball PNG sequence into a transparent flipbook."""
import hashlib, json, sys
from pathlib import Path
from zipfile import ZipFile
from PIL import Image

archive_path = Path(sys.argv[1])
with ZipFile(archive_path) as archive:
    names = sorted(n for n in archive.namelist() if n.lower().endswith('.png'))
    selected = names[::3][:50]
    frames = []
    for name in selected:
        with archive.open(name) as entry:
            image = Image.open(entry).convert('RGBA')
            image.thumbnail((124, 124), Image.Resampling.LANCZOS)
            frames.append(image)

tile_w = tile_h = 128
columns, rows, padding = 8, 7, 2
atlas = Image.new('RGBA', (tile_w * columns, tile_h * rows))
for index, frame in enumerate(frames):
    x = (index % columns) * tile_w + (tile_w - frame.width) // 2
    y = (index // columns) * tile_h + (tile_h - frame.height) // 2
    atlas.paste(frame, (x, y), frame)

target = Path('public/assets/vfx/weapon-energy-ball.webp')
target.parent.mkdir(parents=True, exist_ok=True)
atlas.save(target, 'WEBP', quality=90, method=6, alpha_quality=100)
source_hash = hashlib.file_digest(archive_path.open('rb'), 'sha256').hexdigest()
metadata = {
    'source': archive_path.name, 'sourceSha256': source_hash, 'sourceFrames': len(names),
    'sampledSourceFrames': [i * 3 + 1 for i in range(len(frames))], 'frames': len(frames), 'fps': 18,
    'columns': columns, 'rows': rows, 'tileSize': [tile_w, tile_h], 'padding': padding,
    'atlasSize': list(atlas.size), 'bytes': target.stat().st_size, 'sourceUnmodified': True,
}
target.with_suffix('.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
