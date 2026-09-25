"""Incremental reference polish of the already-scaled playable derivative only.
Run --phase landmarks/plazas/services/nature/props. Collision assets are never rebuilt.
"""
import bpy,bmesh,json,math,sys,random,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
WORK=ROOT/'source/LUMENFALL_Stage03_Runtime_Working.blend'
assert Path(bpy.data.filepath).resolve()==WORK.resolve()
phase=sys.argv[sys.argv.index('--phase')+1]
A=ROOT/'assets';M=json.loads((A/'manifest.json').read_text());scene=bpy.context.scene
prov=json.loads((ROOT/'provenance.json').read_text(encoding='utf-8-sig'))
assert hashlib.sha256(Path(prov['source']).read_bytes()).hexdigest().upper()==prov['sha256']
before_collision=hashlib.sha256((A/M['collision']['url']).read_bytes()).hexdigest()
changed=set();log=[];measure=[]
collection=bpy.data.collections.get('STAGE03_REFERENCE_POLISH')
if not collection:collection=bpy.data.collections.new('STAGE03_REFERENCE_POLISH');scene.collection.children.link(collection)
for o in list(scene.objects):
    if o.get('stage03Group')=='preview-instance':bpy.data.objects.remove(o,do_unlink=True)
    elif o.get('polishPhase')==phase:
        changed.add(o.get('stage03Group',''));bpy.data.objects.remove(o,do_unlink=True)
mats={f:bpy.data.materials.get('S03_'+f) for f in M['materialFamilies']}
def bounds(o):
    pts=[o.matrix_world@Vector(v) for v in o.bound_box]
    return Vector([min(v[i] for v in pts) for i in range(3)]),Vector([max(v[i] for v in pts) for i in range(3)])
def find(prefix):return next((o for o in scene.objects if o.name.startswith(prefix)),None)
def remove(prefix):
    for o in list(scene.objects):
        if o.name.startswith(prefix):
            changed.add(o.get('stage03Group',''));log.append(dict(id=o.name,action='replace'));bpy.data.objects.remove(o,do_unlink=True)
def uv(o):
    l=o.data.uv_layers.new(name='RuntimeUV') if not o.data.uv_layers else o.data.uv_layers.active
    for p in o.data.polygons:
        axes=[i for i in range(3) if i!=max(range(3),key=lambda i:abs(p.normal[i]))]
        for li in p.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co;l.data[li].uv=(co[axes[0]]/3,co[axes[1]]/3)
def adopt(o,name,mat,group):
    o.name='S03P_'+name
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o)
    bpy.context.view_layer.update()
    o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4);o.data.update()
    o.data.materials.clear();o.data.materials.append(mats[mat]);uv(o)
    o['stage03Group']=group;o['sourceId']=o.name;o['polishPhase']=phase
    changed.add(group);log.append(dict(id=o.name,action='reference refinement',group=group))
    return o
def mesh(name,v,f,mat,g):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);collection.objects.link(o);return adopt(o,name,mat,g)
def box(name,c,size,mat,g):
    c=Vector(c);h=Vector(size)/2
    return mesh(name,[c+Vector((x*h.x,y*h.y,z*h.z)) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,g)
def beam(name,a,b,r,mat,g,sides=8):
    a=Vector(a);b=Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return adopt(o,name,mat,g)
def cone(name,c,r1,r2,h,mat,g,n=12):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=h,location=c);return adopt(bpy.context.object,name,mat,g)
def ring(name,c,r,thick,mat,g,n=48):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thick,major_segments=n,minor_segments=6,location=c);return adopt(bpy.context.object,name,mat,g)
def ico(name,c,size,mat,g,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=c);o=bpy.context.object;o.scale=size;return adopt(o,name,mat,g)
def gable(name,x,y,z,w,depth,rise,mat,g):
    v=[(x-w/2,y,z),(x+w/2,y,z),(x,y,z+rise),(x-w/2,y+depth,z),(x+w/2,y+depth,z),(x,y+depth,z+rise)]
    o=mesh(name,v,[(0,1,2),(5,4,3),(0,2,5,3),(2,1,4,5),(0,3,4,1)],mat,g)
    for a,b in [(v[0],v[2]),(v[2],v[1]),(v[2],v[5])]:beam(name+'_BrassSeam',a,b,.055,'gold',g)
    return o
def arch(name,x,y,z,w,h,mat,g,th=.12):
    points=[(x-w/2,y,z),(x-w/2,y,z+h*.68),(x-w*.36,y,z+h*.83),(x,y,z+h),(x+w*.36,y,z+h*.83),(x+w/2,y,z+h*.68),(x+w/2,y,z)]
    for a,b in zip(points,points[1:]):beam(name,a,b,th,mat,g)
def color_variation(o,seed=1):
    rng=random.Random(seed);a=o.data.color_attributes.get('BakedAO') or o.data.color_attributes.new(name='BakedAO',type='FLOAT_COLOR',domain='POINT');o.data.color_attributes.active_color=a
    for v in o.data.vertices:
        s=.78+rng.random()*.22;a.data[v.index].color=(s,s,s,1)
