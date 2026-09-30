'use client';

import { useState } from 'react';
import type { Game } from '@/lib/game/world';

export function PerformanceDiagnostics({ game }: { game: Game | null }) {
  const [report, setReport] = useState('');
  return <details style={{ marginTop: 12 }}>
    <summary>Diagnostik performa</summary>
    <p>Mainkan selama beberapa detik, lalu ambil laporan untuk membandingkan PC. Data hanya ditampilkan di perangkat ini.</p>
    <button className="secondary-button" disabled={!game} onClick={() => setReport(JSON.stringify(game?.getPerformanceDiagnostics(), null, 2))}>
      Ambil laporan performa
    </button>
    {report && <textarea aria-label="Laporan performa" readOnly value={report} rows={10}
      onFocus={event => event.currentTarget.select()}
      style={{ width: '100%', marginTop: 8, userSelect: 'text', fontFamily: 'monospace' }} />}
  </details>;
}
