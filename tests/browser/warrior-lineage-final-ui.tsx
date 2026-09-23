// Development-only acceptance fixture. It renders the exact production V3
// trainer, K-panel and Character Overview without reading/writing player saves.
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { V3JobTrainer } from '../../components/game/v3-job-trainer';
import { JobArchitecturePreview } from '../../components/game/job-architecture-preview';
import { JobSkill } from '../../components/game/job-skill';
import { CharacterOverview } from '../../components/game/character-overview';
import { JobPresentationContext } from '../../components/game/job-presentation-context';
import { GameDragDropProvider } from '../../components/game/drag-drop-provider';
import {
  chooseCoreJob,
  chooseSpecialization,
  createV3AdventurerHero,
  equipItem,
  learnSkill,
  warriorLineageSkillPointsAtLevel,
  type Hero,
} from '../../lib/game/rules';
import { createItem } from '../../lib/game/items';
import type { Game } from '../../lib/game/world';
import '../../app/globals.css';
import '../../app/character-panels.css';
import '../../app/character-screen.css';
import '../../app/menu-presentation.css';
import '../../app/drag-drop.css';
import './blade-master-offhand-ui.css';

const MASTERY = 'v3-blade-master-twin-blade-mastery';
const TWIN = 'v3-blade-master-twin-assault';

function adventurer15() {
  const hero = createV3AdventurerHero('final-ui', 'Final UI');
  hero.level = 15;
  hero.skillProgressionV3!.totalEarnedSP = warriorLineageSkillPointsAtLevel(15);
  return hero;
}

function warrior60() {
  const hero = adventurer15();
  chooseCoreJob(hero, 'warrior');
  hero.level = 60;
  hero.skillProgressionV3!.totalEarnedSP = warriorLineageSkillPointsAtLevel(60);
  return hero;
}

function Fixture() {
  const [hero, setHero] = useState<Hero>(() => adventurer15());
  const [panel, setPanel] = useState<'trainer' | 'skills' | 'character'>('trainer');
  const commit = (fn: (next: Hero) => void) => {
    const next = structuredClone(hero);
    fn(next);
    setHero(next);
  };
  const game = useMemo(() => ({}) as Game, []);
  const spec = hero.specialization ?? 'none';

  return <JobPresentationContext.Provider value={hero}><GameDragDropProvider game={null}>
    <main className="bm-fixture-shell" data-boot-stage="ready" data-stage={`${hero.coreJob ?? 'adventurer'}:${spec}`}>
      <div className="bm-fixture-controls">
        <strong>Warrior Lineage V3 · FINAL UI acceptance</strong>
        <button onClick={() => setPanel('trainer')}>Job Trainer</button>
        <button onClick={() => setPanel('skills')}>Job Skill K</button>
        <button onClick={() => setPanel('character')}>Character Overview</button>
        <button onClick={() => commit((next) => { next.level = 60; next.skillProgressionV3!.totalEarnedSP = warriorLineageSkillPointsAtLevel(60); })}>Set Level 60</button>
        <button onClick={() => { setHero(warrior60()); setPanel('trainer'); }}>Reset Warrior Lv60</button>
        <button onClick={() => commit((next) => {
          if (!chooseSpecialization(next, 'blade_master')) return;
          learnSkill(next, MASTERY);
          learnSkill(next, TWIN);
          const off = createItem('legacy-fajar-blade', { id:'final-ui-offhand', isEquipped:false });
          next.inventory.push(off);
          equipItem(next, off.id, 'offHand');
        })}>Prepare Blade Master Dual</button>
      </div>
      <output data-testid="lineage-state" data-level={hero.level} data-core={hero.coreJob ?? ''} data-specialization={spec}
        data-sp={hero.skillProgressionV3?.totalEarnedSP ?? 0} data-offhand={hero.equipment.offHand ?? ''}>
        Lv{hero.level} · {hero.coreJob ?? 'Adventurer'} · {spec} · SP {hero.skillProgressionV3?.totalEarnedSP ?? 0}
      </output>
      <section className="bm-fixture-panel class-panel" aria-label={`${panel} acceptance`}>
        {panel === 'trainer' && <div className="dialog-stack">
          <JobArchitecturePreview hero={hero} />
          <V3JobTrainer hero={hero}
            onChooseWarrior={() => commit((next) => { chooseCoreJob(next, 'warrior'); })}
            onChooseSpecialization={(id) => commit((next) => { chooseSpecialization(next, id); })} />
        </div>}
        {panel === 'skills' && <JobSkill hero={hero} game={null} onMark={() => {}} />}
        {panel === 'character' && <CharacterOverview hero={hero} game={game} onInventory={() => {}} />}
      </section>
    </main>
  </GameDragDropProvider></JobPresentationContext.Provider>;
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Fixture />);
