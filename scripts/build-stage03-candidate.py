"""Reproducible, development-only derivative of the approved Stage03 source.
Run against source/LUMENFALL_Stage03_Working.blend, never the original.
Blender Z-up coordinates are baked into mesh data; glTF handles axis conversion.
"""
import bpy, bmesh, json, math, os, sys, hashlib, re
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.geometry import convex_hull_2d

ROOT = Path(__file__).resolve().parents[1] / 'dev-prototypes/mahkota-fajar-stage03-v1'
ASSETS = ROOT / 'assets'
PILOT = '--pilot' in sys.argv
assert Path(bpy.data.filepath).resolve() == (ROOT/'source/LUMENFALL_Stage03_Working.blend').resolve(), 'Working copy required'
provenance = json.loads((ROOT/'provenance.json').read_text(encoding='utf-8-sig'))
assert hashlib.sha256(Path(provenance['source']).read_bytes()).hexdigest().upper() == provenance['sha256']
S = 250/559
XFORM = Matrix.Scale(S,4) @ Matrix.Translation((0,3.5,0))
scene=bpy.context.scene
original=list(scene.objects)
out=bpy.data.collections.new('STAGE03_RUNTIME'); scene.collection.children.link(out)
groups={}; placements=[]; blockers=[]; records=[]; changes=[]

def point(x,y,z=0): return [round(x*S,6),round(z*S,6),round(-(y+3.5)*S,6)]
def bounds(o):
    p=[o.matrix_world@Vector(c) for c in o.bound_box]
    return Vector([min(v[i] for v in p) for i in range(3)]),Vector([max(v[i] for v in p) for i in range(3)])
def family(name):
    n=name.lower()
    if 'turquoise' in n:return 'water'
    if 'patinated' in n:return 'gold'
    for keys,f in [(['aether'],'magic'),(['ember','lantern'],'emissive'),(['water','river_water'],'water'),(['glass'],'glass'),(['foliage','meadow','moss'],'foliage'),(['bloom'],'flower'),(['soil','sand','dust'],'ground'),(['cobalt','royal_blue','guild_cobalt'],'blue'),(['oxblood'],'red'),(['terracotta'],'terracotta'),(['slate_roof','forge_slate'],'slate'),(['brass','gold'],'gold'),(['iron','steel','coal','ore'],'iron'),(['oak','wood','timber'],'wood'),(['plaster'],'plaster'),(['linen','canvas','parchment'],'fabric'),(['recess'],'dark'),(['flagstone','paving','inlay'],'paving'),(['cliff','boulder','basalt'],'rock')]:
        if any(k in n for k in keys): return f
    return 'stone'
COLORS={'stone':(.66,.56,.40),'paving':(.55,.49,.39),'rock':(.30,.34,.32),'wood':(.25,.115,.038),'plaster':(.75,.64,.46),'blue':(.027,.12,.32),'red':(.34,.065,.035),'terracotta':(.43,.18,.075),'slate':(.12,.16,.17),'gold':(.68,.43,.11),'iron':(.09,.10,.10),'fabric':(.82,.74,.53),'ground':(.32,.27,.14),'foliage':(.12,.27,.035),'flower':(.60,.30,.35),'water':(.035,.30,.36),'glass':(.03,.17,.22),'magic':(.035,.38,.85),'emissive':(1,.30,.035),'dark':(.035,.028,.019)}
mats={}
for f,c in COLORS.items():
    m=bpy.data.materials.new('S03_'+f); m.diffuse_color=(*c,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*c,1); bs.inputs['Roughness'].default_value=.78
    if f in ['gold','iron']: bs.inputs['Metallic'].default_value=.75; bs.inputs['Roughness'].default_value=.38
    if f in ['magic','emissive']: bs.inputs['Emission Color'].default_value=(*c,1); bs.inputs['Emission Strength'].default_value=2
    if f in ['water','glass']: bs.inputs['Roughness'].default_value=.22
    mats[f]=m

def mesh(name,verts,faces,mat,group):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.materials.append(mats[mat]); data.update()
    o=bpy.data.objects.new(name,data); out.objects.link(o); groups.setdefault(group,[]).append(o); return o
def box(name,center,size,mat,group):
    c=Vector(center); h=Vector(size)*.5
    verts=[c+Vector((x*h.x,y*h.y,z*h.z)) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,group)
