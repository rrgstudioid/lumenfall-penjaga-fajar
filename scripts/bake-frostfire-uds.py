"""Bake inspected UDS alpha/noise inputs for the native Three.js snow emitter."""
from pathlib import Path
import hashlib, json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/frostfire-highlands/uds'
OUT=ROOT/'public/assets/maps/frostfire-highlands-v2'
records=json.loads((STAGE/'sources.json').read_text())
for record in records:
    assert hashlib.sha256(Path(record['source']).read_bytes()).hexdigest()==record['sha256']
bits=Image.open(STAGE/'exported/Snow_Bits.tga').convert('RGBA')
# Snow_Bits is a 2x2 normal/alpha atlas. Use one alpha tile; RGB is not albedo.
alpha=bits.getchannel('A').crop((0,0,128,128))
flake=Image.new('RGBA',alpha.size,'white');flake.putalpha(alpha)
flake.save(OUT/'snow-sprite.webp',lossless=True)
wind=Image.open(STAGE/'exported/Wind_Movement.tga').getchannel('R')
wind.save(OUT/'wind-movement.webp',lossless=True)
p=OUT/'provenance.json';report=json.loads(p.read_text())
report['uds']={'sourceAssets':records,'sourceUnmodified':True,'engine':'Unreal 5.4.4 TextureExporterTGA',
 'method':'Snow_Bits top-left alpha tile; Wind_Movement red noise channel. Three.js local wind simulation; not Unreal Blueprint/Niagara execution.',
 'runtime':['snow-sprite.webp','wind-movement.webp'],'inspectedOnly':['RainSnow_Sheet']}
p.write_text(json.dumps(report,indent=2)+'\n')
print('Baked UDS snow alpha and wind noise; verified original hashes.')
