import * as T from 'three';

/** A region-owned palette: no downloaded maps, global overrides, timers or render targets. */
export const ARUNIKA_SURFACES = {
  rock_natural: '#8c9283', cliff_rock: '#777e73', distant_rock: '#84988a',
  temple_stone: '#a4a596', shrine_stone: '#9dac9c',
  wood_planks: '#976e45', wood_beams: '#685039', wood_props: '#937044',
  roof_tiles: '#9b5140', fabric_canvas: '#d0ba83', fabric_banner: '#a84734',
  soil_tilled: '#655039', crop_foliage: '#88a846', flower_foliage: '#f1c66c',
  water_river: '#338f94', water_pond: '#367d79', waterfall: '#7abfc2', distant_water: '#427f8c', water_foam: '#cee8dd',
  fire_effect: '#fb761e', embers: '#ffa330', crystal_material: '#72d7b4', portal_effect: '#79dbb7',
} as const;
export type ArunikaSurface = keyof typeof ARUNIKA_SURFACES;

// Low-frequency value noise plus derivative-antialiased patterns, in physical units.
export const ARUNIKA_NOISE_GLSL = `
float aHash(vec2 p) { vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float aNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(aHash(i),aHash(i+vec2(1,0)),f.x),mix(aHash(i+vec2(0,1)),aHash(i+vec2(1,1)),f.x),f.y);
}
float aLine(float v,float width) { float d=abs(fract(v+.5)-.5); float aa=max(fwidth(v),.001); return 1.-smoothstep(width-aa,width+aa,d); }
`;

/** Compact earth detail shared by the existing terrain layer, never a second road mesh. */
export const ARUNIKA_DIRT_GLSL = `
vec3 arunikaDirt(vec2 p, out float height, out float rough) {
  float macro=aNoise(p*.31), wear=aNoise(p*1.7), grain=aNoise(p*15.);
  vec2 cell=floor(p*7.), f=fract(p*7.)-.5;
  vec2 jitter=vec2(aHash(cell+7.),aHash(cell+19.))*.5-.25;
  float stone=(1.-smoothstep(.06,.17,length(f-jitter)))*step(.78,aHash(cell));
  // Fade pebbles at distance so the path stays a clear, quiet navigation line.
  stone*=1.-smoothstep(.14,.6,length(fwidth(p*7.)));
  vec3 soil=mix(vec3(.14,.086,.039),vec3(.30,.202,.105),smoothstep(.12,.85,macro));
  soil*=mix(.90,1.08,wear)*mix(.95,1.04,grain);
  soil=mix(soil,vec3(.33,.28,.20),stone*.45);
  height=.004*grain+.008*wear+.009*stone;
  rough=mix(.94,.81,wear*.65)+stone*.025;
  return soil;
}
`;

/** Dominant-face projection BEFORE object placement: upright faces never get collapsed UVs. */
export function addArunikaSurfaceUv(geometry: T.BufferGeometry) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv:number[]=[];
  const curved=['CylinderGeometry','TorusGeometry'].includes(geometry.type);
  // Parametric UVs avoid projection-axis changes inside curved indexed faces.
  if(curved&&geometry.attributes.uv) {
    geometry.computeBoundingBox();
    const size=geometry.boundingBox!.getSize(new T.Vector3()),source=geometry.attributes.uv;
    for(let i=0;i<p.count;i++) {
      if(geometry.type==='CylinderGeometry'&&Math.abs(n.getY(i))>.99)uv.push(p.getX(i),p.getZ(i));
      else uv.push(source.getX(i)*Math.max(size.x,size.z)*Math.PI,source.getY(i)*Math.max(size.y,.2));
    }
    geometry.setAttribute('arunikaUv',new T.Float32BufferAttribute(uv,2));return geometry;
  }
  for(let i=0;i<p.count;i++) {
    const x=Math.abs(n?.getX(i)??0),y=Math.abs(n?.getY(i)??1),z=Math.abs(n?.getZ(i)??0);
    if(y>=x&&y>=z) uv.push(p.getX(i),p.getZ(i));
    else if(x>=z) uv.push(p.getZ(i),p.getY(i));
    else uv.push(p.getX(i),p.getY(i));
  }
  geometry.setAttribute('arunikaUv',new T.Float32BufferAttribute(uv,2));
  return geometry;
}