def district(x,y):
    if y>90*S: return 'training-northwest' if x< -45*S else 'job-northeast' if x>55*S else 'civic-north'
    if x< -55*S: return 'inn-southwest' if y< -105*S else 'merchant-west'
    if x>65*S: return 'bank-residential-southeast' if y< -20*S else 'forge-east'
    return 'central-warp'
def materialize(o):
    old=list(o.data.materials); indices=[p.material_index for p in o.data.polygons];o.data.materials.clear()
    for m in old: o.data.materials.append(mats[family(m.name if m else '')])
    if not old: o.data.materials.append(mats['stone'])
    for p,i in zip(o.data.polygons,indices):p.material_index=min(i,len(o.data.materials)-1)
def uv(o):
    layer=o.data.uv_layers.new(name='RuntimeUV') if not o.data.uv_layers else o.data.uv_layers.active
    for p in o.data.polygons:
        a=max(range(3),key=lambda i:abs(p.normal[i])); axes=[i for i in range(3) if i!=a]
        for li in p.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            layer.data[li].uv=(co[axes[0]]/3,co[axes[1]]/3)
def simplify(o,target):
    tri=sum(len(p.vertices)-2 for p in o.data.polygons)
    if tri<=target:return
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    mod=o.modifiers.new('Runtime silhouette reduction','DECIMATE'); mod.ratio=max(.005,target/tri)
    bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
def add_block(id,points,minz,maxz):
    if len(points)<3:return
    ids=convex_hull_2d([Vector(p) for p in points]); poly=[[round(points[i][0],5),round(-points[i][1],5)] for i in ids]
    blockers.append(dict(id=id,kind='polygon',points=poly,minY=minz,maxY=maxz))

def components(data):
    parent=list(range(len(data.vertices)))
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for e in data.edges:
        a,b=e.vertices;parent[find(a)]=find(b)
    result={}
    for v in data.vertices:result.setdefault(find(v.index),[]).append(v.co.copy())
    return list(result.values())

def roof_envelope(o):
    """Replace disconnected tile boxes with continuous roof planes, preserving eaves.
    Decimating isolated tiles leaves holes; this reconstructs their actual top planes.
    Larger structural roof components (lanterns/cones) remain intact.
    """
    data=o.data;parent=list(range(len(data.vertices)))
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for e in data.edges:
        a,b=e.vertices;parent[find(a)]=find(b)
    comps={}
    for p in data.polygons:comps.setdefault(find(p.vertices[0]),[]).append(p)
    planes={};vertices=[];faces=[]
    for polys in comps.values():
        ids={i for p in polys for i in p.vertices}
        if len(ids)>16:
            mapping={i:len(vertices)+j for j,i in enumerate(ids)};vertices.extend(data.vertices[i].co.copy() for i in ids);faces.extend(tuple(mapping[i] for i in p.vertices) for p in polys);continue
        tops=[p for p in polys if p.normal.z>.15]
        if not tops:continue
        p=max(tops,key=lambda p:p.area);n=p.normal.copy();d=n.dot(p.center)
        key=tuple(round(v,2) for v in n)+(round(d/.12),)
        if key not in planes:planes[key]=(n,[])
        planes[key][1].extend(data.vertices[i].co.copy() for i in p.vertices)
    separated=[]
    for n,pts in planes.values():
        # Disjoint coplanar roofs (the two training shelters) must never be bridged.
        cells={}
        for p in pts:cells.setdefault(tuple(math.floor(v/1.5) for v in p),[]).append(p)
        while cells:
            seed=next(iter(cells));queue=[seed];cluster=[]
            while queue:
                key=queue.pop()
                if key not in cells:continue
                cluster.extend(cells.pop(key))
                for x in [-1,0,1]:
                    for y in [-1,0,1]:
                        for z in [-1,0,1]:
                            neighbor=(key[0]+x,key[1]+y,key[2]+z)
                            if neighbor in cells:queue.append(neighbor)
            separated.append((n,cluster))
    for n,pts in separated:
        axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
        hull=convex_hull_2d([Vector((p[axes[0]],p[axes[1]])) for p in pts])
        if len(hull)<3:continue
        d=max(n.dot(p) for p in pts);vv=[pts[i]+n*(d-n.dot(pts[i])) for i in hull]
        if (vv[1]-vv[0]).cross(vv[2]-vv[0]).dot(n)<0:vv.reverse()
        start=len(vertices);vertices.extend(vv);faces.append(tuple(range(start,len(vertices))))
    if faces:
        new=bpy.data.meshes.new(data.name+'_ContinuousRoof');new.from_pydata(vertices,[],faces);new.materials.append(data.materials[0]);new.update();o.data=new
        changes.append(dict(id=o.get('sourceId',o.name),change='continuous roof envelope replaces individual tile boxes',planes=len(planes)))

