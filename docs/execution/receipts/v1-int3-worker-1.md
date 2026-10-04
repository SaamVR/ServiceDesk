# ServiceDesk AI — V1-INT3 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT3  
Branch: `feat/servicedesk-v1-core-sprint3`  
Coordinator ref: `57c7d53a7aee7cf13ae7563807e71d5066816556`

## Start / final SHA

- Exact required sprint base: `b744bbba9c02904a5981e09c8d064face0de4a90`
- Observed starting branch HEAD: `b744bbba9c02904a5981e09c8d064face0de4a90`
- Implementation commits:
  - `a2bf5d1fdeaf3a3563336f48e6f0a5dc80741a7c` — durable outbox worker runtime source and migration
  - `d1d73ff036374399b1b1709105f8f59694fcbfac` — Runtime outage harness and canonical tests
  - final receipt commit records this file

## Runtime probe

Single normal recovery probe only:

```text
node --version => v22.16.0
npm --version => 10.9.2
corepack --version => 0.32.0
pnpm --version => bash: pnpm: command not found
getent hosts github.com => no output
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint3 => Could not resolve host: github.com
ts-node --version => v10.9.2
```

Canonical pnpm/Git access remained unavailable, so the sprint entered Runtime Outage Mode.

## Completed slices

### INT3-W1-T1 — Durable outbox runtime schema

State: IMPLEMENTED

Added:
- `supabase/migrations/0006_outbox_worker_runtime.sql`

Behavior/structure:
- Adds explicit terminal `SUPPRESSED` outbox status.
- Adds `provider_reference` and `last_error_code` metadata.
- Adds ready claim, stale lease and terminal indexes.
- Adds trusted server/service-role `claim_ready_outbox_events(...)` function.
- Claim function selects only `PENDING` rows with `next_attempt_at` null or ready, unlocked or stale leased, ordered deterministically, bounded by limit, and uses `FOR UPDATE SKIP LOCKED`.
- Claim function updates `locked_by`, `locked_at`, increments `attempts`, and returns claimed rows atomically.
- Function execution is revoked from public/anon/authenticated by default.

### INT3-W1-T2 — Outbox repository

State: IMPLEMENTED

Added:
- `src/server/jobs/outbox-repository.ts`

Behavior:
- Defines durable outbox row/status types and repository port.
- Supports `claimReady`, `markSent`, `markRetry`, `markFailed`, and `markSuppressed`.
- Maps DB rows to frozen `ClaimedOutboxEvent` contract plus lease owner metadata.
- Validates worker id and claim configuration.
- Completion methods surface missing/stale lease rows as failure instead of silently completing.

### INT3-W1-T3 — Deterministic retry policy

State: IMPLEMENTED

Added:
- `src/server/jobs/outbox-retry.ts`

Behavior:
- Deterministic exponential backoff with default base 60s and max 3600s.
- `retryAfterSeconds` can lengthen but not shorten minimum backoff.
- Max attempt retryable failure becomes terminal `FAILED`.
- `TERMINAL_FAILURE` becomes `FAILED` immediately.
- `SUPPRESSED` becomes terminal non-sent state.
- Invalid attempt counts, timestamps, max attempts and retry config fail closed.

### INT3-W1-T4 — Worker executor

State: IMPLEMENTED

Added:
- `src/server/jobs/outbox-worker.ts`

Behavior:
- Implements `runOutboxBatch(...)`.
- Claims ready events through injected repository.
- Executes each event through injected `OutboxExecutionPort`.
- Persists `SENT`, retry, `FAILED`, and `SUPPRESSED` decisions.
- Converts executor thrown errors or Result failures into retryable infrastructure failures subject to max attempts.
- Continues processing remaining claimed jobs after one executor or persistence failure.
- Returns summary counts and redacted per-item status/code results.

### INT3-W1-T5 — Lease recovery and competing-worker semantics

State: IMPLEMENTED

Covered by package-free harness:
- Worker A claims a row.
- Worker B cannot claim before lease expiry.
- Worker B reclaims after expiry.
- Worker A cannot mark reclaimed row sent.
- Terminal rows (`SENT`, `FAILED`, `SUPPRESSED`) are never reclaimed.

### INT3-W1-T6 — Retry/terminal semantics

State: IMPLEMENTED

Covered by package-free harness:
- Retryable failure schedules next attempt.
- `retryAfterSeconds` honored as lower bound.
- Max attempt becomes `FAILED`.
- Suppressed becomes `SUPPRESSED` and never provider-sent.
- Success records provider reference and sent state.
- Completion clears lock in the in-memory lease model.
- Invalid config fails closed.

### INT3-W1-T7 — Package-free worker harness

State: IMPLEMENTED

Added:
- `tests/db/runtime-outage-e04-outbox-worker-harness.ts`

Command executed in GPT Runtime scratch source:

```bash
ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/db/runtime-outage-e04-outbox-worker-harness.ts
```

Result:

```text
runtime-outage e04 outbox worker harness PASS
```

### INT3-W1-T8 — Canonical DB tests

State: IMPLEMENTED / AUTHORED_NOT_CANONICALLY_EXECUTED

Added:
- `tests/db/outbox-worker-runtime-migration.test.ts`
- `tests/db/outbox-repository.test.ts`
- `tests/db/outbox-worker.test.ts`

Canonical tests cover migration structure, claim SQL shape, repository contract behavior, retry policy and worker continuation behavior.

## Changed files

- `supabase/migrations/0006_outbox_worker_runtime.sql`
- `src/server/jobs/outbox-repository.ts`
- `src/server/jobs/outbox-retry.ts`
- `src/server/jobs/outbox-worker.ts`
- `tests/db/runtime-outage-e04-outbox-worker-harness.ts`
- `tests/db/outbox-worker-runtime-migration.test.ts`
- `tests/db/outbox-repository.test.ts`
- `tests/db/outbox-worker.test.ts`
- `docs/execution/receipts/v1-int3-worker-1.md`

## GitHub write inspection

Fetched persisted harness after write and confirmed it imports real worker/retry/repository modules from branch source.

## Proof level

- Outage harness: PASS
- State supported by outage mode: IMPLEMENTED
- Canonical pnpm install: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Canonical Vitest: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Typecheck: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Real Postgres concurrency proof: NOT_EXECUTED / SUPABASE_STAGING_REQUIRED_FOR_E04_DB_PROOF
- Provider proof: N/A

## Blockers

```text
pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint3 => Could not resolve host: github.com
SUPABASE_STAGING_REQUIRED_FOR_E04_DB_PROOF
```

## Next

READY_NEXT=E05 inbox conversation handover core

When canonical access returns, run:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/db/outbox-worker-runtime-migration.test.ts tests/db/outbox-repository.test.ts tests/db/outbox-worker.test.ts tests/db/runtime-outage-e04-outbox-worker-harness.ts
pnpm test:db
pnpm typecheck
```

For real E04 database proof, run the claim function on Supabase/Postgres staging with concurrent workers to verify `FOR UPDATE SKIP LOCKED`, stale lease recovery and stale-owner completion rejection under database locking.
