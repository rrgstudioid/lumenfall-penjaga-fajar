"""Stage the owner's bald body and ten hair meshes. Never writes either source.

Blender --background --factory-startup --python scripts/ingest-owner-male.py -- BODY HAIR
The runtime's existing rig is read from its authoring checkpoint. Exported bind
matrices must pass the runtime/equipment tests before derivatives are promoted.
"""
import bpy, bmesh, json, math, hashlib, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
W=ROOT/'work/owner-male'; OUT=W/'assets'
for d in ['body','hair','textures','thumbnails']: (OUT/d).mkdir(parents=True,exist_ok=True)
args=sys.argv[sys.argv.index('--')+1:]
BODY,HAIR=map(Path,args[:2])
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [BODY,HAIR]}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
def select(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
def imported(path):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path))
 o=next(o for o in set(bpy.data.objects)-before if o.type=='MESH')
 select(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 # glTF splits vertices at atlas islands. Weld coincident geometry while retaining
 # loop UVs, so skinning, normals and LOD reduction cross those seams smoothly.
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(o.data);bm.free()
 for edge in o.data.edges:edge.use_edge_sharp=False
 for polygon in o.data.polygons:polygon.use_smooth=True
 o.parent=None;return o
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
with bpy.data.libraries.load(str(ROOT/'work/chibi-source/rigged-source.blend'),link=False) as (src,dst):
 dst.objects=['MaleV2Rig']
rig=dst.objects[0];scene.collection.objects.link(rig)
rig.animation_data_clear()
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
body=imported(BODY);body.name='MaleBody'
scale=1.94/max(v.co.z for v in body.data.vertices)
for v in body.data.vertices:v.co*=scale
body.data.update()
# Save source-coordinate triangles/UVs before the A-to-T rest-pose adaptation.
source_positions=[list(v.co) for v in body.data.vertices]
body_uv=body.data.uv_layers.active.data
base=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'basecolor' in n.image.name.lower())
pixels=np.array(base.pixels[:],dtype=np.float32).reshape(base.size[1],base.size[0],4)
# Segment the source skin palette across the complete atlas, including its
# authored island padding. Geometry cutoffs omitted the chest/shoulders;
# triangle-only rasterization left orange seams when filtering the UV borders.
# Neutral cloth, dark brows/irises and white eyes retain their authored color.
size=1024;mask=np.zeros((size,size,4),dtype=np.float32);mask[:,:,3]=1
color=pixels.reshape(size,base.size[1]//size,size,base.size[0]//size,4).mean(axis=(1,3))
r,g,b=color[:,:,0],color[:,:,1],color[:,:,2]
mask[:,:,0]=np.clip((r-g-.14)/.065,0,1)*np.clip((g-b-.055)/.035,0,1)*np.clip((r-.25)/.20,0,1)
# Green preserves the supplied fine mouth line as neutral value detail. It
# must recolor with the skin, rather than retain an orange line on dark tones.
# This soft anatomical region does not draw a new mouth or change its shape.
for p in body.data.polygons:
 vertices=np.array([body.data.vertices[j].co[:] for j in p.vertices])
 if vertices[:,2].min()>1.59 or vertices[:,2].max()<1.54 or vertices[:,1].min()>-.10 or vertices[:,0].min()>.065 or vertices[:,0].max()<-.065:continue
 q=np.array([body_uv[j].uv[:] for j in p.loop_indices])*size
 left=max(0,int(q[:,0].min())-1);right=min(size-1,int(q[:,0].max())+1)
 bottom=max(0,int(q[:,1].min())-1);top=min(size-1,int(q[:,1].max())+1)
 yy,xx=np.mgrid[bottom:top+1,left:right+1];xx=xx+.5;yy=yy+.5;a,b,c=q
 den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
 if abs(den)<1e-10:continue
 w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
 w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w2=1-w0-w1
 pos=w0[...,None]*vertices[0]+w1[...,None]*vertices[1]+w2[...,None]*vertices[2]
 value=np.exp(-((pos[:,:,0]/.055)**4+((pos[:,:,2]-1.565)/.011)**4))
 inside=(w0>=-.001)&(w1>=-.001)&(w2>=-.001)&(pos[:,:,1]<-.10)
 patch=mask[bottom:top+1,left:right+1,1];patch[inside]=np.maximum(patch[inside],value[inside])
im=bpy.data.images.new('OwnerSkinMask',width=size,height=size,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(mask.ravel());im.filepath_raw=str(OUT/'textures/body-skin-mask.png');im.file_format='PNG';im.save()

# Adapt only the rest pose to the existing 20-bone skeleton, retaining source UVs.
# The body mesh is supplied in A pose; equipment/motion are authored in T pose.
# Solve deformation weights on the actual A-pose source before adapting rest pose.
source_rig=rig.copy();source_rig.data=rig.data.copy();scene.collection.objects.link(source_rig);source_rig.name='SourcePoseRig'
select(source_rig);bpy.ops.object.mode_set(mode='EDIT')
for suffix,sign in [('l',1),('r',-1)]:
 anchors=[Vector((sign*x,y,z))for x,y,z in [(.193,.005,1.37),(.285,.005,1.115),(.355,-.005,.89),(.38,-.005,.745)]]
 for i,prefix in enumerate(['upperarm_','lowerarm_','hand_']):
  bone=source_rig.data.edit_bones[prefix+suffix];bone.head=anchors[i];bone.tail=anchors[i+1];bone.roll=0
bpy.ops.object.mode_set(mode='OBJECT')
select(body);source_rig.select_set(True);bpy.context.view_layer.objects.active=source_rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# UV seams duplicate positions in glTF. They must deform with identical weights.
seams={}
for v in body.data.vertices:
 key=tuple(round(c,5)for c in v.co);seams.setdefault(key,[]).append(v.index)
solved=[[]for v in body.data.vertices]
for ids in seams.values():
 merged={}
 for idx in ids:
  for g in body.data.vertices[idx].groups:merged[g.group]=merged.get(g.group,0)+g.weight/len(ids)
 for idx in ids:solved[idx]=list(merged.items())
valid=[v for v in body.data.vertices if sum(w for _,w in solved[v.index])>1e-8]
if len(valid)<len(body.data.vertices)*.9:raise RuntimeError('Automatic skinning did not solve enough of the body')
tree=KDTree(len(valid))
for v in valid:tree.insert(v.co,v.index)
tree.balance()
print('SOURCE_WEIGHT_REPAIR',len(body.data.vertices)-len(valid),flush=True)
for v in body.data.vertices:
 x,y,z=v.co;ax=abs(x);side='l'if x>0 else'r'
 if .68<z<1.49 and ax>(.07 if z>1.2 else .18+max(0,1.12-z)*.45):
  allowed={'spine_01','spine_03','neck_01','head','clavicle_'+side,'upperarm_'+side,'lowerarm_'+side,'hand_'+side}
  weights=sorted([(g,w)for g,w in (solved[v.index] or solved[tree.find(v.co)[1]])if body.vertex_groups[g].name in allowed],key=lambda x:-x[1])[:4]
  total=sum(w for _,w in weights)
  if total<1e-8:raise RuntimeError('Unweighted source arm vertex '+str(v.index))
  ws={body.vertex_groups[g].name:w/total for g,w in weights}
 elif z>1.49:ws={'head':1}
 elif z<.93 and ax>.035:
  hip=smooth(.77,.93,z);knee=1-smooth(.43,.55,z);ankle=1-smooth(.115,.215,z)
  ws={'pelvis':hip,'thigh_'+side:(1-hip)*(1-knee),'calf_'+side:(1-hip)*knee*(1-ankle),'foot_'+side:(1-hip)*knee*ankle}
 elif z>1.34:
  t=smooth(1.35,1.49,z);ws={'spine_03':1-t,'head':t}
 elif z>1.06:
  t=smooth(1.06,1.24,z);ws={'spine_01':1-t,'spine_03':t}
 else:
  t=smooth(.94,1.10,z);ws={'pelvis':1-t,'spine_01':t}
 for group in body.vertex_groups:group.remove([v.index])
 for name,w in ws.items():
  if w>1e-6:body.vertex_groups[name].add([v.index],w,'REPLACE')
for bone in source_rig.pose.bones:
 target=rig.data.bones[bone.name]
 bone.matrix=target.matrix_local@Matrix.Diagonal((1,target.length/bone.bone.length,1,1))
 bpy.context.view_layer.update()
select(body)
for modifier in list(body.modifiers):
 if modifier.type=='ARMATURE':bpy.ops.object.modifier_apply(modifier=modifier.name)
body.parent=None
bpy.data.objects.remove(source_rig,do_unlink=True)
body.parent=rig;mod=body.modifiers.new('MaleSkin','ARMATURE');mod.object=rig
body.data.normals_split_custom_set([(0,0,0)]*len(body.data.loops))
body.data.update()
for name,bone,pt in [('HeadSocket','head',(0,.01,1.78)),('WeaponSocketR','hand_r',(-.79,-.01,1.35)),('WeaponSocketL','hand_l',(.79,-.01,1.35)),('BackSocket','spine_03',(0,.13,1.23))]:
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=rig;o.parent_type='BONE';o.parent_bone=bone;bpy.context.view_layer.update();o.matrix_world=Matrix.Translation(Vector(pt))
head_faces=[p.vertices[:] for p in body.data.polygons if all(source_positions[v][2]>1.46 for v in p.vertices)]
head=BVHTree.FromPolygons([v.co for v in body.data.vertices],head_faces)
head_center=Vector((0,.025,1.73))
def fit_scalp(o,margin=.020,surface=head,sample_faces=False,vertex_indices=None):
 max_push=0
 # Move the entire local lock thickness together. Clamping both its inner and
 # outer surfaces onto the same skull radius creates z-fighting and crushed locks.
 # Smooth angular offset field preserves thickness and avoids collapsing paired
 # lock surfaces. Adjacent UV seam vertices get exactly the same deformation.
 rows,cols=24,48;field=np.zeros((rows,cols));coords=[]
 vertices=[v for v in o.data.vertices if vertex_indices is None or v.index in vertex_indices]
 for v in vertices:
  d=v.co-head_center;direction=d.normalized()
  rowf=(math.asin(max(-1,min(1,direction.z)))+math.pi/2)/math.pi*(rows-1)
  colf=(math.atan2(direction.y,direction.x)%(2*math.pi))/(2*math.pi)*cols
  coords.append((rowf,colf,direction))
  if v.co.z<1.49:continue
  skin,_,_,_=surface.ray_cast(head_center+direction,-direction,2)
  if skin is not None:
   needed=max(0,(skin-head_center).length+margin-d.length)
   ri=int(round(rowf));ci=int(round(colf))%cols
   field[ri,ci]=max(field[ri,ci],needed)
 if sample_faces:
  for p in o.data.polygons:
   if vertex_indices is not None and not all(j in vertex_indices for j in p.vertices):continue
   pts=[o.data.vertices[j].co for j in p.vertices]
   for q in [sum(pts,Vector())/len(pts)]+[(pts[j]+pts[(j+1)%len(pts)])/2 for j in range(len(pts))]:
    if q.z<1.49:continue
    d=q-head_center;direction=d.normalized();skin,_,_,_=surface.ray_cast(head_center+direction,-direction,2)
    if skin is None:continue
    ri=round((math.asin(max(-1,min(1,direction.z)))+math.pi/2)/math.pi*(rows-1))
    ci=round((math.atan2(direction.y,direction.x)%(2*math.pi))/(2*math.pi)*cols)%cols
    field[ri,ci]=max(field[ri,ci],(skin-head_center).length+margin-d.length)
 for _ in range(80):
  neighbor=(np.roll(field,1,0)+np.roll(field,-1,0)+np.roll(field,1,1)+np.roll(field,-1,1))/4
  field=np.maximum(field,neighbor)
 for _ in range(4):field=(field*4+np.roll(field,1,0)+np.roll(field,-1,0)+np.roll(field,1,1)+np.roll(field,-1,1))/8
 for v,(rf,cf,direction) in zip(vertices,coords):
  if v.co.z<1.49:continue
  r0=int(rf);r1=min(rows-1,r0+1);c0=int(cf)%cols;c1=(c0+1)%cols;fr=rf-r0;fc=cf-int(cf)
  push=(field[r0,c0]*(1-fc)+field[r0,c1]*fc)*(1-fr)+(field[r1,c0]*(1-fc)+field[r1,c1]*fc)*fr
  v.co+=direction*push*smooth(1.45,1.54,v.co.z);max_push=max(max_push,push)
 return max_push

def seat_mohawk(o,surface):
 # Seat the whole crest against the actual scalp, keeping every lock's shape
 # and thickness. The generic outward clearance would make this open style float.
 hair_surface=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices[:] for p in o.data.polygons])
 gaps=[]
 for x in [-.025,0,.025]:
  for step in range(13):
   y=-.14+step*.02
   root=hair_surface.ray_cast(Vector((x,y,1.4)),Vector((0,0,1)),1.2)[0]
   skin=surface.ray_cast(Vector((x,y,2.6)),Vector((0,0,-1)),1)[0]
   if root is not None and skin is not None:gaps.append(root.z-skin.z)
 assert len(gaps)>=30, f'Mohawk root coverage is incomplete: {len(gaps)}'
 drop=max(0,max(gaps)+.002)
 for v in o.data.vertices:v.co.z-=drop
 o.data.update()
 return {'samples':len(gaps),'drop':drop,'maximumRootGap':max(gaps)-drop}

