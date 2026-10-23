'use client';
import {approvedEquipmentEnabled} from '@/lib/game/public-rollout';
import { createContext, useContext, type ReactNode } from 'react';
import type { Game } from '@/lib/game/world';
import { equipmentDetail, type DetailItem, type DetailRow, type SetDetail } from '@/lib/game/equipment-detail-presentation';
import { JobText } from './job-presentation-context';
import { developmentEquipmentAuthoring } from '@/lib/game/equipment-authoring-v1';
import type { ItemData } from '@/lib/game/items';

export const ItemRangeContext = createContext<Game | null>(null);
export function readEquipmentDetail(item: DetailItem, game: Game | null) {
  // Pure template projection mirrors new acquisition; it never creates an instance or rolls sources.
  const displayed=!item.id&&approvedEquipmentEnabled()?developmentEquipmentAuthoring(item as ItemData):item;
  const selected=!!game&&!!item.id&&game.hero.inventory.includes(item as ItemData)&&Object.values(game.hero.equipment).includes(item.id)&&game.getDevelopmentAdventurerRange()?.ok===true;
  return equipmentDetail(displayed,{owner:game?.hero,development:process.env.NODE_ENV==='development',selected,
    physicalRange:game?.getDevelopmentAdventurerItemRange(item)});
}
function Rows({rows}:{rows:readonly DetailRow[]}) {
  return <dl className="eq-detail-rows">{rows.map((row,index)=><div key={`${row.key}-${index}`}>
    <dt>{row.label}</dt><dd>{row.value}</dd>
    {row.base!==undefined && <small className="eq-detail-breakdown"><span>Base (+0): {row.base}</span>{row.enhancement && !['0','0–0'].includes(row.enhancement)&&<span>Enhancement: +{row.enhancement}</span>}</small>}
  </div>)}</dl>;
}
/** Display only. Fixture values never reach the gameplay registry/resolver. */
export function EquipmentSetSection({sets,fixture=false}:{sets:readonly SetDetail[];fixture?:boolean}) {
  if(!sets.length)return null;
  return <section className="eq-detail-section eq-detail-set" data-equipment-section="set">
    <h4>Set</h4>{fixture&&<p className="eq-detail-note">Contoh development · tanpa stat, catalog atau save.</p>}
    {sets.map(set=><div key={set.id}>
      <strong>{set.name} · {set.count}/{set.total}</strong>
      <ul>{set.pieces.map(piece=><li key={piece.id} className={piece.equipped?'is-active':'is-locked'}>{piece.equipped?'✓ Dipakai':'○ Belum'} · <JobText>{piece.name}</JobText></li>)}</ul>
      <ul>{set.thresholds.map(t=><li key={t.pieces} className={t.active?'is-active':'is-locked'}>
        <b>{t.active?'✓ Aktif':'🔒 Terkunci'} · {t.pieces} bagian</b>
        {t.bonuses.length?<Rows rows={t.bonuses}/>:<span> · {fixture?'Contoh threshold tanpa bonus numerik':'Tidak ada bonus numerik terdefinisi'}</span>}
      </li>)}</ul><small>Threshold yang tercapai berlaku kumulatif.</small>
    </div>)}
  </section>;
}
export function EquipmentDetail({item,game,compact=false,unlockAction}:{item:DetailItem;game?:Game|null;compact?:boolean;unlockAction?:ReactNode}) {
  const inherited=useContext(ItemRangeContext),dto=readEquipmentDetail(item,game===undefined?inherited:game);
  return <div className="eq-detail" data-equipment-detail={item.templateId}>
    <div className="eq-detail-meta">{dto.metadata.filter(Boolean).map(text=><small key={text}><JobText>{text}</JobText></small>)}{dto.equipped&&<strong>✓ Equipped</strong>}</div>
    {dto.core.length>0&&<section className="eq-detail-section" data-equipment-section="core"><h4>Stat utama</h4><Rows rows={dto.core}/></section>}
    {dto.notes.map(note=><p className="eq-detail-note" key={note}>{note}</p>)}
    {(dto.intrinsic.length>0||dto.effects.length>0)&&<section className="eq-detail-section" data-equipment-section="intrinsic"><h4>Stat & kemampuan bawaan</h4><Rows rows={dto.intrinsic}/>
      {dto.effects.map(effect=><div key={effect.text}><p><JobText>{effect.text}</JobText></p><small>{effect.status}</small></div>)}
    </section>}
    {dto.description&&<section className="eq-detail-section" data-equipment-section="description"><h4>Deskripsi</h4><p><JobText>{dto.description}</JobText></p></section>}
    {(dto.options.length>0||dto.locked)&&<section className="eq-detail-section" data-equipment-section="options"><h4>Opsi tambahan</h4>
      {dto.locked?<><p>🔒 Opsi belum terungkap · membutuhkan Magnifier.</p>{unlockAction}</>:<Rows rows={dto.options}/>}
    </section>}
    {dto.uncertain.length>0&&<section className="eq-detail-section" data-equipment-section="retained"><h4>Bonus tersimpan</h4><small>Asal bawaan dan opsi belum terpisah pada data ini.</small><Rows rows={dto.uncertain}/></section>}
    {dto.sockets.length>0&&<section className="eq-detail-section" data-equipment-section="runes"><h4>Rune & socket</h4>
      {dto.sockets.map((socket,index)=><div className="eq-detail-socket" key={`${socket.id}-${index}`}><strong>{socket.name?'●':'○'} Socket {socket.index} · <JobText>{socket.name??'Kosong'}</JobText></strong><Rows rows={socket.rows}/>
        {socket.effect&&<><p><JobText>{socket.effect.text}</JobText></p><small>{socket.effect.status}</small></>}
      </div>)}
    </section>}
    {process.env.NODE_ENV==='development'&&dto.diagnostics.length>0&&!compact&&<details className="eq-detail-inspection"><summary>Inspeksi development</summary>{dto.diagnostics.map(text=><p key={text}>{text}</p>)}</details>}
    {compact&&<small className="eq-detail-note">Buka detail item untuk seluruh rincian.</small>}
    <EquipmentSetSection sets={dto.sets}/>
  </div>;
}
