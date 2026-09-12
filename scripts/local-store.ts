import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { applyCommand, createGame, GameError, personalView, publicGame, restoreGame, roomCode } from '../supabase/functions/_shared/engine.ts';
import type { Game, Script } from '../supabase/functions/_shared/types.ts';

const fail=(message:string,code='INVALID_COMMAND'):never=>{throw new GameError(message,code);};
const uuid=(value:unknown):string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:fail('无效的操作标识。');
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
function script(value:any):Script {if(!value||typeof value.id!=='string'||typeof value.name!=='string'||!Array.isArray(value.roles)||value.roles.length>300||value.roles.some((r:any)=>!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.ability!=='string'))fail('剧本格式无效。');return value;}

/** Synchronous transactions serialize room commands and membership changes together. */
export class LocalStore {
 db:DatabaseSync;
 constructor(path:string){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,owner_id TEXT NOT NULL,state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS members(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL,nickname TEXT NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL,seat_id TEXT,created_at TEXT NOT NULL,PRIMARY KEY(room_id,user_id));
   CREATE UNIQUE INDEX IF NOT EXISTS active_seat ON members(room_id,seat_id) WHERE status='active' AND seat_id IS NOT NULL;
   CREATE TABLE IF NOT EXISTS commands(room_id TEXT NOT NULL REFERENCES rooms(id),op_id TEXT NOT NULL,actor_id TEXT NOT NULL,PRIMARY KEY(room_id,op_id));
   CREATE TABLE IF NOT EXISTS notes(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(room_id,user_id));
   CREATE TABLE IF NOT EXISTS notebooks(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,room_id TEXT REFERENCES rooms(id),data TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
   CREATE UNIQUE INDEX IF NOT EXISTS notebook_room_owner ON notebooks(user_id,room_id) WHERE room_id IS NOT NULL;
   CREATE TABLE IF NOT EXISTS scripts(user_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,id));
   CREATE TABLE IF NOT EXISTS join_limits(user_id TEXT PRIMARY KEY,started INTEGER NOT NULL,attempts INTEGER NOT NULL);`);
 }
 close(){this.db.close();}
 one(sql:string,...args:any[]):any{return this.db.prepare(sql).get(...args);}
 all(sql:string,...args:any[]):any[]{return this.db.prepare(sql).all(...args);}
 write(sql:string,...args:any[]){return this.db.prepare(sql).run(...args);}
 member(room:string,actor:string){const m=this.one('SELECT * FROM members WHERE room_id=? AND user_id=?',room,actor);if(!m||m.status==='revoked')fail('你已没有这个房间的权限。','FORBIDDEN');return m;}
 game(room:string):Game {const row=this.one('SELECT state FROM rooms WHERE id=?',room);if(!row)fail('房间不可用，请核对房间码。','ROOM_UNAVAILABLE');return JSON.parse(row.state);}
 view(room:string,actor:string){const m=this.member(room,actor),g=this.game(room);if(m.status==='pending')return {kind:'pending',id:room,title:g.title,status:'pending'};
  if(m.role==='host')return {kind:'host',game:g,publicRoom:this.publicRoom(room,g),members:this.all('SELECT user_id,nickname,role,status,seat_id FROM members WHERE room_id=? ORDER BY created_at',room)};
  return {kind:'player',room:this.publicRoom(room,g),personal:personalView(g,m.seat_id)};
 }
 publicRoom(room:string,g:Game){
  const town=publicGame(g);
  const occupants=this.all("SELECT seat_id,user_id FROM members WHERE room_id=? AND status='active' AND seat_id IS NOT NULL",room);
  town.seats=town.seats.map(s=>{const occupant=occupants.find(x=>x.seat_id===s.id);return {...s,...(occupant?{occupantId:hash(`${room}:${occupant.user_id}`)}:{})};});
  return town;
 }
 request(body:any,token=''):any {
  if(!body||typeof body!=='object'||Array.isArray(body))fail('请求格式错误。');
  let user=token?this.one('SELECT user_id FROM sessions WHERE token_hash=?',hash(token)):null;
  if(body.action==='session'){
   if(token&&!user)fail('本机身份已失效，请重新建立身份。','UNAUTHENTICATED');
   if(!user){token=randomBytes(32).toString('base64url');user={user_id:randomUUID()};this.write('INSERT INTO sessions VALUES(?,?,?)',hash(token),user.user_id,new Date().toISOString());}
   return {token,user:{id:user.user_id,is_anonymous:false,email:null}};
  }
  if(!user)fail('请先建立本机身份。','UNAUTHENTICATED');
  const actor=user.user_id;
  // Failed joins still consume the limit, outside the mutation transaction.
  if(body.action==='join'){
   const now=Date.now(),limit=this.one('SELECT * FROM join_limits WHERE user_id=?',actor);
   const fresh=!limit||now-limit.started>60000,attempts=fresh?1:limit.attempts+1;
   this.write('INSERT OR REPLACE INTO join_limits VALUES(?,?,?)',actor,fresh?now:limit.started,attempts);
   if(attempts>8)fail('加入请求过于频繁，请稍后再试。','TOO_MANY_ATTEMPTS');
  }
  this.db.exec('BEGIN IMMEDIATE');
  try{const result=this.perform(body,actor);this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 perform(body:any,actor:string):any {
  if(body.action==='notebooks'){
   const present=(row:any)=>row?{id:row.id,roomId:row.room_id,data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:null;
   if(body.operation==='list')return {notebooks:this.all('SELECT * FROM notebooks WHERE user_id=? ORDER BY updated_at DESC',actor).map(present)};
   const id=uuid(body.id),row=this.one('SELECT * FROM notebooks WHERE id=? AND user_id=?',id,actor);
   if(body.operation==='get')return {notebook:present(row)};
   if(body.operation!=='save'&&body.operation!=='delete')fail('未知笔记操作。');
   if(!Number.isInteger(body.expectedRevision)||body.expectedRevision<0)fail('缺少有效的笔记版本。');
   if((row?.revision??0)!==body.expectedRevision)fail('笔记已在其他设备更新，请保留双方版本。','VERSION_CONFLICT');
   if(body.operation==='delete'){this.write('DELETE FROM notebooks WHERE id=? AND user_id=?',id,actor);return {ok:true};}
   const data=body.data;
   if(!data||typeof data!=='object'||Array.isArray(data)||data.schemaVersion!==1)fail('笔记格式无效。');
   const encoded=JSON.stringify(data);if(Buffer.byteLength(encoded,'utf8')>1_000_000)fail('笔记不能超过 1 MB。');
   const room=body.roomId==null?null:uuid(body.roomId);
   if(row&&row.room_id!==room)fail('不能更改笔记的关联房间。');
   if(room&&this.member(room,actor).status!=='active')fail('说书人尚未批准加入。','FORBIDDEN');
   if(!row&&this.one('SELECT id FROM notebooks WHERE id=?',id))fail('笔记编号不可用。','FORBIDDEN');
   if(room&&this.one('SELECT id FROM notebooks WHERE room_id=? AND user_id=? AND id!=?',room,actor,id))fail('此房间已有关联笔记，请打开已有笔记。','VERSION_CONFLICT');
   const revision=(row?.revision??0)+1,updatedAt=new Date().toISOString();
   this.write('INSERT INTO notebooks VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at',id,actor,room,encoded,revision,updatedAt);
   return {notebook:{id,roomId:room,data,revision,updatedAt}};
  }
  if(body.action==='scripts'){
   if(body.operation==='list')return {scripts:this.all('SELECT data FROM scripts WHERE user_id=?',actor).map(x=>JSON.parse(x.data))};
   if(body.operation==='save'){const s=script(body.script);this.write('INSERT OR REPLACE INTO scripts VALUES(?,?,?)',actor,s.id,JSON.stringify(s));return {script:s};}
   if(body.operation==='delete'){if(typeof body.id!=='string')fail('无效的剧本编号。');this.write('DELETE FROM scripts WHERE user_id=? AND id=?',actor,body.id);return {ok:true};}
   fail('未知剧本操作。');
  }
  if(body.action==='list')return {rooms:this.all("SELECT m.*,r.state FROM members m JOIN rooms r ON r.id=m.room_id WHERE m.user_id=? AND m.status!='revoked' ORDER BY m.created_at DESC",actor).map(row=>{const g:Game=JSON.parse(row.state);return {role:row.role,status:row.status,room_id:row.room_id,bt_rooms:{id:g.id,title:g.title,code:g.code,created_at:g.createdAt}};})};
  if(body.action==='create'){
   const id=uuid(body.roomId),existing=this.one('SELECT owner_id FROM rooms WHERE id=?',id);
   if(existing){if(existing.owner_id!==actor)fail('房间编号已被使用。','FORBIDDEN');return this.view(id,actor);}
   if(!body.restore&&(!Number.isInteger(body.count??7)||(body.count??7)<5||(body.count??7)>15))fail('普通玩家人数应为 5–15 的整数。');
   if(!body.restore&&!script(body.script).roles.length)fail('请先为剧本添加角色。');
   const g=body.restore?restoreGame(body.restore):createGame(script(body.script),body.count??7,body.title);
   g.id=id;while(this.one('SELECT id FROM rooms WHERE code=?',g.code))g.code=roomCode();
   this.write('INSERT INTO rooms VALUES(?,?,?,?)',id,g.code,actor,JSON.stringify(g));
   this.write('INSERT INTO members VALUES(?,?,?,?,?,?,?)',id,actor,'说书人','host','active',null,new Date().toISOString());return this.view(id,actor);
  }
  if(body.action==='join'){
   if(typeof body.code!=='string'||!/^[A-Z2-9]{6}$/i.test(body.code)||typeof body.nickname!=='string'||!body.nickname.trim())fail('请填写 6 位房间码和昵称。');
   const row=this.one('SELECT id,state FROM rooms WHERE code=?',body.code.toUpperCase());if(!row)fail('房间不可用，请核对房间码。','ROOM_UNAVAILABLE');
   const m=this.one('SELECT status FROM members WHERE room_id=? AND user_id=?',row.id,actor);
   if(m)return this.view(row.id,actor);
   if(JSON.parse(row.state).locked)fail('房间已锁定，请说书人先开放加入。','ROOM_LOCKED');
   if(this.one("SELECT count(*) AS n FROM members WHERE room_id=? AND status='pending'",row.id).n>=40||this.one("SELECT count(*) AS n FROM members WHERE user_id=? AND status='pending'",actor).n>=5)fail('待处理申请过多，请先联系说书人。','JOIN_LIMIT');
   this.write('INSERT INTO members VALUES(?,?,?,?,?,?,?)',row.id,actor,body.nickname.trim().slice(0,40),'player','pending',null,new Date().toISOString());return this.view(row.id,actor);
  }
  const room=uuid(body.roomId),m=this.member(room,actor);
  if(body.action==='get')return this.view(room,actor);
  if(m.status!=='active')fail('说书人尚未批准加入。','FORBIDDEN');
  if(body.action==='notes'){
   if(body.operation==='get')return {body:this.one('SELECT body FROM notes WHERE room_id=? AND user_id=?',room,actor)?.body??''};
   if(body.operation==='save'){if(typeof body.body!=='string'||body.body.length>50000)fail('笔记内容过长或格式无效。');this.write('INSERT OR REPLACE INTO notes VALUES(?,?,?)',room,actor,body.body);return {body:body.body};}
   fail('未知笔记操作。');
  }
  if(body.action==='member'){
   if(m.role!=='host'||body.target===actor)fail('没有成员管理权限。','FORBIDDEN');
   const target=uuid(body.target),t=this.one('SELECT * FROM members WHERE room_id=? AND user_id=?',room,target);if(!t||t.role!=='player')fail('找不到此玩家。');
   if(body.memberAction==='revoke')this.write("UPDATE members SET status='revoked',seat_id=NULL WHERE room_id=? AND user_id=?",room,target);
   else if(body.memberAction==='approve'){
    const seat=uuid(body.seatId);if(!this.game(room).seats.some(s=>s.id===seat&&!s.left))fail('请选择有效座位。');
    const occupant=this.one("SELECT user_id FROM members WHERE room_id=? AND seat_id=? AND status='active' AND user_id!=?",room,seat,target);
    if(occupant&&!body.rebind)fail('该座位仍绑定玩家，请确认替换原玩家。','OCCUPIED_SEAT');
    if(occupant)this.write("UPDATE members SET status='revoked',seat_id=NULL WHERE room_id=? AND user_id=?",room,occupant.user_id);
    this.write("UPDATE members SET status='active',seat_id=? WHERE room_id=? AND user_id=?",seat,room,target);
   }else fail('未知成员操作。');return this.view(room,actor);
  }
  if(body.action==='command'){
   const op=uuid(body.opId),done=this.one('SELECT actor_id FROM commands WHERE room_id=? AND op_id=?',room,op);
   if(done){if(done.actor_id!==actor)fail('操作标识已使用。','FORBIDDEN');return this.view(room,actor);}
   if(!body.command||typeof body.command.type!=='string')fail('缺少有效操作。');
   const g=this.game(room);if(m.role==='host'&&body.expectedVersion!==g.version)fail('局面已经更新，请确认最新状态后再操作。','VERSION_CONFLICT');
   const next=applyCommand(g,body.command,m.role==='host'?{kind:'host'}:{kind:'player',seatId:m.seat_id});
   if(this.all("SELECT seat_id FROM members WHERE room_id=? AND status='active' AND seat_id IS NOT NULL",room).some(x=>!next.seats.some(s=>s.id===x.seat_id)))fail('该座位仍绑定玩家，请先移除绑定。','OCCUPIED_SEAT');
   this.write('UPDATE rooms SET state=? WHERE id=?',JSON.stringify(next),room);this.write('INSERT INTO commands VALUES(?,?,?)',room,op,actor);return this.view(room,actor);
  }
  fail('未知请求。');
 }
}