def wall_surface(o):
    # Continuous ring skin; ashlar relief belongs in the tiled stone material.
    # Source brick centers determine occupied arcs, preserving the gate opening.
    parts=components(o.data);origin=Vector((0,3.5*S,0))
    centers=[sum(p,Vector())/len(p)-origin for p in parts]
    angles=[math.atan2(p.y,p.x) for p in centers]
    pts=[v.co-origin for v in o.data.vertices]
    ri=min(math.hypot(p.x,p.y) for p in pts);ro=max(math.hypot(p.x,p.y) for p in pts)
    low=min(p.z for p in pts);high=max(p.z for p in pts);vv=[];ff=[]
    for i in range(256):
        a=i*math.tau/256;b=(i+1)*math.tau/256;mid=(a+b)/2
        if min(abs(math.atan2(math.sin(mid-t),math.cos(mid-t))) for t in angles)>.03:continue
        start=len(vv)
        vv.extend([origin+Vector((r*math.cos(t),r*math.sin(t),z)) for z in [low,high] for r,t in [(ri,a),(ro,a),(ro,b),(ri,b)]])
        ff.extend([tuple(start+j for j in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]])
    data=bpy.data.meshes.new('CurtainWall_ContinuousSkin');data.from_pydata(vv,[],ff);data.materials.append(mats['stone']);data.update();o.data=data
    changes.append(dict(id=o.get('sourceId',o.name),change='continuous wall skin, source occupied arcs preserved; ashlar relief moved to tiling material'))

# Reconstruct canopy modules at the actual source trunk locations.
trunks=bpy.data.objects.get('LF_Landscape_Tree_Trunks_Branches')
if trunks:
    for i,part in enumerate(components(trunks.data)):
        pts=[trunks.matrix_world@p for p in part];lo=Vector([min(p[a] for p in pts) for a in range(3)]);hi=Vector([max(p[a] for p in pts) for a in range(3)])
        if hi.z-lo.z<3 or max(hi.x-lo.x,hi.y-lo.y)>5:continue
        mid=(lo+hi)/2;pos=point(mid.x,mid.y,lo.z)
        if any(p['module']=='tree' and math.hypot(pos[0]-p['position'][0],pos[2]-p['position'][2])<1 for p in placements):continue
        placements.append(dict(id='source-tree-'+str(i),module='tree',position=pos,scale=[4.2,5.4,4.2],sector=int((math.atan2(mid.y,mid.x)+math.pi)/(math.pi/4))%8))
        blockers.append(dict(id='trunk-'+str(i),kind='circle',center=[pos[0],pos[2]],radius=.2,minY=pos[1],maxY=pos[1]+2.6))

tower_positions={}
for source in original:
    match=re.match(r'LF_Tower_(\d+)_Core$',source.name)
    if match:
        lo,hi=bounds(source);tower_positions[match[1]]=(lo+hi)/2
base_tower=tower_positions.get('01')
if base_tower:
    angle0=math.atan2(base_tower.y,base_tower.x)
    for id,p in tower_positions.items():
        placements.append(dict(id='tower-'+id,module='tower',position=point(p.x,p.y,0),scale=[1,1,1],rotation=math.atan2(p.y,p.x)-angle0,sector=int((math.atan2(p.y,p.x)+math.pi)/(math.pi/4))%8))

