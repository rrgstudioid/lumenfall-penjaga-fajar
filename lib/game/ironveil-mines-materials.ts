import * as T from 'three';
import { createForestMaterial, FOREST_ASSETS } from './forest-map-materials';
export const IRONVEIL_ASSETS = {
  dirt: '/assets/maps/verdant-plains-v2/dirt.webp',
  rock: FOREST_ASSETS.rock,
  wood: '/assets/maps/verdant-plains-v2/wood.webp',
} as const;
export type IronveilTextures = Record<keyof typeof IRONVEIL_ASSETS, T.Texture>;
export function createIronveilMaterials(t: IronveilTextures) {
  // The requested Whispering Wilds terrain profile, including its slope blend
  // and triplanar cliff texture. Its terrain branch only reads forest and rock;
  // the other factory slots reuse loaded textures and allocate no extra assets.
  const cliff = createForestMaterial(
    {
      forest: t.dirt,
      rock: t.rock,
      wood: t.wood,
      water: t.rock,
      chaoticSky: t.rock,
    },
    'terrain',
  );
  cliff.name = 'Ironveil arid cliff';
  cliff.color.set('#b8aaa0');
  const terrain = new T.MeshStandardMaterial({ roughness: 0.96 });
  terrain.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, {
      ivDirt: { value: t.dirt },
      ivGravel: { value: t.rock },
    });
    s.vertexShader =
      'attribute vec2 ironveilMask; varying vec2 ivMask; varying vec3 ivWorld;\n' +
      s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nivMask=ironveilMask; ivWorld=(modelMatrix*vec4(position,1.)).xyz;',
    );
    s.fragmentShader =
      'uniform sampler2D ivDirt,ivGravel; varying vec2 ivMask; varying vec3 ivWorld;\n' +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 dirt=texture2D(ivDirt,ivWorld.xz*.13).rgb;
      vec3 gravel=texture2D(ivGravel,ivWorld.xz*.11).rgb;
      vec3 soil=mix(dirt*vec3(.60,.47,.34),gravel*vec3(.46,.39,.31),ivMask.y*.55);
      vec3 path=mix(vec3(.42,.27,.135),dirt*vec3(.93,.70,.43),.65);
      diffuseColor.rgb=mix(soil,path,smoothstep(.03,.94,ivMask.x));`,
    );
  };
  terrain.customProgramCacheKey = () => 'ironveil-arid-terrain-v2';
  const rock = new T.MeshStandardMaterial({
    roughness: 0.97,
    color: '#b6bcc3',
    flatShading: true,
  });
  rock.onBeforeCompile = (s) => {
    s.uniforms.ivRock = { value: t.rock };
    s.vertexShader = 'varying vec3 ivWorld,ivNormal;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 ivp=vec4(position,1.); vec3 ivn=objectNormal;
      #ifdef USE_INSTANCING
      ivp=instanceMatrix*ivp; ivn=mat3(instanceMatrix)*ivn;
      #endif
      ivWorld=(modelMatrix*ivp).xyz; ivNormal=normalize(mat3(modelMatrix)*ivn);`,
    );
    s.fragmentShader =
      'uniform sampler2D ivRock; varying vec3 ivWorld,ivNormal;\n' +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 w=pow(abs(normalize(ivNormal)),vec3(4.));w/=max(.001,w.x+w.y+w.z);
      vec3 r=texture2D(ivRock,ivWorld.zy*.075).rgb*w.x+texture2D(ivRock,ivWorld.xz*.075).rgb*w.y+texture2D(ivRock,ivWorld.xy*.075).rgb*w.z;
      diffuseColor.rgb*=mix(vec3(.72,.74,.78),vec3(dot(r,vec3(.299,.587,.114))),.35);`,
    );
  };
  rock.customProgramCacheKey = () => 'ironveil-rock-v1';
  const wood = new T.MeshStandardMaterial({
    map: t.wood,
    color: '#b59058',
    roughness: 0.92,
  });
  const metal = new T.MeshStandardMaterial({
    color: '#464947',
    roughness: 0.82,
    metalness: 0.45,
  });
  const light = new T.MeshStandardMaterial({
    color: '#ffd37a',
    emissive: '#ff9d27',
    emissiveIntensity: 2.2,
    roughness: 0.6,
  });
  const dark = new T.MeshStandardMaterial({ color: '#100e0b', roughness: 1 });
  return {
    terrain,
    cliff,
    rock,
    wood,
    metal,
    light,
    dark,
  };
}
