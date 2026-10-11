# Global Financial Operating System

A working development slice of the attached GFOS specifications: account setup, reviewed income/spending/transfers/borrowing/card settlement, immutable double-entry journals, linked reversals, workspace isolation, response-loss recovery, and two frozen foundation reports with CSV/JSON evidence. English and draft Persian screens are available.

**Delivery classification: verified kernel slice; full GFOS implementation remains in progress.** None of D0–D8 is claimed complete. All 273 original requirements, 122 reports, 18 invariants, 64 scenario families and 42 responsibility specialties are preserved in the [source manifest](docs/source-manifest.json) and registries. See [the checkpoint](docs/next-session.md) for remaining work.

## Run

Pinned baseline: Node 24.21.0, pnpm 12.11.2, PostgreSQL 17.11. The local verification machine used Node 26.5.0 and PostgreSQL 17.11; the pinned Node/container baseline has not yet been exercised. Install pnpm with `npm install --global pnpm@12.11.2` if needed.

For a fresh checkout with Docker Engine running:

```sh
pnpm install --frozen-lockfile
pnpm env:init
docker compose up --build
```

Open [English](http://localhost:3000/en?book=33333333-3333-4333-8333-333333333333) or [Persian](http://localhost:3000/fa?book=33333333-3333-4333-8333-333333333333). API documentation: <http://127.0.0.1:4000/api/docs>. The local demo identity accesses explicitly synthetic records. No login or real financial credentials are required for this development mode. Production rejects demo mode.

`env:init` generates private random keys, writes `.env` with mode 0600, and refuses to overwrite an existing file. Keep it out of source control. Bootstrap uses a separate migration identity and grants restricted API/worker identities. Redis is provisioned for future disposable acceleration; ledger totals are read from PostgreSQL. Optional `docker compose --profile documents up` provisions S3-compatible storage only; document upload is not implemented.

**Compose configuration was validated; containers were not run because the local Docker daemon is stopped.** Actual verification used native PostgreSQL and native app processes. Do not treat the Compose path as a verified clean installation yet.

The current workspace already has private native configuration and a running synthetic database on port 55432. Start these in separate terminals if the app processes stop:

```sh
pnpm --filter @gfos/api dev
pnpm --filter @gfos/worker start
pnpm --filter @gfos/web dev
```

Do not run Docker PostgreSQL and native PostgreSQL on port 55432 simultaneously. For an independently provisioned PostgreSQL instance, set `MIGRATION_DATABASE_URL`, `DATABASE_URL`, `WORKER_DATABASE_URL`, and generated development role passwords in `.env`, then run `pnpm dev:bootstrap`. Only a privileged migration identity should run bootstrap or migrations. See [operations](docs/operations/runbook.md).

## Verify

```sh
pnpm verify
pnpm exec tsc --noEmit -p tsconfig.json
pnpm test:db
pnpm test:e2e
pnpm test:restore
pnpm test:bootstrap
pnpm build
pnpm scope:release-check
```

Database tests require the synthetic PostgreSQL setup. Browser tests require running API/web processes and installed Google Chrome. Restore requires PostgreSQL 17 `pg_dump`/`pg_restore` and permission to create an isolated temporary database. It preserves the source database and removes the temporary restore.

The last command **intentionally fails while full-program obligations remain**. `verify` checks this slice and source preservation; it is not full-release approval. `pnpm ci:verify` runs the bounded verification sequence against already running synthetic services and records JSON results. [Verification evidence](docs/verification/README.md) records actual results and checks not run.

## Working with the slice

Select a workspace, add bank/cash/card/loan accounts with an explicit opening date, then use **Record activity → Review activity → Confirm and post**. Activity details show the journal and linked reversal action. Account rows filter activity for that account. Reports freeze the selected book and period; CSV and JSON downloads use that snapshot and recheck current access. The reference book computes EUR 4,500.00 opening cash + EUR 3,000.00 income − EUR 61.40 spending = EUR 7,438.60 cash.

[Financial policy](docs/financial-policy.md), [domain/API contracts](docs/domain/kernel.md), [security model](docs/security/threat-model.md), [report definitions](docs/reporting/README.md), [UI help](docs/ux/user-help.md), and [visual review](docs/ux/fidelity-ledger.md) explain the implemented behavior and limits.

Country rules, taxes/payroll, banking imports, documents, investments/crypto, FX, budgets/goals, specialized household domains, forecasting/AI and most reports are not enabled. OIDC code exists but has not been tested with a live identity provider. This development slice has no production deployment or independent professional approval.
