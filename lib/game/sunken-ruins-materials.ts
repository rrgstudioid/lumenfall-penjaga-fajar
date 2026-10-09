import * as T from 'three';
import { SUNKEN_REEFS, SUNKEN_OBSTACLES } from './sunken-ruins-layout.ts';
/** Low contrast contact occlusion anchors colonies even on the no-shadow preset. */
function seabedContactTexture(
  props: readonly { x: number; z: number; radius: number }[],
) {
  const size = 1024,
    data = new Uint8Array(size * size * 4).fill(255);
  for (const p of props) {
    if (p.radius <= 0) continue;
    const cx = ((p.x + 600) / 1200) * size,
      cy = ((p.z + 600) / 1200) * size,
      r = ((p.radius + 1.1) / 1200) * size;
    for (
      let y = Math.max(0, Math.floor(cy - r));
      y <= Math.min(size - 1, Math.ceil(cy + r));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - r));
        x <= Math.min(size - 1, Math.ceil(cx + r));
        x++
      ) {
        const t = T.MathUtils.smoothstep(
          Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r,
          0.12,
          1,
        );
        const value = Math.round(185 + 70 * t),
          index = (y * size + x) * 4;
        data[index] =
          data[index + 1] =
          data[index + 2] =
            Math.min(data[index], value);
      }
  }
  const texture = new T.DataTexture(data, size, size);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
/** Original periodic cellular light field: sampled twice for drifting refracted caustics. */
function causticTexture() {
  const size = 256,
    data = new Uint8Array(size * size * 4),
    wrap = (n: number) => ((n % 8) + 8) % 8;
  const jitter = (x: number, y: number, k: number) => {
    const n =
      Math.sin(wrap(x) * 127.1 + wrap(y) * 311.7 + k * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x / size) * 8,
        py = (y / size) * 8,
        cx = Math.floor(px),
        cy = Math.floor(py);
      let first = 99,
        second = 99;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const d = Math.hypot(
            cx + i + 0.2 + jitter(cx + i, cy + j, 0) * 0.6 - px,
            cy + j + 0.2 + jitter(cx + i, cy + j, 1) * 0.6 - py,
          );
          if (d < first) {
            second = first;
            first = d;
          } else if (d < second) second = d;
        }
      const glow = Math.exp(-(second - first) * 38),
        offset = (y * size + x) * 4;
      data[offset] =
        data[offset + 1] =
        data[offset + 2] =
          Math.round(glow * 255);
      data[offset + 3] = 255;
    }
  const texture = new T.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