def material(name,color,metal=0,rough=.65,emission=0,alpha=1):
    m=bpy.data.materials.get('S03_'+name) or bpy.data.materials.new('S03_'+name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission;bs.inputs['Alpha'].default_value=alpha
    m.diffuse_color=(*color,alpha)
    if alpha<1:m.surface_render_method='DITHERED'
    mats[name]=m
    if name not in M['materialFamilies']:M['materialFamilies'].append(name)
    return m

if phase=='landmarks':
    g='civic-north'
    # Layered pointed portal and facade tracery keep the existing mass/door and stair route.
    for w,h,y in [(6.2,10.5,65.30),(5.5,10.0,65.12),(4.8,9.4,64.98)]:arch('Guild_PortalArchivolt',0,y,1.55,w,h,'stone',g,.16)
    arch('Guild_PortalBrass',0,64.78,1.62,4.65,9.35,'gold',g,.055)
    for x in [-6.0,6.0,-12.8,12.8]:
        cone('Guild_EngagedColumn',(x,65.32,7.6),.25,.25,12.1,'stone',g)
        for z in [1.65,13.5]:box('Guild_CarvedCapital',(x,65.28,z),(.8,.6,.28),'stone',g)
        cone('Guild_Pinnacle',(x,65.35,15.0),.45,0,2.5,'blue',g)
        beam('Guild_Finial',(x,65.35,16.25),(x,65.35,16.9),.045,'gold',g)
    for x in [-.85,0,.85]:beam('Guild_UpperLancetMullion',(x,65.65,19.35),(x,65.65,26.9-abs(x)*2),.065,'gold',g)
    for z,w in [(21,1.65),(23,1.4),(25,.8)]:beam('Guild_Tracery',(-w,65.64,z),(w,65.64,z),.055,'stone',g)
    # Rose tracery above the portal and a forward gable reinforce the central hierarchy.
    o=ring('Guild_RoseWindow',(0,65.50,15.55),1.35,.11,'gold',g,32);o.data.transform(Matrix.Translation((0,65.5,15.55))@Matrix.Rotation(math.pi/2,4,'X')@Matrix.Translation((0,-65.5,-15.55)))
    for i in range(8):
        t=i*math.tau/8;beam('Guild_RoseSpoke',(0,65.35,15.55),(1.3*math.cos(t),65.35,15.55+1.3*math.sin(t)),.055,'stone',g)
    gable('Guild_PortalGable',0,64.75,11.1,7.0,1.2,3.7,'blue',g)
    for x in [-8.6,8.6]:
        box('Guild_DormerFace',(x,69.0,21.0),(2.3,.4,2.6),'stone',g)
        box('Guild_DormerGlass',(x,68.76,21.2),(1.0,.06,1.7),'glass',g)
        arch('Guild_DormerTrim',x,68.65,20.3,1.15,1.9,'gold',g,.06)
        gable('Guild_DormerRoof',x,68.6,22.25,2.9,2.8,2.0,'blue',g)
    # Smooth ceremonial dome replaces the fragmented tile-envelope roof; body and wings remain.
    g='job-northeast';remove('LF2_Job_Change_Hall_blue')
    cx,cy=55.8141,55.2281;vv=[];ff=[]
    for j in range(13):
        t=j/12*math.pi/2;r=9.65*math.cos(t);z=9.65+7.1*math.sin(t)
        for i in range(64):a=i*math.tau/64;vv.append((cx+r*math.cos(a),cy+r*math.sin(a),z))
    for j in range(12):
        for i in range(64):a=j*64+i;b=j*64+(i+1)%64;ff.append((a,b,b+64,a+64))
    dome=mesh('Job_ContinuousDome',vv,ff,'blue',g)
    for p in dome.data.polygons:p.use_smooth=True
    for z,r in [(9.66,9.65),(10.25,9.60),(16.7,2.2)]:ring('Job_DomeCornice',(cx,cy,z),r,.09,'gold',g)
    for i in range(12):
        a=i*math.tau/12
        pts=[(cx+9.69*math.cos(j/12*math.pi/2)*math.cos(a),cy+9.69*math.cos(j/12*math.pi/2)*math.sin(a),9.69+7.13*math.sin(j/12*math.pi/2)) for j in range(12)]
        for u,v in zip(pts,pts[1:]):beam('Job_GildedDomeRib',u,v,.045,'gold',g,6)
    cone('Job_LanternCap',(cx,cy,21.15),2.85,.10,4.3,'blue',g,16)
    ring('Job_LanternEave',(cx,cy,19.05),2.85,.10,'gold',g)
    beam('Job_LanternSpire',(cx,cy,23.2),(cx,cy,25.0),.055,'gold',g)
    gable('Job_EntranceRoof',48,40.95,6.65,6.6,7.0,5.3,'blue',g)
    gable('Job_SideRoof',60,49.1,7.0,5.4,8.0,4.5,'blue',g)
    remove('S03_Job_Entrance_Column');remove('S03_Job_Column_Capital');remove('S03_Job_Portal_Cornice')
    for x in [45.5,50.5]:
        cone('Job_PortalColumn',(x,41.1,3.6),.30,.24,5.65,'stone',g)
        for z in [.8,6.42]:box('Job_PortalCapital',(x,41.1,z),(.85,.65,.28),'gold',g)
    arch('Job_PortalArch',48,41.0,.95,4.1,5.6,'stone',g,.20)
    for i in range(12):
        a=i*math.tau/12
        x=cx+9.42*math.cos(a);y=cy+9.42*math.sin(a)
        beam('Job_WallPilaster',(x,y,1),(x,y,9.7),.17,'stone',g)

if phase=='plazas':
    g='central-warp'
    statue=find('LF3_Lumenfall_Guardian_Statue');statue.data.materials.clear();statue.data.materials.append(material('statue',(.26,.35,.40),.6,.42));changed.add(g)
    log.append(dict(id=statue.name,action='blue grey patinated guardian instead of solid gold'))
    for r,z,mat in [(6.12,1.56,'blue'),(5.9,1.61,'gold'),(2.44,2.88,'gold')]:ring('Fountain_BasinInlay',(0,-.67,z),r,.065,mat,g)
    # Water planes and ripple rings remain inside the existing fountain blocker.
    for r in [1.2,3.4,4.3]:ring('Fountain_SoftRipple',(0,-.67,1.225),r,.018,'water',g)
    magic=material('magic',(.012,.18,.68),.15,.18,.7,.68)
    material('aether_core',(.06,.60,1),.05,.20,1.0)
    for o in scene.objects:
        if any(k in o.name for k in ['Warp_Faceted_Aether','Warp_Lower_Crystal']):
            o.data.materials.clear();o.data.materials.append(magic);log.append(dict(id=o.name,action='controlled translucent faceted blue shell'))
        if 'Warp_Luminous_Heart' in o.name:o.data.materials.clear();o.data.materials.append(mats['aether_core'])
    cy=-67.755
    for r,z in [(3.1,1.96),(3.8,.76),(5.15,.73)]:ring('Warp_AetherRunicCircle',(0,cy,z),r,.035,'aether_core',g)
    for i in range(12):
        t=i*math.tau/12;c=Vector((4.45*math.cos(t),cy+4.45*math.sin(t),.755));radial=Vector((math.cos(t),math.sin(t),0));tangent=Vector((-math.sin(t),math.cos(t),0))
        for a,b in [(c-radial*.30,c+radial*.30),(c+radial*.30,c+tangent*.20),(c,c-tangent*.18)]:beam('Warp_RuneGlyph',a,b,.028,'aether_core',g,6)
    # Fine facet edges make the shell legible without adding refraction or point lights.
    crystal=find('LF3_Warp_Faceted_Aether_Crystal')
    for edge in crystal.data.edges:
        a,b=[crystal.matrix_world@crystal.data.vertices[i].co for i in edge.vertices]
        if (a-b).length>2:beam('Warp_FacetLight',a,b,.018,'aether_core',g,6)

if phase=='services':
    # Restore the original fitted gable planes around the new dome; do not invent a new footprint.
    with bpy.data.libraries.load(str(ROOT/'source/LUMENFALL_Stage03_PrePolish.blend'),link=False) as (src,dst):
        dst.objects=[n for n in src.objects if n.startswith('LF2_Job_Change_Hall_blue')]
    for source in dst.objects:
        if not source:continue
        source.data.update();polys=[p for p in source.data.polygons if p.area>2 and max(source.data.vertices[i].co.z for i in p.vertices)<14]
        if polys:mesh('Job_SourceFittedGables',[v.co.copy() for v in source.data.vertices],[tuple(p.vertices) for p in polys],'blue','job-northeast')
        bpy.data.objects.remove(source,do_unlink=True)
    def sign(label,x,y,z,g,kind):
        box(label+'_Sign',(x,y,z),(1.65,.18,1.35),'wood',g)
        beam(label+'_Bracket',(x-.75,y+.45,z+.9),(x+.75,y,z+.9),.07,'iron',g)
        for xx in [x-.52,x+.52]:beam(label+'_Chain',(xx,y,z+.68),(xx,y,z+.9),.035,'iron',g)
        if kind=='sword':
            for dx in [-.30,.30]:
                beam(label+'_Sword',(x+dx,y-.13,z-.45),(x-dx,y-.13,z+.46),.07,'statue',g)
            beam(label+'_Guard',(x-.45,y-.14,z-.14),(x+.45,y-.14,z-.14),.06,'gold',g)
        elif kind=='potion':
            ico(label+'_Bottle',(x,y-.17,z-.1),(.26,.10,.35),'magic',g,2);box(label+'_BottleNeck',(x,y-.17,z+.3),(.18,.12,.30),'gold',g)
        elif kind=='shield':
            mesh(label+'_Shield',[(x-.45,y-.14,z+.43),(x+.45,y-.14,z+.43),(x+.36,y-.14,z-.2),(x,y-.14,z-.5),(x-.36,y-.14,z-.2)],[(0,4,3,2,1)],'gold',g)
        elif kind=='mug':
            box(label+'_Mug',(x,y-.15,z),(.52,.13,.63),'gold',g);arch(label+'_Handle',x+.36,y-.2,z-.24,.25,.48,'gold',g,.05)
        else:
            o=ring(label+'_Coin',(x,y-.16,z),.39,.07,'gold',g,24);o.data.transform(Matrix.Translation((x,y-.16,z))@Matrix.Rotation(math.pi/2,4,'X')@Matrix.Translation((-x,-y+.16,-z)))
    for label in ['Merchant','Potion','Weapon','Armor','Bank','Inn']:
        remove('S03_'+label+'_Signboard');remove('S03_'+label+'_Sign_Emblem');remove('S03_'+label+'_Sign_Sword')
    sign('Merchant',-85.6,10.3,4.9,'merchant-west','coin')
    sign('Potion',-48.0,9.6,4.3,'merchant-west','potion')
    sign('Weapon',-84.2,-25.3,4.6,'merchant-west','sword')
    sign('Armor',-48.9,-27.5,4.5,'merchant-west','shield')
    sign('Bank',67.2,-38.55,5.3,'bank-residential-southeast','coin')
    sign('Inn',-52.5,-69.7,4.6,'inn-southwest','mug')
    g='bank-residential-southeast'
    arch('Bank_StoneArchivolt',63.25,-38.35,.94,4.7,5.1,'stone',g,.22)
    arch('Bank_BrassPortal',63.25,-38.57,.98,4.15,4.85,'gold',g,.065)
    for x in [60.4,66.1]:
        box('Bank_Buttress',(x,-38.30,3.2),(.60,.55,5.35),'stone',g)
        box('Bank_Capital',(x,-38.4,5.9),(.9,.65,.25),'gold',g)
    box('Bank_DormerFace',(57.5,-31.4,12.5),(2.5,.3,2.3),'stone',g)
    box('Bank_DormerGlass',(57.5,-31.62,12.5),(1.0,.08,1.5),'glass',g)
    gable('Bank_DormerRoof',57.5,-31.8,13.6,3.0,3,1.6,'blue',g)
    # Apothecary bottles sit on the existing counter, with herb bundles under its canopy.
    g='merchant-west'
    for i in range(7):
        x=-50.8+i*.32;y=9.85
        cone('Potion_BottleBody',(x,y,1.85),.09,.085,.38,'glass' if i%2 else 'magic',g)
        cone('Potion_BottleNeck',(x,y,2.10),.037,.035,.15,'glass',g)
        cone('Potion_Stopper',(x,y,2.2),.045,.045,.08,'wood',g)
    for x in [-51.0,-50.3,-49.6]:
        beam('Potion_HerbString',(x,10.2,3.55),(x,10.2,3.0),.025,'wood',g)
        ico('Potion_Herbs',(x,10.2,2.86),(.18,.14,.32),'foliage',g)
    # Readable armor bust on the facade; no new gameplay service is instantiated.
    for x,y in [(-51.1,-26.0),(-39.5,-26.0)]:
        box('Armor_DisplayShelf',(x,y,1.5),(1.1,.65,.12),'wood',g)
        ico('Armor_Breastplate',(x,y,2.05),(.43,.25,.53),'statue',g,2)
        ico('Armor_Helmet',(x,y,2.78),(.28,.24,.32),'statue',g,2)
        beam('Armor_DisplayStand',(x,y,1.56),(x,y,2.7),.05,'wood',g)
    # Warm front canopy and domestic window boxes retain the house footprint and Residence B.
    g='inn-southwest'
    mesh('Inn_LinenCanopy',[(-51.1,-69.4,4.3),(-45.6,-69.4,4.3),(-45.6,-71.2,3.7),(-51.1,-71.2,3.7)],[(0,1,2,3)],'fabric',g)
    for x in [-51.1,-45.6]:beam('Inn_CanopyBrace',(x,-69.5,2.95),(x,-71.2,3.70),.075,'wood',g)
    for label,x,y in [('ResidenceA',44.4,-71.2),('ResidenceB',62.0,-65.2)]:
        g='bank-residential-southeast';box(label+'_WindowBox',(x,y,2.1),(1.4,.50,.32),'wood',g)
        for i in range(5):ico(label+'_Flowers',(x-.5+i*.25,y,2.42),(.18,.18,.23),'flower' if i%2 else 'foliage',g)
    # Replace the oversize glowing slab with heat recessed in the open hearth.
    g='forge-east';remove('S03_Forge_Heat')
    box('Forge_EmberBed',(79.3,3.5,1.1),(1.45,.25,.42),'emissive',g)
    box('Forge_SootLintel',(79.3,3.56,3.2),(2.5,.07,.32),'dark',g)
    for z in [13.2,15.2,17.3]:box('Forge_ChimneyIronBand',(79.5,7.35,z),(4.6,4.55,.12),'iron',g)
    box('Forge_ToolRack',(63.1,17.7,2.1),(3.5,.16,.14),'wood',g)
    for i in range(5):
        x=61.8+i*.65;beam('Forge_ToolHandle',(x,17.6,1.2),(x,17.6,2.3),.05,'wood',g)
        box('Forge_HammerHead',(x,17.6,2.3),(.36,.18,.16),'iron',g)
    g='training-northwest'
    for i,(x,y) in enumerate([(-59.7,54.4),(-44.6,52.6),(-48.5,61.0)]):
        if i==0:ico('Training_Helmet',(x,y,2.65),(.3,.25,.26),'iron',g,2)
        else:
            shield=cone('Training_Shield',(x,y-.4,1.6),.45,.45,.10,'wood',g,12)
            shield.data.transform(Matrix.Translation((x,y-.4,1.6))@Matrix.Rotation(math.pi/2,4,'X')@Matrix.Translation((-x,-y+.4,-1.6)))

if phase=='nature':
    rng=random.Random(731)
    for o in list(scene.objects):
        if o.get('stage03Group') in ['module-tree','module-shrub','module-tree-wide','module-tree-spire']:
            changed.add(o['stage03Group']);bpy.data.objects.remove(o,do_unlink=True)
    def join(oo,name):
        bpy.ops.object.select_all(action='DESELECT')
        for o in oo:o.select_set(True)
        bpy.context.view_layer.objects.active=oo[0];bpy.ops.object.join();oo[0].name='S03P_'+name;return oo[0]
    for kind in ['tree','tree-wide','tree-spire']:
        g='module-'+kind;crown=[];wood=[]
        wood.append(beam(kind+'_Trunk',(0,0,0),(0,0,.69),.043,'wood',g))
        if kind=='tree-spire':
            for j in range(5):crown.append(ico(kind+'_Crown',(0,0,.40+j*.115),(.28-j*.037,.26-j*.035,.24),'foliage',g,2))
        else:
            for j in range(7):
                a=j*2.399;rr=.21 if j else 0;z=.68+(j%3)*.055
                c=(rr*math.cos(a),rr*math.sin(a),z)
                crown.append(ico(kind+'_LeafCluster',c,(.255,.235,.245 if kind=='tree' else .20),'foliage',g,2))
                if j:wood.append(beam(kind+'_Branch',(0,0,.32),c,.022,'wood',g,6))
            crown.append(ico(kind+'_Leader',(.025,0,.87),(.18,.18,.13),'foliage',g,2))
        join(crown,kind+'_Canopy');join(wood,kind+'_BranchStructure')
        if not any(a['id']==g for a in M['modules']):M['modules'].append(dict(id=g,kind=kind))
    g='module-shrub';shrubs=[]
    for i,c in enumerate([(-.22,-.06,.38),(.19,.05,.45),(0,.20,.6),(0,-.22,.57)]):shrubs.append(ico('Shrub_Cluster',c,(.25,.24,.29),'foliage',g,2))
    join(shrubs,'Shrub_OrganicClump')
    index=0
    for p in M['placements']:
        if p['module'].startswith('tree'):
            p['module']=['tree','tree-wide','tree-spire'][index%3];p['rotation']=(index*2.399)%math.tau;index+=1
    # All replacement foliage remains inside the former normalized canopy bounds.
    material('foliage',(.065,.19,.025),0,.88)
    # Layered boulders follow the existing island contour, outside the closed hub boundary.
    for i in range(152):
        t=i*math.tau/152
        # Leave the decorative gate bridge visible.
        if abs(math.atan2(math.sin(t+math.pi/2),math.cos(t+math.pi/2)))<.11:continue
        radius=110.2+1.3*math.sin(t*9)+rng.uniform(-.6,.6)
        x=radius*math.cos(t);y=1.565+radius*math.sin(t);z=-2.0+rng.uniform(-.4,.4)
        g='wall-'+str(int((math.atan2(y-1.565,x)+math.pi)/(math.pi/4))%8)
        o=ico('Shore_LayeredBasalt',(x,y,z),(2.0+rng.random()*1.1,2.0+rng.random()*1.0,2.1+rng.random()*.7),'rock',g,1)
        if i%3==0:ico('Shore_UpperStone',(x*.985,y*.985,-.15),(1.5,1.6,1.25),'stone',g,1)
    water=find('LF_Minimal_River_Context');material('water',(.02,.23,.32),.15,.24)
    water.data.materials.clear();water.data.materials.append(mats['water']);changed.add('shell')
    colors=water.data.color_attributes.get('BakedAO') or water.data.color_attributes.new(name='BakedAO',type='FLOAT_COLOR',domain='POINT');water.data.color_attributes.active_color=colors
    for v in water.data.vertices:
        r=math.hypot(v.co.x,v.co.y-1.565);near=max(0,min(1,(124-r)/16))
        colors.data[v.index].color=(.4+.30*near,.55+.42*near,.75+.24*near,1)
        if v.co.z>-3.2:v.co.z+=.035*math.sin(v.co.x*.7)*math.sin(v.co.y*.6)
    material('shore_foam',(.22,.58,.60),0,.75)
    for i in range(84):
        a=i*math.tau/84
        if i%5==0 or abs(math.atan2(math.sin(a+math.pi/2),math.cos(a+math.pi/2)))<.12:continue
        r=113.4+math.sin(a*9)*.9;span=.023+rng.random()*.02;w=.08+rng.random()*.16
        pts=[(rr*math.cos(t),1.565+rr*math.sin(t),-3.10) for rr,t in [(r,a),(r+w,a),(r+w,a+span),(r,a+span)]]
        mesh('Shore_BrokenFoam',pts,[(0,1,2,3)],'shore_foam','shell')

if phase=='props':
    def resize_height(o,target,reason):
        lo,hi=bounds(o);before=hi.z-lo.z
        for v in o.data.vertices:v.co.z=lo.z+(v.co.z-lo.z)*target/before
        o.data.update();changed.add(o['stage03Group']);log.append(dict(id=o.name,action=reason,before=before,after=target))
    for o in list(scene.objects):
        n=o.name
        if 'Merchant_Display_Table' in n or 'Apothecary_Counter' in n or 'Weapon_Blade_Counter' in n:resize_height(o,1.1,'counter height correction')
        if 'Inn_Table_Seat' in n:resize_height(o,.55,'seat below 0.9 unit table top')
        if 'Forge_Anvil_' in n:resize_height(o,1.10,'anvil working height correction')
        if 'Inn_Tableware_' in n:
            lo,hi=bounds(o)
            for v in o.data.vertices:v.co.z-=lo.z-1.405
            changed.add(o['stage03Group']);log.append(dict(id=n,action='seat floating tableware on tabletop',gapBefore=lo.z-1.4))
        if n.startswith(('S03P_Potion_Bottle','S03P_Potion_Stopper')):
            for v in o.data.vertices:v.co.z-=.06
            changed.add(o['stage03Group'])
        if n.startswith('LF2_') and '_wood.' in n and any(k in n for k in ['Residence','Merchant','Potion_Shop','Weapon_Shop','Armor_Shop','Inn_Tavern','Storage_Bank','Job_Hall_East_Wing','Blacksmith']):
            lo,hi=bounds(o);height=hi.z-lo.z;width=math.hypot(hi.x-lo.x,hi.y-lo.y)
            if 2.7<height<3.1:
                resize_height(o,3.05,'closed door visual height correction')
                if width<1.8:
                    center=(lo+hi)/2
                    for v in o.data.vertices:
                        v.co.x=center.x+(v.co.x-center.x)*1.8/width;v.co.y=center.y+(v.co.y-center.y)*1.8/width
                measure.append(dict(id=n,kind='door',height=3.05,width=max(width,1.8),note='projected XY mesh span; closed visual entrance, not accessible interior'))
    # Notices at player eye level; glyph lines are physical marks, not presentation labels.
    g='central-warp'
    for i in range(5):
        x=-1.65+i*.82;box('Quest_Parchment',(x,34.76,1.9),(.61,.022,.74),'fabric',g)
        for j in range(4):box('Quest_InkLine',(x-.03,34.743,2.13-j*.13),(.40-j*.035,.012,.018),'wood',g)
        ico('Quest_WaxSeal',(x+.13,34.725,1.62),(.055,.022,.055),'red',g)
    # Local dirt scuffs around existing practice stations add wear without adding blockers.
    g='training-northwest'
    for x,y in [(-59.7,54.4),(-52.1,53.5),(-44.6,52.6),(-56.9,62.1),(-48.5,61.0)]:
        pts=[(x,y,.388)]+[(x+1.45*math.cos(i*math.tau/24),y+1.0*math.sin(i*math.tau/24),.388) for i in range(24)]
        o=mesh('Training_WornSoil',pts,[(0,i+1,(i+1)%24+1) for i in range(24)],'ground',g);color_variation(o,22)
    # Update only blocker heights for the resized furniture, preserving footprint and grid system.
    for b in M['blockers']:
        o=find(b['id'])
        if o and any(t in o.name for t in ['Table','Counter','Anvil']):lo,hi=bounds(o);b['minY']=lo.z;b['maxY']=hi.z

if phase=='cleanup':
    changed.update(a['id'] for a in M['chunks'] if a.get('lods'))
    for o in list(scene.objects):
        n=o.name
        if n.startswith('S03P_'):
            bm=bmesh.new();bm.from_mesh(o.data)
            orphan=[v for v in bm.verts if not v.link_faces]
            if orphan:bmesh.ops.delete(bm,geom=orphan,context='VERTS')
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
            bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
            bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
        if n.startswith(('LF2_Storage_Bank_blue','LF2_Inn_Tavern_terra','LF2_Blacksmith_slate')) and not o.get('roofSeparation'):
            for v in o.data.vertices:v.co.z+=.09
            o['roofSeparation']=True;log.append(dict(id=n,action='separate roof plane from underlying timber to remove z fighting'))
        if n.startswith('LF3_Merchant_Produce_'):
            lo,hi=bounds(o)
            for v in o.data.vertices:v.co.z-=lo.z-1.605
            log.append(dict(id=n,action='seat produce on corrected 1.1 unit counter'))
        if n.startswith('LF3_Forge_Tool_Workbench'):
            lo,hi=bounds(o)
            for v in o.data.vertices:v.co.z=lo.z+(v.co.z-lo.z)*1.1/(hi.z-lo.z)
            log.append(dict(id=n,action='workbench height corrected to 1.1'))
        if n.startswith(('LF3_Forge_Metalwork_Tools','LF3_Weapons_Forged_Sword_Display')):
            lo,hi=bounds(o)
            for v in o.data.vertices:v.co.z-=lo.z-1.605
            log.append(dict(id=n,action='seat tools on support surface'))
        if n.startswith('S03P_Shrub_OrganicClump'):
            bpy.context.view_layer.objects.active=o;o.select_set(True)
            mod=o.modifiers.new('Small shrub silhouette budget','DECIMATE');mod.ratio=.30;bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
            changed.add('module-shrub')
    dome=find('S03P_Job_ContinuousDome');uvs=dome.data.uv_layers.active
    for p in dome.data.polygons:
        aa=[math.atan2(dome.data.vertices[dome.data.loops[li].vertex_index].co.y-55.2281,dome.data.vertices[dome.data.loops[li].vertex_index].co.x-55.8141) for li in p.loop_indices]
        if max(aa)-min(aa)>math.pi:aa=[a+math.tau if a<0 else a for a in aa]
        for li,a in zip(p.loop_indices,aa):
            z=dome.data.vertices[dome.data.loops[li].vertex_index].co.z;uvs.data[li].uv=(a*9.65/3,math.asin(max(-1,min(1,(z-9.65)/7.1)))*7.1/3)
    log.append(dict(id=dome.name,action='spherical dome UV and degenerate pole cleanup'))

if phase=='validation-fixes':
    steps=sorted([o for o in scene.objects if o.name.startswith('LF_Warp_Plaza_Step_')],key=lambda o:o.name)
    top=bounds(steps[-1])[1].z
    for i,o in enumerate(steps):
        delta=top-(len(steps)-1-i)*.1201-bounds(o)[1].z
        for v in o.data.vertices:v.co.z+=delta
        changed.add(o['stage03Group']);log.append(dict(id=o.name,action='visual riser 0.1201; top landing preserved',delta=delta))
    left=find('LF_Road_Edge_West_Market_Walk_L');right=find('LF_Road_Edge_West_Market_Walk_R')
    axis=((bounds(left)[0]+bounds(left)[1])-(bounds(right)[0]+bounds(right)[1]));axis.z=0;axis.normalize()
    for o,sign in [(left,1),(right,-1)]:
        for v in o.data.vertices:v.co+=axis*(.68*sign)
        changed.add(o['stage03Group']);log.append(dict(id=o.name,action='local curb widening; road center and collision preserved'))
    for o in list(scene.objects):
        if o.name.startswith('S03P_Quest_Parchment'):
            for v in o.data.vertices:v.co.z-=.07
            changed.add(o['stage03Group'])
    seen={}
    for o in list(scene.objects):
        if o.type!='MESH' or not o.get('stage03Group') or o['stage03Group'] in ['collision','preview-instance']:continue
        if not o.data.uv_layers:uv(o);changed.add(o['stage03Group']);log.append(dict(id=o.name,action='add tiling UV'))
        o.data.calc_loop_triangles()
        if any(t.area<1e-10 for t in o.data.loop_triangles):
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
            bad=[f for f in bm.faces if f.calc_area()<1e-10]
            bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY');bm.to_mesh(o.data);bm.free()
            changed.add(o['stage03Group']);log.append(dict(id=o.name,action='remove zero area triangles',count=len(bad)))
        if o.name.startswith('S03P_'):
            key=(o['stage03Group'],tuple(m.name for m in o.data.materials),tuple(tuple(round(c,5) for c in v.co) for v in o.data.vertices))
            if key in seen:changed.add(o['stage03Group']);log.append(dict(id=o.name,action='remove duplicate',original=seen[key]));bpy.data.objects.remove(o,do_unlink=True)
            else:seen[key]=o.name
    wall=find('LF_Curtain_Wall_Staggered_Ashlar.001_sector_4')
    if wall:
        lo,hi=bounds(wall);rr=[math.hypot(v.co.x,v.co.y-1.565295) for v in wall.data.vertices]
        M['cameraWall']=dict(center=[0,-1.565295],radius=min(rr),minY=lo.z,maxY=hi.z+.5)

if phase=='finishing':
    remove('S03P_Forge_ChimneyIronBand')
    # The old smooth normals and untextured roof families made planar roofs look corrugated.
    for o in scene.objects:
        if o.type=='MESH' and o.name.startswith('LF2_') and any(t in o.name for t in ['_terra.','_slate.']):
            for p in o.data.polygons:p.use_smooth=False
            uv(o);changed.add(o['stage03Group']);log.append(dict(id=o.name,action='flat roof normals and tiled roof UV'))
    import numpy as np
    yy,xx=np.mgrid[0:1024,0:1024]/1024
    for family,base in [('terracotta',(.43,.18,.065)),('slate',(.17,.21,.23)),('rock',(.30,.32,.31)),('ground',(.27,.22,.12))]:
        rng=np.random.default_rng(412);noise=rng.random((1024,1024))
        shade=.9+.10*np.sin(xx*math.tau*13)*np.sin(yy*math.tau*11)+.07*(noise-.5)
        if family in ['terracotta','slate']:
            yc=yy*8;xc=xx*4+(np.floor(yc)%2)*.5
            edge=np.minimum.reduce([xc%1,1-xc%1,yc%1,1-yc%1]);shade*=.67+.33*np.clip(edge/.03,0,1)
        pixels=np.ones((1024,1024,4),dtype=np.float32)
        for channel,value in enumerate(base):pixels[:,:,channel]=value*shade
        im=bpy.data.images.new('Polish_'+family,width=1024,height=1024,alpha=False)
        im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(A/'textures'/(family+'-color.png'));im.file_format='PNG';im.save()
        M['textures'][family]=dict(color='textures/'+family+'-color.png',normal='textures/'+('red' if family in ['terracotta','slate'] else 'stone')+'-normal.png',orm='textures/shared-orm.png')
        mat=mats[family];bs=mat.node_tree.nodes.get('Principled BSDF');node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Base Color'].default_value=(1,1,1,1)
        for o in scene.objects:
            if o.type=='MESH' and mat in list(o.data.materials) and o.get('stage03Group') not in ['collision','preview-instance',None]:changed.add(o['stage03Group'])
    # Subdivision rounds the coarse shoreline boulders while retaining their bounds/placements.
    for o in scene.objects:
        if o.name.startswith('S03P_Shore_LayeredBasalt'):
            lo,hi=bounds(o);center=(lo+hi)/2;half=(hi-lo)/2
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=1,use_grid_fill=True)
            for v in bm.verts:
                q=v.co-center;q=Vector([q[i]/max(half[i],.01) for i in range(3)]).normalized()
                v.co=center+Vector([q[i]*half[i] for i in range(3)])
            bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free();uv(o);changed.add(o['stage03Group'])
    log.append(dict(id='roof/rock/ground families',action='four shared 1K color surfaces; existing shared normals/ORM'))

