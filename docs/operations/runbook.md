# Development operations

See root README for startup. Preserve private `.env` keys and source data. Run migrations with the migration connection only; applications use restricted credentials. `pnpm db:migrate` applies each numbered SQL file transactionally under an advisory lock and checks applied checksums. Never edit a migration after it has been applied; add a forward migration.

The current native PostgreSQL 17 cluster is `.local-data/postgres`, uses `.local-data/socket` and TCP127.0.0.1:55432. It is synthetic development data. If stopped, the same local macOS installation can start it with:

```sh
postgres -D .local-data/postgres -k "$PWD/.local-data/socket" -p 55432 -h 127.0.0.1
```

This command describes the existing machine only. Fresh setups should provision PostgreSQL/roles through the documented Compose/bootstrap path once that path has been tested. Do not reinitialize/delete an existing cluster or volume to fix a migration.

## Restore and recovery

`pnpm test:restore` exports a repeatable-read snapshot, fingerprints 15 scoped tables, creates a private logical dump, restores into a uniquely named temporary database, compares all row hashes, verifies runtime reads/sealed journals/frozen snapshots, and posts/replays/recovers a new command only in that restored database. It removes the temporary database and dump and records nonsecret JSON evidence. Roles are reused from the same cluster. This does not verify role restoration, encrypted remote backup, PITR, failover, object storage or production RPO/RTO.

Before a real migration, use approved encrypted backups and a separately verified recovery environment. Roll back application binaries only when compatible with the migrated schema; posted facts are corrected through linked entries, never destructive SQL. Restore the backup into an isolated target and verify sources/balances/snapshots before switching traffic. Production deployment/switching procedures remain unapproved.

The worker polls once per second with bounded 50-event transactions. Failed transactions roll back inbox/checkpoint/delivery together and are retried on a later poll. Restarting is safe for the tested consumer. Monitor pending outbox count/oldest age and fixed failure logs; a permanent error currently needs operator investigation. Dedicated backoff/dead-letter/alert tooling remains future work. No Redis state is required for financial recovery.

For an interrupted browser request, reopen the same tab/book. It stores only an opaque key and entity UUID. The server resolves the exact draft or existing receipt; use **Check and retry**. Never replace the key solely because a response timed out. A confirmed version conflict requires a fresh review after refresh. Browser recovery is tab-scoped; clearing storage intentionally removes the resume pointer but does not remove any posted fact.

## Incidents and limits

For suspected incorrect balances, preserve journal/source/snapshot IDs and stop entering replacement facts until the discrepancy is understood. Check period/basis/book first, then authoritative postings; do not patch cached totals. For access concerns, revoke the grant through privileged controlled administration, inspect affected snapshot/actor scope and rotate affected credentials. A customer-support/admin incident console is not implemented.

Docker configuration passed syntax resolution. Docker Engine is unavailable locally, so image build, healthchecks, fresh volume ownership, optional Garage startup and container shutdown/restart are not verified. Garage's single-node optional profile is not production storage; it does not enable an upload UI. The current development container includes source/dependencies; production multi-stage images, digest pins, deployment automation, TLS, secret manager, resource/load validation and monitoring are pending.
