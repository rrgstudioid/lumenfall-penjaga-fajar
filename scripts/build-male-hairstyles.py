"""Author solid stylized attachments around the audited male scalp, in staging only."""
import bpy, bmesh, math, json, sys, numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/modular-male';OUT=ROOT/'public/assets/characters/male-v2'
bpy.ops.wm.open_mainfile(filepath=str(WORK/'male-v2-master.blend'),load_ui=False,use_scripts=False)
rig=bpy.data.objects['MaleV2Rig'];scene=bpy.context.scene
material=bpy.data.materials['MAT_Hair']

def activate(o):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
def strand(points,width,depth=.7):
    pts=[Vector(p) for p in points];verts=[];faces=[];rings=12;sides=7
    for k in range(rings):
        t=k/(rings-1);p=(1-t)**3*pts[0]+3*(1-t)**2*t*pts[1]+3*(1-t)*t*t*pts[2]+t**3*pts[3]
        direction=(3*(1-t)**2*(pts[1]-pts[0])+6*(1-t)*t*(pts[2]-pts[1])+3*t*t*(pts[3]-pts[2])).normalized()
        axis=direction.cross(Vector((0,1,0)))
        if axis.length<.01:axis=direction.cross(Vector((1,0,0)))
        axis.normalize();other=direction.cross(axis).normalized()
        radius=width*(.35+.85*math.sin(math.pi*t*.9))*(1-t)**.45+.001
        for j in range(sides):
            a=2*math.pi*j/sides;verts.append(p+radius*(math.cos(a)*axis+math.sin(a)*other*depth))
        if k:
            for j in range(sides):faces.append(((k-1)*sides+j,(k-1)*sides+(j+1)%sides,k*sides+(j+1)%sides,k*sides+j))
    faces.append(tuple(reversed(range(sides))));faces.append(tuple((rings-1)*sides+j for j in range(sides)))
    return verts,faces
# The supplied montage already contains the requested hairstyle references.
# Fit only their hair surfaces to the main character; never replace his face.
with bpy.data.libraries.load(str(WORK/'reference-heads.blend'),link=False) as (src,dst):
    dst.objects=[name for name in src.objects if name.startswith('ReferenceHead_')]
references={o.name:o for o in dst.objects}
head_report=json.loads((WORK/'reference-heads.json').read_text())

# One fitted hair volume, from the frontal hairline around both ears to the
# occiput and nape. Horizontal surface sections preserve the true hairline
# height; the previous polar-angle approximation stopped halfway down the back.
head_bm=bmesh.new();head_bm.from_mesh(bpy.data.objects['MaleBody'].data)
head_surface=BVHTree.FromBMesh(head_bm)

def hairline(phi):
    angle=math.acos(max(-1,min(1,-math.sin(phi))))
    # Angle from the face: temple/sideburn, arch above ear, behind ear, nape.
    knots=[(0,1.728),(.65,1.706),(.95,1.57),(1.16,1.57),
           (1.42,1.615),(1.62,1.605),(1.92,1.47),(2.28,1.425),(math.pi,1.423)]
    for (a,z),(b,w) in zip(knots,knots[1:]):
        if angle<=b:
            t=max(0,min(1,(angle-a)/(b-a)));t=t*t*(3-2*t)
            return z+(w-z)*t
    return knots[-1][1]

