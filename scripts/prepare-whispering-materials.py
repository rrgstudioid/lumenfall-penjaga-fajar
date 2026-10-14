"""Create selected browser derivatives only; never modify owner source archives."""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from PIL import Image
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'C:\Users\GG\Desktop\Lumenfall\Master_ Material_ Lumenfall')
if not SOURCE.exists():
    SOURCE = Path(r'D:\Lumenfall\Master_ Material_ Lumenfall')
OUT = ROOT / 'public/assets/materials/whispering-wilds'
OUT.mkdir(parents=True, exist_ok=True)
records = []
for role, source in [('forest', 'Terrain/forrest_ground_03_2k.blend.zip'), ('path', 'Terrain/grass_path_2_2k.blend.zip'), ('rock', 'Rock_Cliff/mossy_rock_2k.blend.zip')]:
    archive = SOURCE / source
    original_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    with ZipFile(archive) as z:
        name = next(n for n in z.namelist() if '_diff_' in n and n.endswith(('.jpg','.png')))
        image = Image.open(BytesIO(z.read(name))).convert('RGB')
        image.thumbnail((1024,1024), Image.Resampling.LANCZOS)
        target = OUT / f'{role}.webp'
        image.save(target, 'WEBP', quality=88)
    assert original_hash == hashlib.sha256(archive.read_bytes()).hexdigest()
    records.append(dict(role=role, source=str(archive), sourceEntry=name, sourceSha256=original_hash,
        file=f'/assets/materials/whispering-wilds/{target.name}', sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
        bytes=target.stat().st_size, dimensions=list(image.size), colorSpace='srgb'))
manifest = dict(sourceUnmodified=True, records=records, reused=[
    '/assets/maps/verdant-plains-v2/sky-clouds.webp',
    '/assets/maps/verdant-plains-v2/sky-provenance.json',
    '/assets/maps/verdant-plains-v2/wood.webp',
    '/assets/maps/verdant-plains-v2/water-normal.webp',
    '/assets/maps/stylized-tree/meshes/oak-sm_stylized_tree_oak_02.glb',
    '/assets/maps/stylized-tree/meshes/willow-sm_stylized_tree_willow_02.glb',
    '/assets/maps/stylized-tree/meshes/pine-sm_stylized_tree_pine_03.glb'],
    note='Browser-ready runtime trees selected. No Blender source editing or whole-library copies. Existing UDS atlas reused; native Three.js night shading.')
(OUT / 'provenance.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'files':len(records),'bytes':sum(r['bytes'] for r in records),'sourceUnmodified':True}))
