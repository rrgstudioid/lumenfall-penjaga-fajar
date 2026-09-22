import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleJobArchitecture, presentJobText } from './job-presentation.ts';
import { getJobProgression, getJobSkillNodes } from './character-view.ts';
import { createV2TestHero, authorizeV2Warrior, freshHero, parseSave, characterLabel, activeSkills } from './rules.ts';
import { SPECIALIZATIONS } from './skills.ts';
import { JOB_V2_REGISTRY } from './job-registry-v2.ts';
import { CITIES, getNpcServiceLabel, getNpcDescription, getAllQuestJournalEntries } from './regions.ts';
import { usesHardTargeting } from './targeting.ts';

const forbidden = /\b(Gatotkaca|Garda|Caroq|Anom|Srikandi|Jagawana|Resi|Pujangga|Pandita|Bajra|Mastery|Capstone)\b/i;
function warrior() { const h = createV2TestHero(); h.level = 59; authorizeV2Warrior(h); return h; }
test('3C-PRE V2 presentation is canonical, locked and read-only; 30 allowed Warrior nodes', () => {
  const h = warrior(), before = JSON.stringify(h), view = getVisibleJobArchitecture(h);
  assert.equal(view.currentName, 'Warrior');
  assert.deepEqual(view.coreChoices, []);
  assert.deepEqual(view.specializationChoices, []);
  assert.deepEqual(view.futureSpecializations.map(j => j.name), ['Berserker', 'Blade Master']);
  assert.equal(view.branches.length, 7);
  assert.equal(view.branches.flatMap(j => j.children).length, 14);
  assert(view.branches.flatMap(j => j.children).some(j => j.name === 'Assasin'));
  assert(Object.values(JOB_V2_REGISTRY).every(j => !j.playable));
  const nodes = getJobSkillNodes(h, 'core');
  assert.equal(nodes.active.length, 16); assert.equal(nodes.passive.length, 14);
  assert(getJobSkillNodes(h, 'adventurer').active.length > 0);
  assert(!forbidden.test(JSON.stringify([view, getJobProgression(h), nodes])));
  assert.equal(JSON.stringify(h), before);
});
test('3C-PRE V2 stale legacy presentation fields cannot reveal specialization/mastery nodes or labels', () => {
  const h = warrior(); h.specialization = 'gatotkaca'; h.masteryQuestClaimed = true;
  assert.equal(characterLabel(h), 'Warrior');
  assert(!forbidden.test(JSON.stringify(getJobProgression(h))));
  for (const stage of ['specialization','mastery','capstone'] as const) {
    assert.deepEqual(getJobSkillNodes(h, stage), { active: [], passive: [] });
  }
});
test('3C-PRE every legacy specialization survives save, display, skills and functional progression', () => {
  for (const [id, spec] of Object.entries(SPECIALIZATIONS)) {
    const h = freshHero(); h.coreJob = spec.coreJob; h.specialization = id as typeof h.specialization; h.job = spec.coreJob; h.level = 50;
    const before = JSON.stringify(h), loaded = parseSave(before)!;
    assert.equal(loaded.specialization, id);
    assert.equal(characterLabel(loaded), spec.name);
    assert(activeSkills(loaded).some(s => s.specialization === id));
    assert(getJobProgression(loaded).some(s => s.id === 'mastery'));
    assert(getVisibleJobArchitecture(loaded).specializationChoices.some(([key]) => key === id));
    assert(usesHardTargeting(loaded)); assert.equal(JSON.stringify(h), before);
  }
});
test('3C-PRE NPC and quest presentation hides legacy progression only on V2', () => {
  const v2 = warrior(), legacy = freshHero(), npc = CITIES.jayantara.npcList.find(n => n.service === 'special')!;
  assert(!forbidden.test(getNpcServiceLabel(npc, v2) + getNpcDescription(npc, v2)));
  assert.match(getNpcServiceLabel(npc, legacy), /Mastery/);
  assert(getAllQuestJournalEntries(legacy).some(q => q.id === 'class-mastery'));
  assert(!getAllQuestJournalEntries(v2).some(q => q.category === 'class'));
  assert.deepEqual(getAllQuestJournalEntries(v2).map(q => q.id), getAllQuestJournalEntries(legacy).filter(q => q.category !== 'class').map(q => q.id));
});
test('3C-PRE display aliases do not rename legacy items, save data or substring words', () => {
  const v2 = warrior(), old = freshHero();
  for (const job of Object.values(SPECIALIZATIONS)) {
    const itemText = `${job.name} equipment · ${job.name.toLowerCase()} requirement`;
    assert(!forbidden.test(presentJobText(v2, itemText)));
    assert.equal(presentJobText(old, itemText), itemText);
  }
  assert.equal(presentJobText(v2, 'Venom Resin · resistance'), 'Venom Resin · resistance');
});
