"""Reproducible local-only derivatives. Original archives, sky and Tripo output are read-only."""
from pathlib import Path
import hashlib, io, json, zipfile
import numpy as np
from PIL import Image, ImageFilter
import trimesh

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/maps/meteorfall-citadel'
OUT.mkdir(parents=True, exist_ok=True)
LIB = Path('D:/Lumenfall/Master_ Material_ Lumenfall')
records = []
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
for folder, name, label in [('Rock_Cliff','dark_rock','basalt'),('Terrain','stone_tiles_02','paving'),('Stone_Architecture','castle_brick_01','masonry')]:
    source = LIB / folder / (name+'_2k.blend.zip')
    with zipfile.ZipFile(source) as z:
        diffuse = next(n for n in z.namelist() if '_diff_' in n and n.endswith('.jpg'))
        im = Image.open(io.BytesIO(z.read(diffuse))).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
        im.save(OUT/(label+'.webp'),quality=90,method=6)
        height = next((n for n in z.namelist() if '_disp_' in n and n.endswith('.png')),None)
        hm = Image.open(io.BytesIO(z.read(height))).convert('F').resize((1024,1024)) if height else im.convert('L').filter(ImageFilter.GaussianBlur(1))
        h = np.array(hm,dtype=np.float32); h /= max(float(h.max()),1)
        dx = (np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*2
        dz = (np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*2
        normal=np.stack([-dx,dz,np.ones_like(h)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
        Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/(label+'-normal.webp'),quality=92,method=6)
        records.append({'asset':label,'sourceArchive':str(source),'sourceSha256':digest(source),'diffuseEntry':diffuse,'normalSource':height or 'luminance approximation; not the original normal map'})
sky=ROOT/'output/chaotic-sky/exported/t_chaotic_skies_01.tga'
im=Image.open(sky).convert('RGB').resize((2048,2048),Image.Resampling.LANCZOS)
a=np.asarray(im,dtype=np.float32)/255
# Only wrap seam processing here. Volcanic grading happens in the runtime shader.
for i in range(64):
    t=(1-i/64)**2;mid=(a[:,i]+a[:,-1-i])*.5
    a[:,i]=a[:,i]*(1-t)+mid*t;a[:,-1-i]=a[:,-1-i]*(1-t)+mid*t
Image.fromarray(np.uint8(np.clip(a,0,1)*255)).save(OUT/'chaotic-sky-01.webp',quality=93,method=6)
records.append({'asset':'sky','source':str(sky.relative_to(ROOT)),'sourceSha256':digest(sky),'processing':'2048 square; 64px wrap blend; source variant 01 unchanged','license':'Owner-supplied Chaotic Skies; no AI input'})
source=ROOT/'work/meteorfall-citadel/tripo-out/meteorfall-meteor-monolith-d89d6e0d/model.glb'
mesh=trimesh.load(source,force='mesh',process=True)
original_count=len(mesh.faces)
mesh.visual=trimesh.visual.ColorVisuals(mesh=mesh)
mesh.merge_vertices(merge_tex=True,merge_norm=True)
# Preview exposed an unwanted rectangular plinth below -0.31. Slice the staging
# mesh above it, cap the cut, and retain the largest connected component only.
cut_y=-.285
mesh=mesh.slice_plane([0,cut_y,0],[0,1,0],cap=True)
components=mesh.split(only_watertight=False)
mesh=max(components,key=lambda m:len(m.faces)) if len(components) else mesh
mesh.remove_unreferenced_vertices()
trimesh.repair.fill_holes(mesh)
mesh.vertices[:,1]-=mesh.bounds[0,1]
mesh.visual=trimesh.visual.ColorVisuals(mesh=mesh,vertex_colors=[105,101,100,255])
assert len(mesh.faces)<=6000
assert len(mesh.faces)>1000, 'Cleanup unexpectedly removed the monolith; do not accept this derivative'
mesh.export(OUT/'meteor-monolith.glb',include_normals=True)
records.append({'asset':'meteor','source':str(source.relative_to(ROOT)),'sourceSha256':digest(source),'taskId':'d89d6e0d-4162-441b-9e0d-c1c91e226199','model':'P1-20260311','credits':30,'sourceTriangles':original_count,'triangles':len(mesh.faces),'watertight':bool(mesh.is_watertight),'processing':'Local trimesh plane slice at y=-0.285, largest connected component, simple hole repair, base pivot; no Blender cleanup claimed'})
manifest={'layoutVersion':1,'originalAssetsUnmodified':True,'records':records,'reusedRuntimeGeometry':['/assets/maps/ironveil-mines-exterior-v1/rock.glb','/assets/maps/ironveil-mines-exterior-v1/rock-face.glb'],'concepts':[{'jobId':'24735724-d0b1-4a0b-ada2-c296ab835519','model':'seedream_v4_5','quality':'basic','estimatedCredits':1},{'jobId':'0c159e7b-0a85-4a3a-818f-bf649d9df784','model':'seedream_v4_5','quality':'basic','estimatedCredits':1}],'blenderInspection':'Unavailable; modular fort not accepted or imported','outputs':[{'file':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(OUT.iterdir()) if p.name!='provenance.json']}
(OUT/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'outputs':manifest['outputs'],'meteor':records[-1]},indent=2))
