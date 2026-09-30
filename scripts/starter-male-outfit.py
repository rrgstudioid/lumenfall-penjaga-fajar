"""Reference-led ragged starter outfit; isolated procedural authoring, no source edits.
The old fused tunic, armor, belt, gloves and boots are removed, not covered.
"""
import bpy,bmesh,math,random
from mathutils import Vector

def rebuild_starter_outfit(body,scene,simple_material):
    def activate(o):
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    skin=simple_material('StarterSkin',(.807,.439,.275))
    def cloth(name,a,b):
        mat=simple_material(name,a);ns=mat.node_tree.nodes;ls=mat.node_tree.links
        bsdf=next(n for n in ns if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Roughness'].default_value=.94
        coords=ns.new('ShaderNodeTexCoord');noise=ns.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=24;noise.inputs['Detail'].default_value=3
        ls.new(coords.outputs['Object'],noise.inputs['Vector']);mix=ns.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(*a,1);mix.inputs[2].default_value=(*b,1)
        ls.new(noise.outputs['Fac'],mix.inputs[0]);ls.new(mix.outputs[0],bsdf.inputs['Base Color'])
        fine=ns.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=320;fine.inputs['Detail'].default_value=2
        ls.new(coords.outputs['Object'],fine.inputs['Vector']);bump=ns.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.0009
        ls.new(fine.outputs['Fac'],bump.inputs['Height']);ls.new(bump.outputs['Normal'],bsdf.inputs['Normal']);return mat
    tunic=cloth('StarterCloth',(.30,.255,.202),(.47,.399,.318))
    pants=cloth('StarterPants',(.090,.073,.057),(.17,.139,.104))
    rope=cloth('StarterRope',(.075,.052,.032),(.135,.096,.062))
    pieces=[]
    def mesh(name,verts,faces,mat):
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);data.materials.append(mat)
        for p in data.polygons:p.use_smooth=True
        pieces.append(o);return o
    def tube(name,points,radii,mat,sides=16):
        pts=[Vector(p)for p in points];verts=[];faces=[]
        for i,p in enumerate(pts):
            tangent=(pts[min(len(pts)-1,i+1)]-pts[max(0,i-1)]).normalized()
            axis=tangent.cross(Vector((0,1,0)))
            if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
            axis.normalize();other=tangent.cross(axis).normalized()
            rx,ry=(radii[i],radii[i])if isinstance(radii[i],(float,int))else radii[i]
            for j in range(sides):
                phi=2*math.pi*j/sides;verts.append(p+axis*(math.cos(phi)*rx)+other*(math.sin(phi)*ry))
                if i:
                    a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides;c=i*sides+(j+1)%sides;d=i*sides+j;faces.append((a,b,c,d))
        faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
        return mesh(name,verts,faces,mat)
    def ellipsoid(name,center,scale,mat,segments=20,rings=12):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
        o=bpy.context.object;o.name=name;o.scale=scale;activate(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        o.data.materials.append(mat);pieces.append(o);return o
    # Preserve only the clean head. Every garment and boot
    # below the head is deleted from the derivative before replacement.
    bm=bmesh.new();bm.from_mesh(body.data)
    # Even the prior sleeve/neck seam is rebuilt from skin.
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.375],context='VERTS');bm.to_mesh(body.data);bm.free();body.data.update()
    # Bare torso and neck, hidden only where the actual cloth covers them.
    tube('StarterTorso',[(0,.025,.80),(0,.02,.91),(0,.02,1.02),(0,.02,1.14),(0,.018,1.25),(0,.018,1.31)],[(.14,.095),(.155,.102),(.145,.091),(.168,.103),(.183,.104),(.165,.085)],skin,24)
    tube('StarterNeck',[(0,.025,1.24),(0,.025,1.31),(0,.025,1.40),(0,.025,1.44)],[(.10,.083),(.082,.069),(.079,.070),(.08,.071)],skin,24)
    for sign in [-1,1]:
        # Smooth, uncovered shoulders/arms taper into the new bare hands.
        tube('StarterArm',[(sign*.13,.018,1.255),(sign*.18,.018,1.285),(sign*.207,.018,1.265),(sign*.243,.010,1.16),(sign*.284,.005,1.045),(sign*.312,-.003,.97),(sign*.351,-.012,.85),(sign*.364,-.016,.81),(sign*.372,-.018,.755)],[(.073,.075),(.073,.075),(.070,.071),(.061,.064),(.050,.054),(.052,.053),(.039,.036),(.033,.028),(.034,.023)],skin,20)
        ellipsoid('Palm',(sign*.372,-.018,.761),(.045,.025,.059),skin,24,16)
        for finger in range(4):
            x=.343+finger*.021;end=.659+[.015,0,.008,.032][finger]
            tube('Finger',[(sign*x,-.020,.744),(sign*(x+.005),-.023,.701),(sign*(x+.007),-.033,end+.008)], [.0095,.009,.0075],skin,10)
            ellipsoid('FingerTip',(sign*(x+.007),-.033,end+.008),(.0075,.008,.009),skin,12,8)
        tube('Thumb',[(sign*.345,-.020,.788),(sign*.322,-.024,.757),(sign*.315,-.035,.731)], [.016,.013,.010],skin,12)
        ellipsoid('ThumbTip',(sign*.315,-.035,.731),(.011,.011,.014),skin,12,8)
        tube('StarterLeg',[(sign*.13,.033,.83),(sign*.137,.025,.68),(sign*.165,.016,.49),(sign*.177,.026,.395),(sign*.185,.034,.30),(sign*.190,.027,.15),(sign*.190,.022,.075)],[(.085,.084),(.076,.077),(.057,.060),(.062,.066),(.054,.060),(.035,.039),(.039,.045)],skin,20)
        # Ankle, heel, arch and forefoot are unioned into a bare foot with 5 toes.
        ellipsoid('Heel',(sign*.19,.034,.067),(.052,.064,.057),skin)
        ellipsoid('FootArch',(sign*.19,-.042,.059),(.057,.10,.042),skin)
        ellipsoid('Forefoot',(sign*.19,-.117,.043),(.079,.062,.032),skin)
        for toe in range(5):
            offset=-.052+toe*.028;length=.052-toe*.006
            ellipsoid('Toe',(sign*(.19+offset),-.160+toe*.008,.027),(.020-toe*.0013,length*.55,.023-toe*.0015),skin,16,10)
    # Union only new skin to eliminate intersections at shoulder, ankle and toes.
    skinparts=list(pieces);activate(skinparts[0])
    for o in skinparts:o.select_set(True)
    bpy.ops.object.join();anatomy=bpy.context.object;anatomy.name='StarterAnatomy';pieces=[anatomy]
    anatomy.data.remesh_voxel_size=.0045;activate(anatomy);bpy.ops.object.voxel_remesh()
    mod=anatomy.modifiers.new('AnatomicalTransitions','SMOOTH');mod.factor=.6;mod.iterations=5;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=anatomy.modifiers.new('SkinBudget','DECIMATE');mod.ratio=min(1,8500/sum(len(p.vertices)-2 for p in anatomy.data.polygons));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in anatomy.data.polygons:p.use_smooth=True
    # Cloth panels are a separate surface, with real armholes and a torn V neck.
    verts=[];faces=[];segments=96;rows=26;rng=random.Random(20261001)
    tears=[rng.uniform(-.019,.016)for _ in range(segments)]
    for row in range(rows+1):
        t=row/rows
        for j in range(segments):
            phi=2*math.pi*j/segments;xdir=math.cos(phi);ydir=math.sin(phi)
            front=ydir<0
            neckline=(1.228+.106*min(1,abs(xdir)/.63)) if front else (1.314+.020*abs(xdir))
            # Two small uneven notches at the collar, not a perfect sawtooth rim.
            neckline+=.003*math.sin(j*2.3)+.002*math.sin(j*.79)
            hem=.772+tears[j]-.017*(.5+.5*math.sin(phi*7+.7))
            z=hem+(neckline-hem)*t
            if z<.98:rx=.258-(z-.78)*.46;ry=.145-(z-.78)*.21
            else:rx=.166+(z-.98)*.15;ry=.103+(z-.98)*.05
            fold=.0035*math.sin(phi*11+t*3)+.0015*math.sin(phi*23-t*7)
            # Gathered cloth above the rope, subtle relaxed folds elsewhere.
            fold+=.004*math.exp(-((z-1.015)/.06)**2)*math.sin(phi*17)
            verts.append((xdir*(rx+fold),.020+ydir*(ry+fold),z))
            if row:
                a=(row-1)*segments+j;b=(row-1)*segments+(j+1)%segments;c=row*segments+(j+1)%segments;d=row*segments+j
                armhole=abs(xdir)>.82 and 1.125<z<1.296
                if not armhole:faces.append((a,b,c,d))
    shirt=mesh('RaggedSleevelessTunic',verts,faces,tunic)
    activate(shirt);solid=shirt.modifiers.new('ClothEdge','SOLIDIFY');solid.thickness=.0035;solid.offset=-.3;bpy.ops.object.modifier_apply(modifier=solid.name)
    # Shorts ending below the knee: muted brown fabric, asymmetric ragged hems.
    for sign in [-1,1]:
        verts=[];faces=[];segments=48;rows=14
        tear=[rng.uniform(-.022,.012)for _ in range(segments)]
        for row in range(rows+1):
            t=row/rows
            for j in range(segments):
                phi=2*math.pi*j/segments;z=.455+tear[j]+(.84-.455-tear[j])*t
                cx=sign*(.167-(z-.455)*.10);rx=.098-.019*t;ry=.100-.014*t
                fold=.0035*math.sin(phi*9+t*2)+.002*math.sin(phi*17-t*3)
                verts.append((cx+math.cos(phi)*(rx+fold),.025+math.sin(phi)*(ry+fold),z))
                if row:
                    a=(row-1)*segments+j;b=(row-1)*segments+(j+1)%segments;c=row*segments+(j+1)%segments;d=row*segments+j;faces.append((a,b,c,d))
        o=mesh('RaggedShorts',verts,faces,pants);activate(o);solid=o.modifiers.new('HemThickness','SOLIDIFY');solid.thickness=.003;solid.offset=-.3;bpy.ops.object.modifier_apply(modifier=solid.name)
    # Double twisted rope belt, an off-centre knot and two hanging ends.
    for turn in range(2):
        pts=[]
        for i in range(193):
            phi=2*math.pi*i/192;pts.append((.175*math.cos(phi),.02+.116*math.sin(phi),.986+turn*.013+.002*math.sin(phi*16)))
        tube('WaistRope',pts,[.008]*len(pts),rope,7)
    for strand in range(2):
        pts=[]
        for i in range(34):
            t=i/33;pts.append((-.035+strand*.035+.008*math.sin(t*4),-.116-.042*t,.995-(.21-.045*strand)*t))
        tube('RopeEnd',pts,[.0065]*(len(pts)-1)+[.004],rope,7)
    ellipsoid('RopeKnot',(-.018,-.105,.987),(.020,.012,.022),rope,16,10)
    # Bake one shared runtime material, but retain strict skin/cloth vertex tags.
    activate(body)
    for o in pieces:o.select_set(True)
    bpy.ops.object.join();body=bpy.context.object
    region=body.data.color_attributes.new(name='SkinRegion',type='BYTE_COLOR',domain='CORNER')
    for p in body.data.polygons:
        name=body.data.materials[p.material_index].name
        is_skin=name.startswith(('CleanHead','ScalpSource','StarterSkin'))
        for li in p.loop_indices:region.data[li].color=(float(is_skin),0,0,1)
    body.data.color_attributes.active_color=region
    body['starterOutfit']='ragged-sleeveless-rope-shorts-barefoot-v1'
    print('STARTER_OUTFIT',len(body.data.vertices),'vertices; old outfit removed; semantic regions authored',flush=True)
    return body