function surfaceCode(kind: ArunikaSurface): string {
  if(kind==='distant_rock') return `float broad=aNoise(vAP.xz*.09); aColor*=mix(.88,1.08,broad); aRough=.98;`;
  if(kind==='rock_natural'||kind==='cliff_rock') return `
    vec2 p=vASurfaceUv; float broad=aNoise(p*.65), grain=aNoise(p*9.);
    float seams=aLine(p.y*${kind==='cliff_rock'?'.8':'1.6'}+aNoise(p*.7)*.7,.035);
    float mineral=smoothstep(.70,.9,aNoise(p*3.2));
    aColor*=mix(.71,1.22,broad)*mix(.94,1.06,grain);
    aColor=mix(aColor,aColor*.60,seams*.28); aColor+=vec3(.035,.031,.024)*mineral;
    float moss=smoothstep(.67,.85,aNoise(vAP.xz*.48+vAP.y*.2));
    aColor=mix(aColor,aColor*vec3(.68,.84,.5),moss*.28);
    aHeight=.013*broad+.002*grain-.006*seams; aRough=.83+.15*grain;
  `;
  if(kind==='temple_stone'||kind==='shrine_stone') return `
    vec2 p=vASurfaceUv/vec2(1.35,.65); float row=floor(p.y); p.x+=mod(row,2.)*.5;
    float joints=max(aLine(p.x,.022),aLine(p.y,.027));
    float block=aHash(floor(p)), age=aNoise(vASurfaceUv*1.5), grit=aNoise(vASurfaceUv*19.);
    aColor*=mix(.84,1.14,block)*mix(.93,1.04,age);
    aColor=mix(aColor,aColor*.54,joints*.55);
    aColor=mix(aColor,aColor*vec3(.69,.84,.55),smoothstep(.70,.90,age)*.22);
    aHeight=.001*grit-.006*joints; aRough=.84+.12*grit;
    ${kind==='shrine_stone'?'float rune=aLine(p.x*3.,.045)*aLine(p.y*2.,.12); aEmission=vec3(.08,.19,.13)*rune*(.7+.3*sin(uATime*.7));':''}
  `;
  if(kind.startsWith('wood_')) return `
    vec2 p=vASurfaceUv;
    ${kind==='wood_beams'?'p=p.yx;':''}
    float plank=floor(p.y*3.1), tone=aHash(vec2(plank,floor(p.x/3.)));
    float grain=aNoise(vec2(p.x*.9,p.y*32.+sin(p.x*2.)*.7));
    float fiber=aLine(p.y*21.+aNoise(p*vec2(.9,3.))*.7,.09);
    float joint=max(aLine(p.y*3.1,.015),aLine(p.x/3.+mod(plank,2.)*.5,.006));
    aColor*=mix(.81,1.16,tone)*mix(.81,1.12,grain);
    aColor=mix(aColor,aColor*.35,joint*.78+fiber*.10);
    aColor=mix(aColor,vec3(.22,.22,.165),aNoise(p*.45)*${kind==='wood_planks'?'.18':'.09'});
    aHeight=.002*grain-.005*joint; aRough=.81+.16*grain;
  `;
  if(kind==='roof_tiles') return `
    vec2 p=vASurfaceUv/vec2(.62,.48); float row=floor(p.y); p.x+=mod(row,2.)*.5;
    float edge=max(aLine(p.x,.035),aLine(p.y,.044));
    float roundTile=sin(fract(p.x)*3.14159), variation=aHash(floor(p));
    aColor*=mix(.78,1.18,variation)*mix(.76,1.1,roundTile);
    aColor=mix(aColor,aColor*.46,edge*.62); aHeight=.013*roundTile-.005*edge;
    aRough=.77+.14*variation;
  `;
  if(kind==='fabric_canvas'||kind==='fabric_banner') return `
    vec2 p=vASurfaceUv; float weave=aLine(p.x*45.,.17)*.5+aLine(p.y*45.,.17)*.5;
    float folds=sin(p.x*4.+aNoise(p*.8)*1.3)*.5+.5;
    aColor*=mix(.91,1.05,folds)*mix(.97,1.025,weave);
    ${kind==='fabric_banner'?'float trim=aLine(p.x*1.9,.04); aColor=mix(aColor,vec3(.48,.31,.095),trim*.65);':''}
    aHeight=.0015*weave+.005*folds; aRough=.97;
  `;
  if(kind==='soil_tilled') return `
    float ridge=sin(vASurfaceUv.x*8.)*.5+.5, dirt=aNoise(vASurfaceUv*7.);
    aColor*=mix(.62,1.24,ridge)*mix(.84,1.13,dirt); aHeight=.055*ridge+.008*dirt; aRough=.96;
  `;
  if(kind==='crop_foliage') return `
    float leaf=sin(vASurfaceUv.y*22.+vASurfaceUv.x*5.)*.5+.5;
    float variation=aNoise(vAP.xz*.85);
    aColor=mix(vec3(.13,.23,.036),vec3(.39,.47,.10),variation)*mix(.84,1.15,leaf);
    aHeight=.003*leaf; aRough=.82; aEmission=aColor*.04;
  `;
  if(kind==='flower_foliage') return `
    float petals=sin(atan(vASurfaceUv.y,vASurfaceUv.x)*5.)*.5+.5;
    float center=1.-smoothstep(.024,.085,length(vASurfaceUv));
    float species=aHash(floor(vAP.xz*2.));
    aColor=mix(vec3(.79,.52,.16),vec3(.83,.71,.50),step(.52,species));
    aColor=mix(aColor,vec3(.53,.19,.11),center*.8); aColor*=.94+.1*petals;
    aRough=.83; aEmission=aColor*.045;
  `;
  if(kind==='water_river'||kind==='water_pond'||kind==='distant_water'||kind==='waterfall'||kind==='water_foam') {
    const fall=kind==='waterfall', far=kind==='distant_water', pond=kind==='water_pond';
    return `
      ${kind==='water_river'?`
        // Old bridge decks intersect the water plane. Keep water below their existing footprint,
        // without moving either mesh or changing the walkable/collision height.
        for(int i=0;i<2;i++) {
          vec2 bridgeDelta=abs(vAP.xz-uABridges[i].xy);
          if(bridgeDelta.x<uABridges[i].z&&bridgeDelta.y<uABridges[i].w)discard;
        }`:''}
      vec2 p=${fall?'vASurfaceUv*vec2(2.7,.65)':'vAP.xz'};
      float t=uATime*${fall?'2.8':pond?'.16':far?'.22':'.65'};
      float warp=aNoise(p*.6+vec2(-t*.25,t*.1));
      float wave=sin(p.x*${far?'.7':'5.4'}-t*2.+sin(p.y*2.4+t)*1.5+warp*5.)*.5+.5;
      ${far?'float ripple=wave;':'float ripple=sin(p.y*7.6+p.x*2.35+t*1.4+warp*3.)*.5+.5;'}
      ${!fall&&!far?`wave=mix(aNoise(p*vec2(1.7,.85)+vec2(-t,t*.14)),wave,.18);
        ripple=aNoise(p*vec2(2.7,3.1)+vec2(t*.42,-t*.26));`:''}
      ${fall?'wave=aNoise(vec2(p.x*3.,p.y*2.+t))* .65+wave*.35;':''}
      float depth=${pond?'1.-smoothstep(.22,.98,length(vALocal.xy))':kind==='water_river'?'1.-smoothstep(.5,1.,abs(vALocal.z-uARiver.x-uARiver.y*sin((vALocal.x+uARiver.z)*uARiver.w))/uAHalfWidth)':'0.7'};
      aColor*=mix(1.08,.79,depth)*mix(.97,1.025,warp);
      float crest=smoothstep(${fall?'.60,.88':'.88,.98'},wave*ripple);
      float foam=${fall?'crest*.55+smoothstep(.86,1.,ripple)*.15':kind==='water_foam'?'.5+.3*wave':far?'crest*.015':pond?'crest*.015+(1.-depth)*smoothstep(.75,.96,wave)*.025':'crest*.045+(1.-depth)*smoothstep(.73,.95,wave)*.055'};
      aColor=mix(aColor,vec3(.60,.80,.73),foam);
      aHeight=${fall?'.014':pond?'.0018':far?'.002':'.0035'}*(wave+ripple); aRough=${fall?'.42':pond?'.38':far?'.44':'.40'}+ripple*.045;
      aEmission=aColor*${fall?'.15':'.035'};
      diffuseColor.a=${far?'.80':fall?'.80':'.90'};
    `;
  }
  if(kind==='fire_effect') return `
    float y=clamp((vALocal.y+.625)/1.25,0.,1.);
    float tongues=aNoise(vec2(vALocal.x*9.+sin(uATime*4.),vALocal.y*5.-uATime*3.));
    float flicker=.8+.2*sin(uATime*9.+vALocal.y*8.);
    if(tongues<y*.47+.05)discard;
    aColor=mix(vec3(.20,.035,.002),vec3(.09,.005,.001),y);
    aEmission=mix(vec3(2.6,.72,.055),vec3(1.4,.055,.001),y)*(.65+.65*tongues)*flicker;
    diffuseColor.a=clamp((1.-y)*1.65,.12,1.)*(.5+.5*tongues); aRough=1.;
  `;
  if(kind==='embers') return `
    float dotMask=1.-smoothstep(.25,.5,length(vASurfaceUv));
    if(dotMask<.05) discard;
    aEmission=vec3(2.8,.66,.03)*(.6+.4*sin(uATime*7.+vAP.y*11.));
    aColor=vec3(.6,.09,.004); diffuseColor.a=dotMask*.7; aRough=1.;
  `;
  if(kind==='crystal_material') return `
    float veins=pow(.5+.5*sin(vALocal.y*13.+vALocal.x*9.+uATime*.8),10.);
    float core=1.-smoothstep(.0,.95,length(vALocal.xz));
    float pulse=.82+.18*sin(uATime*1.3);
    aColor*=.65+.4*core; aEmission=vec3(.13,.69,.43)*pulse*(.45+core*.55+veins*.38); aRough=.18;
  `;
  return `
    float angle=atan(vALocal.y,vALocal.x), radius=length(vALocal.xy);
    float energy=pow(.5+.5*sin(angle*11.-uATime*2.4+sin(radius*35.+uATime)*.65),5.);
    float rune=aLine(angle*5.093,.13)*aLine(radius*11.,.16);
    aColor*=.65+.5*energy; aEmission=vec3(.20,.88,.55)*(.38+energy*.7+rune*.6);
    aRough=.28;
  `;
}

