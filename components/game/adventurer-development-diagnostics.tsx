'use client';
import { useEffect, useState } from 'react';
import type { Game } from '../../lib/game/world';
import { readActualAdventurerDiagnostic, evaluateAdventurerDiagnosticActions, type DiagnosticTargets } from '../../lib/game/adventurer-diagnostic-v2';
import { evaluateDeclaredAdventurerWorkload, type DeclaredWorkload } from '../../lib/game/adventurer-diagnostic-workload-v2';
import { buildAdventurerDiagnosticProfile, type AdventurerDiagnosticInput } from '../../lib/game/adventurer-cp-foundation-v2';
import { readNominalOffense, previewNominalOffense } from '../../lib/game/adventurer-nominal-offense-v3';
import { readPackageB, previewPackageB } from '../../lib/game/adventurer-package-b-diagnostic';

/** Mounted only by an explicitly requested development fixture. No Home import,
 * storage, live CP, casting, enrollment or production HUD integration. */
const sessions = new WeakMap<Game, number>();
let nextSession = 0;
export function AdventurerDevelopmentDiagnostics({ game }: { game: Game | null }) {
  if (process.env.NODE_ENV === 'production') return null;
  if (game && !sessions.has(game)) sessions.set(game, ++nextSession);
  return <DiagnosticSession key={game ? sessions.get(game) : 'no-game'} game={game}/>;
}
function DiagnosticSession({ game }: { game: Game | null }) {
  const [enabled, setEnabled] = useState(false), [revision, setRevision] = useState(0);
  const [targetsText, setTargets] = useState(''), [workloadText, setWorkload] = useState('');
  const [comparisonText, setComparison] = useState(''), [selection, setSelection] = useState('');
  const [previewItem, setPreviewItem] = useState(''), [previewStat, setPreviewStat] = useState<''|'str'|'vit'|'dex'|'int'>('');
  useEffect(() => { if (!enabled) return; const id = setInterval(() => setRevision(r => r + 1), 400); return () => clearInterval(id); }, [enabled]);
  if (process.env.NODE_ENV === 'production') return null;
  const nominal = enabled && game ? readNominalOffense(game) : null;
  const preview = enabled && game && (previewItem || previewStat) ? previewNominalOffense(game,
    { ...(previewItem ? {itemId:previewItem} : {}), ...(previewStat ? {allocate:[previewStat]} : {}) }) : null;
  const defense = enabled && game ? readPackageB(game) : null;
  const defensePreview = enabled && game && (previewItem || previewStat) ? previewPackageB(game,
    { ...(previewItem ? {itemId:previewItem} : {}), ...(previewStat ? {allocate:[previewStat]} : {}) }) : null;
  let result: unknown = { code: 'INPUT_MISSING', path: 'current Game' }, actorText = 'No active Game';
  if (enabled && game) {
    const actor = readActualAdventurerDiagnostic(game);
    if (!actor.ok) { result = actor; actorText = `Unavailable: ${actor.code}`; }
    else {
      actorText = `${actor.value.input.level} / ${actor.value.input.weapon.templateId} / ${actor.value.profile.sourceVersion}\nCore ${actor.value.profile.core}, BASE ${actor.value.profile.weaponRange.min}–${actor.value.profile.weaponRange.max}\nMAIN ${actor.value.profile.core + actor.value.profile.weaponRange.min}–${actor.value.profile.core + actor.value.profile.weaponRange.max}`;
      try {
        const provenance = { source: 'USER SUPPLIED DEVELOPMENT VIEWER', version: 'EXPLICIT_V1', label: 'NOT CANONICAL — caller diagnostic input' };
        const targets: DiagnosticTargets | undefined = targetsText ? JSON.parse(targetsText) : undefined;
        const selected = selection ? selection.split(',').map(x => x.trim()) : undefined;
        const evaluated = evaluateAdventurerDiagnosticActions(actor.value, targets, selected, provenance);
        const workload = workloadText ? evaluateDeclaredAdventurerWorkload(actor.value, JSON.parse(workloadText) as DeclaredWorkload,
          evaluated.ok ? evaluated.value.rows : undefined) : { ok: false, code: 'INPUT_MISSING', path: 'workload' };
        // Exact mathematical DTO supplied by caller; not a projected actor receipt.
        const comparisonInputs = comparisonText ? JSON.parse(comparisonText) as AdventurerDiagnosticInput[] : null;
        if (comparisonInputs && (!Array.isArray(comparisonInputs) || comparisonInputs.length > 64)) throw new Error('SUPPORTED_LIMIT / comparison array');
        const comparisons = comparisonInputs?.map(buildAdventurerDiagnosticProfile) ?? null;
        result = { authority: actor.value.authority, actions: actor.value.actions.map(a => ({ id: a.id, rank: a.rank, event: a.event,
          expectedRaw: a.expectedRaw, mana: a.mana, cooldown: a.cooldown, lock: a.lock, delay: a.delay, healCapacity: a.healCapacity })),
          resolved: { accuracy: actor.value.stats.accuracy, criticalRate: actor.value.stats.criticalRate,
            criticalDamage: actor.value.stats.criticalDamage, mana: actor.value.resources, clocks: actor.value.clocks },
          evaluated, workload, comparisons, comparisonAuthority: 'MATHEMATICAL INPUTS ONLY — NOT OWNED/EQUIPPED/CAST AUTHORITY', finalCombatPower: null };
      } catch (e) { result = { ok: false, code: 'INVALID_EXPLICIT_CONTRACT', reason: String(e) }; }
    }
  }
  return <aside data-diagnostic-revision={revision} style={{position:'fixed',right:8,top:38,zIndex:55,maxWidth:480,color:'#eef5ee',background:'#14251fee',border:'1px solid #9db888',padding:8,fontSize:11}}>
    <button onClick={() => setEnabled(v => !v)}>{enabled ? 'Hide development diagnostic' : 'Open development diagnostic'}</button>
    {enabled && <div style={{maxHeight:'70vh',overflow:'auto'}}>
      <strong>Development Diagnostic — Not Final Combat Power</strong>
      <p>Potensi offense — damage/detik (protokol nominal 30s). Bukan CP pemain atau rotasi optimal.</p>
      <pre data-testid="nominal-offense">{nominal?.ok ? `${nominal.value.expectedDPS.toFixed(2)} damage/detik\n${nominal.value.policy.version}\n${nominal.value.policy.bankVersion}\n${nominal.value.chosen.subset.join(' + ')}\nTotal ${nominal.value.expectedTotal.toFixed(2)}; Mana terpakai ${nominal.value.chosen.ledger.paidMana}; pulih ${nominal.value.chosen.ledger.effectiveRecoveredMana.toFixed(2)}; sisa ${nominal.value.chosen.ledger.finalMana.toFixed(2)}` : JSON.stringify(nominal)}</pre>
      <label>Preview owned MAIN<select aria-label="Nominal equipment preview" value={previewItem} onChange={e=>setPreviewItem(e.target.value)}><option value="">Current MAIN</option>{game?.hero.inventory.filter(i=>i.category==='weapon').map(i=><option key={i.id} value={i.id}>{i.name} +{i.enhancementLevel}</option>)}</select></label>
      <label>Preview satu point legal<select aria-label="Nominal allocation preview" value={previewStat} onChange={e=>setPreviewStat(e.target.value as typeof previewStat)}>{['','str','vit','dex','int'].map(s=><option key={s} value={s}>{s || 'No allocation'}</option>)}</select></label>
      <pre data-testid="nominal-preview">{preview?.ok ? `Preview saja: ${preview.value.expectedDPS.toFixed(2)} damage/detik; bukan izin equip/cast` : JSON.stringify(preview)}</pre>
      <section data-testid="package-b">
        <strong>Pertahanan pasif dan pemulihan dalam skenario 30s</strong>
        {defense?.ok ? <>
          <p>EHP fisik {defense.value.ehp.channels[0].ehp.toFixed(2)}; magic hipotetis {defense.value.ehp.channels[1].ehp.toFixed(2)}; geometric {defense.value.ehp.geometric.toFixed(2)}.</p>
          {defense.value.channels.map(c=><div key={c.channel}>
            <b>{c.channel === 'physical' ? 'Tekanan fisik landed' : 'Tekanan magic hipotetis landed'}</b>
            <p>Tanpa Heal: offense {c.noHeal.expectedOffenseDPS.toFixed(2)}/s; dengan Heal {c.withHeal.expectedOffenseDPS.toFixed(2)}/s (Δ {c.offenseDelta.toFixed(2)}).</p>
            <p>Heal terpakai {c.withHeal.usableHeal.toFixed(2)} HP ({c.withHeal.usableHPS.toFixed(2)}/s), overheal {c.withHeal.overheal.toFixed(2)}; HP akhir {c.withHeal.finalHP.toFixed(2)}. {c.withHeal.survivedHorizon ? 'Bertahan sampai 30s; waktu hidup censored pada horizon' : `Model mati pada ${c.withHeal.deathAt}s; waktu kematian diketahui`}.</p>
            <p>Mana bersama: terpakai {c.withHeal.paidMana}, pulih {c.withHeal.recoveredMana.toFixed(2)}, sisa {c.withHeal.finalMana.toFixed(2)}.</p>
          </div>)}
          <p>Heal lebih kecil dapat berarti damage masuk lebih kecil. Bukan penentuan build terbaik, CP total, atau prediksi hidup stokastik. Shield tidak didukung kit; HP regen belum punya consumer.</p>
          <details><summary>Versi dan asumsi B</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify({policy:defense.value.policy,bank:defense.value.ehp.bank,assumptions:defense.value.assumptions},null,1)}</pre></details>
        </> : <pre>{JSON.stringify(defense)}</pre>}
        <pre data-testid="package-b-preview" style={{whiteSpace:'pre-wrap'}}>{defensePreview?.ok ? JSON.stringify(defensePreview.comparison,null,1) : JSON.stringify(defensePreview)}</pre>
      </section>
      <details><summary>Bank, variant, ledger dan batas model</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(nominal?.ok ? {bank:nominal.value.bank,variants:nominal.value.chosen.variants,candidates:nominal.value.candidates.map(c=>({subset:c.subset,total:c.ledger.expectedInflictedTotal,paidMana:c.ledger.paidMana,eventCount:c.ledger.events.length})),healCapacity:nominal.value.healCapacity,unsupported:nominal.value.unsupportedReason,limitation:nominal.value.limitation} : nominal,null,1)}</pre></details>
      <p>Bagian berikut memakai skenario eksplisit pengguna, terpisah dari nominal ACC. Bukan kontrak CP total.</p>
      <pre data-testid="diagnostic-actor">{actorText}</pre>
      <label>Explicit action IDs (comma separated)<input aria-label="Diagnostic action IDs" value={selection} onChange={e=>setSelection(e.target.value)} style={{width:'100%'}}/></label>
      <label>Explicit target contract JSON<textarea aria-label="Diagnostic targets" value={targetsText} onChange={e=>setTargets(e.target.value)} style={{width:'100%',height:45}}/></label>
      <label>Explicit ordered workload JSON<textarea aria-label="Diagnostic workload" value={workloadText} onChange={e=>setWorkload(e.target.value)} style={{width:'100%',height:45}}/></label>
      <label>Mathematical comparisons JSON (array)<textarea aria-label="Diagnostic comparisons" value={comparisonText} onChange={e=>setComparison(e.target.value)} style={{width:'100%',height:45}}/></label>
      <pre data-testid="diagnostic-result" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result,null,1)}</pre>
    </div>}
  </aside>;
}
