import * as T from 'three';

/** One shared direction for the visible sun and the actual shadow-casting light. */
export const PLAINS_DAYLIGHT = {
  sun: [-0.45, 0.24, -0.86] as const,
  sunColor: '#fff4dc',
  sunIntensity: 2.8,
  ambientSky: '#d7efff',
  ambientGround: '#70834e',
  ambientIntensity: 2.0,
  horizon: '#bcdff1',
};
/** Frostfire's low eastern sun also drives its terrain and character lighting. */
export const FROST_DAWN = {
  sun: [0.72, 0.16, -0.68] as const,
  sunColor: '#ffd0a0',
  sunIntensity: 2.0,
  ambientSky: '#cedbeb',
  ambientGround: '#839bb4',
  ambientIntensity: 1.55,
  horizon: '#e6cbbb',
  zenith: '#829bb5',
};

/** UDS-derived cloud atlas on a camera-centred dome: one draw, no extra lights,
 * reflection captures, raymarching, or per-frame allocations. */
export const WILDS_NIGHT = {
  moon: [-0.35, 0.48, -0.8] as const,
  horizon: '#0d192b',
  zenith: '#050b20',
  ambientSky: '#9cafd0',
  ambientGround: '#3d5140',
  ambientIntensity: 1.65,
  moonColor: '#a9c8ef',
  moonIntensity: 2.0,
};
export function createPlainsSky(
  atlas: T.Texture,
  cold = false,
  night = false,
  chaoticSky?: T.Texture,
) {
  const sun = new T.Vector3(
    ...(night ? WILDS_NIGHT.moon : cold ? FROST_DAWN.sun : PLAINS_DAYLIGHT.sun),
  ).normalize();
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      uClouds: { value: atlas },
      uChaoticSky: { value: chaoticSky ?? atlas },
      uChaotic: { value: night && chaoticSky ? 1 : 0 },
      uTime: { value: 0 },
      uSun: { value: sun },
      uHorizon: {
        value: new T.Color(
          night
            ? WILDS_NIGHT.horizon
            : cold
              ? FROST_DAWN.horizon
              : PLAINS_DAYLIGHT.horizon,
        ),
      },
      uZenith: {
        value: new T.Color(
          night ? WILDS_NIGHT.zenith : cold ? FROST_DAWN.zenith : '#438fd4',
        ),
      },
      uCold: { value: cold ? 1 : 0 },
      uNight: { value: night ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vSkyDirection;
      void main(){
        vSkyDirection=normalize(position);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_Position.z=gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform sampler2D uClouds,uChaoticSky;
      uniform float uTime,uCold,uNight,uChaotic;
      uniform vec3 uSun,uHorizon,uZenith;
      varying vec3 vSkyDirection;
      vec2 starHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      vec3 stars(vec3 d){
        vec2 q=d.xz/(1.0+max(0.0,d.y))*105.0;
        vec2 cell=floor(q);vec3 light=vec3(0.0);
        float aa=max(length(fwidth(q))*.55,.012);
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
          vec2 c=cell+vec2(float(i),float(j)),h=starHash(c);
          if(h.x>.62){
            vec2 p=q-c-(.18+h*.64);float dist=length(p);
            float core=1.0-smoothstep(.015,.025+aa,dist);
            float sparkle=step(.975,h.x);
            float rays=exp(-min(abs(p.x),abs(p.y))*65.0)*pow(max(0.0,1.0-max(abs(p.x),abs(p.y))/.27),2.0);
            float twinkle=.86+.14*sin(uTime*(.35+h.y*.6)+h.x*92.0);
            light+=mix(vec3(.5,.68,1.0),vec3(.88,.8,1.0),h.y*.45)*(core+sparkle*rays*.8)*twinkle;
          }
        }
        return light*smoothstep(.04,.2,d.y);
      }
      void main(){
        vec3 d=normalize(vSkyDirection);
        float elevation=max(d.y,0.0);
        vec3 color=mix(uHorizon,uZenith,pow(elevation,.42));
        float alignment=clamp(dot(d,uSun),-1.0,1.0);
        float angle=acos(alignment);
        // Soft atmospheric aureole plus a small, antialiased solar disc.
        float halo=exp(-angle*angle/mix(.016,.035,uCold));
        float dawnGlow=uCold*pow(max(0.,alignment),6.)*exp(-elevation*3.);
        color=mix(color,vec3(1.1,.62,.34),dawnGlow*.32);
        color+=mix(vec3(.50,.39,.20),vec3(.85,.35,.12),uCold)*halo;
        float disc=1.0-smoothstep(.010,.013,angle);
        color=mix(color,mix(vec3(6.0,5.5,4.3),vec3(5.4,3.5,1.8),uCold),disc);
        // Radial hemisphere projection matches the exported UDS cloud atlas.
        float radius=length(d.xz)/(1.0+elevation)*.46;
        vec2 heading=d.xz/max(length(d.xz),.0001);
        float rotation=uTime*.0012;
        float c=cos(rotation),s=sin(rotation);
        vec2 uv=vec2(.5)+mat2(c,-s,s,c)*heading*radius;
        vec3 cloud=texture2D(uClouds,uv).rgb;
        if(uNight>.5){
          float cloudAlpha=smoothstep(.72,1.0,cloud.g)*.3*smoothstep(.01,.1,d.y);
          vec3 nightColor=mix(uHorizon,uZenith,pow(elevation,.45));
          if(uChaotic>.5){
            // Painted horizon wraps in azimuth. Blend to the zenith before the
            // spherical pole, avoiding a pinched texture or sliding on translation.
            vec2 paintedUV=vec2(atan(d.z,d.x)/6.2831853+.5+uTime*.00012,
              .08+asin(clamp(d.y,0.,1.))/1.5707963*.9);
            vec3 painted=texture2D(uChaoticSky,paintedUV).rgb*.55;
            float poleFade=smoothstep(.72,.98,d.y);
            nightColor=mix(painted,uZenith,poleFade);
            nightColor=mix(uHorizon,nightColor,smoothstep(-.12,.04,d.y));
            float luminance=dot(painted,vec3(.2126,.7152,.0722));
            cloudAlpha=(1.-poleFade)*max(1.-smoothstep(.12,.48,d.y),smoothstep(.004,.08,luminance))*.99;
          }
          nightColor+=stars(d)*(1.0-cloudAlpha);
          float moonDisc=1.0-smoothstep(.019,.022,angle);
          float moonHalo=exp(-angle*angle/.008)*.045;
          nightColor+=vec3(.6,.75,1.0)*(moonDisc*.9+moonHalo)*(1.0-cloudAlpha);
          if(uChaotic<.5)nightColor=mix(nightColor,vec3(.025,.04,.065),cloudAlpha);
          gl_FragColor=vec4(nightColor,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        float horizonFade=smoothstep(.005,.09,d.y);
        float opacity=cloud.g*horizonFade*.92*(1.0-halo*.72);
        float shade=pow(cloud.r,1.7);
        vec3 litCloud=mix(vec3(.40,.53,.68),vec3(1.18,1.16,1.08),shade);
        // A warmer rim near the sun, without a screen-space bloom pass.
        litCloud+=vec3(.20,.15,.065)*halo;
        litCloud+=vec3(.28,.11,.02)*dawnGlow;
        color=mix(color,vec3(.82,.89,.95),cloud.b*.16*horizonFade*(1.0-opacity));
        color=mix(color,mix(litCloud,litCloud*vec3(.91,.97,1.04),uCold),min(1.,opacity*(1.+uCold*.16)));
        color=mix(color,uHorizon,uCold*.18);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new T.Mesh(new T.SphereGeometry(1000, 32, 16), material);
  mesh.name =
    night && chaoticSky
      ? 'Whispering Wilds Chaotic Skies 03 blue night'
      : night
        ? 'Whispering Wilds UDS-derived starry night'
        : 'Verdant UDS daylight sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return {
    mesh,
    update(camera: T.Camera, time: number) {
      mesh.position.copy(camera.position);
      material.uniforms.uTime.value = time;
    },
  };
}