def scalp(style):
    # Mohawk owns a narrow crest; undercut leaves the lower sides and nape bare.
    # A full crew-cut cap under every preset would recreate the stacked-hair bug.
    if style==3:
        verts=[];faces=[];rows=64;columns=16;origin=Vector((0,.025,1.642))
        for i in range(rows+1):
            t=i/rows;theta=-1.04+3.12*t
            for j in range(columns+1):
                x=(j/columns*2-1)*.060
                direction=Vector((x,.207*math.sin(theta),.211*math.cos(theta))).normalized()
                hit,_,_,_=head_surface.ray_cast(origin+direction*.8,-direction,1.6)
                if hit is None:raise RuntimeError('Mohawk root missed bald scalp')
                verts.append(hit+direction*.008)
                if i and j:
                    a=(i-1)*(columns+1)+j-1;b=a+1;c=i*(columns+1)+j;d=c-1
                    faces.append((a,d,c,b))
        mesh=bpy.data.meshes.new('MohawkRoot');mesh.from_pydata(verts,[],faces);mesh.update()
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        o=bpy.data.objects.new('Scalp_03',mesh);scene.collection.objects.link(o);return o
    verts=[];faces=[];segments=96;rings=40
    for row in range(rings+1):
        t=row/rings
        for j in range(segments):
            phi=2*math.pi*j/segments
            edge=hairline(phi) if style!=4 else max(1.715,hairline(phi))
            z=1.851+(edge-1.851)*t
            direction=Vector((math.cos(phi),math.sin(phi),0))
            origin=Vector((0,.025,z))
            hit,normal,_,_=head_surface.ray_cast(origin+direction*.8,-direction,1.6)
            if hit is None:
                # The highest ring converges into the crown; no face/body guess.
                if row>1:raise RuntimeError('Scalp horizontal section missed')
                hit=origin
            lift=(.006 if style in [2,3,4,8] else .011)+.002*math.sin(t*math.pi)
            point=hit+direction*lift
            point.z+=.005*(1-t)
            # Broad directional sculpting, continuous across the whole shell.
            point+=direction*(.003*(.5+.5*math.cos(phi*22+t*3))*math.sin(t*math.pi))
            verts.append(point)
            if row:
                a=(row-1)*segments+j;b=(row-1)*segments+(j+1)%segments
                c=row*segments+(j+1)%segments;d=row*segments+j
                faces.append((a,d,c,b))
    faces.append(tuple(reversed(range(segments))))
    mesh=bpy.data.meshes.new('FullScalpVolume');mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new('Scalp_%02d'%style,mesh);scene.collection.objects.link(o)
    return o

def unify_hair(o,style):
    # Solidify open extracted locks and union them with the full scalp in staging.
    # Runtime receives one smooth mesh, not an overlaid cap + tinted body band.
    activate(o);o.modifiers.clear();o.vertex_groups.clear()
    solid=o.modifiers.new('LockVolume','SOLIDIFY');solid.thickness=.010;solid.offset=0
    bpy.ops.object.modifier_apply(modifier=solid.name)
    cap=scalp(style);activate(cap)
    solid=cap.modifiers.new('ScalpThickness','SOLIDIFY');solid.thickness=.022;solid.offset=-.65
    bpy.ops.object.modifier_apply(modifier=solid.name)
    cap.data.materials.append(o.data.materials[0]);activate(o);cap.select_set(True);bpy.ops.object.join()
    o.data.remesh_voxel_size=.0035;o.data.remesh_voxel_adaptivity=0
    bpy.ops.object.voxel_remesh()
    # Every hairstyle must be a single connected volume rooted at the scalp.
    # Detached source fragments cannot survive just because they are large.
    bm=bmesh.new();bm.from_mesh(o.data)
    unseen=set(bm.verts);components=[]
    while unseen:
        todo=[unseen.pop()];group=set(todo)
        while todo:
            v=todo.pop()
            for e in v.link_edges:
                other=e.other_vert(v)
                if other in unseen:unseen.remove(other);group.add(other);todo.append(other)
        components.append(group)
    primary=max(components,key=len)
    remove=[v for group in components if group is not primary for v in group]
    print('HAIR_CONNECTIVITY',style,'removed',len(components)-1,'detached components',len(remove),'vertices',flush=True)
    bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(o.data);bm.free()
    smooth=o.modifiers.new('SoftLockTransitions','SMOOTH');smooth.factor=.65;smooth.iterations=4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    n=sum(len(p.vertices)-2 for p in o.data.polygons)
    if n>20000:
        reduce=o.modifiers.new('AuthoringReduction','DECIMATE');reduce.ratio=20000/n;reduce.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=reduce.name)
    for p in o.data.polygons:p.use_smooth=True
    o.data.materials.clear();o.data.materials.append(material)
    group=o.vertex_groups.new(name='head');group.add(list(range(len(o.data.vertices))),1,'REPLACE')
    if style in [5,9,10]:
        chest=o.vertex_groups.new(name='spine_03')
        for v in o.data.vertices:
            weight=max(0,min(.6,(1.44-v.co.z)*1.5))
            if weight:group.add([v.index],1-weight,'REPLACE');chest.add([v.index],weight,'REPLACE')
    mod=o.modifiers.new('MaleSkin','ARMATURE');mod.object=rig;o.parent=rig
    return o

