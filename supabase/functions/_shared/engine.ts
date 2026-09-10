import { validateArchive } from './archive.ts';
export { createBackup, MAX_ARCHIVE_BYTES, MAX_BACKUP_BYTES } from './archive.ts';
import { baseCounts, defaultAlignment, findRole, FIRST_NIGHT } from './catalog.ts';
import { uid } from './scripts.ts';
import type { Actor, Alignment, Command, Game, GameEvent, GrimCard, NightTask, Nomination, PersonalView, PublicGame, Role, Script, Seat } from './types.ts';
const now = () => new Date().toISOString();
export class GameError extends Error {constructor(message:string,public code='INVALID_COMMAND'){super(message);}}
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw new GameError(message);}
function str(v:unknown,max=2000):string {return typeof v==='string'?v.slice(0,max):'';}
function num(v:unknown,min=0,max=10000):number {assert(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'数值不在允许范围内。');return v;}
function ids(v:unknown):string[] {assert(Array.isArray(v)&&v.length<=100&&v.every(x=>typeof x==='string'),'请选择有效的目标。');return [...new Set(v as string[])];}
function seat(g:Game,id:unknown):Seat {const s=g.seats.find(x=>x.id===id);assert(s,'找不到该座位。');return s;}
export function shuffle<T>(items:T[]):T[] {
 const a=[...items];for(let i=a.length-1;i>0;i--){const range=i+1,limit=Math.floor(4294967296/range)*range;let n=0;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);const j=n%range;[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function roomCode() {return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[n%30]).join('');}
export function newSeat(index:number):Seat {return {id:uid(),index,name:`玩家 ${index}`,traveller:false,left:false,roleId:'',shownRoleId:'',alignment:'good',shownAlignment:'good',alive:true,publicAlive:true,voteAvailable:true,cardVersion:0,acknowledged:0};}
export function createGame(script:Script,count=7,title=script.name):Game {
 assert(count>=5&&count<=15,'普通玩家人数应为 5–15 人。');
 return {schemaVersion:1,id:uid(),code:roomCode(),title:str(title,100),script:structuredClone(script),createdAt:now(),updatedAt:now(),version:0,phase:'setup',round:0,paused:false,locked:false,seats:Array.from({length:count},(_,i)=>newSeat(i+1)),bluffs:[],fabled:[],reminders:[],nightTasks:[],messages:[],notes:{},nominations:[],events:[],timer:{endsAt:null,remaining:0},winner:'',review:null,snapshots:[]};
}
function log(g:Game,text:string,visibility:GameEvent['visibility']='host') {g.events.push({id:uid(),at:now(),round:g.round,phase:g.phase,text,visibility});}
export function activeSeats(g:Pick<Game,'seats'>) {return g.seats.filter(s=>!s.left);}
export function makeNightTasks(g:Game):NightTask[] {
 const first=g.round===1;const tasks:NightTask[]=activeSeats(g).flatMap(s=>{
  const actual=findRole(g.script,s.roleId),shown=findRole(g.script,s.shownRoleId||s.roleId);
  const r=actual&& !['drunk','marionette'].includes(actual.id)?actual:shown;const order=first?r?.firstNight:r?.otherNight;
  if(!r||!order)return [];
  return [{id:uid(),seatId:s.id,label:r.name,order,done:false,note:'',targets:[]}];
 });
 for(const id of g.fabled??[]){const r=findRole(g.script,id);const order=first?r?.firstNight:r?.otherNight;if(r&&order)tasks.push({id:uid(),seatId:'',label:r.name,order,done:false,note:r.ability,targets:[]});}
 if(first){const count=activeSeats(g).filter(s=>!s.traveller).length;
  if(count>=7){tasks.push({id:uid(),seatId:'',label:'爪牙互认与恶魔信息',order:FIRST_NIGHT.indexOf('minioninfo')+1,done:false,note:'逐一确认可获知信息的玩家；发送前检查角色影响。',targets:[]},{id:uid(),seatId:'',label:'恶魔互认与三个伪装',order:FIRST_NIGHT.indexOf('demoninfo')+1,done:false,note:`伪装：${g.bluffs.map(id=>findRole(g.script,id)?.name??id).join('、')||'待设置'}。请分别发送，勿自动群发。`,targets:[]});}
  else tasks.unshift({id:uid(),seatId:'',label:'5–6 人局开局检查',order:1,done:false,note:'通常不提供爪牙 / 恶魔互认和三个伪装信息；按具体规则裁定。',targets:[]});
 }
 return tasks.sort((a,b)=>a.order-b.order);
}
export function setupIssues(g:Game):string[] {
 const ss=activeSeats(g),normal=ss.filter(s=>!s.traveller);const issues:string[]=[];
 if(normal.length<5||normal.length>15||ss.length>20)issues.push('普通玩家须为 5–15 人，总座位不超过 20。');
 for(const s of ss){const r=findRole(g.script,s.roleId),shown=findRole(g.script,s.shownRoleId||s.roleId);
  if(r&&!g.script.roles.some(x=>x.id===r.id))issues.push(`${s.index} 号真实角色不在当前剧本池中。`);
  if(shown&&!g.script.roles.some(x=>x.id===shown.id))issues.push(`${s.index} 号展示角色不在当前剧本池中。`);
  if(!r||r.unresolved)issues.push(`${s.index} 号尚未选择已补全的真实角色。`);
  if(!shown||shown.unresolved)issues.push(`${s.index} 号展示身份不完整。`);
  if(r&&['fabled','loric'].includes(r.team))issues.push(`${s.index} 号的角色不能占用玩家座位。`);
  if(r&&s.traveller!==(r.team==='traveller'))issues.push(`${s.index} 号的旅行者类型与角色不一致。`);
  if(r?.id==='drunk'&&shown?.team!=='townsfolk')issues.push(`${s.index} 号酒鬼需要另选镇民作为展示身份。`);
 }
 return issues;
}
export function executionCandidate(g:Pick<Game,'nominations'|'round'>) {
 const ns=g.nominations.filter(n=>n.type==='nomination'&&n.round===g.round&&n.status==='tallied'&&n.tally>=n.threshold);
 const high=Math.max(0,...ns.map(n=>n.tally));const best=ns.filter(n=>n.tally===high);return best.length===1?best[0]:null;
}
export function grimoire(g:Game,selected:string[],withMarkers=false):GrimCard[] {
 return g.seats.filter(s=>selected.includes(s.id)).map(s=>({name:s.name,index:s.index,role:findRole(g.script,s.roleId)?.name??'未分配',alignment:s.alignment,alive:s.alive,reminders:withMarkers?g.reminders.filter(m=>m.target===s.id).map(m=>m.label):[]}));
}
export function publicGame(g:Game):PublicGame {
 return {id:g.id,code:g.code,title:g.title,script:g.script,phase:g.phase,round:g.round,paused:g.paused,
 seats:g.seats.map(s=>({id:s.id,index:s.index,name:s.name,traveller:s.traveller,left:s.left,alive:s.publicAlive,voteAvailable:s.voteAvailable,...(s.traveller?{role:findRole(g.script,s.roleId)}:{})})),
 events:g.events.filter(e=>e.visibility==='public'),
 nominations:g.nominations.filter(n=>n.status!=='open'&&n.status!=='cancelled').map(({voters:_v,adjustment:_a,reason:_r,...n})=>n),timer:g.timer,winner:g.winner,review:g.review,fabled:(g.fabled??[]).map(id=>findRole(g.script,id)).filter((r):r is Role=>!!r)};
}
export function personalView(g:Game,seatId:string):PersonalView {
 const s=seat(g,seatId);return {seatId,cardVersion:s.cardVersion,acknowledged:s.acknowledged,role:s.cardVersion?findRole(g.script,s.shownRoleId)||null:null,alignment:s.cardVersion?s.shownAlignment:null,messages:g.messages.filter(m=>m.seatId===s.id)};
}
export function applyCommand(original:Game,command:Command,actor:Actor):Game {
 const g:Game=structuredClone(original);const p=command.payload??{};const type=command.type;
 const playerCommands=['ack_card','ack_message','respond'];
 if(actor.kind==='player')assert(playerCommands.includes(type),'该操作仅说书人可执行。');
 if(actor.kind==='host'&&playerCommands.includes(type))assert(false,'请由玩家本人确认或回复。');
 if(g.paused&&!['pause','note','snapshot','finish','announce','ack_card','ack_message','respond'].includes(type))throw new GameError('对局已暂停，请先继续。');
 if(actor.kind==='player') {
  const s=seat(g,actor.seatId);assert(!s.left,'该座位已离开对局。');
  if(type==='ack_card'){assert(s.cardVersion>0,'尚未发身份。');s.acknowledged=s.cardVersion;}
  else {const m=g.messages.find(m=>m.id===p.id&&m.seatId===s.id);assert(m,'无法访问该条信息。');
   if(type==='ack_message')m.seen=true;
   if(type==='respond'){assert(m.kind==='choice','这条信息不需要选择。');assert(m.response===null,'已提交选择，请联系说书人发送新的请求。');const response=ids(p.response);assert(response.length>=m.min&&response.length<=m.max&&response.every(x=>m.options.includes(x)),'请选择规定数量的有效选项。');m.response=response;m.seen=true;log(g,`${s.index} 号 ${s.name} 已回复：${response.join('、')}`);}
  }
 } else switch(type) {
  case 'title':g.title=str(p.title,100)||g.title;break;
  case 'script':assert(g.phase==='setup','开局后剧本已冻结；请创建新局。');assert(p.script&&typeof p.script==='object','缺少剧本。');g.script=structuredClone(p.script as Script);g.fabled=(g.fabled??[]).filter(id=>g.script.roles?.some(r=>r.id===id));assert(Array.isArray(g.script.roles)&&g.script.roles.length<=300,'无效剧本。');g.seats.forEach(s=>{if(!g.script.roles.some(r=>r.id===s.roleId)){s.roleId='';s.shownRoleId='';}else if(!g.script.roles.some(r=>r.id===s.shownRoleId)){s.shownRoleId=s.roleId;}});break;
  case 'resize':{assert(g.phase==='setup','只能在发牌前改变普通玩家人数。');const count=Math.trunc(num(p.count,5,15));const normals=g.seats.filter(s=>!s.traveller),travel=g.seats.filter(s=>s.traveller);assert(count+travel.length<=20,'总座位不能超过 20。');g.seats=[...normals.slice(0,count),...Array.from({length:Math.max(0,count-normals.length)},(_,i)=>newSeat(normals.length+i+1)),...travel].map((s,i)=>({...s,index:i+1}));break;}
  case 'add_traveller':{assert(g.phase!=='ended'&&g.seats.length<20,'无法添加更多旅行者。');const r=findRole(g.script,str(p.roleId));assert(r?.team==='traveller','请选择旅行者角色。');if(!g.script.roles.some(x=>x.id===r.id))g.script.roles.push(structuredClone(r));const s=newSeat(g.seats.length+1);Object.assign(s,{name:str(p.name,40)||s.name,traveller:true,roleId:r.id,shownRoleId:r.id,alignment:p.alignment==='evil'?'evil':'good',shownAlignment:p.alignment==='evil'?'evil':'good',cardVersion:g.phase==='setup'?0:1});g.seats.push(s);log(g,`${s.name} 以旅行者 ${r.name} 加入。`,'public');break;}
  case 'seat':{const s=seat(g,p.id);const patch=(p.patch??{}) as Record<string,unknown>;let identity=false;
   if(typeof patch.name==='string')s.name=str(patch.name,40)||s.name;
   for(const key of ['roleId','shownRoleId'] as const)if(typeof patch[key]==='string'){const r=findRole(g.script,patch[key] as string);assert(r&&!r.unresolved&&!['fabled','loric'].includes(r.team),'无效角色。');if(key==='roleId')assert(s.traveller===(r.team==='traveller'),'角色与旅行者座位不一致。');if(s[key]!==r.id){s[key]=r.id;if(key==='shownRoleId')identity=true;}}
   for(const key of ['alignment','shownAlignment'] as const)if(patch[key]==='good'||patch[key]==='evil'){if(s[key]!==patch[key]){s[key]=patch[key] as Alignment;if(key==='shownAlignment')identity=true;}}
   for(const key of ['alive','publicAlive','voteAvailable','left'] as const)if(typeof patch[key]==='boolean')s[key]=patch[key] as boolean;
   if(identity&&s.cardVersion>0)s.cardVersion++;
   log(g,`${s.index} 号 ${s.name} 资料已更正${str(p.reason,500)?`：${str(p.reason,500)}`:''}。`);break;}
  case 'swap_seats':{const a=seat(g,p.a),b=seat(g,p.b);[a.index,b.index]=[b.index,a.index];g.seats.sort((x,y)=>x.index-y.index);log(g,`${a.name} 与 ${b.name} 交换座位，身份仍跟随本人。`,'public');break;}
  case 'auto_setup':{assert(g.phase==='setup','已发牌，不能重新随机配置。');const ss=g.seats.filter(s=>!s.traveller),counts=Array.isArray(p.counts)?p.counts:baseCounts(ss.length);assert(counts.length===4&&counts.every(n=>Number.isInteger(n)&&n>=0)&&counts.reduce((a,b)=>Number(a)+Number(b),0)===ss.length,'四类角色数量之和必须等于普通玩家人数。');const teams=['townsfolk','outsider','minion','demon'];const roles:Role[]=[];
   teams.forEach((team,i)=>{const pool=g.script.roles.filter(r=>r.team===team&&!r.unresolved);assert(pool.length>=Number(counts[i]),`${team} 可用角色不足，请改用手动配置或增补剧本。`);roles.push(...shuffle(pool).slice(0,Number(counts[i])));});
   const drawn=shuffle(roles);ss.forEach((s,i)=>{const r=drawn[i];s.roleId=r.id;s.shownRoleId=r.id;s.alignment=defaultAlignment(r.team);s.shownAlignment=s.alignment;if(r.id==='drunk'){const tf=shuffle(g.script.roles.filter(x=>x.team==='townsfolk'&&!roles.some(y=>y.id===x.id)))[0];s.shownRoleId=tf?.id??'';}if(r.id==='lunatic'){s.shownRoleId=g.script.roles.find(x=>x.team==='demon')?.id??'';s.shownAlignment='evil';}});log(g,'生成了候选配置，尚未发身份。');break;}
  case 'fabled':g.fabled=ids(p.roles);assert(g.fabled.every(id=>['fabled','loric'].includes(findRole(g.script,id)?.team||'')),'请选择传奇或奇遇角色。');log(g,`本局附加规则：${g.fabled.map(id=>findRole(g.script,id)?.name).join('、')||'无'}。`,'public');break;
  case 'bluffs':g.bluffs=ids(p.roles);assert(g.bluffs.length<=3&&g.bluffs.every(id=>!!findRole(g.script,id)),'最多选择三个有效伪装。');log(g,'更新了恶魔伪装。');break;
  case 'deal':{assert(g.phase==='setup','已经发过身份，不会重复抽签。');assert(!setupIssues(g).length,setupIssues(g).join('\n'));if(p.shuffle){const ss=g.seats.filter(s=>!s.traveller);const bag=shuffle(ss.map(({roleId,shownRoleId,alignment,shownAlignment})=>({roleId,shownRoleId,alignment,shownAlignment})));ss.forEach((s,i)=>Object.assign(s,bag[i]));}g.seats.forEach(s=>{s.cardVersion=1;s.acknowledged=0;});g.phase='night';g.round=1;g.locked=true;g.nightTasks=makeNightTasks(g);log(g,'身份已发放，开始第 1 夜。','public');break;}
  case 'phase':{assert(g.phase!=='setup'&&g.phase!=='ended','当前不能切换日夜。');assert(p.phase==='day'||p.phase==='night','请选择白天或夜晚。');assert(p.phase!==g.phase||p.round!==undefined,'已处于该阶段。');assert(!g.nominations.some(n=>n.status==='open'),'仍有未结算提名，请先完成计票或取消提名。');const previous=structuredClone(g);const {snapshots:_old,...before}=previous;g.snapshots=[...g.snapshots,{id:uid(),at:now(),label:`第 ${g.round} ${g.phase==='night'?'夜':'天'} · 阶段结束`,state:before}].slice(-8);const next=p.phase;g.round=p.round!==undefined?Math.trunc(num(p.round,1,100)):g.round+(next==='night'?1:0);g.phase=next;g.reminders=g.reminders.filter(m=>m.duration!==(next==='day'?'dawn':'dusk'));if(next==='night')g.nightTasks=makeNightTasks(g);g.timer={endsAt:null,remaining:0};log(g,`进入第 ${g.round} ${next==='night'?'夜':'天'}${str(p.reason,300)?`（更正：${str(p.reason,300)}）`:''}。`,'public');break;}
  case 'pause':g.paused=!!p.paused;if(g.paused&&g.timer.endsAt){g.timer.remaining=Math.max(0,g.timer.endsAt-Date.now());g.timer.endsAt=null;}log(g,g.paused?'说书人暂停了对局。':'继续对局。','public');break;
  case 'lock':g.locked=!!p.locked;log(g,g.locked?'房间已锁定，新的加入申请将被拒绝。':'房间已开放加入。');break;
  case 'note':{const key=p.seatId?seat(g,p.seatId).id:'global';g.notes[key]=str(p.text,10000);break;}
  case 'marker_add':{const target=seat(g,p.target);if(p.source)seat(g,p.source);const label=str(p.label,80).trim();assert(label,'请输入标记名称。');assert(g.reminders.length<200,'标记过多，请先清理。');g.reminders.push({id:uid(),target:target.id,source:str(p.source,80),label,duration:p.duration==='dawn'||p.duration==='dusk'?p.duration:'manual'});log(g,`${target.index} 号添加标记：${label}。`);break;}
  case 'marker_remove':{const m=g.reminders.find(x=>x.id===p.id);assert(m,'标记已不存在。');g.reminders=g.reminders.filter(x=>x.id!==m.id);log(g,`移除标记：${m.label}。`);break;}
  case 'task_add':{if(p.seatId)seat(g,p.seatId);assert(g.nightTasks.length<100,'任务过多。');g.nightTasks.push({id:uid(),seatId:str(p.seatId,80),label:str(p.label,100)||'手动任务',order:num(p.order??500),done:false,note:str(p.note),targets:[]});break;}
  case 'task_update':{const t=g.nightTasks.find(t=>t.id===p.id);assert(t,'找不到任务。');if(typeof p.done==='boolean')t.done=p.done;if(typeof p.note==='string')t.note=str(p.note);if(p.order!==undefined)t.order=num(p.order);if(p.targets!==undefined){t.targets=ids(p.targets);t.targets.forEach(id=>seat(g,id));}break;}
  case 'message_send':{const s=seat(g,p.seatId);assert(g.phase!=='setup','请先发身份。');const kind=p.kind==='choice'?'choice':p.kind==='grimoire'?'grimoire':'info';const text=str(p.text);assert(text||kind==='grimoire','请输入发送内容。');const options=kind==='choice'?ids(p.options).map(x=>x.slice(0,160)):[];const min=kind==='choice'?num(p.min??1,0,20):0,max=kind==='choice'?num(p.max??1,1,20):0;assert(kind!=='choice'||(options.length>=max&&min<=max),'选项数量或选择上限不正确。');const snapshot=kind==='grimoire'?grimoire(g,ids(p.seats),!!p.withMarkers):undefined;g.messages.push({id:uid(),seatId:s.id,at:now(),round:g.round,kind,text,options,min,max,response:null,seen:false,...(snapshot?{snapshot}:{})});assert(g.messages.length<=500,'信息数量已达单局上限。');log(g,`向 ${s.index} 号 ${s.name} 发送${kind==='choice'?'选择请求':kind==='grimoire'?'经确认的魔典快照':'私密信息'}。`);break;}
  case 'publish_dawn':{for(const id of ids(p.seats)){const s=seat(g,id);if(s.publicAlive!==s.alive){s.publicAlive=s.alive;log(g,`${s.index} 号 ${s.name} ${s.publicAlive?'恢复存活':'死亡'}。`,'public');}}break;}
  case 'record':assert(str(p.text).trim(),'记录不能为空。');log(g,str(p.text));break;
  case 'announce':assert(str(p.text).trim(),'公告不能为空。');log(g,str(p.text),'public');break;
  case 'timer':{const seconds=num(p.seconds??0,0,7200);g.timer={remaining:seconds*1000,endsAt:p.running?Date.now()+seconds*1000:null};break;}
  case 'nominate':{assert(g.phase==='day','提名在白天进行。');assert(!g.nominations.some(n=>n.round===g.round&&n.status==='open'),'先处理当前尚未结算的提名。');const a=seat(g,p.nominator),b=seat(g,p.nominee);assert(!a.left&&!b.left,'离场玩家不能参与提名。');const exile=p.exile===true;assert(!exile||b.traveller,'只能放逐旅行者。');const previous=g.nominations.filter(n=>n.round===g.round&&n.type==='nomination'&&n.status!=='cancelled');
   if(!exile&&!p.override){assert(!b.traveller,'旅行者应使用放逐；角色能力例外请填写特殊裁定原因。');assert(a.publicAlive,'标准规则下，死者不能发起提名。');assert(!previous.some(n=>n.nominator===a.id),'该玩家今日已经提名。');assert(!previous.some(n=>n.nominee===b.id),'该玩家今日已经被提名。');}
   if(p.override)assert(str(p.reason).trim(),'特殊提名需要填写裁定原因。');
   const threshold=exile?Math.floor(activeSeats(g).length/2)+1:Math.ceil(activeSeats(g).filter(s=>s.publicAlive).length/2);
   g.nominations.push({id:uid(),round:g.round,type:exile?'exile':'nomination',nominator:a.id,nominee:b.id,voters:[],threshold,tally:0,adjustment:0,reason:str(p.reason),status:'open'});log(g,`${a.name} ${exile?'提出放逐':'提名'} ${b.name}。`,'public');break;}
  case 'cancel_nomination':{const n=g.nominations.find(n=>n.id===p.id);assert(n?.status==='open','只能取消未结算的提名。');n.status='cancelled';log(g,`本次提名取消：${str(p.reason)||'说书人更正'}。`,'public');break;}
  case 'tally':{const n=g.nominations.find(n=>n.id===p.id);assert(n?.status==='open','本次提名已结算。');assert(g.phase==='day'&&n.round===g.round,'只能为当前白天的提名计票；旧提名请取消。');const voters=ids(p.voters);const adjustment=Math.trunc(num(p.adjustment??0,-100,100));const threshold=p.threshold===undefined?n.threshold:Math.trunc(num(p.threshold,0,100));const special=adjustment!==0||threshold!==n.threshold||p.consumeGhostVotes===false;
   if(special)assert(str(p.reason).trim(),'特殊计票需要记录裁定原因。');
   for(const id of voters){const s=seat(g,id);assert(!s.left,'离场者不能投票。');if(n.type==='nomination'&&!s.publicAlive){assert(s.voteAvailable||p.consumeGhostVotes===false,'该死者已用过投票权。');if(p.consumeGhostVotes!==false)s.voteAvailable=false;}}
   n.voters=voters;n.adjustment=adjustment;n.threshold=threshold;n.tally=Math.max(0,voters.length+adjustment);n.reason=str(p.reason)||n.reason;n.status='tallied';log(g,`${seat(g,n.nominee).name} 的${n.type==='exile'?'放逐':'提名'}获得 ${n.tally} 票，门槛 ${threshold} 票。`,'public');break;}
  case 'execute':{const n=g.nominations.find(n=>n.id===p.id);assert(n?.status==='tallied','请选择已结算的提名。');assert(n.round===g.round&&g.phase==='day','只能结算当前白天的提名。');if(!p.override){assert(n.type!=='nomination'||!seat(g,n.nominee).traveller,'旅行者不能按常规处决；角色能力例外请填写特殊裁定原因。');assert(n.tally>=n.threshold,'票数未达到门槛。');if(n.type==='nomination'){assert(!g.nominations.some(x=>x.round===g.round&&x.type==='nomination'&&x.status==='executed'),'本日已有处决，额外处决需特殊裁定。');assert(executionCandidate(g)?.id===n.id,'该提名不是唯一最高票；平票不能按常规处决。');}}else assert(str(p.reason).trim(),'强制裁定需要填写原因。');const s=seat(g,n.nominee);n.status='executed';n.dies=!!p.dies;
   if(n.type==='exile'){s.left=true;log(g,`${s.name} 被放逐离场。`,'public');}
   else {if(p.dies){s.alive=false;s.publicAlive=false;}log(g,`${s.name} 被处决，${p.dies?'死亡':'未死亡'}${str(p.reason)?`（${str(p.reason)}）`:''}。`,'public');}break;}
  case 'snapshot':{const {snapshots:_snap,...state}=structuredClone(g);g.snapshots.push({id:uid(),at:now(),label:str(p.label,100)||`第 ${g.round} ${g.phase==='night'?'夜':'天'}`,state});g.snapshots=g.snapshots.slice(-8);log(g,'已保存完整局面快照。');break;}
  case 'finish':assert(g.phase!=='ended','对局已经结束。');g.winner=str(p.winner,100)||'未判定';g.phase='ended';g.paused=false;g.timer={endsAt:null,remaining:0};log(g,`游戏结束：${g.winner}。${str(p.reason)}`,'public');break;
  case 'review':assert(g.phase==='ended','结束后才可发布复盘。');g.review={at:now(),winner:g.winner,text:str(p.text,5000),seats:grimoire(g,ids(p.seats),false)};log(g,'说书人发布了经过选择的复盘内容。','public');break;
  default:throw new GameError('不支持的操作。');
 }
 g.version=original.version+1;g.updatedAt=now();return g;
}
export function restoreGame(input:unknown):Game {
 let g:Game;try{g=validateArchive(input);}catch(error){throw new GameError(error instanceof Error?error.message:'存档格式无效。','INVALID_ARCHIVE');}
 g.fabled=g.fabled??[];g.id=uid();g.code=roomCode();g.version=0;g.title=`${str(g.title,80)} · 恢复副本`;g.createdAt=now();g.updatedAt=now();g.snapshots=[];g.locked=false;g.seats.forEach(s=>s.acknowledged=0);log(g,'从完整存档创建新副本；原对局没有被覆盖。');return g;
}