# Freeze hierarchy in independent working meshes. No source datablocks are edited.
for source in original:
    if source.type!='MESH' or source.hide_render:continue
    names=[c.name for c in source.users_collection]; n=source.name
    if any(c in ['LF_00_REFERENCE','LF_10_PLAN_ANNOTATIONS'] for c in names):continue
    if n.startswith('LF_City_Paving_Sector_') or n in ['LF_Central_Future_Landmark_Reserve','LF_Warp_Landmark_Reserved_Inset']:continue
    if n.startswith('LF_Plot_Flagstones_'):continue # Tiling replaces loose stones; keep the structural court below.
    if n in ['LF_Central_Plaza_Concentric_Paving','LF_Warp_Plaza_Outer_Paving','LF_Warp_Plaza_Upper_Paving']:continue
    if 'LF3_MATERIAL_POLISH' in names:continue
    if any(k in n for k in ['Tree_Crowns','Foliage_Edge_Detail','Tree_Trunks_Branches']):continue
    tower_match=re.match(r'LF_Tower_(\d+)_',n)
    if tower_match and tower_match[1]!='01':continue
    lo,hi=bounds(source); mid=(lo+hi)/2
    vegetation=('LF3_VEGETATION' in names or any(k in n for k in ['Tree_Crown','Tree_Trunk','Tree_Canop','Foliage','Landscape_Bush']))
    if vegetation and max(hi.x-lo.x,hi.y-lo.y)<35:
        kind='tree' if hi.z-lo.z>5 else 'shrub'
        pos=point(mid.x,mid.y,lo.z); size=[(hi.x-lo.x)*S,(hi.z-lo.z)*S,(hi.y-lo.y)*S]
        placements.append(dict(id=n,module=kind,position=pos,scale=size,sector=int((math.atan2(mid.y,mid.x)+math.pi)/(math.pi/4))%8))
        if kind=='tree': blockers.append(dict(id=n,kind='circle',center=[pos[0],pos[2]],radius=max(.12,min(size[0],size[2])*.065),minY=pos[1],maxY=pos[1]+2.5))
        continue
    o=bpy.data.objects.new(n,source.data.copy()); out.objects.link(o)
    o.data.transform(XFORM@source.matrix_world); o.data.update(); o['sourceId']=n
    group='shell' if any(c in ['LF_01_TERRAIN','LF_02_CIRCULATION','LF_05_DISTRICT_PLOTS','LF_09_LANDSCAPE'] for c in names) else district(mid.x*S,(mid.y+3.5)*S)
    if any(c in ['LF_06_CURTAIN_WALL','LF_07_WALL_TOWERS','LF_08_MAIN_GATE'] for c in names):group='walls'
    if tower_match and base_tower:
        o.data.transform(Matrix.Translation((-base_tower.x*S,-(base_tower.y+3.5)*S,0)));group='module-tower'
    materialize(o)
    if n.startswith('LF_Reserved_Stone_Court_'):
        o.data.materials.clear();o.data.materials.append(mats['paving'])
        for p in o.data.polygons:p.material_index=0
    if 'Curtain_Wall_Staggered_Ashlar' in n:wall_surface(o)
    if n.startswith('LF2_') and len(o.data.polygons)>1000 and all(m.name in ['S03_blue','S03_red','S03_terracotta','S03_slate'] for m in o.data.materials):roof_envelope(o)
    if n.startswith('LF2_') or group in ['walls','module-tower']:pass # Preserve structural faces; decimating disconnected masonry makes holes.
    elif vegetation: simplify(o,1600)
    elif 'blue' in n or 'terra' in n or 'red' in n: simplify(o,2500)
    elif 'Ashlar' in n: simplify(o,14000)
    else:simplify(o,2800)
    if 'Training_Dummy' in n or 'Training_Target' in n or 'Outdoor_Table' in n:
        target=2.4 if 'Dummy' in n else 2.6 if 'Target' in n else .9
        pts=[v.co for v in o.data.vertices]; zmin=min(p.z for p in pts); height=max(p.z for p in pts)-zmin
        for v in o.data.vertices:v.co.z=zmin+(v.co.z-zmin)*target/height
        changes.append(dict(id=n,change='height',target=target))
    uv(o); groups.setdefault(group,[]).append(o)
    if 'Training_Yard_Timber_Rails' in n or 'Training_Yard_Fence_Posts' in n or 'Residential_Low_Garden_Fence' in n:
        for i,part in enumerate(components(o.data)):
            add_block(n+str(i),[(p.x,p.y) for p in part],min(p.z for p in part),max(p.z for p in part))
    if any(k in n for k in ['Outdoor_Table','Table_Seat','Display_Table','Apothecary_Counter','Forge_Anvil','Delivery_Cart']):
        p=[v.co for v in o.data.vertices];add_block(n,[(v.x,v.y) for v in p],min(v.z for v in p),max(v.z for v in p))
    if n.startswith('LF2_') and n.endswith('_stone') and any(k in n for k in ['Grand_Hall_stone','Job_Change_Hall_stone','Job_Hall_East_Wing_stone','Merchant_stone','Potion_Shop_stone','Weapon_Shop_stone','Armor_Shop_stone','Storage_Bank_stone','Inn_Tavern_stone','Residence_A_stone','Residence_B_stone','Blacksmith_stone']):
        pts=[v.co for v in o.data.vertices]; zmin=min(v.z for v in pts);zmax=max(v.z for v in pts)
        base=[(v.x,v.y) for v in pts if v.z<zmin+.35]
        add_block(n,base,zmin,zmax)
        records.append(dict(id=n,group=group,min=[min(v[i] for v in pts) for i in range(3)],max=[max(v[i] for v in pts) for i in range(3)]))

