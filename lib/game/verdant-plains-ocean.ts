import * as T from 'three';
import { plainsCoast } from './verdant-plains-layout';
import { PLAINS_DAYLIGHT } from './verdant-plains-sky';
import type { PlainsQuality } from './verdant-plains-quality';

/** More samples in the surf zone, fewer beneath the distant atmospheric haze. */
export function plainsOceanGeometry(quality: PlainsQuality) {
  const [columns, rows] = {
    office: [192, 96], light: [256, 112], balanced: [384, 144], high: [512, 192],
  }[quality];
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const offshore = t < .7 ? -12 + t / .7 * 152
      : t < .9 ? 140 + (t - .7) / .2 * 460 : 600 + (t - .9) / .1 * 1600;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns * 2 - 1;
      const x = Math.sign(u) * (Math.abs(u) < .8 ? Math.abs(u) / .8 * 650
        : 650 + (Math.abs(u) - .8) / .2 * 1350);
      const index = row * (columns + 1) + col;
      positions.set([x, .12, plainsCoast(x) + offshore], index * 3);
      if (row < rows && col < columns) {
        const next = index + columns + 1;
        indices.push(index, next, index + 1, index + 1, next, next + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.boundingBox!.min.y = -2;
  geometry.boundingBox!.max.y = 2;
  geometry.boundingSphere = geometry.boundingBox!.getBoundingSphere(new T.Sphere());
  return geometry;
}

/** A single water draw: displaced swells, sky reflection, depth absorption and surf.
 * Shares the map heightfield and existing normal/cloud assets; no reflection pass. */
export function plainsOceanMaterial(
  ground: T.Texture, ripples: T.Texture, ocean: T.Texture,
  color: T.Texture, clouds: T.Texture, time: { value: number },
) {
  return new T.ShaderMaterial({
    name: 'Verdant white-sand surf',
    transparent: true,
    depthWrite: true,
    fog: true,
    uniforms: {
      ...T.UniformsUtils.clone(T.UniformsLib.fog),
      uGround: { value: ground }, uRipples: { value: ripples },
      uOcean: { value: ocean }, uColor: { value: color }, uClouds: { value: clouds },
      uTime: time,
      uSun: { value: new T.Vector3(...PLAINS_DAYLIGHT.sun).normalize() },
      uHorizon: { value: new T.Color(PLAINS_DAYLIGHT.horizon) },
      uZenith: { value: new T.Color('#438fd4') },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWaterPosition,vWaveNormal;
      #include <fog_pars_vertex>
      float coast(float x){return 352.0+36.0*sin(x/127.0)+15.0*sin(x/49.0);}
      float wave(vec2 p){
        float shore=p.y-coast(p.x);
        float envelope=smoothstep(-8.0,6.0,shore)*(1.0-smoothstep(160.0,650.0,shore));
        float swell=.38*sin(dot(p,vec2(.045,.174))+uTime*1.05)
          +.19*sin(dot(p,vec2(-.11,.285))+uTime*1.38)
          +.065*sin(dot(p,vec2(.36,.49))+uTime*1.92);
        float crest=sin(shore*.48+uTime*1.55+sin(p.x*.033)*.6);
        float breaker=.30*crest*crest*crest*(1.0-smoothstep(28.0,75.0,shore));
        return .12+envelope*(swell+breaker);
      }
      void main(){
        vec2 p=position.xz;
        float y=wave(p);
        vec3 transformed=vec3(p.x,y,p.y);
        vWaveNormal=normalize(vec3(wave(p-vec2(.2,0.0))-wave(p+vec2(.2,0.0)),.4,
          wave(p-vec2(0.0,.2))-wave(p+vec2(0.0,.2))));
        vWaterPosition=transformed;
        vec4 mvPosition=modelViewMatrix*vec4(transformed,1.0);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform sampler2D uGround,uRipples,uOcean,uColor,uClouds;
      uniform float uTime;
      uniform vec3 uSun,uHorizon,uZenith;
      varying vec3 vWaterPosition,vWaveNormal;
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      vec3 reflectedSky(vec3 d){
        float elevation=max(d.y,0.0);
        vec3 sky=mix(uHorizon,uZenith,pow(elevation,.42));
        float c=cos(uTime*.0012),s=sin(uTime*.0012);
        vec2 uv=.5+mat2(c,-s,s,c)*d.xz/(1.0+elevation)*.46;
        vec3 cloud=texture2D(uClouds,uv).rgb;
        float opacity=cloud.g*smoothstep(.005,.09,d.y)*.92;
        vec3 litCloud=mix(vec3(.40,.53,.68),vec3(1.18,1.16,1.08),pow(cloud.r,1.7));
        return mix(sky,litCloud,opacity);
      }
      void main(){
        vec2 p=vWaterPosition.xz;
        float shore=p.y-(352.0+36.0*sin(p.x/127.0)+15.0*sin(p.x/49.0));
        vec2 coord=((p+500.0)*.512+.5)/513.0;
        float bottom=any(greaterThan(abs(p),vec2(500.0))) ? -max(0.0,shore)*.16
          : texture2D(uGround,coord).r;
        float depth=vWaterPosition.y-bottom;
        if(depth<.015)discard;
        vec3 view=normalize(cameraPosition-vWaterPosition);
        float distanceToCamera=length(cameraPosition-vWaterPosition);
        vec3 n1=texture2D(uRipples,p/7.0+vec2(-.027,.019)*uTime).xyz*2.0-1.0;
        vec3 n2=texture2D(uOcean,p/21.0+vec2(.013,-.016)*uTime).xyz*2.0-1.0;
        float rippleFade=mix(1.0,.18,smoothstep(80.0,550.0,distanceToCamera));
        vec3 normal=normalize(vWaveNormal+vec3(n1.x+n2.x*.7,0.0,n1.y+n2.y*.7)*.19*rippleFade);
        float fresnel=.02+.98*pow(1.0-max(dot(normal,view),0.0),5.0);
        vec3 reflection=reflectedSky(reflect(-view,normal));
        // Reference palette: clear ivory shallows, saturated turquoise, then deep blue.
        // Depth, rather than distance from the camera, keeps the gradient anchored to the coast.
        vec3 clearShallows=vec3(.57,.53,.43);
        vec3 turquoise=vec3(.001,.26,.255);
        vec3 deepBlue=vec3(.001,.05,.10);
        float lagoon=1.0-exp(-depth*1.15);
        float deep=smoothstep(5.0,28.0,depth);
        float variation=dot(texture2D(uColor,p/18.0+vec2(.006,-.009)*uTime).rgb,vec3(.333));
        vec3 water=mix(mix(clearShallows,turquoise,lagoon),deepBlue,deep)*(.94+variation*.12);
        float caustic=pow(max(0.0,1.0-abs(sin(p.x*4.3+n2.x*3.0+uTime*.45)
          +sin(p.y*5.1+n1.y*3.0-uTime*.6))),7.0);
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        caustic*=1.0-smoothstep(.12,.5,footprint);
        water+=vec3(.24,.26,.23)*caustic*exp(-depth*.9)*(1.0-fresnel);
        // A restrained blue reflection avoids the previous milky cloud patches.
        vec3 marineReflection=reflection*vec3(.12,.38,.48);
        vec3 color=mix(water,marineReflection,fresnel*.58);
        vec3 halfway=normalize(view+uSun);
        float glint=pow(max(dot(normal,halfway),0.0),420.0)*5.0
          +pow(max(dot(normal,halfway),0.0),48.0)*.13;
        color+=vec3(1.0,.93,.79)*glint;
        // Advancing broken crests and a thinner lace of foam where water meets sand.
        float foamNoise=noise(p*1.5+vec2(.16,-.35)*uTime);
        float drift=noise(p*.19+vec2(0.0,-uTime*.12));
        float phase=shore*.48+uTime*1.55+sin(p.x*.033)*.6+drift*.6;
        float crest=pow(max(sin(phase),0.0),10.0);
        float surf=crest*(1.0-smoothstep(7.0,36.0,shore))*smoothstep(-1.0,3.0,shore);
        float edge=(1.0-smoothstep(.05,1.0,depth))*(.55+.45*drift);
        float foam=clamp(max(surf*.88,edge)*smoothstep(.18,.66,foamNoise+surf*.22),0.0,.93);
        float foamGrain=noise(p*9.0+vec2(.8,-1.3)*uTime);
        foam*=mix(.5+.5*smoothstep(.2,.75,foamGrain),.8,smoothstep(.06,.3,footprint));
        color=mix(color,vec3(1.07,1.045,.97),foam);
        float clearAlpha=smoothstep(.015,.4,depth)*mix(.28,1.0,smoothstep(.15,3.2,depth));
        float alpha=mix(clearAlpha,1.0,foam);
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}
