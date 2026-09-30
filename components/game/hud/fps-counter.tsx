'use client';
import { memo, useEffect, useState } from 'react';
import type { Game } from '@/lib/game/world';

/** Only this text updates; no full HUD snapshot or renderer diagnostics polling. */
export const FPSCounter = memo(function FPSCounter({
  game,
}: {
  game: Game | null;
}) {
  const [fps, setFPS] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(
      () => setFPS(game?.getCurrentFPS() ?? null),
      250,
    );
    return () => window.clearInterval(timer);
  }, [game]);
  return (
    <span className="hud-fps-text" aria-live="off">
      FPS: {fps ?? '—'}
    </span>
  );
});
