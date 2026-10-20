import type {QuestJournalEntry} from '@/lib/game/regions';
import {questHudPresentation} from '@/lib/game/quest-ux';
import {Progress} from '@/components/ui/progress';

export function DevelopmentQuestSummary({quest,onOpen}:{quest:QuestJournalEntry;onOpen:()=>void}) {
  const view=questHudPresentation(quest);
  return <div className="hud-quest-summary-dev">
    <small className="hud-quest-state">{view.status}</small>
    <h2>{quest.title}</h2>
    {view.next&&quest.status==='active'&&<div className="hud-objective-active">
      <span>{view.next.label}</span><b>{view.next.unavailable?'Perlu diperiksa':`${view.next.current} / ${view.next.required}`}</b>
    </div>}
    <p className="hud-quest-report">{quest.status==='available'?'Pemberi':quest.status==='ready_to_complete'?'Lapor sekarang':'Pelaporan'}: {view.destination}</p>
    {view.remaining>1&&<button className="hud-objectives-more" onClick={onOpen}>{view.remaining} objective belum selesai · lihat lengkap</button>}
    {view.progress!==null&&<Progress className="hud-quest-progress" value={view.progress} aria-label="Progres seluruh objective"/>}
    <button className="hud-objectives-more" onClick={onOpen}>Deskripsi dan semua objective di jurnal ↗</button>
  </div>;
}
