"""Read selected master textures; write only workspace staging/runtime derivatives."""
from pathlib import Path
import json,zipfile,io
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
MASTER=Path(r'C:\Users\GG\Desktop\Lumenfall\Master_ Material_ Lumenfall')
STAGE=ROOT/'output/verdant-plains/polish';STAGE.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'public/assets/maps/verdant-plains-v2'
sources=[]
for name,archive,tag,runtime in [
 ('bark','Tree_bark/bark_willow_2k.blend.zip','_diff_',False),
 ('foliage','Terrain/leafy_grass_2k.blend.zip','_diff_',False),
 ('boulder-color','Rock_Cliff/rock_boulder_dry_2k.blend.zip','_diff_',True),
 ('boulder-height','Rock_Cliff/rock_boulder_dry_2k.blend.zip','_disp_',True),
 ('water-normal','Water/water_surface_1k_pbr.zip','/normal.png',True),
 ('water-ocean-normal','Water/water_ocean_normal_map_1k_pbr.zip','/normal.png',True),
 ('water-color','Water/water_surface_1k_pbr.zip','/baseColor.png',True),
]:
 with zipfile.ZipFile(MASTER/archive) as z:
  entry=next(n for n in z.namelist() if tag in n)
  image=Image.open(io.BytesIO(z.read(entry))).convert('RGB');image.thumbnail((1024,1024))
  dest=(OUT/(name+'.webp')) if runtime else STAGE/(name+'.png')
  image.save(dest,**({'lossless':True} if 'normal' in name or 'height' in name else {'quality':90}) if runtime else {})
  sources.append({'asset':str(dest.relative_to(ROOT)),'source':str(MASTER/archive),'entry':entry})
(OUT/'polish-provenance.json').write_text(json.dumps({'sources':sources,'trees':'Authored in bake-verdant-trees.py; base color + ambient occlusion baked to 1K atlases.'},indent=2)+'\n')
provenance_path=OUT/'provenance.json'
if provenance_path.exists():
 provenance=json.loads(provenance_path.read_text())
 replaced={'fir.glb','tree.glb','water-normal.webp'}
 provenance['sources']=[v for v in provenance['sources'] if v['asset'] not in replaced]
 provenance['sources'].extend({'asset':f'{n}.glb','source':'scripts/bake-verdant-trees.py: new authored geometry + baked master material atlas'} for n in ['fir','tree'])
 provenance['additionalTextures']='polish-provenance.json'
 provenance['proceduralBoulders']='lib/game/verdant-plains-visuals.ts: unchanged 3 shared 80-triangle shapes; master rock_boulder_dry color + bump'
 provenance_path.write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps(sources,indent=2))
