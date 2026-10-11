import { z } from 'zod';
export const CurrencySchema = z.enum(['EUR','USD','GBP','TRY','INR','IRR','JPY','BHD']);
export const CivilDate = z.string().regex(/^(?!0000)\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}, 'Use a real ISO calendar date.');
export const AmountSchema = z.string().regex(/^-?(0|[1-9]\d{0,25})(\.\d{1,12})?$/);
export const CalculatedAmountSchema=z.string().regex(/^-?(0|[1-9]\d{0,37})(\.\d{1,12})?$/);
export const CommandSchema = z.object({
  entityId: z.uuid(),
  expectedVersion: z.int().nonnegative(),
  kind: z.enum(['income','expense','transfer','borrowing','card_payment']),
  amount: AmountSchema,
  currency: CurrencySchema,
  effectiveDate: CivilDate,
  description: z.string().trim().min(1).max(160),
  accountId: z.uuid(),
  otherAccountId: z.uuid().optional(),
  sourceReference: z.string().min(1).max(160).optional(),
}).strict();
export type FinancialCommand = z.infer<typeof CommandSchema>;
export const AccountSchema = z.object({
  entityId: z.uuid(), expectedVersion: z.int().nonnegative(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['bank','cash','card','loan']),
  openingAmount: AmountSchema, openedOn: CivilDate,
}).strict();
export type CreateAccount = z.infer<typeof AccountSchema>;
export const ReverseSchema = z.object({
  entityId: z.uuid(), expectedVersion: z.int().nonnegative(), effectiveDate: CivilDate,
  reason: z.string().trim().min(3).max(160),
}).strict();
export type ReverseCommand=z.infer<typeof ReverseSchema>;
export const OperationDraftSchema=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('account'),command:AccountSchema}).strict(),
  z.object({operation:z.literal('reverse'),journalId:z.uuid(),command:ReverseSchema}).strict(),
]);
export type OperationDraft=z.infer<typeof OperationDraftSchema>;
export const ReportRequestSchema = z.object({
  entityId: z.uuid(), reportId: z.enum(['R-D02','R-D01']),
  from: CivilDate, to: CivilDate,
}).strict().refine(v => v.from <= v.to, 'The end date must follow the start date.');
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export interface Actor { id: string; issuer: string; subject: string }
export interface EntityView { id: string; workspaceId: string; name: string; workspaceName: string; currency: z.infer<typeof CurrencySchema>; version: number; synthetic: boolean; role: 'owner'|'viewer' }
export interface AccountView { id: string; name: string; kind: string; currency: string; balance: string; openedOn: string }
export interface PostingView { accountId: string; accountName: string; side: 'debit'|'credit'; amount: string; currency: string }
export interface JournalView { id: string; effectiveDate: string; recordedAt: string; kind: string; description: string; amount: string; currency: string; reversalOf: string|null; reversedBy: string|null; lines: PostingView[] }
export interface Overview {
  entity: EntityView; accounts: AccountView[]; journals: JournalView[];
  from: string; to: string; cash: string; income: string; spending: string;
  cashSeries: {date:string;balance:string}[];
  quality: { origin:'entered'; reconciliation:'unreconciled'; basis:'net-receipt'; completeness:'user-recorded-book-only' };
}
export interface CommandResult { journalId: string|null; accountId?: string; entityVersion: number; projectionStatus: 'authoritative'; replayed?: boolean }
export interface ReportSnapshot {
  id:string; reportId:string; definitionVersion:string; entityId:string; currency:string;
  from:string; to:string; generatedAt:string; dataCutoff:string; sourceJournalIds:string[];
  columns:string[]; rows:string[][]; totals:Record<string,string>; checksum:string;
  quality:Overview['quality']; methodology:string; actorId:string;
}
export const EntityViewSchema = z.object({id:z.uuid(),workspaceId:z.uuid(),name:z.string(),workspaceName:z.string(),currency:CurrencySchema,version:z.int().nonnegative(),synthetic:z.boolean(),role:z.enum(['owner','viewer'])});
export const PostingViewSchema = z.object({accountId:z.uuid(),accountName:z.string(),side:z.enum(['debit','credit']),amount:AmountSchema,currency:CurrencySchema});
export const JournalViewSchema = z.object({id:z.uuid(),effectiveDate:CivilDate,recordedAt:z.string(),kind:z.string(),description:z.string(),amount:AmountSchema,currency:CurrencySchema,reversalOf:z.uuid().nullable(),reversedBy:z.uuid().nullable(),lines:z.array(PostingViewSchema)});
export const QualitySchema = z.object({origin:z.literal('entered'),reconciliation:z.literal('unreconciled'),basis:z.literal('net-receipt'),completeness:z.literal('user-recorded-book-only')});
export const OverviewSchema = z.object({entity:EntityViewSchema,accounts:z.array(z.object({id:z.uuid(),name:z.string(),kind:z.string(),currency:CurrencySchema,balance:CalculatedAmountSchema,openedOn:CivilDate})),journals:z.array(JournalViewSchema),from:CivilDate,to:CivilDate,cash:CalculatedAmountSchema,income:CalculatedAmountSchema,spending:CalculatedAmountSchema,cashSeries:z.array(z.object({date:CivilDate,balance:CalculatedAmountSchema})),quality:QualitySchema});
export const CommandResultSchema = z.object({journalId:z.uuid().nullable(),accountId:z.uuid().optional(),entityVersion:z.int().nonnegative(),projectionStatus:z.literal('authoritative'),replayed:z.boolean().optional()});
export const PreviewSchema = z.object({draftKey:z.uuid(),lines:z.array(z.object({accountName:z.string(),side:z.enum(['debit','credit']),amount:AmountSchema})),currentVersion:z.int().nonnegative()});
export const RecoverySchema = z.union([
  z.object({state:z.literal('committed'),operation:z.enum(['post','account','reverse']),receipt:CommandResultSchema}),
  z.object({state:z.literal('draft'),operation:z.literal('post'),command:CommandSchema,preview:PreviewSchema}),
  z.object({state:z.literal('draft'),operation:z.literal('account'),command:AccountSchema}),
  z.object({state:z.literal('draft'),operation:z.literal('reverse'),journalId:z.uuid(),command:ReverseSchema}),
]);
export const ReportSnapshotSchema = z.object({id:z.uuid(),reportId:z.enum(['R-D01','R-D02']),definitionVersion:z.string(),entityId:z.uuid(),currency:CurrencySchema,from:CivilDate,to:CivilDate,generatedAt:z.iso.datetime(),dataCutoff:z.iso.datetime(),sourceJournalIds:z.array(z.uuid()),columns:z.array(z.string()),rows:z.array(z.array(z.string())),totals:z.record(z.string(),CalculatedAmountSchema),checksum:z.string().regex(/^[a-f0-9]{64}$/),quality:QualitySchema,methodology:z.string(),actorId:z.uuid()}).strict();

