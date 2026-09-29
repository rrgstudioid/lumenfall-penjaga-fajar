/// <reference types="vite/client" />
// Isolated UI fixture: real progression + production K-panel, no world or save IO.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JobSkill } from '../../components/game/job-skill';
import { GameDragDropProvider } from '../../components/game/drag-drop-provider';
import { JobPresentationContext } from '../../components/game/job-presentation-context';
import { createV3AdventurerHero, chooseCoreJob, chooseV3Thief, chooseSpecialization, learnSkill } from '../../lib/game/rules';
import type { SpecializationId } from '../../lib/game/skills';
import '../../app/globals.css';
import '../../app/character-panels.css';
import '../../app/character-screen.css';
import '../../app/drag-drop.css';
import './blade-master-offhand-ui.css';

function scenario(job: 'adventurer' | 'warrior' | 'thief', level: number, specialization?: SpecializationId) {
  const hero = createV3AdventurerHero('k-panel-fixture', 'K-panel Review');
  hero.level = level;
  hero.skillProgressionV3!.totalEarnedSP = 150; // Fixture-only budget, never player save.
  for (const slot of Object.keys(hero.equipment) as Array<keyof typeof hero.equipment>) hero.equipment[slot] = null;
  hero.inventory.forEach(item => { item.isEquipped = false; });
  if (job === 'thief') chooseV3Thief(hero);
  else if (job === 'warrior') chooseCoreJob(hero, job);
  if (job === 'thief') learnSkill(hero, 'v3-thief-quick-stab');
  if (specialization) chooseSpecialization(hero, specialization);
  return hero;
}
function Fixture() {
  const [hero, setHero] = useState(() => scenario('adventurer', 1));
  return <JobPresentationContext.Provider value={hero}><GameDragDropProvider game={null}>
    <main className="bm-fixture-shell" data-ready="true">
      <div className="bm-fixture-controls">
        <button onClick={() => setHero(scenario('adventurer', 1))}>Adventurer Lv1</button>
        <button onClick={() => setHero(scenario('warrior', 30))}>Warrior Lv30</button>
        <button onClick={() => setHero(scenario('thief', 30))}>Thief Lv30</button>
        <button onClick={() => setHero(scenario('thief', 60))}>Thief Lv60</button>
        {(['berserker', 'blade_master', 'rogue', 'assasin'] as const).map(spec => <button key={spec}
          onClick={() => setHero(scenario(spec === 'rogue' || spec === 'assasin' ? 'thief' : 'warrior', 60, spec))}>{spec}</button>)}
      </div>
      <section className="bm-fixture-panel"><JobSkill hero={hero} game={null} onMark={() => {}} /></section>
    </main>
  </GameDragDropProvider></JobPresentationContext.Provider>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Fixture />);
