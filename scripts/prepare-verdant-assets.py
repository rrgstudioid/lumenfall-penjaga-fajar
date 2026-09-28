"""Selected local sources only; originals are read-only. Run with system Python."""
from pathlib import Path
from PIL import Image
import zipfile, io, json

ROOT=Path(__file__).resolve().parents[1]
MASTER=Path(r'C:\Users\GG\Desktop\Lumenfall')
MATERIAL=MASTER/'Master_ Material_ Lumenfall'
ENV=MASTER/'Master_Model_Lumenfall'/'Environment'
OUT=ROOT/'public/assets/maps/verdant-plains-v2'
STAGE=ROOT/'output/verdant-plains/source'
OUT.mkdir(parents=True,exist_ok=True)
STAGE.mkdir(parents=True,exist_ok=True)
sources=[]
for name,folder,stem in [('grass','Terrain','grass_ground'),('dirt','Terrain','dirt'),('sand','Terrain','sandy_gravel_02'),('rock','Rock_Cliff','rock_face'),('wood','Wood','medieval_wood')]:
    matches=list((MATERIAL/folder).glob(stem+'_*.zip'))
    if not matches: matches=list(MATERIAL.rglob(stem+'_*.zip'))
    src=matches[0]
    with zipfile.ZipFile(src) as z:
        entry=next(n for n in z.namelist() if '_diff_' in n and n.endswith(('.jpg','.png')))
        im=Image.open(io.BytesIO(z.read(entry))).convert('RGB');im.thumbnail((1024,1024));im.save(OUT/(name+'.webp'),quality=86)
    sources.append({'asset':name+'.webp','source':str(src),'entry':entry})
with zipfile.ZipFile(MATERIAL/'Water/water_wave_normal_map_1k_pbr.zip') as z:
    entry=next(n for n in z.namelist() if n.endswith('/normal.png'))
    im=Image.open(io.BytesIO(z.read(entry))).convert('RGB');im.thumbnail((1024,1024));im.save(OUT/'water-normal.webp',lossless=True)
sources.append({'asset':'water-normal.webp','source':'Water/water_wave_normal_map_1k_pbr.zip','entry':entry})
models=[('shrub','Ground_Vegatation/shrub_03_2k.blend.zip'),('pier','Building/modular_wooden_pier_2k.blend.zip')]
for name,rel in models:
    src=ENV/rel;dest=STAGE/name;dest.mkdir(exist_ok=True)
    with zipfile.ZipFile(src) as z:
        for entry in z.infolist():
            target=(dest/entry.filename).resolve()
            if not target.is_relative_to(dest.resolve()):raise ValueError('Unsafe archive path')
        z.extractall(dest)
    sources.append({'asset':name+'.glb','source':str(src)})
(OUT/'provenance.json').write_text(json.dumps({'map':'verdant-plains-v2','sources':sources},indent=2))
print(json.dumps({'stage':str(STAGE),'output':str(OUT),'sources':sources},indent=2))
