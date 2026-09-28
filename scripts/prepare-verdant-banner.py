"""Pack only Banner_1 and its three colour textures from the local kit."""
from pathlib import Path
from PIL import Image
import zipfile,json,io,struct
root=Path(__file__).resolve().parents[1]
src=Path(r'C:\Users\GG\Desktop\Lumenfall\Master_Model_Lumenfall\Environment\Building\Fantasy_Props_MegaKit.zip')
with zipfile.ZipFile(src) as z:
 prefix='Exports/glTF/';doc=json.loads(z.read(prefix+'Banner_1.gltf'));binary=bytearray(z.read(prefix+doc['buffers'][0]['uri']))
 old_textures=doc['textures'];old_images=doc['images'];doc['textures']=[];doc['images']=[]
 for mat in doc.get('materials',[]):
  mat.pop('normalTexture',None);mat.pop('occlusionTexture',None)
  pbr=mat.get('pbrMetallicRoughness',{});pbr.pop('metallicRoughnessTexture',None);pbr['roughnessFactor']=.9;pbr['metallicFactor']=0
  tex=pbr.get('baseColorTexture')
  if tex is None:continue
  record=old_textures[tex['index']].copy();image=Image.open(io.BytesIO(z.read(prefix+old_images[record['source']]['uri'])));image.thumbnail((512,512));out=io.BytesIO();image.save(out,format='PNG',optimize=True)
  while len(binary)%4:binary.append(0)
  view={'buffer':0,'byteOffset':len(binary),'byteLength':len(out.getvalue())};binary.extend(out.getvalue());doc['bufferViews'].append(view)
  record['source']=len(doc['images']);doc['images'].append({'bufferView':len(doc['bufferViews'])-1,'mimeType':'image/png'})
  tex['index']=len(doc['textures']);doc['textures'].append(record)
 doc['buffers']=[{'byteLength':len(binary)}]
 while len(binary)%4:binary.append(0)
 header=json.dumps(doc,separators=(',',':')).encode()
 while len(header)%4:header+=b' '
 out=root/'public/assets/maps/verdant-plains-v2/banner.glb';out.write_bytes(struct.pack('<III',0x46546c67,2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary)
 provenance=out.parent/'provenance.json';p=json.loads(provenance.read_text());p['sources']=[r for r in p['sources'] if r['asset']!='banner.glb']+[{'asset':'banner.glb','source':str(src),'entry':'Exports/glTF/Banner_1.gltf'}];provenance.write_text(json.dumps(p,indent=2))
 print(out.name,out.stat().st_size)