def cornrows():
    # The montage's cornrow texture has no usable raised geometry. Sculpt seven
    # continuous braids over the fitted skull, including the rear, in one mesh.
    verts=[];faces=[];rings=64;sides=7;origin=Vector((0,.025,1.64))
    for lane in range(7):
        u=(lane-3)*.21;points=[]
        for i in range(rings):
            theta=-1.02+3.40*i/(rings-1);r=math.sqrt(1-u*u)
            direction=Vector((u*.23,r*.24*math.sin(theta),r*.235*math.cos(theta))).normalized()
            hit,_,_,_=head_surface.ray_cast(origin+direction*.8,-direction,1.6)
            points.append(hit+direction*.024)
        offset=len(verts)
        for i,p in enumerate(points):
            tangent=(points[min(rings-1,i+1)]-points[max(0,i-1)]).normalized()
            normal=(p-origin).normalized();across=tangent.cross(normal).normalized();normal=across.cross(tangent).normalized()
            radius=.0115*(.88+.12*math.cos(i*2.3+lane*.7))
            for j in range(sides):
                a=2*math.pi*j/sides
                verts.append(p+radius*(math.cos(a)*across+math.sin(a)*normal))
            if i:
                for j in range(sides):faces.append((offset+(i-1)*sides+j,offset+(i-1)*sides+(j+1)%sides,offset+i*sides+(j+1)%sides,offset+i*sides+j))
        faces.append(tuple(offset+j for j in reversed(range(sides))))
        faces.append(tuple(offset+(rings-1)*sides+j for j in range(sides)))
    mesh=bpy.data.meshes.new('SculptedCornrows');mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return mesh

def fitted_short_locks(style):
    # Source montage spikes have a flat cut underside. Author coherent roots on
    # the bald skull instead of carrying that floating shelf into the game.
    verts=[];faces=[];origin=Vector((0,.025,1.642))
    def append(points,width,depth):
        vs,fs=strand(points,width,depth);offset=len(verts);verts.extend(vs)
        faces.extend(tuple(i+offset for i in f)for f in fs)
    if style==3:
        # A continuous tapered crest, rather than disconnected sausage-shaped
        # spikes. Small notches preserve a swept hair silhouette from the side.
        rows=96;columns=12
        for i in range(rows+1):
            t=i/rows;theta=-.98+2.55*t
            direction=Vector((0,math.sin(theta),math.cos(theta)))
            root,_,_,_=head_surface.ray_cast(origin+direction*.8,-direction,1.6)
            envelope=math.sin(math.pi*t)**.65
            tooth=(.5+.5*math.cos(2*math.pi*t*7))**.7
            height=.009+envelope*(.080+.040*tooth)
            width=.018+.022*envelope
            for j in range(columns+1):
                across=2*j/columns-1
                raised=height*(1-abs(across)**.75)
                point=root+Vector((across*width,0,0))+direction*(raised+.004)+Vector((0,.035,0))*(raised/.13)
                verts.append(point)
                if i and j:
                    a=(i-1)*(columns+1)+j-1;b=a+1;c=i*(columns+1)+j;d=c-1
                    faces.append((a,d,c,b))
    else:
        for row in range(6):
            for lane in range(5):
                x=(lane-2)*.049;y=-.104+row*.052
                root,_,_,_=head_surface.ray_cast(Vector((x,y,2.2)),Vector((0,0,-1)),.7)
                if root is None or root.z<1.72:continue
                root.z+=.003
                sweep=Vector((.016,.065,.005))
                append([root,root+Vector((0,0,.040)),root+sweep*.70+Vector((0,0,.063)),root+sweep+Vector((0,0,.028))],.034,.68)
    mesh=bpy.data.meshes.new('FittedShortLocks');mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return mesh