/** Shared map-local resources. The UI never enters these shaders. */
export function createSunkenMaterials(
  props: readonly { x: number; z: number; radius: number }[] = [
    ...SUNKEN_REEFS,
    ...SUNKEN_OBSTACLES,
  ],
) {
  const time = { value: 0 },
    materials: T.Material[] = [],
    caustics = causticTexture(),
    contact = seabedContactTexture(props),
    textures: T.Texture[] = [caustics, contact];
  let sandTexture: T.Texture | undefined,
    coralTexture: T.Texture | undefined,
    stoneTexture: T.Texture | undefined;
  async function load(sandOnly = false, tectonicPlates = false) {
    sandTexture = await new T.TextureLoader().loadAsync(
      '/__sunken-dev/realism/sand-albedo.png',
    );
    sandTexture.colorSpace = T.SRGBColorSpace;
    sandTexture.wrapS = sandTexture.wrapT = T.RepeatWrapping;
    sandTexture.anisotropy = 4;
    textures.push(sandTexture);
    if (sandOnly && !tectonicPlates) return;
    if (!sandOnly) {
      coralTexture = await new T.TextureLoader().loadAsync(
        '/__sunken-dev/realism/coral-albedo.png',
      );
      coralTexture.colorSpace = T.SRGBColorSpace;
      coralTexture.wrapS = coralTexture.wrapT = T.RepeatWrapping;
      coralTexture.anisotropy = 4;
      textures.push(coralTexture);
    }
    stoneTexture = await new T.TextureLoader().loadAsync(
      '/__sunken-dev/revision3/limestone-albedo.png',
    );
    stoneTexture.colorSpace = T.SRGBColorSpace;
    stoneTexture.wrapS = stoneTexture.wrapT = T.RepeatWrapping;
    stoneTexture.anisotropy = 4;
    textures.push(stoneTexture);
  }
  function material(
    color: T.ColorRepresentation,
    kind: 'sand' | 'stone' | 'coral' | 'plant' | 'tectonic' = 'stone',
  ) {
    const m = new T.MeshStandardMaterial({
      color,
      roughness: kind === 'sand' ? 0.94 : kind === 'coral' ? 0.72 : 0.86,
      metalness: 0,
      vertexColors: kind !== 'sand',
      side: kind === 'plant' || kind === 'coral' ? T.DoubleSide : T.FrontSide,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.sunkenTime = time;
      shader.uniforms.sunkenCaustics = { value: caustics };
      shader.uniforms.sunkenSand = { value: sandTexture };
      shader.uniforms.sunkenCoral = { value: coralTexture };
      shader.uniforms.sunkenStone = { value: stoneTexture };
      shader.uniforms.sunkenContact = { value: contact };
      if (kind === 'tectonic') {
        shader.uniforms.sunkenSandTint = { value: new T.Color('#e1eadd') };
        shader.uniforms.sunkenRockTint = { value: new T.Color('#8996a4') };
        shader.vertexShader =
          'attribute float sunkenRockWeight; varying float sunkenRockBlend;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nsunkenRockBlend=sunkenRockWeight;',
        );
        shader.fragmentShader =
          'varying float sunkenRockBlend; uniform vec3 sunkenSandTint; uniform vec3 sunkenRockTint;\n' +
          shader.fragmentShader;
      }
      shader.vertexShader =
        'uniform float sunkenTime;varying vec3 sunkenWorld;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        ${
          kind === 'plant'
            ? `float sunkenPhase=position.y*1.8;
          #ifdef USE_INSTANCING
          sunkenPhase+=dot(instanceMatrix[3].xz,vec2(.07,.13));
          #endif
          transformed.x+=sin(sunkenTime*.8+sunkenPhase)*position.y*.08;`
            : ''
        }`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vec4 sp=vec4(transformed,1.);
          #ifdef USE_INSTANCING
          sp=instanceMatrix*sp;
          #endif
          sunkenWorld=(modelMatrix*sp).xyz;`,
        );
      shader.fragmentShader =
        `uniform float sunkenTime;uniform sampler2D sunkenCaustics;uniform sampler2D sunkenSand;uniform sampler2D sunkenCoral;uniform sampler2D sunkenStone;uniform sampler2D sunkenContact;varying vec3 sunkenWorld;
        float reefHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
        float reefNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(reefHash(i),reefHash(i+vec3(1,0,0)),f.x),mix(reefHash(i+vec3(0,1,0)),reefHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(reefHash(i+vec3(0,0,1)),reefHash(i+vec3(1,0,1)),f.x),mix(reefHash(i+vec3(0,1,1)),reefHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float reefHeight(vec3 p){${kind === 'sand' ? 'return sin(p.x*7.+sin(p.z*1.7)*.65)*.035+reefNoise(p*42.)*.014;' : kind === 'coral' ? 'return reefNoise(p*38.)*.018+sin(p.x*64.)*sin(p.y*64.)*sin(p.z*64.)*.002;' : 'return reefNoise(p*3.)*.06+reefNoise(p*24.)*.018;'}}
        ` + shader.fragmentShader;
      if (kind === 'coral')
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
        vec3 weights=abs(normalize(cross(dFdx(sunkenWorld),dFdy(sunkenWorld))));weights/=max(.001,weights.x+weights.y+weights.z);
        vec3 tissue=texture2D(sunkenCoral,sunkenWorld.yz*1.4).rgb*weights.x+texture2D(sunkenCoral,sunkenWorld.xz*1.4).rgb*weights.y+texture2D(sunkenCoral,sunkenWorld.xy*1.4).rgb*weights.z;
        diffuseColor.rgb*=mix(vec3(1.),tissue*1.3,.72);
      `,
        );
      if (kind === 'stone')
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 sw=pow(abs(normalize(cross(dFdx(sunkenWorld),dFdy(sunkenWorld)))),vec3(4.));sw/=max(.001,sw.x+sw.y+sw.z);
          vec3 limestone=texture2D(sunkenStone,sunkenWorld.yz*.65).rgb*sw.x+texture2D(sunkenStone,sunkenWorld.xz*.65).rgb*sw.y+texture2D(sunkenStone,sunkenWorld.xy*.65).rgb*sw.z;
          diffuseColor.rgb*=mix(vec3(1.),limestone*1.45,.80);
        `,
        );
      if (kind === 'tectonic')
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 sw=pow(abs(normalize(cross(dFdx(sunkenWorld),dFdy(sunkenWorld)))),vec3(4.));sw/=max(.001,sw.x+sw.y+sw.z);
          vec3 rock=texture2D(sunkenStone,sunkenWorld.yz*.65).rgb*sw.x+texture2D(sunkenStone,sunkenWorld.xz*.65).rgb*sw.y+texture2D(sunkenStone,sunkenWorld.xy*.65).rgb*sw.z;
          float blend=smoothstep(.05,.95,sunkenRockBlend+(reefNoise(sunkenWorld*2.)-.5)*.13);
          vec3 sediment=texture2D(sunkenSand,sunkenWorld.xz*.18).rgb*sunkenSandTint;
          diffuseColor.rgb*=mix(sediment,rock*sunkenRockTint*(1.15+reefNoise(sunkenWorld*1.5)*.35),blend);`,
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${kind === 'sand' ? 'diffuseColor.rgb*=texture2D(sunkenSand,sunkenWorld.xz*.18).rgb;' : kind === 'stone' ? 'float mineral=reefNoise(sunkenWorld*1.5);diffuseColor.rgb*=.77+mineral*.35;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.65,.85,.62),smoothstep(.58,.76,mineral)*.3);' : kind === 'coral' ? 'diffuseColor.rgb*=.84+reefNoise(sunkenWorld*38.)*.28;' : ''}
        vec2 cp=(sunkenWorld.xz+sunkenWorld.y*vec2(.26,-.18))*.045;
        float ca=min(texture2D(sunkenCaustics,cp+vec2(sunkenTime*.009,sunkenTime*.005)).r,texture2D(sunkenCaustics,cp*1.21-vec2(sunkenTime*.006,sunkenTime*.008)).r);
        diffuseColor.rgb*=.96+ca*1.35;
        float abyss=(1.-smoothstep(25.,100.,distance(sunkenWorld.xz,vec2(-245.,-220.))))*.16;
        diffuseColor.rgb*=mix(vec3(1.),vec3(.72,.81,1.02),abyss);
        ${kind === 'sand' ? 'diffuseColor.rgb*=texture2D(sunkenContact,(sunkenWorld.xz+600.)/1200.).rgb;' : ''}
      `,
      );
      if (kind !== 'plant')
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
        vec3 dpdx=dFdx(sunkenWorld),dpdy=dFdy(sunkenWorld);
        float relief=reefHeight(sunkenWorld);
        float dhx=dFdx(relief),dhy=dFdy(relief);
        vec3 worldNormal=normalize(cross(dpdx,dpdy));
        vec3 grad=cross(dpdy,worldNormal)*dhx+cross(worldNormal,dpdx)*dhy;
        float determinant=max(.00001,abs(dot(dpdx,cross(dpdy,worldNormal))));
        vec3 bumpWorld=grad/determinant;
        normal=normalize(normal-(viewMatrix*vec4(bumpWorld,0.)).xyz*.48);
      `,
        );
    };
    m.customProgramCacheKey = () => `sunken-natural-3-${kind}`;
    materials.push(m);
    return m;
  }
  return {
    time,
    load,
    material,
    /** Only underwater lighting is composed onto imported PBR; its UVs, normals and maps survive. */
    adaptImported(m: T.MeshStandardMaterial) {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.sunkenTime = time;
        shader.uniforms.sunkenCaustics = { value: caustics };
        shader.vertexShader =
          'varying vec3 sunkenPbrWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vec4 sp=vec4(transformed,1.);
          #ifdef USE_INSTANCING
          sp=instanceMatrix*sp;
          #endif
          sunkenPbrWorld=(modelMatrix*sp).xyz;`,
        );
        shader.fragmentShader =
          'uniform float sunkenTime;uniform sampler2D sunkenCaustics;varying vec3 sunkenPbrWorld;\n' +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 cp=(sunkenPbrWorld.xz+sunkenPbrWorld.y*vec2(.26,-.18))*.045;
          float ca=min(texture2D(sunkenCaustics,cp+vec2(sunkenTime*.009,sunkenTime*.005)).r,texture2D(sunkenCaustics,cp*1.21-vec2(sunkenTime*.006,sunkenTime*.008)).r);
          diffuseColor.rgb*=.96+ca*1.35;`,
        );
      };
      m.customProgramCacheKey = () => 'sunken-imported-pbr-caustics-1';
      m.needsUpdate = true;
    },
    dispose() {
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      materials.length = 0;
      textures.length = 0;
    },
  };
}
