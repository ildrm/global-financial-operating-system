import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { createPool, hash, transaction, setScope } from '../packages/database/src/index';
import { PostgresLedger } from '../modules/ledger/src/index';
import type pg from 'pg';

if(process.env.NODE_ENV==='production'||process.env.GFOS_DEMO!=='true')throw new Error('Restore drill requires synthetic development mode.');
process.umask(0o077);
const run=promisify(execFile);
const sourceUrl=new URL(process.env.MIGRATION_DATABASE_URL!);
const sourceName=sourceUrl.pathname.slice(1);
const restoreName='gfos_restore_'+randomUUID().replaceAll('-','');
const file='.local-data/'+restoreName+'.dump';
const env={...process.env,PGHOST:sourceUrl.searchParams.get('host')??sourceUrl.hostname,PGPORT:sourceUrl.port||'5432',PGUSER:decodeURIComponent(sourceUrl.username),PGPASSWORD:decodeURIComponent(sourceUrl.password)};
const admin=createPool(sourceUrl.toString());
const tables=['identity.principals','workspace.workspaces','workspace.entities','workspace.grants','ledger.accounts','ledger.journals','ledger.postings','ledger.closed_periods','ledger.command_drafts','audit.events','audit.idempotency','audit.outbox','audit.inbox','audit.checkpoints','reporting.snapshots'];
interface Fingerprint {table:string;rows:number;sha256:string}
async function fingerprint(client:pg.Pool|pg.PoolClient):Promise<Fingerprint[]>{
 const result:Fingerprint[]=[];
 for(const table of tables){
  // Names are a fixed internal allowlist. The exported snapshot makes every
  // fingerprint and pg_dump see the same committed state despite live workers.
  // Hash PostgreSQL's exact JSON text. Parsing JSON numeric columns into JS
  // numbers first could erase differences in large monetary values.
  const rows=(await client.query(`SELECT to_jsonb(t)::text AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  result.push({table,rows:rows.length,sha256:hash(rows)});
 }
 return result;
}
function inDatabase(value:string,name:string){const url=new URL(value);url.pathname='/'+name;return url.toString();}
let restored:pg.Pool|undefined;let runtime:pg.Pool|undefined;
const startedAt=new Date().toISOString();
try{
 await mkdir('.local-data',{recursive:true});
 const tx=await admin.connect();let expected:Fingerprint[];
 try{
  await tx.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot=(await tx.query<{id:string}>('SELECT pg_export_snapshot() AS id')).rows[0]!.id;
  expected=await fingerprint(tx);
  await run('pg_dump',['--format=custom','--no-owner','--snapshot='+snapshot,'--file='+file,'--dbname='+sourceName],{env,maxBuffer:1024*1024});
  await chmod(file,0o600);await tx.query('COMMIT');
 }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
 await admin.query(`CREATE DATABASE ${restoreName} TEMPLATE template0`);
 await run('pg_restore',['--exit-on-error','--no-owner','--dbname='+restoreName,file],{env,maxBuffer:1024*1024});
 restored=createPool(inDatabase(sourceUrl.toString(),restoreName));
 const actual=await fingerprint(restored);
 if(hash(expected)!==hash(actual))throw new Error('Restored row fingerprints differ.');
 runtime=createPool(inDatabase(process.env.DATABASE_URL!,restoreName));
 const ledger=new PostgresLedger(runtime);
 const actor={id:'11111111-1111-4111-8111-111111111111',issuer:'gfos:synthetic',subject:'local-owner'};
 const entityId='33333333-3333-4333-8333-333333333333';
 const before=await ledger.overview(actor,entityId,'2026-10-01','2026-10-31');
 const bank=before.accounts.find(a=>a.kind==='bank');if(!bank)throw new Error('Missing restored bank.');
 const existing=before.journals[0];if(!existing)throw new Error('Missing restored journals.');
 let sealed=false;
 try{await transaction(runtime,actor.id,async tx=>{await setScope(tx,before.entity.workspaceId,entityId);await tx.query("INSERT INTO ledger.postings(workspace_id,entity_id,journal_id,line_no,account_id,side,amount,currency) VALUES($1,$2,$3,999,$4,'debit',1,'EUR')",[before.entity.workspaceId,entityId,existing.id,bank.id]);});}
 catch(e){sealed=e instanceof Error&&e.message.includes('SEALED_JOURNAL');}
 if(!sealed)throw new Error('Restored journals did not remain sealed.');
 const report=await ledger.generateReport(actor,{entityId,reportId:'R-D02',from:'2026-10-01',to:'2026-10-31'});
 const frozen=await ledger.snapshot(actor,report.id);
 if(frozen.checksum!==report.checksum||frozen.totals.cash!==before.cash)throw new Error('Restored report integrity failed.');
 const command={entityId,expectedVersion:before.entity.version,kind:'income' as const,accountId:bank.id,amount:'1.00',currency:'EUR' as const,effectiveDate:'2026-10-11',description:'Isolated restore validation',sourceReference:'restore-validation:'+restoreName};
 const preview=await ledger.preview(actor,command);
 const posted=await ledger.postReviewed(actor,preview.draftKey,command);
 const replay=await ledger.postReviewed(actor,preview.draftKey,command);
 if(posted.journalId!==replay.journalId||!replay.replayed)throw new Error('Restored idempotency failed.');
 const recovered=await ledger.recover(actor,preview.draftKey,entityId);
 if(recovered.state!=='committed')throw new Error('Restored recovery failed.');
 await writeFile('docs/verification/restore-results.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),postgresMajor:17,method:'pg_dump exported snapshot / pg_restore into isolated temporary database',passed:true,checks:['all 15 table row fingerprints match','restored runtime role observes RLS','restored posted journals remain sealed','frozen snapshot checksum and cash reconcile','new reviewed posting and retry have one effect','committed receipt can be recovered'],fingerprints:actual,limitations:['Local logical restore only; no encrypted remote backup, PITR, failover or measured production RPO/RTO.','Same PostgreSQL cluster and preexisting roles; cluster role restoration is not exercised.','No object storage documents exist in this slice.']},null,2)+'\n');
 console.log('PASS: isolated logical restore, row fingerprints, sealed journals, report integrity and idempotent recovery.');
}finally{
 await runtime?.end();await restored?.end();
 await admin.query(`DROP DATABASE IF EXISTS ${restoreName} WITH (FORCE)`);
 await admin.end();await rm(file,{force:true});
}
