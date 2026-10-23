import {isDragonVeil} from './dragon-veil.ts';
import {approvedQuestsEnabled} from './public-rollout';
import {mapScroll,mapVisitReceipt} from './map-scroll-contract.ts';
import {addItemToInventory,createItem,ITEM_CATALOG,POTION_IDS,removeItemQuantity,type ItemData} from './items.ts';
import {maxHP,derivedStats,restoreMana,type Hero} from './rules.ts';
import {FIELDS, WORLD_CONFIG, fieldContent, unlockReason} from './regions.ts';
import {IRONVEIL_ID,IRONVEIL_TRANSITION} from './ironveil-mines-layout.ts';
import {MINE_ID} from './ironveil-interior-layout.ts';
import { isResourceEnabled } from './gameplay-config.ts';
import { JAYANTARA_RANGE_V3 } from './jayantara-range-v3.ts';
export function shopStock(hero:Hero,service:string) {
 return Object.values(ITEM_CATALOG).filter(item=>{
 if(isDragonVeil(item.templateId))return service==='developer-materials';
 const scroll=mapScroll(item.templateId);
 if(scroll)return approvedQuestsEnabled()&&service==='consumable'&&hero.inCity&&scroll.price!==null&&hero.cityProgress[mapVisitReceipt(scroll.region)]===1&&
  (scroll.region!==MINE_ID||IRONVEIL_TRANSITION.available)&&!unlockReason(hero,scroll.region===MINE_ID?IRONVEIL_ID:scroll.region);
 return service==='developer-materials'?(item.category==='material'||item.itemType==='eternalSeal'||item.templateId==='dragon-veil-wings'||item.templateId==='developer-level-100-potion'):service==='equipment'?item.templateId!=='dragon-veil-wings'&&['weapon','armor','accessory'].includes(item.category):service==='seal'?['fateRune','eternalSeal'].includes(item.itemType):service==='consumable'?item.templateId!=='developer-level-100-potion'&&['consumable','potion'].includes(item.category):false;
 });
}
export function shopItemPrice(item:Pick<ItemData,'buyValue'|'sellValue'|'levelRequirement'> & Partial<Pick<ItemData,'templateId'|'authoredAttackVersion'>>,service:string) {
 const scroll=item.templateId&&mapScroll(item.templateId);if(scroll)return approvedQuestsEnabled()&&scroll.price!==null?scroll.price:Infinity;
 const pricingLevel=item.templateId===JAYANTARA_RANGE_V3.templateId&&item.authoredAttackVersion===JAYANTARA_RANGE_V3.version?24:item.levelRequirement;
 return service==='developer-materials'?0:item.buyValue||Math.max(60,item.sellValue*4+pricingLevel*5);
}
export function fieldShopStock(fieldId:string) {
 const field=FIELDS[fieldId]??Object.values(FIELDS).find(candidate=>candidate.contentFamilyId===fieldId); if(!field) return [];
 return Object.values(ITEM_CATALOG).filter(item => [...POTION_IDS,'arrows','rice-meal'].includes(item.templateId) || (item.templateId.startsWith(`field-${fieldContent(fieldId).id}-`) && (item.category==='weapon'?item.rarity==='common':item.rarity==='normal') && item.levelRequirement>=field.minLevel && item.levelRequirement<=field.maxLevel));
}
export function buyFieldShopItem(hero:Hero,fieldId:string,templateId:string,quantity=1) {
 if(hero.inCity||hero.currentField!==fieldId) return {ok:false,reason:'Field shop hanya tersedia di camp field ini.'};
 const template=fieldShopStock(fieldId).find(item=>item.templateId===templateId); if(!template) return {ok:false,reason:'Item tidak tersedia di field shop.'};
 const amount=Math.max(1,Math.floor(quantity));
 const price=(template.buyValue||Math.max(25,template.sellValue*4))*amount; if(hero.gold<price) return {ok:false,reason:`Membutuhkan ${price} GOLD.`};
 const result=addItemToInventory(hero.inventory,createItem(templateId,{quantity:amount}),hero.inventoryCapacity); if(result.remaining) return {ok:false,reason:'Inventory penuh.'};
 hero.inventory=result.inventory; hero.gold-=price; hero.potions=hero.inventory.filter(item=>item.itemType==='potion').reduce((sum,item)=>sum+item.quantity,0);
 return {ok:true,reason:`${template.name} dibeli · ${amount}x · ${price} GOLD.`};
}
export function sellInventoryItem(hero:Hero,itemId:string,quantity:number,allowedCategories?:string[]) {
 const item=hero.inventory.find(entry=>entry.id===itemId);
 if(!item) return {ok:false,reason:'Item tidak ditemukan.',earned:0};
 if(Object.values(hero.equipment).includes(itemId)) return {ok:false,reason:'Lepas equipment sebelum menjual.',earned:0};
 if(item.sockets.some(socket=>socket.rune)) return {ok:false,reason:'Lepas Rune dari equipment sebelum menjual.',earned:0};
 const equipment=['weapon','armor','accessory'].includes(item.category);
 if(item.isQuestItem||(!equipment&&(item.isSoulbound||!item.isSellable))) return {ok:false,reason:'Item ini tidak dapat dijual.',earned:0};
 if(!item.sellValue||item.sellValue<=0) return {ok:false,reason:'Item ini tidak dapat dijual.',earned:0};
 if(allowedCategories?.length&&!allowedCategories.includes(item.category)) return {ok:false,reason:'NPC ini tidak menerima jenis item tersebut.',earned:0};
 const amount=Math.max(1,Math.min(Math.floor(quantity),item.quantity));
 const removed=removeItemQuantity(hero.inventory,itemId,amount); if(!removed.removed) return {ok:false,reason:'Item tidak ditemukan.',earned:0};
 const earned=removed.removed*item.sellValue; hero.inventory=removed.inventory; hero.gold+=earned;
 hero.potions=hero.inventory.filter(entry=>entry.itemType==='potion').reduce((sum,entry)=>sum+entry.quantity,0);
 return {ok:true,reason:'Item berhasil dijual',earned};
}
export function buyShopItem(hero:Hero,templateId:string,service:string,quantity=1) {
 if(mapScroll(templateId)&&(!Number.isSafeInteger(quantity)||quantity<1))return {ok:false,reason:'Jumlah scroll tidak valid.'};
 const template=shopStock(hero,service).find(item=>item.templateId===templateId);
 if(!hero.inCity||!template) return {ok:false,reason:'Item tidak tersedia di toko ini.'};
 const amount=Math.max(1,Math.floor(quantity));
 const price=shopItemPrice(template,service)*amount;
 if(hero.gold<price) return {ok:false,reason:`Membutuhkan ${price} GOLD.`};
 const result=addItemToInventory(hero.inventory,createItem(templateId,{quantity:amount}),hero.inventoryCapacity);
 if(result.remaining) return {ok:false,reason:'Inventory penuh.'};
 hero.inventory=result.inventory;hero.gold-=price;
 hero.potions=hero.inventory.filter(item=>item.itemType==='potion').reduce((sum,item)=>sum+item.quantity,0);
 return {ok:true,reason:`${template.name} dibeli · ${amount}x · ${price} GOLD.`};
}
export function transferStorage(hero:Hero,id:string,withdraw=false,quantity=1) {
 if(!hero.inCity) return {ok:false,reason:'Storage hanya tersedia di kota.'};
 const source=withdraw?hero.storage:hero.inventory;const destination=withdraw?hero.inventory:hero.storage;
 const item=source.find(item=>item.id===id);
 if(!item) return {ok:false,reason:'Item tidak ditemukan.'};
 if(item.templateId==='quest-ironveil-survey-sample-v1')return {ok:false,reason:'Sampel quest tetap di inventory hingga dilaporkan.'};
 if(!withdraw&&Object.values(hero.equipment).includes(id)) return {ok:false,reason:'Lepas equipment dahulu.'};
 const amount=Math.max(1,Math.min(Math.floor(quantity),item.quantity));
 const transferItem={...item,quantity:amount};
 const result=addItemToInventory(destination,transferItem,withdraw?hero.inventoryCapacity:WORLD_CONFIG.storageCapacity);
 if(result.remaining) return {ok:false,reason:'Ruang tujuan tidak cukup untuk seluruh stack.'};
 const remaining=removeItemQuantity(source,id,amount).inventory;
 if(withdraw){hero.inventory=result.inventory;hero.storage=remaining;}else{hero.storage=result.inventory;hero.inventory=remaining;}
 hero.potions=hero.inventory.filter(item=>item.itemType==='potion').reduce((sum,item)=>sum+item.quantity,0);
 return {ok:true,reason:withdraw?'Item diambil dari storage.':'Item disimpan.'};
}
export function healAtCity(hero:Hero) { if(!hero.inCity)return false;const stats=derivedStats(hero);hero.hp=maxHP(hero);if(isResourceEnabled(hero, 'stamina'))hero.stamina=stats.staminaMax;restoreMana(hero,stats.maxMana);hero.statusEffects={};return true; }
export function receiveItem(hero:Hero,item:ItemData) {const result=addItemToInventory(hero.inventory,item,hero.inventoryCapacity);hero.inventory=result.inventory;if(result.remaining)hero.pendingLoot.push({...item,quantity:result.remaining});}
