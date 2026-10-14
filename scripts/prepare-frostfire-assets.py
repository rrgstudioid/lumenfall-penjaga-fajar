"""Read owner sources; write only isolated Frostfire runtime/staging derivatives."""
from pathlib import Path
import hashlib, io, json, shutil, zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/maps/frostfire-highlands-v2'
STAGE = ROOT / 'output/frostfire-highlands/uds'
MASTER = Path(r'C:\Users\GG\Desktop\Lumenfall\Master_ Material_ Lumenfall')
UDS = Path(r'C:\ProgramData\Epic\EpicGamesLauncher\VaultCache\UltraDyn12790d13e818V8\data\Content\UltraDynamicSky')
OUT.mkdir(parents=True, exist_ok=True)
records = []
for source_name, target_name in [('snow rock pile 3d model.glb', 'snow-rock-pile.glb'),
                                  ('snowy pine tree 3d model.glb', 'snowy-pine-tree.glb')]:
    src = MASTER.parent / source_name
    shutil.copy2(src, OUT / target_name)
    records.append({'file': target_name, 'source': str(src),
                    'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(),
                    'runtimeCopyUnmodified': True})
for stem in ['snow_02', 'snow_03']:
    src = MASTER / 'Terrain' / (stem + '_2k.blend.zip')
    with zipfile.ZipFile(src) as archive:
        for channel in (['diff', 'rough'] if stem == 'snow_02' else ['diff']):
            entry = next(n for n in archive.namelist() if f'_{channel}_' in n)
            im = Image.open(io.BytesIO(archive.read(entry))).convert('RGB')
            im.thumbnail((1024, 1024))
            target = OUT / f'{stem}-{channel}.webp'
            im.save(target, quality=88)
            records.append({'file': target.name, 'source': str(src), 'entry': entry,
                            'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest()})
project = STAGE / 'UnrealExport'
uds_records = []
for name in ['Snow_Bits', 'RainSnow_Sheet', 'Wind_Movement']:
    src = UDS / f'Textures/Weather/{name}.uasset'
    dst = project / f'Content/UltraDynamicSky/Textures/Weather/{name}.uasset'
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    uds_records.append({'name': name, 'source': str(src), 'sha256': hashlib.sha256(src.read_bytes()).hexdigest()})
(project / 'FrostfireExport.uproject').write_text(json.dumps({'FileVersion': 3, 'EngineAssociation': '5.4', 'Plugins': [{'Name': 'PythonScriptPlugin', 'Enabled': True}, {'Name': 'EditorScriptingUtilities', 'Enabled': True}]}))
(STAGE / 'sources.json').write_text(json.dumps(uds_records, indent=2))
(OUT / 'provenance.json').write_text(json.dumps({'map': 'frostfire-highlands-v2', 'sources': records, 'shared': ['/assets/maps/verdant-plains-v2/sky-clouds.webp', '/assets/maps/verdant-plains-v2/rock.webp', '/assets/maps/verdant-plains-v2/water-ocean-normal.webp'], 'sourceUnmodified': True}, indent=2))
print('Prepared snow textures and isolated UDS staging project.')
