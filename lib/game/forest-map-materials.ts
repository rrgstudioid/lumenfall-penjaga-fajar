import * as T from 'three';
/** Additive registered forest profile. Existing cold/basic factories are unchanged. */
export const FOREST_ASSETS = {
  forest: '/assets/materials/whispering-wilds/forest.webp',
  rock: '/assets/materials/whispering-wilds/rock.webp',
  wood: '/assets/maps/verdant-plains-v2/wood.webp',
  water: '/assets/maps/verdant-plains-v2/water-normal.webp',
  chaoticSky: '/assets/materials/whispering-wilds/chaotic-sky-blue-03.webp',
} as const;
export type ForestTextures = Record<keyof typeof FOREST_ASSETS, T.Texture>;
export function createForestMaterial(
  textures: ForestTextures,
  kind: 'terrain' | 'rock' | 'wood' | 'water' | 'stone',
) {
  const mat = new T.MeshStandardMaterial({
    color:
      kind === 'water'
        ? '#145586'
        : kind === 'terrain'
          ? '#9eb888'
          : kind === 'wood'
            ? '#867c89'
            : '#798b9b',
    roughness: kind === 'water' ? 0.3 : 0.92,
    metalness: kind === 'water' ? 0.18 : 0,
  });
  if (kind === 'stone') {
    mat.color.set('#a9b2ca');
    mat.emissive.set('#26344d');
    mat.emissiveIntensity = 0.35;
  }
  if (kind === 'rock') {
    mat.emissive.set('#334058');
    mat.emissiveIntensity = 0.3;
  }
  mat.name = `Whispering forest / ${kind}`;
  if (kind === 'water') {
    mat.color.set('#326c85');
    mat.roughness = 0.48;
    mat.metalness = 0.08;
    mat.normalMap = textures.water;
    mat.normalScale.set(0.16, 0.16);
    mat.transparent = true;
    mat.opacity = 0.88;
    mat.depthWrite = false;
    mat.emissive.set('#071c2a');
    mat.emissiveIntensity = 0.15;
    mat.userData.waterTime = { value: 0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = mat.userData.waterTime;
      shader.vertexShader =
        'attribute float waterDepth;attribute float waterFlow;varying float vWaterDepth,vWaterFlow;varying vec3 vWaterPosition;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWaterDepth=waterDepth;vWaterFlow=waterFlow;vWaterPosition=position;',
      );
      shader.fragmentShader =
        'varying float vWaterDepth,vWaterFlow;varying vec3 vWaterPosition;uniform float uWaterTime;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float depth=smoothstep(.1,3.,vWaterDepth);
        diffuseColor.rgb=mix(vec3(.055,.17,.19),vec3(.016,.065,.12),depth);
        float speed=mix(.12,.7,vWaterFlow);
        vec2 p=vWaterPosition.xz;
        float ripple=sin(p.x*.8+p.y*.4-uWaterTime*speed)*sin(p.y*.65-p.x*.23+uWaterTime*.2);
        vec2 lakeP=p-vec2(15.,-55.);
        float lakeR=length(lakeP),theta=atan(lakeP.y,lakeP.x);
        float swirl=sin(lakeR*.32-theta*3.-uWaterTime*.32);
        float lakeMask=(1.-vWaterFlow)*(1.-smoothstep(160.,205.,lakeR))*smoothstep(58.,82.,lakeR);
        ripple=mix(ripple,swirl,lakeMask);
        diffuseColor.rgb+=vec3(.003,.007,.009)*ripple;
        diffuseColor.a*=smoothstep(.025,.32,vWaterDepth);
        // The sloping river dissolves into the lower ocean at its mouth.
        diffuseColor.a*=smoothstep(.005,1.8,vWaterPosition.y+59.);
        float foam=(1.-smoothstep(.08,.65,vWaterDepth))*(.5+.5*sin(p.x*1.3+p.y*1.7-uWaterTime*.6));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.45,.48),foam*.22);`,
      );
    };
    mat.customProgramCacheKey = () => 'wilds-depth-water-v4';
  } else
    mat.map =
      kind === 'wood'
        ? textures.wood
        : kind === 'terrain'
          ? textures.forest
          : textures.rock;
  if (kind === 'terrain') {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uForestRock = { value: textures.rock };
      shader.vertexShader =
        'attribute vec2 forestMask; varying vec2 vForestMask; varying vec3 vForestPosition; varying float vForestCliff; varying vec3 vTerrainNormal;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvForestMask=forestMask;vForestPosition=position;vForestCliff=1.-abs(normal.y);vTerrainNormal=normal;',
      );
      shader.fragmentShader =
        'uniform sampler2D uForestRock;varying vec2 vForestMask;varying vec3 vForestPosition;varying float vForestCliff; varying vec3 vTerrainNormal;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 stone=texture2D(uForestRock,vMapUv*.7).rgb;
        vec3 weights=pow(abs(normalize(vTerrainNormal)),vec3(4.));
        weights/=max(dot(weights,vec3(1.)),.0001);
        vec3 cliff=(texture2D(uForestRock,vForestPosition.zy*.075).rgb*weights.x
          +texture2D(uForestRock,vForestPosition.xz*.075).rgb*weights.y
          +texture2D(uForestRock,vForestPosition.xy*.075).rgb*weights.z)*vec3(.8,.91,1.1);
        if(vForestPosition.y < -59.)discard;
        float mottling=.5+.5*sin(vMapUv.x*.46+sin(vMapUv.y*.62)*2.)*cos(vMapUv.y*.43);
        diffuseColor.rgb=mix(diffuseColor.rgb*.85,diffuseColor.rgb*vec3(1.35,1.28,.9),mottling);
        diffuseColor.rgb=mix(diffuseColor.rgb,stone,vForestMask.y*.65);
        diffuseColor.rgb=mix(diffuseColor.rgb,cliff,smoothstep(.15,.55,vForestCliff));`,
      );
    };
    mat.customProgramCacheKey = () => 'whispering-forest-triplanar-v2';
  }
  return mat;
}
