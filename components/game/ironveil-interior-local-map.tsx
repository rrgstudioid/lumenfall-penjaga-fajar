'use client';
import { useEffect, useRef } from 'react';
import {
  drawMineLocalMinimap,
  MINE_HUD_MINIMAP_VIEW_SIZE,
} from '@/lib/game/ironveil-interior-layout';
export function IronveilInteriorLocalMap({ x, z }: { x: number; z: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx)
      drawMineLocalMinimap(
        ctx,
        1000,
        { x, z },
        {},
        MINE_HUD_MINIMAP_VIEW_SIZE,
      );
  }, [x, z]);
  return (
    <div className="dialog-stack">
      <span className="eyebrow">NEARBY AREA ONLY</span>
      <h3>Ironveil Mines · Interior</h3>
      <p>
        The map follows your position and only shows the nearby cave. Follow the
        rails toward the southern entrance and click “To Outside Mines” to leave.
      </p>
      <canvas
        ref={ref}
        width={1000}
        height={1000}
        aria-label="Local view of the cave map centered on the player"
        style={{
          width: '100%',
          maxHeight: '65vh',
          objectFit: 'contain',
          background: '#101215',
          border: '1px solid #725f3d',
        }}
      />
    </div>
  );
}
