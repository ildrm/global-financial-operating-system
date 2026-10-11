import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
if(existsSync('.env'))process.loadEnvFile('.env');
const root='apps/web/.next-production/static';
if(!existsSync(root))throw new Error('Build the web app before checking its public assets.');
const keys=['DEMO_API_TOKEN','SESSION_SECRET','GFOS_RUNTIME_PASSWORD','GFOS_WORKER_PASSWORD','POSTGRES_PASSWORD','GARAGE_DEFAULT_SECRET_KEY'];
const secrets=keys.map(key=>({key,value:process.env[key]})).filter((s):s is {key:string;value:string}=>typeof s.value==='string'&&s.value.length>=16);
if(!secrets.length)throw new Error('No private configuration available to verify; check not performed.');
let files=0;const leaks:string[]=[];
async function scan(path:string){
 for(const entry of await readdir(path,{withFileTypes:true})){
  const child=path+'/'+entry.name;
  if(entry.isDirectory())await scan(child);
  else{
   files++;const content=await readFile(child);
   for(const secret of secrets)if(content.includes(secret.value))leaks.push(secret.key+' in '+child);
  }
 }
}
await scan(root);
const result={checkedAt:new Date().toISOString(),scope:'Literal configured secret values in production public static assets',files,secretNames:secrets.map(s=>s.key),passed:leaks.length===0,leaks,limitation:'Literal asset scan only; not an application penetration or data-flow assessment.'};
await writeFile('docs/verification/client-secret-check.json',JSON.stringify(result,null,2)+'\n');
if(leaks.length)throw new Error('Configured secrets found in public assets: '+leaks.join(', '));
console.log('PASS: '+files+' public static assets contain no configured secret literals.');
