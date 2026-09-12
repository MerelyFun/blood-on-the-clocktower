import { uid } from '../../supabase/functions/_shared/scripts.ts';
import { importNotebook, validateNotebook, type Notebook } from './notebooks.ts';

export type NotebookTransport=(operation:string,extra:Record<string,unknown>)=>Promise<unknown>;
export interface NotebookContext {ownerId?:string;mode?:'local'|'cloud';transport?:NotebookTransport;}
export interface NotebookDraft {data:Notebook;revision:number;dirty:boolean;token:string;}
interface RemoteNotebook {id:string;roomId:string|null;data:Notebook;revision:number;updatedAt:string;}
const prefix='bt-notebooks-v1:';
const pending=new Map<string,Set<Promise<NotebookDraft>>>(),deleting=new Set<string>();
function namespace(ctx?:NotebookContext){return ctx?.ownerId?`owner:${ctx.mode??'cloud'}:${ctx.ownerId}`:'device';}
function key(id:string,ctx?:NotebookContext){return `${prefix}${namespace(ctx)}:${id}`;}
function parse(raw:string|null):NotebookDraft|undefined {try{const v=JSON.parse(raw||'null');return v&&validateNotebook(v.data)&&typeof v.token==='string'&&typeof v.revision==='number'&&typeof v.dirty==='boolean'?v:undefined;}catch{return undefined;}}
function dataContext(data:Notebook,ctx?:NotebookContext):NotebookContext|undefined{return data.privateOwnerId?{...ctx,mode:'cloud'}:data.room?.mode==='cloud'?ctx:undefined;}
function visible(data:Notebook,ctx?:NotebookContext){return !data.privateOwnerId||data.privateOwnerId===ctx?.ownerId;}
export function readDraft(id:string,ctx?:NotebookContext):NotebookDraft|undefined {
 const keys=[key(id,ctx),...(ctx?.ownerId?[key(id,{...ctx,mode:'cloud'}),key(id)]:[])];
 for(const k of keys){const draft=parse(localStorage.getItem(k));if(draft&&visible(draft.data,ctx))return draft;}return undefined;
}
function preserve(data:Notebook,label='冲突副本') {
 const copy=importNotebook(data);copy.title=`${data.title}（${label}）`;copy.privateOwnerId=data.room?.ownerId??data.privateOwnerId;
 const draft:NotebookDraft={data:copy,revision:0,dirty:false,token:uid()};
 localStorage.setItem(key(copy.id,copy.privateOwnerId?{ownerId:copy.privateOwnerId,mode:'cloud'}:undefined),JSON.stringify(draft));return copy;
}
export class NotebookConflictError extends Error {constructor(public current:NotebookDraft|undefined,public preserved:Notebook){super('笔记已在其他位置更新，你的内容已保留为独立冲突副本。');}}
/** Synchronous durability before any debounce/network operation. Expected token protects stale tabs. */
export function writeDraft(data:Notebook,ctx?:NotebookContext,expectedToken?:string):NotebookDraft {
 if(!validateNotebook(data))throw new Error('笔记内容格式无效，未覆盖原稿。');
 if(data.room?.mode==='cloud'&&data.room.ownerId!==ctx?.ownerId)throw new Error('请使用此笔记所属账号。');
 if(!visible(data,ctx))throw new Error('请使用此笔记所属账号。');
 const context=dataContext(data,ctx),current=readDraft(data.id,context);
 if(deleting.has(key(data.id,context)))throw new Error('笔记正在删除，请稍后再试。');
 if(expectedToken!==undefined&&current?.token!==expectedToken)throw new NotebookConflictError(current,preserve(data));
 const draft:NotebookDraft={data:structuredClone(data),revision:current?.revision??0,dirty:data.room?.mode==='cloud',token:uid()};
 localStorage.setItem(key(data.id,context),JSON.stringify(draft));return draft;
}
async function remote<T>(operation:string,ctx:NotebookContext,extra:Record<string,unknown>={}):Promise<T>{
 if(!ctx.ownerId)throw new Error('请先登录以同步房间笔记。');
 if(ctx.transport)return await ctx.transport(operation,extra) as T;
 const {localApi,localBackendEnabled}=await import('./localBackend');
 if(localBackendEnabled)return localApi<T>({action:'notebooks',operation,...extra});
 const {supabase}=await import('./supabase');const sb=supabase();if(!sb)throw new Error('未配置同步服务。');
 const {data,error}=await sb.rpc('notebook_operation',{p_operation:operation,...(extra.id?{p_id:extra.id}:{}),...(extra.roomId?{p_room_id:extra.roomId}:{}),...(extra.data?{p_data:extra.data}:{}),...(extra.expectedRevision!==undefined?{p_expected_revision:extra.expectedRevision}:{})});
 if(error){const failure=new Error(error.message) as Error&{code:string};failure.code=error.message.includes('VERSION_CONFLICT')?'VERSION_CONFLICT':error.code;throw failure;}return data as T;
}
function cacheRemote(row:RemoteNotebook,ctx:NotebookContext):NotebookDraft|undefined {
 if(!validateNotebook(row.data)||row.data.room?.ownerId!==ctx.ownerId)return undefined;
 const current=readDraft(row.id,ctx);if(current?.dirty)return current;
 if(current&&current.revision>=row.revision)return current;
 const draft:NotebookDraft={data:row.data,revision:row.revision,dirty:false,token:uid()};localStorage.setItem(key(row.id,ctx),JSON.stringify(draft));return draft;
}
export async function listNotebooks(ctx?:NotebookContext,options:{strictRemote?:boolean}={}):Promise<Notebook[]> {
 if(ctx?.ownerId&&ctx.mode!=='local'){try{const response=await remote<{notebooks:RemoteNotebook[]}>('list',ctx);for(const row of response.notebooks)cacheRemote(row,ctx);}catch(error){if(options.strictRemote)throw error;/* Cached notebooks stay usable offline. */}}
 const scopes=[`${prefix}device:`,...(ctx?.ownerId?[`${prefix}${namespace(ctx)}:`,`${prefix}${namespace({...ctx,mode:'cloud'})}:`]:[])];const result:Notebook[]=[];
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!scopes.some(s=>k.startsWith(s)))continue;const draft=parse(localStorage.getItem(k));if(draft&&visible(draft.data,ctx))result.push(draft.data);}
 return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadNotebook(id:string,ctx?:NotebookContext):Promise<NotebookDraft|undefined> {
 const current=readDraft(id,ctx);if(current&&current.data.room?.mode!=='cloud')return current;
 if(ctx?.ownerId&&ctx.mode!=='local'){try{const result=await remote<{notebook:RemoteNotebook|null}>('get',ctx,{id});if(result.notebook)return cacheRemote(result.notebook,ctx)??current;}catch(error){if(!current)throw error;}}
 return current;
}
export function saveNotebook(data:Notebook,ctx?:NotebookContext,expectedToken?:string):Promise<NotebookDraft> {
 const storageKey=key(data.id,dataContext(data,ctx));
 if(deleting.has(storageKey))return Promise.reject(new Error('笔记正在删除，请稍后再试。'));
 const operation=saveImpl(data,ctx,expectedToken),requests=pending.get(storageKey)??new Set<Promise<NotebookDraft>>();
 requests.add(operation);pending.set(storageKey,requests);
 void operation.finally(()=>{requests.delete(operation);if(!requests.size)pending.delete(storageKey);}).catch(()=>{});
 return operation;
}
async function saveImpl(data:Notebook,ctx?:NotebookContext,expectedToken?:string):Promise<NotebookDraft> {
 if(!visible(data,ctx)||(data.room?.mode==='cloud'&&data.room.ownerId!==ctx?.ownerId))throw new Error('请使用此笔记所属账号。');
 const context=dataContext(data,ctx);
 let draft=readDraft(data.id,context);
 if(expectedToken!==undefined&&draft?.token!==expectedToken)throw new NotebookConflictError(draft,preserve(data));
 if(!draft||JSON.stringify(draft.data)!==JSON.stringify(data))draft=writeDraft(data,ctx,expectedToken);
 if(data.room?.mode!=='cloud')return draft;
 if(!ctx?.ownerId||data.room.ownerId!==ctx.ownerId)throw new Error('请使用此笔记所属账号。');
 const submitted=draft;
 try{
  const result=await remote<{notebook:RemoteNotebook}>('save',ctx,{id:data.id,roomId:data.room.id,data:submitted.data,expectedRevision:submitted.revision});
  const latest=readDraft(data.id,ctx);
  // Acknowledging an older request updates its base revision, never its newer local text.
  if(latest){if(result.notebook.revision<latest.revision)return latest;const acknowledged={...latest,revision:result.notebook.revision,dirty:latest.token!==submitted.token};localStorage.setItem(key(data.id,ctx),JSON.stringify(acknowledged));return acknowledged;}
  return submitted;
 }catch(error){
  if((error as {code?:string}).code==='VERSION_CONFLICT'||String(error).includes('VERSION_CONFLICT')){
   const latest=readDraft(data.id,ctx)??submitted,copy=preserve(latest.data);
   const result=await remote<{notebook:RemoteNotebook|null}>('get',ctx,{id:data.id});
   if(!result.notebook){
    const list=await remote<{notebooks:RemoteNotebook[]}>('list',ctx);
    result.notebook=list.notebooks.find(row=>row.roomId===data.room?.id&&row.data.room?.ownerId===ctx.ownerId)??null;
   }
   const meanwhile=readDraft(data.id,ctx);if(meanwhile&&meanwhile.token!==latest.token)preserve(meanwhile.data);
   if(result.notebook){
    if(!validateNotebook(result.notebook.data))throw new Error('服务返回的笔记格式无效，已保留本机副本。');
    const winner:NotebookDraft={data:result.notebook.data,revision:result.notebook.revision,dirty:false,token:uid()};
    localStorage.setItem(key(winner.data.id,ctx),JSON.stringify(winner));
    if(winner.data.id!==data.id)localStorage.removeItem(key(data.id,ctx));
    throw new NotebookConflictError(winner,copy);
   }
   throw new NotebookConflictError(latest,copy);
  }
  throw error;
 }
}
export async function deleteNotebook(id:string,ctx?:NotebookContext):Promise<void>{
 const initial=readDraft(id,ctx),storageKey=key(id,initial?dataContext(initial.data,ctx):undefined);deleting.add(storageKey);
 try{
  await Promise.allSettled([...(pending.get(storageKey)??[])]);
  const draft=readDraft(id,ctx);
  if(draft?.data.room?.mode==='cloud'){if(!ctx?.ownerId)throw new Error('请先登录。');await remote('delete',ctx,{id,expectedRevision:draft.revision});}
  localStorage.removeItem(storageKey);
 }finally{deleting.delete(storageKey);}
}
