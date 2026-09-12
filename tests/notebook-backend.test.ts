import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LocalStore } from '../scripts/local-store.ts';
import { BASE_SCRIPTS } from '../supabase/functions/_shared/catalog.ts';

test('notebooks isolate owners, use CAS and validate payloads',()=>{
 const store=new LocalStore(':memory:');
 try{
  const a=store.request({action:'session'}),b=store.request({action:'session'}),id=randomUUID();
  const call=(payload:any,who=a)=>store.request({action:'notebooks',...payload},who.token);
  const data={schemaVersion:1,title:'PRIVATE',entries:[]};
  const first=call({operation:'save',id,data,expectedRevision:0}).notebook;
  assert.equal(first.revision,1);
  assert.equal(call({operation:'list'},b).notebooks.length,0);
  assert.equal(call({operation:'get',id},b).notebook,null);
  assert.throws(()=>call({operation:'save',id,data,expectedRevision:0},b),(e:any)=>e.code==='FORBIDDEN');
  call({operation:'save',id,data:{...data,title:'new'},expectedRevision:1});
  assert.throws(()=>call({operation:'save',id,data,expectedRevision:1}),(e:any)=>e.code==='VERSION_CONFLICT');
  assert.throws(()=>call({operation:'delete',id,expectedRevision:1}),(e:any)=>e.code==='VERSION_CONFLICT');
  assert.equal(call({operation:'get',id}).notebook.data.title,'new');
  assert.throws(()=>call({operation:'save',id:randomUUID(),data:{schemaVersion:2},expectedRevision:0}));
  assert.throws(()=>call({operation:'save',id:randomUUID(),data:{schemaVersion:1,text:'字'.repeat(350000)},expectedRevision:0}));
  call({operation:'delete',id,expectedRevision:2});assert.equal(call({operation:'get',id}).notebook,null);
 }finally{store.close();}
});

test('room notebooks remain private after revocation, reject sync and duplicate links; occupant follows person',()=>{
 const store=new LocalStore(':memory:');
 try{
  const host=store.request({action:'session'}),a=store.request({action:'session'}),b=store.request({action:'session'});
  const call=(body:any,who=host)=>store.request(body,who.token);
  const roomId=randomUUID(),view=call({action:'create',roomId,script:BASE_SCRIPTS[0],count:7});
  for(const who of [a,b])call({action:'join',code:view.game.code,nickname:'p'},who);
  const id=randomUUID(),payload={action:'notebooks',operation:'save',id,roomId,data:{schemaVersion:1,title:'SECRET'},expectedRevision:0};
  assert.throws(()=>call(payload,a),(e:any)=>e.code==='FORBIDDEN');
  const approve=(who:any,seatId:string,rebind=false)=>call({action:'member',roomId,target:who.user.id,memberAction:'approve',seatId,rebind});
  approve(a,view.game.seats[0].id);
  const first=call({action:'get',roomId},a).room.seats[0].occupantId;
  assert.ok(first);assert.notEqual(first,a.user.id);
  assert.equal(call({action:'get',roomId}).publicRoom.seats[0].occupantId,first);
  assert.equal('roleId' in call({action:'get',roomId}).publicRoom.seats[0],false);
  call(payload,a);
  assert.throws(()=>call({...payload,id:randomUUID()},a),(e:any)=>e.code==='VERSION_CONFLICT');
  approve(a,view.game.seats[1].id);
  assert.equal(call({action:'get',roomId},a).room.seats[1].occupantId,first);
  approve(b,view.game.seats[1].id,true);
  const town=call({action:'get',roomId},b).room;
  assert.notEqual(town.seats[1].occupantId,first);assert.equal(JSON.stringify(town).includes('SECRET'),false);
  assert.equal(call({action:'get',roomId}).publicRoom.seats[1].occupantId,town.seats[1].occupantId);
  assert.equal(call({action:'notebooks',operation:'get',id},a).notebook.data.title,'SECRET');
  assert.throws(()=>call({...payload,expectedRevision:1},a),(e:any)=>e.code==='FORBIDDEN');
  assert.equal(call({action:'notebooks',operation:'list'},b).notebooks.length,0);
 }finally{store.close();}
});
