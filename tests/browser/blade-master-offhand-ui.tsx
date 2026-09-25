// Development-only entry. This renders the real Character Overview and K panel.
// It never reads or writes the production character-save namespace.
import { useEffect, useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CharacterOverview } from '../../components/game/character-overview';
import { JobSkill } from '../../components/game/job-skill';
import { GameDragDropProvider } from '../../components/game/drag-drop-provider';
import { JobPresentationContext } from '../../components/game/job-presentation-context';
import {
  createV3JobDevelopmentHero,
  equipItem,
  parseSave,
  reconcileBladeMasterEquipment,
  unequipItem,
  type Hero,
} from '../../lib/game/rules';
import { createItem, type EquipSlot } from '../../lib/game/items';
import { meetsWeaponRequirement, resolveWeaponStyle } from '../../lib/game/weapon-style';
import { BLADE_MASTER_V3_RUNTIME_MAP } from '../../lib/game/blade-master-v3';
import type { Game } from '../../lib/game/world';
import '../../app/globals.css';
import '../../app/character-panels.css';
import '../../app/character-screen.css';
import '../../app/menu-presentation.css';
import '../../app/drag-drop.css';
import './blade-master-offhand-ui.css';

const STORAGE_KEY = 'lumenfall:dev-fixture:blade-master-offhand-ui:v1';
const MASTERY_ID = 'v3-blade-master-twin-blade-mastery';
const SHIELD_ID = 'v3-job-blade-master-60-ironveil-shield';

function freshFixture(): Hero {
  const hero = createV3JobDevelopmentHero('blade-master-60');
  hero.skillProgressionV3!.skillRanks[MASTERY_ID] = 1;
  hero.skillLevels[MASTERY_ID] = 1;
  hero.inventory.push(createItem('ironveil-shield', { id: SHIELD_ID, isEquipped: false }));
  return hero;
}

function loadFixture(): { hero: Hero; source: 'fixture' | 'isolated-storage' } {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  const restored = parseSave(raw, 'v3-job-blade-master-60');
  if (restored?.skillArchitectureVersion === 3 && restored.specialization === 'blade_master') {
    return { hero: restored, source: 'isolated-storage' };
  }
  return { hero: freshFixture(), source: 'fixture' };
}

function Fixture() {
  const [hero, setHero] = useState<Hero | null>(null);
  const [source, setSource] = useState<'fixture' | 'isolated-storage' | 'hydrating'>('hydrating');
  const [panel, setPanel] = useState<'character' | 'jobSkill'>('character');
  const [notice, setNotice] = useState('');

  // A mounted client effect is the hydration boundary. Only then may storage
  // be read and the development character injected into the real UI.
  // Synchronize external state after mount; reading it during SSR would break hydration.
  /* oxlint-disable react/react-compiler */
  useEffect(() => {
    const loaded = loadFixture();
    setHero(loaded.hero);
    setSource(loaded.source);
  }, []);
  /* oxlint-enable react/react-compiler */

  const persist = useCallback((next: Hero) => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setHero(next);
  }, []);
  const game = useMemo(() => ({
    equipItem(itemId: string, slot?: EquipSlot) {
      if (!hero) return false;
      const next = structuredClone(hero);
      const result = equipItem(next, itemId, slot);
      if (!result.ok) {
        setNotice(`Equip ditolak: ${result.reason}`);
        return false;
      }
      persist(next);
      setNotice(`${itemId} equipped in ${slot}.`);
      return true;
    },
    unequipItem(slot: EquipSlot) {
      if (!hero) return false;
      const next = structuredClone(hero);
      const result = unequipItem(next, slot);
      if (!result.ok) return false;
      persist(next);
      return true;
    },
  }), [hero, persist]);

  if (!hero) return <main className="bm-fixture-shell" data-boot-stage="hydrating">Memuat fixture development…</main>;

  const main = hero.inventory.find((item) => item.id === hero.equipment.mainHand) ?? null;
  const off = hero.inventory.find((item) => item.id === hero.equipment.offHand) ?? null;
  const style = resolveWeaponStyle(main, off);
  const twin = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-assault'];
  const weaponValid = meetsWeaponRequirement(twin.weaponRequirement, main, off, style);

  return (
    <JobPresentationContext.Provider value={hero}>
      <GameDragDropProvider game={null}>
        <main className="bm-fixture-shell" data-boot-stage="ready" data-fixture-source={source}>
          <div className="bm-fixture-controls">
            <strong>Blade Master · development fixture</strong>
            <button onClick={() => setPanel('character')}>Character Overview</button>
            <button onClick={() => setPanel('jobSkill')}>Job Skill K</button>
            <button onClick={() => {
              window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(hero));
              window.location.reload();
            }}>Save &amp; Reload Fixture</button>
            <button onClick={() => {
              const next = structuredClone(hero);
              next.skillProgressionV3!.skillRanks[MASTERY_ID] = 0;
              next.skillLevels[MASTERY_ID] = 0;
              reconcileBladeMasterEquipment(next);
              persist(next);
              setNotice('Twin Blade Mastery R1 refunded in isolated fixture.');
            }} disabled={(hero.skillLevels[MASTERY_ID] ?? 0) === 0}>Refund Twin Blade Mastery R1</button>
          </div>
          <output className="bm-fixture-state" data-testid="fixture-state"
            data-main-id={hero.equipment.mainHand ?? ''}
            data-off-id={hero.equipment.offHand ?? ''}
            data-weapon-style={style ?? ''}
            data-mastery-rank={hero.skillLevels[MASTERY_ID] ?? 0}
            data-twin-weapon-valid={String(weaponValid)}>
            Main: {main?.name ?? 'empty'} ({main?.id ?? 'none'}) · Off: {off?.name ?? 'empty'} ({off?.id ?? 'none'}) · Style: {style ?? 'none'} · Twin Assault weapon: {weaponValid ? 'VALID' : 'LOCKED'}
          </output>
          {notice && <p role="status">{notice}</p>}
          <section className="bm-fixture-panel" aria-label={panel === 'character' ? 'Character Overview fixture' : 'Job Skill fixture'}>
            {panel === 'character' ? (
              <CharacterOverview hero={hero} game={game as Game} onInventory={() => {}} />
            ) : (
              <JobSkill hero={hero} game={null} onMark={() => {}} />
            )}
          </section>
        </main>
      </GameDragDropProvider>
    </JobPresentationContext.Provider>
  );
}

if (import.meta.env.DEV) {
  createRoot(document.getElementById('root')!).render(<Fixture />);
} else {
  document.getElementById('root')!.textContent = 'Development fixture unavailable.';
}
