// UI fixtures only. No inventory insertion, equip, stat application or save.
import {useState} from 'react';
import {ITEM_CATALOG, type ItemData} from '../../../lib/game/items';
import {equipmentSetPresentation} from '../../../lib/game/equipment-detail-presentation';
import {EquipmentDetail,EquipmentSetSection} from '../../../components/game/equipment-detail';
import {ItemHover} from '../../../components/game/item-hover';
import {ItemIcon} from '../../../components/game/entry-icon';
const pieceIds=['arunika-head','forest-vest','arunika-legs','arunika-boots'];
const pieces=pieceIds.map((id,index)=>({...structuredClone(ITEM_CATALOG[id]),id:`UI-set-${index}`,quantity:1} as ItemData));
const exampleSet={id:'Contoh UI · bukan set catalog',level:15,pieces:pieceIds,bonuses:{2:{},3:{},4:{}},enabled:true};
const templates=['field-verdant-plains-dagger','field-ironveil-mines-sword','jayantara-two-hand-sword','arunika-head','fajar-necklace','arcana-tome','dragon-veil-wings'];
const examples=templates.map(id=>({...structuredClone(ITEM_CATALOG[id]),id:`UI-${id}`,quantity:1} as ItemData));
const decorated={...examples[3],id:'UI-options-rune',name:'Contoh stat / opsi / Rune',bonusStats:{vit:3,maxMana:10},uniqueStatsLocked:false,
 uniqueEffect:'Contoh descriptor saja, tidak memberi efek.',description:'Fixture presentasi terisolasi. Angka contoh tidak masuk catalog atau karakter.',
 sockets:[{id:'UI-socket1',rune:{...examples[0],id:'UI-rune',name:'Contoh Rune',category:'rune',affixes:[{id:'UI-affix',stat:'int',value:2,label:'INT',unit:'flat'}],sourceLabel:'UI fixture'}},{id:'UI-socket2',rune:null}]} as ItemData;
examples.push(decorated);
export function DetailExamples(){
 const [open,setOpen]=useState(false),[count,setCount]=useState(0),[selected,setSelected]=useState(examples.length-1);
 const equipment=Object.fromEntries(pieces.slice(0,count).map(i=>[i.equipSlot,i.id]));
 const sets=equipmentSetPresentation(pieces[0],{inventory:pieces,equipment},[exampleSet]);
 return <div style={{position:'fixed',left:8,top:8,zIndex:99998}}>
 <button style={{background:'#d6e5c8',color:'#16332a',padding:6}} onClick={()=>setOpen(!open)}>Contoh UI development</button>
 {open&&<section aria-label="Contoh equipment development" style={{background:'#10231c',border:'1px solid #bba66d',padding:16,width:'min(430px, calc(100vw - 32px))',maxHeight:'85dvh',overflowY:'auto',color:'#dedbc8'}}>
   <strong>Fixture UI · bukan item pemain</strong><p>Tidak memberi stat dan tidak disimpan.</p>
   <label>Contoh item <select aria-label="Contoh item" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{examples.map((i,index)=><option value={index} key={i.id}>{i.name}</option>)}</select></label>
   <ItemHover item={examples[selected]}><h3><ItemIcon item={examples[selected]}/>{examples[selected].name}</h3></ItemHover>
   <EquipmentDetail item={examples[selected]} game={null}/>
   <label>Jumlah bagian set <select aria-label="Jumlah bagian set" value={count} onChange={e=>setCount(Number(e.target.value))}>{[0,2,3,4].map(n=><option key={n} value={n}>{n}/4</option>)}</select></label>
   <div className="eq-detail"><EquipmentSetSection sets={sets} fixture/></div>
   <button style={{position:'sticky',bottom:0,background:'#d6e5c8',color:'#16332a',padding:8}} onClick={()=>setOpen(false)}>Tutup contoh UI</button>
 </section>}
 </div>;
}
