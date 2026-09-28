"""Run inside UnrealEditor-Cmd, against the disposable staging project only."""
import unreal,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/verdant-plains/uds-bake'
OUT=STAGE/'exported';OUT.mkdir(parents=True,exist_ok=True)
report=[]
for record in json.loads((STAGE/'source-manifest.json').read_text())['assets']:
 name=record['path'];asset=unreal.load_asset('/Game/UltraDynamicSky/'+name.removesuffix('.uasset'))
 if not asset:raise RuntimeError('Cannot load '+name)
 target=OUT/(Path(name).stem+'.tga')
 task=unreal.AssetExportTask();task.object=asset;task.filename=str(target)
 task.automated=True;task.prompt=False;task.replace_identical=True
 task.exporter=unreal.TextureExporterTGA()
 if not unreal.Exporter.run_asset_export_task(task):raise RuntimeError('Cannot export '+name)
 report.append({'asset':name,'file':str(target),'class':asset.get_class().get_name(),'srgb':asset.get_editor_property('srgb'),'compression':str(asset.get_editor_property('compression_settings'))})
(STAGE/'export-report.json').write_text(json.dumps(report,indent=2))
print('VERDANT_UDS_EXPORT_COMPLETE',json.dumps(report))
