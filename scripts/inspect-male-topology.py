import bpy,bmesh
bpy.ops.wm.open_mainfile(filepath='exports/characters/male-reconstructed/male-reconstructed.blend')
o=bpy.data.objects['Body_LP_body_0'];bm=bmesh.new();bm.from_mesh(o.data)
remaining=set(bm.verts)
while remaining:
    stack=[remaining.pop()];component=[]
    while stack:
        v=stack.pop();component.append(v)
        for e in v.link_edges:
            n=e.other_vert(v)
            if n in remaining:remaining.remove(n);stack.append(n)
    print('COMPONENT',len(component),'bounds',[(min(v.co[i] for v in component),max(v.co[i] for v in component))for i in range(3)])
print('boundaries',sum(e.is_boundary for e in bm.edges))
bm.free()
