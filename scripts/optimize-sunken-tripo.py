"""Encode staged glTF albedo/ORM as JPEG; retain lossless normal maps and source files.
Run after stage-sunken-tripo.py with the project Python (Pillow required).
"""
import hashlib, io, json, struct
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dev-assets/sunken-ruins-underwater-v1/revision3'
path=OUT/'tripo-kit.glb'
raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+size]);binary=raw[28+size:]
images={im['bufferView']:im for im in gltf['images']}
packed=bytearray();records=[]
for index,view in enumerate(gltf['bufferViews']):
    payload=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    if index in images:
        im=images[index];image=Image.open(io.BytesIO(payload));stream=io.BytesIO()
        assert max(image.size)<=2048,image.size
        if 'Normal' not in im.get('name',''):
            image.convert('RGB').save(stream,format='JPEG',quality=94,subsampling=0,optimize=True)
            im['mimeType']='image/jpeg';payload=stream.getvalue()
        records.append({'name':im.get('name'),'size':list(image.size),'bytes':len(payload),'mimeType':im['mimeType']})
    view['byteOffset']=len(packed);view['byteLength']=len(payload)
    packed.extend(payload);packed.extend(b'\0'*((-len(packed))%4))
gltf['buffers'][0]['byteLength']=len(packed)
metadata=json.dumps(gltf,separators=(',',':')).encode();metadata+=b' '*((-len(metadata))%4)
output=struct.pack('<III',0x46546c67,2,28+len(metadata)+len(packed))+struct.pack('<II',len(metadata),0x4e4f534a)+metadata+struct.pack('<II',len(packed),0x004e4942)+packed
path.write_bytes(output)
manifest_path=OUT/'tripo-manifest.json';manifest=json.loads(manifest_path.read_text())
manifest.update(bytes=len(output),sha256=hashlib.sha256(output).hexdigest(),textures=records)
manifest['modifications']+=' One reconstruction needle removed from the staged reef. Albedo/ORM encoded locally as JPEG quality 94; normal maps remain lossless.'
manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps({'bytes':len(output),'textures':records}))
