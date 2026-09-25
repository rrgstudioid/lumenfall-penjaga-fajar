import bpy,json,hashlib,shutil
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
assert Path(bpy.data.filepath).resolve()==(root/'source/LUMENFALL_Stage03_Runtime_Working.blend').resolve()
baseline=root/'evidence/pre-polish';baseline.mkdir(exist_ok=True)
if not (baseline/'manifest.json').exists():
    shutil.copy2(root/'assets/manifest.json',baseline/'manifest.json')
    shutil.copy2(root/'evidence/final-browser.json',baseline/'final-browser.json')
    for p in (root/'evidence').glob('runtime-*.png'):shutil.copy2(p,baseline/p.name)
    shutil.copy2(bpy.data.filepath,root/'source/LUMENFALL_Stage03_PrePolish.blend')
items=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH' or o.get('stage03Group')=='preview-instance':continue
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    items.append(dict(name=o.name,id=o.get('sourceId'),group=o.get('stage03Group'),min=[min(v[i] for v in p) for i in range(3)],max=[max(v[i] for v in p) for i in range(3)],materials=[m.name for m in o.data.materials],triangles=sum(len(p.vertices)-2 for p in o.data.polygons)))
(root/'evidence/polish-inventory.json').write_text(json.dumps(items,indent=2))
print('INSPECTED',len(items),flush=True)
