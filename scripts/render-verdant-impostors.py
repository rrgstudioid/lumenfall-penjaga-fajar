"""Render distant LOD cards from the selected runtime assets in a clean background scene."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]/'public/assets/maps/verdant-plains-v2'
metrics=json.loads((root/'impostors.json').read_text()) if (root/'impostors.json').exists() else {}
# Authored tree cards use the runtime-lighting bake mode in test-verdant-v2-browser.mjs.
for name in ['shrub']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/(name+'.glb')))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(low+high)/2
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
 scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.film_transparent=True
 scene.world=bpy.data.worlds.new('Daylight');scene.world.use_nodes=True
 bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.7,.82,1,1);bg.inputs['Strength'].default_value=.8
 bpy.ops.object.camera_add(location=center+Vector((0,-40,5)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=max(high.z-low.z,high.x-low.x)*1.12;scene.camera=cam
 bpy.ops.object.light_add(type='SUN',location=(10,-20,30));sun=bpy.context.object;sun.rotation_euler=(.4,-.5,-.4);sun.data.energy=2
 scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/(name+'-far.png'));bpy.ops.render.render(write_still=True)
 metrics[name]={'size':cam.data.ortho_scale,'centerY':center.z}
(root/'impostors.json').write_text(json.dumps(metrics,indent=2))
