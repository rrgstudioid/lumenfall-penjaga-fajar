"""Scoped owner hair corrections, executed inside ingest-owner-male.py.
Uses the existing Blender context, source UVs and canonical head surface.
"""

def mesh_parts(bm):
    remaining = set(bm.verts)
    parts = {}
    while remaining:
        seed = remaining.pop()
        part = {seed}
        todo = [seed]
        while todo:
            v = todo.pop()
            for e in v.link_edges:
                q = e.other_vert(v)
                if q in remaining:
                    remaining.remove(q)
                    part.add(q)
                    todo.append(q)
        count = len({f for v in part for f in v.link_faces})
        parts[count] = list(part)
    return parts

def repair_braids(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-06)
    original_triangles=sum(len(f.verts)-2 for f in bm.faces)
    parts = mesh_parts(bm)
    assert all(n in parts for n in [44,440,304,52,484,308,34,430]), 'The supplied cornrow topology has changed'
    added = 0
    uv = bm.loops.layers.uv.active
    # Continue the two split rear rows into their own terminal and hanging
    # sections; nearby parallel rows must not be joined by nearest distance.
    # Reuse source braided beads and UVs for the small overlapping connectors.
    for bead_count, upper_count, lower_count in [(44, 440, 304), (52, 484, 308)]:
        bead = parts[bead_count]
        center = sum((v.co for v in bead), Vector()) / len(bead)
        positions = np.array([list(v.co - center) for v in bead])
        _, _, basis = np.linalg.svd(positions, full_matrices=False)
        axis = Vector(basis[0])
        long_extent = max(((v.co - center).dot(axis) for v in bead)) - min(((v.co - center).dot(axis) for v in bead))
        faces = {f for v in bead for f in v.link_faces}
        data = [([(l.vert.co - center).copy() for l in f.loops], [l[uv].uv.copy() for l in f.loops]) for f in faces]
        for neighbor in [parts[upper_count], parts[lower_count]]:
            closest = sorted(neighbor, key=lambda v: (v.co - center).length)[:6]
            endpoint = sum((v.co for v in closest), Vector()) / len(closest)
            direction = (endpoint - center).normalized()
            distance = (endpoint - center).length
            count = max(1, math.ceil(distance / 0.022))
            step = distance / count
            rotation = axis.rotation_difference(direction)
            for i in range(1, count + 1):
                pos = center + direction * (step * i)
                stretch = max(0.7, (step + 0.012) / long_extent)
                for points, uvs in data:
                    verts = []
                    for p in points:
                        axial = axis * p.dot(axis)
                        verts.append(bm.verts.new(pos + rotation @ (p + axial * (stretch - 1))))
                    face = bm.faces.new(verts)
                    for l, t in zip(face.loops, uvs):
                        l[uv].uv = t
                    added += 1
    bead = parts[34]
    neighbor = parts[430]
    a, b = min(((a, b) for a in bead for b in neighbor), key=lambda pair: (pair[0].co - pair[1].co).length)
    delta = b.co - a.co
    delta += delta.normalized() * 0.006
    for v in bead:
        v.co += delta
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-06)
    # Close the small cuts left in three braid surfaces by removing the display
    # scalp, plus the two open hanging ends. Do not fill a scalp-sized boundary.
    boundary = [e for e in bm.edges if e.is_boundary]
    old_uv = {v: sum((l[uv].uv for l in v.link_loops), Vector((0, 0))) / len(v.link_loops) for v in bm.verts if v.link_loops}
    filled = bmesh.ops.holes_fill(bm, edges=boundary, sides=12)['faces']
    for f in filled:
        for l in f.loops:
            l[uv].uv = old_uv[l.vert]
    bmesh.ops.triangulate(bm, faces=filled)
    added = sum((len(f.verts) - 2 for f in bm.faces)) - original_triangles
    for f in bm.faces:
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data)
    bm.free()
    for _ in range(3):
        fit_scalp(o, 0.003, head, sample_faces=True)
    return added

