"""Hair-free alternate head: smooth skull + source facial texture projection.
The original head is retained exclusively for Messy Spikes, unmodified.
"""
import bpy,bmesh,math,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from pathlib import Path

def build_bald_head(body):
 tags=body.data.color_attributes.new(name='SkinRegion',type='BYTE_COLOR',domain='CORNER')
 for p in body.data.polygons:
  x,y,z=p.center;head=z>1.48 or(z>1.39 and abs(x)<.115)
  for i in p.loop_indices:tags.data[i].color=(1,0,.5 if head else 0,1)
 # Source face only; the extracted hairstyle is absent from this BVH.
 body.data.calc_loop_triangles();triangles=list(body.data.loop_triangles)
 surface=BVHTree.FromPolygons([v.co for v in body.data.vertices],[t.vertices[:]for t in triangles],all_triangles=True)
 src=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'basecolor' in n.image.name)
 pixels=np.array(src.pixels[:],dtype=np.float32).reshape(src.size[1],src.size[0],4);uv=body.data.uv_layers.active.data
 def sample(x,z):
  point,normal,index,_=surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
  if point is None or point.y>-.055 or z>1.706 or abs(x)>.18:return None
  t=triangles[index];verts=[body.data.vertices[i].co for i in t.vertices];coords=[Vector((uv[i].uv.x,uv[i].uv.y,0))for i in t.loops]
  q=barycentric_transform(point,*verts,*coords);col=pixels[min(src.size[1]-1,max(0,int(q.y*src.size[1]))),min(src.size[0]-1,max(0,int(q.x*src.size[0]))),:3]
  if (point.y<-.205 and z>1.645) or(abs(x)>.155 and z>1.55):return None
  return point,col
 # Face features are baked into a small independent atlas; no old hair normal
 # or color data is ever sampled by the alternate skull.
 size=512;atlas=np.ones((size,size,4),dtype=np.float32);skin=np.array((.97,.63,.466));atlas[:,:,:3]=skin
 for j in range(size):
  z=1.42+(j+.5)/size*.54
  for i in range(size):
   x=((i+.5)/size-.5)*.48;hit=sample(x,z)
   if hit is None:continue
   point,col=hit;r,g,b=col
   eye=((abs(x)-.087)/.056)**2+((z-1.611)/.053)**2<1.12
   brow=.027<abs(x)<.147 and abs(z-(1.661+.255*abs(x)))<.0075
   lip=1.500<z<1.53 and abs(x)<.055 and r<.88 and g/max(r,.001)<.60 and b/max(g,.001)>.70
   feature=(eye and (r<.74 or g>.72)) or (brow and r<.72) or lip
   if feature:atlas[j,i,:3]=col;atlas[j,i,3]=0
   if 1.515<z<1.527 and abs(x)<.05:
    strength=max(0,min(1,(.639-g)/.06));atlas[j,i,:3]=(.66,.32,.24);atlas[j,i,3]=1-strength*.75
 image=bpy.data.images.new('BaldFace',width=size,height=size,alpha=True);image.pixels.foreach_set(atlas.ravel());image.filepath_raw=str(Path(__file__).resolve().parents[1]/'public/assets/characters/male-v2/textures/head-basecolor.png');image.file_format='PNG';image.save()
 verts=[];faces=[];influence=[];tex=[];segments=48;rows=24
 # Chibi proportions match the existing hairstyle fitting envelope.
 for row in range(rows+1):
  theta=math.pi*row/rows
  for j in range(segments):
   phi=2*math.pi*j/segments;z=1.706+(.232+(.036*max(0,-math.sin(phi))**2 if math.cos(theta)<0 else 0))*math.cos(theta);x=.202*math.sin(theta)*math.cos(phi);y=.025+.215*math.sin(theta)*math.sin(phi)
   frontal=max(0,-math.sin(phi));weight=max(0,min(1,(frontal-.35)/.4));weight=weight*weight*(3-2*weight)
   hit=sample(x,z)
   if hit is not None:
    lower=max(0,min(1,(z-1.50)/.10));lower=lower*lower*(3-2*lower)
    blend=max(0,min(1,(1.735-z)/.05))*weight*lower;y=y*(1-blend)+hit[0].y*blend
   verts.append((x,y,z));influence.append(weight);tex.append((x/.48+.5,(z-1.42)/.54))
   if row:
    a=(row-1)*segments+j;b=(row-1)*segments+(j+1)%segments;c=row*segments+(j+1)%segments;d=row*segments+j;faces.append((a,d,c,b))
 mesh=bpy.data.meshes.new('BaldHead');mesh.from_pydata(verts,[],faces);mesh.update();alt=bpy.data.objects.new('BaldHead',mesh);bpy.context.scene.collection.objects.link(alt);mesh.materials.append(body.data.materials[0])
 attr=mesh.color_attributes.new(name='SkinRegion',type='BYTE_COLOR',domain='CORNER');layer=mesh.uv_layers.new(name='UVMap')
 for l in mesh.loops:attr.data[l.index].color=(1,influence[l.vertex_index],1,1);layer.data[l.index].uv=tex[l.vertex_index]
 # Small integrated ears and a closed neck use skin only, never hairstyle UVs.
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);colors=bm.loops.layers.color.get('SkinRegion')
 for side in [-1,1]:
  result=bmesh.ops.create_uvsphere(bm,u_segments=16,v_segments=10,radius=1)
  for v in result['verts']:
   x,y,z=v.co;v.co=(side*(.197+x*.030),-.013+y*.022+max(0,-y)*.008*(1-z*z),1.586+z*.054)
  added=set(result['verts'])
  for f in bm.faces:
   if all(v in added for v in f.verts):
    for l in f.loops:l[colors]=(1,0,1,1)
 result=bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=24,radius1=.067,radius2=.075,depth=.20)
 for v in result['verts']:v.co+=Vector((0,.012,1.436))
 added=set(result['verts'])
 for f in bm.faces:
  if all(v in added for v in f.verts):
   for l in f.loops:l[colors]=(1,0,1,1)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
 for p in mesh.polygons:p.use_smooth=True
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);alt.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
 return body
