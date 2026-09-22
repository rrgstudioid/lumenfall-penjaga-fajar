import bpy
import json
import os

scene_name = 'LF_City_Reference_Rebuild'
scene = bpy.data.scenes.get(scene_name) or bpy.context.scene
bpy.context.window.scene = scene
output = os.path.abspath('dev-prototypes/mahkota-fajar-blend-v1/assets/LUMENFALL_Medieval_City.glb')
os.makedirs(os.path.dirname(output), exist_ok=True)

# glTF cannot carry Blender's procedural Noise/ColorRamp networks 1:1. In
# this in-memory export copy only, give procedural-only materials their source
# diffuse color so the candidate remains readable instead of becoming white.
# Image-backed materials are left untouched. The source .blend is never saved.
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    nodes = material.node_tree.nodes
    principled = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if principled is None:
        continue
    has_image = any(node.type == 'TEX_IMAGE' for node in nodes)
    if has_image:
        continue
    base_color = principled.inputs.get('Base Color')
    if base_color is not None:
        for link in list(base_color.links):
            material.node_tree.links.remove(link)
        base_color.default_value = material.diffuse_color
    roughness = principled.inputs.get('Roughness')
    if roughness is not None and not roughness.links:
        roughness.default_value = 0.82

# Export only the candidate map scene. The source blend is never saved.
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_lights=True,
    export_cameras=True,
    export_animations=False,
    export_yup=True,
    export_copyright='LUMENFALL development candidate; source-preserving ingest',
)

manifest = {
    'mapId': 'lumenfall-kingdom-capital-blend-v1',
    'name': 'Ibu Kota Mahkota Fajar — Blender Candidate V1',
    'source': 'C:/Users/USER/Documents/LUMENFALL_Medieval_City.blend',
    'sourceScene': scene.name,
    'sourcePreservation': '1:1 ingest; no source scene edits',
    'exportFormat': 'GLB',
    'exportPath': output,
    'conversion': {'blenderAxes': 'Z-up', 'runtimeAxes': 'Three.js Y-up', 'transform': 'glTF exporter axis conversion only'},
    'devSpawn': {'id': 'DEV_TEMP_SPAWN', 'location': [0.0, 0.0, 0.0], 'status': 'pending walkable-point review'},
    'reviewMode': 'Map Review Mode V1',
    'gameplayContent': {'monsters': False, 'npcs': False, 'quests': False, 'drops': False},
}
with open('dev-prototypes/mahkota-fajar-blend-v1/manifest.json', 'w', encoding='utf-8') as handle:
    json.dump(manifest, handle, indent=2)
print('EXPORTED', output)
print('OBJECTS', len(bpy.data.objects), 'MESHES', len(bpy.data.meshes), 'MATERIALS', len(bpy.data.materials))
