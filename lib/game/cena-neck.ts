import * as T from 'three';

const smooth = (a: number, b: number, value: number) => T.MathUtils.smoothstep(value, a, b);

/** Smooth only the cervical skin-weight field on a private Cena clone.
 * Geometry, rest bones and the head/shoulder/finger influences stay authoritative.
 */
export function softenCenaNeckWeights(model: T.Group) {
  if (model.userData.neckWeights === 'cervical-blend-v1') return;
  model.traverse(object => {
    if (!(object instanceof T.SkinnedMesh) || object.name !== 'Cena_OBJ003') return;
    const g = object.geometry, positions = g.attributes.position;
    const indices = g.attributes.skinIndex, weights = g.attributes.skinWeight;
    const boneIds = ['spine_03', 'neck_01', 'head'].map(name => object.skeleton.bones.findIndex(b => b.name === name));
    if (boneIds.some(id => id < 0) || !g.index) throw new Error('Cena neck requires original cervical rig and topology');
    const neighbors = Array.from({ length: positions.count }, () => new Set<number>());
    for (let i = 0; i < g.index.count; i += 3) {
      const triangle = [g.index.getX(i), g.index.getX(i + 1), g.index.getX(i + 2)];
      for (const a of triangle) for (const b of triangle) if (a !== b) neighbors[a].add(b);
    }
    const original = Array.from({ length: positions.count }, (_, i) => boneIds.map(id => {
      let value = 0;
      for (let c = 0; c < 4; c++) if (indices.getComponent(i, c) === id) value += weights.getComponent(i, c);
      return value;
    }));
    const mask = original.map((values, i) => values.reduce((a, b) => a + b, 0) < .99999 ? 0 :
      smooth(1.62, 1.66, positions.getY(i)) * (1 - smooth(1.765, 1.80, positions.getY(i))) *
      (1 - smooth(.065, .12, Math.abs(positions.getX(i)))));
    let field = original.map(values => [...values]);
    for (let step = 0; step < 12; step++) {
      field = field.map((values, i) => {
        if (!mask[i] || !neighbors[i].size) return values;
        const next = [0, 0, 0];
        for (const neighbor of neighbors[i]) for (let c = 0; c < 3; c++) next[c] += field[neighbor][c] / neighbors[i].size;
        const sum = next.reduce((a, b) => a + b, 0);
        if (sum < .99) return values;
        return values.map((value, c) => T.MathUtils.lerp(value, next[c] / sum, .5 * mask[i]));
      });
    }
    for (let i = 0; i < field.length; i++) if (mask[i]) {
      const total = field[i].reduce((a, b) => a + b, 0);
      indices.setXYZW(i, ...boneIds as [number, number, number], 0);
      weights.setXYZW(i, field[i][0] / total, field[i][1] / total, field[i][2] / total, 0);
    }
    indices.needsUpdate = true; weights.needsUpdate = true;
  });
  model.userData.neckWeights = 'cervical-blend-v1';
}
