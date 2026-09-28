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

/** UDS-derived cloud atlas on a camera-centred dome: one draw, no extra lights,
 * reflection captures, raymarching, or per-frame allocations. */
export function createPlainsSky(atlas: T.Texture) {
  const sun = new T.Vector3(...PLAINS_DAYLIGHT.sun).normalize();
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      uClouds: { value: atlas },
      uTime: { value: 0 },
      uSun: { value: sun },
      uHorizon: { value: new T.Color(PLAINS_DAYLIGHT.horizon) },
      uZenith: { value: new T.Color('#438fd4') },
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
      uniform float uTime;
      uniform vec3 uSun,uHorizon,uZenith;
      varying vec3 vSkyDirection;
      void main(){
        vec3 d=normalize(vSkyDirection);
        float elevation=max(d.y,0.0);
        vec3 color=mix(uHorizon,uZenith,pow(elevation,.42));
        float alignment=clamp(dot(d,uSun),-1.0,1.0);
        float angle=acos(alignment);
        // Soft atmospheric aureole plus a small, antialiased solar disc.
        float halo=exp(-angle*angle/0.016);
        color+=vec3(.50,.39,.20)*halo;
        float disc=1.0-smoothstep(.010,.013,angle);
        color=mix(color,vec3(6.0,5.5,4.3),disc);
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
        color=mix(color,vec3(.82,.89,.95),cloud.b*.16*horizonFade*(1.0-opacity));
        color=mix(color,litCloud,opacity);
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
