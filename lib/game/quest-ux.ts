import type {QuestJournalEntry} from './regions';

/** Pure readout of the journal, not objective credit or quest selection policy. */
export function questHudPresentation(quest:QuestJournalEntry) {
  const objectives=quest.objectives.map((o,i)=>({label:quest.id==='main-verdant-bisikan'?'Monster apa pun · semua wilayah':o.targetName,current:quest.progress[i]?.current??0,
    required:quest.progress[i]?.required??o.required,unavailable:quest.progress[i]?.unavailable===true}));
  const next=objectives.find(o=>o.unavailable||o.current<o.required)??objectives.at(-1);
  const required=objectives.reduce((n,o)=>n+o.required,0),current=objectives.reduce((n,o)=>n+Math.min(o.current,o.required),0);
  const status={locked:'Terkunci',available:'Belum diterima',active:'Aktif',ready_to_complete:'Siap dilaporkan',completed:'Selesai',cooldown:'Menunggu'}[quest.status];
  return {status,next,remaining:objectives.filter(o=>o.current<o.required).length,
    progress:objectives.some(o=>o.unavailable)||!required?null:current/required*100,
    destination:quest.status==='available'?`${quest.giverNpcName} · ${quest.giverMapName}`:`${quest.reportNpcName??quest.giverNpcName} · ${quest.reportMapName??quest.giverMapName}`};
}
