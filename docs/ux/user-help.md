# Using the working financial slice

Use only synthetic entries in the current local demo. The first workspace contains the reference EUR book; the second workspace supports independent synthetic experiments.

1. Select the workspace. Balances, activity and snapshots belong to that book.
2. Add an account. Choose bank/cash/card/loan, a unique name, accounting opening date and exact opening balance. Card/loan balances are liabilities. Opening entries balance against equity; they are not income.
3. Record income, spending, an own transfer, borrowing or card settlement. Choose only accounts with the matching economic role. Review the amount/date and debit/credit lines, then confirm the permanent posting.
4. If the response is interrupted or the server cannot confirm the result, use **Check and retry** with the original operation. Refresh retrieves the server draft or receipt. Creating another operation can represent another financial fact.
5. Open activity details to see journal evidence. Correct an eligible entry with a reasoned linked reversal, then enter the replacement. The original remains visible.
6. Choose dates and generate a foundation report. Evidence/CSV downloads refer to the same frozen snapshot. Later entries do not change it; generate another snapshot when needed.

Account rows filter the latest bounded activity by their journal lines. Activity shows at most 200 records; narrow the period for earlier records. Report source sets include up to 10,000 journals. Future cursor pagination is required before larger books are supported.

Income/spending measure the selected period; cash/account balances are as of its end. Cash history includes earlier facts in its opening point and uses actual date spacing. The expandable table preserves exact money and provides an accessible alternative to the decorative chart. These manually entered records have not been reconciled with a bank statement.

English and draft Persian are available under `/en` and `/fa`. Persian accepts Persian/Arabic digits and unambiguous decimal/grouping marks. Dates remain Gregorian ISO civil dates. Currency codes and journal IDs use bidirectional isolation. Professional terminology review, Arabic/other required languages, alternative calendars, all error messages and export translation are still incomplete.

Keyboard focus, native modal trapping/Escape, screen labels, minimum controls, responsive layout and reduced motion are implemented. Automated axe checks exercise the visible screens, not a full WCAG conformance claim. Manual screen-reader/zoom/usability studies remain pending. Offline money entry is unavailable.
