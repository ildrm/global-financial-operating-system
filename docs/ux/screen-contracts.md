# Working screen contracts

Visual foundation: forest sidebar, white content, restrained green money/action emphasis, open three-measure summary, bordered chart/account panels, compact activity table and a native modal for consequential commands. Tokens are in `apps/web/app/globals.css`: forest#103b2d, sidebar#0d3025, accent#08754b, text#111923, white#fff, border#dfe6e3, radius5px. Typography uses local Arial/Tahoma/Arabic fallbacks with explicit control sizes and tabular numerals. No remote font, decorative financial illustration or raster UI is required.

| Surface | Real inputs/output | Failure/empty/access behavior |
|---|---|---|
| Overview | Scoped period cash/income/spending, date-correct chart/exact table, accounts, recent activity | Loading/error/retry/no account; synthetic/unreconciled quality. |
| Accounts | Account setup with date/opening balance; row opens filtered journal activity | Name/type/amount validation, current owner, stable draft/receipt on interruption. |
| Activity | Latest200 source journals and exact details/lines | Empty/date narrowing; linked reversal with permission/date/reason/state guard. |
| Record/review | Economic type/account/amount/date/description; exact balanced preview | Malformed digits/precision/account errors, current version, review-before-post, cancellation and same-key recovery. |
| Reports | Two foundation definitions, period snapshot, rows/totals/evidence/CSV/JSON | Bound source limit, current creator access; missing full catalog explicitly stated. |
| Settings | English/Persian selection, immutable book currency/version/quality explanation | Unavailable locale families are tracked, not represented as working switches. |
| Recovery | Exact private server draft or original posted receipt | No money stored in browser recovery pointer; tab-scoped resume; conflicts require fresh review. |

Controls are native semantic HTML; dialogs trap focus and Escape, return focus to opener, and disable cancellation during an uncertain money response. Focus outlines, skip link, heading/table labels, exact table alternatives and reduced-motion support are included. Modal, snapshot and Persian mobile paths are tested with axe. Manual assistive/zoom/high-contrast/usability validation remains pending.

At 1536×1024, the sidebar stays 252px and the content uses wide open summaries; at 390×844 it becomes a compact five-item navigation, stacked summary/panels and horizontally scrollable data tables. RTL uses logical properties and bidi-isolated currency/date/IDs. The generated concept is a design reference, not a screenshot shipped as UI. See the [fidelity ledger](fidelity-ledger.md).
