// Numeric asset preparation from the supplied grass atlas. No source files are edited.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { DataUtils } from 'three';
const { default: sharp } = await import(pathToFileURL(process.env.SHARP_MODULE).href);
const src = 'work/grass-medium-source/textures/', out = 'public/assets/materials/terrain/arunika/grass-medium-01/';
await mkdir(out, { recursive: true });
const size = 2048;
const color = await sharp(`${src}grass_medium_01_diff_4k.jpg`).resize(size, size).removeAlpha().raw().toBuffer();
const alpha = await sharp(`${src}grass_medium_01_alpha_4k.png`).resize(size, size).greyscale().raw().toBuffer();
const rgba = Buffer.alloc(size*size*4), nr = Buffer.alloc(size*size*4);
for (let i=0; i<size*size; i++) { rgba[i*4]=color[i*3]; rgba[i*4+1]=color[i*3+1]; rgba[i*4+2]=color[i*3+2]; rgba[i*4+3]=alpha[i]; }
for (const kind of ['nor_gl', 'rough']) {
  const bytes = await readFile(`${src}grass_medium_01_${kind}_4k.exr`);
  const exr = new EXRLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  const read = i => exr.data instanceof Uint16Array ? DataUtils.fromHalfFloat(exr.data[i]) : exr.data[i];
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const values=[0,0,0];
    for (let dy=0; dy<2; dy++) for (let dx=0; dx<2; dx++) {
      const i=((exr.height-1-(y*2+dy))*exr.width+x*2+dx)*4;
      for (let c=0; c<(kind==='nor_gl'?3:1); c++) values[c]+=read(i+c)*.25;
    }
    const i=(y*size+x)*4;
    if (kind==='rough') nr[i+3]=Math.round(Math.max(0,Math.min(1,values[0]))*255);
    else {
      const n=values.map(v=>v*2-1), length=Math.hypot(...n)||1;
      for (let c=0; c<3; c++) nr[i+c]=Math.round((n[c]/length*.5+.5)*255);
    }
  }
}
// Five source tuft cards, in top-down pixel coordinates of the 2K atlas.
// Crop only complete blades, not the atlas's padded single-leaf strips.
const cards = [[435,1550,530,300],[1170,1555,480,230],[0,1790,410,215],[470,1840,580,205],[1140,1780,515,265]];
let seed=73581;
const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
// Opaque, seamless grass carpet baked from overlapping, rotated source tufts.
// Transparent atlas background is never used as ground color. Normal XY rotates
// with each stamp, and normal/roughness use the identical alpha and placement.
const ground = Buffer.alloc(size*size*3), groundNR = Buffer.alloc(size*size*4);
for(let i=0;i<size*size;i++) { ground[i*3]=49;ground[i*3+1]=61;ground[i*3+2]=26;groundNR[i*4]=128;groundNR[i*4+1]=128;groundNR[i*4+2]=255;groundNR[i*4+3]=245; }
for (let stamp=0; stamp<2600; stamp++) {
  const [sx,sy,sw,sh]=cards[Math.floor(random()*cards.length)];
  const cx=random()*size, cy=random()*size, angle=random()*Math.PI*2, cos=Math.cos(angle), sin=Math.sin(angle);
  const scale=.36+random()*.32, width=sw*scale, height=sh*scale, radius=Math.ceil(Math.hypot(width,height)*.5);
  for (let dy=-radius;dy<=radius;dy++) for(let dx=-radius;dx<=radius;dx++) {
    const u=(cos*dx+sin*dy)/scale+sw*.5, v=(-sin*dx+cos*dy)/scale+sh*.5;
    if(u<0||u>=sw||v<0||v>=sh)continue;
    const source=((sy+Math.floor(v))*size+sx+Math.floor(u))*4;
    const a=rgba[source+3]/255;if(a<.03)continue;
    const x=((Math.floor(cx)+dx)%size+size)%size,y=((Math.floor(cy)+dy)%size+size)%size,i=y*size+x;
    for(let c=0;c<3;c++)ground[i*3+c]=Math.round(ground[i*3+c]*(1-a)+rgba[source+c]*a);
    // Image Y points down; tangent Y points up (OpenGL convention).
    const nx=nr[source]/127.5-1,ny=nr[source+1]/127.5-1,nz=nr[source+2]/127.5-1;
    const n=[cos*nx+sin*ny,-sin*nx+cos*ny,nz];
    for(let c=0;c<3;c++)groundNR[i*4+c]=Math.round(groundNR[i*4+c]*(1-a)+(n[c]*.5+.5)*255*a);
    groundNR[i*4+3]=Math.round(groundNR[i*4+3]*(1-a)+nr[source+3]*a);
  }
}
for(let i=0;i<size*size;i++) {
  const n=[groundNR[i*4]/127.5-1,groundNR[i*4+1]/127.5-1,groundNR[i*4+2]/127.5-1],length=Math.hypot(...n)||1;
  for(let c=0;c<3;c++)groundNR[i*4+c]=Math.round((n[c]/length*.5+.5)*255);
}
async function downsampleNR(buffer) {
  // Numeric data: no gamma transform or premultiplication by the roughness alpha.
  const reduced=Buffer.alloc(1024*1024*4);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++) {
    const values=[0,0,0,0];
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)for(let c=0;c<4;c++) values[c]+=buffer[((y*2+dy)*size+x*2+dx)*4+c]*.25;
    const n=values.slice(0,3).map(v=>v/127.5-1),length=Math.hypot(...n)||1;
    for(let c=0;c<3;c++)reduced[(y*1024+x)*4+c]=Math.round((n[c]/length*.5+.5)*255);
    reduced[(y*1024+x)*4+3]=Math.round(values[3]);
  }
  return reduced;
}
const assets=[['grass_ground_color_2k.webp',ground,3,false,2048],['grass_ground_normal_rough_1k.webp',await downsampleNR(groundNR),4,true,1024],
  ['grass_tuft_color_alpha_2k.webp',rgba,4,true,2048],['grass_tuft_normal_rough_1k.webp',await downsampleNR(nr),4,true,1024]];
for(const [file,data,channels,lossless,resolution] of assets) {
  const bytes=await sharp(data,{raw:{width:resolution,height:resolution,channels}}).webp({lossless,quality:94,effort:6}).toBuffer();
  await writeFile(out+file,bytes);console.log(`${file}: ${bytes.length} bytes`);
}
console.log(JSON.stringify({cards,groundTile:4.8,source:'grass_medium_01_4k.blend.zip',seed:73581,stamps:2600}));