exec(compile((ROOT/'scripts/repair-owner-hairstyles.py').read_text(), 'repair-owner-hairstyles.py', 'exec'))

body_surfaces={}
def export(o,path,budget,lod):
 copy=o.copy();copy.data=o.data.copy();scene.collection.objects.link(copy);select(copy)
 n=sum(len(p.vertices)-2 for p in copy.data.polygons)
 if o.name=='Hair_10' and lod>0:
  decimate_tied_base(copy,budget,lod,body_surfaces[lod])
 elif n>budget:
  m=copy.modifiers.new('LOD','DECIMATE');m.ratio=budget/n;m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 if o==body:
  body_surfaces[lod]=BVHTree.FromPolygons([v.co for v in copy.data.vertices],[p.vertices[:]for p in copy.data.polygons if all(copy.data.vertices[j].co.z>1.48 and abs(copy.data.vertices[j].co.x)<.27 for j in p.vertices)])
 elif o.name=='Hair_03':
  report.setdefault('mohawkLodContact',[]).append(seat_mohawk(copy,body_surfaces[lod]))
 elif o.name=='Hair_08' and lod>0:
  for _ in range(3):fit_scalp(copy,.003,body_surfaces[lod],sample_faces=True)
 elif o.name=='Hair_01' and lod>0:
  fit_hair_parts(copy,[0,.004,.006,.012][lod],body_surfaces[lod])
 elif o.name=='Hair_10':
  # The base and retained nape patch have already been fitted separately.
  copy.data.attributes.remove(copy.data.attributes['owner_tied_infill'])
 elif o.name in ['Hair_05','Hair_06'] and lod>0:
  for _ in range(3):fit_scalp(copy,[0,.004,.006,.008][lod],body_surfaces[lod],sample_faces=True)
 elif lod>0:
  for _ in range(3):fit_scalp(copy,[0,.008,.012,.022][lod],body_surfaces[lod],sample_faces=True)
 # Preserve disconnected locks and their UVs at every distance. Do not voxel-union
 # them or add a generic scalp shell to meet an arbitrary triangle target.
 for p in copy.data.polygons:p.use_smooth=True
 # Materials/textures are shared runtime resources, never embedded per LOD.
 copy.data.materials.clear();rig.select_set(True)
 for child in rig.children:
  if child.type=='EMPTY':child.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_extras=True,export_materials='NONE')
 n=sum(len(p.vertices)-2 for p in copy.data.polygons);bpy.data.objects.remove(copy,do_unlink=True);return n

