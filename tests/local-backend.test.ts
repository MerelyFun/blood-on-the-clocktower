import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStore } from '../scripts/local-store.ts';
import { createLocalServer } from '../scripts/local-server.mjs';
import { BASE_SCRIPTS } from '../supabase/functions/_shared/catalog.ts';

test('SQLite rooms preserve sessions and commands after restart, with private member views',()=>{
 const folder=mkdtempSync(join(tmpdir(),'clocktower-db-')),path=join(folder,'test.sqlite');let store=new LocalStore(path);
 try{
  const host=store.request({action:'session'}),player=store.request({action:'session'}),other=store.request({action:'session'});
  const request=(body:any,who=host)=>store.request(body,who.token);
  const roomId=randomUUID();let view=request({action:'create',roomId,script:BASE_SCRIPTS[0],count:7});
  const code=view.game.code,seatId=view.game.seats[0].id;
  assert.equal(request({action:'create',roomId,script:BASE_SCRIPTS[0],count:7}).game.code,code);
  assert.throws(()=>request({action:'create',roomId,script:BASE_SCRIPTS[0]},other),/已被使用/);
  assert.throws(()=>request({action:'get',roomId},player),/权限/);
  assert.deepEqual(request({action:'join',code,nickname:'玩家'},player),{kind:'pending',id:roomId,title:view.game.title,status:'pending'});
  assert.throws(()=>request({action:'command',roomId,opId:randomUUID(),command:{type:'auto_setup'}},player),/尚未批准/);
  request({action:'member',roomId,target:player.user.id,memberAction:'approve',seatId});
  const command=(type:string,payload={},version=view.game.version,opId=randomUUID())=>{const body={action:'command',roomId,opId,expectedVersion:version,command:{type,payload}};view=request(body);return body;};
  command('auto_setup');command('deal');command('note',{text:'HOST SECRET'});
  const personal=request({action:'get',roomId},player);assert.equal(personal.kind,'player');assert.ok(personal.personal.role);
  assert.equal(JSON.stringify(personal).includes('HOST SECRET'),false);assert.equal('game' in personal,false);assert.equal('roleId' in personal.room.seats[0],false);
  assert.throws(()=>request({action:'command',roomId,opId:randomUUID(),command:{type:'note',payload:{text:'attack'}}},player),/仅说书人/);
  request({action:'notes',roomId,operation:'save',body:'PLAYER SECRET',user_id:host.user.id},player);
  assert.equal(request({action:'notes',roomId,operation:'get'}).body,'');
  assert.equal(request({action:'notes',roomId,operation:'get',user_id:host.user.id},player).body,'PLAYER SECRET');
  const last=command('record',{text:'one record'});const version=view.game.version;
  assert.equal(request(last).game.version,version);
  assert.throws(()=>command('record',{text:'stale'},0),/局面已经更新/);
  store.close();store=new LocalStore(path);
  assert.equal(request({action:'get',roomId}).game.version,version);assert.equal(request(last).game.version,version);
  assert.equal(request({action:'notes',roomId,operation:'get'},player).body,'PLAYER SECRET');
  assert.throws(()=>request({action:'join',code,nickname:'替换'},other),/已锁定/);
  command('lock',{locked:false});request({action:'join',code,nickname:'替换'},other);
  assert.throws(()=>request({action:'member',roomId,target:other.user.id,memberAction:'approve',seatId}),/仍绑定/);
  request({action:'member',roomId,target:other.user.id,memberAction:'approve',seatId,rebind:true});
  assert.throws(()=>request({action:'get',roomId},player),/权限/);
  assert.throws(()=>request({action:'notes',roomId,operation:'get'},player),/权限/);
  const custom={...BASE_SCRIPTS[0],id:'mine'};request({action:'scripts',operation:'save',script:custom});
  assert.equal(request({action:'scripts',operation:'list'},other).scripts.length,0);
  request({action:'scripts',operation:'delete',id:'mine'},other);assert.equal(request({action:'scripts',operation:'list'}).scripts.length,1);
 }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});

test('local API rejects missing identities, cross-origin calls and malformed bodies',async()=>{
 const server=createLocalServer({databasePath:':memory:'});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as {port:number},url=`http://127.0.0.1:${address.port}/api/local`;
 try{
  const post=(body:any,headers={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await post({action:'list'})).status,401);
  assert.equal((await post({action:'session'},{origin:'https://attacker.invalid'})).status,403);
  const session=await post({action:'session'},{origin:`http://127.0.0.1:${address.port}`});assert.equal(session.status,200);
  const data=await session.json();assert.ok(data.token);assert.equal(data.user.is_anonymous,false);
  assert.equal((await post({action:'list'},{authorization:`Bearer ${data.token}`})).status,200);
  assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400);
 }finally{await new Promise<void>((resolve,reject)=>server.close((error:any)=>error?reject(error):resolve()));}
});
