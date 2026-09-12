/** Development rooms live on the local server, independently of cloud settings. */
export const localBackendEnabled=import.meta.env.VITE_BACKEND==='local'||(import.meta.env.DEV&&import.meta.env.VITE_BACKEND!=='supabase');
export interface LocalUser {id:string;is_anonymous:false;email:null;}
export class LocalApiError extends Error {constructor(message:string,public code='NETWORK'){super(message);}}
const tokenKey='bt-local-session-token';
let session:Promise<LocalUser>|undefined;
async function request<T>(body:Record<string,unknown>,token:string|null):Promise<T>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch('/api/local',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>{throw new LocalApiError('本地数据库服务未就绪，请使用 npm run dev 启动完整预览。');});
  if(!response.ok||data.error)throw new LocalApiError(data.error||'本地数据库请求失败。',data.code||'INTERNAL_ERROR');
  return data as T;
 }catch(error){if(error instanceof LocalApiError)throw error;throw new LocalApiError('无法连接本地数据库。请确认电脑上的临时预览服务仍在运行。');}
 finally{clearTimeout(timeout);}
}
export function ensureLocalUser():Promise<LocalUser>{
 return session??=(async()=>{
  let token=localStorage.getItem(tokenKey);
  let result:{token:string;user:LocalUser};
  try{result=await request({action:'session'},token);}
  catch(error){if(!(error instanceof LocalApiError)||error.code!=='UNAUTHENTICATED'||!token)throw error;result=await request({action:'session'},null);}
  localStorage.setItem(tokenKey,result.token);
  return result.user;
 })().catch(error=>{session=undefined;throw error;});
}
export async function localApi<T>(body:Record<string,unknown>):Promise<T>{await ensureLocalUser();return request<T>(body,localStorage.getItem(tokenKey));}
export function backendProject(){return localBackendEnabled?`${location.origin}/api/local`:'';}
