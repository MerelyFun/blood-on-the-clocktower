import type { PublicGame, Script } from '../../supabase/functions/_shared/types.ts';
import { uid } from '../../supabase/functions/_shared/scripts.ts';

export type NotePhase = 'day' | 'night';
export interface NotePlayer { id:string; seatId?:string; index:number; name:string; noteName?:string; traveller:boolean; left?:boolean; joinedDay?:number; }
export interface NoteEntry { id:string; day:number; phase:NotePhase; kind:'player'|'public'|'free'; playerId?:string; text:string; important:boolean; createdAt:string; sourceId?:string; }
export interface NoteStatus { alive:boolean; executed:boolean; voteAvailable:boolean; }
export interface RoleMark { id:string; playerId:string; day:number; phase:NotePhase; kind:'claim'|'guess'|'primary'|'extra'; roles:string[]; createdAt:string; status?:Partial<NoteStatus>; }
export interface SeatState { id:string; playerId:string; day:number; phase:NotePhase; alive:boolean; voteAvailable:boolean; left:boolean; createdAt:string; index?:number; name?:string; }
export interface Notebook {
 schemaVersion:1; tableRotation?:number; id:string; title:string; createdAt:string; updatedAt:string; archived:boolean;
 room?:{id:string;mode:'local'|'cloud';ownerId:string}; script?:Script; currentDay:number; phase:NotePhase; myPlayerId?:string;
 players:NotePlayer[]; entries:NoteEntry[]; marks:RoleMark[]; states:SeatState[]; legacyText?:string; privateOwnerId?:string;
}
export function createNotebook(title:string,count=7,script?:Script):Notebook {
 const now=new Date().toISOString();
 const players=Array.from({length:Math.max(5,Math.min(20,Math.trunc(count)||7))},(_,index)=>({id:uid(),index:index+1,name:'玩家',traveller:false,joinedDay:1}));
 return {schemaVersion:1,id:uid(),title:title.trim()||'我的笔记',createdAt:now,updatedAt:now,archived:false,script,currentDay:1,phase:'night',players,entries:[],marks:[],states:players.map(p=>({id:uid(),playerId:p.id,day:1,phase:'night',alive:true,voteAvailable:true,left:false,createdAt:now,index:p.index,name:p.name}))};
}
function latest<T extends {day:number;createdAt:string}>(items:T[],day:number):T|undefined {
 return items.filter(x=>x.day<=day).reduce<T|undefined>((last,item)=>!last||item.day>last.day||(item.day===last.day&&item.createdAt>=last.createdAt)?item:last,undefined);
}
export function markAt(book:Notebook,playerId:string,kind:RoleMark['kind'],day:number){return latest(book.marks.filter(x=>x.playerId===playerId&&x.kind===kind),day);}
/** Read new annotations without rewriting or discarding the older claim/guess history. */
export function playerAnnotations(book:Notebook,playerId:string,day:number):{primary?:string;extras:string[]} {
 const main=markAt(book,playerId,'primary',day),extra=markAt(book,playerId,'extra',day);
 const claim=markAt(book,playerId,'claim',day),guess=markAt(book,playerId,'guess',day);
 const primary=main?main.roles[0]:(claim?claim.roles[0]:guess?.roles[0]);
 const extras=extra?extra.roles:[...(claim?.roles.slice(1)??[]),...(guess?.roles??[])];
 return {primary,extras:[...new Set(extras)].filter(role=>role!==primary)};
}
export function stateAt(book:Notebook,playerId:string,day:number){return latest(book.states.filter(x=>x.playerId===playerId),day);}
export function noteStatus(book:Notebook,playerId:string,day:number):NoteStatus {
 const mark=markAt(book,playerId,'extra',day),state=stateAt(book,playerId,day);
 return {alive:!(mark?.roles.includes('死亡')||state?.alive===false),executed:mark?.roles.includes('处决')??false,voteAvailable:!(mark?.roles.includes('死者票已用')||state?.voteAvailable===false),...mark?.status};
}
export function noteTags(book:Notebook,playerId:string,day:number):string[] {
 const status=noteStatus(book,playerId,day);
 return [...new Set([...playerAnnotations(book,playerId,day).extras.filter(v=>!['死亡','处决','死者票已用'].includes(v)),...(!status.alive?['死亡']:[]),...(status.executed?['处决']:[]),...(!status.voteAvailable?['死者票已用']:[])])];
}
export function setNoteTags(book:Notebook,playerId:string,day:number,values:string[]):Notebook {
 const previous=noteStatus(book,playerId,day),requested={alive:!values.includes('死亡'),executed:values.includes('处决'),voteAvailable:!values.includes('死者票已用')};
 const status={...markAt(book,playerId,'extra',day)?.status};
 for(const key of ['alive','executed','voteAvailable'] as const)if(previous[key]!==requested[key])status[key]=requested[key];
 return {...book,marks:[...book.marks,{id:uid(),playerId,day,phase:book.phase,kind:'extra',roles:[...new Set(values)].filter(v=>!['死亡','处决','死者票已用'].includes(v)),status,createdAt:new Date().toISOString()}]};
}
/** Consume only the public room projection. Never infer old seat state from today's snapshot. */
export function syncPublicRoom(book:Notebook,room:PublicGame,mySeatId?:string):Notebook {
 const next=structuredClone(book),day=Math.max(1,room.round),phase:NotePhase=room.phase==='night'?'night':'day',now=new Date().toISOString();
 next.currentDay=Math.max(book.currentDay,day);next.phase=phase;next.script=structuredClone(room.script);
 const activeIds=new Set<string>();
 for(const seat of room.seats){
  const id=(seat as typeof seat&{occupantId?:string}).occupantId||seat.id;activeIds.add(id);
  const existing=next.players.find(p=>p.id===id);
  const joinedDay=existing?.joinedDay??next.states.filter(s=>s.playerId===id).reduce((min,s)=>Math.min(min,s.day),day);
  const player:NotePlayer={id,seatId:seat.id,index:seat.index,name:seat.name,traveller:seat.traveller,left:seat.left,joinedDay};
  if(existing)Object.assign(existing,player);else next.players.push(player);
  if(seat.id===mySeatId)next.myPlayerId=id;
  const previous=stateAt(next,id,day);
  if(!previous||previous.alive!==seat.alive||previous.voteAvailable!==seat.voteAvailable||previous.left!==seat.left||previous.index!==seat.index||previous.name!==seat.name)
   next.states.push({id:uid(),playerId:id,day,phase,alive:seat.alive,voteAvailable:seat.voteAvailable,left:seat.left,createdAt:now,index:seat.index,name:seat.name});
 }
 for(const player of next.players)if(player.id!=='notebook-storyteller'&&!activeIds.has(player.id)&&!player.left){player.left=true;next.states.push({id:uid(),playerId:player.id,day,phase,alive:stateAt(next,player.id,day)?.alive??true,voteAvailable:false,left:true,createdAt:now});}
 next.players.sort((a,b)=>a.index-b.index);
 const sources=new Set(next.entries.map(e=>e.sourceId).filter(Boolean));
 for(const event of room.events){
  if(event.visibility!=='public'||sources.has(event.id))continue;
  next.entries.push({id:uid(),day:Math.max(1,event.round),phase:event.phase==='night'?'night':'day',kind:'public',text:event.text,important:false,createdAt:event.at,sourceId:event.id});sources.add(event.id);
 }
 for(const nomination of room.nominations){
  const sourceId=`nomination:${nomination.id}`;
  const seatName=(id:string)=>{const seat=room.seats.find(s=>s.id===id);return seat?`${seat.index} 号 ${seat.name}`:'未知玩家';};
  const status={open:'等待统计',tallied:`${nomination.tally} 票（门槛 ${nomination.threshold}）`,executed:`${nomination.tally} 票，已${nomination.type==='exile'?'放逐':'处决'}`,cancelled:'已取消'}[nomination.status];
  const text=`${seatName(nomination.nominator)} ${nomination.type==='exile'?'发起放逐':'提名'} ${seatName(nomination.nominee)} · ${status}`;
  const existing=next.entries.find(e=>e.sourceId===sourceId);
  if(existing)existing.text=text;
  else next.entries.push({id:uid(),day:Math.max(1,nomination.round),phase:'day',kind:'public',text,important:false,createdAt:now,sourceId});
 }
 if(JSON.stringify({...next,updatedAt:book.updatedAt})!==JSON.stringify(book))next.updatedAt=now;
 return next;
}
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
const str=(v:unknown):v is string=>typeof v==='string';
const day=(v:unknown)=>Number.isInteger(v)&&Number(v)>0&&Number(v)<=365;
const phase=(v:unknown)=>v==='day'||v==='night';
const optionalString=(v:unknown)=>v===undefined||str(v);
export function validateNotebook(v:unknown):v is Notebook {
 if(!object(v)||v.schemaVersion!==1||!['id','title','createdAt','updatedAt'].every(k=>str(v[k]))||typeof v.archived!=='boolean'||!day(v.currentDay)||!phase(v.phase)||!optionalString(v.myPlayerId)||!optionalString(v.legacyText))return false;
 if(String(v.title).length>300||String(v.legacyText??'').length>500_000)return false;
 if(!optionalString(v.privateOwnerId))return false;
 if(v.tableRotation!==undefined&&(!Number.isInteger(v.tableRotation)||Number(v.tableRotation)<0||Number(v.tableRotation)>100))return false;
 if(v.room!==undefined&&(!object(v.room)||!str(v.room.id)||!str(v.room.ownerId)||!['local','cloud'].includes(String(v.room.mode))))return false;
 if(v.script!==undefined&&(!object(v.script)||!str(v.script.id)||!str(v.script.name)||!Array.isArray(v.script.roles)||!v.script.roles.every(r=>object(r)&&str(r.id)&&str(r.name)&&str(r.ability)&&['townsfolk','outsider','minion','demon','traveller','fabled','loric'].includes(String(r.team))&&Array.isArray(r.reminders))))return false;
 if(!Array.isArray(v.players)||v.players.length>100||!v.players.every(p=>object(p)&&str(p.id)&&str(p.name)&&optionalString(p.noteName)&&Number.isInteger(p.index)&&Number(p.index)>=0&&typeof p.traveller==='boolean'&&optionalString(p.seatId)&&(p.left===undefined||typeof p.left==='boolean')))return false;
 const ids=new Set(v.players.map(p=>p.id));if(ids.size!==v.players.length)return false;
 for(const list of [v.entries,v.marks,v.states]){
  if(!Array.isArray(list)||new Set(list.map(item=>object(item)?item.id:undefined)).size!==list.length)return false;
 }
 if(v.players.some(p=>(p.joinedDay!==undefined&&(!day(p.joinedDay)||Number(p.joinedDay)>Number(v.currentDay)))))return false;
 const base=(e:unknown):e is Record<string,unknown>=>object(e)&&str(e.id)&&day(e.day)&&Number(e.day)<=Number(v.currentDay)&&phase(e.phase)&&str(e.createdAt);
 return Array.isArray(v.entries)&&v.entries.length<=10000&&v.entries.every(e=>base(e)&&['player','public','free'].includes(String(e.kind))&&str(e.text)&&e.text.length<=100000&&typeof e.important==='boolean'&&optionalString(e.sourceId)&&optionalString(e.playerId)&&(e.kind!=='player'||ids.has(e.playerId)))
  &&Array.isArray(v.marks)&&v.marks.length<=10000&&v.marks.every(m=>base(m)&&ids.has(m.playerId)&&['claim','guess','primary','extra'].includes(String(m.kind))&&Array.isArray(m.roles)&&m.roles.length<=(m.kind==='primary'?1:100)&&m.roles.every(r=>str(r)&&r.length<=300)&&(m.status===undefined||(object(m.status)&&['alive','executed','voteAvailable'].every(k=>((m.status as Record<string,unknown>)[k]===undefined||typeof (m.status as Record<string,unknown>)[k]==='boolean')))))
  &&Array.isArray(v.states)&&v.states.length<=10000&&v.states.every(s=>base(s)&&ids.has(s.playerId)&&optionalString(s.name)&&(s.index===undefined||(Number.isInteger(s.index)&&Number(s.index)>0))&&['alive','voteAvailable','left'].every(k=>typeof s[k]==='boolean'));
}
export function importNotebook(value:unknown):Notebook {
 if(!validateNotebook(value))throw new Error('这不是有效的笔记文件。');
 const book=structuredClone(value);book.id=uid();delete book.room;delete book.privateOwnerId;book.archived=false;book.title=`${book.title}（导入）`;book.createdAt=book.updatedAt=new Date().toISOString();return book;
}
