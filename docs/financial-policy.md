# Financial policy 0.1.0

This manually entered book uses one functional currency and net-receipt analysis. Demo records are synthetic and visibly unreconciled. Entries do not establish gross earnings, total wealth, tax treatment, statement availability or bank verification.

Canonical input strings allow at most 26 integer/12 fractional digits, then currency-minor-unit validation. Calculated balances/totals have a separate 38-integer-digit contract so multiple valid events cannot make a book unreadable at the individual-input limit. Initial currencies: EUR/USD/GBP/TRY/INR/IRR(2), JPY(0), BHD(3). Account/book currencies must agree; no FX conversion. Overflow, exponent notation, NaN/infinity and excess minor units fail. Decimal calculations use precision 80/half-even at explicit boundaries. Allocations round once and distribute minor-unit residuals in stable input order.

Each book has income/expense/opening-equity system accounts plus bank/cash assets and card/loan liabilities. Assets display debit-positive; liabilities credit-positive. Negative balances describe accounting records rather than confirmed bank availability.

| Event | Debit | Credit | Effect |
|---|---|---|---|
| Received income | Bank/cash | Income | Cash/received income increase. |
| Cash purchase | Expense | Bank/cash | Cash falls; spending increases. |
| Card purchase | Expense | Card liability | Spending/debt increase; cash unchanged. |
| Own transfer | Destination cash account | Source cash account | Total cash/income/spending unchanged. |
| Borrowing | Bank/cash | Loan liability | Cash/debt increase; income unchanged. |
| Card settlement | Card liability | Bank/cash | Cash/debt fall; spending unchanged. |
| Positive opening asset | Asset | Equity | Explicit opening fact; no earnings/consumption. |
| Positive opening liability | Equity | Liability | Explicit opening debt; no earnings/consumption. |
| Negative opening | Reverse positive-opening sides | Reverse positive-opening sides | Negative recorded balance is explicit. |
| Reversal | Exact original credits | Exact original debits | New linked record; original unchanged. |

Accounting dates are validated Gregorian ISO civil dates in years 0001–9999; year zero is excluded to match PostgreSQL. Recorded timestamps are UTC. Language cannot change the date. Alternative calendars/time-zone policy remain incomplete. Posting cannot precede account opening. Database period locks reject dates on/before `through_date`; close/reopen administration and approval UI remain future scope.

Journals post atomically with at least two balanced positive lines. Late lines, changes and deletes are forbidden. Source uniqueness is permanent within workspace/book. Reversal needs owner permission, current version, reason and date on/after original. Only one reversal is allowed; reversals cannot themselves be reversed here. Correct by reversing and entering the replacement separately.

Hand-calculated reference expectations:4470 bank+30 cash=4500; salary 3000 gives7500; groceries 61.40 leaves7438.60. Borrowing 10000 raises cash/principal, not income. Card purchase 80 recognizes expense once; settlement 80 does not recognize it again. Transfer 500 conserves cash. Equal allocation of EUR 0.05 gives0.02/0.02/0.01. EUR 2/500g=EUR 4/kg; EUR 2/400g=EUR 5/kg. Growth 10% with inflation 15% gives−4.3478260870% real growth.

These expectations are automated reference checks, not signed accounting opinions. Accrual, receivables/payables, itemized refunds, interest/schedules, inventory/assets and consolidation require separate policies before activation.
