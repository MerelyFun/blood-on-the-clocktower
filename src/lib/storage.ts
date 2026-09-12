import { applyCommand } from '../../supabase/functions/_shared/engine.ts';
import { TEAMS, type Command, type Game, type Script, type Actor } from '../../supabase/functions/_shared/types.ts';
const DB='clocktower-v1';
let opened:Promise<IDBDatabase>|undefined;
function database(){return opened??=new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('games',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('无法打开本机存储，请检查浏览器隐私设置。'));});}
type Stored={id:string;game:Game;operations:string[]};
function notifyLocal(id:string){try{const channel=new BroadcastChannel(DB);try{channel.postMessage(id);}finally{channel.close();}}catch{/* Subscribers poll when messaging is unsupported or blocked. */}}
export async function saveLocal(game:Game) {const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put({id:game.id,game,operations:[]});tx.oncomplete=()=>{notifyLocal(game.id);resolve();};tx.onerror=()=>reject(new Error('保存失败，可能是设备存储空间不足。'));});}
export async function getLocal(id:string):Promise<Game> {const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('games').objectStore('games').get(id);req.onsuccess=()=>req.result?resolve(req.result.game):reject(new Error('这台设备没有该本机对局。'));req.onerror=()=>reject(req.error);});}
export async function listLocal():Promise<Game[]> {const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('games').objectStore('games').getAll();req.onsuccess=()=>resolve((req.result as Stored[]).map(x=>x.game).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));req.onerror=()=>reject(req.error);});}
export async function removeLocal(id:string){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export async function mutateLocal(id:string,cmd:Command,expected:number,op:string,actor:Actor={kind:'host'}):Promise<Game> {
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite');const store=tx.objectStore('games');let result:Game;let failure:Error|undefined;
 const request=store.get(id);request.onsuccess=()=>{try{const old=request.result as Stored;if(!old)throw new Error('对局已不存在。');if(old.operations.includes(op)){result=old.game;return;}if(old.game.version!==expected)throw new Error('局面已在其他标签页更新，请刷新后操作。');result=applyCommand(old.game,cmd,actor);store.put({id,game:result,operations:[...old.operations.slice(-199),op]});}catch(e){failure=e as Error;tx.abort();}};
 tx.oncomplete=()=>{notifyLocal(id);resolve(result);};tx.onabort=()=>reject(failure??new Error('本机存档写入失败。'));tx.onerror=()=>reject(failure??new Error('本机存档写入失败。'));
 });
}
export function localSubscription(id:string,fn:()=>void){
 try{const channel=new BroadcastChannel(DB);channel.onmessage=e=>{if(e.data===id)fn();};return ()=>channel.close();}
 catch{const timer=setInterval(()=>{if(typeof document==='undefined'||document.visibilityState==='visible')fn();},2000);return ()=>clearInterval(timer);}
}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function storedScript(value:unknown):value is Script{
 if(!record(value))return false;
 return ['id','name','author','description','updatedAt'].every(key=>typeof value[key]==='string')&&typeof value.version==='number'&&Number.isFinite(value.version)&&record(value.meta)&&Array.isArray(value.extras)&&Array.isArray(value.roles)&&value.roles.every(role=>record(role)&&['id','name','ability'].every(key=>typeof role[key]==='string')&&TEAMS.includes(role.team as Script['roles'][number]['team'])&&['firstNight','otherNight'].every(key=>typeof role[key]==='number'&&Number.isFinite(role[key]))&&Array.isArray(role.reminders)&&role.reminders.every(item=>typeof item==='string')&&(role.raw===undefined||record(role.raw)));
}
export function loadScripts():Script[]{try{const saved:unknown=JSON.parse(localStorage.getItem('bt-scripts')||'[]');return Array.isArray(saved)?saved.filter(storedScript):[];}catch{return [];}}
export function persistScripts(scripts:Script[]){
 const original=localStorage.getItem('bt-scripts');
 if(original!==null){
  let damaged=false;
  try{const saved:unknown=JSON.parse(original);damaged=!Array.isArray(saved)||!saved.every(storedScript);}catch{damaged=true;}
  if(damaged){
   // Keep the entire original text, including malformed entries, before replacing it.
   const prefix=`bt-scripts-recovery-${Date.now()}`;let key=prefix,index=0;
   while(localStorage.getItem(key)!==null)key=`${prefix}-${++index}`;
   try{localStorage.setItem(key,original);}catch{throw new Error('原剧本记录需要恢复，但备份失败。已保留原记录，请先检查浏览器存储空间。');}
  }
 }
 localStorage.setItem('bt-scripts',JSON.stringify(scripts));
}
export function download(name:string,data:unknown,raw=false){const blob=new Blob([raw?String(data):JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function readFile(file:File,max=4_000_000){if(file.size>max)throw new Error(`文件不能超过 ${max/1_000_000} MB。`);return file.text();}
export function navigate(path:string){location.hash=path;}
export function phaseLabel(phase:string,round:number){return phase==='setup'?'准备开局':phase==='ended'?'对局结束':`第 ${round} ${phase==='night'?'夜':'天'}`;}
export function clock(at:string){return new Date(at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
