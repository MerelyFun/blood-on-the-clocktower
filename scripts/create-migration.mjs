// Run with a Supabase CLI installed: npm run db:migration
// The CLI generates the filename; this helper never invents a migration timestamp.
import { readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const dir='supabase/migrations';
mkdirSync(dir,{recursive:true});
const before=new Set(readdirSync(dir));
execFileSync('supabase',['migration','new','initial_clocktower'],{stdio:'inherit'});
const created=readdirSync(dir).filter(name=>!before.has(name)&&name.endsWith('_initial_clocktower.sql'));
if(created.length!==1)throw new Error('无法确定 CLI 新建的迁移文件，请手动检查 supabase/migrations。');
copyFileSync('supabase/schema.sql',join(dir,created[0]));
console.log(`初始化脚本已复制到 ${join(dir,created[0])}`);
