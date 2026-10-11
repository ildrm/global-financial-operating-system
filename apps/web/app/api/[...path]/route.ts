import { NextRequest,NextResponse } from 'next/server';
import { ReportSnapshotSchema } from '@gfos/contracts';
import { accessToken, origin } from '../../../lib/session';
export const dynamic='force-dynamic';
const allowed=/^(entities|overview|accounts|operations\/draft|operations\/[0-9a-f-]{36}|transactions|transactions\/preview|journals\/[0-9a-f-]{36}\/reverse|reports|reports\/[0-9a-f-]{36})$/;
function cell(value:string){
  const safe=/^[=+@\-\t\r]/.test(value)?"'"+value:value;
  return '"'+safe.replace(/"/g,'""')+'"';
}
async function handle(request:NextRequest,context:{params:Promise<{path:string[]}>}){
  const {path}=await context.params;const route=path.join('/');
  if(!allowed.test(route))return NextResponse.json({code:'NOT_FOUND'},{status:404});
  if(request.method==='POST' && request.headers.get('origin')!==origin())return NextResponse.json({code:'ORIGIN_DENIED'},{status:403});
  const token=await accessToken();if(!token)return NextResponse.json({code:'AUTHENTICATION_REQUIRED',detail:'Please sign in.'},{status:401});
  const headers:Record<string,string>={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const idempotency=request.headers.get('idempotency-key');if(idempotency)headers['Idempotency-Key']=idempotency;
  const search=new URLSearchParams(request.nextUrl.searchParams);const format=search.get('format');search.delete('format');
  try {
    const response=await fetch((process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000')+'/api/v1/'+route+(search.size?'?'+search:''),{method:request.method,headers,cache:'no-store',...(request.method==='POST'?{body:await request.text()}:{}),signal:AbortSignal.timeout(15000)});
    const body=await response.text();
    if(response.ok && format && route.startsWith('reports/')){
      const snapshot=ReportSnapshotSchema.parse(JSON.parse(body));
      if(format==='csv'){
        const csv='\uFEFF'+[snapshot.columns,...snapshot.rows,['Methodology',snapshot.methodology],['Checksum',snapshot.checksum]].map(row=>row.map(cell).join(',')).join('\r\n');
        return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="'+snapshot.reportId+'-'+snapshot.id+'.csv"','Cache-Control':'private, no-store'}});
      }
      if(format==='json')return new NextResponse(body,{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="gfos-evidence.json"','Cache-Control':'private, no-store'}});
    }
    return new NextResponse(body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({code:'UPSTREAM_UNAVAILABLE',detail:'The API could not be reached. Retry a financial operation with the same key.'},{status:503});}
}
export const GET=handle;export const POST=handle;

