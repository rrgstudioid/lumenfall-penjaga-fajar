"""Giant oak authoring in a clean, isolated Blender scene. Originals are read-only.
One master, three controlled variants, three mesh LODs, shadow proxies and
24-view colour/normal-depth impostors. All outputs stay in output/oak/assets.
"""
import bpy, bmesh, math, random, json, zipfile, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];STAGE=ROOT/'output/oak';OUT=STAGE/'assets';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True

def image(name,data,path,noncolor=False):
 h,w,_=data.shape;im=bpy.data.images.new(name,width=w,height=h,alpha=True)
 if noncolor:im.colorspace_settings.name='Non-Color'
 im.pixels.foreach_set(data.astype(np.float32).ravel());im.update();im.filepath_raw=str(path);im.file_format='JPEG' if path.suffix=='.jpg' else 'PNG';im.save();return im
def resized(im,n,name,path):
 copy=im.copy();copy.name=name;copy.scale(n,n);copy.filepath_raw=str(path);copy.file_format='JPEG' if path.suffix=='.jpg' else 'PNG';copy.save();return copy
def tex(mat,im):n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;return n

# Master bark: local photographic albedo plus newly authored 4K fissure detail.
archive=Path('C:/Users/GG/Desktop/Lumenfall/Master_ Material_ Lumenfall/Tree_bark/tree_bark_03_2k.blend.zip')
with zipfile.ZipFile(archive) as z:
 entry=next(n for n in z.namelist() if '_diff_' in n and n.endswith('.jpg'))
 source=STAGE/'bark-source.jpg';source.write_bytes(z.read(entry))
photo=bpy.data.images.load(str(source));photo.scale(4096,4096)
colour=np.array(photo.pixels[:],dtype=np.float32).reshape(4096,4096,4)
y,x=np.mgrid[0:4096,0:4096].astype(np.float32)/4096
phase=x*math.tau*43+1.8*np.sin(y*math.tau*2)+.5*np.sin(y*math.tau*11+x*13)
groove=np.abs(np.sin(phase))**.25
height=.55*groove+.18*np.sin(x*math.tau*139+y*21)*np.sin(y*math.tau*47)+.1*np.sin(x*997+y*557)
colour[:,:,:3]*=(.73+.27*groove[:,:,None]);colour[:,:,:3]=np.clip(colour[:,:,:3]*np.array([.88,.87,.83]),0,1)
master=image('Oak bark master 4K',colour,STAGE/'bark-master-4k.png')
dy,dx=np.gradient(height);normal=np.stack((-dx*70,-dy*70,np.ones_like(dx)),axis=-1);normal/=np.linalg.norm(normal,axis=-1)[:,:,None]
nm=np.ones_like(colour);nm[:,:,:3]=normal*.5+.5
master_normal=image('Authored fissures 4K',nm,STAGE/'bark-normal-master-4k.png',True)
bark_color=resized(master,2048,'oak-bark',OUT/'bark.jpg');bark_normal=resized(master_normal,2048,'oak-bark-normal',OUT/'bark-normal.png')
packed=np.ones((1024,1024,4),np.float32);packed[:,:,0]=.92;packed[:,:,1]=.91;packed[:,:,2]=0
bark_mask=image('oak-bark-mask',packed,OUT/'bark-mask.png',True)
del colour,nm,normal,dx,dy,x,y,groove,height,phase

def material(name,base,normal=None,mask=None,foliage=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;s=n.get('Principled BSDF');t=tex(m,base)
 l.new(t.outputs['Color'],s.inputs['Base Color']);s.inputs['Roughness'].default_value=.87
 if foliage:l.new(t.outputs['Alpha'],s.inputs['Alpha'])
 if normal:
  nt=tex(m,normal);nn=n.new('ShaderNodeNormalMap');l.new(nt.outputs['Color'],nn.inputs['Color']);l.new(nn.outputs[0],s.inputs['Normal'])
 if mask:
  split=n.new('ShaderNodeSeparateColor');l.new(tex(m,mask).outputs['Color'],split.inputs[0]);l.new(split.outputs['Green'],s.inputs['Roughness'])
 attr=n.new('ShaderNodeVertexColor');attr.layer_name='Color';mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;l.new(t.outputs['Color'],mix.inputs[1]);l.new(attr.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],s.inputs['Base Color'])
 return m