# Ground surface replaces individual paving stones while retaining source curb/route geometry.
radius=235*S; z=.32*S
verts=[(0,3.5*S,z)]+[(radius*math.cos(i*math.tau/128),3.5*S+radius*math.sin(i*math.tau/128),z) for i in range(128)]
paving=mesh('S03_Paving_Surface',verts,[(0,i+1,(i+1)%128+1) for i in range(128)],'paving','shell');uv(paving)
for name,cx,cy,r,height in [('Central_Plaza_Concentric',0,-5,54,.40),('Warp_Plaza_Outer',0,-155,34,.48),('Warp_Plaza_Upper',0,-155,19.2,1.51)]:
    center=Vector((cx*S,(cy+3.5)*S,height*S));vv=[center]+[center+Vector((r*S*math.cos(i*math.tau/96),r*S*math.sin(i*math.tau/96),0)) for i in range(96)]
    o=mesh('S03_'+name,vv,[(0,i+1,(i+1)%96+1) for i in range(96)],'paving','central-warp');uv(o)
ground=[]
for o in [paving]+[o for oo in groups.values() for o in oo if any(k in o.name for k in ['Reserved_Stone_Court','Training_Yard_Compacted','Plot_04','Plaza_Concentric','Warp_Plaza_Step','S03_Warp_Plaza'])]:
    faces=[tuple(p.vertices) for p in o.data.polygons if p.normal.z>.6]
    if faces:ground.append(mesh('GROUND_'+o.name,[v.co.copy() for v in o.data.vertices],faces,'paving','collision'))
# Broad approach ramp, source stair rise/width preserved after scale.
ramp=mesh('GROUND_Guild_Approach_Ramp',[(-17.5*S,116*S,.32*S),(17.5*S,116*S,.32*S),(17.5*S,138*S,3.47*S),(-17.5*S,138*S,3.47*S)],[(0,1,2,3)],'paving','collision');ground.append(ramp)
# Wall boundary makes the external bridge and water unreachable; fountain and warp pedestals block locally.
blockers.extend([dict(id='fountain',kind='circle',center=[0,1.5*S],radius=14.6*S,minY=0,maxY=8),dict(id='warp-pedestal',kind='circle',center=[0,151.5*S],radius=8.2*S,minY=0,maxY=12)])
gate=box('S03_Closed_Gate', (0,-238*S,5*S),(18*S,1.1,10*S),'wood','walls')
add_block('closed-gate',[(-9*S,-239*S),(9*S,-239*S),(9*S,-237*S),(-9*S,-237*S)],0,10*S)

# One normalized mesh per foliage module. Runtime instances are partitioned into sectors.
for kind in ['tree','shrub']:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.5)
    o=bpy.context.object;o.name='S03_Module_'+kind
    for c in list(o.users_collection):c.objects.unlink(o)
    out.objects.link(o)
    for v in o.data.vertices:
        v.co.z=v.co.z*.65+.67 if kind=='tree' else v.co.z+.5
    o.data.materials.append(mats['foliage']);uv(o);groups.setdefault('module-'+kind,[]).append(o)
    if kind=='tree':box('S03_Tree_Trunk',(0,0,.25),(.09,.09,.5),'wood','module-tree')

