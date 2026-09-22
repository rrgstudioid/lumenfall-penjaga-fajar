import bpy
import json
from mathutils import Vector

def world_bounds():
    points = []
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        points.extend((obj.matrix_world @ Vector(corner) for corner in obj.bound_box))
    if not points:
        return None
    return {
        'min': [min(p[i] for p in points) for i in range(3)],
        'max': [max(p[i] for p in points) for i in range(3)],
        'dimensions': [max(p[i] for p in points) - min(p[i] for p in points) for i in range(3)],
    }

def material_summary(material):
    nodes = []
    if material and material.use_nodes:
        nodes = [node.type for node in material.node_tree.nodes]
    return {'name': material.name if material else None, 'nodes': nodes}

def object_summary(obj):
    return {
        'name': obj.name,
        'type': obj.type,
        'collection': [c.name for c in obj.users_collection],
        'location': list(obj.location),
        'rotationEuler': list(obj.rotation_euler),
        'scale': list(obj.scale),
        'dimensions': list(obj.dimensions),
        'data': obj.data.name if obj.data else None,
        'materialSlots': [slot.material.name if slot.material else None for slot in obj.material_slots],
        'modifiers': [modifier.type for modifier in obj.modifiers],
        'hideViewport': obj.hide_viewport,
        'hideRender': obj.hide_render,
    }

report = {
    'blenderVersion': list(bpy.app.version),
    'scenes': [
        {
            'name': scene.name,
            'objects': len(scene.objects),
            'camera': scene.camera.name if scene.camera else None,
            'world': scene.world.name if scene.world else None,
            'units': {
                'system': scene.unit_settings.system,
                'scaleLength': scene.unit_settings.scale_length,
                'lengthUnit': scene.unit_settings.length_unit,
            },
        }
        for scene in bpy.data.scenes
    ],
    'collections': [{'name': collection.name, 'objects': len(collection.objects)} for collection in bpy.data.collections],
    'counts': {
        'objects': len(bpy.data.objects),
        'meshes': len(bpy.data.meshes),
        'materials': len(bpy.data.materials),
        'images': len(bpy.data.images),
        'lights': len(bpy.data.lights),
        'cameras': len(bpy.data.cameras),
        'armatures': len(bpy.data.armatures),
        'curves': len(bpy.data.curves),
        'actions': len(bpy.data.actions),
        'particles': len(bpy.data.particles),
        'nodeGroups': len(bpy.data.node_groups),
    },
    'bounds': world_bounds(),
    'libraries': [{'name': library.name, 'filepath': library.filepath} for library in bpy.data.libraries],
    'missingImages': [image.filepath for image in bpy.data.images if image.source == 'FILE' and image.packed_file is None and not image.has_data],
    'images': [{'name': image.name, 'filepath': image.filepath, 'source': image.source, 'packed': image.packed_file is not None, 'size': list(image.size)} for image in bpy.data.images],
    'materials': [material_summary(material) for material in bpy.data.materials],
    'objects': [object_summary(obj) for obj in bpy.data.objects],
}

path = bpy.context.scene.get('LUMENFALL_AUDIT_OUTPUT') or 'blend-map-audit.json'
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(report, handle, indent=2)
print('AUDIT_JSON', path)
print(json.dumps({key: report[key] for key in ('blenderVersion', 'scenes', 'collections', 'counts', 'bounds', 'libraries', 'missingImages')}, indent=2))
