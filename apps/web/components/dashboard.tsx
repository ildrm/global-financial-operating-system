'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { CivilDate, EntityViewSchema, OverviewSchema, PreviewSchema, RecoverySchema, CommandResultSchema, ReportSnapshotSchema } from '@gfos/contracts';
import { Home, CreditCard, List, ChartNoAxesCombined, Settings, Plus, ArrowRight, Landmark, Banknote, Info, X, ChevronRight, RefreshCw, CircleCheck, ArrowLeftRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { messages, formatMoney, parseLocalizedAmount } from '@gfos/localization';
import type { Locale } from '@gfos/localization';
import { Exact } from '@gfos/financial-math';
import type { Overview, EntityView, FinancialCommand, CreateAccount, ReverseCommand, OperationDraft, JournalView, CommandResult, ReportSnapshot } from '@gfos/contracts';

type Tab='overview'|'accounts'|'activity'|'reports'|'settings';
type Modal='entry'|'account'|'detail'|'recovery'|null;
interface Preview {draftKey:string;lines:{accountName:string;side:'debit'|'credit';amount:string}[];currentVersion:number}
class RequestError extends Error {constructor(readonly code:string,message:string,readonly status=0){super(message);}}
function uncertainOutcome(error:unknown){return !(error instanceof RequestError)||error.status>=500;}
async function api<T>(path:string,schema:z.ZodType<T>,body?:unknown,key?:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),...(signal?{signal}:{}),cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new RequestError(result.code ?? 'REQUEST_FAILED',result.detail ?? 'The request failed.',response.status);
  return schema.parse(result);
}
function displayNumber(value:string):number|null{
  const exact=new Exact(value);
  if(exact.abs().gt(Number.MAX_SAFE_INTEGER))return null;
  const result=exact.toNumber();
  return Number.isFinite(result)?result:null;
}
function today(){return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function Dashboard({locale}:{locale:Locale}){
  const t=messages(locale);const dir=locale==='fa'?'rtl':'ltr';
  const [entities,setEntities]=useState<EntityView[]>([]);
  const [entityId,setEntityId]=useState('');
  const [view,setView]=useState<Overview|null>(null);
  const [tab,setTab]=useState<Tab>('overview');
  const [activityAccount,setActivityAccount]=useState('');
  const [from,setFrom]=useState('2026-10-01');const [to,setTo]=useState('2026-10-31');
  const [period,setPeriod]=useState({from:'2026-10-01',to:'2026-10-31'});
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [auth,setAuth]=useState(false);const [notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [modal,setModal]=useState<Modal>(null);const [selected,setSelected]=useState<JournalView|null>(null);
  const [busy,setBusy]=useState(false);const [formError,setFormError]=useState('');
  const [kind,setKind]=useState<FinancialCommand['kind']>('expense');
  const [rawAmount,setRawAmount]=useState('');const [description,setDescription]=useState('');
  const [date,setDate]=useState(today());const [accountId,setAccountId]=useState('');const [otherId,setOtherId]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null);const [pending,setPending]=useState<{key:string;command:FinancialCommand}|null>(null);
  const [uncertain,setUncertain]=useState(false);
  const [accountName,setAccountName]=useState('');const [accountKind,setAccountKind]=useState<'bank'|'cash'|'card'|'loan'>('bank');
  const [opening,setOpening]=useState('0');const [reason,setReason]=useState('');
  const [accountPending,setAccountPending]=useState<{key:string;body:CreateAccount}|null>(null);
  const [reversePending,setReversePending]=useState<{key:string;body:ReverseCommand}|null>(null);
  const [recoveredAction,setRecoveredAction]=useState<(OperationDraft&{key:string})|null>(null);
  const [reportId,setReportId]=useState<'R-D02'|'R-D01'>('R-D02');const [snapshot,setSnapshot]=useState<ReportSnapshot|null>(null);
  const opener=useRef<HTMLElement|null>(null);const dialog=useRef<HTMLDialogElement>(null);
  const money=(amount:string,currency:string=view?.entity.currency ?? 'EUR')=>formatMoney(amount,currency,locale);
  useEffect(()=>{
    document.documentElement.lang=locale;document.documentElement.dir=dir;
    const params=new URLSearchParams(window.location.search);
    const range=z.object({from:CivilDate,to:CivilDate}).refine(v=>v.from<=v.to).safeParse({from:params.get('from'),to:params.get('to')});
    if(range.success){setFrom(range.data.from);setTo(range.data.to);setPeriod(range.data);}
    const requestedTab=params.get('tab');
    if(['overview','accounts','activity','reports','settings'].includes(requestedTab ?? ''))setTab(requestedTab as Tab);
    api('entities',z.array(EntityViewSchema)).then(rows=>{
      setEntities(rows);
      const requested=params.get('book');setEntityId(rows.find(e=>e.id===requested)?.id ?? rows[0]?.id ?? '');
      if(!rows.length){setLoading(false);setError('No books have been provisioned for this identity.');}
    }).catch(e=>{setLoading(false);if(e instanceof RequestError && e.code==='AUTHENTICATION_REQUIRED')setAuth(true);else setError(e.message);});
  },[locale,dir]);
  useEffect(()=>{
    if(!entityId)return;
    const controller=new AbortController();setLoading(true);setError('');setView(null);setSnapshot(null);
    api('overview?'+new URLSearchParams({entityId,from:period.from,to:period.to}),OverviewSchema,undefined,undefined,controller.signal)
      .then(data=>{setView(data);setLoading(false);})
      .catch(e=>{if(e.name!=='AbortError'){setError(e.message);setLoading(false);}});
    return ()=>controller.abort();
  },[entityId,period,refresh]);
  useEffect(()=>{
    if(entityId)window.history.replaceState(null,'','/'+locale+'?'+new URLSearchParams({book:entityId,tab,from:period.from,to:period.to}));
  },[entityId,tab,locale,period]);
  useEffect(()=>{
    if(modal){dialog.current?.showModal();}else if(dialog.current?.open){dialog.current.close();opener.current?.focus();}
  },[modal]);
  const open=(next:Modal,event?:React.MouseEvent<HTMLElement>,journal?:JournalView)=>{
    opener.current=event?.currentTarget ?? null;setFormError('');setBusy(false);setUncertain(false);
    setPreview(null);setPending(null);setAccountPending(null);setReversePending(null);setRecoveredAction(null);
    if(journal)setSelected(journal);
    setReason('');setRawAmount('');setDescription('');setDate(today());setAccountName('');setOpening('0');
    setAccountId(view?.accounts.find(a=>['bank','cash'].includes(a.kind))?.id ?? '');
    setOtherId('');setModal(next);
  };
  const close=()=>{if(!busy && !uncertain)setModal(null);};
  const reload=()=>setRefresh(n=>n+1);
  const errorMessage=(e:unknown)=>e instanceof RequestError && e.code==='AGGREGATE_VERSION_CONFLICT'?t.stale:e instanceof Error?e.message:String(e);

  useEffect(()=>{
    if(!view)return;
    const raw=sessionStorage.getItem('gfos_pending');if(!raw)return;
    let parsed:unknown;try{parsed=JSON.parse(raw);}catch{sessionStorage.removeItem('gfos_pending');return;}
    const saved=z.object({key:z.uuid(),entityId:z.uuid()}).safeParse(parsed);
    if(!saved.success || saved.data.entityId!==view.entity.id)return;
    const controller=new AbortController();
    api('operations/'+saved.data.key+'?entityId='+view.entity.id,RecoverySchema,undefined,undefined,controller.signal).then(result=>{
      if(result.state==='committed'){
        sessionStorage.removeItem('gfos_pending');setNotice((result.operation==='account'?t.savedAccount:result.operation==='reverse'?t.reversed:t.saved)+' '+t.operationReceipt+': '+(result.receipt.journalId??result.receipt.accountId));
      }else if(result.operation==='post'){
        setPending({key:saved.data.key,command:result.command});setPreview(result.preview);
        setUncertain(true);setFormError(t.checking);setModal('entry');
      }else{
        setRecoveredAction({...result,key:saved.data.key});setUncertain(true);setFormError(t.checking);setModal('recovery');
      }
    }).catch(e=>{if(e.name!=='AbortError')setError(errorMessage(e));});
    return ()=>controller.abort();
  },[view]);
  const requestPreview=async(event:React.FormEvent)=>{
    event.preventDefault();if(!view)return;setBusy(true);setFormError('');
    try{
      const command:FinancialCommand={entityId,expectedVersion:view.entity.version,kind,amount:parseLocalizedAmount(rawAmount,locale),currency:view.entity.currency,effectiveDate:date,description,accountId,...(['transfer','borrowing','card_payment'].includes(kind)?{otherAccountId:otherId}:{})};
      const result=await api('transactions/preview',PreviewSchema,command);
      if(result.currentVersion!==view.entity.version)throw new RequestError('AGGREGATE_VERSION_CONFLICT',t.stale);
      setPreview(result);setPending({key:result.draftKey,command});
    }catch(e){setFormError(errorMessage(e));}finally{setBusy(false);}
  };
  const post=async()=>{
    if(!pending)return;setBusy(true);setFormError('');
    try{
      sessionStorage.setItem('gfos_pending',JSON.stringify({key:pending.key,entityId}));
      const receipt=await api('transactions',CommandResultSchema,pending.command,pending.key);
      sessionStorage.removeItem('gfos_pending');setNotice(t.saved+' '+t.operationReceipt+': '+receipt.journalId);setUncertain(false);setModal(null);reload();
    }catch(e){
      if(uncertainOutcome(e)){setUncertain(true);setFormError(t.checking);}
      else {sessionStorage.removeItem('gfos_pending');setUncertain(false);setFormError(errorMessage(e));}
    }finally{setBusy(false);}
  };
  const saveAccount=async(event:React.FormEvent)=>{
    event.preventDefault();if(!view)return;setBusy(true);setFormError('');
    let mutationStarted=false;
    try{
      let action=accountPending;
      if(!action){
        const body:CreateAccount={entityId,expectedVersion:view.entity.version,name:accountName,kind:accountKind,openingAmount:parseLocalizedAmount(opening,locale),openedOn:date};
        const draft=await api('operations/draft',z.object({draftKey:z.uuid()}),{operation:'account',command:body});
        action={key:draft.draftKey,body};
      }
      setAccountPending(action);
      sessionStorage.setItem('gfos_pending',JSON.stringify({key:action.key,entityId}));mutationStarted=true;
      await api('accounts',CommandResultSchema,action.body,action.key);
      sessionStorage.removeItem('gfos_pending');setNotice(t.savedAccount);setUncertain(false);setModal(null);reload();
    }catch(e){
      if(mutationStarted&&uncertainOutcome(e)){setUncertain(true);setFormError(t.checking);}
      else {sessionStorage.removeItem('gfos_pending');setUncertain(false);setFormError(errorMessage(e));setAccountPending(null);}
    }finally{setBusy(false);}
  };
  const reverse=async(event:React.FormEvent)=>{
    event.preventDefault();if(!view||!selected)return;setBusy(true);setFormError('');
    let mutationStarted=false;
    try{
      let action=reversePending;
      if(!action){
        const body:ReverseCommand={entityId,expectedVersion:view.entity.version,effectiveDate:date,reason};
        const draft=await api('operations/draft',z.object({draftKey:z.uuid()}),{operation:'reverse',journalId:selected.id,command:body});
        action={key:draft.draftKey,body};
      }
      setReversePending(action);
      sessionStorage.setItem('gfos_pending',JSON.stringify({key:action.key,entityId}));mutationStarted=true;
      await api('journals/'+selected.id+'/reverse',CommandResultSchema,action.body,action.key);
      sessionStorage.removeItem('gfos_pending');setNotice(t.reversed);setUncertain(false);setModal(null);reload();
    }catch(e){
      if(mutationStarted&&uncertainOutcome(e)){setUncertain(true);setFormError(t.checking);}
      else {sessionStorage.removeItem('gfos_pending');setUncertain(false);setFormError(errorMessage(e));setReversePending(null);}
    }finally{setBusy(false);}
  };
  const retryRecovered=async()=>{
    if(!recoveredAction)return;setBusy(true);setFormError('');
    try{
      const route=recoveredAction.operation==='account'?'accounts':'journals/'+recoveredAction.journalId+'/reverse';
      await api(route,CommandResultSchema,recoveredAction.command,recoveredAction.key);
      sessionStorage.removeItem('gfos_pending');setNotice(recoveredAction.operation==='account'?t.savedAccount:t.reversed);setUncertain(false);setModal(null);reload();
    }catch(e){
      if(!uncertainOutcome(e)){sessionStorage.removeItem('gfos_pending');setUncertain(false);}
      setFormError(errorMessage(e));
    }finally{setBusy(false);}
  };
  const generate=async()=>{
    setBusy(true);setError('');
    try{setSnapshot(await api('reports',ReportSnapshotSchema,{entityId,reportId,from:period.from,to:period.to}));}
    catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  };
  const nav:[Tab,typeof Home][]=[['overview',Home],['accounts',CreditCard],['activity',List],['reports',ChartNoAxesCombined],['settings',Settings]];
  const typeName=(kind:string)=>({income:t.incomeEvent,expense:t.expense,transfer:t.transfer,borrowing:t.borrowing,card_payment:t.card_payment,opening:t.openingEvent,reversal:t.reversal}[kind] ?? kind);
  const accountingName=(name:string)=>({income:t.incomeEvent,expense:t.expense,equity:t.openingEvent})[name] ?? name;
  const accountType=(kind:string)=>({bank:t.bank,cash:t.cashAccount,card:t.card,loan:t.loan}[kind] ?? kind);
  const periodLabel=period.from.slice(0,7)===period.to.slice(0,7)?new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',calendar:'gregory'}).format(new Date(period.from+'T12:00:00Z')):period.from+' — '+period.to;
  const owner=view?.entity.role==='owner';
  const languageHref=(language:Locale,nextTab:Tab=tab)=>'/'+language+'?'+new URLSearchParams({book:entityId,tab:nextTab,from:period.from,to:period.to});
  const chartData=view?.cashSeries.map(row=>({date:row.date,time:Date.parse(row.date+'T00:00:00Z'),amount:row.balance,balance:displayNumber(row.balance)})) ?? [];
  if(view && chartData.at(-1)?.date!==view.to) chartData.push({date:view.to,time:Date.parse(view.to+'T00:00:00Z'),amount:view.cash,balance:displayNumber(view.cash)});
  const activity=view?.journals.filter(j=>!activityAccount||j.lines.some(l=>l.accountId===activityAccount)) ?? [];
  const Activity=({limit=200}:{limit?:number})=><div className="table-scroll"><table><caption className="sr-only">{t.activity} · {periodLabel} · {view?.entity.currency}</caption><thead><tr><th>{t.date}</th><th>{t.description}</th><th>{t.type}</th><th className="numeric">{t.amount}</th><th>{t.status}</th></tr></thead><tbody>
    {activity.slice(0,limit).map(j=><tr key={j.id}><td><bdi>{j.effectiveDate}</bdi></td><td><button className="text-button detail-link" onClick={e=>open('detail',e,j)}>{j.description}</button></td><td>{typeName(j.kind)}</td><td className={'numeric '+(j.kind==='income'?'positive':'')}><bdi>{j.kind==='expense'?'−':j.kind==='income'?'+':''}{money(j.amount,j.currency)}</bdi></td><td>{j.reversedBy?t.reversed:t.recorded}</td></tr>)}
    {!activity.length&&<tr><td colSpan={5} className="empty-cell">{t.noActivity}</td></tr>}
  </tbody></table>{view && view.journals.length===200&&<p className="muted">Showing the latest 200 records. Narrow the date range for earlier activity; report exports include the full bounded source set.</p>}</div>;
  const AccountList=()=> <div className="account-list">{view?.accounts.map(a=><button key={a.id} className="account-row" onClick={()=>{setTab('activity');setActivityAccount(a.id);setNotice(a.name+' · '+money(a.balance,a.currency));}}>
    {a.kind==='bank'?<Landmark/>:a.kind==='cash'?<Banknote/>:<CreditCard/>}<span>{a.name}</span><bdi className="numeric">{money(a.balance,a.currency)}</bdi><ChevronRight className="chevron"/>
  </button>)}{owner&&<button className="add-account" onClick={e=>open('account',e)}><Plus size={20}/>{t.addAccount}</button>}{!view?.accounts.length&&<p className="muted">{t.emptyHelp}</p>}</div>;
  return <div className="app" dir={dir}>
    <a className="skip-link" href="#main">{t.overview}</a>
    <aside className="sidebar"><Link href={'/'+locale} className="wordmark" aria-label="GFOS">GFOS</Link>
      <label className="sr-only" htmlFor="workspace">{t.workspace}</label><select id="workspace" className="workspace-select" value={entityId} onChange={e=>{setEntityId(e.target.value);setTab('overview');setActivityAccount('');setNotice('');setModal(null);}}>{entities.map(e=><option key={e.id} value={e.id}>{e.workspaceName}</option>)}</select>
      <nav aria-label={t.personal}>{nav.map(([id,Icon])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setActivityAccount('');}}><Icon size={20}/>{t[id]}</button>)}</nav>
      <div className="profile"><div className="avatar">L</div><span>{t.demoUser}<small>GFOS · 0.1</small></span></div>
    </aside>
    <main id="main" className="main" tabIndex={-1}>
      <div className="topline"><div>{t.personal}<span>/</span>{t[tab]}</div>{view?.entity.synthetic&&<div className="quality-note"><Info size={18}/>{t.synthetic}</div>}</div>
      <div className="page-heading"><div><h1>{tab==='overview'?t.title:tab==='reports'?t.reportTitle:t[tab]}</h1><p>{tab==='overview'?t.subtitle:tab==='reports'?t.reportHelp:view?.entity.workspaceName}</p></div>
        <div className="heading-actions"><details className="period-control"><summary>{periodLabel}</summary><form onSubmit={e=>{e.preventDefault();if(from>to){setError('Choose a valid date range.');return;}setPeriod({from,to});e.currentTarget.closest('details')?.removeAttribute('open');}}><label>{t.from}<input type="date" value={from} onChange={e=>setFrom(e.target.value)} required/></label><label>{t.to}<input type="date" value={to} onChange={e=>setTo(e.target.value)} required/></label><button className="primary" type="submit">{t.apply}</button></form></details>
        {owner&&<button className="primary" onClick={e=>open('entry',e)} disabled={!view.accounts.length}><Plus size={20}/>{t.record}</button>}</div>
      </div>
      {notice&&<div className="notice" role="status"><CircleCheck size={18}/><span>{notice}</span><button aria-label={t.close} onClick={()=>setNotice('')}><X size={18}/></button></div>}
      {error&&<div className="error" role="alert"><p>{error}</p><button className="secondary" onClick={reload}><RefreshCw size={16}/>{t.retry}</button></div>}
      {auth&&<div className="empty"><h2>{t.signIn}</h2><a className="primary" href="/auth/login">{t.signIn}</a></div>}
      {loading&&<div className="loading" role="status">{t.loading}<div className="skeleton"/></div>}
      {view&&!loading&&<>
        {tab==='overview'&&<>
          <section className="summary-grid" aria-label={t.overview}>{[[t.cash,view.cash],[t.income,view.income],[t.spending,view.spending]].map(([label,value])=><div key={label}><p>{label}</p><h2><bdi>{money(value ?? '0')}</bdi></h2></div>)}</section>
          <div className="overview-grid"><section className="panel cash-panel"><h2>{t.movement}</h2><p className="muted">{periodLabel} · <bdi>{view.entity.currency}</bdi></p>
            {chartData.some(d=>d.balance===null)?<p>{t.chartLimit}</p>:<div className="chart" dir="ltr" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} accessibilityLayer={false} margin={{top:14,right:18,bottom:4,left:6}}><CartesianGrid stroke="#e6ece9" vertical={true}/><XAxis dataKey="time" type="number" scale="time" domain={[Date.parse(view.from+'T00:00:00Z'),Date.parse(view.to+'T00:00:00Z')]} tickFormatter={d=>new Date(d).toISOString().slice(5,10)} tick={{fontSize:11,fill:'#54616b'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#54616b'}} axisLine={false} tickLine={false}/><Tooltip labelFormatter={v=>typeof v==="number"?new Date(v).toISOString().slice(0,10):""} formatter={(_v,_name,item)=>[money(item.payload.amount),t.cash]}/><Area type="stepAfter" dataKey="balance" stroke="#08754b" strokeWidth={2} fill="#e8f2ed" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>}
            <details className="chart-table"><summary>{t.overviewTable}</summary><div className="table-scroll"><table><thead><tr><th>{t.date}</th><th>{t.cash}</th></tr></thead><tbody>{view.cashSeries.map((r,i)=><tr key={i}><td><bdi>{r.date}</bdi></td><td><bdi>{money(r.balance)}</bdi></td></tr>)}</tbody></table></div></details>
          </section><section className="panel"><h2>{t.yourAccounts}</h2><AccountList/></section></div>
          <section className="panel activity-panel"><div className="section-heading"><h2>{t.recent}</h2><button className="text-button" onClick={()=>setTab('activity')}>{t.viewAll}<ArrowRight size={18}/></button></div><Activity limit={5}/></section>
        </>}
        {tab==='accounts'&&<section className="panel"><div className="section-heading"><h2>{t.yourAccounts}</h2></div><AccountList/><p className="muted">{t.negativeBalance}</p></section>}
        {tab==='activity'&&<section className="panel">{activityAccount&&<div className="section-heading"><h2>{view.accounts.find(a=>a.id===activityAccount)?.name}</h2><button className="text-button" onClick={()=>setActivityAccount('')}>{t.viewAll}</button></div>}<Activity/></section>}
        {tab==='reports'&&<><p className="muted scope-note">{t.reportUnavailable}</p><section className="panel"><div className="report-controls"><label>{t.reports}<select value={reportId} onChange={e=>setReportId(e.target.value as 'R-D02'|'R-D01')}><option value="R-D02">R-D02 · {t.balances}</option><option value="R-D01">R-D01 · {t.cashFlow}</option></select></label><button className="primary" disabled={busy} onClick={generate}>{busy?t.reportLoading:t.generate}</button></div>
          {snapshot&&<div className="snapshot"><div className="section-heading"><h2>{t.snapshot} · <bdi>{snapshot.reportId}</bdi></h2><div className="export-actions"><a className="secondary" href={'/api/reports/'+snapshot.id+'?format=csv'}>{t.exportCsv}</a><a className="text-button" href={'/api/reports/'+snapshot.id+'?format=json'}>{t.downloadJson}</a></div></div>
          <p><bdi>{snapshot.from} — {snapshot.to}</bdi> · <bdi>{snapshot.currency}</bdi> · {t.recorded}</p>
          <div className="table-scroll"><table><caption className="sr-only">{snapshot.reportId}</caption><thead><tr>{snapshot.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{snapshot.rows.map((row,i)=><tr key={i}>{row.map((cell,k)=><td key={k}><bdi>{cell}</bdi></td>)}</tr>)}</tbody></table></div>
          <dl className="totals">{Object.entries(snapshot.totals).map(([k,v])=><div key={k}><dt>{({openingCash:t.openingCash,netMovement:t.netMovement,closingCash:t.closingCash,cash:t.cash})[k] ?? k}</dt><dd><bdi>{money(v)}</bdi></dd></div>)}</dl>
          <details><summary>{t.viewEvidence}</summary><p>{snapshot.methodology}</p><p>{t.checksum}: <code>{snapshot.checksum}</code></p><ul>{snapshot.sourceJournalIds.map(id=><li key={id}><code>{id}</code></li>)}</ul></details>
          </div>}
        </section></>}
        {tab==='settings'&&<section className="panel settings-panel"><h2>{t.language}</h2><div className="language-links"><Link className={locale==='en'?'primary':'secondary'} href={languageHref('en','settings')}>English</Link><Link className={locale==='fa'?'primary':'secondary'} href={languageHref('fa','settings')}>فارسی</Link></div><p className="muted">{t.languageReview}</p><dl><dt>{t.bookCurrency}</dt><dd><bdi>{view.entity.currency}</bdi></dd><dt>{t.bookVersion}</dt><dd>{view.entity.version}</dd><dt>{t.quality}</dt><dd>{t.qualityHelp}</dd></dl></section>}
        <footer><Info size={15}/><p>{t.qualityHelp} <span>{t.netReceipt}</span></p><Link href={languageHref(locale==='en'?'fa':'en')}>{locale==='en'?'فارسی':'English'}</Link></footer>
      </>}
    </main>
    <dialog ref={dialog} onCancel={e=>{e.preventDefault();close();}} aria-labelledby="dialog-title">
      <div className="dialog-heading"><h2 id="dialog-title">{modal==='recovery'?t.retryPost:modal==='account'?t.newAccount:modal==='detail'?t.detail:preview?t.reviewTitle:t.record}</h2><button className="icon-button" aria-label={t.close} onClick={close} disabled={busy||uncertain}><X size={20}/></button></div>
      {formError&&<div className="error" role="alert">{formError}{formError===t.stale&&<button type="button" onClick={()=>{setModal(null);reload();}}>{t.refresh}</button>}</div>}
      {modal==='recovery'&&recoveredAction&&<div><h3>{recoveredAction.operation==='account'?t.newAccount:t.reverse}</h3>{recoveredAction.operation==='account'?<dl className="detail-meta"><dt>{t.name}</dt><dd>{recoveredAction.command.name}</dd><dt>{t.opening}</dt><dd><bdi>{money(recoveredAction.command.openingAmount)}</bdi></dd><dt>{t.openingDate}</dt><dd><bdi>{recoveredAction.command.openedOn}</bdi></dd></dl>:<dl className="detail-meta"><dt>{t.reason}</dt><dd>{recoveredAction.command.reason}</dd><dt>{t.date}</dt><dd><bdi>{recoveredAction.command.effectiveDate}</bdi></dd><dt>{t.journal}</dt><dd><code>{recoveredAction.journalId}</code></dd></dl>}<p className="review-notice">{t.postingNotice}</p><div className="dialog-actions"><button className="primary" disabled={busy} onClick={retryRecovered}>{t.retryPost}</button></div></div>}
      {modal==='entry'&&(!preview?<form onSubmit={requestPreview} className="entry-form"><label>{t.type}<select value={kind} onChange={e=>setKind(e.target.value as FinancialCommand['kind'])}><option value="expense">{t.expense}</option><option value="income">{t.incomeEvent}</option><option value="transfer">{t.transfer}</option><option value="borrowing">{t.borrowing}</option><option value="card_payment">{t.card_payment}</option></select></label><div className="form-grid"><label>{t.amount} · <bdi>{view?.entity.currency}</bdi><input aria-label={t.amount+' · '+view?.entity.currency} aria-describedby="amount-help" value={rawAmount} onChange={e=>setRawAmount(e.target.value)} inputMode="decimal" dir="auto" required autoFocus/><small id="amount-help">{t.amountsHelp}</small></label><label>{t.effectiveDate}<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label></div><label>{t.description}<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={160} required/></label>
        <label>{t.sourceAccount}<select value={accountId} onChange={e=>setAccountId(e.target.value)} required><option value="">{t.noSelection}</option>{view?.accounts.filter(a=>kind==='expense'?['bank','cash','card'].includes(a.kind):['bank','cash'].includes(a.kind)).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
        {['transfer','borrowing','card_payment'].includes(kind)&&<label>{t.otherAccount}<select value={otherId} onChange={e=>setOtherId(e.target.value)} required><option value="">{t.noSelection}</option>{view?.accounts.filter(a=>kind==='borrowing'?a.kind==='loan':kind==='card_payment'?a.kind==='card':['bank','cash'].includes(a.kind)&&a.id!==accountId).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>}
        <div className="dialog-actions"><button className="secondary" type="button" onClick={close}>{t.cancel}</button><button className="primary" type="submit" disabled={busy}>{t.review}</button></div>
      </form>:<div><p>{pending?.command.description}</p><div className="review-total"><bdi>{money(pending?.command.amount ?? '0')}</bdi><span><bdi>{pending?.command.effectiveDate}</bdi> · {typeName(pending?.command.kind ?? '')}</span></div><h3>{t.journal}</h3><table><thead><tr><th>{t.accounts}</th><th>{t.debit}</th><th>{t.credit}</th></tr></thead><tbody>{preview.lines.map((l,i)=><tr key={i}><td>{accountingName(l.accountName)}</td><td><bdi>{l.side==='debit'?money(l.amount):'—'}</bdi></td><td><bdi>{l.side==='credit'?money(l.amount):'—'}</bdi></td></tr>)}</tbody></table><p className="review-notice">{t.postingNotice}</p><div className="dialog-actions">{!uncertain&&<button className="secondary" disabled={busy} onClick={()=>{setPreview(null);setPending(null);}}>{t.back}</button>}<button className="primary" disabled={busy} onClick={post}>{uncertain?t.retryPost:t.post}</button></div></div>)}
      {modal==='account'&&<form onSubmit={saveAccount} className="entry-form"><p className="muted">{t.accountHelp}</p><label>{t.name}<input value={accountName} onChange={e=>setAccountName(e.target.value)} required maxLength={80} disabled={uncertain} autoFocus/></label><label>{t.kind}<select value={accountKind} onChange={e=>setAccountKind(e.target.value as typeof accountKind)} disabled={uncertain}><option value="bank">{t.bank}</option><option value="cash">{t.cashAccount}</option><option value="card">{t.card}</option><option value="loan">{t.loan}</option></select></label><div className="form-grid"><label>{t.opening}<input value={opening} onChange={e=>setOpening(e.target.value)} inputMode="decimal" disabled={uncertain} required/></label><label>{t.openingDate}<input type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={uncertain} required/></label></div><p className="review-notice">{t.postingNotice}</p><div className="dialog-actions"><button className="secondary" type="button" onClick={close} disabled={uncertain}>{t.cancel}</button><button type="submit" className="primary" disabled={busy}>{uncertain?t.retryPost:t.saveAccount}</button></div></form>}
      {modal==='detail'&&selected&&<div><h3>{selected.description}</h3><dl className="detail-meta"><dt>{t.date}</dt><dd><bdi>{selected.effectiveDate}</bdi></dd><dt>{t.recordedAt}</dt><dd><bdi>{selected.recordedAt}</bdi></dd><dt>{t.amount}</dt><dd><bdi>{money(selected.amount,selected.currency)}</bdi></dd></dl><code className="journal-id">{selected.id}</code><table><thead><tr><th>{t.accounts}</th><th>{t.debit}</th><th>{t.credit}</th></tr></thead><tbody>{selected.lines.map((l,i)=><tr key={i}><td>{accountingName(l.accountName)}</td><td><bdi>{l.side==='debit'?money(l.amount):'—'}</bdi></td><td><bdi>{l.side==='credit'?money(l.amount):'—'}</bdi></td></tr>)}</tbody></table>{selected.reversalOf&&<p>{t.reversal}: <code>{selected.reversalOf}</code></p>}{selected.reversedBy&&<p>{t.reversed}: <code>{selected.reversedBy}</code></p>}
        {owner&&!selected.reversedBy&&selected.kind!=='reversal'&&<form className="reversal-form" onSubmit={reverse}><h3>{t.reverse}</h3><label>{t.reason}<input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={160} required disabled={uncertain}/></label><label>{t.effectiveDate}<input type="date" value={date} min={selected.effectiveDate} onChange={e=>setDate(e.target.value)} required disabled={uncertain}/></label><p>{t.postingNotice}</p><button className="danger" type="submit" disabled={busy}>{uncertain?t.retryPost:t.confirmReverse}</button></form>}
      </div>}
    </dialog>
  </div>;
}