export class ArunikaMaterials {
  readonly time={value:0};
  readonly cache=new Map<string,T.MeshStandardMaterial>();
  readonly river={value:new T.Vector4(-12,8,20,.03)};
  readonly halfWidth={value:2.5};
  readonly bridges={value:[new T.Vector4(1e6,1e6,0,0),new T.Vector4(1e6,1e6,0,0)]};
  get(kind:ArunikaSurface,tint?:string) {
    const key=kind+':'+(tint??'');
    const existing=this.cache.get(key); if(existing) return existing;
    const water=kind.startsWith('water')||kind==='distant_water';
    const effect=kind==='fire_effect'||kind==='embers';
    const color=new T.Color(ARUNIKA_SURFACES[kind]);
    // Small variations retain intentional object tint without disguising its material family.
    if(tint) color.lerp(new T.Color(tint),.18);
    const material=new T.MeshStandardMaterial({color,roughness:water?.3:.88,metalness:water?.12:0,
      side:water||kind==='cliff_rock'||kind.startsWith('fabric')||effect?T.DoubleSide:T.FrontSide,
      transparent:water||effect,depthWrite:!water&&!effect,opacity:water?.88:1,
      flatShading:kind==='crystal_material'});
    material.name=`arunika.${kind}`;
    // Single-layer water planes and tiny ember quads need no transparent back-face prepass.
    if((water&&kind!=='water_foam')||kind==='embers')material.forceSinglePass=true;
    material.userData.arunikaSurface=kind;
    material.userData.materialRevision=1;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uATime:this.time,uARiver:this.river,uAHalfWidth:this.halfWidth,uABridges:this.bridges});
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        attribute vec2 arunikaUv; varying vec2 vASurfaceUv; varying vec3 vAP; varying vec3 vALocal; uniform float uATime;
        ${kind==='embers'?'attribute float arunikaPhase;':''}
      `).replace('#include <begin_vertex>',`#include <begin_vertex>
        vASurfaceUv=arunikaUv; vALocal=position;
        ${kind==='embers'?'transformed.y+=mod(uATime*.7+arunikaPhase,1.65); transformed.x+=sin(uATime*2.+arunikaPhase*20.)*.09;':''}
        ${kind==='fire_effect'?'float flameTip=clamp((position.y+.625)/1.25,0.,1.); transformed.x+=sin(uATime*5.+position.y*11.)*.07*flameTip; transformed.z+=cos(uATime*4.+position.y*9.)*.05*flameTip;':''}
        vec4 aWorld=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          aWorld=instanceMatrix*aWorld;
        #endif
        vAP=(modelMatrix*aWorld).xyz;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform float uATime; uniform vec4 uARiver; uniform float uAHalfWidth; uniform vec4 uABridges[2];
        varying vec2 vASurfaceUv; varying vec3 vAP; varying vec3 vALocal;
        ${ARUNIKA_NOISE_GLSL}
      `).replace('#include <map_fragment>',`
        vec3 aColor=diffuseColor.rgb, aEmission=vec3(0.); float aHeight=0., aRough=roughness;
        ${surfaceCode(kind)}
        diffuseColor.rgb=aColor;
      `).replace('#include <roughnessmap_fragment>','float roughnessFactor=aRough;')
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          ${kind==='distant_rock'||effect?'':`
          vec3 aDx=dFdx(-vViewPosition),aDy=dFdy(-vViewPosition);
          vec3 aR1=cross(aDy,normal),aR2=cross(normal,aDx); float aDet=dot(aDx,aR1);
          normal=normalize(abs(aDet)*normal-sign(aDet)*(dFdx(aHeight)*aR1+dFdy(aHeight)*aR2));
          ${water?`float aFresnel=pow(1.-max(dot(normal,normalize(vViewPosition)),0.),4.);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.31,.48,.44),aFresnel*.35);`:''}`}
        `).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=aEmission;');
    };
    material.customProgramCacheKey=()=>`arunika-surface-v1-${kind}`;
    this.cache.set(key,material);
    return material;
  }
  dispose() { for(const material of this.cache.values()) material.dispose(); this.cache.clear(); }
}

