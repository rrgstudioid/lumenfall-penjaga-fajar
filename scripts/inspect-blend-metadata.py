import bpy
import json
import os
import sys

def main():
    out_path = None
    if '--' in sys.argv:
        args = sys.argv[sys.argv.index('--') + 1:]
        if args:
            out_path = args[0]
    if not out_path:
        raise RuntimeError('Missing output JSON path')

    objects = [o for o in bpy.data.objects if o.type == 'MESH']
    materials = []
    images = []
    tri_count = 0
    vertices = 0
    min_v = [float('inf')] * 3
    max_v = [float('-inf')] * 3
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        tri_count += len(mesh.loop_triangles)
        vertices += len(mesh.vertices)
        for corner in obj.bound_box:
            world = obj.matrix_world @ bpy.mathutils.Vector(corner) if hasattr(bpy, 'mathutils') else None
            if world is None:
                world = obj.matrix_world @ __import__('mathutils').Vector(corner)
            for i in range(3):
                min_v[i] = min(min_v[i], float(world[i]))
                max_v[i] = max(max_v[i], float(world[i]))
        for slot in obj.material_slots:
            if slot.material:
                materials.append(slot.material.name)
    for img in bpy.data.images:
        if img.filepath:
            images.append(img.filepath)
    data = {
        'metadataStatus': 'PARSED_WITH_BLENDER',
        'meshCount': len(objects),
        'nodeCount': len(bpy.data.objects),
        'vertexCount': vertices,
        'triangleCount': tri_count,
        'materialSlotCount': len(set(materials)),
        'materialNames': sorted(set(materials)),
        'textureDependencies': sorted(set(images)),
        'animationPresent': bool(bpy.data.actions),
        'rigPresent': any(o.type == 'ARMATURE' for o in bpy.data.objects),
        'boundingBox': None if not objects else {'min': min_v, 'max': max_v},
        'pivotOrigin': 'BLENDER_OBJECT_ORIGIN',
        'unitScale': str(bpy.context.scene.unit_settings.scale_length),
        'collisionPresent': 'UNKNOWN',
        'LODCount': 'UNKNOWN',
        'blendVersion': list(bpy.app.version),
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

if __name__ == '__main__':
    main()
