# ServiceDesk AI — V1-INT2 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT2  
Branch: `feat/servicedesk-v1-core-sprint2`  
Coordinator ref: `bc9f69f8735a8c3ddf637e26653e44090bb58d53`

## Start / final SHA

- Exact required sprint base: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`
- Observed starting branch HEAD: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`
- Final source/test SHA before receipt: `d47190dc6e7ca22e575c423269d7c4100370dd46`
- Final SHA after receipt: recorded by GitHub commit containing this file

## Runtime probe

Single normal recovery probe only:

```text
node --version => v22.16.0
npm --version => 10.9.2
corepack --version => 0.32.0
pnpm --version => bash: pnpm: command not found
getent hosts github.com => no output
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint2 => Could not resolve host: github.com
ts-node --version => v10.9.2
```

Canonical pnpm/Git access remained unavailable, so the sprint entered Runtime Outage Mode.

## Completed slices

### INT2-W1-T1 — Invoice/payment persistence migration

State: IMPLEMENTED

Added:
- `supabase/migrations/0005_invoices_payment_applications.sql`

Behavior/schema:
- Creates `invoices` table mapping current `InvoiceDTO` plus quote linkage/version/timestamps.
- Creates `verified_payment_applications` with provider/account/event/transaction identity, workspace, purpose, quote/hold/invoice references, amount/currency/occurredAt, state/reason, createdAt.
- Enforces provider event identity and workspace/account transaction+purpose idempotency.
- Enforces nonnegative invoice money, allocated >= refunded, and net-paid + balance = total.
- Enables RLS with staff read policies and no broad anonymous mutation policies.

### INT2-W1-T2 — Payment domain + repository transaction port

State: IMPLEMENTED

Added:
- `src/domain/payments.ts`
- `src/server/core/payment-application-repository.ts`

Behavior:
- Defines invoice records, payment applications, review reason codes and validation helpers.
- Defines explicit `PaymentApplicationRepository.transaction(...)` unit-of-work boundary for atomic identity, invoice, visit, ledger, outbox and attention coordination.
- Does not model payment application as unrelated writes.

### INT2-W1-T3 — Deposit application

State: IMPLEMENTED

Added:
- `src/server/core/payment-application.ts`

Behavior:
- Requires quoteId and holdId for DEPOSIT.
- Requires same-workspace accepted quote, matching hold, active hold window, exact deposit amount and currency.
- Valid `$85` deposit against `$340` quote allocates invoice, confirms hold, creates confirmed visit, appends credit ledger, queues booking/payment outbox and persists APPLIED application.

### INT2-W1-T4 — Duplicate, mismatch and late-payment review

State: IMPLEMENTED

Behavior:
- Same provider event returns `DUPLICATE` with no second mutation.
- Same provider transaction+purpose under another callback returns `DUPLICATE` with no second mutation.
- Amount/currency/workspace/target/purpose conflicts route to `PAYMENT_REVIEW`.
- Late verified deposit after hold expiry routes to `PAYMENT_REVIEW` without visit confirmation or booking outbox.
- Review attention is raised through a deduplicating repository boundary.

### INT2-W1-T5 — Balance application

State: IMPLEMENTED

Behavior:
- BALANCE requires invoiceId.
- Requires same workspace, open invoice, matching currency, exact remaining balance.
- Applies net allocation, marks PAID at zero balance, appends ledger, queues receipt outbox and persists APPLIED application.
- Duplicate balance transaction remains DUPLICATE.
- PLATFORM_SUBSCRIPTION routes to PAYMENT_REVIEW without customer invoice mutation.

### INT2-W1-T6 — Facade/server composition

State: IMPLEMENTED

Added/updated:
- `src/server/core/payment-application-facade.ts`
- `src/server/core/server-entrypoints.ts`

Behavior:
- Implements `ServiceDeskFacade.applyVerifiedPayment` through `createPaymentApplicationFacadeMethods(...)`.
- Exposes `applyVerifiedPaymentCommand(event)` from server command composition.
- Does not couple provider code into Core.

### INT2-W1-T7 — Package-free atomicity harness

State: IMPLEMENTED

Added:
- `tests/db/runtime-outage-e03-payment-application-harness.ts`

Executed in GPT Runtime scratch with global ts-node:

```bash
ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' tests/db/runtime-outage-e03-payment-application-harness.ts
```

Observed result:

```text
runtime-outage e03 payment application harness PASS
```

Harness scenarios:
- valid `$85` deposit => APPLIED once;
- same event duplicate => no second mutation;
- same transaction under another callback => no second mutation;
- amount mismatch => PAYMENT_REVIEW;
- expired hold => PAYMENT_REVIEW and no visit/outbox confirmation;
- valid balance closes invoice;
- transaction failure rolls back in-memory unit of work;
- platform subscription does not mutate customer invoice.

### INT2-W1-T8 — Canonical tests / DB proof handoff

State: IMPLEMENTED / AUTHORED_NOT_CANONICALLY_EXECUTED

Added:
- `tests/domain/payments.test.ts`
- `tests/db/payment-application-facade.test.ts`
- `tests/db/payment-application-migration.test.ts`
- `tests/db/runtime-outage-e03-payment-application-harness.ts`

Canonical Vitest/typecheck/DB proof was not executed because pnpm/Git remain unavailable in GPT Runtime.

## Changed files

- `supabase/migrations/0005_invoices_payment_applications.sql`
- `src/domain/payments.ts`
- `src/server/core/payment-application-repository.ts`
- `src/server/core/payment-application.ts`
- `src/server/core/payment-application-facade.ts`
- `src/server/core/server-entrypoints.ts`
- `tests/domain/payments.test.ts`
- `tests/db/runtime-outage-e03-payment-application-harness.ts`
- `tests/db/payment-application-facade.test.ts`
- `tests/db/payment-application-migration.test.ts`
- `docs/execution/receipts/v1-int2-worker-1.md`

## Proof level

- Outage harness: PASS
- State supported by outage mode: IMPLEMENTED
- Canonical pnpm install: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Canonical Vitest: NOT_EXECUTED / CONFIGURATION_BLOCKED
- Typecheck: NOT_EXECUTED / CONFIGURATION_BLOCKED
- PostgreSQL/RLS/real transaction proof: NOT_EXECUTED
- Live Stripe/provider proof: NOT_REQUIRED for V1 sandbox/demo and NOT_CLAIMED

## Blockers

```text
pnpm: command not found
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-core-sprint2 => Could not resolve host: github.com
SUPABASE_STAGING_REQUIRED_FOR_E03_DB_PROOF
```

## Next

READY_NEXT=E04 durable outbox claim lease retry worker

When canonical access returns, run:

```bash
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm vitest run tests/domain/payments.test.ts tests/db/payment-application-facade.test.ts tests/db/payment-application-migration.test.ts tests/db/runtime-outage-e03-payment-application-harness.ts
pnpm test:domain
pnpm test:db
pnpm typecheck
```

When Supabase staging is available, execute migration/RLS/transaction rollback proof for E03 before promoting beyond IMPLEMENTED.
