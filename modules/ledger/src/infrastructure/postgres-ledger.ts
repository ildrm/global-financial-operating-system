import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { Exact, money, calculatedMoney, FinancialError } from '@gfos/financial-math';
import type { Currency } from '@gfos/financial-math';
import { transaction, setScope, hash, drizzle, sql } from '@gfos/database';
import type { Transaction } from '@gfos/database';
import { ReportSnapshotSchema, CommandSchema, OperationDraftSchema, AccountSchema, ReverseSchema } from '@gfos/contracts';
import type { OperationDraft } from '@gfos/contracts';
import type { Actor, EntityView, Overview, AccountView, JournalView, FinancialCommand, CreateAccount, CommandResult, ReportRequest, ReportSnapshot, PostingView } from '@gfos/contracts';
import type { LedgerPort } from '../application/ports';
import { assertBalanced, buildPostings, openingPostings } from '../domain/posting';
import type { Account, Posting, SystemAccounts } from '../domain/posting';

interface EntityRow { id:string; workspaceId:string; name:string; workspaceName:string; currency:Currency; version:number; synthetic:boolean; role:'owner'|'viewer' }
interface AccountRow extends Account { name:string; balance:string }
const entitySelect=`SELECT e.id,e.workspace_id AS "workspaceId",e.name,w.name AS "workspaceName",e.currency,e.version,w.synthetic,g.role
 FROM workspace.entities e JOIN workspace.workspaces w ON w.id=e.workspace_id
 JOIN workspace.grants g ON g.workspace_id=e.workspace_id AND g.entity_id=e.id`;

