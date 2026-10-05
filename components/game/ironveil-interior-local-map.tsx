'use client';
import { useEffect, useRef } from 'react';
import { drawMineMinimap } from '@/lib/game/ironveil-interior-layout';
export function IronveilInteriorLocalMap({ x, z }: { x: number; z: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawMineMinimap(ctx, 1000, { x, z });
  }, [x, z]);
  return (
    <div className="dialog-stack">
      <span className="eyebrow">LOCAL CAVE MAP</span>
      <h3>Ironveil Mines · Interior</h3>
      <p>
        Follow the rails back to the southern entrance and click “To Outside
        Mines” to leave.
      </p>
      <canvas
        ref={ref}
        width={1000}
        height={1000}
        aria-label="Ironveil cave: fourteen connected chambers and one southern exit"
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
