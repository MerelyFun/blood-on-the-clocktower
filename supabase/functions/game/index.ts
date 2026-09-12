import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { applyCommand, createGame, GameError, personalView, publicGame, restoreGame } from '../_shared/engine.ts';
import type { Command, Game, PublicGame, RoomView, Script } from '../_shared/types.ts';

const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x=>x.trim());
const errors:Record<string,string>={FORBIDDEN:'你已没有这个房间的权限。',REVOKED:'当前加入凭据已移除，请联系说书人。',VERSION_CONFLICT:'局面已经更新，请确认最新状态后再操作。',ROOM_LOCKED:'房间已锁定，请说书人先开放加入。',ROOM_UNAVAILABLE:'房间不可用，请核对房间码。',TOO_MANY_ATTEMPTS:'加入请求过于频繁，请稍后再试。',JOIN_LIMIT:'待处理申请过多，请先联系说书人。',OCCUPIED_SEAT:'该座位仍绑定玩家，请先在成员管理中移除其绑定。',ROOM_LIMIT:'已达到 30 个云端房间上限，请归档导出后由项目管理员清理旧房间。'};
function check<T>(result:{data:T;error:any}):T {if(result.error){const known=Object.keys(errors).find(k=>result.error.message?.includes(k));throw new GameError(known?errors[known]:'数据操作失败，请刷新后重试。',known||'DATABASE_ERROR');}return result.data;}
function required<T>(result:{data:T;error:any}):NonNullable<T> {const data=check(result);if(data===null||data===undefined)throw new GameError('房间数据暂时不可用，请刷新后重试。','DATABASE_ERROR');return data;}
function uuid(s:unknown):string {if(typeof s!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s))throw new GameError('无效的操作标识。');return s;}
const views=(g:Game)=>g.seats.map(s=>({seat_id:s.id,data:personalView(g,s.id)}));
async function membership(room:string,actor:string){const m=check(await db.from('bt_members').select('*').eq('room_id',room).eq('user_id',actor).maybeSingle());if(!m||m.status==='revoked')throw new GameError(errors.FORBIDDEN,'FORBIDDEN');return m;}
async function withOccupants(room:string,town:PublicGame):Promise<PublicGame>{
 const occupants=required(await db.from('bt_members').select('seat_id,user_id').eq('room_id',room).eq('status','active'));
 const opaque=async (userId:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${room}:${userId}`)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return {...town,seats:await Promise.all(town.seats.map(async seat=>{const occupant=occupants.find(x=>x.seat_id===seat.id);return {...seat,...(occupant?{occupantId:await opaque(occupant.user_id)}:{})};}))};
}
async function readView(room:string,actor:string):Promise<RoomView> {
 const m=await membership(room,actor);
 if(m.status==='pending'){const r=required(await db.from('bt_rooms').select('id,title').eq('id',room).single());return {kind:'pending',id:r.id,title:r.title,status:'pending'};}
 if(m.role==='host'){
  const game=required(await db.from('bt_games').select('state').eq('room_id',room).single());
  const members=required(await db.from('bt_members').select('user_id,nickname,role,status,seat_id').eq('room_id',room).order('created_at'));
  return {kind:'host',game:game.state as Game,publicRoom:await withOccupants(room,publicGame(game.state as Game)),members};
 }
 const [town,card]=await Promise.all([db.from('bt_public').select('data').eq('room_id',room).single(),db.from('bt_player_views').select('data').eq('room_id',room).eq('seat_id',m.seat_id).single()]);
 // Recheck membership after reads so a concurrent rebind cannot continue fetching stale private data.
 const current=await membership(room,actor);if(current.status!=='active'||current.seat_id!==m.seat_id)throw new GameError(errors.FORBIDDEN,'FORBIDDEN');
 const publicRoom=await withOccupants(room,required(town).data);
 const latest=await membership(room,actor);if(latest.status!=='active'||latest.seat_id!==m.seat_id)throw new GameError(errors.FORBIDDEN,'FORBIDDEN');
 return {kind:'player',room:publicRoom,personal:required(card).data};
}
async function readBody(req:Request) {const reader=req.body?.getReader();if(!reader)throw new GameError('缺少请求内容。');const chunks:Uint8Array[]=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4_000_000){await reader.cancel();throw new GameError('请求内容超过 4 MB。');}chunks.push(r.value);}const data=new Uint8Array(size);let pos=0;for(const chunk of chunks){data.set(chunk,pos);pos+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new GameError('请求格式错误。');}}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify({...data as Record<string,unknown>,serverTime:Date.now()}),{status,headers});
 if(origin&&!allowed.includes(origin))return reply({error:'此网站地址未获允许，请配置 ALLOWED_ORIGINS。',code:'ORIGIN'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'仅支持 POST。'},405);
 try{
  const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return reply({error:'请先登录或匿名加入。',code:'UNAUTHENTICATED'},401);
  const {data:{user},error}=await db.auth.getUser(auth.slice(7));
  if(error||!user)return reply({error:'登录已失效，请重新登录。',code:'UNAUTHENTICATED'},401);
  const body=await readBody(req);const actor=user.id;
  if(body.action==='notebooks'){
   // Forward the user JWT so the RPC derives ownership from auth.uid(), never service role.
   const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
   return reply(check(await client.rpc('notebook_operation',{p_operation:body.operation,p_id:body.id??null,p_room_id:body.roomId??null,p_data:body.data??null,p_expected_revision:body.expectedRevision??null})));
  }
  if(body.action==='list'){
   const rows=check(await db.from('bt_members').select('role,status,room_id,bt_rooms(id,title,code,created_at)').eq('user_id',actor).neq('status','revoked').order('created_at',{ascending:false}));
   return reply({rooms:rows});
  }
  if(body.action==='create'){
   if(user.is_anonymous)throw new GameError('创建联机房间前，请用邮箱或 GitHub 登录。');
   let g:Game;
   if(body.restore){g=restoreGame(body.restore);g.id=uuid(body.roomId);}
   else {const script=body.script as Script;if(!script||!Array.isArray(script.roles)||script.roles.length<1||script.roles.length>300||script.roles.some(r=>!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.ability!=='string'))throw new GameError('剧本格式无效。');g=createGame(script,Number(body.count)||7,body.title);g.id=uuid(body.roomId);}
   check(await db.rpc('bt_create_room',{p_room:g.id,p_code:g.code,p_actor:actor,p_state:g,p_public:publicGame(g),p_views:views(g)}));
   return reply(await readView(g.id,actor));
  }
  if(body.action==='join'){
   if(typeof body.code!=='string'||!/^[A-Z2-9]{6}$/i.test(body.code)||typeof body.nickname!=='string'||!body.nickname.trim())throw new GameError('请填写 6 位房间码和昵称。');
   const r=check(await db.rpc('bt_join_room',{p_code:body.code.toUpperCase(),p_actor:actor,p_nickname:body.nickname.trim().slice(0,40)}));
   if(r.error)throw new GameError(errors[r.error]||'无法申请加入。',r.error);
   return reply(await readView(r.room_id,actor));
  }
  const room=uuid(body.roomId);
  if(body.action==='get')return reply(await readView(room,actor));
  const member=await membership(room,actor);if(member.status!=='active')throw new GameError('说书人尚未批准加入。','FORBIDDEN');
  if(body.action==='member'){
   if(member.role!=='host')throw new GameError(errors.FORBIDDEN,'FORBIDDEN');
   check(await db.rpc('bt_member_action',{p_room:room,p_actor:actor,p_target:uuid(body.target),p_seat:body.seatId?uuid(body.seatId):null,p_action:body.memberAction,p_rebind:body.rebind===true}));
   return reply(await readView(room,actor));
  }
  if(body.action==='command'){
   const op=uuid(body.opId);const command=body.command as Command;if(!command||typeof command.type!=='string')throw new GameError('缺少有效操作。');
   const done=check(await db.from('bt_commands').select('op_id').eq('room_id',room).eq('op_id',op).eq('actor_id',actor).maybeSingle());
   if(done)return reply(await readView(room,actor));
   for(let attempt=0;attempt<3;attempt++){
    const row=required(await db.from('bt_games').select('state,version').eq('room_id',room).single());
    if(member.role==='host'&&Number(body.expectedVersion)!==row.version)throw new GameError(errors.VERSION_CONFLICT,'VERSION_CONFLICT');
    const next=applyCommand(row.state as Game,command,member.role==='host'?{kind:'host'}:{kind:'player',seatId:member.seat_id});
    const result=await db.rpc('bt_commit_room',{p_room:room,p_actor:actor,p_op:op,p_expected:row.version,p_seat:member.role==='host'?null:member.seat_id,p_state:next,p_public:publicGame(next),p_views:views(next)});
    if(result.error?.message?.includes('VERSION_CONFLICT')&&member.role==='player'&&attempt<2)continue;
    check(result);return reply(await readView(room,actor));
   }
  }
  throw new GameError('未知请求。');
 }catch(e){if(e instanceof GameError)return reply({error:e.message,code:e.code},e.code==='FORBIDDEN'?403:e.code==='VERSION_CONFLICT'?409:400);return reply({error:'服务暂时不可用，请稍后刷新。',code:'INTERNAL_ERROR'},500);}
});