if phase=='lod-landmarks':
    changed.add('training-northwest')
    log.append(dict(id='training far LOD',action='retain complete training stations so shields/helmets never float after body culling'))

if phase=='surface-balance':
    # Review found dark terrain triangles after the new color-map treatment.
    # Restore the proven ground/rock palette; keep improved cliff silhouette and roof tiling.
    with bpy.data.libraries.load(str(ROOT/'source/LUMENFALL_Stage03_PrePolish.blend'),link=False) as (src,dst):
        dst.materials=['S03_ground','S03_rock']
    for family,original in zip(['ground','rock'],dst.materials):
        mat=mats[family];bs=mat.node_tree.nodes.get('Principled BSDF');old=original.node_tree.nodes.get('Principled BSDF')
        for link in list(bs.inputs['Base Color'].links):mat.node_tree.links.remove(link)
        bs.inputs['Base Color'].default_value=old.inputs['Base Color'].default_value;mat.diffuse_color=original.diffuse_color
        M['textures'].pop(family,None)
        for o in scene.objects:
            if o.type=='MESH' and mat in list(o.data.materials) and o.get('stage03Group') not in ['collision','preview-instance',None]:changed.add(o['stage03Group'])
        bpy.data.materials.remove(original)
    log.append(dict(id='ground/rock palette',action='restore baseline palette after runtime top-down contrast review; keep cliff geometry'))

