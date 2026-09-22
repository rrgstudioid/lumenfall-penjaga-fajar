'use client';
import type { Hero } from '@/lib/game/rules';
import { getVisibleJobArchitecture } from '@/lib/game/job-presentation';
import { Popover } from '@base-ui/react/popover';

/** Informational only: deliberately no promotion buttons or callbacks. */
export function JobArchitecturePreview({ hero, compact = false }: { hero: Hero; compact?: boolean }) {
  const view = getVisibleJobArchitecture(hero);
  if (view.v3) return <section aria-label="Job Identity V3" className="v3-job-identity" data-v3-job-identity>
    <span><b>Core Job:</b> {hero.coreJob === 'warrior' ? 'Warrior' : 'Belum dipilih'}</span>
    <span><b>Specialization:</b> {hero.specialization ? view.currentName : 'Belum dipilih'}</span>
  </section>;
  if (!view.v2) return null;
  const content = <section aria-label="Job Architecture V2" className="dialog-stack" data-window-no-drag>
    <strong>Adventurer → {view.currentName}</strong>
    <p>Adventurer / Warrior: implemented · development only. Job lain belum dapat dimainkan.</p>
    {view.futureSpecializations.map(job => <p key={job.id}>{job.name} — {job.status}</p>)}
    <details><summary>Job Architecture V2 · preview</summary><div style={{ maxHeight: '18rem', overflowY: 'auto' }}>
      {view.branches.map(job => <div key={job.id}>
        <strong>{job.name}</strong> — {job.status}
        {job.children.map(spec => <p key={spec.id}>{spec.name} — {spec.status}<br />
          {spec.children.map(a => `${a.name} — ${a.status}`).join(' / ')}
        </p>)}
      </div>)}
    </div></details>
  </section>;
  return compact ? <Popover.Root><Popover.Trigger data-window-no-drag className="secondary-button">Job view</Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="bottom" sideOffset={8} className="cs-floating-layer">
      <Popover.Popup className="cs-surface" style={{ padding: '1rem', width: 'min(32rem, 90vw)', maxHeight: '70vh', overflowY: 'auto' }}>{content}</Popover.Popup>
    </Popover.Positioner></Popover.Portal></Popover.Root> : content;
}