def ponytail_infill(o, messy=False, tied=False):
    o.data.update()
    mesh = o.data
    bm=bmesh.new();bm.from_mesh(mesh)
    base_indices={v.index for v in (bm.verts if messy else mesh_parts(bm)[3431 if tied else 1063])}
    base_faces=[p for p in mesh.polygons if all(j in base_indices for j in p.vertices)]
    bm.free()
    # Check the swept base itself. The tail can hide a gap from one ray while
    # leaving the same scalp visible from a side view.
    hair_surface = BVHTree.FromPolygons([v.co for v in mesh.vertices], [p.vertices[:] for p in base_faces])
    # Keep repair UVs within one source hair island. Interpolating nearest UVs
    # from unrelated atlas islands creates visible cross-hatched triangles.
    source_uv=mesh.uv_layers.active.data
    triangles=[[source_uv[j].uv.copy() for j in p.loop_indices]for p in base_faces]
    tex=max(triangles,key=lambda t:abs((t[1]-t[0]).cross(t[2]-t[0])))
    uv_center=sum(tex,Vector((0,0)))/3
    uv_radius=min(abs((tex[(j+1)%3]-tex[j]).cross(uv_center-tex[j]))/(tex[(j+1)%3]-tex[j]).length for j in range(3))*.45

    def hairline(q):
        if tied:return 1.70
        angle = abs(math.atan2(q.x, q.y - 0.025))
        return 1.59 + 0.145 * smooth(0.8, 1.8, angle) + 0.1 * smooth(1.7, 2.7, angle)
    allowed = {p.index for p in body.data.polygons if p.center.z>hairline(p.center)-.012 and (not messy or p.center.y>-.065) and all(v.co.z>1.55 and abs(v.co.x)<.235 for v in (body.data.vertices[j]for j in p.vertices))}
    if tied:
        # Anatomical right is -X on the canonical rig. Repair only the band
        # above that ear, plus the exposed lower rear beneath the side tie.
        # Keep the face, ears and upper crown outside the infill region.
        allowed={i for i in allowed if body.data.polygons[i].center.x<-.06 and body.data.polygons[i].center.z<1.80 and -.135<body.data.polygons[i].center.y<.165 and all(body.data.vertices[j].co.z>1.675 and abs(body.data.vertices[j].co.x)<.185 for j in body.data.polygons[i].vertices)}
        for p in body.data.polygons:
            angle=abs(math.atan2(p.center.x,p.center.y-.025))
            nape=1.565+.115*smooth(.85,1.55,angle)
            if p.center.y>.06 and nape-.012<p.center.z<1.79 and all(body.data.vertices[j].co.z>1.54 and abs(body.data.vertices[j].co.x)<.19 for j in p.vertices):
                allowed.add(p.index)
    needed = set()
    for i in sorted(allowed):
        p = body.data.polygons[i]
        points = [body.data.vertices[j].co for j in p.vertices]
        for q in [sum(points, Vector()) / 3] + [(points[j] + points[(j + 1) % 3]) / 2 for j in range(3)]:
            direction = (q - head_center).normalized()
            hit = hair_surface.ray_cast(head_center + direction, -direction, 2)[0]
            uncovered = hit is None or (hit - head_center).length < (q - head_center).length + 0.003
            if messy or tied:
                # A downward radial ray can hit a long tip while the scalp is
                # still exposed in a level rear or rear-quarter view.
                azimuth=math.atan2(q.x,q.y-.025)
                for offset in [-.45,0,.45]:
                    d=Vector((math.sin(azimuth+offset),math.cos(azimuth+offset),0))
                    if p.normal.dot(d)<.15:continue
                    hit=hair_surface.ray_cast(q+d*.8,-d,1)[0]
                    if hit is None or (hit-q).dot(d)<.003:uncovered=True
            if uncovered:
                needed.add(i)
                break
    vertices = {j for i in needed for j in body.data.polygons[i].vertices}
    needed |= {i for i in allowed if any((j in vertices for j in body.data.polygons[i].vertices))}
    bm = bmesh.new()
    bm.from_mesh(mesh)
    uv = bm.loops.layers.uv.active
    infill_tag=bm.verts.layers.int.new('owner_tied_infill') if tied else None
    added = {}
    for i in sorted(needed):
        p = body.data.polygons[i]
        vs = []
        uvs = []
        for j in p.vertices:
            q = body.data.vertices[j].co.copy()
            q += (q - head_center).normalized() * (0.006 if messy else .004 if tied and q.y>.06 and q.z<1.79 else 0.002)
            if j not in added:
                added[j] = bm.verts.new(q)
            vs.append(added[j])
            angle=math.atan2(q.x,q.y-.025)/math.pi
            uvs.append(uv_center+Vector((angle*uv_radius,(max(1.55,min(1.95,q.z))-1.75)*5*uv_radius)))
        f = bm.faces.new(vs)
        f.smooth = True
        for l, t in zip(f.loops, uvs):
            l[uv].uv = t
    if tied:
        # A body-face selection alone leaves a stepped neckline. Seat only
        # its lower exposed boundary along a continuous nape curve; the
        # upper edges remain overlapped beneath the original swept locks.
        for v in added.values():
            q=v.co.copy();angle=abs(math.atan2(q.x,q.y-.025))
            nape=1.565+.115*smooth(.85,1.55,angle)
            if q.y>.06 and q.z<nape+.035 and any(e.is_boundary for e in v.link_edges):
                q.z=nape
                hit=head.ray_cast(q+Vector((0,.5,0)),Vector((0,-1,0)),1)[0]
                if hit is not None:
                    v.co=hit+(hit-head_center).normalized()*.0015
        for v in added.values():v[infill_tag]=1
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return len(needed)

