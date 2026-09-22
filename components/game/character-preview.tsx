'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Hero } from '@/lib/game/rules';
import { getCharacterEquipmentLayers } from '@/lib/game/character-view';

export function CharacterPreview({ hero, presentation = 'equipment' }: { hero: Hero; presentation?: 'equipment' | 'menu' }) {
  const menu = presentation === 'menu';
  const host = useRef<HTMLDivElement>(null);
  const rotation = useRef({ y: Math.PI + 0.3, zoom: menu ? 4.5 : 5.9, x: 0, active: false });
  const activePreview = useRef<{ actor: import('three').Group; camera: import('three').PerspectiveCamera } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const buildModel = useEffectEvent(
    (
      factory: typeof import('@/lib/game/character-model').createCharacterModel,
    ) => factory(hero),
  );
  // Only equipment/job changes recreate the small preview; combat snapshots do not.
  const key = JSON.stringify([
    hero.gender,
    hero.appearance,
    hero.coreJob,
    hero.specialization,
    getCharacterEquipmentLayers(hero).map((layer) => [
      layer.slot,
      layer.item.id,
      layer.item.templateId,
      layer.item.rarity,
      layer.item.equipmentType,
      layer.item.enhancementLevel,
    ]),
  ]);
  useEffect(() => {
    let cancelled = false,
      cleanup: (() => void) | undefined;
    Promise.all([import('three'), import('@/lib/game/character-model')])
      .then(([T, { createCharacterModel, disposeCharacterModel, updateCharacterAura, updateCharacterBillboards }]) => {
        if (cancelled || !host.current) return;
        const container = host.current,
          scene = new T.Scene(),
          camera = new T.PerspectiveCamera(33, 1, 0.1, 30);
        const renderer = new T.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.domElement.setAttribute(
          'aria-label',
          menu ? 'Preview karakter 3D' : 'Preview equipment karakter 3D',
        );
        container.appendChild(renderer.domElement);
        const model = buildModel(createCharacterModel);
        setLoading(true);
        setUnavailable(false);
        void model.ready.then(loaded => {
          if (cancelled) return;
          setLoading(false);
          setUnavailable(!loaded);
        });
        model.actor.rotation.y = rotation.current.y;
        activePreview.current = { actor: model.actor, camera };
        scene.add(model.actor);
        scene.add(new T.HemisphereLight('#fff4da', '#36524d', 2.8));
        const light = new T.DirectionalLight('#f7dfb4', 3);
        light.position.set(3, 4, 5);
        scene.add(light);
        camera.position.set(0, 1.3, rotation.current.zoom);
        camera.lookAt(0, 1.15, 0);
        const resize = () => {
          const width = Math.max(1, container.clientWidth),
            height = Math.max(1, container.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.position.z = Math.max(rotation.current.zoom, menu ? 2.9 / camera.aspect : 0);
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };
        let frame = 0, lastTime = 0, time = 0, visible = true;
        const draw = (now: number) => {
          frame = requestAnimationFrame(draw);
          if (!visible || document.hidden) { lastTime = now; return; }
          const dt = (now - (lastTime || now)) / 1000;
          if (lastTime && dt < 1 / 30) return;
          lastTime = now; time += Math.min(dt, .05);
          model.animator.update(Math.min(dt, .05));
          updateCharacterAura(model.aura, time, Math.min(dt, .05));
          updateCharacterBillboards(model.aura, camera);
          renderer.render(scene, camera);
        };
        const visibility = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; });
        visibility.observe(container);
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        frame = requestAnimationFrame(draw);
        cleanup = () => {
          cancelAnimationFrame(frame);
          visibility.disconnect();
          observer.disconnect();
          disposeCharacterModel(model.actor);
          activePreview.current = null;
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        if (!cancelled) { setUnavailable(true); setLoading(false); }
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [key, menu]);
  const zoom = (delta: number) => {
    rotation.current.zoom = Math.max(menu ? 3.5 : 4.2, Math.min(8.2, rotation.current.zoom + delta));
    if (activePreview.current) {
      const camera = activePreview.current.camera;
      camera.position.z = Math.max(rotation.current.zoom, menu ? 2.9 / camera.aspect : 0);
      camera.lookAt(0, 1.15, 0);
    }
  };
  useEffect(() => {
    const surface = host.current;
    if (!surface) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom(event.deltaY * .006); };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => surface.removeEventListener('wheel', wheel);
  }, [menu]);
  return (
    <div
      className="character-preview"
      aria-label="Character model"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        rotation.current.active = true;
        rotation.current.x = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!rotation.current.active) return;
        rotation.current.y += (event.clientX - rotation.current.x) * 0.012;
        rotation.current.x = event.clientX;
        if (activePreview.current) activePreview.current.actor.rotation.y = rotation.current.y;
      }}
      onPointerUp={() => { rotation.current.active = false; }}
      onPointerCancel={() => { rotation.current.active = false; }}
    >
      <div ref={host} className="character-preview-canvas" />
      {menu && loading && <p className="menu-preview-status" role="status">Memuat karakter...</p>}
      {unavailable && (
        <p>
          Preview 3D belum dapat dimuat. Save karakter tetap aman.
        </p>
      )}
      {menu ? <div className="menu-preview-controls">
        <button type="button" aria-label="Putar karakter ke kiri" onClick={() => { rotation.current.y -= .35; if (activePreview.current) activePreview.current.actor.rotation.y = rotation.current.y; }}>↶</button>
        <span>Drag untuk memutar</span>
        <button type="button" aria-label="Putar karakter ke kanan" onClick={() => { rotation.current.y += .35; if (activePreview.current) activePreview.current.actor.rotation.y = rotation.current.y; }}>↷</button>
        <button type="button" aria-label="Perkecil karakter" onClick={() => zoom(.35)}>−</button>
        <button type="button" aria-label="Perbesar karakter" onClick={() => zoom(-.35)}>+</button>
      </div> : <><span className="preview-plinth">{hero.characterName}</span><small>LIVE EQUIPMENT PREVIEW</small></>}
    </div>
  );
}
