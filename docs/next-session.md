# Execution checkpoint — 2026-10-11

**Result: runnable, verified development kernel slice. Full GFOS delivery remains in progress.** The execution prompt explicitly permits a coherent verified slice and checkpoint when the entire program cannot fit in one session. No D0–D8 stage, original compound requirement or full report definition is accepted as complete.

## Read first

Read root/user governance, `source-manifest.json`, `spec-conflicts.md`, `financial-policy.md`, `implementation-status.json` and actual code/evidence. Use the codebase-memory skill for structural exploration and RTK for shell commands. Preserve existing changes and posted records. No independent specialists/qualified reviewers have approved the result.

Source versions: all three supplied documents 1.0.0, actual copied hashes in manifest. Scope: 273 explicit FR IDs, 122 catalog definitions, 18 invariants, 806 derived source blocks, 64 scenario families, 42 specialties. The 806 blocks include introductory scope/legal notices as well as numbered prose/tables/examples; semantic decomposition and review are still pending. 34 bounded child obligations are tested; full source parents remain designed/specified. Eight scenario families have partial evidence. Complete scope was not reduced.

## Working behavior

English/draft Persian Next interface; server BFF; Nest API and Nest worker; exact-money subset; synthetic scoped books/accounts/opening equity; received income/simple spending/own transfers/borrowing/card settlement; exact reviewed permanent journals; private immutable drafts; same-key recovery after refresh for every enabled money action, preserving the original key after network loss or an uncertain server error; linked reversals; owner/viewer/current-grant RLS; frozen R-D01/R-D02 foundation snapshots with same-snapshot CSV/JSON/evidence; durable outbox/inbox/checkpoints; six checksum-guarded migrations. Language navigation preserves the selected book and period. No real financial provider/action or country pack is enabled.

Final checks: 26 automated tests (6 unit with 250 property cases, 13 native PG, 7 Chrome), workspace/root type checks, architecture/source checks, optimized web build, public asset secret scan, native empty-schema/bootstrap repeatability and isolated exact logical restore passed. A sequential CI runner/evidence file exists. The full-release gate deliberately fails with 2223 overlapping findings. See `verification/README.md` for commands, artifacts, limitations and repaired defects.

## Runtime and startup

Pinned: Node 24.21.0, pnpm 12.11.2, PostgreSQL 17.11, Next 16.4.0, React 19.3.0, Nest 12.1.2, TypeScript 6.0.3; exact remaining dependencies in lockfile. Actual native checks used Node 26.5.0. Schema/contract/report foundation version 0.1.0; schema migrations 001–006. Source and ADR versions are separate.

Current native synthetic PostgreSQL is `.local-data/postgres`, socket `.local-data/socket`, TCP 127.0.0.1:55432. Private `.env` contains random server-only development credentials, mode 0600; never publish it. Native API 4000/web 3000/worker were left running. Open <http://localhost:3000/en?book=33333333-3333-4333-8333-333333333333> or equivalent `/fa`. If processes stop, use root README startup commands. Existing `.env` must be preserved; do not run `env:init` over it.

Fresh checkout path is `pnpm install --frozen-lockfile`, `pnpm env:init`, `docker compose up --build`, then run checks after services are ready. **Compose was configured/validated but not executed because the local Docker daemon is stopped.** Optional Garage profile is infrastructure-only and unverified. Native fresh bootstrap reused cluster roles; role creation/container ownership/pinned-runtime paths remain open checks.

## Next executable slice

1. Finish source child decomposition needed for itemized purchases, supplier credits and cash refunds; preserve original FR/PUR/LED/RPT links and define exact source lineage, state and permission contracts.
2. Establish independent 80-paid/20-credit/20-refund = 60-net-consumption examples, including partial/duplicate/excess-credit/currency/date/closed-period/reversal cases. A refund settles the credit; do not subtract it twice.
3. Implement purchase aggregates/line allocations and linked credit/refund commands through the financial transaction boundary; add actual review/evidence UI, report reconciliation, tenant/cross-object/idempotency/refresh tests.
4. Complete D1 gaps in parallel only when independently authorized/appropriate: live identity lifecycle, document quarantine, protected audit checkpoints, clean container installation, cursor pagination and scoped operational monitors. Do not activate a mock as a verified provider.

Do not regenerate registries destructively. `extract-scope.py --check` validates preserved source identity; `--refresh-sources` adds extraction records while preserving progress for unchanged sources. Review `record-kernel-progress.py` before rerunning it after expanding scope; it describes this kernel perimeter. Keep stable test/obligation IDs and add forward migrations.

## Outstanding gates and external dependencies

Most financial domains, 120 other report foundations plus complete contracts for the two current definitions, XLSX/PDF/query-builder/sharing/schedules, remaining language families/variants, currencies/FX/calendars, imports/reconciliation, property/utilities/transport/dependents/health, wealth/capital/consolidation, manual payroll/tax and pack governance, economic vintages, forecasts/AI and adapters remain unimplemented.

OIDC requires an approved development provider and provisioned identity to verify its code; financial/economic providers need licenses/consent/capability choices; country activation needs explicitly chosen jurisdictions and qualified review. These are not asserted as approved. Agent source extraction and tests do not replace independent financial/security/local professional review. No need to request these inputs before completing independent kernel/domain work.

Other known limits: one pending-operation pointer per browser tab, activity capped at 200, foundation report source set capped at 10,000, inline-script CSP pending nonce policy, draft/mixed-language report terminology, no production image packaging/TLS/KMS/rotation/retention/account lifecycle, no broker lease/backoff/dead-letter console, no encrypted backup/PITR/failover or measured production SLA. Full gate failures remain recorded; no waiver has been invented.
