"""Promote the approved Stage03 payload to the local game's Averion map. No publishing."""
import json, shutil, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'dev-prototypes/mahkota-fajar-stage03-v1/assets'
target=root/'public/assets/maps/averion'
m=json.loads((source/'manifest.json').read_text())
assert m['mapId']=='lumenfall-kingdom-capital-stage03-v1'
files=set(m['payloadFiles'])-{'manifest.json'}
for name in sorted(files):
    src=(source/name).resolve();dst=(target/name).resolve()
    assert src.is_relative_to(source.resolve()) and dst.is_relative_to(target.resolve())
    dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
m['sourceMapId']=m['mapId'];m['mapId']='averion';m['displayName']='Averion'
(target/'manifest.json').write_text(json.dumps(m,indent=2),encoding='utf-8')
print(json.dumps(dict(mapId=m['mapId'],files=len(files)+1,bytes=sum((target/f).stat().st_size for f in files)+(target/'manifest.json').stat().st_size)))
