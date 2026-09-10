// Serve the already-built website without installing dependencies. Node.js 22+.
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'../dist'));
const port=Number(process.env.CLOCKTOWER_PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const candidate=resolve(root,`.${pathname.endsWith('/')?pathname+'index.html':pathname}`);
  const file=await realpath(candidate);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('文件不存在。请先运行 npm run build。');}
});
server.listen(port,'127.0.0.1',()=>console.log(`血染钟楼说书人工具：http://localhost:${port}`));
