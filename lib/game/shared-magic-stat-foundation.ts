import {composeAttackCore, prepareRawAttackExecution, type CoreAttackInput, type RawAttackInput, type ResolvedAttackCore} from './attack-range-v2.ts';
import {baseMagicAttackForLevel} from './rules.ts';

export const SHARED_MAGIC_STAT_VERSION = 'SHARED_MAGIC_STAT_OWNER_2026_10_10' as const;
/** Pure mathematical projection, never an actor/equipment/cast permission.
 * Explicit global-flat provenance and weapon layers are validated by kernel A.
 * No Staff/Wand scalar adapter, arbitrary spread, RNG or preparation serial. */
export function composeSharedMagicCore(input: Omit<CoreAttackInput,'damageType'|'base'> & {level:number; baseSource:CoreAttackInput['base']['source']}) {
  if (!Number.isSafeInteger(input.level) || input.level < 1 || input.level > 100)
    return Object.freeze({ok:false as const,code:'INVALID_LEVEL',path:'level',reason:'Expected explicit level 1..100'});
  return composeAttackCore({damageType:'magic',owner:input.owner,base:{value:baseMagicAttackForLevel(input.level),source:input.baseSource},primary:input.primary,globalFlat:input.globalFlat});
}
export function readSharedMagicRange(core: ResolvedAttackCore, weaponInput?: Omit<RawAttackInput,'core'>) {
  if (!weaponInput) return Object.freeze({ok:false as const,code:'MAGIC_RANGE_INPUT_MISSING',path:'weapon',reason:'Canonical magic weapon range/provenance required',core:core.value,version:SHARED_MAGIC_STAT_VERSION});
  if (core.damageType !== 'magic' || weaponInput.hits.length !== 1 || weaponInput.hits[0].hand !== 'MAIN' || weaponInput.context.mode !== 'SINGLE_MAIN')
    return Object.freeze({ok:false as const,code:'UNSUPPORTED_MAGIC_PRESENTATION',path:'context',reason:'This stat DTO supports one explicit magic MAIN layer'});
  const prepared=prepareRawAttackExecution({...weaponInput,core});
  if (!prepared.ok) return prepared;
  return Object.freeze({ok:true as const,value:Object.freeze({version:SHARED_MAGIC_STAT_VERSION,authority:'MATHEMATICAL_PROJECTION_NOT_CAST_PERMISSION',core:core.value,MAIN:prepared.value.hits[0].attack,sources:prepared.value.sources})});
}