export class PostgresLedger implements LedgerPort {
  constructor(readonly pool:pg.Pool) {}
  private async scope(tx:Transaction,actor:Actor,entityId:string,write=false):Promise<EntityRow> {
    const result=await tx.query<EntityRow>(entitySelect+` WHERE g.actor_id=$1 AND g.revoked_at IS NULL AND e.id=$2 ${write?'FOR UPDATE OF e':''}`,[actor.id,entityId]);
    const entity=result.rows[0];
    if(!entity || (write && entity.role!=='owner')) throw new FinancialError('ACCESS_DENIED','This book or action is not available to your account.');
    await setScope(tx,entity.workspaceId,entity.id);
    return entity;
  }
  async entities(actor:Actor):Promise<EntityView[]> {
    return transaction(this.pool,actor.id,async tx=>(await tx.query<EntityRow>(entitySelect+' WHERE g.actor_id=$1 AND g.revoked_at IS NULL ORDER BY w.id,e.name',[actor.id])).rows);
  }
  private async systems(tx:Transaction):Promise<SystemAccounts> {
    const {rows}=await tx.query<{id:string;kind:string}>("SELECT id,kind FROM ledger.accounts WHERE kind IN ('income','expense','equity')");
    const find=(kind:string)=>{const id=rows.find(r=>r.kind===kind)?.id;if(!id) throw new FinancialError('BOOK_NOT_CONFIGURED','The chart of accounts needs setup.');return id;};
    return {income:find('income'),expense:find('expense'),equity:find('equity')};
  }
  private async account(tx:Transaction,id:string):Promise<Account> {
    const result=await tx.query<Account>('SELECT id,kind,currency,opened_on::text AS "openedOn" FROM ledger.accounts WHERE id=$1',[id]);
    if(!result.rows[0]) throw new FinancialError('ACCESS_DENIED','The selected account is unavailable in this book.');
    return result.rows[0];
  }
  private async prior(tx:Transaction,actor:Actor,operation:string,key:string,payload:unknown):Promise<CommandResult|null> {
    const result=await tx.query<{request_hash:string;result:CommandResult}>('SELECT request_hash,result FROM audit.idempotency WHERE actor_id=$1 AND operation=$2 AND key=$3',[actor.id,operation,key]);
    const prior=result.rows[0];
    if(!prior) return null;
    if(prior.request_hash!==hash(payload)) throw new FinancialError('IDEMPOTENCY_PAYLOAD_CONFLICT','This operation key already belongs to different inputs.');
    return {...prior.result,replayed:true};
  }
  private assertVersion(entity:EntityRow,version:number):void {
    if(entity.version!==version) throw new FinancialError('AGGREGATE_VERSION_CONFLICT','The book changed. Refresh and review the action again.');
  }
  private async complete(tx:Transaction,entity:EntityRow,actor:Actor,operation:string,key:string,payload:unknown,result:CommandResult):Promise<CommandResult> {
    await tx.query('INSERT INTO audit.idempotency(workspace_id,entity_id,actor_id,operation,key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7)',[entity.workspaceId,entity.id,actor.id,operation,key,hash(payload),JSON.stringify(result)]);
    await tx.query('UPDATE workspace.entities SET version=version+1 WHERE workspace_id=$1 AND id=$2',[entity.workspaceId,entity.id]);
    return result;
  }
  private async audit(tx:Transaction,entity:EntityRow,actor:Actor,action:string,resourceId:string):Promise<void> {
    const last=(await tx.query<{sequence:string;hash:string}>('SELECT sequence::text,hash FROM audit.events ORDER BY audit.events.sequence DESC LIMIT 1')).rows[0];
    const sequence=(BigInt(last?.sequence ?? '0')+1n).toString();
    const previous=last?.hash ?? '0'.repeat(64);
    const digest=hash({previous,sequence,actorId:actor.id,action,resourceId});
    await tx.query('INSERT INTO audit.events(workspace_id,entity_id,id,sequence,actor_id,action,resource_id,previous_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [entity.workspaceId,entity.id,randomUUID(),sequence,actor.id,action,resourceId,previous,digest]);
  }
  private async journal(tx:Transaction,entity:EntityRow,actor:Actor,input:{kind:string;description:string;amount:string;effectiveDate:string;sourceReference:string;reversalOf?:string},lines:readonly Posting[]):Promise<string> {
    assertBalanced(lines);
    const id=randomUUID();
    await tx.query('INSERT INTO ledger.journals(workspace_id,entity_id,id,actor_id,source_reference,kind,description,amount,currency,effective_date,reversal_of) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [entity.workspaceId,entity.id,id,actor.id,input.sourceReference,input.kind,input.description,input.amount,entity.currency,input.effectiveDate,input.reversalOf ?? null]);
    for(const [i,line] of lines.entries()) {
      await tx.query('INSERT INTO ledger.postings(workspace_id,entity_id,journal_id,line_no,account_id,side,amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [entity.workspaceId,entity.id,id,i+1,line.accountId,line.side,line.amount,entity.currency]);
    }
    await this.audit(tx,entity,actor,'journal.posted',id);
    await tx.query("INSERT INTO audit.outbox(workspace_id,entity_id,id,journal_id,event_type) VALUES($1,$2,$3,$4,'journal.posted.v1')",[entity.workspaceId,entity.id,randomUUID(),id]);
    return id;
  }

  private async previewInTransaction(tx:Transaction,entity:EntityRow,command:FinancialCommand,draftKey:string){
    const account=await this.account(tx,command.accountId);
    const other=command.otherAccountId?await this.account(tx,command.otherAccountId):undefined;
    const system=await this.systems(tx);
    const lines=buildPostings(command,account,other,system);
    const names=(await tx.query<{id:string;name:string}>('SELECT id,name FROM ledger.accounts')).rows;
    return {draftKey,currentVersion:entity.version,lines:lines.map(line=>({...line,accountName:names.find(a=>a.id===line.accountId)?.name ?? line.accountId}))};
  }
  async preview(actor:Actor,command:FinancialCommand){
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,command.entityId,true);
      this.assertVersion(entity,command.expectedVersion);
      const draftKey=randomUUID();
      const preview=await this.previewInTransaction(tx,entity,command,draftKey);
      await tx.query('INSERT INTO ledger.command_drafts(workspace_id,entity_id,id,actor_id,command,request_hash) VALUES($1,$2,$3,$4,$5,$6)',[entity.workspaceId,entity.id,draftKey,actor.id,JSON.stringify(command),hash(command)]);
      return preview;
    });
  }
  async postReviewed(actor:Actor,key:string,command:FinancialCommand){
    await transaction(this.pool,actor.id,async tx=>{
      await this.scope(tx,actor,command.entityId,true);
      const draft=(await tx.query<{request_hash:string}>("SELECT request_hash FROM ledger.command_drafts WHERE id=$1 AND actor_id=$2 AND operation='post'",[key,actor.id])).rows[0];
      if(!draft || draft.request_hash!==hash(command))throw new FinancialError('REVIEW_REQUIRED','Review these exact inputs before posting.');
    });
    return this.post(actor,key,command);
  }
  async prepareOperation(actor:Actor,input:OperationDraft){
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,input.command.entityId,true);
      this.assertVersion(entity,input.command.expectedVersion);
      if(input.operation==='account')money(input.command.openingAmount,entity.currency);
      else {
        const journal=(await tx.query<{kind:string;effective_date:string}>('SELECT kind,effective_date::text FROM ledger.journals WHERE id=$1',[input.journalId])).rows[0];
        if(!journal)throw new FinancialError('ACCESS_DENIED','The activity is not available.');
        if(journal.kind==='reversal'||input.command.effectiveDate<journal.effective_date)throw new FinancialError('INVALID_REVERSAL','Choose a date on or after the original activity.');
      }
      const draftKey=randomUUID();
      await tx.query('INSERT INTO ledger.command_drafts(workspace_id,entity_id,id,actor_id,command,request_hash,operation,journal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[entity.workspaceId,entity.id,draftKey,actor.id,JSON.stringify(input.command),hash(input),input.operation,input.operation==='reverse'?input.journalId:null]);
      return {draftKey};
    });
  }
  async executeOperation(actor:Actor,key:string,input:OperationDraft){
    await transaction(this.pool,actor.id,async tx=>{
      await this.scope(tx,actor,input.command.entityId,true);
      const draft=(await tx.query<{request_hash:string}>('SELECT request_hash FROM ledger.command_drafts WHERE id=$1 AND actor_id=$2 AND operation=$3',[key,actor.id,input.operation])).rows[0];
      if(!draft||draft.request_hash!==hash(input))throw new FinancialError('REVIEW_REQUIRED','Prepare these exact inputs before submitting.');
    });
    return input.operation==='account'?this.createAccount(actor,key,input.command):this.reverse(actor,key,input.journalId,input.command);
  }
  async recover(actor:Actor,key:string,entityId:string){
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,entityId,true);
      const draft=(await tx.query<{command:unknown;operation:string;journal_id:string|null}>('SELECT command,operation,journal_id FROM ledger.command_drafts WHERE id=$1 AND actor_id=$2',[key,actor.id])).rows[0];
      if(!draft)throw new FinancialError('ACCESS_DENIED','This operation is not available.');
      if(draft.operation==='post'){
        const command=CommandSchema.parse(draft.command);
        const prior=await this.prior(tx,actor,'post',key,command);
        if(prior)return {state:'committed' as const,operation:'post' as const,receipt:prior};
        return {state:'draft' as const,operation:'post' as const,command,preview:await this.previewInTransaction(tx,entity,command,key)};
      }
      const input=OperationDraftSchema.parse({operation:draft.operation,command:draft.command,...(draft.operation==='reverse'?{journalId:draft.journal_id}:{})});
      const payload=input.operation==='account'?input.command:{journalId:input.journalId,...input.command};
      const prior=await this.prior(tx,actor,input.operation,key,payload);
      if(prior)return {state:'committed' as const,operation:input.operation,receipt:prior};
      return {state:'draft' as const,...input};
    });
  }
  async post(actor:Actor,key:string,command:FinancialCommand):Promise<CommandResult> {
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,command.entityId,true);
      const prior=await this.prior(tx,actor,'post',key,command);if(prior) return prior;
      this.assertVersion(entity,command.expectedVersion);
      if(command.currency!==entity.currency) throw new FinancialError('FX_EVIDENCE_REQUIRED','Record this activity in the book currency. Conversion requires sourced FX evidence.');
      const account=await this.account(tx,command.accountId);
      const other=command.otherAccountId ? await this.account(tx,command.otherAccountId) : undefined;
      const lines=buildPostings(command,account,other,await this.systems(tx));
      const journalId=await this.journal(tx,entity,actor,{kind:command.kind,description:command.description,amount:money(command.amount,command.currency).amount,effectiveDate:command.effectiveDate,sourceReference:command.sourceReference ?? 'command:'+actor.id+':'+key},lines);
      return this.complete(tx,entity,actor,'post',key,command,{journalId,entityVersion:entity.version+1,projectionStatus:'authoritative'});
    });
  }
  async createAccount(actor:Actor,key:string,command:CreateAccount):Promise<CommandResult> {
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,command.entityId,true);
      const prior=await this.prior(tx,actor,'account',key,command);if(prior) return prior;
      this.assertVersion(entity,command.expectedVersion);
      const opening=money(command.openingAmount,entity.currency).amount;
      const id=randomUUID();
      await tx.query('INSERT INTO ledger.accounts(workspace_id,entity_id,id,name,kind,currency,opened_on) VALUES($1,$2,$3,$4,$5,$6,$7)',[entity.workspaceId,entity.id,id,command.name,command.kind,entity.currency,command.openedOn]);
      const lines=openingPostings({id,kind:command.kind,currency:entity.currency,openedOn:command.openedOn},opening,await this.systems(tx));
      const journalId=lines.length ? await this.journal(tx,entity,actor,{kind:'opening',description:'Opening balance · '+command.name,amount:new Exact(opening).abs().toFixed(),effectiveDate:command.openedOn,sourceReference:'opening:'+id},lines) : null;
      await this.audit(tx,entity,actor,'account.created',id);
      return this.complete(tx,entity,actor,'account',key,command,{journalId,accountId:id,entityVersion:entity.version+1,projectionStatus:'authoritative'});
    });
  }
  async reverse(actor:Actor,key:string,id:string,command:{entityId:string;expectedVersion:number;effectiveDate:string;reason:string}):Promise<CommandResult> {
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,command.entityId,true);
      const payload={journalId:id,...command};
      const prior=await this.prior(tx,actor,'reverse',key,payload);if(prior) return prior;
      this.assertVersion(entity,command.expectedVersion);
      const original=(await tx.query<{kind:string;amount:string;effective_date:string}>('SELECT kind,amount::text,effective_date::text FROM ledger.journals WHERE id=$1',[id])).rows[0];
      if(!original) throw new FinancialError('ACCESS_DENIED','The activity is not available.');
      if(original.kind==='reversal' || command.effectiveDate<original.effective_date) throw new FinancialError('INVALID_REVERSAL','Choose a date on or after the original activity. Reversals cannot be reversed.');
      const originalLines=(await tx.query<Posting>('SELECT account_id AS "accountId",side,amount::text FROM ledger.postings WHERE journal_id=$1 ORDER BY line_no',[id])).rows;
      const lines=originalLines.map(line=>({...line,side:line.side==='debit'?'credit' as const:'debit' as const}));
      const journalId=await this.journal(tx,entity,actor,{kind:'reversal',description:command.reason,amount:original.amount,effectiveDate:command.effectiveDate,sourceReference:'reversal:'+id,reversalOf:id},lines);
      return this.complete(tx,entity,actor,'reverse',key,payload,{journalId,entityVersion:entity.version+1,projectionStatus:'authoritative'});
    });
  }
  private async view(tx:Transaction,entity:EntityRow,from:string,to:string):Promise<Overview> {
    const accountRows=(await tx.query<AccountRow>(`SELECT a.id,a.name,a.kind,a.currency,a.opened_on::text AS "openedOn",
      COALESCE(sum(CASE WHEN j.id IS NULL THEN 0 WHEN p.side='debit' THEN p.amount ELSE -p.amount END),0)::text AS balance
      FROM ledger.accounts a LEFT JOIN ledger.postings p ON p.account_id=a.id AND p.entity_id=a.entity_id AND p.workspace_id=a.workspace_id
      LEFT JOIN ledger.journals j ON j.id=p.journal_id AND j.entity_id=p.entity_id AND j.workspace_id=p.workspace_id AND j.effective_date<=$1
      WHERE a.kind IN ('bank','cash','card','loan') AND a.opened_on<=$1 GROUP BY a.workspace_id,a.entity_id,a.id ORDER BY a.opened_on,a.name`,[to])).rows;
    const accounts:AccountView[]=accountRows.map(a=>({...a,balance:calculatedMoney(['card','loan'].includes(a.kind)?new Exact(a.balance).negated().toFixed():a.balance,entity.currency).amount}));
    const records=(await tx.query<Omit<JournalView,'lines'>>(`SELECT j.id,j.effective_date::text AS "effectiveDate",j.recorded_at::text AS "recordedAt",j.kind,j.description,j.amount::text,j.currency,j.reversal_of AS "reversalOf",r.id AS "reversedBy"
      FROM ledger.journals j LEFT JOIN ledger.journals r ON r.reversal_of=j.id AND r.workspace_id=j.workspace_id AND r.entity_id=j.entity_id
      WHERE j.effective_date BETWEEN $1 AND $2 ORDER BY j.effective_date DESC,j.recorded_at DESC,j.id DESC LIMIT 200`,[from,to])).rows;
    const ids=records.map(j=>j.id);
    const lines=(await tx.query<PostingView&{journalId:string}>(`SELECT p.journal_id AS "journalId",p.account_id AS "accountId",a.name AS "accountName",p.side,p.amount::text,p.currency
      FROM ledger.postings p JOIN ledger.accounts a ON a.id=p.account_id AND a.workspace_id=p.workspace_id AND a.entity_id=p.entity_id
      WHERE p.journal_id=ANY($1::uuid[]) ORDER BY p.journal_id,p.line_no`,[ids])).rows;
    const journals:JournalView[]=records.map(j=>({...j,amount:money(j.amount,entity.currency).amount,lines:lines.filter(l=>l.journalId===j.id).map(l=>({...l,amount:money(l.amount,entity.currency).amount}))}));
    const metricRows=(await tx.query<{kind:string;amount:string}>(`SELECT a.kind,sum(CASE p.side WHEN 'debit' THEN p.amount ELSE -p.amount END)::text AS amount
      FROM ledger.postings p JOIN ledger.accounts a ON a.id=p.account_id AND a.workspace_id=p.workspace_id AND a.entity_id=p.entity_id
      JOIN ledger.journals j ON j.id=p.journal_id AND j.workspace_id=p.workspace_id AND j.entity_id=p.entity_id
      WHERE a.kind IN ('income','expense') AND j.effective_date BETWEEN $1 AND $2 GROUP BY a.kind`,[from,to])).rows;
    const cash=accounts.filter(a=>['bank','cash'].includes(a.kind)).reduce((sum,a)=>sum.plus(a.balance),new Exact(0));
    const series=(await tx.query<{date:string;balance:string}>(`WITH daily AS (
      SELECT j.effective_date AS date,sum(CASE p.side WHEN 'debit' THEN p.amount ELSE -p.amount END) AS delta
      FROM ledger.postings p JOIN ledger.accounts a ON a.id=p.account_id AND a.workspace_id=p.workspace_id AND a.entity_id=p.entity_id
      JOIN ledger.journals j ON j.id=p.journal_id AND j.workspace_id=p.workspace_id AND j.entity_id=p.entity_id
      WHERE a.kind IN ('bank','cash') AND j.effective_date<=$2 GROUP BY j.effective_date
    ), running AS (SELECT date,sum(delta) OVER(ORDER BY date) AS balance FROM daily)
    SELECT date::text,balance::text FROM (
      SELECT $1::date AS date,coalesce((SELECT balance FROM running WHERE date<=$1 ORDER BY date DESC LIMIT 1),0) AS balance
      UNION ALL SELECT date,balance FROM running WHERE date>$1 AND date<=$2
    ) source ORDER BY date`,[from,to])).rows;
    return {entity,accounts,journals,from,to,cash:calculatedMoney(cash.toFixed(),entity.currency).amount,
      income:calculatedMoney(new Exact(metricRows.find(r=>r.kind==='income')?.amount ?? '0').negated().toFixed(),entity.currency).amount,
      spending:calculatedMoney(metricRows.find(r=>r.kind==='expense')?.amount ?? '0',entity.currency).amount,
      cashSeries:series.map(r=>({...r,balance:calculatedMoney(r.balance,entity.currency).amount})),
      quality:{origin:'entered',reconciliation:'unreconciled',basis:'net-receipt',completeness:'user-recorded-book-only'}};
  }
  async overview(actor:Actor,entityId:string,from:string,to:string):Promise<Overview> {
    return transaction(this.pool,actor.id,async tx=>this.view(tx,await this.scope(tx,actor,entityId),from,to));
  }
  async generateReport(actor:Actor,request:ReportRequest):Promise<ReportSnapshot> {
    return transaction(this.pool,actor.id,async tx=>{
      const entity=await this.scope(tx,actor,request.entityId);
      const view=await this.view(tx,entity,request.from,request.to);
      // Full source manifest, independent of the bounded activity preview.
      const sourceJournalIds=(await tx.query<{id:string}>('SELECT id FROM ledger.journals WHERE effective_date<=$1 ORDER BY effective_date,id LIMIT 10001',[request.to])).rows.map(r=>r.id);
      if(sourceJournalIds.length>10000) throw new FinancialError('REPORT_LIMIT','This foundation report is limited to 10,000 source journals.');
      let rows:string[][];let columns:string[];let totals:Record<string,string>;let methodology:string;
      if(request.reportId==='R-D02') {
        columns=['Account','Type','Currency','As-of balance'];
        rows=view.accounts.map(a=>[a.name,a.kind,a.currency,a.balance]);
        totals={cash:view.cash};
        methodology='Balances as of the end date, from immutable journal postings. Assets are debit-positive; liabilities are credit-positive. Cash includes bank and cash only. No FX conversion or external statement reconciliation.';
      } else {
        const movements=(await tx.query<{date:string;description:string;kind:string;amount:string;id:string}>(`SELECT j.id,j.effective_date::text AS date,j.description,j.kind,
          sum(CASE p.side WHEN 'debit' THEN p.amount ELSE -p.amount END)::text AS amount
          FROM ledger.journals j JOIN ledger.postings p ON p.journal_id=j.id AND p.workspace_id=j.workspace_id AND p.entity_id=j.entity_id
          JOIN ledger.accounts a ON a.id=p.account_id AND a.workspace_id=p.workspace_id AND a.entity_id=p.entity_id
          WHERE a.kind IN ('bank','cash') AND j.effective_date BETWEEN $1 AND $2
          GROUP BY j.workspace_id,j.entity_id,j.id ORDER BY j.effective_date,j.id`,[request.from,request.to])).rows;
        if(movements.length>10000) throw new FinancialError('REPORT_LIMIT','Narrow the report period to 10,000 or fewer cash events.');
        const net=movements.reduce((s,r)=>s.plus(r.amount),new Exact(0));
        const opening=new Exact(view.cash).minus(net);
        rows=movements.map(r=>[r.date,r.description,r.kind,entity.currency,money(r.amount,entity.currency).amount,r.id]);
        columns=['Date','Description','Event','Currency','Net cash movement','Journal ID'];
        totals={openingCash:calculatedMoney(opening.toFixed(),entity.currency).amount,netMovement:calculatedMoney(net.toFixed(),entity.currency).amount,closingCash:view.cash};
        methodology='Opening cash + net journal movements = closing cash. Internal cash transfers contribute zero; borrowing is financing cash, never income. Opening-equity entries are explicitly included as opening adjustments when dated inside the period. Single book currency; no cash-flow regulatory classification.';
      }
      const now=new Date().toISOString();
      const content:Omit<ReportSnapshot,'checksum'>={id:randomUUID(),reportId:request.reportId,definitionVersion:'0.1.0',entityId:entity.id,currency:entity.currency,from:request.from,to:request.to,
        generatedAt:now,dataCutoff:now,sourceJournalIds,columns,rows,totals,quality:view.quality,methodology,actorId:actor.id};
      const snapshot={...content,checksum:hash(content)};
      await tx.query('INSERT INTO reporting.snapshots(workspace_id,entity_id,id,actor_id,report_id,content,checksum) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [entity.workspaceId,entity.id,snapshot.id,actor.id,request.reportId,JSON.stringify(snapshot),snapshot.checksum]);
      return snapshot;
    });
  }
  async snapshot(actor:Actor,id:string):Promise<ReportSnapshot> {
    return transaction(this.pool,actor.id,async tx=>{
      // Creator-scoped RLS + current membership, rechecked at download time.
      const result=await drizzle(tx).execute(sql`SELECT content FROM reporting.snapshots WHERE id=${id}`);
      const raw=result.rows[0]?.['content'];
      if(!raw || typeof raw!=='object') throw new FinancialError('ACCESS_DENIED','The snapshot is not available to your account.');
      // Persisted snapshots originate exclusively from the validated report service.
      const snapshot=ReportSnapshotSchema.parse(raw);
      await this.scope(tx,actor,snapshot.entityId);
      const {checksum,...content}=snapshot;
      if(hash(content)!==checksum) throw new FinancialError('SNAPSHOT_INTEGRITY','Snapshot verification failed.');
      return snapshot;
    });
  }
}