# Refinements are confined to source footprints and keep all original zone centers.
if not PILOT:
    for x in [-32,32]:
        for y in [147,165,182]:
            box('S03_Guild_Buttress', (x*S,(y+3.5)*S,16*S),(2*S,3*S,28*S),'stone','civic-north')
            box('S03_Guild_Gold_Cap',(x*S,(y+3.5)*S,30.2*S),(2.4*S,3.4*S,.6*S),'gold','civic-north')
    for x in [-7,7]:box('S03_Guild_Portal_Pier',(x*S,146*S,10*S),(1.3*S,2*S,17*S),'stone','civic-north')
    # Reduce the original monumental board around its own center; readable board added at player height.
    for o in groups.get('central-warp',[]):
        if 'Quest' in o.name:
            pivot=Vector((0,81.5*S,1.07*S))
            for v in o.data.vertices:v.co=pivot+(v.co-pivot)*.48
    box('S03_Quest_Readable_Panel',(0,78*S,1.8),(4.8,.12,1.2),'fabric','central-warp')
    for x in [-2.7,2.7]:box('S03_Quest_Lamp',(x,78*S,2.7),(.22,.22,.4),'emissive','central-warp')
    changes.append(dict(id='quest-board',change='readable panel center 1.8 units; structure scaled locally'))
    # Closed exterior entrances: full player-sized door leaves and raised frames.
    # Derive each position/orientation from its existing door geometry, never from a new zone layout.
    for source in original:
        if not(source.type=='MESH' and source.name.startswith('LF2_') and source.name.endswith('_wood')):continue
        if any(k in source.name for k in ['Dormer','Wing','Training']):continue
        candidates=[]
        for part in components(source.data):
            low=Vector([min(p[a] for p in part) for a in range(3)]);high=Vector([max(p[a] for p in part) for a in range(3)])
            if high.z-low.z>3 and high.x-low.x>1:candidates.append((low,high))
        if not candidates:continue
        low,high=max(candidates,key=lambda pair:(pair[1].z-pair[0].z)*(pair[1].x-pair[0].x))
        center=source.matrix_world@Vector(((low.x+high.x)/2,low.y-.18,low.z))
        center=XFORM@center;yaw=source.matrix_world.to_euler().z
        width=max(1.8,(high.x-low.x)*S);height=max(3,(high.z-low.z)*S)
        group=district(center.x,center.y)
        for suffix,offset,size,mat in [('door',(0,0,height/2),(width,.1,height),'wood'),('left',(-width/2-.16,.03,height/2),(.28,.32,height+.3),'stone'),('right',(width/2+.16,.03,height/2),(.28,.32,height+.3),'stone'),('lintel',(0,.03,height+.13),(width+.6,.35,.28),'gold')]:
            obj=box('S03_Entrance_'+source.name+'_'+suffix,offset,size,mat,group)
            obj.data.transform(Matrix.Translation(center)@Matrix.Rotation(yaw,4,'Z'));uv(obj)
        changes.append(dict(id=source.name,change='closed entrance and frame',doorHeight=height,doorWidth=width))
    # Reference-derived portal columns and gold cornice on the domed Job Hall.
    for x in [116,122,128,134]:
        box('S03_Job_Entrance_Column',(x*S,90*S,8*S),(1.2*S,1.8*S,14*S),'stone','job-northeast')
        box('S03_Job_Column_Capital',(x*S,90*S,15.3*S),(2*S,2.3*S,.6*S),'gold','job-northeast')
    box('S03_Job_Portal_Cornice',(125*S,90*S,16*S),(21*S,2.5*S,.8*S),'stone','job-northeast')
    # Service identity signs are visual symbols only; no NPC or service logic is created.
    signs=[('Merchant',-180,12,'gold'),('Potion',-100,14,'magic'),('Weapon',-178,-29,'iron'),('Armor',-101,-37,'gold'),('Bank',145,-95,'gold'),('Inn',-109,-165,'terracotta')]
    for label,x,y,color in signs:
        center=Vector((x*S,(y+3.5)*S,3.8));group=district(center.x,center.y)
        box('S03_'+label+'_Signboard',center,(1.35,.15,.85),'wood',group)
        if label=='Weapon':
            for angle in [-.5,.5]:
                blade=box('S03_Weapon_Sign_Sword',(0,0,0),(.1,.07,.75),'iron',group);blade.data.transform(Matrix.Translation(center+Vector((0,-.1,0)))@Matrix.Rotation(angle,4,'Y'))
        else:
            mesh('S03_'+label+'_Sign_Emblem',[center+Vector((x,-.1,z)) for x,z in [(-.32,.22),(.32,.22),(.27,-.15),(0,-.34),(-.27,-.15)]],[(0,1,2,3,4)],color,group)
        changes.append(dict(id=label,change='reference palette service emblem and facade identity'))
    # Hearth plane and turquoise fountain surface remain separately named for review.
    box('S03_Forge_Heat',(178*S,4*S,2.0),(2.1,.12,1.0),'emissive','forge-east')
    waterverts=[(0,-1.5*S,1.2)]+[(5.2*math.cos(i*math.tau/64),-1.5*S+5.2*math.sin(i*math.tau/64),1.2) for i in range(64)]
    mesh('S03_Fountain_Water_Surface',waterverts,[(0,i+1,(i+1)%64+1) for i in range(64)],'water','central-warp')

