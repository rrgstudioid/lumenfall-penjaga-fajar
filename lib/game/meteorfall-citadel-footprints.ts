import * as T from 'three';
import {
  meteorGroundHeight,
  meteorWalkable,
  meteorPlatform,
  type MeteorPoint,
} from './meteorfall-citadel-layout.ts';

export const MAGMA_FOOTPRINT_LIMIT = 128;
export const MAGMA_FOOTPRINT_LIFETIME = 6;
export type MagmaFootprint = MeteorPoint & {
  y: number;
  yaw: number;
  born: number;
};

/** Distance-based sampling: no prints at rest, on teleport, or outside walkable basalt. */
export class MagmaFootprints {
  readonly slots: Array<MagmaFootprint | undefined> = Array(
    MAGMA_FOOTPRINT_LIMIT,
  );
  private previous?: MeteorPoint;
  private distance = 0;
  private side = 1;
  private cursor = 0;
  update(p: MeteorPoint, time: number, dt: number, walking: boolean): number[] {
    const from = this.previous;
    this.previous = { x: p.x, z: p.z };
    if (!from || !walking || dt <= 0) {
      this.distance = 0;
      return [];
    }
    const dx = p.x - from.x,
      dz = p.z - from.z,
      length = Math.hypot(dx, dz);
    // Allows the existing developer Wings speed, but never draws trails across map teleports.
    if (length > Math.max(3, dt * 55)) {
      this.distance = 0;
      return [];
    }
    if (length < 0.00001) return [];
    const ux = dx / length,
      uz = dz / length,
      changed: number[] = [],
      spacing = 0.85;
    let along = spacing - this.distance;
    for (; along <= length + 1e-8; along += spacing) {
      const point = {
        x: from.x + ux * along + uz * 0.18 * this.side,
        z: from.z + uz * along - ux * 0.18 * this.side,
      };
      const ground = meteorGroundHeight(point);
      if (ground !== undefined && meteorWalkable(point, 0.4)) {
        const emblem = ['S', 'C', 'N', 'NW'].some((id) => {
          const q = meteorPlatform(id),
            r = id === 'N' ? 55 : id === 'C' ? 42 : 30;
          return Math.hypot(point.x - q.x, point.z - q.z) < r;
        });
        this.slots[this.cursor] = {
          ...point,
          y: ground + (emblem ? 0.19 : 0.085),
          yaw: Math.atan2(ux, uz),
          born: time,
        };
        changed.push(this.cursor);
        this.cursor = (this.cursor + 1) % MAGMA_FOOTPRINT_LIMIT;
      }
      this.side *= -1;
    }
    this.distance = Math.max(0, length - (along - spacing));
    return changed;
  }
  count(time: number) {
    return this.slots.filter(
      (p) => p && time - p.born < MAGMA_FOOTPRINT_LIFETIME,
    ).length;
  }
}

/** One pooled draw, no textures, emitters, point lights, or gameplay damage. */
export function createMagmaFootprints() {
  const prints = new MagmaFootprints(),
    born = new Float32Array(MAGMA_FOOTPRINT_LIMIT).fill(-100);
  const geometry = new T.PlaneGeometry(0.46, 0.78).rotateX(-Math.PI / 2);
  geometry.setAttribute('printBorn', new T.InstancedBufferAttribute(born, 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      lifetime: { value: MAGMA_FOOTPRINT_LIFETIME },
    },
    vertexShader: `attribute float printBorn;uniform float time;varying vec2 uvPrint;varying float age;
      void main(){uvPrint=uv;age=time-printBorn;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float lifetime;varying vec2 uvPrint;varying float age;
      void main(){if(age<0.||age>=lifetime)discard;
        vec2 p=(uvPrint-.5)*2.;float sole=min(length((p-vec2(0.,-.28))/vec2(.56,.54)),length((p-vec2(0.,.50))/vec2(.42,.28)));
        float shape=1.-smoothstep(.72,1.15,sole);if(shape<.005)discard;
        float cracks=pow(.5+.5*sin(p.x*21.+sin(p.y*15.)*3.),12.);
        float heat=1.-age/lifetime,fade=smoothstep(0.,.38,heat);
        vec3 c=mix(vec3(.55,.018,.001),vec3(2.4,.75,.045),heat)*(.55+.45*cracks);
        gl_FragColor=vec4(c,shape*fade*.9);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.InstancedMesh(geometry, material, MAGMA_FOOTPRINT_LIMIT);
  mesh.name = 'Cooling magma footsteps';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const dummy = new T.Object3D(),
    up = new T.Vector3(0, 1, 0),
    normal = new T.Vector3(),
    yaw = new T.Quaternion();
  return {
    mesh,
    update(p: MeteorPoint, time: number, dt: number, walking: boolean) {
      material.uniforms.time.value = time;
      const changed = prints.update(p, time, dt, walking);
      for (const i of changed) {
        const print = prints.slots[i]!,
          h = meteorGroundHeight(print)!;
        const x = meteorGroundHeight({ x: print.x + 0.2, z: print.z }) ?? h;
        const z = meteorGroundHeight({ x: print.x, z: print.z + 0.2 }) ?? h;
        normal.set((h - x) / 0.2, 1, (h - z) / 0.2).normalize();
        dummy.position.set(print.x, print.y, print.z);
        dummy.quaternion
          .setFromUnitVectors(up, normal)
          .multiply(yaw.setFromAxisAngle(up, print.yaw));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        born[i] = print.born;
      }
      if (changed.length) {
        mesh.instanceMatrix.needsUpdate = true;
        geometry.attributes.printBorn.needsUpdate = true;
      }
    },
    count: (time: number) => prints.count(time),
  };
}
