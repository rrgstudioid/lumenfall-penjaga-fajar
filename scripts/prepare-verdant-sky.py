"""Stage only selected UDS textures in an isolated Unreal export project."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'C:\ProgramData\Epic\EpicGamesLauncher\VaultCache\UltraDyn12790d13e818V8\data\Content\UltraDynamicSky')
STAGE=ROOT/'output/verdant-plains/uds-bake'
PROJECT=STAGE/'UnrealExport'
FILES=['Textures/StaticClouds/StaticClouds_A.uasset','Textures/Sky/Cloud_Wisps.uasset','Textures/Clouds/clouds_diverse.uasset']
records=[]
for name in FILES:
 src=SOURCE/name;dst=PROJECT/'Content/UltraDynamicSky'/name
 dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 records.append({'path':name,'bytes':src.stat().st_size,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
(PROJECT/'SkyExport.uproject').write_text(json.dumps({'FileVersion':3,'EngineAssociation':'5.4','Plugins':[{'Name':'PythonScriptPlugin','Enabled':True},{'Name':'EditorScriptingUtilities','Enabled':True}]}),encoding='utf-8')
(STAGE/'source-manifest.json').write_text(json.dumps({'source':str(SOURCE),'assets':records},indent=2),encoding='utf-8')
print(json.dumps({'project':str(PROJECT/'SkyExport.uproject'),'stagedBytes':sum(r['bytes'] for r in records)}))
