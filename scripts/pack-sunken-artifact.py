"""Repack a staged revision6 GLB only; keep all geometry, UVs and normal maps.
Albedo/ORM use high-quality JPEG, source downloads are never modified.
"""
import hashlib, io, json, struct, sys
from pathlib import Path
from PIL import Image
revision=sys.argv[2] if len(sys.argv)>2 else 'revision6'
assert revision in ['revision6','revision12','revision13']
root=Path(__file__).resolve().parents[1]/'dev-assets/sunken-ruins-underwater-v1'/revision
name=sys.argv[1];path=root/f'{name}.glb'
assert path.resolve().parent==root.resolve()
raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+size]);binary=raw[28+size:]
images={im['bufferView']:im for im in gltf.get('images',[])}
normal_sources={gltf['textures'][m['normalTexture']['index']]['source'] for m in gltf.get('materials',[]) if 'normalTexture' in m}
normal_views={gltf['images'][i]['bufferView'] for i in normal_sources}
packed=bytearray();records=[]
for i,view in enumerate(gltf['bufferViews']):
    payload=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    if i in images:
        im=images[i];img=Image.open(io.BytesIO(payload));assert max(img.size)<=2048
        if i not in normal_views:
            stream=io.BytesIO();img.convert('RGB').save(stream,format='JPEG',quality=94,subsampling=0,optimize=True)
            payload=stream.getvalue();im['mimeType']='image/jpeg'
        records.append({'name':im.get('name'),'size':list(img.size),'bytes':len(payload),'mimeType':im['mimeType']})
    view['byteOffset']=len(packed);view['byteLength']=len(payload);packed.extend(payload);packed.extend(b'\0'*((-len(packed))%4))
gltf['buffers'][0]['byteLength']=len(packed)
meta=json.dumps(gltf,separators=(',',':')).encode();meta+=b' '*((-len(meta))%4)
output=struct.pack('<III',0x46546c67,2,28+len(meta)+len(packed))+struct.pack('<II',len(meta),0x4e4f534a)+meta+struct.pack('<II',len(packed),0x004e4942)+packed
path.write_bytes(output)
manifest_path=root/f'{name}.json';manifest=json.loads(manifest_path.read_text(encoding='utf8'))
manifest.update(bytes=len(output),sha256=hashlib.sha256(output).hexdigest(),textures=records)
manifest['modifications']+=' Albedo/ORM encoded as JPEG quality 94; normals retained losslessly.'
manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps({'name':name,'bytes':len(output),'textures':records}))
