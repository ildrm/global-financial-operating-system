import { randomUUID } from 'node:crypto';
import { createPool } from '../packages/database/src/index';
import { PostgresLedger } from '../modules/ledger/src/index';
if(process.env.NODE_ENV==='production' || process.env.GFOS_DEMO!=='true') throw new Error('Synthetic seeding requires explicit GFOS_DEMO=true outside production.');
const admin=createPool(process.env.MIGRATION_DATABASE_URL);
export const demoActor={id:'11111111-1111-4111-8111-111111111111',issuer:'gfos:synthetic',subject:'local-owner'};
const workspaces=[{id:'22222222-2222-4222-8222-222222222222',entity:'33333333-3333-4333-8333-333333333333',name:'Personal workspace'},{id:'44444444-4444-4444-8444-444444444444',entity:'55555555-5555-4555-8555-555555555555',name:'New workspace'}];
try {
  await admin.query('BEGIN');
  await admin.query('INSERT INTO identity.principals(id,issuer,subject) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[demoActor.id,demoActor.issuer,demoActor.subject]);
  for(const w of workspaces) {
    await admin.query("INSERT INTO workspace.workspaces(id,name,kind,synthetic) VALUES($1,$2,'personal',true) ON CONFLICT DO NOTHING",[w.id,w.name]);
    await admin.query("INSERT INTO workspace.entities(workspace_id,id,name,currency) VALUES($1,$2,'Personal book','EUR') ON CONFLICT DO NOTHING",[w.id,w.entity]);
    await admin.query("INSERT INTO workspace.grants(workspace_id,entity_id,actor_id,role) VALUES($1,$2,$3,'owner') ON CONFLICT DO NOTHING",[w.id,w.entity,demoActor.id]);
    for(const kind of ['income','expense','equity']) await admin.query('INSERT INTO ledger.accounts(workspace_id,entity_id,id,name,kind,currency,opened_on) VALUES($1,$2,$3,$4,$4,\'EUR\',\'1900-01-01\') ON CONFLICT DO NOTHING',[w.id,w.entity,randomUUID(),kind]);
  }
  await admin.query('COMMIT');
} catch(error) {await admin.query('ROLLBACK');throw error;}
finally {await admin.end();}
const pool=createPool();const ledger=new PostgresLedger(pool);
try {
  const entityId=workspaces[0]!.entity;
  let view=await ledger.overview(demoActor,entityId,'2026-10-01','2026-10-31');
    for(const [name,kind,openingAmount] of [['Bank','bank','4470.00'],['Cash','cash','30.00'],['Credit card','card','0.00']] as const) {
      if(view.accounts.some(a=>a.name===name && a.kind===kind))continue;
      await ledger.createAccount(demoActor,randomUUID(),{entityId,expectedVersion:view.entity.version,name,kind,openingAmount,openedOn:'2026-10-01'});
      view=await ledger.overview(demoActor,entityId,'2026-10-01','2026-10-31');
    }
    const bank=view.accounts.find(a=>a.kind==='bank')!;
    const hasSource=async(source:string)=>{
      const tx=await pool.connect();
      try{
        await tx.query('BEGIN');
        await tx.query("SELECT set_config('app.actor_id',$1,true),set_config('app.workspace_id',$2,true),set_config('app.entity_id',$3,true)",[demoActor.id,workspaces[0]!.id,entityId]);
        const found=await tx.query('SELECT 1 FROM ledger.journals WHERE source_reference=$1',[source]);
        await tx.query('COMMIT');return found.rowCount!==0;
      }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
    };
    if(!await hasSource('synthetic:salary:2026-10')){
    await ledger.post(demoActor,randomUUID(),{entityId,expectedVersion:view.entity.version,kind:'income',accountId:bank.id,amount:'3000.00',currency:'EUR',effectiveDate:'2026-10-03',description:'Net salary',sourceReference:'synthetic:salary:2026-10'});
    view=await ledger.overview(demoActor,entityId,'2026-10-01','2026-10-31');
    }
    if(!await hasSource('synthetic:groceries:2026-10')){
    await ledger.post(demoActor,randomUUID(),{entityId,expectedVersion:view.entity.version,kind:'expense',accountId:bank.id,amount:'61.40',currency:'EUR',effectiveDate:'2026-10-07',description:'Groceries',sourceReference:'synthetic:groceries:2026-10'});
    }
    console.log('Synthetic reference workspace is ready; existing facts were preserved.');
} finally {await pool.end();}

