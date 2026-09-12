import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { networkInterfaces } from 'node:os';
export default defineConfig({
 plugins: [react(),{name:'local-preview-address',apply:'serve',configureServer(server){
  server.middlewares.use('/api/local-info',(req,res)=>{
   const port=server.httpServer?.address();
   const addresses=Object.entries(networkInterfaces()).flatMap(([name,items])=>(items||[]).filter(x=>x.family==='IPv4'&&!x.internal).map(x=>({name,address:x.address})));
   addresses.sort((a,b)=>Number(/vmware|virtual|radmin|vbox/i.test(a.name))-Number(/vmware|virtual|radmin|vbox/i.test(b.name)));
   const urls=addresses.map(x=>`http://${x.address}:${port&&typeof port==='object'?port.port:5174}`);
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({urls}));
  });
 }}],
 base: process.env.VITE_BASE_PATH || './',
 server:{host:'0.0.0.0',port:Number(process.env.CLOCKTOWER_PORT||5174),strictPort:true,
  proxy:{'/api/local':{target:`http://127.0.0.1:${process.env.CLOCKTOWER_API_PORT||5175}`,changeOrigin:false}},
  fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.local-data/**','**/*.sqlite','**/*.sqlite-*']}
 },
 build: { target: 'es2022' }
});
