"""Author two lightweight trees in a clean scene; bake master materials + AO.
Never opens or writes an original blend. The baked GLB is the near LOD source.
"""
import bpy,math,random,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/verdant-plains/polish'
OUT=ROOT/'public/assets/maps/verdant-plains-v2'
report=[]

def material(name,image,tint,scale):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
 out=n.new('ShaderNodeOutputMaterial');emit=n.new('ShaderNodeEmission')
 tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(STAGE/image));tex.projection='BOX';tex.projection_blend=.22
 coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=scale
 l.new(coord.outputs['Object'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector'])
 mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*tint,1);l.new(tex.outputs['Color'],mix.inputs[1])
 ao=n.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=2;ao.samples=16;ao.only_local=True
 shade=n.new('ShaderNodeMixRGB');shade.blend_type='MULTIPLY';shade.inputs[0].default_value=.48;l.new(mix.outputs[0],shade.inputs[1]);l.new(ao.outputs['Color'],shade.inputs[2])
 l.new(shade.outputs[0],emit.inputs['Color']);l.new(emit.outputs[0],out.inputs[0]);return m

def branch(a,b,r1,r2,mat):
 a,b=Vector(a),Vector(b);d=b-a
 bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=True
 return o

def foliage_bough(center,rx,ry,height,seed,mat,needle=False):
 # Closed, shallow bough with torn/scalloped edges. No sphere primitives.
 rng=random.Random(seed);n=20 if needle else 16
 verts=[(0,0,height)];faces=[]
 for ring in range(2):
  for i in range(n):
   a=math.tau*i/n
   r=(.43 if ring==0 else (1.08 if i%2==0 else .73))*(.88+rng.random()*.23)
   z=height*(.7 if ring==0 else -.12)+rng.uniform(-.14,.14)
   verts.append((math.cos(a)*rx*r,math.sin(a)*ry*r,z))
 for i in range(n):
  j=(i+1)%n
  faces.extend([(0,1+i,1+j),(1+i,1+n+i,1+n+j),(1+i,1+n+j,1+j)])
 verts.append((0,0,-height*.22));bottom=len(verts)-1
 for i in range(n):faces.append((bottom,1+n+(i+1)%n,1+n+i))
 mesh=bpy.data.meshes.new('Serrated branch foliage');mesh.from_pydata(verts,[],faces);mesh.update()
 obj=bpy.data.objects.new('Needle bough' if needle else 'Banyan leaf shelf',mesh);bpy.context.collection.objects.link(obj);obj.location=center;mesh.materials.append(mat)
 for f in mesh.polygons:f.use_smooth=True
 return obj

for kind in ['fir','tree']:
 bpy.ops.wm.read_factory_settings(use_empty=True);random.seed(145 if kind=='fir' else 232)
 bark=material('Master willow bark','bark.png',(1.05,.94,.81),1.4)
 leaf=material('Master foliage + baked occlusion','foliage.png',(.72,1.16,.46),1.05)
 objects=[]
 # Conifer: tapered spire and serrated horizontal whorls. Banyan: broad branches,
 # shallow umbrella canopy, fluted trunk, and hanging aerial roots.
 heights=[0,2.6,5.1,7.8,10.5] if kind=='fir' else [0,1.6,3.0,4.2,5.3]
 centers=[(math.sin(i*.9)*.17,math.cos(i*1.1)*.13,z) for i,z in enumerate(heights)]
 for i in range(4):objects.append(branch(centers[i],centers[i+1],.33*(1-i*.21),.27*(1-i*.23),bark))
 if kind=='fir':
  for tier,z in enumerate([2.7,3.9,5.15,6.35,7.55,8.7,9.65]):
   radius=2.35-tier*.30
   objects.append(foliage_bough((math.sin(tier)*.12,0,z),radius,radius*.88,1.55-tier*.10,100+tier,leaf,True))
   for j in range(4):
    a=j*math.pi/2+tier*.73
    objects.append(branch((0,0,z+.3),(math.cos(a)*radius*.9,math.sin(a)*radius*.78,z-.16),.075,.018,bark))
 else:
  for j in range(5):
   a=j*math.tau/5
   objects.append(branch((math.cos(a)*.47,math.sin(a)*.47,0),(math.cos(a+.2)*.15,math.sin(a+.2)*.15,3.8),.16,.10,bark))
  for j in range(8):
   a=j*math.tau/8;r=2.6+(j%3)*.3;z=4.6+(j%3)*.35
   mid=(math.cos(a)*1.35,math.sin(a)*1.35,3.6+(j%2)*.3)
   end=(math.cos(a)*r,math.sin(a)*r,z)
   objects.append(branch((0,0,2.5),mid,.18,.11,bark));objects.append(branch(mid,end,.11,.045,bark))
   objects.append(foliage_bough(end,2.0,1.8,.65,200+j,leaf))
   tip=(end[0]+math.cos(a+.6)*1.0,end[1]+math.sin(a+.6)*1.0,z+.15)
   objects.append(branch(mid,tip,.065,.018,bark))
   objects.append(foliage_bough(tip,1.25,1.0,.4,300+j,leaf))
   for k in range(2):
    x=end[0]+(k-.5)*.42;y=end[1]+math.sin(j)*.3
    objects.append(branch((x,y,z-.15),(x+.12,y-.06,1.5+(j%3)*.35),.027,.011,bark))
  objects.append(foliage_bough((-.2,.1,5.65),2.8,2.5,.75,401,leaf))
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='Verdant Cemara' if kind=='fir' else 'Verdant Beringin'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.018);bpy.ops.object.mode_set(mode='OBJECT')
 # Bake emission contains only material colour + local AO: no baked directional sun.
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.bake.margin=8
 atlas=bpy.data.images.new(kind+'-baked-albedo-ao',width=1024,height=1024,alpha=False)
 for m in obj.data.materials:
  node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas;m.node_tree.nodes.active=node
 bpy.ops.object.bake(type='EMIT');atlas.filepath_raw=str(STAGE/(kind+'-atlas.png'));atlas.file_format='PNG';atlas.save()
 baked=bpy.data.materials.new('Baked master material atlas');baked.use_nodes=True
 bsdf=baked.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.92
 tex=baked.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas;baked.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
 obj.data.materials.clear();obj.data.materials.append(baked)
 for f in obj.data.polygons:f.material_index=0
 bpy.ops.export_scene.gltf(filepath=str(OUT/(kind+'.glb')),export_format='GLB',use_selection=True,export_animations=False)
 report.append({'id':kind,'name':obj.name,'triangles':sum(len(f.vertices)-2 for f in obj.data.polygons),'atlas':1024,'bake':'Cycles EMIT: master color × local AO','bytes':(OUT/(kind+'.glb')).stat().st_size})
(OUT/'tree-bake-report.json').write_text(json.dumps(report,indent=2)+'\n');print('BAKED_TREES',json.dumps(report))
