"""Assemble placement modules and render the working derivative for comparison."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
assert Path(bpy.data.filepath).resolve()==(ROOT/'source/LUMENFALL_Stage03_Runtime_Working.blend').resolve()
manifest=json.loads((ROOT/'assets/manifest.json').read_text());scene=bpy.context.scene
for o in list(scene.objects):
    if o.get('stage03Group')=='preview-instance' or o.name.startswith(('Stage03 comparison','Stage03 preview sunlight')):bpy.data.objects.remove(o,do_unlink=True)
modules={}
for o in list(scene.objects):
    group=o.get('stage03Group','')
    if group=='collision':o.hide_render=True;o.hide_set(True)
    if group.startswith('module-'):modules.setdefault(group[7:],[]).append(o);o.hide_render=True;o.hide_set(True)
for p in manifest['placements']:
    for template in modules[p['module']]:
        o=template.copy();o.data=template.data;scene.collection.objects.link(o);o.name=p['id']+'_'+template.name;o.hide_render=False;o.hide_set(False)
        x,y,z=p['position'];sx,sy,sz=p['scale'];o.location=(x,-z,y);o.scale=(sx,sz,sy);o.rotation_euler.z=p.get('rotation',0)
        o['stage03Group']='preview-instance'
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Stage03 daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.60,.76,.90,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
sun=bpy.data.lights.new('Stage03 preview sunlight','SUN');sun.energy=2;sun.angle=.08
light=bpy.data.objects.new('Stage03 preview sunlight',sun);scene.collection.objects.link(light);light.rotation_euler=(.45,-.65,-.35)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
camera_data=bpy.data.cameras.new('Stage03 comparison');camera=bpy.data.objects.new('Stage03 comparison',camera_data);scene.collection.objects.link(camera);scene.camera=camera;camera_data.lens=38
camera_data.sensor_fit='VERTICAL';camera_data.sensor_height=24;camera_data.lens=12/math.tan(math.radians(45)/2)
views={'top':((0,305,0),(0,0,0)),'overview':((0,190,215),(0,0,0)),'center':((24,23,33),(0,1,1)),'guild':((24,34,-43),(0,12,-75)),'merchant':((-51,26,20),(-75,4,-12)),'training':((-27,23,-25),(-51,1,-57)),'job':((79,32,-22),(55,10,-54)),'forge':((93,26,22),(69,4,-10)),'warp':((24,26,100),(0,4,68)),'player':((0,3.6,19),(0,2,1))}
views['street']=((0,2.38,19),(0,2.2,-50))
if '--assemble-only' in sys.argv:
    camera.location=(0,-215,190);camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
for name,(position,target) in ([] if '--assemble-only' in sys.argv else views.items()):
    def zup(p):return Vector((p[0],-p[2],p[1]))
    camera.location=zup(position);camera.rotation_euler=(zup(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/'evidence'/('blender-'+name+'.jpg'));scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=88
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/LUMENFALL_Stage03_Runtime_Working.blend'))
