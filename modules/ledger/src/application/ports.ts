import type { Actor, EntityView, Overview, FinancialCommand, CreateAccount, CommandResult, ReportRequest, ReportSnapshot } from '@gfos/contracts';
export interface LedgerPort {
  entities(actor:Actor):Promise<EntityView[]>;
  overview(actor:Actor,entityId:string,from:string,to:string):Promise<Overview>;
  post(actor:Actor,key:string,command:FinancialCommand):Promise<CommandResult>;
  createAccount(actor:Actor,key:string,command:CreateAccount):Promise<CommandResult>;
  reverse(actor:Actor,key:string,id:string,command:{entityId:string;expectedVersion:number;effectiveDate:string;reason:string}):Promise<CommandResult>;
  generateReport(actor:Actor,request:ReportRequest):Promise<ReportSnapshot>;
  snapshot(actor:Actor,id:string):Promise<ReportSnapshot>;
}

