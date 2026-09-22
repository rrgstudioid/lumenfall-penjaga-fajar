import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MonsterDefinition } from './regions.ts';

type Form = 'slime'|'beast'|'bird'|'beetle'|'tree'|'bat'|'grub'|'humanoid'|'golem'|'wisp'|'serpent';
type Detail = 'tusks'|'antlers'|'spines'|'wings'|'crystals'|'shield'|'spear'|'crown'|'leaves'|'flames'|'fins'|'robes';
export type MonsterModelRecipe = { form: Form; color: string; accent: string; width: number; height: number; length: number; details: Detail[] };
const recipe = (form:Form,color:string,accent:string,width:number,height:number,length:number,...details:Detail[]):MonsterModelRecipe => ({form,color,accent,width,height,length,details});
// Stable species IDs, not display-name heuristics. Each named species has its own silhouette.
export const MONSTER_MODELS: Record<string,MonsterModelRecipe> = {
  'verdant-plains-0':recipe('slime','#8dbd64','#daf0aa',1,.7,1),
  'verdant-plains-1':recipe('beast','#865c40','#ead4ae',1.1,.85,1.45,'tusks'),
  'verdant-plains-2':recipe('bird','#e4cd89','#9c5646',.8,1.2,.8,'wings'),
  'verdant-plains-3':recipe('beetle','#667962','#b5b795',1.3,.65,1.2,'spines'),
  'verdant-plains-4':recipe('tree','#8c6f42','#b5d16e',.8,1.5,.7,'leaves'),
  'verdant-plains-5':recipe('tree','#5c6540','#c8d690',1.4,1.8,1,'antlers','leaves'),
  'ironveil-mines-0':recipe('bat','#66596d','#c4a895',.65,.8,.65,'wings'),
  'ironveil-mines-1':recipe('grub','#bca686','#756c61',.9,.5,1.5,'crystals'),
  'ironveil-mines-2':recipe('bat','#404d61','#cadbec',.85,1.1,.8,'wings','tusks'),
  'ironveil-mines-3':recipe('humanoid','#8e6950','#bec4cb',.8,1.5,.7,'spear','shield'),
  'ironveil-mines-4':recipe('golem','#64666b','#d6ad65',1.35,1.4,1,'crystals'),
  'ironveil-mines-5':recipe('beast','#4e525d','#d7c2a1',1.65,1.3,1.7,'tusks','spines','crown'),
  'whispering-wilds-0':recipe('wisp','#b5cc76','#739c86',.7,1.1,.8,'leaves'),
  'whispering-wilds-1':recipe('beast','#596858','#c6dcb6',.7,1.05,1.5,'spines'),
  'whispering-wilds-2':recipe('wisp','#80d4bf','#d2f3e3',.55,1.45,.65,'robes'),
  'whispering-wilds-3':recipe('beast','#344a54','#c694c6',.65,.8,1.8,'leaves'),
  'whispering-wilds-4':recipe('serpent','#65804e','#d5aa80',.75,1.4,1.4,'leaves','spines'),
  'whispering-wilds-5':recipe('humanoid','#536b57','#ddb991',1,2,.9,'antlers','robes','spear'),
  'frostfire-highlands-0':recipe('beast','#935444','#ebc988',1.3,1.2,1.55,'antlers'),
  'frostfire-highlands-1':recipe('beast','#a7c7df','#e9f7ff',.72,1.1,1.6,'crystals'),
  'frostfire-highlands-2':recipe('humanoid','#b35039','#ffd18b',.65,1,.6,'tusks','flames'),
  'frostfire-highlands-3':recipe('serpent','#617a9e','#f3aa69',1,1.3,1.8,'wings','spines'),
  'frostfire-highlands-4':recipe('beast','#654440','#f0b273',1.5,1.4,1.5,'antlers','flames'),
  'frostfire-highlands-5':recipe('golem','#789bab','#f4865e',1.25,1.8,1,'crystals','flames','crown'),
  'sunken-ruins-0':recipe('humanoid','#5f807d','#acd1cc',.8,1.65,.7,'spear','fins'),
  'sunken-ruins-1':recipe('humanoid','#507c8c','#b4a773',1,1.45,.8,'shield','crown'),
  'sunken-ruins-2':recipe('grub','#5a536f','#a5d8c5',.65,1.1,1.7,'robes','tusks'),
  'sunken-ruins-3':recipe('golem','#798e85','#d5ae97',1.15,1.65,1,'fins','shield'),
  'sunken-ruins-4':recipe('humanoid','#435d74','#dfce91',1.3,1.9,1,'shield','spear','crown'),
  'sunken-ruins-5':recipe('serpent','#3d7583','#a1decf',1.25,1.65,2.1,'fins','antlers'),
  'meteorfall-citadel-0':recipe('wisp','#b294da','#f2ad85',.85,1.35,.8,'crystals','flames'),
  'meteorfall-citadel-1':recipe('beast','#574966','#de9aad',.95,1.15,1.8,'spines','flames'),
  'meteorfall-citadel-2':recipe('golem','#726a8c','#b6cce9',1.25,1.7,1.15,'crystals','wings'),
  'meteorfall-citadel-3':recipe('humanoid','#474452','#c8a4e1',.9,1.9,.8,'spear','robes','crown'),
  'meteorfall-citadel-4':recipe('golem','#5e525f','#e3af86',1.7,2,1.2,'spines','flames','shield'),
  'meteorfall-citadel-5':recipe('humanoid','#4b4265','#ecafce',1.4,2.1,1.15,'wings','crown','spear','crystals'),
};

