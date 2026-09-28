"""Repack selected runtime GLBs; normalize images even inside source node groups."""
import json,struct,io
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]/'public/assets/maps/verdant-plains-v2'
for path in root.glob('*.glb'):
 data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);binary=data[28+length:]
 image_views={image['bufferView'] for image in doc.get('images',[])};chunks=bytearray()
 for i,view in enumerate(doc['bufferViews']):
  chunk=binary[view.get('byteOffset',0):][:view['byteLength']]
  if i in image_views:
   image=Image.open(io.BytesIO(chunk));image.thumbnail((512,512));out=io.BytesIO();image.save(out,format='PNG',optimize=True);chunk=out.getvalue()
  while len(chunks)%4:chunks.append(0)
  view['byteOffset']=len(chunks);view['byteLength']=len(chunk);chunks.extend(chunk)
 for image in doc.get('images',[]):image['mimeType']='image/png'
 for mat in doc.get('materials',[]):
  mat.pop('normalTexture',None);mat.pop('occlusionTexture',None)
  pbr=mat.get('pbrMetallicRoughness',{});pbr.pop('metallicRoughnessTexture',None);pbr['roughnessFactor']=.95;pbr['metallicFactor']=0
 doc['buffers'][0]['byteLength']=len(chunks)
 while len(chunks)%4:chunks.append(0)
 header=json.dumps(doc,separators=(',',':')).encode()
 while len(header)%4:header+=b' '
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(header)+len(chunks))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(chunks),0x004e4942)+chunks)
 print(path.name,path.stat().st_size)
