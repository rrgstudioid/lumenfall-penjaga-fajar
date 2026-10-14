import { AMBUSH_DURATION, AMBUSH_FINAL_DAMAGE } from '@/lib/game/rogue-ambush';
import { POISON_DURATION, POISON_MAX_STACKS, POISON_TICK_INTERVAL, POISON_SLOW, POISON_SLOW_CAP, POISON_STACK_MULTIPLIERS } from '@/lib/game/assasin-poison';

/** Presentation only: does not unlock jobs or manufacture missing skill nodes. */
export function LineageMechanics({ specialization }: { specialization: string | null }) {
  if (specialization === 'rogue') return <section className="js-lineage-mechanic">
    <strong>Rogue · High-Burst Backline Diver</strong>
    <p>Posisikan diri dengan Vanish; serangan pembuka menyiapkan Ambush untuk burst singkat, lalu keluar.</p>
    <details><summary>Ambush · {AMBUSH_DURATION} sec</summary>
      <p>Serangan Rogue yang memenuhi syarat memperoleh +{Math.round((AMBUSH_FINAL_DAMAGE - 1) * 100)}% Final Damage untuk seluruh sequence. Ambush dikonsumsi pada damaging impact pertama yang berhasil; Evade tidak mengonsumsinya. Refresh tidak menambah stack.</p>
      <p>Backpierce memakai pengecualian: dianggap Rear, tanpa bonus Ambush tambahan.</p>
    </details>
  </section>;
  if (specialization === 'assasin') return <section className="js-lineage-mechanic">
    <strong>Assasin · Stealth Poison Kiter / Continuous DoT DPS</strong>
    <p>Poison dan Slow dari jarak menengah; jaga jarak dan pertahankan tekanan.</p>
    <details><summary>Poison · maksimum {POISON_MAX_STACKS} stacks</summary>
      <p>Durasi normal {POISON_DURATION} sec; tick setiap {POISON_TICK_INTERVAL} sec. Refresh durasi tidak memulai ulang jadwal tick. Poison DoT tidak dapat Crit; direct impact tetap dapat Crit.</p>
      <div className="js-mechanic-table"><table><thead><tr><th>Stacks</th><th>Potency</th><th>Movement Slow PvE</th><th>Movement Slow PvP</th></tr></thead>
        <tbody>{POISON_STACK_MULTIPLIERS.map((factor, i) => <tr key={i}><th>{i + 1}</th><td>×{factor.toFixed(2)}</td><td>{POISON_SLOW.pve[i]}%</td><td>{POISON_SLOW.pvp[i]}%</td></tr>)}</tbody></table></div>
      <p>Slow menggunakan sumber terkuat; cap PvE {POISON_SLOW_CAP.pve}% / PvP {POISON_SLOW_CAP.pvp}%. Setiap caster memiliki stack sendiri. Angka PvP adalah data, bukan PvP runtime.</p>
    </details>
  </section>;
  return null;
}
