/** OWNER-approved parameters. Mathematical profile access never grants class/kit access. */
export const RESOURCE_PROFILE_VERSION = 'CLASS_RESOURCE_HP_MANA_V2' as const;
const targets = {
  adventurer:[100,100], warrior:[125,90], thief:[90,95], acolyte:[100,130],
  archer:[90,105], knight:[145,85], mage:[80,140], smith:[110,110],
  berserker:[140,85], blade_master:[115,100], rogue:[85,100], assasin:[85,105],
  luminary:[90,150], sacred_fist:[120,110], ranger:[85,135], marksman:[85,100],
  vanguard:[160,90], phalanx:[135,95], summoner:[90,145], sorcerer:[75,155],
  blacksmith:[125,100], specialist:[105,130],
} as const;
export type ResourceProfileId = keyof typeof targets;
export type ApprovedResourceProfile = Readonly<{
  version:typeof RESOURCE_PROFILE_VERSION; id:ResourceProfileId;
  authority:'OWNER_FINAL_CLASS_RESOURCE'; targetHPPercent:number; targetManaPercent:number;
  baseHP:number; hpPerLevel:number; vitBase:number; vitPerLevel:number;
  vitEfficiency:1; manaFactor:number; bonusIntMana:3;
}>;
export const APPROVED_RESOURCE_PROFILES:Readonly<Record<ResourceProfileId,ApprovedResourceProfile>> =
  Object.freeze(Object.fromEntries(Object.entries(targets).map(([id,[hp,mana]])=>[id,
    Object.freeze({version:RESOURCE_PROFILE_VERSION,id,authority:'OWNER_FINAL_CLASS_RESOURCE',
      targetHPPercent:hp,targetManaPercent:mana,baseHP:230*(hp/100)-120,
      hpPerLevel:28.75*(hp/100)-.75,vitBase:8,vitPerLevel:.05,vitEfficiency:1,
      manaFactor:mana/100,bonusIntMana:3}),
  ])) as Record<ResourceProfileId,ApprovedResourceProfile>);
export function approvedResourceProfile(id:string):ApprovedResourceProfile|null {
  return Object.hasOwn(APPROVED_RESOURCE_PROFILES,id) ? APPROVED_RESOURCE_PROFILES[id as ResourceProfileId] : null;
}
/** Intrinsic layer only. Item/modifier layers are applied by the existing resolver. */
export function intrinsicClassResources(profile:ApprovedResourceProfile,level:number,totalVit:number,bonusInt:number) {
  if(approvedResourceProfile(profile.id)!==profile || !Number.isSafeInteger(level)||level<1||level>100 ||
    !Number.isFinite(totalVit)||totalVit<0||!Number.isFinite(bonusInt)||bonusInt<0)
    throw new RangeError('INVALID_RESOURCE_PROFILE_INPUT');
  const n=level-1,vit=totalVit*(profile.vitBase+profile.vitPerLevel*n);
  const baseHP=profile.baseHP+profile.hpPerLevel*n;
  const levelMana=profile.manaFactor*(60+2.5*level+.01*level*level),intMana=3*bonusInt;
  if(![vit,baseHP+vit,levelMana+intMana].every(Number.isFinite))throw new RangeError('RESOURCE_PROFILE_OVERFLOW');
  return Object.freeze({baseHP,vit,unroundedHP:baseHP+vit,levelMana,intMana,intrinsicMana:Math.floor(levelMana+intMana)});
}
