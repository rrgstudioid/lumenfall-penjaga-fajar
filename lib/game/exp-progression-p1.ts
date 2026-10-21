import { ABSOLUTE_MAX_LEVEL } from './progression.ts';

/** Direct OWNER EXP-P1 approval. These are LUMENFALL authoring values. */
export const EXP_P1_VERSION = 'LUMENFALL_EXP_P1_V1' as const;
export const EXP_P1_ANCHORS: readonly (readonly [number, number])[] = Object.freeze([
  [1,8],[5,20],[10,40],[15,70],[20,110],[25,170],[30,240],[35,330],
  [40,450],[45,600],[50,800],[55,1050],[60,1350],[65,1750],
  [70,2250],[75,2900],[80,3700],[85,4700],[90,6000],[95,7700],[99,9500],
].map(row=>Object.freeze(row as [number,number])));
export const expP1Enabled = () => process.env.NODE_ENV !== 'production';
function validLevel(level:number) {
  if(!Number.isInteger(level)||level<1||level>ABSOLUTE_MAX_LEVEL)throw new RangeError('INVALID_EXP_LEVEL');
}
export function expP1NormalBaseline(level:number) { validLevel(level);return 10*(level+1); }
export function expP1Requirement(level:number) {
  validLevel(level);if(level===ABSOLUTE_MAX_LEVEL)return 0;
  let index=0;while(EXP_P1_ANCHORS[index+1][0]<level)index++;
  const [lo,kLo]=EXP_P1_ANCHORS[index],[hi,kHi]=EXP_P1_ANCHORS[index+1];
  const k=kLo+(kHi-kLo)*(level-lo)/(hi-lo);
  return expP1NormalBaseline(level)*k;
}
export function characterXPRequirement(level:number) {
  return expP1Enabled()?expP1Requirement(level):90+level*40;
}
/** Inspect raw values BEFORE the compatibility parser can clamp/discard them. */
export function expProgressionSaveIssue(value:Record<string,unknown>): string|null {
  const version=value.expProgressionVersion;
  if(version!==undefined&&version!==EXP_P1_VERSION)return 'Versi EXP belum didukung; save dipertahankan.';
  if(version===EXP_P1_VERSION&&!expP1Enabled())return 'Save EXP-P1 hanya dapat dimainkan di development; data tetap disimpan.';
  if(expP1Enabled()&&(!Number.isInteger(value.level)||Number(value.level)<1||Number(value.level)>ABSOLUTE_MAX_LEVEL||!Number.isSafeInteger(value.xp)||Number(value.xp)<0))return 'Level/EXP tidak valid; data asli dipertahankan untuk pemeriksaan.';
  return null;
}
export function assertEXPActor(value:{level:number;xp:number;expProgressionVersion?:string},amount:number) {
  const issue=expProgressionSaveIssue(value);if(issue)throw new Error(issue);
  if(expP1Enabled()&&(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(value.xp+amount)))throw new RangeError('INVALID_EXP_AWARD');
}
export function experienceReadout(level:number,xp:number) {
  const maximum=level>=ABSOLUTE_MAX_LEVEL,needed=maximum?null:characterXPRequirement(level);
  const percent=maximum?100:Math.min(100,Math.max(0,xp/needed!*100));
  const number=new Intl.NumberFormat('id-ID');
  return {maximum,needed,percent,text:maximum?'LEVEL MAKSIMAL':`${number.format(xp)} / ${number.format(needed!)} EXP · ${number.format(Math.floor(percent*100)/100)}%`};
}
