import bpy,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
assert Path(bpy.data.filepath).resolve()==(root/'source/LUMENFALL_Stage03_Runtime_Working.blend').resolve()
p=root/'assets/manifest.json';m=json.loads(p.read_text())
wall=bpy.data.objects['LF_Curtain_Wall_Staggered_Ashlar.001_sector_4']
points=[wall.matrix_world@v.co for v in wall.data.vertices]
m['cameraWall']=dict(center=[0,-1.565295],radius=min(math.hypot(v.x,v.y-1.565295) for v in points),minY=min(v.z for v in points),maxY=max(v.z for v in points)+.5)
p.write_text(json.dumps(m,indent=2));print(m['cameraWall'])