def build(style):
    o=references['ReferenceHead_%02d'%style];scene.collection.objects.link(o)
    info=head_report[style-1];a,b=info['skinBounds'];factor=5.5
    offset=Vector(((a[0]+b[0])/2,a[1],a[2]))
    for vertex in o.data.vertices:
        vertex.co=(vertex.co-offset)*factor+Vector((0,-.1895,1.4311))
        # No global inflation: reference face alignment owns the attachment fit.
    o.data.update()
    image=next(n.image for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'base' in n.image.name.lower())
    px=np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4)
    uv=o.data.uv_layers.active.data;allowed=[]
    col=o.data.color_attributes.new(name='HairDetail',type='BYTE_COLOR',domain='CORNER')
    for p in o.data.polygons:
        t=uv[p.loop_indices[0]].uv;r,g,b=px[int(t.y*image.size[1])%image.size[1],int(t.x*image.size[0])%image.size[0],:3]
        x,y,z=p.center
        brown=r>.04 and g/max(r,.001)<.72 and b/max(r,.001)<.49
        protected=abs(x)<.155 and y>-.20 and z<1.60
        outside_face=z>1.66 or y>.09 or y<-.205 or abs(x)>.26
        allowed.append(z>1.80 or (brown and not protected and outside_face and z>1.40) or (brown and y>.09 and z>1.26))
        shade=max(.28,min(1.,float(r)*1.45))
        for li in p.loop_indices:col.data[li].color=(shade,shade,shade,1)
    adjacency=[[]for _ in o.data.vertices]
    for p in o.data.polygons:
        if allowed[p.index]:
            for vi in p.vertices:adjacency[vi].append(p.index)
    keep=set(p.index for p in o.data.polygons if p.center.z>1.84 and allowed[p.index]);queue=list(keep)
    while queue:
        i=queue.pop()
        for vi in o.data.polygons[i].vertices:
            for j in adjacency[vi]:
                if j not in keep:keep.add(j);queue.append(j)
    bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[p for i,p in enumerate(bm.faces)if i not in keep],context='FACES')
    # Source color segmentation can connect hair to dark ears/collar. These are
    # never part of a short haircut. Keep long tails only behind the skull.
    def unwanted(v):
        x,y,z=v.co
        # Short reference heads include their own skull-shaped brown surface.
        # Keep only the actual top locks; the fitted volume owns ALL scalp.
        if style==2:return z<1.82
        if style==3:return z<1.80 or abs(x)>.145 or (y>.05 and z<1.95)
        if style in [4,8]:return z<1.79
        if z<1.70 and abs(x)>.18 and -.14<y<.10:return True
        return (z<1.50 and (style not in [5,9,10] or y<.20)) or (abs(x)>.23 and y<.09 and z<1.61)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if unwanted(v)],context='VERTS')
    bm.to_mesh(o.data);bm.free();o.data.update()
    # Relax the ragged extraction boundary; never inflate the whole hairstyle.
    bm=bmesh.new();bm.from_mesh(o.data)
    border=[v for v in bm.verts if v.is_boundary]
    for _ in range(4):bmesh.ops.smooth_vert(bm,verts=border,factor=.45,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    # Seal trimmed root edges against the bald head, retaining free tips that
    # lie farther away. This removes the visible seam between fitted roots and
    # the extracted exterior locks without inflating the entire style.
    for v in border:
        if v.co.z<1.52:continue
        hit,normal,_,distance=head_surface.find_nearest(v.co)
        if hit is not None and distance<.085:
            v.co=hit+normal*.008
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    o.name='Hair_%02d'%style;o.data.materials.clear()
    hairmat=material.copy();hairmat.name='MAT_HairDetail'
    nodes=hairmat.node_tree.nodes;attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name='HairDetail'
    hairmat.node_tree.links.new(attribute.outputs['Color'],next(n for n in nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
    o.data.materials.append(hairmat)
    for p in o.data.polygons:p.use_smooth=True
    if style in [3,4]:
        o.data=fitted_short_locks(style);o.data.materials.append(material)
    elif style==8:
        o.data=cornrows();o.data.materials.append(material)
    return unify_hair(o,style)

def export(o,path,target):
    copy=o.copy();copy.data=o.data.copy();scene.collection.objects.link(copy);activate(copy)
    n=sum(len(p.vertices)-2 for p in copy.data.polygons)
    if n>target:
        mod=copy.modifiers.new('LOD','DECIMATE');mod.ratio=target/n;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    triangles=sum(len(p.vertices)-2 for p in copy.data.polygons)
    rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=True)
    bpy.data.objects.remove(copy,do_unlink=True);return triangles
selected=[int(v)for v in sys.argv[sys.argv.index('--styles')+1].split(',')] if '--styles' in sys.argv else list(range(1,11))
report=json.loads((WORK/'styles-report.json').read_text()) if '--styles' in sys.argv else {}
for style in selected:
    o=build(style);key='hair_%02d'%style
    report[key]=[export(o,OUT/'hair'/(key+'-lod%d.glb'%lod),target)for lod,target in enumerate([4800,2800,1400,550])]
    o.hide_render=True
(WORK/'styles-report.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/('male-v2-styles-refine.blend' if '--styles' in sys.argv else 'male-v2-styles.blend')))
print('STYLES',json.dumps(report),flush=True)
