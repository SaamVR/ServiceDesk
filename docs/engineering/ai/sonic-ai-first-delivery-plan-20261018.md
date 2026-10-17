# ServiceDesk V4 — AI-first SONIC implementation plan
Date: 2026-10-18 | Repository: SaamVR/ServiceDesk | Source baseline: `963840b26ac6d1021240c90ef36b815f89a5ddaf`

## Authority, measurable goal and product posture
Deliver a real automation-first cleaning-service SaaS by prioritizing **saved-record-grounded AI features that a signed-in owner or dispatcher can actually use**, then integrate those proposals with durable internal workflow processing. "SONIC" means **parallel, non-overlapping tested vertical slices with rapid integration**, not pretending a single runtime is an autonomous unattended development team, moving production without permission, or reducing acceptance criteria.

Evidence snapshot: Samai public `POST /v1/chat/completions` authenticated synthetic output HTTP 200, ~25.1s, verified on 2026-10-18; this **does not** establish a deployed V4 Studio journey or commercial eligibility. 27 catalogue starter recipes exist for 5 events; external sends remain approval-gated. Canonical production `main` and Render R13 are intentionally not latest V4. Connected Supabase staging is at 0062; source migrations 0063–0065 are uninstalled. Protected two-owner merchant UAT and real persisted quote/invoice/workflow chain remain unproven (#487). Source/contract tests are not operational acceptance.

## Priority order: ship use cases, not static agent cards

### P0 — AI provider and AI Studio usable for one fictional business
1. **AI-01 Gateway reliability**: separate bounded gateway budget (measured real call ~25s vs previous 10s default), retain official OpenAI bounds, cancellation, strict origin/tenant allowlist, no secret disclosure. Gate: offline fake-timer tests, schema rejection, later controlled signed-in real one-shot.
2. **AI-02 Owner diagnostic and Studio**: integrate existing open #631 record picker, #633 execution inspector, #642 owner diagnostic and #645 quote-review controls **sequentially via coordinator**. The UI must not label cancelled client waiting as provider cancellation. Status: SOURCE CANDIDATES, not deployed.
3. **AI-03 Saved record copilot**: strengthen AI request brief, quote exception review and reply-composer for precise authority and stale-record refusal; no invented contacts/amounts/sends. Gate: real signed-in fictional owner, stale/foreign version tests.
4. **AI-04 Owner AI workday triage**: prioritized, count-grounded queue action suggestions paired with a model advisory, with action links to the real module and zero fabricated due dates, sends or payments. Gate: deterministic evidence-backed priorities, zero/ambiguous count refusals, no business mutation.

### P1 — Multistep AI-assisted business workflow
5. **AI-05 AI Intake Agent**: classify service intent and extract details from authorized inbound lead, propose clarification, link customer/property records and allow staff to approve a saved request.
6. **AI-06 AI Quote Agent**: review actual catalog/rate-book/currency and present alternatives; price calculations remain server SQL and owner-authoritative.
7. **AI-07 AI Dispatch Assistant**: explain available *persisted* capacity/crew conflicts; submit proposals for explicit human confirmation, never fabricate confirmed slots.
8. **AI-08 AI Quality Agent**: evidence/privacy-checked visit QA summary and incomplete checklist/rework recommendation; never silently mark passed.
9. **AI-09 AI Finance Assistant**: explain real invoice/ledger exceptions without changing amounts or authorizing payments/refunds.

### P2 — High-value differentiated automations
10. **AI-10 Consent-aware Communications Agent**: approved email/WhatsApp template draft, time zone and consent validation, provider receipts and retry recovery.
11. **AI-11 Retention Agent**: recurring-cleaning and churn signals from saved history, suggested outreach under owner approval, unsubscribe protections.
12. **AI-12 Business Intelligence Agent**: bounded daily/weekly evidence-based brief: queue bottlenecks, crew capacity, profitability *only if ledger/source data exists*, never hallucinated metrics.
13. **AI-13 Automation Agent**: generate a typed draft rule from user intent in an allowlisted 5-event/3-action schema initially; owner must preview, approve and publish. No AI-created arbitrary code, external webhooks or autonomous publish.
14. **AI-14 Audit/Critic Agent**: independent redacted execution anomaly detection, false receipt/refund/sent claims and provider spend alerts, always distinct from the decision agent.

## Backend dependencies and event/action expansion
The v1 rule contracts currently support REQUEST_CREATED, QUOTE_ACCEPTED, VISIT_COMPLETED, INVOICE_PAID, ATTENTION_OPENED and CREATE_ATTENTION/SEND_EMAIL_TEMPLATE/SEND_WHATSAPP_TEMPLATE. Add event families after their source row and transactional event journal are implemented: MESSAGE_RECEIVED, QUOTE_SENT, QUOTE_EXPIRED, BOOKING_CONFIRMED, CREW_ASSIGNED, VISIT_DELAYED, INCIDENT_REPORTED, QA_FAILED, INVOICE_ISSUED, INVOICE_OVERDUE, PAYMENT_FAILED, RECURRING_VISIT_DUE. Add safe typed action primitives: CREATE_TASK, SET_INTERNAL_PRIORITY, REQUEST_OWNER_APPROVAL, CREATE_DRAFT_REPLY, SUGGEST_SLOT, SCHEDULE_REMINDER, START_N8N_APPROVED_JOB, EMIT_OWNER_DIGEST. Every action needs branch scoped permission, idempotency, durable retries, dead-letter, exact saved receipt, and no money/communications mutation without approved authority. Existing 72-workflow list in #173 remains product backlog, not implementation proof.

## SONIC multilane delivery protocol (one chat can orchestrate multiple code branches)

Use up to **seven disjoint lanes**, scaled to independent file ownership and the actual tool/runtime capacity:
- AI-A (provider/runtime): `src/server/ai/runtime-config.ts`, `model-transport.ts`, connector-focused tests — do not overlap other AI candidates.
- AI-B (copilot/guardrails): `request-brief*`, `quote-review*`, `owner-operations-brief*` with separate AI tests.
- AI-C (workflow agent proposals): additive typed proposal module + contract tests; no new contract barrel without coordinator.
- CORE-D (durable events): `src/server/workflows/**`, jobs, SQL migrations, PG17 tenant tests.
- INTEG-E (external provider): `src/server/integrations/**`, provider acceptance + private redacted receipts.
- UX-F (Studio and dash): `src/features/**`, `src/app/**`, `tests/e2e/**`; **respect already-open #631/#633/#642/#645**.
- **CRITIC-G** (independent): separate branch, non-overlapping adversarial test fixtures, red-team review, practical merchant value and CI throughput measurements. It must not silently certify work it authored or mark synthetic fixtures as real provider delivery.

### Each long runtime: bounded multi-wave dispatch
1. First read canonical GitHub SHA, open PRs and blockers; assign non-overlapping files and known acceptance scenarios. Avoid repeated broad discovery and local devices.
2. Create 3–6 concrete features with one independently owned branch per lane and tests FIRST or alongside implementation. Prefer actual saved-record vertical slices over 30 documentation-only tickets.
3. Cross-review CRITIC lane: tenant boundaries, prompt injection, state drift, invalid timestamps, cancellation, price/provider claims, secret exposure, duplicate events and budget controls.
4. Run **focused tests per branch**, one consolidated full `pnpm check:rc` plus targeted PG17 tests for merge candidates. Avoid duplicate broad GitHub Actions fan-out by preserving green focused results; never claim exact-HEAD green from an older SHA.
5. Merge disjoint, reviewed PRs sequentially into `feat/servicedesk-v4-reconciled-qa-shell-20261012` only after exact-head evidence. Preserve independent UI/AI PR ownership; don't auto-merge another chat's drafts. End every runtime with SHA/PR links, tests, operational proof and blocking operator dependencies.
6. Deploy isolated V4 and provision credentials **only with separate operator authorization**. Do not modify `main`, Render R13, connected Supabase migrations or send customer messages from an engineering batch.

### Runtime scorecard (report facts, never invent minutes or parallel agents)
Record: merged features and PRs, tests newly added, exact CI run and conclusion, failures discovered/resolved by critic, number of source-only vs owner-tested vs provider-verified features, P0 blockers remaining, repo HEAD after merges. Aim for 3–6 useful small/medium features per sustained run, favor quality/independence over a pretend time guarantee.

## Release gates — strict but parallelizable
- G0 source: TypeScript, tests, lint, build, adversarial test corpus, correct current SHA.
- G1 connected isolated staging: migration 0063–0065 only when authorized; separate signed-in fictional OWNER A/OWNER B, true row-level isolation and owner pricing repair.
- G2 AI provider: synthetic public gateway passed (2026-10-18). Still require V4 deployed owner model invocation, real client cancellation behavior and gateway tail-latency measurement. Personal ChatGPT/Codex OAuth does not grant general commercial shared SaaS provider rights; obtain dedicated commercial eligibility.
- G3 business: request → true price-book quote → accepted → persisted matched workflow/attention → booking/crew → visit QA → invoice/ledger, under human approvals, with exact saved rows and no unauthorized sends.
- G4 production: explicit promotion approval and rollback; live billing and messaging remain disabled until supported agreements and acceptance.

**Next immediate parallel batch**: AI-A gateway latency fix + tests; AI-B saved-record grounded prioritized owner action suggestions + tests + UI via coordinator; CRITIC-G negative corpus; UX integration coordinator #644; CORE-D fixes #616/#153 separately, without blocking source-only AI development.
