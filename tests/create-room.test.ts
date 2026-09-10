import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomRequests } from '../src/lib/createRoom.ts';
function store(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};}
test('timeout persists original payload across reload and retry reuses the same room',async()=>{
 const storage=store();const sent:Record<string,unknown>[]=[];
 const first=createRoomRequests('https://project','alice',storage,async b=>{sent.push(b);throw new Error('timeout');},()=> 'room-1');
 const script={name:'original'};
 await assert.rejects(first.start({script},'original'));script.name='edited';
 const reloaded=createRoomRequests('https://project/','alice',storage,async b=>{sent.push(b);return {ok:true};},()=> 'room-2');
 assert.equal(reloaded.read()?.roomId,'room-1');
 await assert.rejects(reloaded.start({script},'another'),/已有待确认/);
 await reloaded.retry();assert.deepEqual(sent[0],sent[1]);assert.equal((sent[1].script as {name:string}).name,'original');assert.equal(reloaded.read(),null);
});
test('account and project isolate pending requests',async()=>{
 const storage=store();const fail=async()=>{throw new Error('timeout');};
 const one=createRoomRequests('project-a','alice',storage,fail,()=> 'one');await assert.rejects(one.start({},'one'));
 assert.equal(createRoomRequests('project-b','alice',storage,fail,()=> 'two').read(),null);
 assert.equal(createRoomRequests('project-a','bob',storage,fail,()=> 'two').read(),null);
});
test('double submit blocked and parallel retries share an in-flight request',async()=>{
 const storage=store();let finish!:(v:unknown)=>void;let calls=0;
 const requests=createRoomRequests('project-flight','alice',storage,async()=>{calls++;return new Promise(resolve=>finish=resolve);},()=> 'one');
 const first=requests.start({},'one');await assert.rejects(requests.start({},'two'));
 const retry=requests.retry();assert.throws(()=>requests.abandon(),/仍在提交/);assert.equal(calls,1);
 finish('created');assert.equal(await first,'created');assert.equal(await retry,'created');assert.equal(requests.read(),null);
});
test('storage failure prevents untracked submission and explicit abandon allows a new request',async()=>{
 let calls=0;const blocked=createRoomRequests('project','actor',{getItem:()=>null,setItem:()=>{throw new Error('quota');},removeItem:()=>{}},async()=>{calls++;},()=> 'id');
 await assert.rejects(blocked.start({},'title'),/quota/);assert.equal(calls,0);
 const storage=store();const requests=createRoomRequests('project-abandon','alice',storage,async()=>{throw new Error('timeout');},()=> 'one');
 await assert.rejects(requests.start({},'one'));requests.abandon();assert.equal(requests.read(),null);
});
