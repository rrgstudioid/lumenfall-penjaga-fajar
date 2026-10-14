import test from 'node:test';
import assert from 'node:assert/strict';
import {registerDevelopmentHomeLifecycle,notifyDevelopmentHomeLifecycle} from '../lib/game/development-home-lifecycle.ts';

test('Explicit development lifecycle: default off, exact identity, unsubscribe, duplicate enrollment, production off',()=>{
 const previous=process.env.NODE_ENV,host=Object.freeze({label:'FAKE HOST / no Game or browser'}),events=[];
 try{
  process.env.NODE_ENV='development';
  notifyDevelopmentHomeLifecycle('created',host);assert.deepEqual(events,[]);
  const stop=registerDevelopmentHomeLifecycle(e=>events.push(e));
  assert.throws(()=>registerDevelopmentHomeLifecycle(()=>{}),/already registered/);
  notifyDevelopmentHomeLifecycle('created',host);notifyDevelopmentHomeLifecycle('disposed',host);
  assert.equal(events.length,2);assert.equal(events[0].game,host);assert(Object.isFrozen(events[0]));assert.equal(events[1].type,'disposed');
  stop();stop();notifyDevelopmentHomeLifecycle('created',host);assert.equal(events.length,2);
  process.env.NODE_ENV='production';const noOp=registerDevelopmentHomeLifecycle(e=>events.push(e));notifyDevelopmentHomeLifecycle('created',host);noOp();assert.equal(events.length,2);
 }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
