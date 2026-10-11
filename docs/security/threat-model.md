# Development security and permissions

Scope: browser → Next BFF → Nest API → PostgreSQL/worker. Future OIDC/provider/object-storage boundaries are recorded as unavailable or unverified. No legal-compliance or production-security claim is made.

| Actor | Lists/reads book | Changes money | Generates report | Downloads snapshot | Administration |
|---|---|---|---|---|---|
| Current owner | Granted book | Prepared/versioned/idempotent operations | Granted book | Own snapshot + current grant | Provisioning/close UI unavailable. |
| Current viewer | Granted book | Denied | Granted book | Own snapshot + current grant | Denied. |
| Revoked/nonmember | Denied | Denied | Denied | Denied, including prior snapshots | Denied. |
| API DB role | RLS-scoped nonowner | Scoped inserts, constrained entity version update | Scoped | Scoped | No migration ownership/BYPASSRLS. |
| Worker DB role | No financial journals/postings/snapshots | Denied | Denied | Denied | Delivery metadata only. |
| Migration identity | Privileged | Schema/provisioning only by operational policy | Privileged | Privileged | Must be kept outside runtime. |

The demo has an explicitly synthetic principal and workspaces. Server-only random bearer credentials never reach JavaScript. API authentication rejects missing tokens and maps verified issuer/subject to provisioned identities. A demo principal granted any visible nonsynthetic workspace is rejected. Production forbids demo and missing OIDC issuer/audience/JWKS. OIDC Authorization Code+PKCE/state/nonce and encrypted HttpOnly session code are present, but no live provider, passkey/MFA, enrollment, recovery or session-revocation flow has been verified.

| Threat | Implemented control | Remaining work |
|---|---|---|
| Cross-book ID substitution | Server grants, transaction-local scope, forced RLS, composite FKs; direct runtime tests | Field/health/payroll/shared ownership segmentation and complete adapter contexts. |
| Duplicate or uncertain financial response | Prepared immutable server drafts, exact input hash, permanent source uniqueness, scoped receipt/version/transaction | Multi-tab simultaneous pending-operation UX and full generic external-source deduplication. |
| SQL injection | Parameterized input queries; identifier interpolation only fixed internal migration/drill allowlists | Independent assessment/query-builder review. |
| CSRF | Mutation Origin check at BFF; tokens server-side; HttpOnly SameSite cookies | Production TLS/edge configuration and comprehensive session regression. |
| XSS/export injection | React escaping, allowlisted BFF routes, security headers, quoted/formula-safe CSV | Nonce CSP: inline scripts remain allowed; uploads/malicious documents not enabled. |
| Worker leakage | Event IDs without monetary descriptions; financial-table privileges revoked | Broker policies, leases/backoff/dead letters, complete log/trace audit. |
| Record mutation | Database immutable triggers, late-line seal, balanced/template/minor-unit constraints | Independent audit checkpoint/signature, complete action audit coverage and retention. |
| Dependency compromise | Exact lockfile/integrities, pnpm policy checks, zero-advisory audit at verification time | SBOM/SAST/DAST/penetration pipeline and continuous re-evaluation. |
| Backup/key loss | Private local config; actual isolated logical restore | Encrypted remote backups/PITR/KMS/rotation/role bootstrap disaster recovery. |

RLS does not protect against a compromised trusted service allowed to choose context, a superuser, or malicious migrations. The current hash chain is same-database tamper evidence for its defined fields; no independently protected checkpoint authenticates completeness. Ordinary logs use fixed error codes and exclude amounts/descriptions. Snapshot access is creator-private and rechecks revocation.

Retention/erasure/consent notifications and key rotation are not implemented. Posted-record retention must be reconciled with applicable law before real personal records are admitted. Native and Compose deployments bind development ports to loopback. No paid service, country pack, financial connector, payment, trade or payroll payout is connected.
