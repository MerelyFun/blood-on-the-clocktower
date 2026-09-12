import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, persistScripts, localSubscription } from '../src/lib/storage.ts';
import { uid } from '../supabase/functions/_shared/scripts.ts';
import { BASE_SCRIPTS } from '../supabase/functions/_shared/catalog.ts';

test('invalid stored script JSON and shapes never crash or erase the original value',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{
  for(const raw of ['null','{}','false','42','{broken','[null,{},"x"]',JSON.stringify([{...BASE_SCRIPTS[0],roles:[{id:'x'}]}])]){
   let writes=0;
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:()=>writes++,removeItem:()=>writes++}});
   assert.deepEqual(loadScripts(),[]);assert.equal(writes,0);
  }
  const valid=BASE_SCRIPTS[0];
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify([null,valid,{...valid,roles:null}])}});
  assert.deepEqual(loadScripts(),[valid]);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('saving preserves each damaged original in a separate recovery key before replacement',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map<string,string>();
 const originals=['{broken',JSON.stringify([BASE_SCRIPTS[0],null])];
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  for(const original of originals){values.set('bt-scripts',original);persistScripts([BASE_SCRIPTS[0]]);}
  const backups=[...values].filter(([key])=>key.startsWith('bt-scripts-recovery-'));
  assert.deepEqual(backups.map(([,value])=>value),originals);
  assert.deepEqual(JSON.parse(values.get('bt-scripts')!),[BASE_SCRIPTS[0]]);
  persistScripts([]);
  assert.equal([...values.keys()].filter(key=>key.startsWith('bt-scripts-recovery-')).length,2);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('failed recovery backup leaves the damaged record untouched and reports the failure',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const original='null';let replacementAttempts=0;
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key==='bt-scripts'?original:null,setItem:(key:string)=>{if(key==='bt-scripts')replacementAttempts++;throw new Error('quota');}}});
  assert.throws(()=>persistScripts([]),/备份失败.*保留原记录/);
  assert.equal(replacementAttempts,0);assert.equal(localStorage.getItem('bt-scripts'),original);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('UUID generation works without secure-context randomUUID and preserves version/variant',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 const secureCrypto=globalThis.crypto;
 try{
  let calls=0;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:(bytes:Uint8Array)=>{calls++;return secureCrypto.getRandomValues(bytes);}}});
  const values=Array.from({length:100},()=>uid());
  assert.equal(calls,100);assert.equal(new Set(values).size,100);
  for(const value of values)assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);}
});

test('unsupported or blocked BroadcastChannel polls and disposes cleanly',t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'BroadcastChannel');
 t.mock.timers.enable({apis:['setInterval']});
 try{
  for(const implementation of [undefined,class{constructor(){throw new Error('blocked');}}]){
   Object.defineProperty(globalThis,'BroadcastChannel',{configurable:true,value:implementation});
   let refreshes=0;const dispose=localSubscription('room',()=>refreshes++);
   t.mock.timers.tick(2000);assert.equal(refreshes,1);
   dispose();t.mock.timers.tick(4000);assert.equal(refreshes,1);
  }
 }finally{if(descriptor)Object.defineProperty(globalThis,'BroadcastChannel',descriptor);t.mock.timers.reset();}
});

test('BroadcastChannel subscriptions still filter room messages and close',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'BroadcastChannel');
 let channel:any;
 class Channel{onmessage:any;closed=false;constructor(public name:string){channel=this;}close(){this.closed=true;}}
 try{
  Object.defineProperty(globalThis,'BroadcastChannel',{configurable:true,value:Channel});
  let refreshes=0;const dispose=localSubscription('room',()=>refreshes++);
  channel.onmessage({data:'another'});assert.equal(refreshes,0);
  channel.onmessage({data:'room'});assert.equal(refreshes,1);
  dispose();assert.equal(channel.closed,true);
 }finally{if(descriptor)Object.defineProperty(globalThis,'BroadcastChannel',descriptor);}
});
