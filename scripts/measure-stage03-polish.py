"""Read-only mesh measurements of the scaled working candidate."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
assert Path(bpy.data.filepath).resolve()==(R/'source/LUMENFALL_Stage03_Runtime_Working.blend').resolve()
M=json.loads((R/'assets/manifest.json').read_text());objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('stage03Group') not in ['collision','preview-instance',None]]
def bbox(o):
 p=[o.matrix_world@v.co for v in o.data.vertices];return [min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]
rows=[]
for o in objects:
 n=o.name;lo,hi=bbox(o);h=hi[2]-lo[2]
 kind='table' if 'Inn_Outdoor_Table' in n else 'counter' if any(t in n for t in ['Merchant_Display_Table','Apothecary_Counter','Weapon_Blade_Counter','Forge_Tool_Workbench']) else None
 if kind:target=.9 if kind=='table' else 1.1;rows.append(dict(id=n,kind=kind,height=h,target=target,passTarget=abs(h-target)<.025))
 if n.startswith('LF2_') and '_wood.' in n and 2.7<h<3.2 and math.hypot(hi[0]-lo[0],hi[1]-lo[1])<3:
  width=math.hypot(hi[0]-lo[0],hi[1]-lo[1]);rows.append(dict(id=n,kind='door',height=h,width=width,passTarget=h>=2.999 and width>=1.799,method='mesh height and projected XY span; closed visual door'))
steps=sorted([o for o in objects if o.name.startswith('LF_Grand_Hall_Approach_Step_')],key=lambda o:o.name)
tops=[bbox(o)[1][2] for o in steps];risers=[b-a for a,b in zip(tops,tops[1:])]
rows.append(dict(id='Grand Hall approach',kind='stairs',risers=risers,passTarget=all(.12<=r<=.20 for r in risers)))
warps=sorted([o for o in objects if o.name.startswith('LF_Warp_Plaza_Step_')],key=lambda o:o.name);tops=[bbox(o)[1][2] for o in warps];risers=[b-a for a,b in zip(tops,tops[1:])]
rows.append(dict(id='Warp ring',kind='stairs',risers=risers,passTarget=all(.12<=r<=.20 for r in risers)))
def distance_point_segment(p,a,b):
 ab=b-a;t=max(0,min(1,(p-a).dot(ab)/max(ab.length_squared,1e-12)));return (p-a-ab*t).length
for left in objects:
 if not left.name.startswith('LF_Road_Edge_') or '_L.' not in left.name:continue
 right=next((o for o in objects if o.name==left.name.replace('_L.','_R.')),None)
 if not right:continue
 lp=[Vector((v.co.x,v.co.y)) for v in left.data.vertices];rp=[Vector((v.co.x,v.co.y)) for v in right.data.vertices]
 d=min(distance_point_segment(p,rp[e.vertices[0]],rp[e.vertices[1]]) for p in lp for e in right.data.edges)
 rows.append(dict(id=left.name.replace('_L.001',''),kind='road',minimumCurbSeparation=d,passTarget=d>=6,method='minimum vertex to opposite curb segment in XY'))
for n in ['S03P_Quest_Parchment','LF3_Inn_Tableware','LF3_Merchant_Produce','LF3_Forge_Metalwork_Tools']:
 selected=[o for o in objects if o.name.startswith(n)]
 if selected:rows.append(dict(id=n,kind='supportOrReadableHeight',minZ=min(bbox(o)[0][2] for o in selected),maxZ=max(bbox(o)[1][2] for o in selected)))
issues=[];degenerate=[];fingerprints={};duplicate=[]
for o in objects:
 if any(not math.isfinite(c) for v in o.data.vertices for c in v.co):issues.append(dict(id=o.name,issue='nonfinite vertex'))
 if not o.data.uv_layers:issues.append(dict(id=o.name,issue='missing UV'))
 o.data.calc_loop_triangles();count=sum(t.area<1e-10 for t in o.data.loop_triangles)
 if count:degenerate.append(dict(id=o.name,count=count,new=o.name.startswith('S03P_')))
 if o.name.startswith('S03P_'):
  key=(o['stage03Group'],tuple(m.name for m in o.data.materials),hashlib.sha256(str([(tuple(round(c,5) for c in v.co)) for v in o.data.vertices]).encode()).hexdigest())
  if key in fingerprints:duplicate.append([fingerprints[key],o.name])
  fingerprints[key]=o.name
residence=next(o for o in objects if o.name.startswith('LF2_Residence_B_stone'));lo,hi=bbox(residence)
baseline=json.loads((R/'evidence/pre-polish/manifest.json').read_text());record=next(r for r in baseline['records'] if 'Residence_B_stone' in r['id'])
preserved=max(abs(x-y) for x,y in zip(lo+hi,record['min']+record['max']))<.0001
result=dict(measurements=rows,geometryIssues=issues,degenerateFaces=degenerate,duplicateNewMeshes=duplicate,residenceBUnchanged=preserved,collisionAssetHash=hashlib.sha256((R/'assets'/M['collision']['url']).read_bytes()).hexdigest(),sourceHash=hashlib.sha256(Path(json.loads((R/'provenance.json').read_text(encoding='utf-8-sig'))['source']).read_bytes()).hexdigest())
(R/'evidence/polish-measurements.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
