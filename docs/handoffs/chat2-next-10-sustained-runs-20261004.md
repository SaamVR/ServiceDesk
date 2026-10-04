# ServiceDesk AI — Chat 2 Connector Lane: Next 10 Sustained Runs

Prepared: 2026-10-04
Branch: `feat/servicedesk-v1-connectors`
Planning baseline HEAD observed: `461677a4ebcb8ee0ef5cb3ba2679550d85e1b173`
Frozen contract lineage: `dbf1f756d588925a694a4131672248ddb21a14e3`

This packet is intentionally designed for GPT-5.5 runs that otherwise stop after 3–4 minutes. Each run is a work queue, not a single task.

## Non-negotiable sustained-run contract

At the start of EVERY run:

1. Fetch the exact current head of `feat/servicedesk-v1-connectors`.
2. Verify working tree/worktree if Runtime git is available. If Runtime networking/package tools are unavailable, use the connected GitHub repository tools as the durable write path and say tests are NOT EXECUTED rather than pretending.
3. Read:
   - `AGENTS.md`
   - `docs/contracts-v1.md`
   - `docs/handoffs/chat2-chat3-gpt-runtime-contract-handoff-20261004.md`
   - `docs/provider-operations-checklist.md`
   - this file.
4. Preserve every legitimate newer commit. Never reset or force branch history.
5. Compare against `feat/servicedesk-v1-integrate` only for compatibility awareness. Do NOT merge core into the connector lane and do NOT modify core-owned files.

Owned paths remain:
- `src/server/ai/**`
- `src/server/integrations/**`
- Chat-2 provider API handler modules under `src/server/api-handlers/**`
- `tests/ai/**`
- `tests/providers/**`
- `examples/n8n/**`
- provider setup/evidence/handoff docs

Do NOT edit:
- `supabase/migrations/**`
- `src/domain/**`
- `src/server/core/**`
- `src/app/**`
- `src/features/**`
- `src/components/**`
- `src/contracts/index.ts`
- package manifests or lockfiles unless controller explicitly authorizes them.

### Minimum work before a run may stop

A run MUST NOT stop after one small task.

Target at least 20 minutes of active implementation. Since wall-clock execution cannot be guaranteed, enforce workload instead:

- Complete at least **3 independent reviewable slices** in the assigned run, OR
- complete the entire primary queue if it contains 4+ substantial edits, AND
- perform one final ownership/diff audit.

If a slice takes less than ~5 minutes, immediately start the next slice. If all primary tasks are already implemented, take fallback tasks from that run. If tests cannot execute because Runtime tooling is unavailable, record that once, inspect code/diffs, push the completed slice, and CONTINUE. Do not end the run merely because pnpm/network/provider access is unavailable.

For each slice:
1. Inspect relevant current files first.
2. Add/extend focused tests before behavior changes where practical.
3. Implement the behavior.
4. Run focused tests if tooling works.
5. Inspect diff/ownership.
6. Commit and push.
7. Immediately begin next READY slice.

Never claim `PROVIDER_VERIFIED` from mocks, fixtures, generated receipts, or screenshots.

If a task needs provider credentials or another lane's contract, record the exact blocker and immediately switch to the next independent task in the same run.

---

# RUN 1 — WhatsApp Cloud API transport completion

Goal: move WhatsApp from fixture-only/provider-boundary code toward a real injectable Cloud API transport without requiring live credentials.

Primary queue:

### 1A. Cloud API transport
Create a lane-owned module such as:
`src/server/integrations/whatsapp/cloud-api.ts`

Implement an injected HTTP transport for:
- free-form text inside the customer service window;
- approved template send outside the window;
- image/media send by provider media ID;
- provider request timeout/abort support;
- response JSON shape validation;
- provider error normalization.

Do not hard-code a token or API version. Configuration is input/ref only.

### 1B. Configured WhatsApp adapter
Add a configured adapter that composes:
- current outbound policy;
- Cloud API transport;
- idempotency key;
- redacted provider acceptance evidence.

Provider acceptance MUST remain distinct from delivery/read.

### 1C. Failure taxonomy
Normalize at least:
- 400 invalid request/template;
- 401/403 authentication/configuration;
- 429 rate limit;
- 5xx transient provider failure;
- network timeout.

Map retryable vs final/configuration-blocked outcomes without business mutation.

### 1D. Tests
Add focused contract tests covering request URL/path, auth redaction, template payload, text payload, media payload, timeout, 429, 5xx, invalid response, and acceptance evidence.

### 1E. Exports/audit
Export through the integrations barrel if lane-owned. Inspect diff and ensure no secret/token appears in test output.

