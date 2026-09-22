// Isolated development harness: never reads/writes player saves, never shipped as a route.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JobSkill } from '../../components/game/job-skill';
import { GameDragDropProvider } from '../../components/game/drag-drop-provider';
import {
  createV2TestHero,
  authorizeV2Warrior,
  learnSkill,
  learnPassive,
  freshHero,
} from '../../lib/game/rules';
import type { Game } from '../../lib/game/world';
import '../../app/globals.css';
import '../../app/character-panels.css';
import '../../app/drag-drop.css';
function fixture() {
  const h = createV2TestHero();
  h.level = 59;
  h.skillPoints = 58;
  authorizeV2Warrior(h);
  return h;
}
function App() {
  const [hero, setHero] = useState(fixture);
  const game = {
    hero,
    started: true,
    setHotbarInteraction: () => {},
    learnSkill: (id: string) => {
      const h = structuredClone(hero);
      learnSkill(h, id);
      setHero(h);
    },
    learnPassive: (id: string) => {
      const h = structuredClone(hero);
      learnPassive(h, id);
      setHero(h);
    },
  } as unknown as Game;
  return (
    <GameDragDropProvider game={game}>
      <main
        style={{
          height: '100vh',
          background: '#151b19',
          padding: 16,
          color: '#eee',
        }}
      >
        <h1>Isolated Warrior V2 K panel — no player save access</h1>
        <button onClick={() => setHero(fixture())}>
          Reset V2 fixture
        </button>{' '}
        <button
          onClick={() => {
            const h = freshHero();
            h.level = 50;
            h.coreJob = 'warrior';
            setHero(h);
          }}
        >
          Legacy comparison
        </button>
        <div style={{ height: 'calc(100vh - 110px)', overflow: 'auto' }}>
          <JobSkill
            key={hero.progressionArchitecture ?? 'legacy'}
            hero={hero}
            game={game}
            onMark={() => {}}
          />
        </div>
      </main>
    </GameDragDropProvider>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
