"""Split the owner's five side-by-side mushrooms into normalized runtime meshes.
Preserves every source triangle, UV and normal. Never writes the source GLB.
"""
from pathlib import Path
from io import BytesIO
from PIL import Image
import struct, json, hashlib

SOURCE = Path(r'D:\Lumenfall\colorful mushrooms 3d model.glb')
OUT = Path(__file__).resolve().parents[1] / 'public/assets/maps/whispering-wilds-v2/mushrooms'
OUT.mkdir(parents=True, exist_ok=True)
raw = SOURCE.read_bytes()
source_hash = hashlib.sha256(raw).hexdigest()
length = struct.unpack_from('<I', raw, 12)[0]
source = json.loads(raw[20:20+length])
binary = raw[28+length:]

def read_accessor(index):
    a = source['accessors'][index]
    v = source['bufferViews'][a['bufferView']]
    count = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    code = {5126: 'f', 5125: 'I'}[a['componentType']]
    return list(struct.iter_unpack('<'+code*count, binary[offset:offset+a['count']*count*4]))

positions, normals, uv = [read_accessor(i) for i in range(3)]
indices = [i[0] for i in read_accessor(3)]
faces = list(zip(indices[::3], indices[1::3], indices[2::3]))
# Measured empty gaps between the five silhouettes. Small detached cap/stem
# components remain with the surrounding source variant, rather than being lost.
cuts = [-0.29443, -0.11035, 0.09253, 0.29639]
def variant(x):
    return sum(x > edge for edge in cuts)
groups = [[] for _ in range(5)]
for face in faces:
    kinds = {variant(positions[i][0]) for i in face}
    assert len(kinds) == 1, 'A source triangle crosses a variant boundary'
    groups[kinds.pop()].append(face)

view = source['bufferViews'][source['images'][0]['bufferView']]
offset = view.get('byteOffset', 0)
image = Image.open(BytesIO(binary[offset:offset+view['byteLength']])).convert('RGB')
original_size = list(image.size)
image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
encoded = BytesIO(); image.save(encoded, 'JPEG', quality=90, optimize=True)

out = {'asset': {'version':'2.0','generator':'LUMENFALL derivative of owner-supplied Tripo GLB'},
       'scene':0,'scenes':[{'nodes':list(range(5))}], 'nodes':[], 'meshes':[],
       'accessors':[], 'bufferViews':[],
       'materials':[{'name':'Shared mushroom painted atlas','pbrMetallicRoughness':{
           'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':0.8}}],
       'textures':[{'source':0,'sampler':0}],
       'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
payload = bytearray()
def add_view(data, target=None):
    while len(payload)%4: payload.append(0)
    view = {'buffer':0,'byteOffset':len(payload),'byteLength':len(data)}
    if target: view['target']=target
    out['bufferViews'].append(view); payload.extend(data)
    return len(out['bufferViews'])-1
out['images']=[{'bufferView':add_view(encoded.getvalue()),'mimeType':'image/jpeg'}]
def accessor(values, kind, code='f'):
    components={'VEC3':3,'VEC2':2,'SCALAR':1}[kind]
    data=b''.join(struct.pack('<'+code*components,*v) for v in values)
    entry={'bufferView':add_view(data,34963 if code=='H' else 34962),
           'componentType':5123 if code=='H' else 5126,'count':len(values),'type':kind}
    if kind=='VEC3':
        entry['min']=[min(v[i] for v in values) for i in range(3)]
        entry['max']=[max(v[i] for v in values) for i in range(3)]
    out['accessors'].append(entry);return len(out['accessors'])-1

records=[]
for kind, grouped in enumerate(groups):
    used=sorted({i for f in grouped for i in f}); remap={old:new for new,old in enumerate(used)}
    low=[min(positions[i][a] for i in used) for a in range(3)]
    high=[max(positions[i][a] for i in used) for a in range(3)]
    height=high[1]-low[1]; center=[(low[0]+high[0])/2,low[1],(low[2]+high[2])/2]
    centered=[tuple((positions[i][a]-center[a])/height for a in range(3)) for i in used]
    attrs={'POSITION':accessor(centered,'VEC3'),'NORMAL':accessor([normals[i] for i in used],'VEC3'),
           'TEXCOORD_0':accessor([uv[i] for i in used],'VEC2')}
    ind=accessor([(remap[i],) for f in grouped for i in f],'SCALAR','H')
    name=f'Mushroom variant {kind+1}'
    out['nodes'].append({'name':name,'mesh':kind})
    out['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'indices':ind,'material':0,'mode':4}]})
    records.append({'variant':kind+1,'sourceBounds':[low,high],'vertices':len(used),'triangles':len(grouped),
                    'runtimeHeight':1,'sourceGroundCenter':center})
out['buffers']=[{'byteLength':len(payload)}]
header=json.dumps(out,separators=(',',':')).encode()
header+=b' '*((-len(header))%4);payload+=b'\0'*((-len(payload))%4)
result=struct.pack('<III',0x46546c67,2,28+len(header)+len(payload))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(payload),0x004e4942)+payload
target=OUT/'five-mushrooms.glb';target.write_bytes(result)
assert sum(r['triangles'] for r in records)==len(faces)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
report={'source':str(SOURCE),'sourceSha256':source_hash,'sourceUnmodified':True,
        'sourceBytes':len(raw),'runtimeFile':target.name,'runtimeBytes':len(result),
        'runtimeSha256':hashlib.sha256(result).hexdigest(),'textureOriginalSize':original_size,
        'textureRuntimeSize':list(image.size),'variants':records}
(OUT/'provenance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
