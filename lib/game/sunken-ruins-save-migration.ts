import {
  SUNKEN_ENTRY,
  SUNKEN_ID,
  SUNKEN_LAYOUT_VERSION,
  SUNKEN_PREVIEW_ID,
} from './sunken-ruins-layout.ts';

export class SunkenQuestMigrationHold extends Error {
  constructor() { super('SUNKEN_QUEST_PROGRESS_CONFLICT: original character retained; quest baseline requires review'); }
}

/** Replace the retired field and preview identity, retaining character progression. */
export function migrateSunkenSave(
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...saved,
    sunkenLayoutVersion: SUNKEN_LAYOUT_VERSION,
  };
  const canonical = (id: unknown) =>
    id === SUNKEN_PREVIEW_ID ? SUNKEN_ID : id;
  result.currentField = canonical(saved.currentField);
  for (const key of ['unlockedFields', 'defeatedFieldBosses'] as const)
    if (Array.isArray(saved[key]))
      result[key] = [...new Set(saved[key].map(canonical))];
  for (const key of ['fieldProgress', 'defeatedBossTimestamp'] as const) {
    const source = saved[key];
    if (!source || typeof source !== 'object' || Array.isArray(source))
      continue;
    const record = { ...source } as Record<string, unknown>;
    if (typeof record[SUNKEN_PREVIEW_ID] === 'number')
      record[SUNKEN_ID] = Math.max(
        typeof record[SUNKEN_ID] === 'number' ? record[SUNKEN_ID] : 0,
        record[SUNKEN_PREVIEW_ID],
      );
    delete record[SUNKEN_PREVIEW_ID];
    result[key] = record;
  }
  if (
    saved.monsterRespawnState &&
    typeof saved.monsterRespawnState === 'object'
  ) {
    const timers: Record<string, number> = {};
    for (const [key, value] of Object.entries(saved.monsterRespawnState)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (/^sunken-ruins-[0-5](?::spawn:\d+)?$/.test(key)) continue;
      const next = key.startsWith(`${SUNKEN_PREVIEW_ID}:`)
        ? `${SUNKEN_ID}:${key.slice(SUNKEN_PREVIEW_ID.length + 1)}`
        : key;
      timers[next] = Math.max(timers[next] ?? 0, value);
    }
    result.monsterRespawnState = timers;
  }
  // OWNER: retain quests/rewards and acceptance progress across layout replacement.
  // The existing parser canonicalizes story -> easy; carry its baseline too.
  const alias='story-sunken-ruins', easy='field-sunken-ruins-easy';
  const completed=Array.isArray(saved.completedQuests)?saved.completedQuests:[];
  const active=[...(Array.isArray(saved.activeQuests)?saved.activeQuests:[]),...(Array.isArray(saved.acceptedQuests)?saved.acceptedQuests:[])];
  if(active.includes(alias)&&!completed.includes(alias)&&!completed.includes(easy)) {
    const progress=saved.cityProgress && typeof saved.cityProgress==='object'&&!Array.isArray(saved.cityProgress)?saved.cityProgress as Record<string,unknown>:{};
    const legacy=progress[`baseline-${alias}`], current=progress[`baseline-${easy}`];
    if(typeof legacy!=='number'||!Number.isFinite(legacy)||legacy<0 || current!==undefined&&current!==legacy){
      result.questProgressHolds={...(saved.questProgressHolds && typeof saved.questProgressHolds==='object'?saved.questProgressHolds:{}),[easy]:{reason:'SUNKEN_QUEST_PROGRESS_CONFLICT',original:{activeQuests:saved.activeQuests,acceptedQuests:saved.acceptedQuests,cityProgress:saved.cityProgress,fieldProgress:saved.fieldProgress}}};
    }else result.cityProgress={...progress,[`baseline-${easy}`]:legacy};
  }
  if (saved.inCity === false && result.currentField === SUNKEN_ID) {
    result.currentCity = 'jayantara';
    if (
      saved.currentField === SUNKEN_ID &&
      saved.sunkenLayoutVersion !== SUNKEN_LAYOUT_VERSION
    ) {
      Object.assign(result, SUNKEN_ENTRY);
      result.lastSafePosition = { ...SUNKEN_ENTRY };
    }
  }
  return result;
}