# Source scene is retained in an unlinked collection in the derivative, not exported.
# Partition curtain walls spatially instead of making a single always-visible ring mesh.
for o in groups.pop('walls',[]):
    parts={}
    for p in o.data.polygons:
        center=sum((o.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
        sector=int((math.atan2(center.y-3.5*S,center.x)+math.pi)/(math.pi/4))%8
        parts.setdefault(sector,[]).append(p)
    for sector,faces in parts.items():
        used=sorted({i for p in faces for i in p.vertices});mapping={v:i for i,v in enumerate(used)}
        obj=mesh(o.name+'_sector_'+str(sector),[o.data.vertices[i].co.copy() for i in used],[tuple(mapping[i] for i in p.vertices) for p in faces],'stone','wall-'+str(sector))
        obj.data.materials.clear()
        for m in o.data.materials:obj.data.materials.append(m)
        for p,q in zip(obj.data.polygons,faces):p.material_index=q.material_index
        uv(obj)
    bpy.data.objects.remove(o,do_unlink=True)
for c in list(scene.collection.children):
    if c!=out:scene.collection.children.unlink(c)
for o in list(scene.objects):o.select_set(False)

def export(group,objects):
    for o in list(bpy.context.selected_objects):o.select_set(False)
    for o in objects:o['stage03Group']=group;o.select_set(True)
    if not objects:return None
    bpy.context.view_layer.objects.active=objects[0]
    path=ASSETS/(group+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_extras=True,export_yup=True,export_apply=False)
    return dict(id=group,url=path.name,triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),bytes=path.stat().st_size)

chunks=[];modules=[]
for g,oo in groups.items():
    if g=='collision':continue
    item=export(g,oo)
    if g.startswith('module-'):modules.append(dict(**item,kind=g[7:]))
    else:chunks.append(item)
collision=export('collision',ground)
anchors=[]
for id,kind,x,y in [('spawn','spawn',0,-27),('central','route',0,-27),('warp','arrival',0,-132),('guild','service',0,134),('merchant','service',-180,3),('training','service',-119,99),('job','service',118,72),('forge','service',130,-10),('bank','service',144,-104),('inn','service',-108,-177),('residential','service',104,-176),('quest','service',0,69),('potion','service',-100,8),('weapon','service',-178,-77),('armor','service',-101,-76)]:
    anchors.append(dict(id=id,kind=kind,position=point(x,y,.32),facing=0,radius=2.5))
manifest=dict(version=1,mapId='lumenfall-kingdom-capital-stage03-v1',phase='pilot' if PILOT else 'refined',bounds=dict(min=[-125,-125],max=[125,125]),transform=dict(scale=S,center=[0,-3.5],baked=True,rootScale=1),chunks=chunks,modules=modules,placements=placements,collision=collision,blockers=blockers,boundary=dict(center=[0,-3.5*S],radius=232*S),anchors=anchors,records=records,changes=changes,materialFamilies=list(COLORS),sourceSha256=provenance['sha256'])
(ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/LUMENFALL_Stage03_Runtime_Working.blend'))
assert hashlib.sha256(Path(provenance['source']).read_bytes()).hexdigest().upper()==provenance['sha256']
print('STAGE03_DONE',json.dumps(dict(chunks=len(chunks),placements=len(placements),blockers=len(blockers),triangles=sum(c['triangles'] for c in chunks),bytes=sum(c['bytes'] for c in chunks))))
