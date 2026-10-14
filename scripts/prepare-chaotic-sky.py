"""Convert the owner-supplied Chaotic Skies 03 export to a blue night browser texture.
Run export-chaotic-sky.py in the isolated Unreal staging project first.
Original Unreal packages and exports remain untouched.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];stage=root/'output/chaotic-sky';out=root/'public/assets/materials/whispering-wilds';out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((stage/'source-manifest.json').read_text());record=next(r for r in manifest['assets'] if r['path'].endswith('t_chaotic_skies_03.uasset'))
source=Path(manifest['source'])/record['path'];assert hashlib.sha256(source.read_bytes()).hexdigest()==record['sha256']
im=Image.open(stage/'exported/t_chaotic_skies_03.tga').convert('RGB').resize((2048,2048),Image.Resampling.LANCZOS)
a=np.asarray(im,dtype=np.float32)/255
# Keep painted detail and cyan highlights, neutralize the sparse warm streaks.
luma=a@np.array([.2126,.7152,.0722],dtype=np.float32)
warm=np.clip((a[:,:,0]-a[:,:,2])/.12,0,1)[:,:,None]
a=a*(1-warm)+luma[:,:,None]*np.array([.65,.91,1.16])*warm
a*=np.array([.72,.82,1.12])
# Seamless horizontal wrap; no vertical repetition on the sky dome.
width=64
for i in range(width):
 t=(1-i/width)**2;mid=(a[:,i,:]+a[:,-1-i,:])*.5
 a[:,i,:]=a[:,i,:]*(1-t)+mid*t;a[:,-1-i,:]=a[:,-1-i,:]*(1-t)+mid*t
file=out/'chaotic-sky-blue-03.webp';Image.fromarray(np.uint8(np.clip(a,0,1)*255)).save(file,'WEBP',quality=94,method=6)
report={'source':'Owner-supplied Chaotic Skies VaultCache','sourceRoot':manifest['source'],'selectedAsset':record,'exportEngine':'Unreal Engine 5.4.4 TextureExporterTGA','processing':'2048 square, cool blue grading of variant 03, 64px wrap seam blend','runtime':'Camera-centred dome, cylindrical azimuth/elevation sampling, slow rotation, continuous angular texture gradients, no moon or stars; not Unreal material/flowmap simulation','output':{'path':file.relative_to(root).as_posix(),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()},'originalAssetsUnmodified':True}
(out/'chaotic-sky-provenance.json').write_text(json.dumps(report,indent=2)+'\n');print(report['output'])