// All body parts are merged into one vertex-coloured draw call, without external models/textures.
export function createMonsterBody(definition: Pick<MonsterDefinition,'id'|'variant'|'visualScale'>):T.Mesh<T.BufferGeometry,T.MeshStandardMaterial> {
  const r=MONSTER_MODELS[definition.id] ?? MONSTER_MODELS['verdant-plains-0'];
  const parts:T.BufferGeometry[]=[];
  const add=(shape:'orb'|'box'|'cone'|'crystal',x:number,y:number,z:number,sx:number,sy:number,sz:number,color=r.color,rx=0,rz=0) => {
    const primitive=shape==='box'?new T.BoxGeometry(1,1,1):shape==='cone'?new T.ConeGeometry(.5,1,5):shape==='crystal'?new T.OctahedronGeometry(.5,0):new T.IcosahedronGeometry(.5,0);
    const g=primitive.index?primitive.toNonIndexed():primitive;
    if(g!==primitive) primitive.dispose();
    g.deleteAttribute('uv');
    const transform=new T.Matrix4().compose(new T.Vector3(x*r.width,y*r.height,z*r.length),new T.Quaternion().setFromEuler(new T.Euler(rx,0,rz)),new T.Vector3(sx*r.width,sy*r.height,sz*r.length));
    g.applyMatrix4(transform);
    const c=new T.Color(color), colors=new Float32Array(g.getAttribute('position').count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);
  };
  const eyes=(y:number,z:number)=>{for(const s of [-1,1])add('orb',s*.16,y,z,.12,.12,.08,'#fff0b9');};
  switch(r.form){
    case 'slime': add('orb',0,.47,0,1.5,.94,1.35); add('orb',.12,.87,.02,.42,.4,.4,r.accent);eyes(.53,-.55);break;
    case 'beast':
      add('orb',0,.76,0,.92,.85,1.3);add('orb',0,.96,-.67,.66,.7,.64);add('box',0,.8,-.94,.42,.3,.45,r.accent);
      for(const s of [-1,1]){for(const z of [-.43,.43])add('box',s*.31,.32,z,.22,.65,.25);add('cone',s*.22,1.36,-.61,.2,.4,.25);}
      add('cone',0,.76,.9,.2,.9,.22,r.accent,-1.1);eyes(1.07,-.94);break;
    case 'bird':add('orb',0,.65,0,.95,1.1,.8);add('orb',0,1.23,-.16,.7,.64,.67);add('cone',0,1.1,-.62,.32,.55,.3,r.accent,-Math.PI/2);for(const s of [-1,1])add('box',s*.22,.13,-.15,.18,.25,.45,r.accent);eyes(1.3,-.44);break;
    case 'beetle':add('orb',0,.62,0,1.2,.9,1.2);add('box',0,.66,-.1,.09,.91,1,r.accent);for(const s of [-1,1])for(let i=0;i<3;i++)add('cone',s*.73,.32,(i-1)*.4,.2,.9,.16,r.accent,0,s*-1.1);eyes(.5,-.55);break;
    case 'tree':add('cone',0,.8,0,.9,1.6,.8);for(const s of [-1,1]){add('box',s*.56,.95,0,.25,1.15,.25,r.color,0,s*-.8);add('cone',s*.38,.15,0,.55,.3,1,r.accent);}eyes(1.14,-.27);break;
    case 'bat':add('orb',0,.95,0,.6,1,.65);for(const s of [-1,1])add('cone',s*.23,1.5,-.08,.25,.7,.24,r.accent);eyes(1.05,-.3);break;
    case 'grub':for(let i=0;i<5;i++)add('orb',Math.sin(i)*.12,.36+Math.sin(i*.65)*.22,(i-2)*.28,.78-i*.07,.6-i*.035,.65,i%2?r.accent:r.color);eyes(.52,-.75);break;
    case 'humanoid':case 'golem':
      add('box',0,.95,0,r.form==='golem'?1.1:.75,.85,.5);add('orb',0,1.55,-.02,.58,.63,.58,r.accent);
      for(const s of [-1,1]){add('box',s*.24,.33,0,.28,.66,.35);add(r.form==='golem'?'orb':'box',s*.6,.9,0,.32,.85,.38);}
      eyes(1.61,-.3);break;
    case 'wisp':add('crystal',0,1,0,.9,1.4,.8);for(let i=0;i<3;i++)add('crystal',Math.sin(i*2)*.6,.6+i*.35,Math.cos(i*2)*.6,.25,.42,.25,r.accent);eyes(1.1,-.35);break;
    case 'serpent':for(let i=0;i<7;i++)add('orb',Math.sin(i*.8)*.25,.35+i*.1,(i-3)*.27,.58+i*.045,.55+i*.025,.58,i%2?r.accent:r.color);add('orb',.05,1.15,-.85,.7,.7,.7);eyes(1.24,-1.13);break;
  }
  for(const detail of r.details){
    if(detail==='wings')for(const s of [-1,1]){add('cone',s*.85,1,0,1.1,1.65,.12,r.accent,0,s*-1.1);add('cone',s*1.3,.9,.1,.7,1.1,.1,r.color,0,s*-.9);}
    if(detail==='tusks')for(const s of [-1,1])add('cone',s*.28,.75,-.9,.16,.65,.2,r.accent,-.5,s*-.2);
    if(detail==='antlers')for(const s of [-1,1]){add('cone',s*.38,1.7,-.2,.22,1,.22,r.accent,0,s*-.45);add('cone',s*.62,1.94,-.2,.16,.6,.17,r.accent,0,s*.7);}
    if(detail==='spines')for(let i=0;i<5;i++)add('cone',0,1.15,(i-2)*.27,.25,.65-i*.065,.3,r.accent);
    if(detail==='crystals')for(const s of [-1,1])for(let i=0;i<2;i++)add('crystal',s*(.42+i*.2),1.1+i*.23,.15,.32,.8,.35,r.accent,0,s*-.3);
    if(detail==='shield')add('box',.86,.84,-.27,.64,1,.17,r.accent,0,-.12);
    if(detail==='spear'){add('box',-.85,1.02,-.2,.1,1.85,.1,r.accent);add('cone',-.85,2.08,-.2,.35,.4,.25,r.accent);}
    if(detail==='crown')for(let i=0;i<5;i++)add('cone',Math.sin(i*1.257)*.28,1.98,Math.cos(i*1.257)*.28,.2,.5,.2,r.accent);
    if(detail==='leaves')for(let i=0;i<4;i++)add('orb',Math.sin(i*1.57)*.48,1.35+Math.cos(i)*.2,Math.cos(i*1.57)*.38,.8,.35,.7,r.accent);
    if(detail==='flames')for(let i=0;i<3;i++)add('cone',(i-1)*.36,1.3+i*.2,.3,.35,.75,.35,r.accent,0,(i-1)*.2);
    if(detail==='fins')for(const s of [-1,1])add('cone',s*.56,.8,.3,.15,1.2,.9,r.accent,0,s*.65);
    if(detail==='robes')add('cone',0,.57,.17,1.25,1.25,.95,r.accent);
  }
  const geometry=mergeGeometries(parts,false)!;
  parts.forEach(g=>g.dispose());
  geometry.scale(definition.visualScale,definition.visualScale,definition.visualScale);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true,emissive:r.accent,emissiveIntensity:.12});
  const body=new T.Mesh(geometry,material);body.castShadow=true;body.receiveShadow=true;body.name=definition.id;
  body.userData.labelHeight=(geometry.boundingBox?.max.y??1.5)+.4;return body;
}
