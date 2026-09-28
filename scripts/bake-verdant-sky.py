"""Bake a daylight cloud atlas from Unreal-exported UDS source channels.
This is a texture lighting bake, not a re-render of UDS volumetric simulation.
Run with a Python environment containing Pillow and numpy.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/verdant-plains/uds-bake'
OUT=ROOT/'public/assets/maps/verdant-plains-v2'
source=json.loads((STAGE/'source-manifest.json').read_text())
for record in source['assets']:
 assert hashlib.sha256((Path(source['source'])/record['path']).read_bytes()).hexdigest()==record['sha256'], 'Source changed'
size=2048
cloud=np.array(Image.open(STAGE/'exported/StaticClouds_A.tga').resize((size,size),Image.Resampling.LANCZOS),dtype=np.float32)/255
wisps=np.array(Image.open(STAGE/'exported/Cloud_Wisps.tga').convert('L').resize((size,size),Image.Resampling.LANCZOS),dtype=np.float32)/255
# Bake the packed directional lighting to one daylight shading channel. Preserve
# UDS alpha explicitly: RGB alone contains values outside the cloud silhouette.
shade=np.clip(cloud[:,:,0]*.25+cloud[:,:,1]*.20+cloud[:,:,2]*.55,0,1)
alpha=cloud[:,:,3]
# Wisp source was sRGB; convert to linear mask, then soften its strongest bands.
wisps=np.where(wisps<=.04045,wisps/12.92,((wisps+.055)/1.055)**2.4)
atlas=np.stack([shade,alpha,wisps],axis=-1)
target=OUT/'sky-clouds.webp'
Image.fromarray(np.uint8(np.clip(atlas,0,1)*255),'RGB').save(target,'WEBP',lossless=True,method=6)
preview=np.zeros((size,size,3),dtype=np.float32);preview[:]=[.28,.58,.88]
cloud_color=np.array([.77,.84,.92])[None,None,:]*(1-shade[:,:,None]) + np.array([1.,.985,.94])[None,None,:]*shade[:,:,None]
preview=preview*(1-alpha[:,:,None])+cloud_color*alpha[:,:,None]
Image.fromarray(np.uint8(np.clip(preview,0,1)*255)).resize((800,800)).save(STAGE/'daylight-bake-preview.png')
report={'source':'Ultra Dynamic Sky, owner supplied VaultCache','exportEngine':'Unreal Engine 5.4.4','method':'Unreal TextureExporterTGA, then offline packed-channel daylight bake; not a live Unreal/volumetric renderer','sourceAssets':source['assets'],'output':{'file':target.name,'size':[size,size],'channels':{'R':'baked directional daylight shade','G':'UDS cloud opacity','B':'linear cloud wisps'},'colorSpace':'linear data','bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},'sourceUnmodified':True}
(OUT/'sky-provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report['output']))