report={'sources':[{'path':p,'sha256':h}for p,h in hashes.items()], 'sourceTriangles':len(body.data.polygons),'geometryPolicy':'Owner bald body with A-to-T rest adaptation; original face and UVs. Ten separated owner hairstyles fitted to the supplied scalp. Original files read-only.','hairPolicy':'Source strand detail and UVs retained at LOD0; remove cornrow display scalp and loose remnants, seat braids, fit rear locks to nape. No generated root cap, no per-vertex scalp clamp, no voxel remesh. Lower LODs preserve separate locks.','body':[],'hair':{}}
for lod,budget in enumerate([5000,3600,1800,850]):report['body'].append(export(body,OUT/'body'/f'body-lod{lod}.glb',budget,lod))
hair_source=imported(HAIR);hair_source.data.update()
hair_info=[]
# Authored row-major ordering matches the established persistent hair_01..10 IDs.
crowns=[.575,.550,.520,.579,.570,.212,.244,.249,.278,.260]
scales=[2.45,2.65,2.5,2.45,2.55,2.6,2.45,2.7,2.45,2.6]
for i in range(10):
 cx=-.4+(i%5)*.2;row=i//5
 keep={p.index for p in hair_source.data.polygons if abs(p.center.x-cx)<.1 and ((p.center.z>.32)==(row==0))}
 o=hair_source.copy();o.data=hair_source.data.copy();scene.collection.objects.link(o);o.name=f'Hair_{i+1:02d}'
 bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table()
 bmesh.ops.delete(bm,geom=[p for p in bm.faces if p.index not in keep],context='FACES');bm.to_mesh(o.data);bm.free()
 max_push=0
 for v in o.data.vertices:
  x,y,z=v.co;v.co=Vector(((x-cx)*scales[i],(y-.02)*scales[i]+.025,(z-crowns[i])*scales[i]+1.948))
 o.data.update()
 max_push=fit_scalp(o)
 if i==2:
  # The montage's forward-leaning crest needs a rigid placement adjustment,
  # not inflation or a generated basic-hair cap beneath the roots.
  pivot=Vector((0,-.1,1.90));rotation=Matrix.Rotation(-.20,3,'X')
  for v in o.data.vertices:v.co=pivot+rotation@(v.co+Vector((0,.10,0))-pivot)+Vector((0,0,-.020))
  o.data.update();report['mohawkFit']=seat_mohawk(o,head)
  # The narrow rear tip would poke through again below its buried root. Tuck
  # that hidden section inward, leaving the visible crest and side locks intact.
  for v in o.data.vertices:
   x,y,z=v.co
   v.co.y-=.05*smooth(.10,.14,y)*(1-smooth(1.89,1.94,z))*(1-smooth(.05,.075,abs(x)))
  o.data.update()
 # Fit the authored rear locks down to the nape, rather than filling the gap
 # with a second generic haircut. Keep the front, parting and long side locks.
 if i not in [2,3,7]:
  surface=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices[:]for p in o.data.polygons])
  xs=np.linspace(-.24,.24,49);factors=[]
  for x in xs:
   edge=1.98
   for z in np.arange(1.25,1.98,.005):
    hit,_,_,_=surface.ray_cast(Vector((float(x),1,float(z))),Vector((0,-1,0)),.96)
    if hit is not None:edge=float(z);break
   factors.append(max(1,min(3.5,(1.98-1.59)/max(.05,1.98-edge))))
  for _ in range(5):factors=np.convolve(np.pad(factors,(1,1),mode='edge'),[.25,.5,.25],mode='valid')
  for v in o.data.vertices:
   x,y,z=v.co
   if z<1.98:
    factor=float(np.interp(x,xs,factors));blend=smooth(.015,.13,y)*(1-smooth(.16,.27,abs(x)))
    # A monotone lower branch keeps existing tips above the nape and leaves
    # the authored ponytail/long strands below it at their original length.
    v.co.z-=min(.31,max(0,(z-1.50)*.75),(1.98-z)*(factor-1))*blend
  o.data.update();fit_scalp(o,.016)
 if i==8:
  # The two long curtains need to wrap around the rear skull. Rotate their
  # roots towards the nape; keep their authored length and lower silhouette.
  bm=bmesh.new();bm.from_mesh(o.data);remaining=set(bm.verts)
  while remaining:
   seed=remaining.pop();part={seed};stack=[seed]
   while stack:
    v=stack.pop()
    for e in v.link_edges:
     q=e.other_vert(v)
     if q in remaining:remaining.remove(q);part.add(q);stack.append(q)
   if min(v.co.z for v in part)<1.4:
    sign=1 if sum(v.co.x for v in part)>0 else -1
    for v in part:
     angle=sign*.20*smooth(1.45,1.70,v.co.z);x=v.co.x;y=v.co.y-head_center.y
     v.co.x=x*math.cos(angle)-y*math.sin(angle);v.co.y=head_center.y+x*math.sin(angle)+y*math.cos(angle)
  bm.to_mesh(o.data);bm.free()
 # The source cornrows include a coarse display scalp connected to three braids.
 # Remove only that surface, retaining the braid geometry and authored UVs.
 removed_scalp=0
 if i==7:
  o.data.update();bm=bmesh.new();bm.from_mesh(o.data);uv=bm.loops.layers.uv.active
  image=next(n.image for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE'and'basecolor'in n.image.name.lower())
  atlas=np.array(image.pixels[:]).reshape(image.size[1],image.size[0],4)
  remaining=set(bm.verts);parts=[]
  while remaining:
   seed=remaining.pop();part={seed};stack=[seed]
   while stack:
    v=stack.pop()
    for e in v.link_edges:
     q=e.other_vert(v)
     if q in remaining:remaining.remove(q);part.add(q);stack.append(q)
   faces={f for v in part for f in v.link_faces};parts.append((sum(f.calc_area()for f in faces),faces))
  base_faces=max(parts,key=lambda x:x[0])[1];remove=[]
  for f in base_faces:
   t=sum((l[uv].uv for l in f.loops),Vector((0,0)))/len(f.loops)
   color=atlas[int(t.y*image.size[1])%image.size[1],int(t.x*image.size[0])%image.size[0],:3]
   if f.calc_area()>.00028 or max(e.calc_length()for e in f.edges)>.045 or (f.calc_area()>.00006 and color[2]>color[0]*.58):remove.append(f)
  removed_scalp=len(remove);bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(o.data);bm.free()
  # Seat each braid's inner surface on the actual head, preserving tube depth.
  # A shared outward field alone leaves the braids floating above the removed
  # display scalp. Neighbourhood minima move inner/outer tube faces together.
  dirs=[];gaps=[];tree=KDTree(len(o.data.vertices))
  for v in o.data.vertices:
   d=v.co-head_center;direction=d.normalized();hit,_,_,_=head.ray_cast(head_center+direction,-direction,2)
   dirs.append(direction);gaps.append(d.length-(hit-head_center).length if hit is not None else 0)
   tree.insert(direction,v.index)
  tree.balance();offsets=[]
  for v in o.data.vertices:
   neighbors=tree.find_range(dirs[v.index],.10)
   inner=min(gaps[j]for _,j,_ in neighbors)
   offsets.append(max(-.025,min(.09,inner-.004)))
  for v in o.data.vertices:
   neighbors=tree.find_range(dirs[v.index],.10)
   shift=sum(offsets[j]for _,j,_ in neighbors)/len(neighbors)
   v.co-=dirs[v.index]*shift*smooth(1.48,1.64,v.co.z)
  bm=bmesh.new();bm.from_mesh(o.data);remaining=set(bm.verts);parts=[]
  while remaining:
   seed=remaining.pop();part={seed};stack=[seed]
   while stack:
    v=stack.pop()
    for e in v.link_edges:
     q=e.other_vert(v)
     if q in remaining:remaining.remove(q);part.add(q);stack.append(q)
   faces={f for v in part for f in v.link_faces}
   if len(faces)<12:
    removed_scalp+=len(faces);bmesh.ops.delete(bm,geom=list(part),context='VERTS')
   else:parts.append(part)
  for part in parts:
   top=max(v.co.z for v in part)
   if top<1.61 and min(v.co.z for v in part)<1.4:
    tips=[v for v in part if v.co.z>top-.015];root=sum((v.co for v in tips),Vector())/len(tips)
    target=min((v for other in parts if other!=part for v in other if v.co.z>top+.015 and v.co.x*root.x>0),key=lambda v:(v.co-root).length).co
    delta=(target-root)*1.08
    for v in part:v.co+=delta*smooth(1.42,top-.01,v.co.z)
  bm.to_mesh(o.data);bm.free()
 added_repair=0
 if i==0:added_repair=fit_messy(o)
 if i==4:added_repair=fit_ponytail(o)
 if i==5:added_repair=fit_bowl(o)
 if i==7:added_repair=repair_braids(o)
 if i==9:added_repair=fit_long_tied(o)
 o.vertex_groups.clear();hg=o.vertex_groups.new(name='head')
 o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
 hg.add(list(range(len(o.data.vertices))),1,'REPLACE')
 o.parent=rig;m=o.modifiers.new('MaleSkin','ARMATURE');m.object=rig
 for polygon in o.data.polygons:polygon.use_smooth=True
 o.data.update()
 retained=len(o.data.polygons)
 # The compact messy silhouette needs a few more far-LOD faces to retain its
 # rear overlap. Long Tied also retains enough far-LOD base faces to keep
 # the swept root-to-nape transition. Both stay inside shared hair budgets.
 budgets=[retained,5200,3500,1600] if i==7 else [retained,round(retained*.65),round(retained*.35),round(retained*(.20 if i==0 else .25 if i==9 else .15))]
 report['hair'][f'hair_{i+1:02d}']=[export(o,OUT/'hair'/f'hair_{i+1:02d}-lod{lod}.glb',budget,lod)for lod,budget in enumerate(budgets)]
 hair_info.append({'style':i+1,'sourceFaces':len(keep),'scale':scales[i],'crown':crowns[i],'maxScalpFit':max_push,'addedScalpFaces':0,'addedRepairFaces':added_repair,'removedSourceScalpFaces':removed_scalp})
 o.hide_render=True;o.hide_set(True)
hair_source.hide_render=True;hair_source.hide_set(True)
report['hairFit']=hair_info
assert sum(x['sourceFaces']for x in hair_info)==len(hair_source.data.polygons),'Lost source faces between cells'
(W/'build-report.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(W/'fitted.blend'))
for p,h in hashes.items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==h
print('OWNER_MALE',json.dumps(report),flush=True)
