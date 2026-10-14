import * as T from "three";
/** The supplied painted sky remains one opaque draw, including the lower hemisphere. */
export function createMeteorfallSky(texture: T.Texture) {
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSky: { value: texture },
      uTime: { value: 0 },
      uLayers: { value: 2 },
    },
    vertexShader: `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}`,
    fragmentShader: `uniform sampler2D uSky;uniform float uTime,uLayers;varying vec3 vDir;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(vDir);float t=uTime;
        float clouds=noise(d*7.+vec3(t*.009,0.,t*.004))*.65+noise(d*16.+vec3(-t*.006,t*.003,0.))*.35;
        if(uLayers>2.)clouds=clouds*.85+noise(d*31.+vec3(t*.004,-t*.005,0.))*.15;
        vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5+t*.00008,.10+abs(d.y)*.82);
        vec3 dx=dFdx(d),dy=dFdy(d);float r2=max(dot(d.xz,d.xz),.0001);
        vec2 gx=vec2((d.x*dx.z-d.z*dx.x)/(6.2831853*r2),sign(d.y)*dx.y*.82),gy=vec2((d.x*dy.z-d.z*dy.x)/(6.2831853*r2),sign(d.y)*dy.y*.82);
        vec3 painted=textureGrad(uSky,uv+vec2(clouds*.006,0.),gx,gy).rgb;
        float l=dot(painted,vec3(.45,.35,.2));
        vec3 c=mix(vec3(.025,.006,.012),vec3(.30,.018,.035),smoothstep(.05,.65,l));
        c=mix(c,vec3(.35,.045,.018),smoothstep(.5,.9,l)*.7);
        c*=.66+clouds*.65;c=mix(c,vec3(.085,.012,.025),smoothstep(.85,1.,abs(d.y))*.65);
        c*=1.+.03*sin(t*.11);gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.SphereGeometry(1100, 32, 20), material);
  mesh.name = "Meteorfall crimson Chaotic Skies 01";
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return {
    mesh,
    update(camera: T.Camera, time: number, layers: number) {
      mesh.position.copy(camera.position);
      material.uniforms.uTime.value = time;
      material.uniforms.uLayers.value = layers;
    },
  };
}
