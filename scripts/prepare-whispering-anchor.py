from pathlib import Path
import json,struct,io,hashlib
from PIL import Image
source=Path(r'D:\Lumenfall\LUMENFALL_Tree_Lush_Optimized.glb')
data=source.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);binary=data[28+n:]
images={im['bufferView'] for im in doc['images']}
out=bytearray()
for i,v in enumerate(doc['bufferViews']):
 b=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 if i in images:
  im=Image.open(io.BytesIO(b));im.thumbnail((1024,1024));stream=io.BytesIO();im.save(stream,'PNG',optimize=True);b=stream.getvalue()
 v['byteOffset']=len(out);v['byteLength']=len(b);out.extend(b);out.extend(b'\x00'*((-len(out))%4))
doc['buffers'][0]['byteLength']=len(out)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out
target=Path('output/whispering-wilds/asset-candidates/ancient-tree.glb');target.write_bytes(result)
manifest={'source':str(source),'sourceSha256':hashlib.sha256(data).hexdigest(),'file':str(target),'sha256':hashlib.sha256(result).hexdigest(),'bytes':len(result),'operation':'Resize embedded textures to 1024; preserve source meshes and source file','triangles':33133}
Path('output/whispering-wilds/asset-candidates/ancient-tree.provenance.json').write_text(json.dumps(manifest,indent=2))
print(manifest)