def fit_messy(o):
    # Seat the back and side locks closer to the supplied skull, without
    # stretching their tips into a curtain or changing the front/crown spikes.
    for v in o.data.vertices:
        blend=smooth(-.12,.06,v.co.y)*(1-smooth(1.92,2.07,v.co.z))
        v.co.x*=1-.06*blend
        v.co.y=.025+(v.co.y-.025)*(1-.12*blend)
    for _ in range(3):fit_scalp(o,.004,head,sample_faces=True)
    # Reduce the excess radius above the actual skull, rather than uniformly
    # scaling through the roots. Retain 72% of each lock's outward thickness
    # and spike relief; the scalp contact and characteristic directions stay.
    for v in o.data.vertices:
        d=v.co-head_center;direction=d.normalized()
        hit=head.ray_cast(head_center+direction,-direction,2)[0]
        if hit is not None:
            excess=max(0,d.length-(hit-head_center).length-.004)
            v.co-=direction*(excess*.28)
    for _ in range(3):fit_scalp(o,.003,head,sample_faces=True)
    # Fill only actual rear/side gaps between this hairstyle's locks. The
    # patches follow the skull and use its own source strand atlas, not a
    # shared basic hair mesh. The front hairline is intentionally untouched.
    return ponytail_infill(o,messy=True)

def fit_long_tied(o):
    # Extend the original swept base down over the right temple. The long
    # fringe, side tie and hanging strands keep their supplied shape/position.
    bm=bmesh.new();bm.from_mesh(o.data)
    parts=mesh_parts(bm)
    assert 3431 in parts, 'The supplied long tied base topology has changed'
    for v in parts[3431]:
        x,y,z=v.co
        blend=smooth(.07,.16,-x)*smooth(-.15,-.06,y)*(1-smooth(.12,.20,y))*(1-smooth(1.80,1.94,z))*smooth(1.64,1.73,z)
        v.co.z-=.055*blend
        # Continue the tied-side swept roots toward the nape. The free rear
        # locks and separate knot/tail retain their length and silhouette.
        rear=smooth(-.025,.09,x)*smooth(.035,.13,y)*(1-smooth(1.78,1.94,z))*smooth(1.60,1.69,z)
        v.co.z-=.065*rear
    # Bring the underside of that extended base onto the skull. Move nearby
    # inner/outer vertices together so the source strand relief is preserved.
    part=parts[3431];directions=[];gaps=[];tree=KDTree(len(part))
    for i,v in enumerate(part):
        d=v.co-head_center;direction=d.normalized()
        hit=head.ray_cast(head_center+direction,-direction,2)[0]
        directions.append(direction);gaps.append(d.length-(hit-head_center).length if hit else 0)
        tree.insert(direction,i)
    tree.balance()
    for i,v in enumerate(part):
        x,y,z=v.co
        inner=min(gaps[j] for _,j,_ in tree.find_range(directions[i],.14))
        blend=smooth(-.025,.09,x)*smooth(.04,.13,y)*(1-smooth(1.80,1.94,z))*smooth(1.57,1.69,z)
        v.co-=directions[i]*min(.04,max(0,inner-.004))*blend
    bm.to_mesh(o.data);bm.free();o.data.update()
    for _ in range(3):fit_scalp(o,.004,head,sample_faces=True)
    return ponytail_infill(o,tied=True)

