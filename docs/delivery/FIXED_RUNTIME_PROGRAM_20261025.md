# ServiceDesk — fixed-runtime delivery program v1.0 (25 October 2026)

**Single progress index:** [SD-DELIVERY #808](https://github.com/SaamVR/ServiceDesk/issues/808). Each batch's own GitHub issue is the authoritative checklist. `continue` means run **the first still-unfinished batch in the current chat's track**; never silently skip blocked gates.

**Canonical application source:** `feat/servicedesk-v4-reconciled-qa-shell-20261012`, verified initial SHA `974e9f040071b1a2c1199c7ff6fb652a67812a47`. Never hard-reset newer HEAD. Protected `main` is not a source-development branch and is not automatically promoted. Sole ServiceDesk development device is `samvr`. Preserve all `samai` historic paths and both recovery archives until separate path-level final cleanup approval.

## Measured launch gap
Read-only connected project `cpmmgivhlkfbiwzhlcey`: 1 workspace, **0 service catalog entries, 0 price books, 1 request, 0 quotes, 1 rule, 0 executions, 0 invoices**; database migration history stops at **0062**. Exact-current-source CI is green but business staging acceptance is NOT. 66 unmerged PRs include overlapping 0063 recovery versions and dated AI/frontend variations. Blind mass-merging is forbidden. Merchant/UAT blocker [#487](https://github.com/SaamVR/ServiceDesk/issues/487), AI provider blocker [#621](https://github.com/SaamVR/ServiceDesk/issues/621), transactional automation blocker [#199](https://github.com/SaamVR/ServiceDesk/issues/199).

## Track A — feature-development chat (NO canonical merges)
| Batch | Committed outcome | Planning budget | Issue |
|---|---|---|---|
| **F01** | Grounded intake + quote copilot | 45–90m | [#809](https://github.com/SaamVR/ServiceDesk/issues/809) |
| **F02** | Dispatch + quality assistants | 45–90m | [#810](https://github.com/SaamVR/ServiceDesk/issues/810) |
| **F03** | Finance + BI assistants | 45–90m | [#811](https://github.com/SaamVR/ServiceDesk/issues/811) |
| **F04** | Communications + retention | 45–90m | [#812](https://github.com/SaamVR/ServiceDesk/issues/812) |
| **F05** | AI automation drafting | 60–100m | [#813](https://github.com/SaamVR/ServiceDesk/issues/813) |
| **F06** | Typed events + internal actions | 60–110m | [#814](https://github.com/SaamVR/ServiceDesk/issues/814) |
| **F07** | Audit/critic intelligence | 45–90m | [#815](https://github.com/SaamVR/ServiceDesk/issues/815) |
| **F08** | Feature candidate freeze | 45–90m | [#816](https://github.com/SaamVR/ServiceDesk/issues/816) |

**Owner lanes:** FEAT-01 Intake/Quote AI; FEAT-02 Dispatch/QA AI; FEAT-03 Finance/BI; FEAT-04 Comms/Retention; FEAT-05 Automation compiler; FEAT-06 Typed event/action library; FEAT-07 adversarial QA/critic; FEAT-08 candidate integrator. A principal engineer coordinates path ownership and evidence, not fictitious independently-running agents. Lanes can work in parallel only when distinct file owners and real workers/actions exist.

**Allowed paths:** preferably additive modules in `src/server/ai/`, additive pure feature files, independent `tests/ai/` and `tests/providers/`. Do not edit Production-owned `src/app/`, `src/server/core/`, `src/server/jobs/`, `src/server/integrations/`, `supabase/migrations/`, `src/features/operations/` or global package files without explicit Production coordination. Shared contracts/barrels require an interface request to #808; do not create competing definitions.

**Fast QA rule:** implementation + focused functional/security regression + TypeScript once per F batch. Broader combined suite once in F08, and full app/Chrome/PG17 only in Production integration waves. No unnecessary repeat of the entire 3,708-test suite on each small PR. Every feature PR references its F issue, starts as draft and is not self-merged.

## Track B — Production Readiness Control Tower (THIS chat)
| Batch | Committed outcome | Planning budget | Issue |
|---|---|---|---|
| **P01** | Existing PRs + environment lock | 60–120m | [#817](https://github.com/SaamVR/ServiceDesk/issues/817) |
| **P02** | Two tenant auth/onboarding | 60–120m | [#818](https://github.com/SaamVR/ServiceDesk/issues/818) |
| **P03** | Service catalog + pricing | 60–120m | [#819](https://github.com/SaamVR/ServiceDesk/issues/819) |
| **P04** | Enquiry → quote → accept | 60–120m | [#820](https://github.com/SaamVR/ServiceDesk/issues/820) |
| **P05** | Transactional automation journal | 75–135m | [#821](https://github.com/SaamVR/ServiceDesk/issues/821) |
| **P06** | Dispatch → crew → quality → recurrence | 70–130m | [#822](https://github.com/SaamVR/ServiceDesk/issues/822) |
| **P07** | Invoice + payment sandbox | 70–130m | [#823](https://github.com/SaamVR/ServiceDesk/issues/823) |
| **P08** | AI Studio/provider + feature merges | 75–135m | [#824](https://github.com/SaamVR/ServiceDesk/issues/824) |
| **P09** | Email/WhatsApp/Calendar | 75–135m | [#825](https://github.com/SaamVR/ServiceDesk/issues/825) |
| **P10** | SaaS plans + ops/backup | 60–120m | [#826](https://github.com/SaamVR/ServiceDesk/issues/826) |
| **P11** | Two-tenant UAT + release freeze | 90–150m | [#827](https://github.com/SaamVR/ServiceDesk/issues/827) |
| **P12** | Sellable deployment and rollback | 90–150m | [#828](https://github.com/SaamVR/ServiceDesk/issues/828) |

**Owner lanes:** PROD-01 principal integrator/merge control; PROD-02 environment/Supabase/RLS; PROD-03 auth/onboarding; PROD-04 catalog and pricing; PROD-05 request/quote; PROD-06 automation journal and outbox; PROD-07 dispatch/crew/QA/recurrence; PROD-08 ledger/Stripe; PROD-09 AI Studio provider wiring; PROD-10 WhatsApp/email/calendar; PROD-11 product acceptance/browser; PROD-12 security, reliability, deployment/release. Independent critic checks tenant-authority and business-value claims before signoff.

**Permitted merges:** Production controller alone may merge reviewed feature and historic PRs into `feat/servicedesk-v4-reconciled-qa-shell-20261012`, with a pin to exact head SHA. Use diff/file overlap review and an integration candidate tree before accepting. Classify 66 open PRs as MERGE_CANDIDATE, ALREADY_INTEGRATED/SUPERSEDED, NEEDS_REBASE/REBUILD, or DEFER, with a reason. Never cherry-pick all historic branches blindly.

## Strict runtime acceptance algorithm
1. Read this issue index, the applicable batch issue and canonical/PR HEAD. Freeze 2–5 nonoverlapping tasks with an expected observable business result.
2. Parallelize only genuine independent source/file/API work; assign a lead reviewer, record actual work-tool receipts. If no external subagent is running, say `logical lane only`.
3. Work every checkbox. When an approach repeatedly fails, diagnose cause after 2–3 identical probes, replace the broken approach, and preserve the task as BLOCKED if human action is required. Optional improvements never displace the batch business milestone.
4. **Do not mark a checkbox DONE** without source SHA, diff/tests/negative controls, and actual saved row/route/provider receipt when required. Once every checkbox is checked, append a one-line **`BATCH_DONE_VERIFIED: <exact-40-character-reviewed-Git-SHA>`** to the GitHub issue BODY and CLOSE the issue. The CLI batch selector treats closed issues without that marker or with unchecked boxes as INCONSISTENT rather than finished. Github full source gate is not operational staging/provider gate.
5. For Feature batches use focused regression and typecheck once per packet; for Production batches use focused tests early, real authenticated staging proof, then ONE exact-head combined full-source/Chrome/PG17/guardian gate per meaningful merge wave. Avoid GitHub Actions fan-out.
6. After execution, write a GitHub issue comment: `BATCH, START_SHA, END_SHA, PRS, completed checkboxes, verified evidence, BLOCKER, root-cause/fix, time budget vs work, NEXT_BATCH`. Update checks completed and master #808 pointer. If incomplete, next `continue` resumes THIS batch.
7. Save no secrets, passwords, customer PII or private access tokens in issues, logs or docs. Model provider and payments remain disabled until approved.
8. Never promise a fixed 30-minute background/continuous ChatGPT runtime; these estimates are engineering effort envelopes. A user turn or supported scheduled execution must explicitly start a new runtime.

## Critical path and dependencies
- Feature F01–F08 can proceed in their own chat while Production P01–P07 makes real operational staging usable.
- P08 merges candidate Feature PRs only after F08 **or** individually ready reviewed PRs required for staging, while preserving freeze. It does not require every post-MVP optional agent if not a sellable launch dependency; explicit deferrals must be logged at #808.
- P05 needs a reviewed staging-only 0063 migration approval; do not install 0064/65 merely because they are present in Git.
- P08–P09 need provider credentials and controlled authorization in the target secret store, not pasted in chat.
- P11 requires two-business request→priced quote→automation→visit→invoice proof with real saved records, not synthetic contract-test green alone.
- P12 is the single agreed sellable-release gate: exact candidate SHA, hosted staging parity, backup/recovery, monitored deployment, rollback and owner deployment authorization. Without prerequisites, final result is `BLOCKED_RELEASE`, never false `LIVE`.

## Secret and approval requests / exact operator handoff
1. **Render:** connection exposes workspace `My Workspace` (`tea-d1ihdsbipnbc73bpc8f0`), but the Render connector requires the owner to confirm the workspace before any services are inspected or changed. Ask owner to select it.
2. **Staging:** decide whether connected ServiceDesk Supabase project `cpmmgivhlkfbiwzhlcey` is allowed for **isolated fictional tenant writes** or request a separate staging project. Current read-only inventory was authorized by existing connection; no writes made.
3. **Accounts:** owner-authorized two fictional owner emails / controlled identities for protected staging login; no real customer data.
4. **Schema:** separate authorization to APPLY REVIEWED migration 0063 in staging after exact checksum, backup and rollback evidence. Do not assume 0064/65 approval.
5. **AI:** dedicated permissible commercial API project key or explicitly approved compliant gateway; configure in provider secret UI only, with usage cap and cost budget. Existing personal Codex OAuth is not a substitute.
6. **Providers:** sandbox Meta WhatsApp, Resend SMTP/email, Google Calendar OAuth and Stripe test credentials, only when P07/P09 become applicable. Configure via secret stores and connector setup, not raw chat messages.
7. **Release:** intended public domain, hosting plan/budget, trial pricing, email sender and whether production release/promotion is approved; separate final consent required before live deploy/provider sends/charges.
8. **Recovery:** encrypted historical device archives presently present in private GitHub, while independent Google Drive encrypted binary mirror and offline PFX export are unfinished; preserve all originals and no destructive cleanup.

## Handoff
- New feature chat: [FEATURE_CHAT_STARTER.md](./FEATURE_CHAT_STARTER.md).
- Current production chat: [PRODUCTION_RUNTIME_CONTRACT.md](./PRODUCTION_RUNTIME_CONTRACT.md).
- Final source of truth after handoff remains GitHub task issues, not stale assistant memory.
