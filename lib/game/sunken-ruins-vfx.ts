import * as T from 'three';
import { SUNKEN_QUALITY } from './sunken-ruins-quality.ts';
import { SUNKEN_HABITATS, marinePose } from './sunken-ruins-marine-motion.ts';
import type { GraphicsQuality } from './graphics-quality.ts';
import { sunkenGroundHeight } from './sunken-ruins-layout.ts';

/** Marine life belongs to world habitats; the observer only controls culling. */
export function createSunkenVfx(
  kit: Map<string, T.BufferGeometry>,
  quality: GraphicsQuality,
  heightAt = sunkenGroundHeight,
) {
  const root = new T.Group();
  root.name = 'Sunken ambience (non-targetable)';
  const owned: T.Material[] = [],
    geometries: T.BufferGeometry[] = [];
  const dummy = new T.Object3D(),
    color = new T.Color(),
    clock = { value: 0 };
  const mat = (kind: 'fish' | 'jellyfish' | 'ray') => {
    const m = new T.MeshPhysicalMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: kind === 'jellyfish' ? 0.24 : 0.46,
      metalness: 0,
      clearcoat: kind === 'fish' ? 0.25 : 0.1,
      transparent: kind === 'jellyfish',
      opacity: kind === 'jellyfish' ? 0.48 : 1,
      depthWrite: kind !== 'jellyfish',
      side: T.DoubleSide,
      emissive: kind === 'jellyfish' ? '#6487ad' : '#000000',
      emissiveIntensity: 0.28,
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.marineTime = clock;
      s.vertexShader = 'uniform float marineTime;\n' + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float phase=marineTime*5.0;
        #ifdef USE_INSTANCING
        phase+=instanceMatrix[3].x*.7+instanceMatrix[3].z*.3;
        #endif
        ${kind === 'fish' ? 'float tail=smoothstep(-.18,.75,position.x);transformed.z+=sin(phase-position.x*4.0)*tail*tail*.14;' : kind === 'ray' ? 'transformed.y+=sin(marineTime*2.1+abs(position.x)*2.8)*pow(abs(position.x),1.7)*.19;' : 'transformed.x+=sin(phase*.3-position.y*3.0)*max(0.0,-position.y)*.07;transformed.xz*=1.0+sin(marineTime*1.8+phase*.1)*.06;'}
      `,
      );
    };
    m.customProgramCacheKey = () => `marine-organic-2-${kind}`;
    owned.push(m);
    return m;
  };
  const fish = new T.InstancedMesh(kit.get('fish')!, mat('fish'), 96);
  const jelly = new T.InstancedMesh(kit.get('jellyfish')!, mat('jellyfish'), 8);
  const rays = new T.InstancedMesh(kit.get('ray')!, mat('ray'), 4);
  for (const [mesh, name] of [
    [fish, 'fish'],
    [jelly, 'jellyfish'],
    [rays, 'ray'],
  ] as const) {
    mesh.name = `World marine ${name}`;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.userData.marineKind = name;
    root.add(mesh);
  }
  const positions = new Float32Array(320 * 3);
  const pg = new T.BufferGeometry();
  pg.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometries.push(pg);
  const pm = new T.PointsMaterial({
    color: '#e0fff9',
    size: 0.055,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  owned.push(pm);
  const bubbles = new T.Points(pg, pm);
  bubbles.frustumCulled = false;
  root.add(bubbles);
  const shaftGeometry = new T.CylinderGeometry(0.7, 3.5, 42, 8, 1, true);
  geometries.push(shaftGeometry);
  const shaftMat = new T.ShaderMaterial({
    uniforms: { marineTime: clock },
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    vertexShader:
      'varying vec2 vUv;varying vec3 vView;varying vec3 shaftNormal;void main(){vUv=uv;shaftNormal=normalMatrix*normal;vec4 mv=modelViewMatrix*vec4(position,1.);vView=mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform float marineTime;varying vec2 vUv;varying vec3 vView;varying vec3 shaftNormal;
      void main(){float ends=pow(sin(vUv.y*3.14159),1.5);float ribs=.7+.3*sin(vUv.x*37.+marineTime*.13);
      float farFade=1.-smoothstep(65.,110.,length(vView));float nearFade=smoothstep(3.,9.,length(vView));
      float softEdge=pow(abs(dot(normalize(shaftNormal),normalize(vView))),1.6);
      gl_FragColor=vec4(.64,.92,1.,ends*ribs*farFade*nearFade*softEdge*.064);}`,
  });
  owned.push(shaftMat);
  const shafts = Array.from({ length: 10 }, () => {
    const m = new T.Mesh(shaftGeometry, shaftMat);
    root.add(m);
    return m;
  });
  const waterGeometry = new T.PlaneGeometry(2800, 2800);
  geometries.push(waterGeometry);
  const waterMaterial = new T.ShaderMaterial({
    uniforms: { marineTime: clock },
    // A free camera above the water ceiling must still be able to inspect the map.
    side: T.BackSide,
    depthWrite: false,
    transparent: true,
    vertexShader:
      'varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
    fragmentShader: `uniform float marineTime;varying vec3 p;
      float wave(vec2 q){return sin(q.x*.19+sin(q.y*.14+marineTime*.22))*1.2+sin(q.y*.28-q.x*.09-marineTime*.31)*.5+sin(q.x*.71+q.y*.62+marineTime*.4)*.09;}
      void main(){float h=wave(p.xz);vec3 n=normalize(vec3((wave(p.xz+vec2(.2,0.))-h)/.2,-1.,(wave(p.xz+vec2(0.,.2))-h)/.2));
      vec3 eye=normalize(cameraPosition-p);float fresnel=pow(1.-abs(dot(eye,n)),3.);
      float windowLight=pow(max(0.,dot(-eye,normalize(vec3(-.18,1.,.12)))+n.x*.16+n.z*.12),10.);
      vec3 water=mix(vec3(.12,.59,.73),vec3(.65,.91,.94),clamp(windowLight*.6,0.,.8));
      water=mix(water,vec3(.06,.40,.58),fresnel*.55);water+=h*.007;
      float haze=(1.-smoothstep(80.,230.,distance(cameraPosition,p)))*smoothstep(.04,.32,abs(eye.y));
      gl_FragColor=vec4(water,.88*haze);}`,
  });
  owned.push(waterMaterial);
  const ceiling = new T.Mesh(waterGeometry, waterMaterial);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = 43;
  ceiling.name = 'World water surface';
  root.add(ceiling);
  function update(p: { x: number; y?: number; z: number }, dt: number) {
    clock.value += Math.min(0.1, Math.max(0, dt));
    const t = clock.value,
      q = SUNKEN_QUALITY[quality];
    const habitats = SUNKEN_HABITATS.filter(
      (h) => Math.hypot(h.x - p.x, h.z - p.z) < 100,
    );
    for (const [mesh, kind, perHabitat, limit] of [
      [fish, 'fish', 12, q.fish],
      [jelly, 'jellyfish', 1, quality === 'office' ? 3 : 8],
      [rays, 'ray', 1, quality === 'office' ? 1 : 3],
    ] as const) {
      let count = 0;
      const ids: string[] = [];
      for (const h of habitats) {
        for (let i = 0; i < perHabitat && count < limit; i++) {
          const pose = marinePose(h, i, t, kind, heightAt);
          dummy.position.set(pose.x, pose.y, pose.z);
          dummy.rotation.set(0, pose.yaw, 0);
          dummy.scale.setScalar(
            kind === 'ray'
              ? 1.45
              : kind === 'jellyfish'
                ? 0.65
                : 0.55 + (i % 4) * 0.075,
          );
          dummy.updateMatrix();
          mesh.setMatrixAt(count, dummy.matrix);
          if (kind === 'fish') {
            color.set(['#fff2cc', '#bfe5ff', '#d5f2eb', '#ebcd90'][h.id % 4]);
            mesh.setColorAt(count, color);
          }
          ids.push(`${kind}:${h.id}:${i}`);
          count++;
        }
        if (count >= limit) break;
      }
      mesh.count = count;
      mesh.userData.marineIds = ids;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const bx = Math.floor(p.x / 32),
      bz = Math.floor(p.z / 32);
    for (let i = 0; i < q.particles; i++) {
      const cell = i % 9,
        cx = bx + (cell % 3) - 1,
        cz = bz + Math.floor(cell / 3) - 1,
        seed = Math.floor(i / 9) + cx * 157 + cz * 311;
      positions[i * 3] = cx * 32 + (Math.sin(seed * 127.1) * 0.5 + 0.5) * 32;
      positions[i * 3 + 1] = (((seed * 0.61 + t * 0.15) % 28) + 28) % 28;
      positions[i * 3 + 2] =
        cz * 32 + (Math.cos(seed * 311.7) * 0.5 + 0.5) * 32;
    }
    pg.setDrawRange(0, q.particles);
    pg.attributes.position.needsUpdate = true;
    const lightCells: { x: number; z: number; d: number }[] = [];
    for (let z = bz - 3; z <= bz + 3; z++)
      for (let x = bx - 3; x <= bx + 3; x++) {
        const wx = x * 32 + Math.sin(x * 12 + z * 7) * 9,
          wz = z * 32 + Math.cos(z * 11 + x * 3) * 9;
        lightCells.push({ x: wx, z: wz, d: Math.hypot(wx - p.x, wz - p.z) });
      }
    lightCells.sort((a, b) => a.d - b.d);
    shafts.forEach((s, i) => {
      s.visible = i < q.shafts;
      s.position.set(lightCells[i].x, 22, lightCells[i].z);
      s.rotation.set(0.18, 0, -0.22);
    });
  }
  return {
    root,
    update,
    setQuality(q: GraphicsQuality) {
      quality = q;
    },
    metrics: () => ({
      fish: fish.count,
      jellyfish: jelly.count,
      rays: rays.count,
      particles: SUNKEN_QUALITY[quality].particles,
      shafts: SUNKEN_QUALITY[quality].shafts,
    }),
    dispose() {
      root.removeFromParent();
      fish.dispose();
      jelly.dispose();
      rays.dispose();
      geometries.forEach((g) => g.dispose());
      owned.forEach((m) => m.dispose());
      root.clear();
    },
  };
}
