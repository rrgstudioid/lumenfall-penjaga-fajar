"""Unreal commandlet: export selected staged textures, never open owner assets."""
import unreal, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'output/frostfire-highlands/uds'
OUT = STAGE / 'exported'
OUT.mkdir(parents=True, exist_ok=True)
report = []
for record in json.loads((STAGE / 'sources.json').read_text()):
    name = record['name']
    asset = unreal.load_asset('/Game/UltraDynamicSky/Textures/Weather/' + name)
    if not asset:
        raise RuntimeError('Missing staged texture: ' + name)
    task = unreal.AssetExportTask()
    task.object = asset
    task.filename = str(OUT / (name + '.tga'))
    task.automated = True
    task.prompt = False
    task.replace_identical = True
    task.exporter = unreal.TextureExporterTGA()
    if not unreal.Exporter.run_asset_export_task(task):
        raise RuntimeError('Export failed: ' + name)
    report.append({'name': name, 'class': asset.get_class().get_name(), 'srgb': asset.get_editor_property('srgb')})
(STAGE / 'export-report.json').write_text(json.dumps(report, indent=2))
print('FROSTFIRE_UDS_EXPORT_COMPLETE')