Fallback queue:
- enforce maximum free-form text length;
- reject missing phone number ID;
- validate recipient phone/reference shape without logging it;
- add deterministic controlled provider-message-id parsing.

Exit criteria: at least 3 slices completed and pushed; ideally 1A–1E.

---

# RUN 2 — WhatsApp inbound/media/status hardening

Goal: make the already-built inbound/status/media boundaries robust enough for real provider traffic.

Primary queue:

### 2A. Inbound payload validation
Strengthen inbound parsing/handler behavior for malformed or partial Meta webhook objects:
- missing metadata;
- unmapped phone number ID;
- missing message ID/from;
- unsupported message types;
- multiple entries/changes/messages.

Unsupported content should produce a safe handover/unsupported classification, not fabricated content.

### 2B. Media retrieval transport
Extend current media module with an injected Meta media lookup/download transport:
- metadata lookup by media ID;
- authenticated download;
- MIME allowlist;
- size limit;
- timeout;
- redacted evidence only.

No media bytes should be persisted in provider evidence.

### 2C. Status transition hardening
Expand status transition rules:
- sent/provider accepted;
- delivered;
- read;
- failed;
- duplicate;
- stale regression;
- failed callback after delivered/read must not regress truth.

### 2D. Webhook abuse guards
Add safe payload-size / batch-count guards and deterministic rejection behavior for malformed JSON or unreasonable message/status batch sizes.

### 2E. Focused tests
Add/extend tests for all above, including multi-message batches and duplicate status callbacks.

Fallback queue:
- stable callback dedupe keys;
- case-insensitive signature header handling;
- timestamp normalization;
- redacted handler status summary.

---

# RUN 3 — Google Calendar real REST transport + OAuth exchange

Goal: implement a real injectable Google Calendar HTTP transport while preserving existing fixture adapter behavior.

Primary queue:

### 3A. Google REST client
Create a client module using injected fetch/HTTP transport for:
- FreeBusy query;
- event insert;
- event patch/update;
- event delete/cancel;
- optional event get used for reconciliation.

### 3B. OAuth token exchange/refresh
Complete the OAuth exchange boundary:
- authorization-code exchange;
- refresh-token exchange;
- expires_in normalization;
- scope normalization;
- invalid_grant -> reconnect-required;
- redacted errors.

Do not persist raw tokens in evidence.

### 3C. Configured Calendar adapter
Compose connection policy + access-token refresh + REST client into a configured adapter. If stale/expired, refresh before provider calls when possible.

### 3D. Error taxonomy
Normalize:
- 401 expired token;
- 403 insufficient scope;
- 404 missing event/calendar;
- 409 conflict;
- 410 expired sync token;
- 429 rate limit;
- 5xx transient failure.

### 3E. Tests
Contract-test exact request methods/paths/bodies and normalized responses with injected transport. No live Google account required.

Fallback queue:
- pagination helper;
- calendar ID URL encoding;
- ISO timestamp validation;
- redacted provider evidence.

---

# RUN 4 — Calendar sync, timezone/DST, reconciliation

Goal: finish Calendar reliability, not new product features.

Primary queue:

### 4A. Incremental sync state machine
Implement/complete:
- initial full sync;
- nextSyncToken capture;
- incremental sync;
- page token handling;
- 410 token expiry -> full rebuild;
- stale flag lifecycle.

### 4B. External busy normalization
Normalize provider FreeBusy/event blocks to current `CalendarBusyRange` without leaking titles/descriptions.

### 4C. Timezone/DST cases
Add tests for:
- workspace/crew timezone handling;
- DST spring-forward missing time;
- DST fall-back repeated hour;
- midnight/date boundary;
- buffer overlap.

Keep ISO-8601 contract externally.

### 4D. Reconciliation plans
Strengthen reconciliation output for:
- app event exists/provider missing;
- provider event exists/app mapping stale;
- duplicate provider mapping;
- cancelled visit/provider event still active.

Reconciliation may propose actions but MUST NOT mutate booking truth directly.

### 4E. Recovery receipts
Produce redacted reconciliation/recovery receipt objects consumable by operations snapshot/handoff.

Fallback queue:
- stale threshold configuration;
- deterministic reconciliation IDs;
- full-sync batch bounds.

---

# RUN 5 — Payment checkout transport + webhook cryptographic hardening

Goal: move payments from fixture verification toward a real sandbox-capable transport without live credentials.

Primary queue:

### 5A. Stripe-style Checkout transport
Implement injected HTTP transport for hosted Checkout Session creation:
- amount/currency derived only from server-provided quote/hold input;
- idempotency header;
- success/cancel URL validation;
- metadata: workspace, purpose, quote/hold reference;
- optional connected account header when configured.

Do not accept arbitrary client amount.

