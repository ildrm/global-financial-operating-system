import { describe,it,expect } from 'vitest';
import fc from 'fast-check';
import { money, calculatedMoney, positiveMoney, allocateMinorUnits, realGrowth, normalizedUnitPrice, priceQuantityEffects, Exact } from '../../packages/financial-math/src/index';
import { assertBalanced,buildPostings } from '../../modules/ledger/src/domain/posting';
import { parseLocalizedAmount,formatMoney } from '../../packages/localization/src/index';
import { CommandSchema,CivilDate } from '../../packages/contracts/src/index';
const account={id:'cash',kind:'bank',currency:'EUR' as const,openedOn:'2026-01-01'};
const system={income:'income',expense:'expense',equity:'equity'};
describe('independent reference arithmetic',()=>{
  it('keeps exact fiat scales and rejects precision, exponent, and overflow',()=>{
    expect(money('9007199254740993.01','EUR').amount).toBe('9007199254740993.01');
    expect(money('12','JPY').amount).toBe('12');
    expect(money('1.001','BHD').amount).toBe('1.001');
    expect(calculatedMoney('100000000000000000000004469.99','EUR').amount).toBe('100000000000000000000004469.99');
    for(const v of ['1.001','1e2','NaN','Infinity','999999999999999999999999999'])expect(()=>money(v,'EUR')).toThrow();
    expect(()=>positiveMoney('-1.00','EUR')).toThrow();
  });
  it('matches the source price and real-growth vectors',()=>{
    expect(normalizedUnitPrice('2','500','g','kg')).toBe('4.000000000000');
    expect(normalizedUnitPrice('2','400','g','kg')).toBe('5.000000000000');
    expect(priceQuantityEffects('2','2.50','10','12')).toEqual({price:'5',quantity:'5'});
    expect(realGrowth('0.10','0.15')).toBe('-0.043478260870');
    expect(()=>realGrowth('0.10','-1')).toThrow();
  });
  it('allocates residual minor units deterministically',()=>{
    expect(allocateMinorUnits(money('0.05','EUR'),['1','1','1'])).toEqual(['0.02','0.02','0.01']);
    expect(allocateMinorUnits(money('-0.05','EUR'),['1','1','1'])).toEqual(['-0.02','-0.02','-0.01']);
    expect(allocateMinorUnits(money('99999999999999999999999999.99','EUR'),['1'])).toEqual(['99999999999999999999999999.99']);
    expect(()=>allocateMinorUnits({amount:'0.051',currency:'EUR'},['1'])).toThrow();
    fc.assert(fc.property(fc.integer({min:-100000000,max:100000000}),fc.array(fc.integer({min:1,max:1000}),{minLength:1,maxLength:20}),(units,weights)=>{
      const amount=money(new Exact(units.toString()).div(100).toFixed(2),'EUR');
      const allocation=allocateMinorUnits(amount,weights.map(String));
      expect(allocation.reduce((s,v)=>s.plus(v),new Exact(0)).toFixed(2)).toBe(amount.amount);
    }),{numRuns:250,seed:20261011});
  });
  it('conserves journals and refuses wrong account semantics',()=>{
    const base={entityId:'33333333-3333-4333-8333-333333333333',expectedVersion:0,kind:'income' as const,amount:'3000.00',currency:'EUR' as const,effectiveDate:'2026-10-03',description:'Salary',accountId:account.id};
    expect(buildPostings(base,account,undefined,system)).toEqual([{accountId:'cash',side:'debit',amount:'3000.00'},{accountId:'income',side:'credit',amount:'3000.00'}]);
    const borrowing=buildPostings({...base,kind:'borrowing',amount:'10000.00'},account,{...account,id:'loan',kind:'loan'},system);
    expect(borrowing.map(l=>l.accountId)).not.toContain('income');
    assertBalanced(borrowing);
    expect(()=>buildPostings({...base,kind:'transfer'},account,account,system)).toThrow();
    expect(()=>assertBalanced([{accountId:'x',side:'debit',amount:'1.00'},{accountId:'y',side:'credit',amount:'0.99'}])).toThrow();
  });
  it('round-trips Persian digits and keeps large display values exact',()=>{
    expect(parseLocalizedAmount('۱٬۲۳۴٫۵۰','fa')).toBe('1234.50');
    expect(parseLocalizedAmount('١٢٣٫٤٥','fa')).toBe('123.45');
    expect(()=>parseLocalizedAmount('1,23','en')).toThrow();
    expect(()=>parseLocalizedAmount('۱,۲۳','fa')).toThrow();
    expect(formatMoney('9007199254740993.01','EUR','en')).toContain('9,007,199,254,740,993.01');
    expect(formatMoney('-0.01','EUR','en')).toContain('-');
    expect(formatMoney('-0.01','EUR','fa')).toContain('۰٫۰۱');
    expect(formatMoney('0.01','IRR','en')).toContain('0.01');
    expect(formatMoney('1.001','BHD','en')).toContain('1.001');
    expect(formatMoney('100000000000000000000004469.99','EUR','en')).toContain('100,000,000,000,000,000,000,004,469.99');
  });
  it('rejects invalid dates, unexpected fields, and numeric money',()=>{
    expect(CivilDate.safeParse('2026-02-29').success).toBe(false);
    expect(CivilDate.safeParse('0000-01-01').success).toBe(false);
    expect(CivilDate.safeParse('2024-02-29').success).toBe(true);
    const valid={entityId:'33333333-3333-4333-8333-333333333333',expectedVersion:0,kind:'income',amount:'20.00',currency:'EUR',effectiveDate:'2026-10-11',description:'Schema reference',accountId:'22222222-2222-4222-8222-222222222222'};
    expect(CommandSchema.safeParse(valid).success).toBe(true);
    expect(CommandSchema.safeParse({...valid,amount:20}).success).toBe(false);
    expect(CommandSchema.safeParse({...valid,unexpected:'field'}).success).toBe(false);
  });
});