def mesh_obj(name,vs,fs,uvs,colors,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);me.materials.append(mat)
 uv=me.uv_layers.new();col=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
 for i,c in enumerate(colors):col.data[i].color=(*c,1)
 for poly in me.polygons:
  poly.use_smooth=True
  for li in poly.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
 return ob

# Leaf sprigs are authored as lobed individual leaves, then baked into 4 tiles.
sprig_mat=bpy.data.materials.new('Living oak leaves');sprig_mat.use_nodes=True
n=sprig_mat.node_tree.nodes;l=sprig_mat.node_tree.links;s=n.get('Principled BSDF');attr=n.new('ShaderNodeVertexColor');attr.layer_name='Color';l.new(attr.outputs[0],s.inputs['Base Color']);s.inputs['Roughness'].default_value=.85
sv=[];sf=[];su=[];sc=[];rng=random.Random(71943)
for tile in range(4):
 tx=tile%2;ty=tile//2
 for j in range(18):
  cx=tx+.5+rng.uniform(-.29,.29);cy=ty+.5+rng.uniform(-.32,.32);a=rng.random()*math.tau;length=rng.uniform(.16,.26);width=length*.40
  start=len(sv);sv.append((cx,cy,.015));su.append((0,0));green=(rng.uniform(.08,.15),rng.uniform(.22,.39),rng.uniform(.018,.055));sc.append(green)
  for k in range(20):
   t=k*math.tau/20;lx=math.cos(t)*length/2;ly=math.sin(t)*width*(.73+.27*math.cos(t*10));sv.append((cx+lx*math.cos(a)-ly*math.sin(a),cy+lx*math.sin(a)+ly*math.cos(a),.01+math.sin(t)**2*.012));su.append((0,0));sc.append(tuple(v*(.75 if k%2 else 1.08) for v in green))
  for k in range(20):sf.append((start,start+1+k,start+1+(k+1)%20))