### 5B. Signature parser hardening
Support realistic Stripe-style signature headers:
- timestamp;
- multiple `v1` signatures;
- tolerance window;
- malformed signature rejection;
- constant-time comparison where possible.

### 5C. Event object validation
Validate signed event shape before converting to `VerifiedPaymentEvent`:
- account;
- provider event ID;
- object/session ID;
- amount;
- currency;
- purpose;
- workspace metadata;
- required transaction/payment-intent reference.

### 5D. Error/retry taxonomy
Normalize API rate limit, auth, invalid request, provider timeout, and 5xx outcomes.

### 5E. Tests
Add transport contract tests, signature edge cases, metadata tamper cases, and idempotent checkout creation expectations.

Fallback queue:
- hold expiry preflight;
- URL scheme validation;
- currency uppercase normalization.

---

# RUN 6 — Payment lifecycle, review, and recovery matrix

Goal: finish V1 payment reliability around deposit/balance/subscription workflows.

Primary queue:

### 6A. Event lifecycle matrix
Define provider callback classification for V1-relevant events:
- successful checkout/payment;
- failed payment;
- expired checkout;
- refund/cancellation only if already in the V1 plan;
- subscription payment where existing purpose supports it.

Do not broaden product scope beyond existing V1 requirements.

### 6B. Duplicate/out-of-order handling
Create table-driven tests for:
- duplicate verified event;
- old event after newer state;
- payment after hold expiry;
- amount mismatch;
- currency mismatch;
- account mismatch;
- workspace mismatch;
- purpose mismatch.

### 6C. Review queue
Strengthen manual-review record shape with:
- deterministic review key;
- redacted reason codes;
- provider event reference;
- no customer PII;
- no direct mutation permission.

### 6D. Recovery executor integration
Feed retryable payment failures into the existing recovery executor/queue and emit attempt receipts.

### 6E. Checkout/payment evidence
Add redacted controlled-proof packet builder for future sandbox verification. Fixture mode remains CONTRACT_TESTED.

Fallback queue:
- max retry budget tests;
- recovery dead-letter summary;
- operator retry eligibility.

---

# RUN 7 — Transactional Email provider-neutral transport

Goal: complete email without prematurely choosing a vendor.

Primary queue:

### 7A. Transport abstraction
Create a provider-neutral configured email transport using injected HTTP send function. It should accept normalized:
- from;
- to;
- subject;
- text/html;
- template/reference;
- idempotency key.

Provider-specific credentials stay outside evidence/log output.

### 7B. Transactional templates/purposes
Ensure existing V1 purposes have deterministic payload builders:
- quote ready;
- booking confirmed;
- invoice issued;
- payment receipt/reminder;
- visit reminder.

Do not create marketing automation.

### 7C. Suppression lifecycle
Connect bounce/complaint callback classification to suppression decisions via injected store boundary. Duplicate callbacks must be idempotent.

### 7D. Provider error normalization
Classify hard bounce, temporary bounce, rejected sender/domain, rate limit, timeout, and provider 5xx.

### 7E. Tests
Contract tests for send payloads, suppression-before-send, callback verification, duplicate callbacks, retryable temporary failures, redaction.

Fallback queue:
- domain-only evidence;
- maximum subject/body guards;
- attachment unsupported policy if V1 does not require attachments.

---

# RUN 8 — Outbound Webhook + n8n delivery executor

Goal: turn current signing/retry/receipt helpers into one coherent automation delivery pipeline.

Primary queue:

### 8A. Signed webhook executor
Implement actual injected POST execution:
- signed body/headers;
- timeout;
- response-code classification;
- idempotency event ID;
- no redirect-to-untrusted-host behavior unless explicitly allowed.

### 8B. Retry/dead-letter integration
Wire executor decisions into existing recovery queue/executor:
- retryable network/429/5xx;
- final deterministic 4xx;
- retry exhaustion -> dead letter/operator review.

### 8C. n8n receipt linkage
Link ServiceDesk event ID -> outbound attempt -> n8n execution receipt using redacted identifiers only.

### 8D. Example workflow hardening
Update `examples/n8n/booking-confirmed.json` if needed so it:
- verifies signature/timestamp;
- uses event ID for dedupe;
- treats ServiceDesk as source of truth;
- only sends internal notification / allowed automation;
- does not mutate booking/payment truth independently.

### 8E. Tests
End-to-end contract tests using fake receiver transport for success, tamper, timeout, 429, 500, deterministic 400, duplicate event, retry exhaustion.

Fallback queue:
- destination allowlist;
- max response body size;
- redacted response excerpt.

---

# RUN 9 — AI model transport + guarded orchestration hardening

Goal: finish the AI/provider side without letting AI become business truth.

Primary queue:

