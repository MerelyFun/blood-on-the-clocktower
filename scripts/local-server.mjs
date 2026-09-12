import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LocalStore } from './local-store.ts';

export function createLocalServer({ databasePath = resolve('.local-data/clocktower.sqlite') } = {}) {
 const store=new LocalStore(databasePath);
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  const reply=(data,status=200)=>{res.writeHead(status);res.end(JSON.stringify({...data,serverTime:Date.now()}));};
  if(req.url!=='/api/local')return reply({error:'没有此接口。'},404);
  if(req.method!=='POST')return reply({error:'仅支持 POST。'},405);
  if(req.headers.origin){
   let originHost;try{originHost=new URL(req.headers.origin).host;}catch{return reply({error:'无效的网站来源。',code:'ORIGIN'},403);}
   if(originHost!==req.headers.host)return reply({error:'此网站来源不允许访问本机数据库。',code:'ORIGIN'},403);
  }
  // Same-origin proxy only. No CORS grants and require JSON to reject cross-site forms.
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply({error:'请发送 JSON。'},415);
  try{
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>4000000){reply({error:'请求内容超过 4 MB。'},413);return;}chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply({error:'请求格式错误。'},400);}
   const auth=req.headers.authorization||'';
   reply(store.request(body,auth.startsWith('Bearer ')?auth.slice(7):''));
  }catch(error){
   if(typeof error.code==='string'&&!error.code.startsWith('ERR_'))return reply({error:error.message,code:error.code},error.code==='FORBIDDEN'?403:error.code==='UNAUTHENTICATED'?401:error.code==='VERSION_CONFLICT'?409:400);
   console.error('Local API error:',error);
   reply({error:'本机数据库暂时不可用，请检查启动终端。',code:'INTERNAL_ERROR'},500);
  }
 });
 server.on('close',()=>store.close());
 return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.CLOCKTOWER_API_PORT||5175);
 const server=createLocalServer({databasePath:process.env.LOCAL_DATABASE_PATH||resolve('.local-data/clocktower.sqlite')});
 server.listen(port,'127.0.0.1',()=>console.log(`Local SQLite API: http://127.0.0.1:${port}/api/local`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
