/** Staged Tripo models are normalized to these world-scale landmarks, originals stay untouched. */
export const SUNKEN_ARTIFACTS = [
  {
    name: 'sunken-shipwreck',
    label: 'The Lost Merchant',
    x: -310,
    z: 65,
    yaw: 0.35,
    radius: 30,
    height: 22.06,
  },
  {
    name: 'sunken-shipwreck',
    label: 'Abyssal Voyager',
    x: -335,
    z: -160,
    yaw: -0.65,
    radius: 30,
    height: 22.06,
  },
  {
    name: 'sunken-shipwreck',
    label: 'Eastern Tidebreaker',
    x: 340,
    z: 110,
    yaw: 0.85,
    radius: 30,
    height: 22.06,
  },
  {
    name: 'neptune-statue',
    label: 'Neptune of the Ancient Sea',
    x: 95,
    z: -100,
    yaw: 0.15,
    radius: 6,
    height: 16,
  },
  {
    name: 'sunken-astrolabe',
    label: 'Celestial Relic',
    x: -59,
    z: -73,
    yaw: 0.5,
    radius: 4,
    height: 5,
  },
  {
    name: 'sunken-astrolabe',
    label: 'Navigator Relic',
    x: -280,
    z: 100,
    yaw: -0.4,
    radius: 4,
    height: 5,
  },
  ...[
    [-345, 96],
    [-341, 99],
    [-343, 103],
    [-283, 47],
    [-279, 49],
    [-23, -77],
  ].map(([x, z], i) => ({
    name: 'ancient-amphora',
    label: 'Ancient Amphora',
    x,
    z,
    yaw: i * 0.9,
    radius: 1.5,
    height: 2.8,
  })),
];
/** Real lower-body capsule footprints, kept separate from decorative tridents and spars. */
export const SUNKEN_ARTIFACT_COLLIDERS = SUNKEN_ARTIFACTS.flatMap((p) => {
  const radius =
    p.name === 'sunken-shipwreck'
      ? 8.2
      : p.name === 'ancient-amphora'
        ? 1
        : p.name === 'neptune-statue'
          ? 3.2
          : 2;
  const centers = p.name === 'sunken-shipwreck' ? [-14, -7, 0, 7, 12] : [0];
  return centers.map((x) => ({
    x: p.x + x * Math.cos(p.yaw),
    z: p.z - x * Math.sin(p.yaw),
    radius,
    height: p.height,
  }));
});

export const sunkenArtifactAsset = (name: string) =>
  `/__sunken-dev/${name === 'neptune-statue' ? 'revision12' : 'revision6'}/${name}.glb`;
