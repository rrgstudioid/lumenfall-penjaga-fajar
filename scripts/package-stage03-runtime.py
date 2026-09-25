"""HTTP gzip packaging, no mesh decoder or engine replacement.
Raw GLBs remain staging evidence; only manifest-listed files belong to runtime payload.
"""
import gzip,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
assets=root/'assets';path=assets/'manifest.json';m=json.loads(path.read_text());(assets/'runtime').mkdir(exist_ok=True)
items=list(m['chunks'])+list(m['modules'])+[m['collision']]+[a for c in m['chunks'] for a in c.get('lods',[])]
for a in items:
    source=assets/(a['id']+'.glb');data=source.read_bytes();encoded=gzip.compress(data,compresslevel=9,mtime=0)
    url='runtime/'+a['id']+'.glb.gz';(assets/url).write_bytes(encoded)
    a.update(url=url,bytes=len(encoded),decodedBytes=len(data),sha256=hashlib.sha256(encoded).hexdigest())
files=[a['url'] for a in items]+sorted({v for t in m.get('textures',{}).values() for v in t.values()})
m['payloadFiles']=files;m['payloadBytes']=sum((assets/f).stat().st_size for f in files);m['decodedAssetBytes']=sum(a['decodedBytes'] for a in items)
m['transport']='GLB served with standard HTTP Content-Encoding: gzip; PNG textures; raw exports excluded from runtime file list'
path.write_text(json.dumps(m,indent=2));print(json.dumps(dict(payload=m['payloadBytes'],manifest=path.stat().st_size,decoded=m['decodedAssetBytes'],files=len(files))))
