import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
if(process.env.NODE_ENV==='production'||process.env.GFOS_DEMO!=='true')throw new Error('CI verification requires an explicitly synthetic development database.');
const commands=[['verify'],['exec','tsc','--noEmit','-p','tsconfig.json'],['test:db'],['build'],['security:client-secrets'],['test:restore'],['test:e2e']];
const checks:{command:string;exitCode:number;durationMs:number}[]=[];
const startedAt=new Date().toISOString();
for(const args of commands){
 const start=performance.now();
 const exitCode=await new Promise<number>((resolve,reject)=>{
  const child=spawn('pnpm',args,{stdio:'inherit',env:{...process.env,PATH:process.cwd()+'/node_modules/.bin:'+process.env.PATH}});
  child.once('error',reject);child.once('exit',code=>resolve(code??1));
 });
 checks.push({command:'pnpm '+args.join(' '),exitCode,durationMs:Math.round(performance.now()-start)});
 if(exitCode!==0){process.exitCode=exitCode;break;}
}
const passed=checks.length===commands.length&&checks.every(c=>c.exitCode===0);
await writeFile('docs/verification/ci-results.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),nodeVersion:process.version,platform:process.platform,classification:'development kernel checks only; full GFOS release gate is separate',passed,checks},null,2)+'\n');
console.log(passed?'PASS: development kernel CI verification.':'FAIL: development kernel CI verification; inspect the recorded check.');
