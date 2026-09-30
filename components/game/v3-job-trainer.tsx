'use client';

import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { getVisibleJobArchitecture, type V3SpecializationId } from '@/lib/game/job-presentation';
import type { Hero } from '@/lib/game/rules';
import { DraggableAlertDialogContent } from './draggable-window';
import { AlertDialog, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

type Props = {
  hero: Hero;
  onChooseWarrior: () => void;
  onChooseThief?: () => void;
  onChooseSpecialization: (id: V3SpecializationId) => void;
  onResetToAdventurer: () => void;
};

/** Shared live/development presentation for the V3 Job Trainer. Gameplay
 * authority remains in the supplied rule-backed callbacks. */
export function V3JobTrainer({ hero, onChooseWarrior, onChooseThief, onChooseSpecialization, onResetToAdventurer }: Props) {
  const view = getVisibleJobArchitecture(hero);
  const [pending, setPending] = useState<{ id:V3SpecializationId; actorId:string } | null>(null);
  const choice = view.v3SpecializationChoices.find(entry=>entry.id===pending?.id);
  const owner = hero.characterId ?? hero.slotId;
  if (!view.v3) return null;
  return <>
    <span className="eyebrow">ADVENTURER → CORE JOB · V3</span>
    <p className="muted-copy">Warrior / Thief terbuka pada Lv. 15. Specialization terbuka pada Lv. 60. Thief → Rogue / Assasin mempertahankan rank, cabang family, alokasi stat, equipment, dan hotbar Thief. Job Change Thief tidak memberi bonus atau memotong SP. Promosi Warrior mengikuti kebijakan yang berlaku.</p>
    {!hero.coreJob ? (
      <div className="class-choice-grid two-col"><button className="class-choice" disabled={hero.level < 15} onClick={onChooseWarrior}>
        <strong>Warrior</strong><span>Lv. 15 · Sword Frontline</span>
      </button>
      {onChooseThief && <button className="class-choice" disabled={hero.level < 15} onClick={onChooseThief}><strong>Thief</strong><span>Lv. 15 · Dagger / Dual Daggers · Skill Families</span></button>}</div>
    ) : !hero.specialization ? (
      <div className="class-choice-grid two-col" data-v3-specialization-choices>
        {view.v3SpecializationChoices.map((choice) => <button
          key={choice.id}
          className="class-choice"
          disabled={!choice.available}
          onClick={() => hero.coreJob === 'thief' ? setPending({id:choice.id,actorId:owner}) : onChooseSpecialization(choice.id)}
        >
          <div><strong>{choice.name}</strong><small>{choice.status}</small></div>
          <span>{choice.role}</span>
          <p>{choice.description}</p>
          {!choice.available && <i><LockKeyhole size={12} /> Requires Level 60</i>}
        </button>)}
      </div>
    ) : (
      <p>{view.currentName} aktif. Skill Adventurer, {hero.coreJob === 'thief' ? 'Thief' : 'Warrior'}, dan {view.currentName} tersedia di panel K. Specialization saudara tetap terkunci.</p>
    )}
    <AlertDialog open={!!pending} onOpenChange={open=>{if(!open)setPending(null);}}>
      <DraggableAlertDialogContent windowId="thief-specialization-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Pilih {choice?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {choice?.description} Cabang specialization saudara akan terkunci. Pilihan family Core Thief tetap tersimpan dan tidak menentukan job ini.
            {' '}Tidak ada biaya/bonus SP atau refill Mana. Skill Reset tidak mengganti specialization.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction disabled={!choice?.available || pending?.actorId!==owner} onClick={()=>{
            if (choice?.available && pending?.actorId===owner) onChooseSpecialization(choice.id);
            setPending(null);
          }}>Konfirmasi {choice?.name}</AlertDialogAction>
        </AlertDialogFooter>
      </DraggableAlertDialogContent>
    </AlertDialog>
    {hero.job !== 'adventurer' && (
      <button className="class-choice" disabled={hero.gold < 500} onClick={onResetToAdventurer}>
        <div><strong>Ubah Job ke Adventurer</strong><small>Biaya 500 GOLD</small></div>
        <span>Reset job saat ini ke Adventurer</span>
        <p>SP dan Stat yang sudah didapat dari level tetap tersimpan; hanya alokasi job aktif yang dihapus agar karakter kembali ke baseline Adventurer.</p>
      </button>
    )}
  </>;
}
