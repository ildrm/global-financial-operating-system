# Actual verification evidence

Classification: verified development kernel slice. No whole-program, container, provider, professional or production approval.

The final [sequential verification run](ci-results.json) completed on 2026-10-11 using Node 26.5.0, native PostgreSQL 17.11, pnpm 12.11.2 and installed Google Chrome. Versions intended for fresh deployment are pinned separately; Node 24.21.0/container execution remains unverified.

| Command / check | Actual result | Evidence |
|---|---|---|
| `pnpm scope:check` | 273 FR IDs, 122 report IDs, 18 invariants, 806 preserved derived blocks, 64 scenarios, 42 specialties; source hashes/links/test/API/metric references pass | Source manifest, registries, operation traceability, test map. Semantic decomposition remains pending. |
| `pnpm architecture:check` | Pass: 2 pure financial domain files checked for infrastructure/unsafe numeric imports | `scripts/check-architecture.ts`; narrow boundary check, not a whole-repository architecture certification. |
| `pnpm typecheck` and root `tsc --noEmit` | Pass: 8 packages plus scripts/tests | Sequential run JSON. |
| `pnpm test` | 6 tests pass; 250 deterministic allocation property cases, large-money/minor-unit/economic/input vectors | [Unit JSON](unit-results.json), [goldens](golden-kernel.json). |
| `pnpm test:db` | 13 real PostgreSQL tests pass using restricted runtime/worker roles | [Database JSON](database-results.json). |
| `pnpm test:e2e` | 7 Chrome tests pass (6 real journeys plus one controlled display fixture); zero exercised axe violations; CSV/JSON golden/checksum parity | [Browser JSON](e2e-results.json), screenshots. |
| `pnpm build` | Pass: optimized Next web bundle; API/worker TypeScript checks | Sequential run. API/worker use source/tsx at runtime; production executable packaging remains pending. |
| `pnpm security:client-secrets` | 12 public static assets contain no configured secret literals | [Asset scan](client-secret-check.json); literal scan only. |
| `pnpm test:restore` | Pass: 15 exact row-text fingerprints, immutable seals, snapshots, replay/recovery in isolated restored DB | [Restore JSON](restore-results.json). |
| `pnpm test:bootstrap` | Pass: 6 migrations in an empty native DB, golden seed, second bootstrap preserves source facts | [Bootstrap JSON](bootstrap-results.json); cluster roles already existed. |
| `pnpm peers check` | Pass after exact TypeScript 6.0.3 pin | Peer compatibility checked during installation. |
| `pnpm audit --json` | Zero reported advisories at recorded time | [Dependency audit](dependency-audit.json); does not replace security assessment. |
| `docker compose config --quiet` | Pass | Configuration-only validation; daemon stopped, containers not run. |
| `pnpm scope:release-check` | **Fails as required**: 2223 overlapping coverage checks remain | [Full gate](full-release-gate.json). Counts are failing checks, not distinct requirements or a progress percentage. |

Database tests cover actual role ownership/BYPASSRLS, missing context/cross-book denial, concurrent repeated posts/payload/version conflicts, borrowing/card/transfer economics, original immutability and frozen snapshots, viewer/revocation/private drafts, closed periods/source uniqueness, raw SQL precision/balance/sealing, worker replay/privilege limits and numeric audit sequence/hash verification.

Browser tests exercise account setup, keyboard review/post, refresh/reversal, account-filtered activity, English reference totals, Persian digits/RTL/mobile, preservation of the selected book and date range across language changes, foreign-Origin/missing-bearer denial, immutable evidence exports, interruption before account submission and response loss after income/reversal commit. Income recovery is checked after both a dropped connection and an HTTP 500 response following an actual committed post; each original key resolves to exactly one journal. Browser recovery pointers contain only book/key UUIDs.

Meaningful defects repaired during execution: incompatible TypeScript/Swagger peers; unsafe fixed-scale numeric coercion; late-posting sealing across restore; lexicographic audit sequence ordering; modal close race; focusable decorative chart; categorical date spacing; CLDR display scale mismatch for IRR; minor-unit allocation at the 26-digit boundary; calculated balances exceeding the individual-input bound; volatile account/reversal retry keys; year-zero calendar validation. Earlier browser runs encountered cold compilation/hot-restart loading failures and a loaded development report response near the UI assertion window; the final suite asserts ready routes and exact reference totals before interactions. Financial assertions were retained.

Not run: container startup/build/fresh-volume/restart, pinned Node 24 execution, live OIDC/passkey/MFA/recovery/revocation, providers or licensing, object-storage upload/scanning, complete locales/calendars, manual screen reader/usability studies, full SAST/DAST/SBOM/penetration assessment, defined production load/latency/fault targets, encrypted remote backup/PITR/failover/role recovery, all-domain/report/local-rule acceptance, independent financial/security/local professional approval.

Restore hashes PostgreSQL row JSON **as exact text**, so numeric columns never pass through lossy JavaScript JSON parsing before comparison. The logical restore uses the same cluster/preexisting roles and does not establish production disaster recovery. Full-release gate failure is preserved separately from successful bounded-kernel verification.
