import bpy,json,hashlib,math,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];W=R/'work/chibi-source';S=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else Path(r'C:/Users/GG/Desktop/Lumenfall/anime style chibi boy 3d model.glb')
W.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(S))
o=next(o for o in bpy.data.objects if o.type=='MESH');bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
lo=Vector(tuple(min(v.co[i] for v in o.data.vertices) for i in range(3)));hi=Vector(tuple(max(v.co[i] for v in o.data.vertices) for i in range(3)))
f=2.08/(hi.z-lo.z)
for v in o.data.vertices:v.co=(v.co-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))*f
o.name='ChibiSource';o.data.update()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.render.resolution_x=760;s.render.resolution_y=900;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;n=s.world.node_tree.nodes.get('Background');n.inputs[0].default_value=(.18,.21,.24,1);n.inputs[1].default_value=.7
for name,pos,power in [('Key',(3,-4,5),450),('Fill',(-3,-1,3),220),('Rim',(1,3,4),350)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=4;l=bpy.data.objects.new(name,d);s.collection.objects.link(l);l.location=pos;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Audit');c=bpy.data.objects.new('Audit',d);s.collection.objects.link(c);s.camera=c;d.type='ORTHO';d.ortho_scale=2.5
report={'sourcePath':str(S),'sourceSHA256':hashlib.sha256(S.read_bytes()).hexdigest(),'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'bounds':[list(lo),list(hi)],'height':2.08,'images':[(i.name,list(i.size))for i in bpy.data.images]};(W/'audit.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(W/'source.blend'))
for name,pos in [('front',(0,-6,1.05)),('back',(0,6,1.05)),('side',(6,0,1.05)),('quarter',(4,-6,2.4))]:
 c.location=pos;c.rotation_euler=(Vector((0,0,1.04))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(W/(name+'.png'));bpy.ops.render.render(write_still=True)
print('AUDIT',json.dumps(report),flush=True)

import bpy,numpy as np,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];W=R/'work/chibi-source';bpy.ops.wm.open_mainfile(filepath=str(W/'source.blend'),load_ui=False,use_scripts=False);o=bpy.data.objects['ChibiSource'];image=next(n.image for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'basecolor' in n.image.name)
a=np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4);uv=o.data.uv_layers.active.data
colors=[];flags=[]
for p in o.data.polygons:
 ts=[uv[i].uv for i in p.loop_indices];u=sum(t.x for t in ts)/len(ts);v=sum(t.y for t in ts)/len(ts);c=a[min(image.size[1]-1,int(v*image.size[1])),min(image.size[0]-1,int(u*image.size[0])),:3];x,y,z=p.center;r,g,b=c
 # Brown hair at the crown/sides/back. Protect face, eyes and neck.
 eligible=z>1.78 or (z>1.40 and (y>.045 or abs(x)>.16)) or (z>1.60 and y<0)
 brown=r<.70 and r>g*1.18 and g>b*1.05
 face_eye=abs(x)<.15 and z<1.715 and y>-.205 and y<-.07
 hair=eligible and brown and not face_eye
 flags.append(hair);colors.append(list(map(float,c)))
# All candidate locks connect to the crown; UV seams connect by position.
adj={}
for p in o.data.polygons:
 for vi in p.vertices:
  key=tuple(round(float(v),4) for v in o.data.vertices[vi].co);adj.setdefault(key,[]).append(p.index)
seen={p.index for p in o.data.polygons if flags[p.index] and p.center.z>1.90};queue=list(seen)
while queue:
 i=queue.pop()
 for vi in o.data.polygons[i].vertices:
  key=tuple(round(float(v),4)for v in o.data.vertices[vi].co)
  for j in adj[key]:
   if flags[j] and j not in seen:seen.add(j);queue.append(j)
(W/'segmentation.json').write_text(json.dumps({'hairFaces':sorted(seen),'colors':colors}));print('HAIR',len(seen),'triangles',len(o.data.polygons),flush=True)
for name,color in [('SkinInspect',(.25,.65,.8,1)),('HairInspect',(.8,.10,.035,1))]:
 m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color;o.data.materials.append(m)
for p in o.data.polygons:p.material_index=2 if p.index in seen else 1
s=bpy.context.scene;c=s.camera;c.location=(0,-6,1.05);c.rotation_euler=(Vector((0,0,1.04))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(W/'seg-front.png');bpy.ops.render.render(write_still=True)
c.location=(0,6,1.05);c.rotation_euler=(Vector((0,0,1.04))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(W/'seg-back.png');bpy.ops.render.render(write_still=True)
