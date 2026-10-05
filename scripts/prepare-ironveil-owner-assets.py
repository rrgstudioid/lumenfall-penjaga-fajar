"""Stage owner-supplied Ironveil GLBs without changing source geometry/assets."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/maps/ironveil-mines-exterior-v1'
SOURCES = [
    ('tree_04_cypress_fixed.glb', 'cypress.glb', 'cypress-basecolor.webp'),
    ('LUMENFALL_Rock_01.glb', 'owner-rock-01.glb', 'owner-rock-basecolor.webp'),
    ('LUMENFALL_Rock_04.glb', 'owner-rock-04.glb', 'owner-rock-basecolor.webp'),
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

records = []
for source, target, texture_name in SOURCES:
    original = Path('D:/Lumenfall') / source
    data = original.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    binary = data[28+length:]
    image_views = set()
    texture_records = []
    for img in doc.get('images', []):
        index = img.pop('bufferView')
        image_views.add(index)
        view = doc['bufferViews'][index]
        start = view.get('byteOffset', 0)
        image_bytes = binary[start:start+view['byteLength']]
        image = Image.open(BytesIO(image_bytes))
        source_size = image.size
        image.thumbnail((1024,1024), Image.Resampling.LANCZOS)
        stream = BytesIO()
        image.save(stream, format='WEBP', quality=90, method=6)
        output = stream.getvalue()
        texture_path = OUT / texture_name
        if texture_path.exists() and source == 'LUMENFALL_Rock_04.glb':
            assert texture_path.read_bytes() == output, 'Shared rock textures differ'
        else:
            texture_path.write_bytes(output)
        img['uri'] = texture_name
        img.pop('mimeType', None)
        texture_records.append({'file':texture_name,'sourceSha256':sha(image_bytes),
            'sha256':sha(output),'sourceSize':source_size,'runtimeSize':image.size})
    for tex in doc.get('textures', []):
        tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex.pop('source')}
    for key in ['extensionsUsed','extensionsRequired']:
        doc[key] = list(dict.fromkeys(doc.get(key, []) + ['EXT_texture_webp']))
    packed = bytearray()
    views = []
    remap = {}
    for i, view in enumerate(doc['bufferViews']):
        if i in image_views:
            continue
        remap[i] = len(views)
        start = view.get('byteOffset',0)
        new = dict(view)
        new['byteOffset'] = len(packed)
        views.append(new)
        packed += binary[start:start+view['byteLength']]
        while len(packed) % 4:
            packed.append(0)
    for accessor in doc['accessors']:
        if 'bufferView' in accessor:
            accessor['bufferView'] = remap[accessor['bufferView']]
    doc['bufferViews'] = views
    doc['buffers'] = [{'byteLength':len(packed)}]
    encoded = json.dumps(doc,separators=(',',':')).encode()
    while len(encoded) % 4:
        encoded += b' '
    total = 12+8+len(encoded)+8+len(packed)
    staged = struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed
    (OUT/target).write_bytes(staged)
    assert sha(original.read_bytes()) == sha(data), 'Source changed'
    records.append({'source':str(original),'sourceSha256':sha(data),'file':target,
        'sha256':sha(staged),'bytes':len(staged),'geometryUnchanged':True,
        'materialsPreserved':True,'textures':texture_records})
report = {'map':'ironveil-mines-exterior-v1','sourceUnmodified':True,'sources':records}
(OUT/'owner-assets-provenance.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'stagedModels':len(records),'uniqueTextures':2,'modelBytes':sum(r['bytes'] for r in records)}))