sprig=mesh_obj('Oak individual leaf sprigs',sv,sf,su,sc,sprig_mat)
world=bpy.data.worlds.new('Oak studio');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.7,.8,1,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.7;scene.world=world
cam=bpy.data.objects.new('Oak bake camera',bpy.data.cameras.new('Oak bake camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2;cam.location=(1,1,5);cam.rotation_euler=(0,0,0)
scene.render.resolution_x=scene.render.resolution_y=2048;scene.render.resolution_percentage=100
# Colour-only bake keeps directional sun out of the textures.
em=n.new('ShaderNodeEmission');l.new(attr.outputs[0],em.inputs['Color']);l.new(em.outputs[0],n.get('Material Output').inputs['Surface'])
scene.render.filepath=str(OUT/'foliage.png');bpy.ops.render.render(write_still=True)
leaf_color=bpy.data.images.load(str(OUT/'foliage.png'))
geo=n.new('ShaderNodeNewGeometry');encode=n.new('ShaderNodeVectorMath');encode.operation='MULTIPLY_ADD';encode.inputs[1].default_value=(.5,.5,.5);encode.inputs[2].default_value=(.5,.5,.5)
l.new(geo.outputs['Normal'],encode.inputs[0]);l.new(encode.outputs[0],em.inputs['Color'])
scene.view_settings.view_transform='Raw';scene.render.resolution_x=scene.render.resolution_y=1024;scene.render.filepath=str(OUT/'foliage-normal.png');bpy.ops.render.render(write_still=True)
leaf_normal=bpy.data.images.load(str(OUT/'foliage-normal.png'));leaf_normal.name='oak-leaf-normal';leaf_normal.colorspace_settings.name='Non-Color'
scene.view_settings.view_transform='Standard'
leaf_mask=np.ones((1024,1024,4),np.float32);leaf_mask[:,:,:3]=(.85,.87,.32);leaf_masks=image('oak-leaf-mask',leaf_mask,OUT/'foliage-mask.png',True)
sprig.hide_render=True;master_collection=bpy.data.collections.new('Master leaf authoring');scene.collection.children.link(master_collection)
for coll in list(sprig.users_collection):coll.objects.unlink(sprig)
master_collection.objects.link(sprig);master_collection.hide_render=True
bark_mat=material('Oak Bark',bark_color,bark_normal,bark_mask);leaf_mat=material('Oak Foliage',leaf_color,leaf_normal,leaf_masks,True)

def tube(vs,fs,uv,cs,points,radii,sides,color=(1,1,1)):
 first=len(vs);length=0
 for i,p in enumerate(points):
  p=Vector(p);direction=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized();u=direction.cross(Vector((0,1,0))).normalized();v=direction.cross(u)
  if i:length+=(p-Vector(points[i-1])).length
  for j in range(sides):
   a=j*math.tau/sides;co=p+(u*math.cos(a)+v*math.sin(a))*radii[i]*(1+.035*math.sin(a*5+i*.3));vs.append(tuple(co));uv.append((j/sides*2,length*.45));cs.append(color)
 for i in range(len(points)-1):
  for j in range(sides):a=first+i*sides+j;b=first+i*sides+(j+1)%sides;c=b+sides;d=a+sides;fs.extend([(a,b,c),(a,c,d)])
 fs.append(tuple(first+(len(points)-1)*sides+j for j in range(sides)))

def skeleton(variant):
 rng=random.Random(731+variant*31);branches=[];clusters=[]
 trunk=[(0,0,-.08),(.04,-.03,.3),(.02,0,1.4),(.12,.06,3),(.23,.13,4.5),(.15,.1,6.0)]
 branches.append((trunk,[.9,.7,.575,.55,.47,.23],0))
 for j in range(6):
  a=j*math.tau/6+rng.uniform(-.18,.18);d=Vector((math.cos(a),math.sin(a),0));base=Vector((.15,.1,4.3+j*.1));mid=d*2.1+Vector((0,0,6.5+j%2));end=d*4.5+Vector((0,0,8.2+j%3*.7))
  branches.append(([base,mid,end],[.34,.26,.18],1))
  for k,(radius,z) in enumerate([(8.4,9.0),(9.0,12.1),(7.2,15.9),(3.9,18.0)]):
   angle=a+(-.24+k*.17)+rng.uniform(-.10,.10);center=Vector((math.cos(angle)*radius,math.sin(angle)*radius,z));bend=(end+center)*.5+Vector((0,0,.7))
   branches.append(([end,bend,center],[.15,.09,.035],2))
   for q in range(5):
    angle2=angle+(q-2)*.25;rr=radius*[.38,.70,1.0,.84,.56][q]
    terminal=Vector((math.cos(angle2)*rr,math.sin(angle2)*rr,z+rng.uniform(-.8,.9)))
    branches.append(([bend,terminal],[.045,.01],3));clusters.append(tuple(terminal))
 return branches,clusters

all_objects=[];reports=[]
for variant in range(3):
 branches,clusters=skeleton(variant);rng=random.Random(1931+variant*5)
 # Nested distributions maintain canopy outline across mesh LODs.
 offsets=[]
 for ci,c in enumerate(clusters):
  cards=[]
  for j in range(44):
   a=rng.random()*math.tau;zz=rng.uniform(-1,1);r=rng.random()**(1/3);p=Vector(c)+Vector((math.cos(a)*math.sqrt(1-zz*zz)*1.8,math.sin(a)*math.sqrt(1-zz*zz)*1.8,zz*1.75))*r
   n=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(.1,1))).normalized();cards.append((p,n,rng.uniform(1.30,1.65),rng.randrange(4),rng.uniform(.8,1.12)))
  offsets.append(cards)
 for lod,card_count,bark_limit in [(0,44,6800),(1,16,4200),(2,5,1080),(4,2,420),(5,3,700)]:
  vs=[];fs=[];uv=[];cs=[]
  for points,radii,order in branches:
   if lod>=2 and order>=3:continue
   tube(vs,fs,uv,cs,points,radii,12 if order==0 else 7 if order<2 else 5)
  ob=mesh_obj(f'Oak{variant}_L{lod}_Bark',vs,fs,uv,cs,bark_mat);bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  tri=ob.modifiers.new('Triangulate','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
  if len(ob.data.polygons)>bark_limit:
   dec=ob.modifiers.new('Branch budget','DECIMATE');dec.ratio=bark_limit/len(ob.data.polygons);bpy.ops.object.modifier_apply(modifier=dec.name)
  all_objects.append(ob);ob.hide_render=not(variant==0 and lod==0);ob.select_set(False)
  vs=[];fs=[];uv=[];cs=[]
  for ci,cards in enumerate(offsets):
   for j in range(card_count):
    p,n,size,tile,tint=cards[j];u=n.cross(Vector((0,1,0))).normalized();v=n.cross(u).normalized();size*=1 if lod==0 else 1.38 if lod==1 else 2.10 if lod==2 else 2.65
    start=len(vs);tilex=tile%2; tiley=tile//2
    for x,y in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5),(0,0)]:
     co=p+(u*x+v*y)*size+n*(.055 if x==0 else 0);vs.append(tuple(co));uv.append(((tilex+x+.5)/2,(tiley+y+.5)/2))
     shade=(.68+.32*min(1,Vector((p.x,p.y,0)).length/10)) * tint;cs.append((shade*.94,shade,shade*.88))
    fs.extend([(start,start+1,start+4),(start+1,start+2,start+4),(start+2,start+3,start+4),(start+3,start,start+4)])
  leaf=mesh_obj(f'Oak{variant}_L{lod}_Foliage',vs,fs,uv,cs,leaf_mat);leaf.hide_render=not(variant==0 and lod==0);all_objects.append(leaf)
  reports.append({'variant':variant,'lod':lod,'triangles':len(ob.data.polygons)+len(fs)})

