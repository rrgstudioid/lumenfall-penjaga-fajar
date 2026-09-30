/** Shared cold-biome material factory. Existing map materials remain independent. */
import * as T from 'three';
export type ColdMapTextures = {
  snow: T.Texture;
  packed: T.Texture;
  rough: T.Texture;
  rock: T.Texture;
  water: T.Texture;
};
export function createColdMapMaterial(
  textures: ColdMapTextures,
  mode: 'terrain' | 'rock' | 'glacier' | 'ocean',
) {
  const material = new T.MeshStandardMaterial({
    roughness: 0.87,
    metalness: 0,
  });
  const time = { value: 0 };
  material.userData.time = time;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uFrostSnow: { value: textures.snow },
      uFrostPacked: { value: textures.packed },
      uFrostRough: { value: textures.rough },
      uFrostRock: { value: textures.rock },
      uFrostWater: { value: textures.water },
      uFrostTime: time,
    });
    shader.vertexShader =
      `varying vec3 vFrostWorld; varying vec3 vFrostNormal; varying vec3 vFrostMask; ${mode === 'terrain' ? 'attribute vec3 frostMask;' : ''}\n` +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 fp=vec4(position,1.0);
      #ifdef USE_INSTANCING
        fp=instanceMatrix*fp;
      #endif
      vFrostWorld=(modelMatrix*fp).xyz;
      vFrostNormal=normalize(mat3(modelMatrix)*objectNormal);
      vFrostMask=${mode === 'terrain' ? 'frostMask' : 'vec3(0.0)'};`,
    );
    shader.fragmentShader =
      `uniform sampler2D uFrostSnow,uFrostPacked,uFrostRough,uFrostRock,uFrostWater;
      uniform float uFrostTime;
      varying vec3 vFrostWorld,vFrostNormal; varying vec3 vFrostMask;
      float frostHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float iceCracks(vec2 p){
        vec2 cell=floor(p),f=fract(p);float first=9.0,second=9.0;
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
          vec2 g=vec2(float(i),float(j));
          vec2 r=g+vec2(frostHash(cell+g),frostHash(cell+g+47.0))-f;
          float d=dot(r,r);if(d<first){second=first;first=d;}else second=min(second,d);
        }
        return 1.0-smoothstep(.012,.055,second-first);
      }\n` + shader.fragmentShader;
    const surface = `
      vec2 uvSnow=vFrostWorld.xz*.14;
      vec3 snow=texture2D(uFrostSnow,uvSnow).rgb;
      vec3 packed=texture2D(uFrostPacked,uvSnow*.83).rgb;
      vec3 n=normalize(vFrostNormal),a=abs(n);a/=max(.001,a.x+a.y+a.z);
      vec3 rock=texture2D(uFrostRock,vFrostWorld.zy*.055).rgb*a.x+texture2D(uFrostRock,vFrostWorld.xz*.055).rgb*a.y+texture2D(uFrostRock,vFrostWorld.xy*.055).rgb*a.z;
      float cap=smoothstep(.30,.66,n.y+n.x*.22);
      vec3 softSnow=mix(vec3(.86,.92,.97),snow*vec3(.94,.99,1.04),.25);
      vec3 softPacked=mix(vec3(.75,.83,.89),packed*vec3(.90,.96,1.),.22);
      vec3 snowColor=mix(softSnow,softPacked,vFrostMask.x*.55);
      vec3 coldRock=rock*vec3(.63,.70,.80);
      vec3 terrain=mix(coldRock,snowColor,cap);
      float crack=iceCracks(vFrostWorld.xz*.11);
      float cloud=texture2D(uFrostPacked,vFrostWorld.xz*.035).r;
      vec3 ice=mix(vec3(.12,.37,.48),vec3(.39,.66,.76),cloud);
      ice=mix(ice,vec3(.80,.94,.97),crack*.8);
      float flutes=pow(.5+.5*sin(vFrostWorld.x*1.05+sin(vFrostWorld.x*.29)*1.3+vFrostWorld.y*.025),3.0);
      vec3 fallIce=mix(vec3(.19,.49,.64),vec3(.66,.85,.92),flutes*.65+cloud*.22);
      fallIce=mix(ice,fallIce,smoothstep(.12,.48,1.-n.y));
      float fallCap=smoothstep(.68,.94,n.y);
      fallIce=mix(fallIce,snowColor,fallCap);
    `;
    let color = 'mix(mix(terrain,ice,vFrostMask.y),fallIce,vFrostMask.z)';
    if (mode === 'rock') color = 'mix(coldRock,snowColor,cap)';
    if (mode === 'glacier')
      color =
        'mix(vec3(.16,.51,.69),vec3(.72,.91,.97),clamp(cap+pow(.5+.5*sin(vFrostWorld.x*1.9+vFrostWorld.z*.4),8.0)*.5,0.0,1.0))';
    if (mode === 'ocean')
      color =
        'mix(vec3(.006,.032,.058),vec3(.012,.095,.15),texture2D(uFrostWater,vFrostWorld.xz*.023+vec2(uFrostTime*.006,0.)).g)';
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n${surface}\ndiffuseColor.rgb *= ${color};`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\nroughnessFactor=${mode === 'ocean' ? '.32' : mode === 'glacier' ? '.38' : mode === 'terrain' ? 'mix(mix(.8+.18*texture2D(uFrostRough,uvSnow).r,.3,vFrostMask.y),mix(.38,.9,fallCap),vFrostMask.z)' : '.93'};`,
    );
  };
  material.customProgramCacheKey = () => `cold-map-v2-${mode}`;
  return material;
}
