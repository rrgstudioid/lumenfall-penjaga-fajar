import unreal,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];stage=root/'output/chaotic-sky';out=stage/'exported';out.mkdir(parents=True,exist_ok=True);report=[]
for record in json.loads((stage/'source-manifest.json').read_text())['assets']:
 name=record['path'];asset=unreal.load_asset('/Game/Chaotic_Skies/'+name.removesuffix('.uasset'))
 if not asset:raise RuntimeError('Cannot load '+name)
 target=out/(Path(name).stem+'.tga');task=unreal.AssetExportTask();task.object=asset;task.filename=str(target);task.automated=True;task.prompt=False;task.replace_identical=True;task.exporter=unreal.TextureExporterTGA()
 if not unreal.Exporter.run_asset_export_task(task):raise RuntimeError('Cannot export '+name)
 report.append({'asset':name,'file':str(target),'srgb':asset.get_editor_property('srgb')})
(stage/'export-report.json').write_text(json.dumps(report,indent=2))
print('CHAOTIC_EXPORT_COMPLETE')