const shrineOriginals=new WeakMap<T.Mesh,T.Material|T.Material[]>();
/** Restore shared sanctuary originals outside Padang; never leak its material pass to other maps. */
export function setArunikaShrineMaterials(shrine:T.Group,palette:ArunikaMaterials|null) {
  shrine.traverse(object=>{
    if(!(object instanceof T.Mesh)) return;
    if(!shrineOriginals.has(object)) shrineOriginals.set(object,object.material);
    if(!palette) { object.material=shrineOriginals.get(object)!; return; }
    const type=object.geometry.type, radius=(object.geometry as T.BufferGeometry & {parameters?:{radius?:number}}).parameters?.radius??0;
    addArunikaSurfaceUv(object.geometry);
    object.material=palette.get(type==='OctahedronGeometry'?'crystal_material':type==='TorusGeometry'&&radius<2?'portal_effect':'shrine_stone');
  });
}

/** Small, non-interactive effects inside the existing campfire; one ember batch, no light or shadow pass. */
export function addArunikaCampfireDetails(group:T.Group,x:number,y:number,z:number,palette:ArunikaMaterials) {
  const positions:number[]=[],uv:number[]=[],phases:number[]=[];
  for(let i=0;i<8;i++) {
    const px=Math.sin(i*2.4)*.27,py=i*.16,pz=Math.cos(i*2.4)*.27;
    for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]) {
      positions.push(px+a*.024,py+b*.024,pz); uv.push(a*.5,b*.5);phases.push(py);
    }
  }
  const geo=new T.BufferGeometry(); geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('arunikaUv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  // All vertices of one spark wrap together; otherwise loop boundaries create long streaks.
  geo.setAttribute('arunikaPhase',new T.Float32BufferAttribute(phases,1));
  const embers=new T.Mesh(geo,palette.get('embers')); embers.name='arunika-campfire-embers';
  embers.position.set(x,y+.2,z);embers.frustumCulled=false;embers.raycast=()=>{};
  embers.userData.materialOnlyEffect=true;group.add(embers);
  // Fuel is separate from fire, placed only within the existing stone fire ring.
  for(let i=0;i<3;i++) {
    const geo=addArunikaSurfaceUv(new T.CylinderGeometry(.10,.13,1.05,6));
    const log=new T.Mesh(geo,palette.get('wood_props','#3d291c'));
    log.rotation.set(Math.PI/2,0,i*Math.PI/3);log.position.set(x,y+.09,z);
    log.name='arunika-campfire-fuel';log.userData.materialOnlyEffect=true;log.raycast=()=>{};group.add(log);
  }
}
