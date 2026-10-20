import test,{after} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {createServer} from 'vite';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const output=process.env.QUEST_UX_OUTPUT;assert(output);
const server=await createServer({configFile:false,appType:'custom',cacheDir:path.join(output,'ux-test-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}}});
const {questHudPresentation}=await server.ssrLoadModule('/lib/game/quest-ux.ts'),{earlyQuest}=await server.ssrLoadModule('/lib/game/early-quest-contract.ts');
const {DevelopmentQuestSummary}=await server.ssrLoadModule('/components/game/hud/development-quest-summary.tsx'),{ItemArtwork}=await server.ssrLoadModule('/components/game/item-artwork.tsx');
const q=()=>({...earlyQuest('dev-quest-v1-iron-interior-survey'),status:'active',progress:[{current:1,required:1},{current:0,required:1},{current:2,required:5}]});
await test('HUD prioritizes unfinished W2, total progress and exact Surveyor reporting from one journal',()=>{
 const v=questHudPresentation(q());assert.equal(v.next.label,'Old Quarry Hall (W2)');assert.equal(v.remaining,2);assert.equal(v.progress,3/7*100);assert.equal(v.destination,'Surveyor Tambang · Ironveil Interior');
 const html=renderToStaticMarkup(React.createElement(DevelopmentQuestSummary,{quest:q(),onOpen(){}}));assert(html.includes('Old Quarry Hall (W2)'));assert(html.includes('Surveyor Tambang'));assert(html.includes('lihat lengkap'));assert(!html.includes('West Excavation (W1)'));
});
await test('ready/locked/completed labels and unavailable progress never advertise zero success',()=>{
 for(const [status,text] of [['ready_to_complete','Siap dilaporkan'],['locked','Terkunci'],['completed','Selesai'],['available','Belum diterima']])assert.equal(questHudPresentation({...q(),status}).status,text);
 const quest=q();quest.progress[1].unavailable=true;assert.equal(questHudPresentation(quest).progress,null);
 const intro={...earlyQuest('dev-quest-v1-iron-interior-intro'),status:'available',progress:[]};assert.equal(questHudPresentation(intro).destination,'Mandor Ironveil · Ironveil Exterior');
 assert.equal(questHudPresentation({...intro,status:'ready_to_complete'}).destination,'Surveyor Tambang · Ironveil Interior');
});
await test('Bisikan HUD describes approved global ANY-KILL while retaining registry/progress',()=>{
 const quest={...q(),id:'main-verdant-bisikan',objectives:[{targetName:'Lumut Liar',required:6}],progress:[{current:2,required:6}]},before=JSON.stringify(quest);
 assert.equal(questHudPresentation(quest).next.label,'Monster apa pun · semua wilayah');assert.equal(questHudPresentation(quest).next.current,2);assert.equal(JSON.stringify(quest),before);
});
await test('long objective is intact text with journal access, not a shortened counter copy',()=>{
 const quest=q();quest.objectives[1].targetName='Old Quarry Hall (W2) — ikuti koridor tambang dan periksa seluruh ruang tujuan';
 const html=renderToStaticMarkup(React.createElement(DevelopmentQuestSummary,{quest,onOpen(){}}));assert(html.includes(quest.objectives[1].targetName));assert(html.includes('semua objective di jurnal'));
});
await test('known map scroll reuses existing ScrollText SVG without unknown-item image',()=>{
 const html=renderToStaticMarkup(React.createElement(ItemArtwork,{item:{templateId:'map-scroll-v1-ironveil-mines-interior-v1',rarity:'common'}}));assert(html.includes('existing-lucide:ScrollText'));assert(html.includes('<svg'));assert(!html.includes('unknown-item.svg'));assert(!html.includes('<img'));
 const unknown=renderToStaticMarkup(React.createElement(ItemArtwork,{item:{templateId:'unrelated-unknown'}}));assert(unknown.includes('unknown-item.svg'));
});
await test('repeated read/render is deterministic, immutable input and zero RNG',()=>{
 const quest=q(),before=JSON.stringify(quest),old=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('UX RNG');};
 try{const v=questHudPresentation(quest);for(let i=0;i<25;i++){assert.deepEqual(questHudPresentation(quest),v);renderToStaticMarkup(React.createElement(DevelopmentQuestSummary,{quest,onOpen(){}}));}assert.equal(JSON.stringify(quest),before);assert.equal(draws,0);}finally{Math.random=old;}
});
after(()=>server.close());
await test('approved production rollout uses the same scroll SVG without unknown fallback',async()=>{
 const prod=await createServer({configFile:false,mode:'production',appType:'custom',define:{'process.env.NODE_ENV':'"production"'},cacheDir:path.join(output,'ux-production-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}}});
 try{const {ItemArtwork:ProductionArtwork}=await prod.ssrLoadModule('/components/game/item-artwork.tsx');const html=renderToStaticMarkup(React.createElement(ProductionArtwork,{item:{templateId:'map-scroll-v1-verdant-plains-v2'}}));assert(html.includes('existing-lucide:ScrollText'));assert(!html.includes('<img'));assert(!html.includes('unknown-item.svg'));}
 finally{await prod.close();}
});
