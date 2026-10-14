"""Extract the ten authored hairstyle references; source GLB stays read-only."""
import bpy, bmesh, json, sys, numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/modular-male'
SOURCE=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else Path(r'C:\Users\GG\Desktop\Lumenfall\3d character model male.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
source=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=source;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
mesh=source.data
coords=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',coords);coords=coords.reshape(-1,3)
indices=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',indices);indices=indices.reshape(-1,3)
centers=coords[indices].mean(axis=1)
uv=np.empty(len(mesh.loops)*2,dtype=np.float32);mesh.uv_layers.active.data.foreach_get('uv',uv);uv=uv.reshape(-1,3,2).mean(axis=1)
base=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'base' in n.image.name.lower())
pix=np.array(base.pixels[:],dtype=np.float32).reshape(base.size[1],base.size[0],4)
colors=pix[(uv[:,1]*base.size[1]).astype(int)%base.size[1],(uv[:,0]*base.size[0]).astype(int)%base.size[0],:3]
r,g,b=colors.T
skin=(r>.73)&(g>.40)&(b>.25)&(g/r>.50)
report=[]
for style in range(1,11):
    col=(style-1)%5;row=(style-1)//5
    xmin=[-.145,-.005,.113,.237,.357][col];xmax=[-.005,.113,.237,.357,.50][col]
    zmin,zmax=(.565,.735) if row==0 else (.399,.553)
    cell=(centers[:,0]>xmin)&(centers[:,0]<xmax)&(centers[:,2]>zmin)&(centers[:,2]<zmax)
    pts=centers[cell&skin]
    # Exclude collar and neck; bright facial surface supplies a stable fit.
    pts=pts[pts[:,2]>zmin+(zmax-zmin)*.23]
    front=pts[pts[:,1]<np.percentile(pts[:,1],35)]
    info={'style':style,'cellFaces':int(cell.sum()),'bounds':[coords[indices[cell]].reshape(-1,3).min(axis=0).tolist(),coords[indices[cell]].reshape(-1,3).max(axis=0).tolist()], 'skinBounds':[np.percentile(front,2,axis=0).tolist(),np.percentile(front,98,axis=0).tolist()]}
    report.append(info)
    # Store independent reference heads retaining original texture UVs.
    o=source.copy();o.data=mesh.copy();bpy.context.scene.collection.objects.link(o);o.name='ReferenceHead_%02d'%style
    bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[f for i,f in enumerate(bm.faces)if not cell[i]],context='FACES');bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free()
bpy.data.objects.remove(source,do_unlink=True)
(WORK/'reference-heads.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'reference-heads.blend'))
print(json.dumps(report),flush=True)
