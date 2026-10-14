import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir,copyFile } from 'node:fs/promises';
const bin=process.env.TOKTX_PATH??resolve('work/character-tools/ktx/bin/toktx.exe'),root=resolve('public/assets/characters/male-v2/textures');
function encode(args){const r=spawnSync(bin,args,{stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Texture compression failed');}
for(const size of [1024,2048]){
  encode(['--encode','etc1s','--qlevel','220','--genmipmap','--assign_oetf','srgb','--resize',`${size}x${size}`,resolve(root,`body-basecolor-${size}.ktx2`),resolve('work/modular-male/body-basecolor-master.png')]);
  encode(['--encode','uastc','--uastc_quality','2','--zcmp','18','--genmipmap','--assign_oetf','linear',resolve(root,`body-normal-${size}.ktx2`),resolve(root,`body-normal-${size}.png`)]);
}
encode(['--encode','uastc','--uastc_quality','2','--zcmp','18','--genmipmap','--assign_oetf','linear',resolve(root,'body-skin-mask.ktx2'),resolve(root,'body-skin-mask.png')]);
await mkdir('public/assets/decoders/basis',{recursive:true});
for(const name of ['basis_transcoder.js','basis_transcoder.wasm'])await copyFile(resolve('node_modules/three/examples/jsm/libs/basis',name),resolve('public/assets/decoders/basis',name));
