'use client';

import { LockKeyhole } from 'lucide-react';
import { getVisibleJobArchitecture } from '@/lib/game/job-presentation';
import type { Hero } from '@/lib/game/rules';

type Props = {
  hero: Hero;
  onChooseWarrior: () => void;
  onChooseThief?: () => void;
  onChooseSpecialization: (id: 'berserker' | 'blade_master') => void;
  onResetToAdventurer: () => void;
};

/** Shared live/development presentation for the V3 Job Trainer. Gameplay
 * authority remains in the supplied rule-backed callbacks. */
export function V3JobTrainer({ hero, onChooseWarrior, onChooseThief, onChooseSpecialization, onResetToAdventurer }: Props) {
  const view = getVisibleJobArchitecture(hero);
  if (!view.v3) return null;
  return <>
    <span className="eyebrow">ADVENTURER → CORE JOB · V3</span>
    <p className="muted-copy">Warrior / Thief terbuka pada Lv. 15. Specialization Warrior terbuka pada Lv. 60; specialization Thief belum tersedia. Pergantian job mengembalikan SP skill; level dan alokasi stat tetap.</p>
    {!hero.coreJob ? (
      <div className="class-choice-grid two-col"><button className="class-choice" disabled={hero.level < 15} onClick={onChooseWarrior}>
        <strong>Warrior</strong><span>Lv. 15 · Sword Frontline</span>
      </button>
      {onChooseThief && <button className="class-choice" disabled={hero.level < 15} onClick={onChooseThief}><strong>Thief</strong><span>Lv. 15 · Dagger / Dual Daggers · Skill Families</span></button>}</div>
    ) : hero.coreJob === 'thief' ? <p>Core Thief aktif. Family skill tersedia di panel K. Specialization Thief belum tersedia.</p> : !hero.specialization ? (
      <div className="class-choice-grid two-col" data-v3-specialization-choices>
        {view.v3SpecializationChoices.map((choice) => <button
          key={choice.id}
          className="class-choice"
          disabled={!choice.available}
          onClick={() => onChooseSpecialization(choice.id)}
        >
          <div><strong>{choice.name}</strong><small>{choice.status}</small></div>
          <span>{choice.role}</span>
          <p>{choice.description}</p>
          {!choice.available && <i><LockKeyhole size={12} /> Requires Level 60</i>}
        </button>)}
      </div>
    ) : (
      <p>{view.currentName} aktif. Skill Adventurer, Warrior, dan {view.currentName} tersedia di panel K. Specialization saudara tetap terkunci.</p>
    )}
    {hero.job !== 'adventurer' && (
      <button className="class-choice" disabled={hero.gold < 500} onClick={onResetToAdventurer}>
        <div><strong>Ubah Job ke Adventurer</strong><small>Biaya 500 GOLD</small></div>
        <span>Reset job saat ini ke Adventurer</span>
        <p>SP dan Stat yang sudah didapat dari level tetap tersimpan; hanya alokasi job aktif yang dihapus agar karakter kembali ke baseline Adventurer.</p>
      </button>
    )}
  </>;
}
