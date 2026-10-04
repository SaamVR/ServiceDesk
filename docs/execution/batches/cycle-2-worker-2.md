# ServiceDesk AI — Cycle 2 Worker 2 / Connectors & AI

Branch: `feat/servicedesk-v1-connectors`
Expected previous Cycle 1 final SHA: `a9fc2de46ce63b44b394718edc98e0dc07a4a354`

Use GPT Runtime Machine only for checkout, package install, tests, typecheck, build, DB and browser execution. Do not use samai, samvr, SSH/local devices, self-hosted runners, or GitHub Actions. Connected GitHub access may be used only for repository reads/writes when Runtime transport is blocked; it is not executable proof.

Read in full before doing anything:
- AGENTS.md
- docs/execution/coordinator-four-chat-20261004.md
- this packet

Preserve every legitimate newer commit. Never reset/rebase/force-push or overwrite newer work.

Cycle 1 established a shared infrastructure blocker: GPT Runtime could not resolve github.com or registry.npmjs.org and pnpm could not be activated. Historical local-device PASS evidence is not accepted.

## Objective
Re-prove the repaired connector branch in GPT Runtime. If green, complete the deferred durable WhatsApp inbound processing seam in the same run. Target 20–30 minutes of useful implementation when executable.

## CYCLE-2-W2-T1 — Runtime recovery + connector gate
Verify branch/HEAD/working tree, then establish checkout/package access and run:
- `corepack prepare pnpm@10.17.1 --activate`
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm vitest run tests/providers`
- `pnpm vitest run tests/ai`

Historical samvr results remain non-qualifying.

## CYCLE-2-W2-T2 — Repair only reproduced Worker-2-owned failures
Allowed ownership:
- `src/server/ai/**`
- `src/server/integrations/**`
- provider handler internals owned by this lane
- `tests/ai/**`
- `tests/providers/**`
- `examples/n8n/**`

Do not edit shared contracts, package/lockfile, coordinator-owned API handler barrel, deployment config, Core, or Product/UI.

## CYCLE-2-W2-T3 — Idempotent durable WhatsApp inbound processor
Only after T1/T2 is green, add the explicit processor seam already source-derived in Cycle 1:
- a Worker-2-owned processor port consuming `DurableWhatsAppInboxRecord`;
- processing result differentiating `PROCESSED` and `DUPLICATE`;
- batch summary covering received/processed/duplicate/unsupported;
- typed failure carrying the durable receipt identity needed for retry diagnosis.

Do not mutate Core business truth directly.

## CYCLE-2-W2-T4 — Compose persist → process → ACK
Update the durable inbound path so ordering is:
1. Meta signature verification;
2. parse/normalize;
3. durable inbox persistence;
4. processor handoff only for logically new records;
5. ACK only after the required durable/processing work succeeds.

Duplicates must be safe. Processor failure must remain retryable and must not be falsely ACKed as successful business processing.

Add focused provider tests for new, duplicate, unsupported, and processor-failure paths.

## CYCLE-2-W2-T5 — Regression
Run focused WhatsApp tests, then full provider and AI suites plus typecheck. Commit small reviewable slices.

## Blocked fallback
If Runtime is still blocked:
- do not change application source;
- statically inspect the current WhatsApp persistence/handler/tests via GitHub;
- produce an exact implementation map naming files, current signatures, proposed new test cases, and any ownership conflict;
- record it only in the receipt.

## Receipt
Write `docs/execution/receipts/worker-2-cycle-2.md`.
Report final SHA, changed files, exact commands/results, proof labels, and blocker.