### 9A. Model transport boundary
Add a configured AI transport abstraction using injected model call:
- structured extraction response;
- timeout;
- provider error normalization;
- no raw API keys/prompts in evidence.

Avoid adding a new package dependency unless already available/authorized.

### 9B. Structured response validation
Validate model output against existing AI domain types before use. Invalid/malformed output must fail safe into clarification or handover.

### 9C. Tool/action allowlist
Ensure AI can only request allowed facade/API actions through typed proposals. AI must NOT:
- determine price itself;
- invent availability;
- mark payment paid;
- assign roles;
- mutate provider/core tables directly.

### 9D. Knowledge citation enforcement
Approved-knowledge answers must carry citation/reference metadata. Unsupported knowledge requests should not hallucinate.

### 9E. Corpus expansion
Expand AI tests for:
- ambiguous intake;
- missing fields;
- prompt injection;
- requests to override price;
- requests to fake payment;
- unsupported services;
- human handover;
- owner-assistant aggregate-only inputs.

Aim for a meaningful corpus expansion, not two token examples.

Fallback queue:
- deterministic failure codes;
- token/size guard inputs;
- redacted model evidence packet.

---

# RUN 10 — Connector closure, cross-provider regression, controller handoff

Goal: make the lane coherent and integration-ready instead of adding more isolated helpers.

Primary queue:

### 10A. Full connector inventory
Inventory every Chat-2 module and test. Identify:
- orphan modules not exported;
- stale duplicate helpers;
- conflicting status enums;
- inconsistent Result/error codes;
- untested branches.

Fix lane-owned inconsistencies only.

### 10B. Cross-provider recovery tests
Add integration-style contract tests across connector modules:
- WhatsApp send failure -> recovery queue -> retry receipt;
- Calendar stale sync -> reconciliation -> recovery receipt;
- Payment transient failure -> retry/review;
- Email temporary bounce/provider failure -> retry vs suppression;
- Webhook/n8n retry -> dead letter.

No core DB required; use injected stores/transports.

### 10C. Security/redaction audit
Search lane-owned code/tests for:
- raw secrets;
- bearer tokens;
- webhook secrets;
- phone/email PII in evidence;
- raw customer text in operations snapshots.
Fix any violations.

### 10D. Test/typecheck execution
If Runtime works:
- run focused AI tests;
- run focused provider tests;
- run full lane test subset;
- run typecheck.

If Runtime still cannot execute, DO NOT stop. Inspect imports/exports and diffs statically, record blocker, continue 10E/10F.

### 10E. Controller compatibility report
Compare connector head against latest `feat/servicedesk-v1-integrate`.
Report:
- connector HEAD;
- integration HEAD;
- divergent commits;
- shared-contract conflicts;
- exact lane-owned commit range;
- any controller action required.

Do NOT merge or rebase unless explicitly authorized.

### 10F. Final handoff update
Create/update a connector handoff document with:
- implemented capabilities by provider;
- tests actually run;
- CONTRACT_TESTED vs CONFIGURATION_BLOCKED vs PROVIDER_VERIFIED;
- provider credentials/resources still required;
- recommended controller integration order.

Fallback queue:
- clean barrel exports;
- remove duplicate lane-only dead code if clearly safe;
- update provider operations checklist with newly implemented transports.

---

## Global fallback queue for ANY run

If the assigned tasks are already present because another run advanced the branch, do not stop. Mark `SKIPPED_ALREADY_PRESENT` and take the first useful item below that is not implemented:

1. Add missing negative-path tests for malformed provider payloads.
2. Add timeout/rate-limit/provider-5xx normalization to an existing transport.
3. Add redaction tests proving secrets/PII do not appear in evidence/status snapshots.
4. Add deterministic idempotency/dedupe key tests.
5. Add retry exhaustion/dead-letter tests.
6. Add batch/payload size guards.
7. Add barrel exports for newly created lane-owned modules.
8. Add operations/readiness summary coverage.
9. Add controlled-proof template fields needed for a provider already implemented.
10. Inspect current branch diff against integration and document a concrete controller blocker.

Do not create trivial one-function files just to consume the queue. Prefer coherent capability completion.

## Required end-of-run report

Every run must end with:

- `RUN=<n>`
- `BRANCH=feat/servicedesk-v1-connectors`
- `START_HEAD=<sha>`
- `FINAL_HEAD=<sha>`
- completed slice -> commit SHA mapping;
- tests ACTUALLY executed and results;
- tests authored but not executed;
- files changed;
- ownership violations: yes/no;
- integrated vs only pushed;
- provider proof status;
- exact blocker(s);
- unfinished primary tasks;
- next READY task from this packet.

Do not say a run is complete merely because one task is complete.
