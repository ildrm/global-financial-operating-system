import { Exact, positiveMoney, FinancialError } from '@gfos/financial-math';
import type { Currency } from '@gfos/financial-math';
import type { FinancialCommand } from '@gfos/contracts';
export interface Account { id:string; kind:string; currency:Currency; openedOn:string }
export interface Posting { accountId:string; side:'debit'|'credit'; amount:string }
export interface SystemAccounts { income:string; expense:string; equity:string }
export function assertBalanced(lines: readonly Posting[]): void {
  if (lines.length < 2) throw new FinancialError('UNBALANCED_JOURNAL','At least two postings are required.');
  const net = lines.reduce((sum,line) => {
    const amount = new Exact(line.amount);
    if (!amount.isFinite() || !amount.gt(0)) throw new FinancialError('INVALID_POSTING','Posting amounts must be positive and finite.');
    return line.side === 'debit' ? sum.plus(amount) : sum.minus(amount);
  },new Exact(0));
  if (!net.isZero()) throw new FinancialError('UNBALANCED_JOURNAL','Debits and credits must balance exactly.');
}
export function buildPostings(command:FinancialCommand, account:Account, other:Account|undefined, system:SystemAccounts): Posting[] {
  const amount=positiveMoney(command.amount,command.currency).amount;
  if(account.currency!==command.currency || (other && other.currency!==command.currency))
    throw new FinancialError('FX_EVIDENCE_REQUIRED','This slice supports the book currency; an exchange requires sourced FX evidence.');
  if(account.openedOn > command.effectiveDate || (other && other.openedOn > command.effectiveDate))
    throw new FinancialError('ACCOUNT_NOT_OPEN','The account was not open on this date.');
  const cash = (a:Account) => ['bank','cash'].includes(a.kind);
  const dr=(id:string):Posting=>({accountId:id,side:'debit',amount});
  const cr=(id:string):Posting=>({accountId:id,side:'credit',amount});
  switch(command.kind) {
    case 'income':
      if(!cash(account)) throw new FinancialError('INVALID_ACCOUNT','Income receipts require a bank or cash account.');
      return [dr(account.id),cr(system.income)];
    case 'expense':
      if(!cash(account) && account.kind!=='card') throw new FinancialError('INVALID_ACCOUNT','Spending requires cash, bank, or card.');
      return [dr(system.expense),cr(account.id)];
    case 'transfer':
      if(!other || !cash(account) || !cash(other) || other.id===account.id) throw new FinancialError('INVALID_TRANSFER','Choose two different cash or bank accounts.');
      return [dr(other.id),cr(account.id)];
    case 'borrowing':
      if(!other || !cash(account) || other.kind!=='loan') throw new FinancialError('INVALID_ACCOUNT','Borrowing needs a receiving cash account and a loan liability.');
      return [dr(account.id),cr(other.id)];
    case 'card_payment':
      if(!other || !cash(account) || other.kind!=='card') throw new FinancialError('INVALID_ACCOUNT','Record settlement from a cash account to a card liability.');
      return [dr(other.id),cr(account.id)];
  }
}
export function openingPostings(account:Account, opening:string, system:SystemAccounts): Posting[] {
  const value=new Exact(opening);
  if(value.isZero()) return [];
  const debitNormal=['bank','cash'].includes(account.kind);
  const side = value.gt(0) === debitNormal ? 'debit' : 'credit';
  const opposite=side==='debit'?'credit':'debit';
  return [{accountId:account.id,side,amount:value.abs().toFixed()},{accountId:system.equity,side:opposite,amount:value.abs().toFixed()}];
}

