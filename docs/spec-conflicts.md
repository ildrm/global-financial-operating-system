# Source decisions and unresolved scope

The user explicitly requested reading the three documents and executing their implementation prompt. The documents supply requirements within that request; illustrative snippets, instructions to use a particular model, and professional-role descriptions do not become claims that a model was changed or a professional approved the result.

| Issue | Decision | Consequence |
|---|---|---|
| Editorial “120 reports” versus 122 unique catalog rows | All three catalog ID sets independently contain 122. Preserve all 122 IDs. | Release count is 122; no rows dropped. |
| Product/architecture stage groupings differ | Use execution prompt D0–D8 dependency sequence, retaining original source references. | Kernel work overlaps D0/D1/early D2; none of these stages is complete. |
| Purchase/refund example can subtract refund twice | A paid 80 purchase, linked 20 purchase credit and 20 cash refund leaves net consumption 60; refund settles the credit, not a second expense reduction. | Later purchase subledger decision; refund UI is unavailable here. |
| Some source provenance names mention suffix “(1)” | Hash the actual supplied files copied into `docs/sources/`. | No assertion that differently named originals match. |
| Illustrative decimal/schema/code snippets | Treat them as examples; verify concrete code and constraints. | Unconstrained numeric with explicit bounds avoids silently rounding excess precision. |
| Zero opening balances versus positive journal lines | Create the account without a zero-value journal; nonzero openings balance against equity. | Account creation is audited and versioned; zero opening has null journal receipt. |
| “Income this month” with arbitrary period selection | Use “Income in period” / “Spending in period”. | Labels describe the selected dates. |
| Full currency registry versus first exact types | Eight fiat currencies are a bounded subset. | FR-FX-001 remains incomplete. |
| Requested GPT-6.1 Sol XHigh runtime name | Runtime/model selection belongs to the client. | No claim of reconfiguration or 42 independent specialists. |
| Independent financial/security/local-rule review | Agent checks are implementation evidence. | No qualified approval, compliance claim or regulatory activation. |

806 derived source blocks preserve unnumbered prose/tables/code, but need semantic decomposition and review. Extraction is scope registration, not completed analysis. Consequential policies for schedules, beneficial ownership, jurisdictions, categories, time zones, calendars and provider licenses remain dependency gates before those capabilities are enabled.
