import Decimal from 'decimal.js';

export const Exact = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN });
export const currencyScales = { EUR: 2, USD: 2, GBP: 2, TRY: 2, INR: 2, IRR: 2, JPY: 0, BHD: 3 } as const;
export type Currency = keyof typeof currencyScales;
export interface Money { readonly amount: string; readonly currency: Currency }
export class FinancialError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'FinancialError'; }
}
export function decimal(value: string): Decimal {
  if (!/^-?(0|[1-9]\d{0,25})(\.\d{1,12})?$/.test(value)) {
    throw new FinancialError('INVALID_DECIMAL_FORMAT', 'Use a finite canonical decimal within 26 integer and 12 fractional digits.');
  }
  return new Exact(value);
}
export function money(amount: string, currency: Currency): Money {
  if(!Object.hasOwn(currencyScales,currency))throw new FinancialError('UNSUPPORTED_CURRENCY','This currency is not in the current accounting registry.');
  const value = decimal(amount);
  if (value.decimalPlaces() > currencyScales[currency]) {
    throw new FinancialError('UNSUPPORTED_PRECISION', 'The amount exceeds this currency’s accounting scale.');
  }
  return { amount: value.toFixed(currencyScales[currency]), currency };
}
export function positiveMoney(amount: string, currency: Currency): Money {
  const result = money(amount, currency);
  if (!new Exact(result.amount).gt(0)) throw new FinancialError('POSITIVE_AMOUNT_REQUIRED', 'Enter an amount greater than zero.');
  return result;
}
export function calculatedMoney(amount:string,currency:Currency):Money {
  if(!Object.hasOwn(currencyScales,currency))throw new FinancialError('UNSUPPORTED_CURRENCY','This currency is not in the current accounting registry.');
  if(!/^-?(0|[1-9]\d{0,37})(\.\d{1,12})?$/.test(amount))throw new FinancialError('RESULT_RANGE','The calculated result exceeds the supported 38-integer-digit range.');
  const value=new Exact(amount);
  if(value.decimalPlaces()>currencyScales[currency])throw new FinancialError('UNSUPPORTED_PRECISION','The result exceeds the currency accounting scale.');
  return {amount:value.toFixed(currencyScales[currency]),currency};
}
export function total(values: readonly string[]): string {
  return values.reduce((sum, value) => sum.plus(decimal(value)), new Exact(0)).toFixed();
}
export function allocateMinorUnits(amount: Money, weights: readonly string[]): readonly string[] {
  const validated=money(amount.amount,amount.currency);
  const parsed = weights.map(decimal);
  if (parsed.length === 0 || parsed.some(w => w.lt(0))) throw new FinancialError('INVALID_ALLOCATION', 'Nonnegative weights are required.');
  const sum = parsed.reduce((a, b) => a.plus(b), new Exact(0));
  if (sum.isZero()) throw new FinancialError('ZERO_DENOMINATOR', 'Weights must total more than zero.');
  const factor = new Exact(10).pow(currencyScales[amount.currency]);
  const units = new Exact(validated.amount).abs().times(factor);
  const raw = parsed.map(w => units.times(w).div(sum));
  const whole = raw.map(w => w.floor());
  let residual = units.minus(whole.reduce((sum,value)=>sum.plus(value),new Exact(0)));
  const order = raw.map((w, i) => ({i, remainder:w.minus(whole[i] ?? 0)}))
    .sort((a,b) => b.remainder.cmp(a.remainder) || a.i-b.i);
  for (const entry of order) {
    if (residual.isZero()) break;
    whole[entry.i] = (whole[entry.i] ?? new Exact(0)).plus(1);
    residual = residual.minus(1);
  }
  return whole.map(w => w.div(factor).times(new Exact(amount.amount).isNegative() ? -1 : 1).toFixed(currencyScales[amount.currency]));
}
export function normalizedUnitPrice(amount: string, quantity: string, from: 'g' | 'kg', to: 'g' | 'kg'): string {
  const q = decimal(quantity);
  if (!q.gt(0)) throw new FinancialError('ZERO_DENOMINATOR', 'Quantity must be positive.');
  const normalized = from === to ? q : from === 'g' ? q.div(1000) : q.times(1000);
  return decimal(amount).div(normalized).toFixed(12);
}
export function realGrowth(nominalFraction: string, inflationFraction: string): string {
  const denominator = decimal(inflationFraction).plus(1);
  if (!denominator.gt(0)) throw new FinancialError('ZERO_DENOMINATOR', 'The selected price-index ratio must be positive.');
  return decimal(nominalFraction).plus(1).div(denominator).minus(1).toFixed(12);
}
export function priceQuantityEffects(p0: string, p1: string, q0: string, q1: string) {
  return { price: decimal(p1).minus(decimal(p0)).times(decimal(q0)).toFixed(),
    quantity: decimal(p1).times(decimal(q1).minus(decimal(q0))).toFixed() };
}

