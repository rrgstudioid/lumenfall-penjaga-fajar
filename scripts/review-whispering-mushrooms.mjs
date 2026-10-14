import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'output/whispering-mushrooms';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page.waitForFunction(() => window.__wildsQA?.three);
  const data = await page.evaluate(async () => {
    const T = window.__wildsQA.three;
    const { GLTFLoader } =
      await import('/@fs/D:/lumenfall-penjaga-fajar/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(
      '/assets/maps/whispering-wilds-v2/mushrooms/five-mushrooms.glb',
    );
    const scene = new T.Scene();
    scene.background = new T.Color('#172532');
    scene.add(new T.HemisphereLight('#e3f2ff', '#627653', 2));
    const sun = new T.DirectionalLight('#fff1d8', 3);
    sun.position.set(-3, 8, 5);
    scene.add(sun);
    gltf.scene.children.forEach(
      (mesh, i) => (mesh.position.x = (i - 2) * 1.18),
    );
    scene.add(gltf.scene);
    const camera = new T.PerspectiveCamera(42, 2, 0.01, 100);
    camera.position.set(0, 1.9, 4.7);
    camera.lookAt(0, 0.45, 0);
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(1600, 800);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.render(scene, camera);
    const png = renderer.domElement.toDataURL().split(',')[1];
    renderer.dispose();
    return png;
  });
  await writeFile(`${output}/five-variants.png`, Buffer.from(data, 'base64'));
  console.log(`${output}/five-variants.png`);
} finally {
  await browser.close();
}
