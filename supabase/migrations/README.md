# Migration convention

Chat 1 owns this directory.

- PostgreSQL/Supabase is the business source of truth.
- Use ordered immutable migrations: `0001_core.sql`, `0002_quotes.sql`, `0003_schedule.sql`, `0004_ledger_outbox.sql`, `0005_operations.sql`.
- Every tenant-owned table carries `workspace_id`; foreign keys and uniqueness must prevent cross-workspace linkage.
- Enable RLS on exposed tables. Service-role credentials remain server-only.
- Never edit an applied migration in place; add a new corrective migration.
