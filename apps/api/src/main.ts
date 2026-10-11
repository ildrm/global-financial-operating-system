import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Post, Body, Param, Query, Headers, Req, Inject, Injectable, CanActivate, ExecutionContext, UseGuards, UnauthorizedException, Catch, ArgumentsHost, ExceptionFilter, HttpException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { z, ZodError } from 'zod';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { createPool } from '@gfos/database';
import { PostgresLedger } from '@gfos/ledger';
import { FinancialError } from '@gfos/financial-math';
import { CommandSchema, AccountSchema, ReverseSchema, OperationDraftSchema, ReportRequestSchema, CivilDate, OverviewSchema, EntityViewSchema, PreviewSchema, RecoverySchema, CommandResultSchema, ReportSnapshotSchema } from '@gfos/contracts';
import type { Actor } from '@gfos/contracts';
import type pg from 'pg';
const POOL='DATABASE';const LEDGER='LEDGER';
interface AuthenticatedRequest { headers:Record<string,string|undefined>; actor:Actor }
@Injectable()
class IdentityGuard implements CanActivate {
  private keys;
  constructor(@Inject(POOL) private pool:pg.Pool) {
    if(process.env.OIDC_JWKS_URL) this.keys=createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URL));
    if(process.env.NODE_ENV==='production' && (!this.keys || !process.env.OIDC_ISSUER || !process.env.OIDC_AUDIENCE || process.env.GFOS_DEMO==='true')) {
      throw new Error('Production requires OIDC configuration and forbids the synthetic demo.');
    }
    if(process.env.GFOS_DEMO==='true' && !process.env.DEMO_API_TOKEN) throw new Error('Synthetic mode requires a server-only DEMO_API_TOKEN.');
  }
  async canActivate(context:ExecutionContext):Promise<boolean> {
    const request=context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token=request.headers['authorization']?.replace(/^Bearer /,'');
    if(!token) throw new UnauthorizedException('Authentication required.');
    let issuer:string;let subject:string;
    const secret=process.env.DEMO_API_TOKEN;
    const isDemo=process.env.NODE_ENV!=='production' && process.env.GFOS_DEMO==='true' && secret &&
      Buffer.byteLength(token)===Buffer.byteLength(secret) && timingSafeEqual(Buffer.from(token),Buffer.from(secret));
    if(isDemo) {issuer='gfos:synthetic';subject='local-owner';}
    else {
      if(!this.keys || !process.env.OIDC_ISSUER || !process.env.OIDC_AUDIENCE) throw new UnauthorizedException('Authentication required.');
      try {
        const {payload}=await jwtVerify(token,this.keys,{issuer:process.env.OIDC_ISSUER,audience:process.env.OIDC_AUDIENCE,algorithms:['RS256','ES256']});
        if(!payload.sub || !payload.iss) throw new Error('Missing identity.');
        issuer=payload.iss;subject=payload.sub;
      } catch {throw new UnauthorizedException('The session is invalid or expired.');}
    }
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1,$2,true),set_config($3,$4,true)',['app.issuer',issuer,'app.subject',subject]);
      const result=await client.query<{id:string}>('SELECT id FROM identity.principals WHERE issuer=$1 AND subject=$2',[issuer,subject]);
      if(!result.rows[0]) throw new UnauthorizedException('This identity has no provisioned GFOS account.');
      request.actor={id:result.rows[0].id,issuer,subject};
      await client.query('SELECT set_config($1,$2,true)',['app.actor_id',request.actor.id]);
      if(isDemo && (await client.query('SELECT id FROM workspace.workspaces WHERE NOT synthetic LIMIT 1')).rowCount) {
        throw new UnauthorizedException('The synthetic identity cannot access real workspaces.');
      }
      await client.query('COMMIT');
    } catch(error) {await client.query('ROLLBACK');throw error;}
    finally {client.release();}
    return true;
  }
}
@Catch()
class ProblemFilter implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost):void {
    let status=500;let code='INTERNAL_ERROR';let detail='The request failed. Your inputs have been preserved.';
    if(error instanceof ZodError) {status=400;code='INVALID_INPUT';detail=error.issues.map(i=>i.path.join('.')+': '+i.message).join('; ');}
    else if(error instanceof FinancialError) {
      code=error.code;detail=error.message;
      status=code==='ACCESS_DENIED'?404:code.includes('CONFLICT')?409:422;
    } else if(error instanceof HttpException) {status=error.getStatus();code=status===401?'AUTHENTICATION_REQUIRED':'REQUEST_REJECTED';detail=error.message;}
    else if(error && typeof error==='object' && 'code' in error) {
      const dbcode=String(error.code);
      if(dbcode==='23505') {status=409;code='DUPLICATE_FINANCIAL_EFFECT';detail='This source or reversal has already been recorded.';}
      else if(dbcode==='23514') {status=422;code='FINANCIAL_CONSTRAINT';detail='The posting violates a financial constraint or a closed period.';}
      else if(dbcode==='40001' || dbcode==='40P01') {status=409;code='CONCURRENT_CHANGE';detail='The book changed concurrently. Retry the same operation key.';}
    }
    const response=host.switchToHttp().getResponse<{status:(n:number)=>{json:(v:unknown)=>void}}>();
    response.status(status).json({type:'about:blank',title:code,status,detail,code});
  }
}
@Controller('api/v1')
@UseGuards(IdentityGuard)
@ApiBearerAuth()
class FinanceController {
  constructor(@Inject(LEDGER) private ledger:PostgresLedger) {}
  @Get('entities')
  @ApiOperation({operationId:'listEntities'})
  @ApiOkResponse({schema:{type:'array',items:{$ref:'#/components/schemas/Entity'}}})
  entities(@Req() r:AuthenticatedRequest) {return this.ledger.entities(r.actor);}
  @Get('overview') overview(@Req() r:AuthenticatedRequest,@Query() raw:unknown) {
    const q=z.object({entityId:z.uuid(),from:CivilDate,to:CivilDate}).strict().refine(v=>v.from<=v.to).parse(raw);
    return this.ledger.overview(r.actor,q.entityId,q.from,q.to);
  }
  @Post('transactions/preview') preview(@Req() r:AuthenticatedRequest,@Body() raw:unknown) {
    return this.ledger.preview(r.actor,CommandSchema.parse(raw));
  }
  @Get('operations/:key') recover(@Req() r:AuthenticatedRequest,@Param('key') key:string,@Query('entityId') entityId:string) {
    return this.ledger.recover(r.actor,z.uuid().parse(key),z.uuid().parse(entityId));
  }
  @Post('operations/draft') prepare(@Req() r:AuthenticatedRequest,@Body() raw:unknown){return this.ledger.prepareOperation(r.actor,OperationDraftSchema.parse(raw));}
  @Post('transactions') post(@Req() r:AuthenticatedRequest,@Headers('idempotency-key') key:unknown,@Body() raw:unknown) {
    return this.ledger.postReviewed(r.actor,z.uuid().parse(key),CommandSchema.parse(raw));
  }
  @Post('accounts') account(@Req() r:AuthenticatedRequest,@Headers('idempotency-key') key:unknown,@Body() raw:unknown) {
    return this.ledger.executeOperation(r.actor,z.uuid().parse(key),{operation:'account',command:AccountSchema.parse(raw)});
  }
  @Post('journals/:id/reverse') reverse(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Headers('idempotency-key') key:unknown,@Body() raw:unknown) {
    return this.ledger.executeOperation(r.actor,z.uuid().parse(key),{operation:'reverse',journalId:z.uuid().parse(id),command:ReverseSchema.parse(raw)});
  }
  @Post('reports') report(@Req() r:AuthenticatedRequest,@Body() raw:unknown) {return this.ledger.generateReport(r.actor,ReportRequestSchema.parse(raw));}
  @Get('reports/:id') snapshot(@Req() r:AuthenticatedRequest,@Param('id') id:string) {return this.ledger.snapshot(r.actor,z.uuid().parse(id));}
}
@Controller()
class HealthController {
  constructor(@Inject(POOL) private pool:pg.Pool) {}
  @Get('health') async health() {await this.pool.query('SELECT 1');return {status:'ready',version:'0.1.0'};}
}
@Module({
  controllers:[FinanceController,HealthController],
  providers:[IdentityGuard,{provide:POOL,useFactory:()=>createPool()},{provide:LEDGER,useFactory:(pool:pg.Pool)=>new PostgresLedger(pool),inject:[POOL]}],
})
class AppModule {}
const app=await NestFactory.create(AppModule,{logger:['error','warn']});
app.useGlobalFilters(new ProblemFilter());
app.use((req:{method:string},res:{setHeader:(key:string,value:string)=>void},next:()=>void)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');next();
});
const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('GFOS financial kernel').setVersion('0.1.0').addBearerAuth().build());
document.components ??= {};
const schemas={FinancialCommand:CommandSchema,AccountCommand:AccountSchema,ReverseCommand:ReverseSchema,OperationDraft:OperationDraftSchema,DraftKey:z.object({draftKey:z.uuid()}),ReportRequest:ReportRequestSchema,Entity:EntityViewSchema,Overview:OverviewSchema,Preview:PreviewSchema,Recovery:RecoverySchema,CommandResult:CommandResultSchema,ReportSnapshot:ReportSnapshotSchema};
// Zod emits OpenAPI 3.0 schemas; its broader JSON-schema type also permits
// constructs excluded by the Swagger TS interface. Runtime target is explicit.
document.components.schemas={...document.components.schemas,...Object.fromEntries(Object.entries(schemas).map(([name,schema])=>[name,z.toJSONSchema(schema,{target:'openapi-3.0'}) as unknown as NonNullable<typeof document.components.schemas>[string]]))};
const contracts=[
 ['get','/api/v1/overview','getOverview',null,'Overview',200],
 ['post','/api/v1/transactions/preview','previewTransaction','FinancialCommand','Preview',201],
 ['get','/api/v1/operations/{key}','recoverOperation',null,'Recovery',200],
 ['post','/api/v1/operations/draft','prepareOperation','OperationDraft','DraftKey',201],
 ['post','/api/v1/transactions','postReviewedTransaction','FinancialCommand','CommandResult',201],
 ['post','/api/v1/accounts','createAccount','AccountCommand','CommandResult',201],
 ['post','/api/v1/journals/{id}/reverse','reverseJournal','ReverseCommand','CommandResult',201],
 ['post','/api/v1/reports','generateReport','ReportRequest','ReportSnapshot',201],
 ['get','/api/v1/reports/{id}','getReportSnapshot',null,'ReportSnapshot',200],
] as const;
for(const [method,path,operationId,request,response,status] of contracts){
 const operation=document.paths[path]?.[method];if(!operation)throw new Error('OpenAPI route missing: '+path);
 operation.operationId=operationId;
 operation.responses[String(status)]={description:'Validated financial result',content:{'application/json':{schema:{$ref:'#/components/schemas/'+response}}}};
 if(request)operation.requestBody={required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+request}}}};
 if(['postReviewedTransaction','createAccount','reverseJournal'].includes(operationId))operation.parameters=[...(operation.parameters??[]),{in:'header',name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'},description:'Scoped stable key; retry exact inputs after an uncertain response.'}];
 const queries=operationId==='getOverview'?['entityId','from','to']:operationId==='recoverOperation'?['entityId']:[];
 for(const name of queries)operation.parameters=[...(operation.parameters??[]).filter(p=>!('name' in p&&p.name===name)),{in:'query',name,required:true,schema:{type:'string',format:name==='entityId'?'uuid':'date'}}];
 for(const error of [400,401,404,409,422,500])operation.responses[String(error)]={description:'Problem document: code, detail and status. No financial partial commit.'};
}
SwaggerModule.setup('api/docs',app,document);
const port=parseInt(process.env.API_PORT ?? '4000',10);
await app.listen(port,process.env.API_HOST ?? '127.0.0.1');
console.log('GFOS API ready on port '+port);
const stop=async()=>{await app.close();process.exit(0);};
process.on('SIGTERM',stop);process.on('SIGINT',stop);

