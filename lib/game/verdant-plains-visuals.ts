import * as T from 'three';

/** Three small silhouettes, shared by all boulders. Shape is independent of material. */
export function plainsBoulderGeometry(variant: number) {
  const geometry = new T.IcosahedronGeometry(1, 1);
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  const color = new T.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    const ripple =
      1 + 0.13 * Math.sin(x * 7 + variant * 3) * Math.cos(z * 5 - y * 4);
    // Buried base, broad irregular shoulder, narrower crown. Same footprint as collision.
    const crown = [0.63, 0.81, 0.49][variant] + x * 0.09 - z * 0.055;
    position.setXYZ(
      i,
      (x * ripple + y * 0.07) * 0.52,
      Math.max(-0.12, Math.min(crown, (y + 0.76) * (0.43 + variant * 0.015))),
      z * ripple * 0.48,
    );
    const moss = y > 0.25 && Math.sin(x * 8 + z * 6 + variant) > -0.2;
    color.set(moss ? '#82906a' : '#a5a69c');
    color.multiplyScalar(0.9 + 0.09 * (y + 1));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Box-projected bump UVs; albedo uses seamless triplanar projection below.
  const normals = geometry.getAttribute('normal'),
    uvs: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normals.getX(i)),
      ny = Math.abs(normals.getY(i)),
      nz = Math.abs(normals.getZ(i));
    uvs.push(
      (nx > ny && nx > nz ? position.getZ(i) : position.getX(i)) * 2.5,
      (ny > nx && ny > nz ? position.getZ(i) : position.getY(i)) * 2.5,
    );
  }
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

export function plainsBoulderMaterial(color: T.Texture, height: T.Texture) {
  const material = new T.MeshStandardMaterial({
    color: '#deded1',
    vertexColors: true,
    bumpMap: height,
    bumpScale: 0.055,
    roughness: 0.91,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uStone = { value: color };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vStonePosition,vStoneNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvStonePosition=position*2.5;vStoneNormal=normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uStone;varying vec3 vStonePosition,vStoneNormal;',
      )
      .replace(
        '#include <map_fragment>',
        `
      vec3 weights=pow(abs(normalize(vStoneNormal)),vec3(4.0));weights/=max(dot(weights,vec3(1.0)),.0001);
      vec3 stoneColor=texture2D(uStone,vStonePosition.yz).rgb*weights.x+texture2D(uStone,vStonePosition.xz).rgb*weights.y+texture2D(uStone,vStonePosition.xy).rgb*weights.z;
      diffuseColor.rgb*=stoneColor*1.25;
    `,
      );
  };
  material.customProgramCacheKey = () => 'plains-boulder-master-v1';
  return material;
}

