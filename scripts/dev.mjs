// One local preview command: SQLite API plus the phone-accessible Vite frontend.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
const cwd=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const env={...loadEnv('development',cwd,''),...process.env};
const children=[];
let closing=false;
function stop(code=0){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
function start(args){const child=spawn(process.execPath,args,{cwd,env,stdio:'inherit',windowsHide:true});children.push(child);child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>{if(!closing)stop(code||0);});return child;}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
if(env.VITE_BACKEND!=='supabase'){
 const backend=start(['--experimental-sqlite','--experimental-transform-types','scripts/local-server.mjs']);
 // Wait for the API socket before announcing a frontend that cannot create rooms yet.
 const {connect}=await import('node:net');
 for(let attempt=0;attempt<100&&!closing;attempt++){
  const ready=await new Promise(resolve=>{const socket=connect(Number(env.CLOCKTOWER_API_PORT||5175),'127.0.0.1');socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});
  if(ready)break;
  if(backend.exitCode!==null){stop(1);break;}
  if(attempt===99){console.error('本地数据库启动超时。');stop(1);break;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
}
if(!closing)start(['node_modules/vite/bin/vite.js',...process.argv.slice(2)]);
await Promise.all(children.map(child=>child.exitCode===null?once(child,'exit'):Promise.resolve()));
