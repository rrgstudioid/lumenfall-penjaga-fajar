import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ImportedMapGround } from '../../lib/game/imported-map';
import type { ReviewObjectRecord } from './kingdom-capital-review';

const MAP_URL = '/dev-prototypes/mahkota-fajar-blend-v1/assets/LUMENFALL_Medieval_City.glb';

function zoneFor(x: number, z: number) {
  if (z > 52) return 'OUTER_FIELD';
  if (z > 20) return 'LOWER_CITY';
  if (z < -85) return 'CASTLE';
  if (z < -25) return 'UPPER_CITY';
  return 'CITY_CORE';
}

function objectRecords(root: T.Group): ReviewObjectRecord[] {
  const records: ReviewObjectRecord[] = [];
  const important = /LF_(MainGate|Castle|CityWall|Plaza|Blacksmith|Market|Road|Stair|Bridge|Farm|Tower|House|Gate|Keep|Water|Garden|Terrace)/i;
  root.updateWorldMatrix(true, true);
  root.traverse(object => {
    if (!(object instanceof T.Mesh) || records.length >= 1800) return;
    if (!important.test(object.name)) return;
    const box = new T.Box3().setFromObject(object);
    const center = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    if (size.x < 0.25 || size.y < 0.25 || size.z < 0.25) return;
    records.push({
      center: center.toArray() as [number, number, number],
      size: size.toArray() as [number, number, number],
      rotation: object.rotation.y,
      assetId: `blend-${object.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      assetName: object.name,
      family: /castle|keep/i.test(object.name) ? 'CASTLE' : /wall|gate|tower/i.test(object.name) ? 'ARCHITECTURE' : /tree|garden|vegetation/i.test(object.name) ? 'VEGETATION' : 'CITY OBJECT',
      chunk: 'blend-scene',
      zone: zoneFor(center.x, center.z),
      sourcePack: 'LUMENFALL_Medieval_City.blend · preserved GLB staging',
    });
  });
  return records;
}

export async function buildBlenderCandidate() {
  const gltf = await new GLTFLoader().loadAsync(MAP_URL);
  const root = gltf.scene;
  root.name = 'mahkota-fajar-blend-v1';
  root.updateMatrixWorld(true);

  // Ground materials are kept as a small collision subset. Vertical city
  // meshes remain visual-only here; this is an inspection map, not gameplay
  // collision authoring.
  const ground = new ImportedMapGround(root, ['GRASS', 'ROAD', 'COBBLE', 'ROCK', 'ROCK_LIGHT', 'WHEAT', '1001']);
  const records = objectRecords(root);
  const metrics = {
    objects: 0,
    meshes: 0,
    materials: new Set<string>(),
    triangles: 0,
    castle: 0,
    walls: 0,
    gates: 0,
    roads: 0,
    stairs: 0,
    buildings: 0,
    vegetation: 0,
    water: 0,
  };
  root.traverse(object => {
    metrics.objects++;
    if (!(object instanceof T.Mesh)) return;
    metrics.meshes++;
    metrics.triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) metrics.materials.add(material.name);
    const name = object.name;
    if (/castle|keep/i.test(name)) metrics.castle++;
    if (/wall|tower/i.test(name)) metrics.walls++;
    if (/gate/i.test(name)) metrics.gates++;
    if (/road|plaza/i.test(name)) metrics.roads++;
    if (/stair|step|tread/i.test(name)) metrics.stairs++;
    if (/house|blacksmith|market|building/i.test(name)) metrics.buildings++;
    if (/tree|garden|foliage|vegetation|bush/i.test(name)) metrics.vegetation++;
    if (/water|river|stream|pond/i.test(name)) metrics.water++;
  });

  const groundHeight = (x: number, z: number) => ground.heightAt(x, z) ?? 0;
  return {
    root,
    groundHeight,
    move: (point: { x: number; z: number }, dx: number, dz: number) => ground.move(point, dx, dz),
    reviewObjects: () => records,
    metrics: () => ({ ...metrics, materials: metrics.materials.size, triangles: Math.round(metrics.triangles) }),
    dispose() {
      root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      });
    },
  };
}