# Normalize master crown bounds once; shared dimensions remain predictable.
master_meshes=[o for o in all_objects if '_L0_' in o.name]
verts=[v.co for o in master_meshes for v in o.data.vertices];minz=min(v.z for v in verts);maxz=max(v.z for v in verts);maxr=max(math.hypot(v.x,v.y) for v in verts)
for o in all_objects:
 for v in o.data.vertices:
  # Preserve trunk girth; crown spread adjusts progressively above the fork.
  f=min(1,max(0,(v.co.z-4)/4));v.co.x*=1+(11.75/maxr-1)*f;v.co.y*=1+(11.75/maxr-1)*f;v.co.z=min(21,max(0,(v.co.z-minz)*21/(maxz-minz)))
  r=math.hypot(v.co.x,v.co.y)
  if r>11.75:v.co.x*=11.75/r;v.co.y*=11.75/r
 o.data.update()
master_root=bpy.data.objects.new('LUMENFALL_OakTree_Master',None);scene.collection.objects.link(master_root)
for o in all_objects:o.parent=master_root
bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/'LUMENFALL_OakTree_Master.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in all_objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'oak.gltf'),export_format='GLTF_SEPARATE',use_selection=True,export_animations=False,export_materials='EXPORT')
# Export references standardized shared textures, never duplicated embedded maps.
gltf=json.loads((OUT/'oak.gltf').read_text())
from urllib.parse import unquote
for im in gltf.get('images',[]):
 name=unquote(im['uri']);p=OUT/name
 target='foliage-normal.png' if 'leaf-normal' in name else 'foliage-mask.png' if 'leaf-mask' in name else 'foliage.png' if 'foliage' in name else 'bark-normal.png' if 'bark-normal' in name else 'bark-mask.png' if 'bark-mask' in name else 'bark.jpg'
 if p.name!=target:p.replace(OUT/target)
 im['uri']=target
(OUT/'oak.gltf').write_text(json.dumps(gltf,separators=(',',':')))

