import { describe,it,expect,beforeAll,afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPool,transaction,setScope,hash } from '../../packages/database/src/index';
import { PostgresLedger } from '../../modules/ledger/src/index';
import { processOutbox } from '../../apps/worker/src/process';
import { OverviewSchema } from '../../packages/contracts/src/index';
import type { FinancialCommand,Actor } from '../../packages/contracts/src/index';
const pool=createPool();const admin=createPool(process.env.MIGRATION_DATABASE_URL);const worker=createPool(process.env.WORKER_DATABASE_URL);
const ledger=new PostgresLedger(pool);
const actor:Actor={id:randomUUID(),issuer:'test',subject:randomUUID()};
const viewer:Actor={id:randomUUID(),issuer:'test',subject:randomUUID()};
const intruder:Actor={id:randomUUID(),issuer:'test',subject:randomUUID()};
const workspaceId=randomUUID();const entityId=randomUUID();const foreignWorkspace=randomUUID();const foreignEntity=randomUUID();
let bankId:string;let cashId:string;let cardId:string;let loanId:string;
const overview=()=>ledger.overview(actor,entityId,'2026-10-01','2026-10-31');
async function post(kind:FinancialCommand['kind'],amount:string,otherAccountId?:string,accountId=bankId){
 const view=await overview();return ledger.post(actor,randomUUID(),{entityId,expectedVersion:view.entity.version,kind,amount,currency:'EUR',effectiveDate:'2026-10-08',description:'Synthetic integration case',accountId,...(otherAccountId?{otherAccountId}:{})});
}
beforeAll(async()=>{
  for(const principal of [actor,viewer,intruder])await admin.query('INSERT INTO identity.principals(id,issuer,subject) VALUES($1,$2,$3)',[principal.id,principal.issuer,principal.subject]);
  for(const [w,e] of [[workspaceId,entityId],[foreignWorkspace,foreignEntity]] as const){
    await admin.query("INSERT INTO workspace.workspaces(id,name,kind,synthetic) VALUES($1,'Integration fixture','personal',true)",[w]);
    await admin.query("INSERT INTO workspace.entities(workspace_id,id,name,currency) VALUES($1,$2,'Test book','EUR')",[w,e]);
    for(const kind of ['income','expense','equity'])await admin.query("INSERT INTO ledger.accounts(workspace_id,entity_id,id,name,kind,currency,opened_on) VALUES($1,$2,$3,$4,$4,'EUR','1900-01-01')",[w,e,randomUUID(),kind]);
  }
  for(const [principal,role,w,e] of [[actor,'owner',workspaceId,entityId],[viewer,'viewer',workspaceId,entityId],[intruder,'owner',foreignWorkspace,foreignEntity]] as const)
    await admin.query('INSERT INTO workspace.grants(workspace_id,entity_id,actor_id,role) VALUES($1,$2,$3,$4)',[w,e,principal.id,role]);
  for(const [name,kind] of [['Test bank','bank'],['Test cash','cash'],['Test card','card'],['Test loan','loan']] as const){
    const view=await overview();const result=await ledger.createAccount(actor,randomUUID(),{entityId,expectedVersion:view.entity.version,name,kind,openingAmount:'0.00',openedOn:'2026-10-01'});
    if(!result.accountId)throw new Error('Account not created.');
    if(kind==='bank')bankId=result.accountId;if(kind==='cash')cashId=result.accountId;if(kind==='card')cardId=result.accountId;if(kind==='loan')loanId=result.accountId;
  }
});
afterAll(async()=>{await pool.end();await admin.end();await worker.end();});
describe('real PostgreSQL kernel',()=>{
 it('uses a non-owner runtime without BYPASSRLS',async()=>{
   const result=await pool.query<{rolsuper:boolean;rolbypassrls:boolean;owns:boolean}>("SELECT r.rolsuper,r.rolbypassrls,(SELECT pg_get_userbyid(relowner)=current_user FROM pg_class WHERE oid='ledger.journals'::regclass) AS owns FROM pg_roles r WHERE r.rolname=current_user");
   expect(result.rows[0]).toEqual({rolsuper:false,rolbypassrls:false,owns:false});
 });
 it('denies missing context and cross-book access',async()=>{
   expect((await pool.query('SELECT * FROM ledger.journals')).rows).toHaveLength(0);
   expect((await pool.query('SELECT * FROM ledger.accounts')).rows).toHaveLength(0);
   await expect(ledger.overview(intruder,entityId,'2026-10-01','2026-10-31')).rejects.toMatchObject({code:'ACCESS_DENIED'});
   await expect(transaction(pool,intruder.id,async tx=>{await setScope(tx,workspaceId,entityId);return tx.query('SELECT * FROM ledger.accounts');})).resolves.toMatchObject({rowCount:0});
   await expect(transaction(pool,actor.id,async tx=>{await setScope(tx,workspaceId,entityId);return tx.query('UPDATE workspace.entities SET currency=currency WHERE id=$1',[entityId]);})).rejects.toMatchObject({code:'42501'});
 });
 it('posts salary once under concurrent retries and rejects changed payloads',async()=>{
   const version=(await overview()).entity.version;const key=randomUUID();
   const cmd:FinancialCommand={entityId,expectedVersion:version,kind:'income',amount:'3000.00',currency:'EUR',effectiveDate:'2026-10-03',description:'Golden salary',accountId:bankId};
   const results=await Promise.all([ledger.post(actor,key,cmd),ledger.post(actor,key,cmd),ledger.post(actor,key,cmd)]);
   expect(new Set(results.map(r=>r.journalId)).size).toBe(1);
   expect((await overview()).income).toBe('3000.00');
   expect((await overview()).cash).toBe('3000.00');
   await expect(ledger.post(actor,key,{...cmd,amount:'3001.00'})).rejects.toMatchObject({code:'IDEMPOTENCY_PAYLOAD_CONFLICT'});
   await expect(ledger.post(actor,randomUUID(),cmd)).rejects.toMatchObject({code:'AGGREGATE_VERSION_CONFLICT'});
 });
 it('separates borrowing, card purchases and card settlement',async()=>{
   await post('borrowing','10000.00',loanId);
   await post('expense','80.00',undefined,cardId);
   expect((await overview()).spending).toBe('80.00');
   expect((await overview()).income).toBe('3000.00');
   await post('card_payment','80.00',cardId);
   const view=await overview();expect(view.spending).toBe('80.00');
   expect(view.accounts.find(a=>a.id===cardId)?.balance).toBe('0.00');
   expect(view.accounts.find(a=>a.id===loanId)?.balance).toBe('10000.00');
   expect(view.cash).toBe('12920.00');
 });
 it('conserves cash on own transfers',async()=>{
   await post('transfer','500.00',cashId);
   const view=await overview();expect(view.cash).toBe('12920.00');expect(view.income).toBe('3000.00');expect(view.spending).toBe('80.00');
 });
 it('records reversals without editing originals and preserves issued snapshots',async()=>{
   const expense=await post('expense','20.00');
   const original=await ledger.generateReport(actor,{entityId,reportId:'R-D02',from:'2026-10-01',to:'2026-10-31'});
   const cashflow=await ledger.generateReport(actor,{entityId,reportId:'R-D01',from:'2026-10-01',to:'2026-10-31'});
   expect(cashflow.totals).toEqual({openingCash:'0.00',netMovement:'12900.00',closingCash:'12900.00'});
   expect(original.totals.cash).toBe('12900.00');
   const reverse=await ledger.reverse(actor,randomUUID(),expense.journalId!,{entityId,expectedVersion:(await overview()).entity.version,effectiveDate:'2026-10-09',reason:'Correct the synthetic test expense'});
   expect(reverse.journalId).not.toBe(expense.journalId);
   const view=await overview();expect(view.cash).toBe('12920.00');expect(view.spending).toBe('80.00');
   const frozen=await ledger.snapshot(actor,original.id);expect(frozen).toEqual(original);
   const {checksum,...content}=frozen;expect(hash(content)).toBe(checksum);
   await expect(ledger.snapshot(viewer,original.id)).rejects.toMatchObject({code:'ACCESS_DENIED'});
   const generated=await ledger.generateReport(viewer,{entityId,reportId:'R-D02',from:'2026-10-01',to:'2026-10-31'});
   expect(generated.totals.cash).toBe('12920.00');
   await admin.query('UPDATE workspace.grants SET revoked_at=now() WHERE actor_id=$1',[viewer.id]);
   await expect(ledger.snapshot(viewer,generated.id)).rejects.toMatchObject({code:'ACCESS_DENIED'});
 });
 it('rejects mutation, late lines, unbalanced journals, and excess precision at the database',async()=>{
   const j=(await overview()).journals.find(j=>j.kind==='income')!;
   await expect(transaction(pool,actor.id,async tx=>{await setScope(tx,workspaceId,entityId);await tx.query('UPDATE ledger.journals SET amount=1 WHERE id=$1',[j.id]);})).rejects.toThrow();
   await expect(admin.query('UPDATE ledger.journals SET amount=1 WHERE id=$1',[j.id])).rejects.toThrow('IMMUTABLE_FINANCIAL_RECORD');
   await expect(transaction(pool,actor.id,async tx=>{await setScope(tx,workspaceId,entityId);await tx.query("INSERT INTO ledger.postings(workspace_id,entity_id,journal_id,line_no,account_id,side,amount,currency) VALUES($1,$2,$3,100,$4,'debit',1,'EUR')",[workspaceId,entityId,j.id,bankId]);})).rejects.toThrow('SEALED_JOURNAL');
   await expect(transaction(pool,actor.id,async tx=>{await setScope(tx,workspaceId,entityId);await tx.query("INSERT INTO ledger.journals(workspace_id,entity_id,id,actor_id,source_reference,kind,description,amount,currency,effective_date) VALUES($1,$2,$3,$4,$5,'income','Unbalanced test',1,'EUR','2026-10-10')",[workspaceId,entityId,randomUUID(),actor.id,randomUUID()]);})).rejects.toThrow('UNBALANCED_JOURNAL');
   await expect(transaction(pool,actor.id,async tx=>{await setScope(tx,workspaceId,entityId);await tx.query("INSERT INTO ledger.journals(workspace_id,entity_id,id,actor_id,source_reference,kind,description,amount,currency,effective_date) VALUES($1,$2,$3,$4,$5,'income','Precision test',1.001,'EUR','2026-10-10')",[workspaceId,entityId,randomUUID(),actor.id,randomUUID()]);})).rejects.toThrow('UNSUPPORTED_PRECISION');
 });
 it('protects closed periods and event uniqueness across keys',async()=>{
   await admin.query("INSERT INTO ledger.closed_periods(workspace_id,entity_id,through_date) VALUES($1,$2,'2026-10-05')",[workspaceId,entityId]);
   const cmd:FinancialCommand={entityId,expectedVersion:(await overview()).entity.version,kind:'income',amount:'1.00',currency:'EUR',effectiveDate:'2026-10-03',description:'Closed date',accountId:bankId};
   await expect(ledger.post(actor,randomUUID(),cmd)).rejects.toThrow('PERIOD_CLOSED');
   const open={...cmd,effectiveDate:'2026-10-10',sourceReference:'stable-provider-event'};
   await ledger.post(actor,randomUUID(),open);
   await expect(ledger.post(actor,randomUUID(),{...open,expectedVersion:(await overview()).entity.version})).rejects.toThrow();
 });
 it('drains the outbox exactly once per consumer and safely replays delivery',async()=>{
   await processOutbox(worker);expect(await processOutbox(worker)).toBe(0);
   const row=(await admin.query<{id:string}>('SELECT id FROM audit.outbox WHERE entity_id=$1 LIMIT 1',[entityId])).rows[0]!;
   const before=(await admin.query<{count:string}>("SELECT count(*)::text FROM audit.inbox WHERE event_id=$1",[row.id])).rows[0]!.count;
   await admin.query('UPDATE audit.outbox SET processed_at=NULL WHERE id=$1',[row.id]);
   await processOutbox(worker);
   expect((await admin.query<{count:string}>('SELECT count(*)::text FROM audit.inbox WHERE event_id=$1',[row.id])).rows[0]!.count).toBe(before);
 });
 it('verifies audit sequence and chain hashes',async()=>{
   const rows=(await admin.query<{sequence:string;actor_id:string;action:string;resource_id:string;previous_hash:string;hash:string}>('SELECT sequence::text,actor_id,action,resource_id,previous_hash,hash FROM audit.events WHERE entity_id=$1 ORDER BY audit.events.sequence',[entityId])).rows;
   let previous='0'.repeat(64);let sequence=0n;
   for(const r of rows){
     sequence++;expect(r.sequence).toBe(sequence.toString());expect(r.previous_hash).toBe(previous);
     expect(r.hash).toBe(hash({previous,sequence:r.sequence,actorId:r.actor_id,action:r.action,resourceId:r.resource_id}));
     previous=r.hash;
   }
 });
 it('privately freezes account/reversal drafts and recovers committed receipts',async()=>{
   const command={entityId,expectedVersion:(await overview()).entity.version,name:'Prepared account',kind:'cash' as const,openingAmount:'0.00',openedOn:'2026-10-01'};
   const input={operation:'account' as const,command};const draft=await ledger.prepareOperation(actor,input);
   expect((await ledger.recover(actor,draft.draftKey,entityId)).state).toBe('draft');
   await expect(ledger.recover(intruder,draft.draftKey,entityId)).rejects.toMatchObject({code:'ACCESS_DENIED'});
   await expect(ledger.executeOperation(actor,draft.draftKey,{...input,command:{...command,openingAmount:'1.00'}})).rejects.toMatchObject({code:'REVIEW_REQUIRED'});
   const created=await ledger.executeOperation(actor,draft.draftKey,input);
   const replay=await ledger.executeOperation(actor,draft.draftKey,input);
   expect(replay.accountId).toBe(created.accountId);expect(replay.replayed).toBe(true);
   expect((await ledger.recover(actor,draft.draftKey,entityId)).state).toBe('committed');
   const expense=await post('expense','3.00');
   const reverseInput={operation:'reverse' as const,journalId:expense.journalId!,command:{entityId,expectedVersion:(await overview()).entity.version,effectiveDate:'2026-10-11',reason:'Draft recovery validation'}};
   const reverseDraft=await ledger.prepareOperation(actor,reverseInput);
   const reversal=await ledger.executeOperation(actor,reverseDraft.draftKey,reverseInput);
   expect((await ledger.executeOperation(actor,reverseDraft.draftKey,reverseInput)).journalId).toBe(reversal.journalId);
   expect((await ledger.recover(actor,reverseDraft.draftKey,entityId)).state).toBe('committed');
 });
 it('limits worker database access to event delivery metadata',async()=>{
   await expect(worker.query('SELECT * FROM ledger.postings')).rejects.toMatchObject({code:'42501'});
   await expect(worker.query('SELECT * FROM ledger.journals')).rejects.toMatchObject({code:'42501'});
   await expect(worker.query('SELECT * FROM reporting.snapshots')).rejects.toMatchObject({code:'42501'});
 });
 it('keeps large calculated balances readable beyond the individual input bound',async()=>{
   const initial=await ledger.overview(intruder,foreignEntity,'2026-10-01','2026-10-31');
   const created=await ledger.createAccount(intruder,randomUUID(),{entityId:foreignEntity,expectedVersion:initial.entity.version,name:'Large balance fixture',kind:'bank',openingAmount:'4470.00',openedOn:'2026-10-01'});
   const opened=await ledger.overview(intruder,foreignEntity,'2026-10-01','2026-10-31');
   await ledger.post(intruder,randomUUID(),{entityId:foreignEntity,expectedVersion:opened.entity.version,kind:'income',amount:'99999999999999999999999999.99',currency:'EUR',effectiveDate:'2026-10-11',description:'Maximum individual-input fixture',accountId:created.accountId!});
   const view=await ledger.overview(intruder,foreignEntity,'2026-10-01','2026-10-31');
   expect(view.cash).toBe('100000000000000000000004469.99');expect(OverviewSchema.safeParse(view).success).toBe(true);
   const balance=await ledger.generateReport(intruder,{entityId:foreignEntity,reportId:'R-D02',from:'2026-10-01',to:'2026-10-31'});
   expect(balance.totals.cash).toBe(view.cash);
   const bridge=await ledger.generateReport(intruder,{entityId:foreignEntity,reportId:'R-D01',from:'2026-10-01',to:'2026-10-31'});
   expect(bridge.totals.netMovement).toBe(view.cash);expect((await ledger.snapshot(intruder,balance.id)).checksum).toBe(balance.checksum);
 });
});

