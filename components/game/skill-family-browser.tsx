'use client';
import type { ReactNode } from 'react';
import type { SkillDefinition } from '@/lib/game/skills';
import type { SkillFamilyOverview } from '@/lib/game/skill-family-presentation';
import { canonicalSkillName } from '@/lib/game/skill-family-presentation';
import { skillFamilyDefinitions } from '@/lib/game/skill-family-runtime';
import { SkillIcon } from './skill-icon';

export function SkillFamilyBrowser({ families, selected, onSelect, renderNode }: {
  families: SkillFamilyOverview[]; selected: SkillFamilyOverview;
  onSelect: (family: SkillFamilyOverview) => void; renderNode: (skill: SkillDefinition) => ReactNode;
}) {
  return <section className="js-families" aria-label="Core Thief skill families">
    <div className="js-family-overview">
      {families.map(family => <button key={family.id} className={`js-family-card ${family.id === selected.id ? 'selected' : ''}`}
        onClick={() => onSelect(family)} aria-pressed={family.id === selected.id} aria-controls="selected-skill-family">
        <SkillIcon id={family.active?.id ?? family.rootId ?? ''} size={26} />
        <strong>{family.name}</strong>
        <small>{family.role === 'PASSIVE' ? 'Passive' : family.role === 'UTILITY' ? 'Utility' : 'Active'} family</small>
        <span>{family.active ? `${family.active.name} R${family.rank}` : 'Belum dipelajari'}</span>
        <small>{family.progress.map(p => `${p.stage === 'ROOT' ? 'Root' : p.stage === 'UPGRADE' ? 'Upgrade' : 'Branch'} ${p.complete ? '✓' : '○'}`).join(' · ')}</small>
      </button>)}
    </div>
    <section id="selected-skill-family" className="js-family-expanded" aria-label={`${selected.name} progression`}>
      <h3>{selected.name} <small>Family</small></h3>
      <p className="js-hint">Rank meningkatkan nilai skill. Evolution mengganti anggota aktif, bukan menambah tombol combat. Pilihan cabang tidak menentukan specialization.</p>
      {selected.available.length > 0 && <p className="js-family-available">Available: {selected.available.join(' · ')}</p>}
      {selected.stages.map((skills, index) => <div className="js-family-tier" key={index}>
        {index > 0 && <div className="js-family-connector" aria-hidden="true">↓</div>}
        <div className={`js-family-tier-nodes ${skills.length > 1 ? 'is-branch-split' : ''}`}>
          {skills.map(skill => {
            const meta = skillFamilyDefinitions[skill.id];
            const predecessor = meta.familyPredecessorId ?? meta.replacesSkillId;
            return <div className="js-family-branch" key={skill.id}>
              <small className="js-family-edge">{meta.familyStage === 'ROOT' ? 'ROOT' : meta.familyStage === 'UPGRADE' ? 'UPGRADE' : 'BRANCH'}{predecessor && ` · from ${canonicalSkillName(predecessor)}`}</small>
              {renderNode(skill)}
            </div>;
          })}
        </div>
      </div>)}
      <p className="js-hint">Cabang bersifat mutually exclusive. Alternatif tetap bisa diperiksa; pergantian menggunakan Skill Reset yang berlaku.</p>
    </section>
  </section>;
}
