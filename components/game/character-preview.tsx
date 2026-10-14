'use client';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Hero } from '@/lib/game/rules';
import { getCharacterEquipmentLayers } from '@/lib/game/character-view';

export function CharacterPreview({ hero, presentation = 'equipment' }: { hero: Hero; presentation?: 'equipment' | 'menu' }) {
  const menu = presentation === 'menu';
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt,setAttempt]=useState(0);
  const host = useRef<HTMLDivElement>(null);
  const rotation = useRef({ y: Math.PI + 0.3, zoom: menu ? 4.5 : 5.9, x: 0, active: false });
  const activePreview = useRef<{ actor: import('three').Group; camera: import('three').PerspectiveCamera; model: import('@/lib/game/character-model').CharacterModel } | null>(null);
  const rendererRef=useRef<import('three').WebGLRenderer|null>(null);
  const invalidateRef=useRef<()=>void>(()=>{});
  useEffect(()=>()=>{rendererRef.current?.dispose();rendererRef.current?.forceContextLoss();rendererRef.current?.domElement.remove();rendererRef.current=null;},[]);
  useEffect(()=>{
    let cancelled=false;
    const preview=activePreview.current;
    if(preview)void preview.model.setAppearance(hero.appearance).then(()=>{if(!cancelled)invalidateRef.current();}).catch(()=>{if(!cancelled)setUnavailable(true);});
    return()=>{cancelled=true;};
  },[hero.appearance]);
  const buildModel = useEffectEvent(
    (
      factory: typeof import('@/lib/game/character-model').createCharacterModel,
      renderer: import('three').WebGLRenderer,
    ) => factory(hero,{renderer,quality:menu?'light':undefined,preview:menu,onVisualChange:()=>invalidateRef.current()}),
  );
  // Only equipment/job changes recreate the small preview; combat snapshots do not.
  const key = JSON.stringify([
    hero.gender,
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
        const renderer = rendererRef.current ?? new T.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        rendererRef.current=renderer;
        // This canvas is a UI viewport, not a full-resolution game framebuffer.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        renderer.domElement.setAttribute(
          'aria-label',
          menu ? 'Preview karakter 3D' : 'Preview equipment karakter 3D',
        );
        container.appendChild(renderer.domElement);
        const model = buildModel(createCharacterModel,renderer);
        setLoading(true);
        setUnavailable(false);
        void model.ready.then(loaded => {
          if (cancelled) return;
          setLoading(false);
          setUnavailable(!loaded);
          invalidateRef.current();
        });
        model.actor.rotation.y = rotation.current.y;
        activePreview.current = { actor: model.actor, camera, model };
        scene.add(model.actor);
        scene.add(new T.HemisphereLight('#fff4da', '#36524d', 2.8));
        const light = new T.DirectionalLight('#f7dfb4', 3);
        light.position.set(3, 4, 5);
        scene.add(light);
        // Neutral fill keeps custom dyes readable when turning the head around.
        const fill = new T.DirectionalLight('#e3edff', 1.4);
        fill.position.set(-3, 2, -4);
        scene.add(fill);
        camera.position.set(0, 1.3, rotation.current.zoom);
        camera.lookAt(0, 1.15, 0);
        const resize = () => {
          const width = Math.max(1, container.clientWidth),
            height = Math.max(1, container.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.position.z = Math.max(rotation.current.zoom, menu ? 2.9 / camera.aspect : 0);
          camera.updateProjectionMatrix();
          invalidateRef.current();
        };
        let frame = 0, lastTime = 0, time = 0, visible = true;
        const invalidate = () => {
          if (!frame && visible && !document.hidden) frame=requestAnimationFrame(draw);
        };
        const draw = (now: number) => {
          frame = 0;
          if (!visible || document.hidden) { lastTime = now; return; }
          const dt = Math.min(.05, (now - (lastTime || now - 16.67)) / 1000);
          if (!menu && lastTime && dt < 1 / 30) {invalidate();return;}
          lastTime = now; time += Math.min(dt, .05);
          // Creation holds a stable pose. Render only edits/camera transitions;
          // equipment preview retains its animated presentation.
          if (!menu) model.animator.update(Math.min(dt, .05));
          const targetY=1.15;
          camera.position.y+=(targetY+.15-camera.position.y)*Math.min(1,dt*8);
          const targetZ=Math.max(rotation.current.zoom,menu?2.9/camera.aspect:0);
          camera.position.z+=(targetZ-camera.position.z)*Math.min(1,dt*8);
          camera.lookAt(0,targetY,0);
          updateCharacterAura(model.aura, time, Math.min(dt, .05));
          updateCharacterBillboards(model.aura, camera);
          renderer.render(scene, camera);
          if (!menu || Math.abs(camera.position.y-targetY-.15)>.001 || Math.abs(camera.position.z-targetZ)>.001) invalidate();
        };
        invalidateRef.current=invalidate;
        const onVisibility=()=>{lastTime=0;invalidate();};
        document.addEventListener('visibilitychange',onVisibility);
        const visibility = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false;invalidate(); });
        visibility.observe(container);
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        invalidate();
        cleanup = () => {
          cancelAnimationFrame(frame);
          invalidateRef.current=()=>{};
          document.removeEventListener('visibilitychange',onVisibility);
          visibility.disconnect();
          observer.disconnect();
          disposeCharacterModel(model.actor);
          activePreview.current = null;
        };
      })
      .catch(() => {
        if (!cancelled) { setUnavailable(true); setLoading(false); }
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [key, menu,attempt]);
  const zoom = useCallback((delta: number) => {
    rotation.current.zoom = Math.max(menu ? 3.5 : 4.2, Math.min(8.2, rotation.current.zoom + delta));
    if (activePreview.current) {
      const camera = activePreview.current.camera;
      camera.position.z = Math.max(rotation.current.zoom, menu ? 2.9 / camera.aspect : 0);
      camera.lookAt(0, 1.15, 0);
      invalidateRef.current();
    }
  }, [menu]);
  useEffect(() => {
    const surface = host.current;
    if (!surface) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom(event.deltaY * .006); };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => surface.removeEventListener('wheel', wheel);
  }, [zoom]);
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
        invalidateRef.current();
      }}
      onPointerUp={() => { rotation.current.active = false; }}
      onPointerCancel={() => { rotation.current.active = false; }}
    >
      <div ref={host} className="character-preview-canvas" />
      {menu && loading && <output className="menu-preview-status">Memuat karakter...</output>}
      {unavailable && (
        <div className="menu-preview-status"><p>Preview 3D belum dapat dimuat. Save karakter tetap aman.</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Coba lagi</button></div>
      )}
      {menu ? <div className="menu-preview-controls">
        <button type="button" aria-label="Putar karakter ke kiri" onClick={() => { rotation.current.y -= .35; if (activePreview.current) activePreview.current.actor.rotation.y = rotation.current.y; invalidateRef.current(); }}>↶</button>
        <span>Drag untuk memutar</span>
        <button type="button" aria-label="Putar karakter ke kanan" onClick={() => { rotation.current.y += .35; if (activePreview.current) activePreview.current.actor.rotation.y = rotation.current.y; invalidateRef.current(); }}>↷</button>
        <button type="button" aria-label="Perkecil karakter" onClick={() => zoom(.35)}>−</button>
        <button type="button" aria-label="Perbesar karakter" onClick={() => zoom(-.35)}>+</button>
        <button type="button" aria-label="Reset kamera" onClick={()=>{rotation.current.y=Math.PI+.3;rotation.current.zoom=4.5;if(activePreview.current)activePreview.current.actor.rotation.y=rotation.current.y;invalidateRef.current();}}>Reset</button>
      </div> : <><span className="preview-plinth">{hero.characterName}</span><small>LIVE EQUIPMENT PREVIEW</small></>}
    </div>
  );
}
