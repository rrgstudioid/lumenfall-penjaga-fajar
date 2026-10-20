import * as T from 'three';
const BASE = '/assets/maps/meteorfall-citadel/';
/** Shared opaque materials; fissures are visual, exposed pools have explicit collision. */
export async function createMeteorfallMaterials() {
  const textures: T.Texture[] = [];
  const loader = new T.TextureLoader();
  const load = async (file: string, color = false) => {
    const t = await loader.loadAsync(BASE + file);
    textures.push(t);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const settled = await Promise.allSettled(
    [
      'basalt.webp',
      'basalt-normal.webp',
      'paving.webp',
      'paving-normal.webp',
      'masonry.webp',
      'masonry-normal.webp',
      'chaotic-sky-01.webp',
    ].map((f, i) => load(f, i % 2 === 0)),
  );
  const failure = settled.find((r) => r.status === 'rejected');
  if (failure?.status === 'rejected') {
    textures.forEach((t) => t.dispose());
    throw failure.reason;
  }
  const [
    basaltMap,
    basaltNormal,
    pavingMap,
    pavingNormal,
    masonryMap,
    masonryNormal,
    sky,
  ] = settled.map((r) => (r as PromiseFulfilledResult<T.Texture>).value);
  const time = { value: 0 };
  function stone(
    map: T.Texture,
    normal: T.Texture,
    color: string,
    cracks: number,
    road = false,
  ) {
    const m = new T.MeshStandardMaterial({
      map,
      normalMap: normal,
      normalScale: new T.Vector2(0.65, 0.65),
      color,
      roughness: 0.93,
      metalness: 0.08,
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.uMeteorTime = time;
      s.vertexShader =
        'varying vec3 vMeteorPosition;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvMeteorPosition=position;',
        );
      s.fragmentShader =
        `uniform float uMeteorTime;varying vec3 vMeteorPosition;
      float meteorHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float fissure(vec2 p){vec2 cell=floor(p),f=fract(p);float a=9.,b=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 r=g+vec2(meteorHash(cell+g),meteorHash(cell+g+21.))-f;float d=dot(r,r);if(d<a){b=a;a=d;}else b=min(b,d);}float edge=b-a,aa=max(.0165,fwidth(edge)*.5);return (1.-smoothstep(.0285-aa,.0285+aa,edge))*min(1.,.0285/aa);}
      ` +
        s.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>\nfloat f=fissure(vMeteorPosition.xz*${road ? '.16' : '.035'}+vMeteorPosition.y*.013);float crackMask=${road ? '1.' : 'smoothstep(.25,.7,.5+.5*sin(vMeteorPosition.x*.025)*sin(vMeteorPosition.z*.035))'};totalEmissiveRadiance+=vec3(${road ? '4.5,.65,.025' : '2.2,.25,.015'})*f*crackMask*${cracks.toFixed(3)}*(.94+.06*sin(uMeteorTime*.4));`,
        );
    };
    m.customProgramCacheKey = () => `meteor-stone-${cracks}-${road}`;
    return m;
  }
  const basalt = stone(basaltMap, basaltNormal, '#b0adb7', 1.3),
    paving = stone(pavingMap, pavingNormal, '#a0a2ac', 0.12),
    masonry = stone(masonryMap, masonryNormal, '#9995a0', 0.15);
  const road = stone(pavingMap, pavingNormal, '#807b80', 1.6, true);
  // The source has very low albedo; grade this shared runtime copy for cliff readability.
  basalt.color.multiplyScalar(6);
  const trim = new T.MeshStandardMaterial({
    color: '#9b7042',
    metalness: 0.65,
    roughness: 0.55,
  });
  // Decorative floor decals have explicit depth bias, independent of view distance.
  paving.polygonOffset = true;
  paving.polygonOffsetFactor = -1;
  paving.polygonOffsetUnits = -1;
  const floorTrim = trim.clone();
  floorTrim.side = T.DoubleSide;
  floorTrim.polygonOffset = true;
  floorTrim.polygonOffsetFactor = -2;
  floorTrim.polygonOffsetUnits = -2;
  const magma = new T.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: `varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime;varying vec3 vP;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 p=(vP.xz+vec2(vP.y*.3,vP.y))*.28+vec2(uTime*.025,-uTime*.04);float n=noise(p)*.65+noise(p*3.1)*.35;vec3 c=mix(vec3(.42,.012,.001),vec3(3.5,.65,.012),smoothstep(.18,.8,n));gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const glow = new T.MeshBasicMaterial({ color: '#ff8c23', toneMapped: false });
  return {
    basalt,
    paving,
    road,
    masonry,
    trim,
    floorTrim,
    magma,
    glow,
    sky,
    textures,
    update(t: number) {
      time.value = t;
    },
    dispose() {
      [basalt, paving, road, masonry, trim, floorTrim, magma, glow].forEach(
        (m) => m.dispose(),
      );
      textures.forEach((t) => t.dispose());
    },
  };
}
