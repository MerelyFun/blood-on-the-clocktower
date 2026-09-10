export interface PendingCreate {
 schemaVersion:1;
 roomId:string;
 label:string;
 payload:Record<string,unknown>;
}
interface Store {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
const flights=new Map<string,Promise<unknown>>();
export function createRoomRequests(project:string,actor:string,storage:Store,send:(body:Record<string,unknown>)=>Promise<unknown>,makeId:()=>string){
 const key=`bt-pending-create-v1:${encodeURIComponent(project.replace(/\/+$/,''))}:${encodeURIComponent(actor)}`;
 function read():PendingCreate|null {
  const raw=storage.getItem(key);if(!raw)return null;
  try{const p=JSON.parse(raw);if(p.schemaVersion!==1||typeof p.roomId!=='string'||typeof p.label!=='string'||!p.payload||p.payload.action!=='create'||p.payload.roomId!==p.roomId)throw new Error();return p;}catch{throw new Error('待确认创建记录已损坏。请先在云端房间列表确认是否已创建，再清理此浏览器会话记录。');}
 }
 async function submit(p:PendingCreate){
  const running=flights.get(key);if(running)return running;
  const task=Promise.resolve().then(()=>send(p.payload)).then(result=>{storage.removeItem(key);return result;}).finally(()=>flights.delete(key));
  flights.set(key,task);return task;
 }
 return {
  read,
  async start(payload:Record<string,unknown>,label:string){
   if(read())throw new Error('已有待确认的创建请求。请重试原请求，或确认放弃后再创建其他房间。');
   const roomId=makeId();const p:PendingCreate=JSON.parse(JSON.stringify({schemaVersion:1,roomId,label,payload:{...payload,action:'create',roomId}}));
   // Persist before submitting: failed browser storage must never leave an untracked request.
   storage.setItem(key,JSON.stringify(p));return submit(p);
  },
  async retry(){const p=read();if(!p)throw new Error('没有待确认的创建请求。');return submit(p);},
  abandon(){if(flights.has(key))throw new Error('请求仍在提交，请等待结果后再放弃。');storage.removeItem(key);},
 };
}
