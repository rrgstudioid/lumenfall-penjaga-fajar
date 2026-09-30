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
export function createPlainsSky(atlas: T.Texture, cold = false) {
  const sun = new T.Vector3(
    ...(cold ? FROST_DAWN.sun : PLAINS_DAYLIGHT.sun),
  ).normalize();
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      uClouds: { value: atlas },
      uTime: { value: 0 },
      uSun: { value: sun },
      uHorizon: {
        value: new T.Color(cold ? FROST_DAWN.horizon : PLAINS_DAYLIGHT.horizon),
      },
      uZenith: { value: new T.Color(cold ? FROST_DAWN.zenith : '#438fd4') },
      uCold: { value: cold ? 1 : 0 },
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
      uniform sampler2D uClouds;
      uniform float uTime,uCold;
      uniform vec3 uSun,uHorizon,uZenith;
      varying vec3 vSkyDirection;
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
  mesh.name = 'Verdant UDS daylight sky';
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
