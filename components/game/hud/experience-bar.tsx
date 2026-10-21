import { Progress } from '@/components/ui/progress';
import { experienceReadout } from '@/lib/game/exp-progression-p1';

export function ExperienceBar({level,xp,saved}:{level:number;xp:number;saved:boolean}) {
 const value=experienceReadout(level,xp);
 return <div className="hud-exp hud-exp-p1" aria-label="Progres EXP karakter">
  <strong>Lv. {level}</strong>
  <Progress value={value.percent} aria-label="Pengalaman level" aria-valuetext={value.text} />
  <span title={value.text}>{value.text}</span>
  <small>{saved?'TERSIMPAN LOKAL':'PENYIMPANAN TIDAK TERSEDIA'}</small>
 </div>;
}
