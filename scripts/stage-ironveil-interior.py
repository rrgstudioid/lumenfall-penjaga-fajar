"""Creates a NEW background Blender staging scene; never opens an owner's blend."""
from pathlib import Path
import json, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/ironveil-interior/staging'
ASSETS=ROOT/'public/assets/maps/ironveil-mines-interior-v1'

def worker():
    import bpy
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS/'cave-shell.glb'))
    manifest=json.loads((ASSETS/'provenance.json').read_text())
    scene=bpy.context.scene
    scene.name='Ironveil Interior - isolated staging'
    scene['runtime_id']=manifest['id']
    scene['source_policy']='New staged derivative. Owner source assets are read-only.'
    scene['lighting']=manifest['lighting']
    scene['floor_area']=manifest['floorArea']
    # glTF's Y-up is converted to Blender Z-up (runtime north is Blender +Y).
    for room in manifest['rooms']:
        empty=bpy.data.objects.new(room['id']+' - '+room['name'],None)
        scene.collection.objects.link(empty)
        empty.location=(room['x'],-room['z'],2)
        empty.empty_display_type='CIRCLE';empty.empty_display_size=room['width']/2
        empty['floor_width']=room['width'];empty['floor_depth']=room['depth']
    for route in manifest['routes']:
        curve=bpy.data.curves.new(route['id'],'CURVE');curve.dimensions='3D'
        spline=curve.splines.new('POLY');spline.points.add(len(route['points'])-1)
        for p,co in zip(spline.points,route['points']):p.co=(co['x'],-co['z'],1,1)
        obj=bpy.data.objects.new('Route - '+route['id'],curve);scene.collection.objects.link(obj)
        obj.hide_render=True;obj['clear_width']=route['width']
    for i,l in enumerate(manifest['lanterns']):
        light=bpy.data.lights.new('Baked lantern %03d'%i,'POINT');light.energy=160;light.color=(1,.55,.21);light.shadow_soft_size=.6
        obj=bpy.data.objects.new(light.name,light);scene.collection.objects.link(obj);obj.location=(l['x'],-l['z'],l['y'])
        obj.hide_render=True # Runtime uses the already baked vertex field, not 280 live lamps.
    # Inspectable timber/rail modules in the new staging scene. No source scene changes.
    kit=bpy.data.collections.new('Mining construction staging');scene.collection.children.link(kit)
    wood=bpy.data.materials.new('Staged warm timber');wood.diffuse_color=(.24,.12,.045,1)
    metal=bpy.data.materials.new('Staged rail iron');metal.diffuse_color=(.12,.13,.14,1)
    def beam(name,a,b,width,material=wood):
        a=Vector(a);b=Vector(b);delta=b-a
        bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
        obj=bpy.context.object;obj.name=name;obj.dimensions=(width,width,delta.length)
        obj.rotation_mode='QUATERNION';obj.rotation_quaternion=delta.to_track_quat('Z','Y')
        obj.data.materials.append(material)
        for c in list(obj.users_collection):c.objects.unlink(obj)
        kit.objects.link(obj)
        return obj
    for landmark in manifest['landmarks']:
        room=next(r for r in manifest['rooms'] if r['id']==landmark['id'])
        x,y=landmark['x'],-landmark['z'];h=-2 if room['z']>200 else -10 if room['z']>-100 else -18
        if room['id'] in ['N1','W1','W2']:
            beam(room['id']+' extraction post L',(x-6,y,h),(x-6,y,h+16),1.1)
            beam(room['id']+' extraction post R',(x+6,y,h),(x+6,y,h+16),1.1)
            beam(room['id']+' crane beam',(x-6,y,h+16),(x+12,y+3,h+18),1.1)
            beam(room['id']+' hoist rope',(x+11,y+3,h+18),(x+11,y+3,h+4),.12,metal)
    beam('Entrance post L',(-8.6,-449.4,0),(-8.6,-449.4,12.8),1.1)
    beam('Entrance post R',(8.6,-449.4,0),(8.6,-449.4,12.8),1.1)
    beam('Entrance lintel',(-8.6,-449.4,12.8),(8.6,-449.4,12.8),1.3)
    # Reuse imported props by linked mesh data; retain source UVs and materials.
    shared=ROOT/'public/assets/maps/ironveil-mines-exterior-v1'
    for kind,file in [('crate','crate.glb'),('barrel','barrel.glb'),('rock','owner-rock-01.glb')]:
        before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(shared/file))
        imported=set(scene.objects)-before
        meshes=[o for o in imported if o.type=='MESH']
        for blocker in [b for b in manifest['blockers'] if b['kind']==kind]:
            for src in meshes:
                obj=src.copy();obj.data=src.data;obj.name='Staged reused '+kind
                kit.objects.link(obj);obj.parent=None
                obj.location=(blocker['x'],-blocker['z'],-2 if blocker['z']>200 else -10)
                obj['source_url']='/assets/maps/ironveil-mines-exterior-v1/'+file
        for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    scene['staging_note']='Shell is runtime-exact. Linked prop and crane previews are placement guides; runtime owns their exact grounding and instances.'
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ironveil-mines-interior-staging.blend'))
    (OUT/'inspection.json').write_text(json.dumps({'objects':len(scene.objects),'rooms':len(manifest['rooms']),'routes':len(manifest['routes']),'lanterns':len(manifest['lanterns']),'triangles':manifest['triangles'],'source_modified':False},indent=2))

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    if '--worker' in sys.argv:worker()
    else:subprocess.run([r'D:\Work\Blender\blender.exe','--background','--factory-startup','--python',str(Path(__file__).resolve()),'--','--worker'],cwd=ROOT,check=True)
