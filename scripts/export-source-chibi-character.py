"""Rig the owner's lightweight chibi mesh without rebuilding its visible surfaces.
Source is read-only. Body + default hair LOD0 retain every source triangle/UV.
Only the hidden skull fill supports alternate modular hairstyles.
"""
import bpy,bmesh,json,math,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/chibi-source';OUT=ROOT/'public/assets/characters/male-v2'
SOURCE=Path(json.loads((WORK/'audit.json').read_text())['sourcePath'])
bpy.ops.wm.open_mainfile(filepath=str(WORK/'source.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene;source=bpy.data.objects['ChibiSource'];source.data.update()
base=next(n.image for n in source.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'basecolor' in n.image.name)
pixels=np.array(base.pixels[:],dtype=np.float32).reshape(base.size[1],base.size[0],4)
uv=source.data.uv_layers.active.data
# Partition only; no movement, remeshing or rebuilding of visible source vertices.
hair_faces=set(json.loads((WORK/'segmentation.json').read_text())['hairFaces'])
def select(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
def subset(name,keep):
 o=source.copy();o.data=source.data.copy();scene.collection.objects.link(o);o.name=name
 bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[p for p in bm.faces if p.index not in keep],context='FACES');bm.to_mesh(o.data);bm.free();o.data.update();return o
body=subset('MaleBody',set(range(len(source.data.polygons)))-hair_faces);hair=subset('Hair_01',hair_faces)
# Texture-space skin mask: geometry gates prevent similarly colored cloth being
# painted. Source colour distinguishes the ragged fabric edge from adjacent skin.
size=1024;mask=np.zeros((size,size,4),dtype=np.float32);mask[:,:,3]=1
for p in source.data.polygons:
 if p.index in hair_faces:continue
 ids=list(p.loop_indices)
 for k in range(1,len(ids)-1):
  ls=[ids[0],ids[k],ids[k+1]];t=np.array([list(uv[i].uv)for i in ls]);v=np.array([list(source.data.vertices[source.data.loops[i].vertex_index].co)for i in ls]);q=t*size
  left=max(0,int(q[:,0].min()));right=min(size-1,int(q[:,0].max())+1);bottom=max(0,int(q[:,1].min()));top=min(size-1,int(q[:,1].max())+1)
  if right<left or top<bottom:continue
  yy,xx=np.mgrid[bottom:top+1,left:right+1];xx=xx+.5;yy=yy+.5
  a,b,c=q;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-8:continue
  w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w2=1-w0-w1;inside=(w0>=-.002)&(w1>=-.002)&(w2>=-.002)
  pos=w0[...,None]*v[0]+w1[...,None]*v[1]+w2[...,None]*v[2];x=np.abs(pos[:,:,0]);z=pos[:,:,2]
  color=pixels[np.clip((yy/size*base.size[1]).astype(int),0,base.size[1]-1),np.clip((xx/size*base.size[0]).astype(int),0,base.size[0]-1),:3];r,g,b=color[:,:,0],color[:,:,1],color[:,:,2]
  exposed=(z>1.40)|((x>.20)&(z>1.24))|(z<.54)|((x<.14)&(z>1.25))
  chroma=np.clip((r-g-.15)/.055,0,1)*np.clip((g-b-.075)/.05,0,1)*np.clip((r-.50)/.15,0,1)
  value=exposed*chroma
  value=np.where((z<.40)|((x>.34)&(z>1.22)),1,value)
  patch=mask[bottom:top+1,left:right+1,0];patch[inside]=value[inside]
# Conservative 1px dilation prevents seams, without broad colour bleed.
red=mask[:,:,0].copy()
for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:mask[:,:,0]=np.maximum(mask[:,:,0],np.roll(red,(dy,dx),(0,1)))
im=bpy.data.images.new('SourceSkinMask',width=size,height=size,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(mask.ravel());im.filepath_raw=str(OUT/'textures/body-skin-mask.png');im.file_format='PNG';im.save()
# Default head is source-only; alternate styles use a closed, clean scalp.
import importlib.util
spec=importlib.util.spec_from_file_location('bald_head',ROOT/'scripts/chibi-bald-head.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
body=module.build_bald_head(body)
source.hide_render=True;source.hide_set(True)
# T-pose rig follows the supplied mesh, rather than reshaping it to the old rig.
data=bpy.data.armatures.new('MaleV2Skeleton');rig=bpy.data.objects.new('MaleV2Rig',data);scene.collection.objects.link(rig);select(rig);bpy.ops.object.mode_set(mode='EDIT')
positions={
 'root':((0,0,0),(0,0,.15),None),'pelvis':((0,.01,.89),(0,.01,1.02),'root'),
 'spine_01':((0,.01,1.02),(0,.01,1.19),'pelvis'),'spine_03':((0,.01,1.19),(0,.01,1.38),'spine_01'),
 'neck_01':((0,.01,1.38),(0,.01,1.49),'spine_03'),'head':((0,.01,1.49),(0,.01,1.91),'neck_01')}
for suffix,sign in [('l',1),('r',-1)]:
 def p(x,y,z):return(sign*x,y,z)
 positions.update({'clavicle_'+suffix:(p(.035,.01,1.375),p(.17,.01,1.375),'spine_03'),
 'upperarm_'+suffix:(p(.17,.01,1.375),p(.46,.005,1.365),'clavicle_'+suffix),
 'lowerarm_'+suffix:(p(.46,.005,1.365),p(.745,-.005,1.36),'upperarm_'+suffix),
 'hand_'+suffix:(p(.745,-.005,1.36),p(.865,-.005,1.355),'lowerarm_'+suffix),
 'thigh_'+suffix:(p(.12,.01,.89),p(.18,.01,.49),'pelvis'),'calf_'+suffix:(p(.18,.01,.49),p(.205,.025,.12),'thigh_'+suffix),'foot_'+suffix:(p(.205,.025,.12),p(.205,-.16,.045),'calf_'+suffix)})
for name,(h,t,parent) in positions.items():
 b=data.edit_bones.new(name);b.head=h;b.tail=t;b.use_deform=name!='root'
 if parent:b.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def bind(o,rigid=False):
 o.vertex_groups.clear();groups={n:o.vertex_groups.new(name=n)for n in positions}
 for v in o.data.vertices:
  x,y,z=v.co;side='l'if x>0 else'r';ax=abs(x)
  if rigid or z>1.49:ws={'head':1}
  elif z>1.20 and ax>.17:
   chest=1-smooth(.17,.27,ax);elbow=smooth(.405,.515,ax);hand=smooth(.69,.77,ax)
   ws={'spine_03':chest,'upperarm_'+side:(1-chest)*(1-elbow),'lowerarm_'+side:(1-chest)*elbow*(1-hand),'hand_'+side:(1-chest)*elbow*hand}
  elif z<.93 and ax>.035:
   hip=smooth(.77,.93,z);knee=1-smooth(.43,.55,z);ankle=1-smooth(.115,.215,z)
   ws={'pelvis':hip,'thigh_'+side:(1-hip)*(1-knee),'calf_'+side:(1-hip)*knee*(1-ankle),'foot_'+side:(1-hip)*knee*ankle}
  elif z>1.34:
   t=smooth(1.35,1.49,z);ws={'spine_03':1-t,'head':t}
  elif z>1.06:
   t=smooth(1.06,1.24,z);ws={'spine_01':1-t,'spine_03':t}
  else:
   t=smooth(.94,1.10,z);ws={'pelvis':1-t,'spine_01':t}
  for n,w in ws.items():
   if w>1e-6:groups[n].add([v.index],w,'REPLACE')
 o.parent=rig;mod=o.modifiers.new('MaleSkin','ARMATURE');mod.object=rig
bind(body);bind(hair,True)
for name,bone,pt in [('HeadSocket','head',(0,.01,1.78)),('WeaponSocketR','hand_r',(-.79,-.01,1.35)),('WeaponSocketL','hand_l',(.79,-.01,1.35)),('BackSocket','spine_03',(0,.13,1.23))]:
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=rig;o.parent_type='BONE';o.parent_bone=bone;bpy.context.view_layer.update();o.matrix_world=Matrix.Translation(Vector(pt))
def export(o,path,target):
 copy=o.copy();copy.data=o.data.copy();scene.collection.objects.link(copy);select(copy);copy.data.validate(clean_customdata=True)
 n=sum(len(p.vertices)-2 for p in copy.data.polygons)
 if n>target:
  mod=copy.modifiers.new('LOD','DECIMATE');mod.ratio=target/n;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Decimation must not carry a frontal texture weight across the skull pole
 # onto the back/nape. Reapply the anatomical mask on each exported LOD.
 regions=copy.data.color_attributes.get('SkinRegion')
 if regions:
  for loop in copy.data.loops:
   c=regions.data[loop.index].color
   if c[2]>.75 and copy.data.vertices[loop.vertex_index].co.y>.025:
    regions.data[loop.index].color=(c[0],0,c[2],c[3])
 rig.select_set(True)
 for ch in rig.children:
  if ch.type=='EMPTY':ch.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_extras=True,export_vertex_color='NAME' if copy.data.color_attributes.get('SkinRegion')else'NONE',export_vertex_color_name='SkinRegion',export_all_vertex_colors=False)
 count=sum(len(p.vertices)-2 for p in copy.data.polygons);bpy.data.objects.remove(copy,do_unlink=True);return count
report={'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceTriangles':4722,'geometryPolicy':'LOD0 original positions and UVs; hidden scalp only','body':[],'hair':{}}
for lod,target in enumerate([10000,3600,1800,850]):report['body'].append(export(body,OUT/'body'/('body-lod%d.glb'%lod),target))
for lod,target in enumerate([3000,900,550,250]):report['hair'].setdefault('hair_01',[]).append(export(hair,OUT/'hair'/('hair_01-lod%d.glb'%lod),target))
# Refit existing optional styles to this skull; original hair remains untouched.
for style in range(2,11):
 report['hair']['hair_%02d'%style]=[]
 for lod,target in enumerate([3000,1800,1000,400]):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(WORK/'legacy-hair'/('hair_%02d-lod%d.glb'%(style,0))))
  added=set(bpy.data.objects)-before;o=next(o for o in added if o.type=='MESH' and any(m.type=='ARMATURE'for m in o.modifiers));o.parent=None;o.matrix_world=Matrix.Identity(4);o.modifiers.clear()
  # Blender's importer has already converted mesh coordinates to Z-up.
  for v in o.data.vertices:
   x,y,z=v.co
   margin=1.07 if lod==3 else 1.0
   v.co=(x/.183*.202*margin,(y-.025)/.207*.215*margin+.025,(z-1.642)/.211*.232*margin+1.706)
  o.name='Hair_%02d'%style;bind(o,True)
  report['hair']['hair_%02d'%style].append(export(o,OUT/'hair'/('hair_%02d-lod%d.glb'%(style,lod)),target))
  for obj in added:
   if obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
(WORK/'build-report.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'rigged-source.blend'));print('CHIBI_BUILD',json.dumps(report),flush=True)