# Studio view renders on white; source reference proportions can be reviewed.
sun=bpy.data.objects.new('Studio sun',bpy.data.lights.new('Studio sun','SUN'));scene.collection.objects.link(sun);sun.rotation_euler=(.5,-.4,-.5);sun.data.energy=2
cam.data.ortho_scale=29;scene.render.resolution_x=scene.render.resolution_y=900
center=Vector((0,0,10.5))
for label,a in [('front',0),('side',math.pi/2),('back',math.pi),('quarter',math.pi/4)]:
 cam.location=center+Vector((math.sin(a)*42,-math.cos(a)*42,5));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(STAGE/('oak-'+label+'.png'));bpy.ops.render.render(write_still=True)

# Unlit albedo and object-space normal-depth tiles, 8 azimuths x 3 elevations.
sun.hide_render=True;scene.render.resolution_x=scene.render.resolution_y=256;cam.data.ortho_scale=30
atlases=[np.zeros((1024,2048,4),np.float32) for _ in range(3)]
for mode in range(3):
 for mat in [bark_mat,leaf_mat]:
  n=mat.node_tree.nodes;l=mat.node_tree.links;principled=n.get('Principled BSDF');out=n.get('Material Output');em=n.new('ShaderNodeEmission')
  if mode==0:l.new(principled.inputs['Base Color'].links[0].from_socket,em.inputs['Color'])
  elif mode==1:
   geo=n.new('ShaderNodeNewGeometry');multiply=n.new('ShaderNodeVectorMath');multiply.operation='MULTIPLY_ADD';multiply.inputs[1].default_value=(.5,.5,.5);multiply.inputs[2].default_value=(.5,.5,.5);l.new(geo.outputs['Normal'],multiply.inputs[0]);l.new(multiply.outputs['Vector'],em.inputs['Color'])
  else:
   camera_data=n.new('ShaderNodeCameraData');depth=n.new('ShaderNodeMapRange');depth.inputs['From Min'].default_value=30;depth.inputs['From Max'].default_value=60;depth.inputs['To Min'].default_value=1;depth.inputs['To Max'].default_value=0
   l.new(camera_data.outputs['View Z Depth'],depth.inputs['Value']);l.new(depth.outputs[0],em.inputs['Color'])
  if mat==leaf_mat:
   mix=n.new('ShaderNodeMixShader');transparent=n.new('ShaderNodeBsdfTransparent');l.new(principled.inputs['Alpha'].links[0].from_socket,mix.inputs[0]);l.new(transparent.outputs[0],mix.inputs[1]);l.new(em.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface'])
  else:l.new(em.outputs[0],out.inputs['Surface'])
 scene.view_settings.view_transform='Raw' if mode else 'Standard'
 for elev,e in enumerate([15,40,70]):
  for az in range(8):
   a=az*math.tau/8;angle=math.radians(e);cam.location=center+Vector((math.sin(a)*math.cos(angle),-math.cos(a)*math.cos(angle),math.sin(angle)))*45;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
   scene.render.filepath=str(STAGE/'tile.png');bpy.ops.render.render(write_still=True);im=bpy.data.images.load(str(STAGE/'tile.png'),check_existing=False)
   if mode:im.colorspace_settings.name='Non-Color'
   pixels=np.array(im.pixels[:],np.float32).reshape(256,256,4);atlases[mode][elev*256:(elev+1)*256,az*256:(az+1)*256]=pixels;bpy.data.images.remove(im)
 if mode==0:image('Oak impostor colour',atlases[0],OUT/'impostor.png')
atlases[1][:,:,3]=atlases[2][:,:,0]
image('Oak impostor normal depth',atlases[1],OUT/'impostor-normal.png',True)
report={'name':'LUMENFALL_OakTree_Master','height':21,'canopyRadius':11.75,'trunkRadius':.575,'rootRadius':.9,'variants':3,'clusters':120,'lods':reports,'impostor':{'size':30,'centerY':10.5,'columns':8,'rows':4,'elevations':[15,40,70]},'source':str(archive),'sourceEntry':entry,'masterResolution':4096,'maps':['bark.jpg','bark-normal.png','bark-mask.png','foliage.png','foliage-normal.png','foliage-mask.png','impostor.png','impostor-normal.png']}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2));print('OAK ASSETS COMPLETE',reports)