# Export affected visual groups only, retaining collision and untouched sector payloads.
assert changed, 'Unknown or empty polish phase'
for o in list(scene.objects):
    if o.type=='MESH' and o.get('polishPhase')==phase:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
        color_variation(o,sum(ord(c) for c in o.name))
def export(id,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    # External texture cache remains external; avoid embedding the same PNG in every chunk.
    links=[]
    for mat in {m for o in objects for m in o.data.materials if m}:
        if not mat.use_nodes:continue
        for n in mat.node_tree.nodes:
            if n.type=='BSDF_PRINCIPLED':
                for socket in n.inputs:
                    for link in list(socket.links):links.append((mat.node_tree,link.from_socket,link.to_socket));mat.node_tree.links.remove(link)
    path=A/(id+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
    for tree,a,b in links:tree.links.new(a,b)
    return dict(id=id,url=path.name,triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),bytes=path.stat().st_size)
for a in M['chunks']+M['modules']:
    if a['id'] not in changed:continue
    oo=[o for o in scene.objects if o.type=='MESH' and o.get('stage03Group')==a['id']]
    a.update(export(a['id'],oo))
    if a.get('lods'):
        for level,lod in enumerate(a['lods'],1):
            keep=[o for o in oo if not (o.get('polishPhase') and level==2 and any(t in o.name for t in ['RoseSpoke','BrassSeam','Spire','Tracery','Mullion','Bottle','Herbs','ToolHandle','HammerHead','InkLine','WaxSeal']))
                  and not ('_iron.' in o.name)
                  and not (level==2 and o.name.startswith('LF3_') and not any(t in o.name for t in ['Fountain','Guardian','Warp','Crystal','Quest','Training']))]
            lod.update(export(lod['id'],keep))
M['phase']='reference-polish';M.setdefault('polish',{})[phase]=dict(objects=log,measurements=measure,groups=sorted(changed))
M['cameraVolumes']=[]
for o in scene.objects:
    if o.type!='MESH' or not o.get('stage03Group') or o.get('stage03Group') in ['collision','preview-instance']:continue
    if (o.name.startswith('LF2_') and any(t in o.name for t in ['_blue.','_red.','_terra.','_slate.','_canvas.','_green.'])) or (o.name.startswith('S03P_') and any(t in o.name for t in ['Roof','Canopy']) and not o['stage03Group'].startswith('module-')):
        lo,hi=bounds(o)
        if hi.z-lo.z>.2 and hi.x-lo.x>1:M['cameraVolumes'].append(dict(id=o.name,min=[lo.x,lo.z,-hi.y],max=[hi.x,hi.z,-lo.y]))
(A/'manifest.json').write_text(json.dumps(M,indent=2))
assert hashlib.sha256((A/M['collision']['url']).read_bytes()).hexdigest()==before_collision
bpy.ops.wm.save_as_mainfile(filepath=str(WORK))
print('POLISH_DONE',phase,sorted(changed),len(log),flush=True)
