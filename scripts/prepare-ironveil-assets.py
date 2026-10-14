"""Read-only master sources; selected exports written only to Ironveil staging/runtime.
Run with system Python. Blender worker changes an unsaved, isolated background scene.
"""
from pathlib import Path
import hashlib, json, os, struct, subprocess, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/maps/ironveil-mines-exterior-v1'
STAGE = ROOT / 'output/ironveil/source'
MASTER = Path(os.environ.get('LUMENFALL_MASTER', r'D:\Lumenfall'))
ENV = MASTER / 'Master_Model_Lumenfall/Environment'

def worker():
    import bpy
    from mathutils import Vector
    jobs = json.loads((STAGE / 'jobs.json').read_text())
    for job in jobs:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source = Path(job['input'])
        if source.suffix == '.blend':
            with bpy.data.libraries.load(str(source), link=False) as (data, dest):
                dest.objects = data.objects
            for obj in dest.objects:
                if obj is not None and obj.type == 'MESH':
                    bpy.context.scene.collection.objects.link(obj)
        else:
            bpy.ops.import_scene.gltf(filepath=str(source))
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        if not meshes:
            raise RuntimeError('No source meshes: ' + str(source))
        if job['kind'] == 'rock':
            # Nature archives can include preview/support objects; retain the largest mesh.
            obj = max(meshes, key=lambda o: len(o.data.polygons))
            for other in meshes:
                if other != obj: bpy.data.objects.remove(other, do_unlink=True)
            meshes = [obj]
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            obj.modifiers.clear()
            triangles = sum(len(p.vertices)-2 for p in obj.data.polygons)
            if triangles > 900:
                mod = obj.modifiers.new('Ironveil staged reduction', 'DECIMATE')
                mod.ratio = 900 / triangles
                bpy.ops.object.modifier_apply(modifier=mod.name)
            obj.data.materials.clear()
            for p in obj.data.polygons: p.use_smooth = False
        bpy.context.view_layer.update()
        coords = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
        lo = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
        hi = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
        center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
        scale = 1 / max(hi.z-lo.z, .001)
        for o in meshes:
            # Bake to a one-unit-tall source, preserving horizontal proportions and UVs.
            matrix = o.matrix_world.copy()
            for v in o.data.vertices: v.co = (matrix @ v.co-center)*scale
            o.matrix_world.identity()
            if job['kind'] != 'rock':
                for mat in o.data.materials:
                    if mat and mat.use_nodes:
                        for node in mat.node_tree.nodes:
                            if node.type == 'TEX_IMAGE' and node.image:
                                image = node.image
                                if max(image.size)>1024:
                                    ratio=1024/max(image.size)
                                    image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/job['output']), export_format='GLB', use_selection=True,
                                  export_image_format='WEBP', export_materials='EXPORT', export_yup=True)
    return

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    selections = [
        ('Rock/rock_face_02_2k.blend.zip', 'rock_face_02_2k.blend', 'rock-face.glb','rock'),
        ('Rock/boulder_01_2k.blend.zip', 'boulder_01_2k.blend', 'boulder.glb','rock'),
        ('Rock/rock_07_2k.blend.zip', 'rock_07_2k.blend', 'rock.glb','rock'),
        ('Building/Medieval_Village_MegaKit.zip', 'Prop_Crate.gltf','crate.glb','prop'),
        ('Building/Medieval_Village_MegaKit.zip', 'Prop_WoodenFence_Single.gltf','fence.glb','prop'),
        ('Building/Fantasy_Props_MegaKit.zip', 'Barrel.gltf','barrel.glb','prop'),
        ('Building/Fantasy_Props_MegaKit.zip', 'Lantern_Wall.gltf','lantern.glb','prop'),
    ]
    jobs=[];records=[]
    for rel, filename, output, kind in selections:
        archive=ENV/rel
        stage=STAGE/Path(rel).stem
        with zipfile.ZipFile(archive) as z:
            selected=next(n for n in z.namelist() if n.split('/')[-1]==filename)
            # Only selected glTF + its direct buffer/image dependencies; no whole-pack export.
            names=[selected]
            if filename.endswith('.gltf'):
                doc=json.loads(z.read(selected))
                names += [str(Path(selected).parent/i['uri']).replace('\\','/') for group in ['buffers','images'] for i in doc.get(group,[]) if i.get('uri') and not i['uri'].startswith('data:')]
            for name in set(names):
                target=(stage/name).resolve()
                if not target.is_relative_to(stage.resolve()): raise ValueError('Archive escapes staging')
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
        jobs.append({'input':str(stage/selected),'output':output,'kind':kind})
        records.append({'file':output,'source':str(archive),'entry':selected,'sourceSha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
    (STAGE/'jobs.json').write_text(json.dumps(jobs))
    blender=os.environ.get('BLENDER_BIN',r'D:\Work\Blender\blender.exe')
    subprocess.run([blender,'--background','--factory-startup','--python',str(Path(__file__).resolve()),'--','--worker'],check=True)
    # Share byte-identical trim textures across props; remove embedded copies entirely.
    texture_files=set()
    for job in jobs:
        file=OUT/job['output'];data=file.read_bytes();length=struct.unpack_from('<I',data,12)[0]
        doc=json.loads(data[20:20+length]);binary=data[28+length:]
        image_views=set()
        for image in doc.get('images',[]):
            index=image.pop('bufferView');view=doc['bufferViews'][index];start=view.get('byteOffset',0)
            payload=binary[start:start+view['byteLength']]
            suffix='.webp' if image.pop('mimeType','')=='image/webp' else '.png'
            name='trim-'+hashlib.sha256(payload).hexdigest()[:16]+suffix
            (OUT/name).write_bytes(payload);texture_files.add(name);image['uri']=name;image_views.add(index)
        if not image_views: continue
        packed=bytearray();views=[];remap={}
        for i,view in enumerate(doc['bufferViews']):
            if i in image_views: continue
            remap[i]=len(views);start=view.get('byteOffset',0);new=dict(view);new['byteOffset']=len(packed)
            packed+=binary[start:start+view['byteLength']]
            while len(packed)%4: packed.append(0)
            views.append(new)
        for accessor in doc['accessors']:
            if 'bufferView' in accessor: accessor['bufferView']=remap[accessor['bufferView']]
        doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(packed)}]
        encoded=json.dumps(doc,separators=(',',':')).encode()
        while len(encoded)%4: encoded+=b' '
        total=12+8+len(encoded)+8+len(packed)
        file.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed)
    shared=['/assets/maps/verdant-plains-v2/'+f for f in ['dirt.webp','grass.webp','wood.webp','shrub.glb','banner.glb']]
    shared+=['/assets/materials/whispering-wilds/'+f for f in ['forest.webp','rock.webp']]
    shared+=['/assets/maps/stylized-tree/meshes/pine-sm_stylized_tree_pine_03.glb']
    shared+=['/assets/materials/stylized-tree/'+f for f in ['T_Stylized_Bark_1_COLOR.png','T_Leaf_Texture_Pine.png','T_Leaf_Texture_Pine_Branch.png']]
    for r in records:
        p=OUT/r['file'];r.update(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    reuse=[{'url':p,'sha256':hashlib.sha256((ROOT/'public'/p.lstrip('/')).read_bytes()).hexdigest()} for p in shared]
    trims=[{'file':f,'bytes':(OUT/f).stat().st_size,'sha256':hashlib.sha256((OUT/f).read_bytes()).hexdigest()} for f in sorted(texture_files)]
    (OUT/'provenance.json').write_text(json.dumps({'map':'ironveil-mines-exterior-v1','sourceUnmodified':True,'sources':records,'shared':reuse,'deduplicatedTextures':trims},indent=2))
    print(json.dumps({'newAssetBytes':sum(r['bytes'] for r in records+trims),'files':len(records+trims)}))

if __name__=='__main__':
    if '--worker' in sys.argv: worker()
    else: main()
