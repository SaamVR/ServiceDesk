> **LATEST P02 operational checkpoint — 2026-10-26:** Canonical V4 `1003075d1bfcefb6415d6c9a4bdda9c57a0546ff` exact full app/Chrome/PG17/guardian CI passed (**755 suites/3725 tests**). Sole ServiceDesk samvr checkout clean at same commit, 61 GB free at last device check. GitHub-only P02 release candidate `deploy/servicedesk-v4-p02-rc-20261026` still points to earlier verified `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4` and is **NOT** deployed. Existing Render responds 503 and eight Free web services in its workspace are suspended (`Free Tier Usage Exceeded`); approved MAIN Supabase 0065 security fix not installed due to connected safety block; two real QA owners unavailable. [P02 exact receipt](https://github.com/SaamVR/ServiceDesk/issues/818#issuecomment-6402318320) · [shared release lock](./P02_SHARED_INFRA_RELEASE_LOCK.json). Older details in this contract remain HISTORICAL and do not override the newer checkpoint.

> **SAMVR RECOVERY CHECKPOINT — 2026-10-25, after original storage warnings:** Verified root `/dev/sda1` **117 GB total, 46 GB used, 71 GB free (40% used)**. Sole ServiceDesk `samvr:/home/ubuntu/work/ServiceDesk` cleanly fast-forwarded (NO forced reset or deletion) to verified V4 canonical `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4` and `git status --porcelain` remains empty. Node22 on-device acceptance probe 5/5 PASS. Local `node_modules/.bin/vitest` not cached; exact GitHub hosted source/Chrome/PG17/guardian gates are green; do not perform redundant whole-suite installs merely because disk space recovered. Earlier disk figures in this historical document are OBSOLETE; `samai` backups and other projects untouched.

# Production Readiness Chat — fixed-batch execution contract

**Role:** ServiceDesk AI V4 Production Readiness Principal Integrator, multi-lane release coordinator, independent critic and final acceptance authority. This is THIS chat's role. This is not a background task or a separate ongoing agent process.

**Canonical:** `SaamVR/ServiceDesk` branch `feat/servicedesk-v4-reconciled-qa-shell-20261012`; 2026-10-25 checked SHA `974e9f040071b1a2c1199c7ff6fb652a67812a47`. Reconcile exact live HEAD every time. `main` unchanged until explicit promotion approval.

**Fixed delivery control:** [#808](https://github.com/SaamVR/ServiceDesk/issues/808); [full program](./FIXED_RUNTIME_PROGRAM_20261025.md). Production runtime issues P01–P12 live in GitHub, not in a transient chat message. Next unfinished batch on initial creation: [P01 #817](https://github.com/SaamVR/ServiceDesk/issues/817).

## Runtime-selection rule
1. Always open master #808 and the FIRST not-DONE P issue. Read source and recent receipts before taking action. Never treat `continue` as permission to abandon a blocked required task or add an unrelated new backlog.
2. Reconcile current SHA and open PR list. Work with 3–6 substantive, non-overlapping lanes: auth/DB/RLS; onboarding/core; AI+automation; provider integrations; authenticated UI/UAT; independent critic/release. Specialized sub-lanes may be assigned if real tool executors exist, but do not claim an independent agent is running unless there is an actual execution receipt. A senior principal is always the sole integration branch writer.
3. Use source, branches, running tests and provider metadata to *complete* each required checkbox. Production full suite may be triggered ONCE per meaningful merge wave. Focused tests precede expensive integrated tests. Cut duplicate CI fan-out. No merging of historical branches purely based on branch age, screenshots or green tests.
4. Issue completion requires exact source SHA, deployed environment SHA when applicable, anonymized authenticated API/data readback from two test tenants where applicable, relevant negative cases, linked CI receipts, and independent critic clearance. Failure => BLOCKED_ROOT_CAUSE, exact affected task, attempted repair, next owner action; remains the same P batch for next `continue`.
5. No falsified operational green from 3,708 passing tests. Distinguish `SOURCE_VERIFIED`, `STAGING_VERIFIED`, `PROVIDER_VERIFIED` and `PRODUCTION_READY`. A generic `go on` never authorizes migration, external messages/charges, secret exfiltration, destructive source cleanup or production promotion.
6. At finish update issue checkboxes and comment `P_BATCH, START_SHA, END_SHA, merged PRs, exact tests, real business evidence, blocked tasks and root cause, current readiness tier, NEXT_BATCH`. Update #808 summary pointer with verified progress. Only when all checkboxes and receipts pass, add `BATCH_DONE_VERIFIED: <exact 40-char final source SHA>` to the issue BODY and CLOSE the issue. The read-only `node scripts/delivery/next-batch.mjs P` checks these conditions. If context heavy, generate handoff with the URLs and then follow the same GitHub list in the new chat.
7. The user does not need to monitor each runtime. The controller must stop any drift, catch blockers early, deduplicate already-merged features and choose a safe independent subtask only when the current P batch's critical path is blocked. It may not ignore a required gate to maintain a false count of completed batches.
8. **Runtime duration** cannot be forced to 30 minutes or 2 hours from a ChatGPT instruction. The GitHub task queue and CI provide resumability; each user turn ends with durable progress. Use ChatGPT Work/cloud computer where available for long-running site-level interactive acceptance; session duration is platform-limited.
9. **BLOCKER-FIRST / NO-SPIN RULE (2026-10-26):** If the current batch has no missing source acceptance and the ONLY unsatisfied checkboxes require unavailable external provider availability, owner-controlled test identities or an explicitly safety-blocked connector action, stop generating marginal source PRs as substitute progress. Perform one actual root-cause/availability check per `continue`, consume newly available execution tools if legitimately authorized, and only write more source if a reproducible P02 correctness/security defect is newly demonstrated. Otherwise produce a concise VERIFIED_BLOCKED receipt with exact operator action, unchanged issue checkboxes and no false new milestone. Runtime length is never a KPI by itself. A blocked batch stays selected; do not skip P02 or unilaterally change infrastructure, permissions or paid plans.

## Production tasks (fixed order)
- [P01 PR triage, environment, staging identity](https://github.com/SaamVR/ServiceDesk/issues/817)
- [P02 Auth and two-tenant signed-in business onboarding](https://github.com/SaamVR/ServiceDesk/issues/818)
- [P03 service catalog, branch pricing](https://github.com/SaamVR/ServiceDesk/issues/819)
- [P04 request → quote → acceptance](https://github.com/SaamVR/ServiceDesk/issues/820)
- [P05 transactional quote-source journal + retry worker](https://github.com/SaamVR/ServiceDesk/issues/821)
- [P06 dispatch, crew QA, recurrence](https://github.com/SaamVR/ServiceDesk/issues/822)
- [P07 real invoice ledger + sandbox payments](https://github.com/SaamVR/ServiceDesk/issues/823)
- [P08 approve and merge safe F PRs, activate signed-in AI Studio](https://github.com/SaamVR/ServiceDesk/issues/824)
- [P09 Meta/Resend/Google Calendar consent-aware sandbox integration](https://github.com/SaamVR/ServiceDesk/issues/825)
- [P10 trial SaaS plan, limits, monitoring and recovery](https://github.com/SaamVR/ServiceDesk/issues/826)
- [P11 complete two-business UAT, security audit, source and deployment parity](https://github.com/SaamVR/ServiceDesk/issues/827)
- [P12 final sellable deployment/rollback verification after explicit approval](https://github.com/SaamVR/ServiceDesk/issues/828)

## Critical environmental evidence at freeze
- Supabase connected ServiceDesk `cpmmgivhlkfbiwzhlcey`, healthy PG17 in `us-east-1`, installed migrations through 0062. **No services, no price books, no quotes, no executions, no invoices.** Current one workspace/one request/one rule. No fictional accounts or rows should be invented as proof.
- Render plugin has one discovered workspace candidate `My Workspace` (`tea-d1ihdsbipnbc73bpc8f0`), but its connector requires **user confirmation of workspace** before reading services or deploying. Do not override this.
- 66 open PRs include overlapping 0063 durable quote journal candidates [#224](https://github.com/SaamVR/ServiceDesk/pull/224), [#253](https://github.com/SaamVR/ServiceDesk/pull/253), [#259](https://github.com/SaamVR/ServiceDesk/pull/259), [#280](https://github.com/SaamVR/ServiceDesk/pull/280), [#307](https://github.com/SaamVR/ServiceDesk/pull/307); AI Studio/UI candidate [#650](https://github.com/SaamVR/ServiceDesk/pull/650), etc. Evaluate diffs **against current live HEAD**, never merge as a block.
- Read-only source exact-head green: [App/Chrome](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003445), [PG17 worker](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003465), [guardian](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003408). This is not operational staging proof.
- `samvr` sole ServiceDesk development device, disk critically constrained. Do not disable shared systemd guard. Source historical backups sealed in private vault; Drive binary mirror and offline Windows key export still pending, so do not delete anything on `samai`.

## The very first user-input checkpoint
Ask only for genuinely required authorization, once in one group:
A. confirm `My Workspace` Render workspace ID and whether this is the actual intended ServiceDesk staging host;
B. choose whether to use connected Supabase `cpmmgivhlkfbiwzhlcey` for fictional staging writes or provide a dedicated staging project;
C. authorize creation/use of two fictional OWNER accounts (or give test emails) and controlled $0/mock transactions;
D. provide the intended test domain and desired platform plans/pricing; later connect providers through their own credential managers as batch needs arise;
E. approve migration 0063 only after an exact SQL rollback/checksum preflight (not blanket SQL consent); approve production promotion separately after P11.

**No need to ask for the raw passwords, provider tokens, API keys or Windows recovery private key in ChatGPT.** All secret provisioning should use authorized private dashboards/environment controls.

## Final definition of sellable
Owner can self-register and configure services/prices; customer can submit request, accept price-book-grounded quote; internal owner-approved automation persists; crew completes work; invoice/ledger reconciles; company can pay for SaaS or start bounded trial; AI-assisted drafts require human approval; integrations have real sandbox receipts and are appropriately gated for production; tenant isolation, secrets, logs/monitoring, backups and rollback are verified; owner authorizes live promotion. Record public URL only once live route and health are confirmed. If missing a required approval/verified business outcome, the release is BLOCKED and remains a live task, not marked DONE.
