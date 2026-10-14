import { FIELDS, CITIES, FIELD_NPCS, startingFieldIds, STARTER_FIELD_CONTENT } from './regions.ts';
import { fieldSpawns } from './field-layout.ts';
import { JOB_V2_REGISTRY, getJobV2 } from './job-registry-v2.ts';
import { skillFamilyDefinitions } from './skill-family-runtime.ts';
import { ALL_SKILLS } from './skills.ts';
import { ITEM_CATALOG, canonicalItemTemplateId } from './items.ts';
/** No fuzzy ID remapping: same-name legacy jobs are not equivalent lineages. */
export function auditGameplayCatalog() {
  const jobs = Object.values(JOB_V2_REGISTRY);
  const skills = Object.values(skillFamilyDefinitions);
  const east = FIELDS['east-gate-arunika'];
  const ids = new Set<string>();
  const duplicates: string[] = [];
  const orphans: string[] = [];
  for (const skill of skills) {
    if (ids.has(skill.id)) duplicates.push(skill.id);
    ids.add(skill.id);
    if (!getJobV2(skill.jobId)) orphans.push(skill.id + ':job');
    for (const req of skill.prerequisiteSkills ?? []) if (!skillFamilyDefinitions[req.skillId]) orphans.push(skill.id + ':' + req.skillId);
  }
  return { contractVersion: 2, jobs: jobs.map(job => ({ id: job.id, name: job.name, parent: job.parent, status: job.referenceStatus })),
    canonicalSkills: skills.map(s => ({ id: s.id, jobId: s.jobId, maxRank: s.maxRank })),
    legacySkills: ALL_SKILLS.filter(s => !ids.has(s.id)).map(s => ({ id: s.id, canonicalId: null, status: 'LEGACY_RETAINED' })),
    items: Object.values(ITEM_CATALOG).map(item => ({ id: item.templateId, canonicalId: canonicalItemTemplateId(item.templateId),
      legacyJobGate: item.requiredCoreJob && !getJobV2(item.requiredCoreJob) ? item.requiredCoreJob : null })),
    duplicates, orphans,
    mapDrift: { id:'east-gate-arunika',globalMapAuthority:'Owner instruction: absent from current global map',
      runtimeCatalogPresent:!!FIELDS['east-gate-arunika'],startingDestination:startingFieldIds().includes('east-gate-arunika'),
      cityReferences:Object.values(CITIES).filter(c=>c.connectedFields.includes('east-gate-arunika')).map(c=>c.id),
      field:FIELDS['east-gate-arunika']?{id:FIELDS['east-gate-arunika'].id,contentFamilyId:FIELDS['east-gate-arunika'].contentFamilyId,nextMap:FIELDS['east-gate-arunika'].nextMap,quests:FIELDS['east-gate-arunika'].questList}:null,
      camp:FIELD_NPCS['east-gate-arunika']?.id,status:'ACTIVE_RUNTIME_GLOBAL_MAP_CONFLICT',benchmarkEligible:false,
      facets:{
        publicEligibility:{status:'UNRESOLVED_NOT_LEGACY_ONLY',registryContainsField:!!east,
          explicitPublicOrLegacyFlag:false,basis:'FieldDefinition and travel have no independent public/legacy eligibility flag; registry activity is not an approved public catalog decision'},
        globalMapVisibility:{status:'ABSENT_PER_OWNER_AUTHORITY',browserGlobalMapVerified:false,
          basis:'Owner instruction; absence is not an instruction to delete or disable travel'},
        travel:{runtimeEnabled:!!east,city:'arunika',nextMap:east?.nextMap,
          source:'regions.ts travel/unlockReason; world.ts createField portals and field-camp teleport'},
        unlock:{minLevel:east?.minLevel,chapter:east?.chapter,initiallyUnlocked:east?.isUnlocked,
          includedInStartingFields:startingFieldIds().includes('east-gate-arunika'),
          source:'regions.ts startingFieldIds/refreshUnlocks/unlockReason; level and chapter gates, not former story/boss quest gate'},
        quest:{ids:east?.questList,camp:FIELD_NPCS['east-gate-arunika']?.id,
          source:'regions.ts fieldForQuest/acceptRegionQuest/regionQuestStatus; in-field camp and per-quest level/cooldown gates'},
        spawn:{count:east?fieldSpawns(east).length:0,normalMonsters:east?.normalMonsters.map(m=>m.id),
          eliteMonsters:east?.eliteMonsters.map(m=>m.id),boss:east?.fieldBoss?.id,
          sharesStarterContent:east?.normalMonsters===STARTER_FIELD_CONTENT.normalMonsters&&east?.fieldBoss===STARTER_FIELD_CONTENT.fieldBoss,
          source:'field-layout.ts fieldSpawns; world.ts spawn/respawn consume FIELDS[currentField]'},
        legacyFixtures:{retained:true,activeBenchmark:false,
          source:'Historical field/travel/terrain and browser fixtures retained; old simulation is legacy calibration only'},
      },
      evidence:'outputs/gameplay-migration/east-gate-references.log',
      consumers:['world.ts: fieldSpawns, createField/portals, spawn boss, map snapshot, camp interaction','regions.ts: FIELDS -> startingFieldIds/refreshUnlocks/travel/quest registry','field-terrain.ts and east-gate-layout.ts: terrain','stylized-tree-map.ts: tree placements'],
      retainedHistorical:['field-quest-travel.test.ts','field-expansion.test.ts','field-terrain.test.ts','verdant-plains.test.ts','tests/browser/stun-smoke.bundle.js','scripts/test-east-gate-browser.mjs','scripts/check-arunika-material-browser.mjs','scripts/check-arunika-material-layout.mjs'],
      action:'Report only; no map, asset, NPC or travel edits. Previous simulation archived as legacy calibration.' },
    unresolvedJobs: jobs.filter(job => job.referenceStatus === 'UNRESOLVED').map(job => ({ id: job.id, retainedLegacyName: job.legacyName })),
  };
}
