import * as T from 'three';

const smooth = (low: number, high: number, v: number) => {
  const t = T.MathUtils.clamp((v - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Local, feathered sculpt on a private runtime clone. Bind pose/skin unchanged. */
export function applyCenaChinContour(model: T.Group) {
  if (model.userData.chinContour === 'soft-chin-v1') return;
  let found = false;
  model.traverse(object => {
    if (!(object instanceof T.SkinnedMesh) || object.name !== 'Cena_OBJ003') return;
    found = true;
    const geometry = object.geometry, position = geometry.attributes.position;
    const index = geometry.index;
    if (!index) throw new Error('Cena chin requires original indexed skin topology');
    // glTF may split coincident vertices at normals/material seams. Solve one
    // shared surface point so relaxation cannot open cracks between duplicates.
    const groups: number[][] = [], coords: T.Vector3[] = [], lookup = new Map<string, number>();
    const owners: number[] = [], neighbors: Set<number>[] = [];
    for (let i = 0; i < position.count; i++) {
      const p = new T.Vector3().fromBufferAttribute(position, i);
      const key = p.toArray().map(n => n.toFixed(6)).join(',');
      let id = lookup.get(key);
      if (id === undefined) { id = groups.length; lookup.set(key, id); groups.push([]); coords.push(p); neighbors.push(new Set()); }
      owners.push(id); groups[id].push(i);
    }
    for (let i = 0; i < index.count; i += 3) {
      const ids = [owners[index.getX(i)], owners[index.getX(i + 1)], owners[index.getX(i + 2)]];
      for (const a of ids) for (const b of ids) if (a !== b) neighbors[a].add(b);
    }
    const original = coords.map(p => p.clone());
    const weights = coords.map(p =>
      smooth(1.773, 1.79, p.y) * (1 - smooth(1.813, 1.828, p.y)) *
      (1 - smooth(.060, .098, Math.abs(p.x))) * smooth(.075, .105, p.z));
    for (let step = 0; step < 10; step++) {
      const next = coords.map(p => p.clone());
      for (let i = 0; i < coords.length; i++) {
        if (!weights[i] || !neighbors[i].size) continue;
        const average = new T.Vector3();
        for (const j of neighbors[i]) average.add(coords[j]);
        average.divideScalar(neighbors[i].size);
        next[i].lerp(average, .45 * weights[i]);
        const delta = next[i].clone().sub(original[i]);
        if (delta.length() > .006) next[i].copy(original[i]).add(delta.setLength(.006));
      }
      coords.splice(0, coords.length, ...next);
    }
    for (let i = 0; i < groups.length; i++) if (weights[i]) {
      for (const vertex of groups[i]) position.setXYZ(vertex, coords[i].x, coords[i].y, coords[i].z);
    }
    const oldNormals = geometry.attributes.normal.clone();
    geometry.computeVertexNormals();
    // Preserve original shading everywhere outside the sculpt falloff.
    const normal = geometry.attributes.normal, v = new T.Vector3(), old = new T.Vector3();
    for (let i = 0; i < position.count; i++) {
      old.fromBufferAttribute(oldNormals, i);
      if (!weights[owners[i]]) v.copy(old);
      else v.fromBufferAttribute(normal, i).lerp(old, 1 - weights[owners[i]]).normalize();
      normal.setXYZ(i, v.x, v.y, v.z);
    }
    position.needsUpdate = true; normal.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  });
  if (!found) throw new Error('Cena chin: expected original skin mesh not found');
  model.userData.chinContour = 'soft-chin-v1';
}
