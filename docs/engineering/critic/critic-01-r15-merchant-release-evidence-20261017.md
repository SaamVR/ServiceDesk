# CRITIC-01 — R15 independent merchant-value and engineering evidence review
**Date:** 2026-10-17 UTC | **Reviewer role:** CRITIC-01 within the existing GPT Runtime chat (not a separately running human or autonomous agent)  
**Pinned canonical:** `6c7f4c57279973cba9e344f0f5e4d51ac192879a` | **Live review:** `3962aa5c84c3aa5f47ad72b62d51ae4382467708`  
**Reviewed code candidates:** [PR #561](https://github.com/SaamVR/ServiceDesk/pull/561) at `66085d457794a1f7b9b630bd102b1ce3be3500b9` and [PR #562](https://github.com/SaamVR/ServiceDesk/pull/562) at `fa200b2460b2837eeee715fdce4902d98715f534`.

## Critical verdict
**Merchant usefulness: BLOCKED / CONFIGURATION_BLOCKED.** A compile/test/guest-browser success is **not** signed-in merchant persistence proof. The connected database has one workspace, one active OWNER, one active USD branch, **zero services, price books, quotes, workflow executions, invoices and outbox events**, and one request (read-only aggregates 2026-10-17). There is no second independently authorized fictional owner. Block "real quote→accept→attention→invoice" and any AI/provider delivery claim until actual authorized receipts exist. [#487](https://github.com/SaamVR/ServiceDesk/issues/487) stays OPEN.

## Source-diff review: real fixes and remaining risk
1. **PR #561 Core/Finance + Product QA:** prior owner first-run success gate compared stored rate version, rules, currency and catalog names but omitted stored `deposit_percent`, `valid_hours` and `buffer_minutes`. Candidate includes all three values in read-back with three adversarial mismatch cases. Prior persisted operational rate card accepted `baseMinor=0` despite real owner setup requiring a positive base. Candidate makes saved-card parse fail closed and tests all three service rules. **Positive and negative fixture CI required** at exact candidate SHA before integration. A mock readback still does not prove a connected merchant wrote these values. Note database source distinguishes `active`, not `is_active`; the four stored rate-card fields have verified integer schema.
2. **PR #562 AI:** numeric owner queue facts do not supply invoice/request/visit/attention due dates. Existing protection blocked "overdue invoices" but not reversed "invoices that are overdue". Candidate adds reverse/dependent relative clause handling and adverse tests. **Remaining limitation:** lexical filters do not exhaust paraphrases or prove generative-output truth. AI must remain OFF without explicit operator opt-in and controlled model evidence.
3. **Issue #153 SECURITY — still OPEN:** `SECURITY DEFINER servicedesk_default_branch(uuid)` may expose branch UUID for foreign workspace. Internal invoker-trigger uses helper, so blind EXECUTE revocation may break inserts. Source-only review is insufficient. Require disposable PG17 owner A/B negative RPC + legitimate insert/trigger positives, and review/approval of any eventual migration. No live DDL here.
4. **Migration 0063 recovery — not installed:** schema inventory ends at `sd_0062_v4_branch_trigger_rowtype_guard`; keep accepted-quote recovery default OFF. PG17 simulations of source 0063 do not imply staging install.

## Exact testing and promotion policy
- R14 canonical [full source/Chrome #39010048959](https://github.com/SaamVR/ServiceDesk/actions/runs/39010048959) and [PG17/worker #39010048953](https://github.com/SaamVR/ServiceDesk/actions/runs/39010048953) are **PASS at 6c7f4c...** (GitHub jobs inspected).
- PR candidate checks must be attached to their *own* immutable head SHAs. Do not mark merged/pass until all executable changes have passed the full source gate. Source-only PG17 proof is separate from installed DB state.
- Preserve Render R13 [deployment dep-db9gv3rrjlhs73epr34g](https://dashboard.render.com/web/srv-db5p1s142hec739noohg) LIVE SHA `3962aa5c...`; `autoDeploy=no` / trigger OFF. No new promotion until manual pinned release-candidate source parity, RC+PG17 and independent review/guest-health gate.
- CI waste: PR #561 activated multiple overlapping owner pricing PR checks plus full RC. If duplicate heavyweight full `check:rc` jobs recur after this batch, propose focused path-gating **without skipping required checks**; measure actual worker minutes first. Do not claim fixed cost savings from a count of YAML files.
- Avoid repeated R14 historical audits, repeated deployment builds and any RDC edits. Three devices only show online connection; their uncommitted working trees are **not** verified.

## Authorised merchant UAT gate, not an execution receipt
**Preconditions:** signed authorization for *two independent fictional authenticated owners/workspaces*, USD synthetic rates and staging write scope; snapshot and cleanup plan; approved preview release SHA; providers/AI/payments OFF; migration 0063 absent and dependent recovery OFF. No real PII or provider sends.

| Step | Owner A positive persisted proof | Owner B negative tenancy proof |
| --- | --- | --- |
| Authentication | Sign in, capture workspace+actor authorization evidence without tokens | Distinct signed-in owner/workspace; cannot assume a role from a mocked principal |
| Setup | Activate STANDARD, DEEP, MOVE_OUT; save nonzero USD base/room/add-on rates, deposit, expiry, buffer; reload exact DB data | Cannot resolve A branch, catalog, card or book via RLS/API |
| Request/quote | Create fictional request, confirm branch/service/currency, persist quote with integer minor-unit math, version/status and saved snapshot | A request/quote reads and writes denied; no cross-tenant inference |
| Accept/attention | Human-authorized acceptance; capture durable accepted event + matching LIVE rule/version, execution and linked attention source | A quote/event/execution/attention invisible and nonmutable |
| Invoice | Issue/persist invoice and ledger; read back stable amount/version/status across browser reload | A invoice, ledger and outbox scope unreadable/nonmutable |
| Adverse/retry | Quote expiry, duplicate request, idempotent retry, stale version, cancelled request, unknown commit result | Cross-tenant UUID probes denied, no leaked data or cross-tenant side effect |
| External boundary | Verify zero outbound events/provider sends/payment mutations as intended | No provider keys or payment mutations exposed |

**Evidence record for each stage:** approved staging environment, user-role category (not PII), source SHA, timestamp, route/API action, redacted request/response, exact DB row counts/IDs hashed as appropriate, negative HTTP/RLS verdict, retry outcomes and cleanup result. A synthetic Chrome journey or disposable two-tenant PostgreSQL fixture must be labeled **CONTRACT_TESTED**, not **OPERATIONS_VERIFIED**.

## CRITIC-01 disposition
- **Current release veto:** NO claim of merchant production/operations acceptance; NO R14 promotion during this work slice.
- **Candidate PRs:** review conditional on head-pinned CI success and no intervening branch changes; verify snapshots and run a negative test rather than rubber-stamping.
- **Unresolved:** merchant permissions/second owner, installed 0063 gap, security #153, measured release cadence #518, authenticated browser UAT, model/provider proof.

This file is an adversarial evidence artifact, not proof that five autonomous workers executed or that live merchant actions occurred.
