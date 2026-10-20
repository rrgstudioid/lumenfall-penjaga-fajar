import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveQuestNavigation,matchesQuestHunt} from '../lib/game/quest-navigation.ts';
import {MeteorfallNavigation} from '../lib/game/meteorfall-citadel-navigation.ts';
import {METEORFALL_ENTRY,METEORFALL_PLATFORMS} from '../lib/game/meteorfall-citadel-layout.ts';
const target=(id,x,z,extra={})=>({id,x,z,label:id,region:'r',kind:'hunt',eligible:true,alive:true,...extra});
const resolve=(destinations,extra={})=>resolveQuestNavigation({position:{x:0,z:0},region:'r',destinations,route:p=>[p],...extra});
await test('stable target survives closer arrival; dead/despawn select alternative; wrong region/eligibility rejected',()=>{
  const a=target('a',8,0),b=target('b',2,0);
  assert.equal(resolve([a,b],{previousId:'a'}).target.id,'a');
  assert.equal(resolve([{...a,alive:false},b],{previousId:'a'}).target.id,'b');
  assert.equal(resolve([b],{previousId:'a'}).target.id,'b');
  assert.equal(resolve([target('x',1,0,{region:'wrong'}),target('y',1,0,{eligible:false})]).status,'unavailable');
});
await test('explicit species/variant contracts never fall back to ANY-KILL; legacy ANY-KILL accepts all eligible variants',()=>{
  const objective={region:'r',species:'slime',variant:'elite',anyKill:false},t={region:'r',species:'slime',variant:'elite',alive:true,dummy:false};
  assert(matchesQuestHunt(objective,t));
  for(const patch of [{species:'wolf'},{variant:'normal'},{region:'other'},{alive:false},{dummy:true}])assert(!matchesQuestHunt(objective,{...t,...patch}));
  assert(!matchesQuestHunt({region:'r',anyKill:false},t));
  assert(matchesQuestHunt({region:'r',anyKill:true},{...t,species:'wolf',variant:'normal'}));
});
await test('path distance sums waypoints, next waypoint precedes destination, no direct fallback',()=>{
  const d=target('a',3,4),r=resolve([d],{route:()=>[{x:0,z:4},{x:3,z:4}]});
  assert.equal(r.pathDistance,7);assert.equal(r.straightDistance,5);assert.deepEqual(r.waypoint,{x:0,z:4});
  assert.equal(resolve([d],{route:()=>[]}).status,'unavailable');
  assert.equal(resolve([d],{route:()=>[{x:0,z:4}]}).status,'unavailable');
  assert.equal(resolve([d],{route:()=>[{x:NaN,z:4},d]}).status,'unavailable');
});
await test('unreachable preferred target switches only to reachable eligible destination',()=>{
  const r=resolve([target('a',1,0),target('b',2,0)],{previousId:'a',route:p=>p.id==='a'?[]:[p]});assert.equal(r.target.id,'b');
});
await test('result deeply copied/frozen and input untouched; zero distance valid',()=>{
  const d=target('a',0,0),before=JSON.stringify(d),r=resolve([d]);
  assert.equal(r.pathDistance,0);assert.equal(JSON.stringify(d),before);d.x=100;assert.equal(r.target.x,0);
  assert.throws(()=>{r.path[0].x=4;});assert.throws(()=>{r.target.label='changed';});
});
await test('collection destinations require explicit eligibility and current region; no item-source inference',()=>{
  assert.equal(resolve([target('ore',1,1,{kind:'collect',eligible:false})]).status,'unavailable');
  assert.equal(resolve([target('ore',1,1,{kind:'collect',eligible:true})]).target.kind,'collect');
});
await test('Meteorfall graph follows walkable bridge segments; route exceeds straight line for real layout',()=>{
  const nav=new MeteorfallNavigation();let detour=false,valid=0;
  for(const platform of METEORFALL_PLATFORMS){
    const to={x:platform.x,z:platform.z};if(!nav.valid(to))continue;
    const route=nav.route(METEORFALL_ENTRY,to);if(!route.length)continue;
    let p=METEORFALL_ENTRY,length=0;for(const q of route){assert(nav.clear(p,q));length+=Math.hypot(q.x-p.x,q.z-p.z);p=q;}
    if(length>Math.hypot(to.x-METEORFALL_ENTRY.x,to.z-METEORFALL_ENTRY.z)+1)detour=true;valid++;
  }
  assert(valid>0);assert(detour);
});
