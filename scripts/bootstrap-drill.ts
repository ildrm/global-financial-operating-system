import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readdir } from 'node:fs/promises';
import { createPool, hash } from '../packages/database/src/index';
import { PostgresLedger } from '../modules/ledger/src/index';
if(process.env.NODE_ENV==='production'||process.env.GFOS_DEMO!=='true')throw new Error('Bootstrap drill requires synthetic development mode.');
const run=promisify(execFile);const admin=createPool(process.env.MIGRATION_DATABASE_URL);
const name='gfos_bootstrap_'+randomUUID().replaceAll('-','');
const substitute=(url:string)=>{const u=new URL(url);u.pathname='/'+name;return u.toString();};
const env={...process.env,MIGRATION_DATABASE_URL:substitute(process.env.MIGRATION_DATABASE_URL!),DATABASE_URL:substitute(process.env.DATABASE_URL!),WORKER_DATABASE_URL:substitute(process.env.WORKER_DATABASE_URL!)};
let pool:ReturnType<typeof createPool>|undefined;let migrated:ReturnType<typeof createPool>|undefined;
const startedAt=new Date().toISOString();
try{
 await admin.query(`CREATE DATABASE ${name} TEMPLATE template0`);
 await run(process.execPath,['--import','tsx','scripts/bootstrap.ts'],{env,maxBuffer:1024*1024});
 pool=createPool(env.DATABASE_URL);migrated=createPool(env.MIGRATION_DATABASE_URL);
 const ledger=new PostgresLedger(pool);
 const actor={id:'11111111-1111-4111-8111-111111111111',issuer:'gfos:synthetic',subject:'local-owner'};
 const books=await ledger.entities(actor);
 if(books.length!==2||books.some(b=>!b.synthetic))throw new Error('Fresh synthetic books were not provisioned.');
 const reference=await ledger.overview(actor,'33333333-3333-4333-8333-333333333333','2026-10-01','2026-10-31');
 if(reference.cash!=='7438.60'||reference.income!=='3000.00'||reference.spending!=='61.40'||reference.accounts.length!==3)throw new Error('Fresh bootstrap reference values differ.');
 const before=(await migrated.query('SELECT to_jsonb(j)::text AS row FROM ledger.journals j ORDER BY id')).rows;
 if(before.length!==4)throw new Error('Fresh bootstrap has unexpected economic facts.');
 await run(process.execPath,['--import','tsx','scripts/bootstrap.ts'],{env,maxBuffer:1024*1024});
 const after=(await migrated.query('SELECT to_jsonb(j)::text AS row FROM ledger.journals j ORDER BY id')).rows;
 if(hash(before)!==hash(after))throw new Error('Repeated bootstrap changed journal facts.');
 const migrationCount=(await migrated.query<{count:string}>('SELECT count(*)::text FROM public.schema_migrations')).rows[0]!.count;
 const expectedCount=(await readdir('database/migrations')).filter(f=>f.endsWith('.sql')).length;
 if(migrationCount!==String(expectedCount))throw new Error('Fresh migration coverage differs.');
 await writeFile('docs/verification/bootstrap-results.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),passed:true,checks:[expectedCount+' migrations applied to an empty database','two synthetic workspaces provisioned','three financial accounts and four balanced source journals','7438.60 cash / 3000.00 income / 61.40 spending','repeated bootstrap preserves exact journal fingerprints'],limitations:['Native PostgreSQL with preexisting restricted cluster roles.','Container image, empty-volume permissions and creation of cluster roles were not verified.']},null,2)+'\n');
 console.log('PASS: fresh native schema/bootstrap, golden balances and repeatable seed.');
}finally{
 await pool?.end();await migrated?.end();await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.end();
}
