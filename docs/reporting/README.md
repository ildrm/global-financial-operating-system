# Reporting foundation

The [catalog](catalog.json) preserves all 122 source report IDs and measure text, with source references to all three documents. Every definition inherits the full execution-prompt report contract. Only bounded foundation versions of R-D01/R-D02 are enabled; neither whole report requirement is accepted.

| Definition | Implemented calculation and layout | Missing full contract |
|---|---|---|
| R-D01 cash flow statement, foundation0.1.0 | Cash event table, opening/net movement/closing bridge, source IDs and methodology. Own transfers contribute zero; loan proceeds remain financing cash, not income. Opening-equity events inside the period are explicit adjustments. | Regulatory classification, cross-currency/consolidation, full typed metric infrastructure, XLSX/PDF, saved/sharing/scheduling, broader sources. |
| R-D02 account balances, foundation0.1.0 | Account/type/currency/as-of balance table; cash total; assets debit-positive/liabilities credit-positive. | All account/asset families, FX and ownership, reconciliation maturity, full exports/drill-through/sharing lifecycle. |

Snapshots use one serializable database view of the selected book/period, not the 200-row activity preview. They include all journal IDs through the end date (maximum 10,000), exact row strings/totals, generated timestamp/data cutoff, definition version, authorizing actor, basis, reconciliation/completeness and SHA-256 checksum. FX, rule and economic vintages are inapplicable to these manual single-currency definitions; later definitions must record their versions explicitly.

CSV and JSON use the same immutable snapshot and current creator/membership permission. CSV quotes cells and prefixes formula-leading values with an apostrophe, including negative amounts, to prevent spreadsheet execution. JSON is the exact canonical evidence carrier. XLSX/PDF/export-redaction/share/schedule are unavailable. CSV is UTF-8 with BOM and CRLF; it preserves decimal text but is not a numeric workbook.

R-D02 golden reference: Bank 7408.60, Cash 30.00, Credit card 0.00; cash 7438.60. R-D01: opening cash before2026-10-01 is 0; opening adjustments 4500 + salary 3000 − groceries 61.40 = net7438.60/closing7438.60. For a period after opening entries, opening cash is the earlier as-of balance. Negative cash is explicit; absent entries mean 0 within the manually recorded scope, never verified absence of real-world assets/liabilities.

Tests independently exercise financing/card/transfer distinctions, snapshots after reversal, source-scoped permission/revocation, checksum and exports. See `tests/integration/kernel.test.ts` and `tests/e2e/finance.spec.ts`. The [metric dictionary](metrics.json) defines the foundation measures; this is still an artifact-level registry, not a complete runtime query builder.

Unavailable report IDs stay in the catalog with `available:false` and their original obligations. No placeholder report button represents them as working. Full report acceptance requires golden fixtures, source reconciliation, all permitted filters, accessible render/export parity, evidence, current permissions and completed lifecycle.
