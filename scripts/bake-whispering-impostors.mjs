// Bake small distant-tree derivatives from already-imported runtime meshes.
import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__wildsQA?.game?.started, null, {
    timeout: 120000,
  });
  const images = await page.evaluate(() => {
    const { three: T, game } = window.__wildsQA,
      output = [];
    const renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(512, 512);
    renderer.setClearColor(0, 0);
    for (const family of ['oak', 'willow', 'pine']) {
      const scene = new T.Scene(),
        seen = new Set();
      game.wilds.root.children
        .filter((o) => o.name === family + ' near')
        .forEach((o) => {
          if (seen.has(o.geometry)) return;
          seen.add(o.geometry);
          const m = new T.MeshBasicMaterial({
            map: o.material.map,
            color: o.material.color,
            alphaTest: 0.35,
            side: T.DoubleSide,
            toneMapped: false,
          });
          scene.add(new T.Mesh(o.geometry, m));
        });
      const box = new T.Box3().setFromObject(scene),
        center = box.getCenter(new T.Vector3()),
        span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 1.06;
      const camera = new T.OrthographicCamera(
        -span / 2,
        span / 2,
        span / 2,
        -span / 2,
        0.01,
        10,
      );
      camera.position.set(center.x, center.y, 3);
      camera.lookAt(center);
      renderer.render(scene, camera);
      output.push({
        family,
        image: renderer.domElement.toDataURL('image/png'),
        span,
        center: [center.x, center.y, center.z],
      });
      scene.traverse((o) => {
        if (o.isMesh) o.material.dispose();
      });
    }
    renderer.dispose();
    return output;
  });
  const dest = 'public/assets/materials/whispering-wilds';
  await mkdir(dest, { recursive: true });
  for (const { family, image } of images)
    await writeFile(
      `${dest}/${family}-far.png`,
      Buffer.from(image.split(',')[1], 'base64'),
    );
  await writeFile(
    `${dest}/impostors.json`,
    JSON.stringify(
      {
        source: 'Existing stylized-tree runtime GLBs, unmodified',
        resolution: 512,
        records: images.map(({ image: _image, ...r }) => r),
      },
      null,
      2,
    ),
  );
  console.log(
    images.map(({ family, span, center }) => ({ family, span, center })),
  );
} finally {
  await browser.close();
}
