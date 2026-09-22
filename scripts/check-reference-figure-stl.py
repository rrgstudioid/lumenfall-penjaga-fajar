"""Independently re-import the actual STL and validate its printable shell."""
import bpy,bmesh,os,json,math
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'exports','stl','astra-reference-figure')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=os.path.join(OUT,'astra-reference-150mm.stl'),forward_axis='Y',up_axis='Z')
obj=bpy.context.object;bm=bmesh.new();bm.from_mesh(obj.data)
assert all(math.isfinite(c)for v in bm.verts for c in v.co)
boundary=sum(e.is_boundary for e in bm.edges)
nonmanifold=sum(not e.is_manifold for e in bm.edges)
degenerate=sum(f.calc_area()<1e-10 for f in bm.faces)
remaining=set(bm.verts);sizes=[]
while remaining:
    todo=[remaining.pop()];size=0
    while todo:
        v=todo.pop();size+=1
        for e in v.link_edges:
            other=e.other_vert(v)
            if other in remaining:remaining.remove(other);todo.append(other)
    sizes.append(size)
bounds=[(min(v.co[i]for v in bm.verts),max(v.co[i]for v in bm.verts))for i in range(3)]
height=bounds[2][1]-bounds[2][0];volume=bm.calc_volume(signed=True)
report={'file':'astra-reference-150mm.stl','bytes':os.path.getsize(os.path.join(OUT,'astra-reference-150mm.stl')),'triangles':len(bm.faces),'dimensionsMillimeters':[b-a for a,b in bounds],'heightMillimeters':height,'boundaryEdges':boundary,'nonManifoldEdges':nonmanifold,'degenerateTriangles':degenerate,'connectedComponents':len(sizes),'signedVolumeMm3':volume,'finiteCoordinates':True}
print('STL_VALIDATION',json.dumps(report),flush=True)
assert boundary==0 and nonmanifold==0 and degenerate==0,report
assert len(sizes)==1 and volume>0 and abs(height-150)<.001,report
with open(os.path.join(OUT,'validation.json'),'w')as f:json.dump(report,f,indent=2)
bm.free()
