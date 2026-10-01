import * as T from 'three';
export const WILDS_NIGHT = {
  sun: [-0.35, 0.82, -0.45] as const,
  horizon: '#163c54',
  zenith: '#123b64',
  ambientSky: '#8ca8cc',
  ambientGround: '#34434c',
  ambientIntensity: 0.65,
  sunColor: '#a9c8ef',
  sunIntensity: 0.85,
  fogNear: 180,
  fogFar: 800,
  exposure: 0.95,
};

/** Independent Chaotic Skies dome; no UDS atlas or cloud shader is used. */
export function createWildsSky(texture: T.Texture) {
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      uChaoticSky: { value: texture },
      uTime: { value: 0 },
      uHorizon: { value: new T.Color(WILDS_NIGHT.horizon) },
      uZenith: { value: new T.Color(WILDS_NIGHT.zenith) },
    },
    vertexShader: `varying vec3 vSkyDirection;
      void main(){vSkyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}`,
    fragmentShader: `uniform sampler2D uChaoticSky;
      uniform float uTime;uniform vec3 uHorizon,uZenith;
      varying vec3 vSkyDirection;
      void main(){
        vec3 d=normalize(vSkyDirection);
            // Painted horizon wraps in azimuth. Blend to the zenith before the
            // spherical pole, avoiding a pinched texture or sliding on translation.
            vec2 paintedUV=vec2(atan(d.z,d.x)/6.2831853+.5+uTime*.00012,
              .08+asin(clamp(d.y,-.99,.99))/1.5707963*.9);
            // atan wraps at +/- pi. Implicit derivatives across that cut pick
            // the smallest mip and create a visible stripe. Use continuous
            // angular gradients instead, with RepeatWrapping for the sample.
            vec3 dx=dFdx(d),dy=dFdy(d);
            float r2=max(dot(d.xz,d.xz),.0001);
            float vScale=.9/(1.5707963*sqrt(max(1.-d.y*d.y,.0001)));
            vec2 gradX=vec2((d.x*dx.z-d.z*dx.x)/(6.2831853*r2),dx.y*vScale);
            vec2 gradY=vec2((d.x*dy.z-d.z*dy.x)/(6.2831853*r2),dy.y*vScale);
            vec3 painted=textureGrad(uChaoticSky,paintedUV,gradX,gradY).rgb*vec3(.17,.39,.55)+vec3(.002,.012,.024);
            float poleFade=smoothstep(.72,.98,d.y);
            vec3 skyColor=mix(painted,uZenith,poleFade);
            skyColor=mix(uHorizon,skyColor,smoothstep(-.22,.10,d.y));
        gl_FragColor=vec4(skyColor,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.SphereGeometry(1000, 32, 16), material);
  mesh.name = 'Whispering Wilds Chaotic Skies 03 blue night';
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