def fit_hair_parts(o,margin,surface):
    # The small infill can need more clearance after decimation than the
    # original locks. Do not let its offset field inflate the entire hairstyle.
    bm=bmesh.new();bm.from_mesh(o.data);remaining=set(bm.verts);parts=[]
    while remaining:
        seed=remaining.pop();part={seed};todo=[seed]
        while todo:
            v=todo.pop()
            for edge in v.link_edges:
                q=edge.other_vert(v)
                if q in remaining:remaining.remove(q);part.add(q);todo.append(q)
        parts.append({v.index for v in part})
    bm.free()
    for part in parts:
        for _ in range(3):fit_scalp(o,margin,surface,sample_faces=True,vertex_indices=part)

def decimate_tied_base(o,budget,lod,surface):
    # Keep the small, close-fitting patch at full resolution. Decimating it
    # together with the long locks makes large flat faces that require an
    # excessive outward offset and produce a thick artificial nape edge.
    bm=bmesh.new();bm.from_mesh(o.data)
    tag=bm.verts.layers.int['owner_tied_infill'];uv=bm.loops.layers.uv.active
    patch_verts=[v for v in bm.verts if v[tag]]
    positions={v.index:v.co.copy() for v in patch_verts}
    patch=[[(l.vert.index,l[uv].uv.copy()) for l in f.loops] for f in bm.faces if all(v[tag] for v in f.verts)]
    bmesh.ops.delete(bm,geom=patch_verts,context='VERTS')
    bm.to_mesh(o.data);bm.free()
    n=len(o.data.polygons)
    modifier=o.modifiers.new('LOD','DECIMATE')
    modifier.ratio=(budget-len(patch))/n;modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    fit_hair_parts(o,[0,.004,.006,.006][lod],surface)
    bm=bmesh.new();bm.from_mesh(o.data)
    uv=bm.loops.layers.uv.active;deform=bm.verts.layers.deform.verify()
    head_group=o.vertex_groups['head'].index
    verts={i:bm.verts.new(co) for i,co in positions.items()}
    for v in verts.values():v[deform][head_group]=1
    for face in patch:
        f=bm.faces.new([verts[i]for i,_ in face]);f.smooth=True
        for loop,(_,tex) in zip(f.loops,face):loop[uv].uv=tex
    bm.verts.index_update();indices={v.index for v in verts.values()}
    bm.to_mesh(o.data);bm.free();o.data.update()
    for _ in range(3):fit_scalp(o,[0,.002,.003,.004][lod],surface,sample_faces=True,vertex_indices=indices)

def fit_ponytail(o):
    # Refit the supplied swept-back base; leave the tied tail and bangs intact.
    bm=bmesh.new();bm.from_mesh(o.data)
    parts=mesh_parts(bm)
    assert 1063 in parts, 'The supplied ponytail base topology has changed'
    part=parts[1063]
    for v in part:
        x,y,z=v.co
        floor=1.58+.12*(1-smooth(.01,.12,y))
        blend=smooth(-.13,.04,y)
        if z<1.94:v.co.z=max(floor,z-min(.11,(1.94-z)*.6)*blend)
    dirs=[];gaps=[];tree=KDTree(len(part))
    for i,v in enumerate(part):
        d=v.co-head_center;direction=d.normalized()
        hit=head.ray_cast(head_center+direction,-direction,2)[0]
        dirs.append(direction);gaps.append(d.length-(hit-head_center).length if hit else 0)
        tree.insert(direction,i)
    tree.balance();shift=[]
    for i,v in enumerate(part):
        near=tree.find_range(dirs[i],.20)
        shift.append(min(gaps[j]for _,j,_ in near)-.004)
    for i,v in enumerate(part):
        near=tree.find_range(dirs[i],.10)
        offset=sum(shift[j]for _,j,_ in near)/len(near)
        v.co-=dirs[i]*offset
    bm.to_mesh(o.data);bm.free();o.data.update()
    fit_scalp(o,.004,head,sample_faces=True)
    # Only exposed patches are repaired, with UVs sampled from the source hair.
    # This belongs to hair_05; it is not a shared basic haircut or a full cap.
    return ponytail_infill(o)

def fit_bowl(o):
    for v in o.data.vertices:
        v.co=Vector((v.co.x*.92,(v.co.y-.025)*.91+.025,(v.co.z-1.75)*.82+1.735))
    for _ in range(3):fit_scalp(o,.002,head,sample_faces=True)
    return 0