/** The same four-blade tuft at every distance; no enlarged meadow cards. */
export function plainsGrassGeometry(simple = false) {
  const geometry = new T.InstancedBufferGeometry();
  const vertices: number[] = [],
    profiles: number[] = [];
  for (let blade = 0; blade < 4; blade++) {
    const a = blade * 2.399,
      c = Math.cos(a),
      s = Math.sin(a),
      short = blade >= 2;
    const h = (short ? 0.32 + (blade - 2) * 0.12 : 0.88 + blade * 0.2) * 1.35;
    const points = short || simple
      ? [
          [-0.045, 0, 0],
          [0.045, 0, 0],
          [0.04, h, 0.08],
        ]
      : [
          [-0.035, 0, 0],
          [0.035, 0, 0],
          [0.04, h * 0.56, 0.04],
          [-0.035, 0, 0],
          [0.04, h * 0.56, 0.04],
          [0.035, h, 0.105],
        ];
    for (const [x, y, z] of points) {
      const spread = short ? 0.19 : 0.06;
      vertices.push(x * c - (z + spread) * s, y, x * s + (z + spread) * c);
      profiles.push(y / h, h);
    }
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute(
    'aBladeProfile',
    new T.Float32BufferAttribute(profiles, 2),
  );
  geometry.computeVertexNormals();
  return geometry;
}

export function plainsGrassMaterial(
  height: T.Texture,
  mask: T.Texture,
  player: { value: T.Vector2 },
  time: { value: number },
  trail: { value: T.Vector2 },
  range: { value: T.Vector2 },
) {
  const material = new T.MeshLambertMaterial({
    color: '#a8b967',
    side: T.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uGround: { value: height },
      uMask: { value: mask },
      uPlayer: player,
      uTime: time,
      uGrassTrail: trail,
      uGrassRange: range,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      attribute vec4 aGrassPatch;
      attribute vec2 aBladeProfile;
      uniform sampler2D uGround,uMask;
      uniform vec2 uPlayer,uGrassTrail,uGrassRange;
      uniform float uTime;
      varying float vBladeTip,vGrassTint,vGust,vDistanceFade;
      float groundAt(vec2 q){return texture2D(uGround,(q+.5)/513.0).r;}
      float surfaceAt(vec2 p){
        vec2 grid=clamp((p+500.0)*.512,vec2(0.0),vec2(511.999));
        vec2 q=floor(grid),f=fract(grid);
        float a=groundAt(q),b=groundAt(q+vec2(1,0)),c=groundAt(q+vec2(0,1)),d=groundAt(q+vec2(1,1));
        return f.x+f.y<=1.0?a+f.x*(b-a)+f.y*(c-a):d+(1.0-f.x)*(c-d)+(1.0-f.y)*(b-d);
      }
    `,
      )
      .replace(
        '#include <begin_vertex>',
        `
      vec2 tileOrigin=modelMatrix[3].xz;
      vec2 worldXZ=aGrassPatch.xy+tileOrigin;
      float dist=distance(worldXZ,uPlayer);
      vDistanceFade=1.0-smoothstep(uGrassRange.x,uGrassRange.y,dist);
      // Rejected roots never contribute pixels. Avoid their mask/terrain fetches
      // and animation work; keep all equations for visible blades unchanged.
      vec3 transformed=vec3(aGrassPatch.x,-10000.0,aGrassPatch.y);
      vBladeTip=aBladeProfile.x;vGrassTint=aGrassPatch.w;vGust=0.0;
      if(all(lessThanEqual(abs(worldXZ),vec2(498.0))) && vDistanceFade>0.0){
      float fade=1.0;
      float density=texture2D(uMask,((worldXZ+500.0)*.512+.5)/513.0).r;
      float clump=.72+.28*sin(worldXZ.x*.61)*sin(worldXZ.y*.53);
      fade*=smoothstep(.15,.8,density)*clump;
      if(fade>.001){
      float phase=aGrassPatch.z+dot(tileOrigin,vec2(.371,.619));
      float c=cos(phase),s=sin(phase);
      transformed=position*(.7+aGrassPatch.w*.65)*fade;
      transformed.xz=mat2(c,-s,s,c)*transformed.xz;
      // A travelling front links neighbouring clumps; fine flutter varies each blade.
      float tip=aBladeProfile.x;
      float bladeHeight=aBladeProfile.y;
      float gust=.5+.5*sin(dot(worldXZ,vec2(.16,.09))-uTime*1.75);
      float roll=sin(dot(worldXZ,vec2(.38,.20))-uTime*2.9);
      float flutter=sin(uTime*5.2+aGrassPatch.z*2.0+worldXZ.x*.8)*.065;
      float bend=(.10+roll*(.28+gust*.15))*tip*tip*fade*bladeHeight;
      transformed.xz+=vec2(.88,.48)*bend+vec2(-.48,.88)*flutter*tip*tip*fade*bladeHeight;
      transformed.y-=abs(bend)*.24;
      // Sweep a short capsule behind the character. Roots remain fixed; tips
      // bend outward and return as the smoothed trail leaves the clump.
      vec2 stepVector=uPlayer-uGrassTrail;
      float stepT=clamp(dot(worldXZ-uGrassTrail,stepVector)/max(dot(stepVector,stepVector),.0001),0.0,1.0);
      vec2 away=worldXZ-mix(uGrassTrail,uPlayer,stepT);
      float contact=1.0-smoothstep(.18,1.35,length(away));
      vec2 pushDirection=normalize(away+vec2(.001,.002));
      transformed.xz+=pushDirection*contact*.85*tip*tip*fade*bladeHeight;
      transformed.y*=1.0-contact*.58*tip;
      transformed.xz+=aGrassPatch.xy;
      transformed.y+=surfaceAt(worldXZ)-.025;
      vBladeTip=tip;vGrassTint=aGrassPatch.w;vGust=gust;
      }
      }
    `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vBladeTip,vGrassTint,vGust,vDistanceFade;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      // Only fade at the configured outer limit. Never shrink blades in rings around the player.
      float pixelNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
      if(vDistanceFade<=pixelNoise) discard;
      diffuseColor.rgb*=mix(vec3(.55,.72,.40),vec3(1.14,1.12,.72),vBladeTip)*(.88+vGrassTint*.22)*(.88+vGust*.18);
    `,
      );
  };
  material.customProgramCacheKey = () => 'plains-grass-dense-tiles-v9-reject-hidden';
  return material;
}
