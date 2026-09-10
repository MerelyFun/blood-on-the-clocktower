import { applyCommand, type Command, type Game, type Script, type Actor } from './domain';
const DB='clocktower-v1';
let opened:Promise<IDBDatabase>|undefined;
function database(){return opened??=new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('games',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('无法打开本机存储，请检查浏览器隐私设置。'));});}
type Stored={id:string;game:Game;operations:string[]};
export async function saveLocal(game:Game) {const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put({id:game.id,game,operations:[]});tx.oncomplete=()=>{const channel=new BroadcastChannel(DB);channel.postMessage(game.id);channel.close();resolve();};tx.onerror=()=>reject(new Error('保存失败，可能是设备存储空间不足。'));});}
export async function getLocal(id:string):Promise<Game> {const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('games').objectStore('games').get(id);req.onsuccess=()=>req.result?resolve(req.result.game):reject(new Error('这台设备没有该本机对局。'));req.onerror=()=>reject(req.error);});}
export async function listLocal():Promise<Game[]> {const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('games').objectStore('games').getAll();req.onsuccess=()=>resolve((req.result as Stored[]).map(x=>x.game).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));req.onerror=()=>reject(req.error);});}
export async function removeLocal(id:string){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export async function mutateLocal(id:string,cmd:Command,expected:number,op:string,actor:Actor={kind:'host'}):Promise<Game> {
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite');const store=tx.objectStore('games');let result:Game;let failure:Error|undefined;
 const request=store.get(id);request.onsuccess=()=>{try{const old=request.result as Stored;if(!old)throw new Error('对局已不存在。');if(old.operations.includes(op)){result=old.game;return;}if(old.game.version!==expected)throw new Error('局面已在其他标签页更新，请刷新后操作。');result=applyCommand(old.game,cmd,actor);store.put({id,game:result,operations:[...old.operations.slice(-199),op]});}catch(e){failure=e as Error;tx.abort();}};
 tx.oncomplete=()=>{const channel=new BroadcastChannel(DB);channel.postMessage(id);channel.close();resolve(result);};tx.onabort=()=>reject(failure??new Error('本机存档写入失败。'));tx.onerror=()=>reject(failure??new Error('本机存档写入失败。'));
 });
}
export function localSubscription(id:string,fn:()=>void){const channel=new BroadcastChannel(DB);channel.onmessage=e=>{if(e.data===id)fn();};return ()=>channel.close();}
export function loadScripts():Script[]{try{return JSON.parse(localStorage.getItem('bt-scripts')||'[]');}catch{return [];}}
export function persistScripts(scripts:Script[]){localStorage.setItem('bt-scripts',JSON.stringify(scripts));}
export function download(name:string,data:unknown,raw=false){const blob=new Blob([raw?String(data):JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function readFile(file:File,max=4_000_000){if(file.size>max)throw new Error(`文件不能超过 ${max/1_000_000} MB。`);return file.text();}
export function navigate(path:string){location.hash=path;}
export function phaseLabel(phase:string,round:number){return phase==='setup'?'准备开局':phase==='ended'?'对局结束':`第 ${round} ${phase==='night'?'夜':'天'}`;}
export function clock(at:string){return new Date(at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
