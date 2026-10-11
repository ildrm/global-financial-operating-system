# ADR 0001 — Exact, scoped PostgreSQL kernel

Status: implemented for development slice, 2026-10-11; whole-program/production acceptance pending.

Use Next.js 16.4.0/React 19.3.0 for browser UI and server BFF; NestJS 12.1.2 for API/worker; PostgreSQL 17.11 as authority; Drizzle 0.45.4 and explicit parameterized SQL for financial transactions. Pin Node 24.21.0/pnpm 12.11.2. TypeScript 6.0.3 satisfies the installed Swagger peer contract; the initially attempted7 did not. Host verification used Node 26.5.0; pinned runtime remains unverified.

Keep a modular monolith. The pure ledger domain imports contracts/exact math only; its application port has a PostgreSQL adapter. Controllers obtain actor identity server-side. Writes lock the book, check current permission, replay scoped idempotency before version checks, create journal/audit/outbox/receipt and increment version in one serializable transaction. Retry serialization/deadlock failures at most three attempts.

Decimal strings/Decimal.js precision 80 carry finance. Use unconstrained numeric with explicit bounds/scale/minor-unit checks. Fixed-scale numeric would coerce excess precision before constraints could reject it. Allocations distribute residuals deterministically. Numbers are limited to presentation coordinates/nonfinancial metadata; oversized charts fall back to exact tables.

Separate migration ownership, restrict runtime roles, force RLS and use transaction-local context/composite tenant foreign keys. RLS protects against cross-book application mistakes; a compromised trusted service or privileged administrator remains outside this guarantee.

Use PostgreSQL outbox/inbox/checkpoints. Redis is disposable acceleration, never financial authority. Future consumers need tenant envelopes, leases/retry/dead-letter policy and permission revalidation.

Optional development storage uses Garage 2.4.1. The source permits S3-compatible storage. MinIO's community repository was archived during current version review. Garage single-node setup is infrastructure only, not a tested document service or production durability decision.

Primary version references: [Node](https://nodejs.org/en/about/previous-releases), [Next](https://nextjs.org/docs/app/getting-started/installation), [Nest](https://docs.nestjs.com/first-steps), [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [pnpm allowBuilds](https://pnpm.io/settings/build#allowbuilds), [Garage](https://garagehq.deuxfleurs.fr/documentation/quick-start/). Exact resolutions/integrity are in `pnpm-lock.yaml`; container tags have not been pulled/run locally.
