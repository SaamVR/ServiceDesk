# ServiceDesk V3 — Four-lane active implementation packet (11 October 2026)

This packet is an execution contract and measured status receipt, NOT an assertion that separate ChatGPT conversations or background agents have been activated. Read `AGENTS.md`, `docs/execution/coordinator-four-chat-20261004.md`, `docs/execution/v3-parallel-recovery-20261011.md` and frontend direction in `docs/design/v3-frontend-overhaul-direction-20261011.md`.

## Verified coordinator baseline

- Repository `SaamVR/ServiceDesk`. W3 coordinator branch `feat/servicedesk-v3-coordination-20261011`.
- Integrated backend candidate A: `2a5f44e845880410719783ed076bffec1d9bba40` with recorded hosted 1,437/1,437 passing tests.
- Additional W3 smoke PR #81 code at `3042ecb5b8c37f29d3754a548f9c5c09667b9522` was reviewed and merged into coordinator at `6160f3e332a48b2b2817fbd2eb8e3d93dc523560`.
- W3 Node smoke test source and test Git blob hashes matched GitHub: `7094debbd64c733d6cb08cb8725b49bebcc3dfaf` and `188a2c7b8f334928aebfcab140dfbce04d986a4b`. Node 22 `--check` PASS; `node --test scripts/release/v3-staging-auth-smoke.test.mjs` **6/6 PASS**. Tests used an injected HTTP mock; no browser or deployed live receipt.
- This smoke-only coordinator merge did not promote the application or migrate databases. The deployed isolated gate source is still reported as `2a5f44e...` pending independent host confirmation.
- Repo/private network was unavailable in the current GPT Runtime container. Connected GitHub integration was used for CAS source writes; Node-native checks could run only after copying the exact source/test blobs and verifying hashes. Vitest/Next full-package checks and authenticated browser evidence remain outstanding, not silently converted to PASS.

## W1 — core/domain, ACTIVE_IMPLEMENTED (new tests not yet Vitest-verified)

- Branch: `feat/servicedesk-v3-core-readiness-20261011`, observed latest head `0e18b9c2d7c44654ff56eba01cc059a92048f117`.
- Delivered: `resolveAuthorizedStaffWorkspaceSelection` uses already RLS-filtered membership rows to authorize an explicit selected workspace ID, fails closed on revoked/crew-only/unknown/unsafe inputs and preserves higher active staff role. Changed only `src/domain/auth/authorized-workspace-selection.ts` and `tests/domain/authorized-workspace-selection.test.ts`.
- Evidence: four independent Node 22 TS-strip probes against byte-for-byte GitHub source blob `3b9a71573e29c608893221ac8262d5411ddccb29`, 4/4 PASS. **This is not the repository Vitest test run**.
- READY next: run `pnpm exec vitest run tests/domain/authorized-workspace-selection.test.ts`; `pnpm typecheck`; review route-consumer contract and conflicting same-workspace slug safety. Do not edit frontend-owned `src/app/**` or bypass RLS. **Do not merge newer W1 batch until canonical package check succeeds.**

## W2 — integrations/provider reliability, ACTIVE_IMPLEMENTED (new tests not yet Vitest-verified)

- Branch: `feat/servicedesk-v3-provider-reliability-20261011`, head `779e618694175f57f5b383f0f2bf2943033c84c3`.
- Delivered: Resend idempotency key input now fail-closes for whitespace, CRLF/control characters and non-ASCII before transport; preserves 256-character valid boundary. Only `src/server/integrations/email/transport.ts` and `tests/providers/resend-transactional-email-contract.test.ts` changed.
- READY next: `pnpm exec vitest run tests/providers/resend-transactional-email-contract.test.ts` plus generic email transport regression, `pnpm typecheck`. Next independent code slice: test provider success/invalid-message ID and transient-retry classifications with injected transport; do not make real provider send without explicit approval.
- Evidence: Node 22 experimental TypeScript transform + read-only extensionless-import resolver exercised the **exact hash-verified GitHub source** (`transport.ts` blob `82e10e523e5c4902ff03139a7fb25c280c945dba`, `adapter.ts` blob `36c86ac8a1d5c7bca117a22e6870a4319ed897b7`). Three independent mock-transport contract probes PASS: provider payload/redaction, injection/256-character boundary, fail-closed endpoint and opt-out. No real provider requests. The authored repository Vitest test is still not executed.
- Status: **IMPLEMENTED with isolated Node behavior proof**; original Resend REST mapping was verified in candidate A, but this later header-hardening revision has not run full Vitest/typecheck or official provider acceptance.
 
## W3 — coordinator/integration/release, CONTRACT_TESTED for Node smoke slice only

- Branch: `feat/servicedesk-v3-coordination-20261011`; W3 smoke change merged by PR #81, coordinator SHA `6160f3e...`.
- READY next: review W1/W2 updated diffs (source/tests only, four files total); execute fresh focused Vitest and TypeScript checks against both proposed SHAs; integrate only if accepted. Run one combined `pnpm check:rc` on the integrated candidate, instead of repeating serial full Render builds per worker.
- For release acceptance, browser-check the exact deployed integration SHA at 320/390/834/1280/1440 and save screenshots against authenticated nonproduction workspace only after permitted test identity is available. Host availability may cold-start; do not infer browser PASS from Render LIVE.
- Gate constraints: issue #75 migration 0037 rejected pre-execution; 0037–0059 blocked. No bypass or skipped schema versions. Supabase Auth SMTP is owner-reported configured, but controlled delivered confirmation and session proof absent. Signup remains disabled; never flip production/auth flag or access production payment flows to accelerate visual work.

## W4 — independent frontend overhaul, READY FOR SEPARATE CHAT ACTIVATION

- Reserved branch: `feat/servicedesk-v3-ui-overhaul-20261011`, last observed SHA `b2b153d57213bb2f5f4aea1473a205b359b53a9b` (no frontend commits yet).
- Exclusive code ownership: `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`, `tests/e2e/**`. No edits to W1/W2 domains, provider code, shared contracts, package/config, coordinator ledger or render/service resources. No unreviewed push to the gate.
- First READY batch (**actual coded deliverables**, not Figma-only): implement coherent global shell/navigation + design tokens, Today operational overview, and Inbox master/detail using existing authorized runtime reads/actions. Compare the three distinct design directions from the approved creative brief before choosing. Do not claim owner aesthetic acceptance without screenshot review.
- Respect 320/390/834/1280/1440 breakpoints, keyboard and screen reader use, status labels, reduced motion, stable mobile navigation and original role/tenant controls. No fake counts, fixtures in real operator CTAs, payment promises or heavy dashboard 3D.
- W4 must author code + UI/browser assertions and take real Chromium screenshots before/after, including empty and permission-denied states. Open draft PR against coordinator once the first meaningful wave is ready. The W1 selection resolver is **not** an auth boundary; consume it only after integration/typecheck and from verified RLS-filtered server membership data.
- Operator must explicitly activate the separate frontend chat; writing this packet is not a background launch.

## Integration barriers and release truth

- W1/W2 latest code branches are **not** integrated into coordinator; no claim of `pnpm check:rc` on those new changes.
- All four lanes cannot be asserted concurrently active unless separate sessions/workers actually execute.
- Platform rejected connected-project migration 0037. Do not bypass the safety gate. See https://github.com/SaamVR/ServiceDesk/issues/75
- Auth email receipts, authenticated end-to-end owner journey and real provider acceptance still pending.
- Keep V2/main untouched. No resets, rebases or force-pushes. Only merge after path review and real checks; update this ledger with exact acceptance evidence.

## Candidate B and focused PR validation checkpoint

- Exact read-only CAS compare verified candidate B branch `feat/servicedesk-v3-candidate-b-20261011` is **four commits ahead, zero behind** coordinator base `62cc6fd9087d2b52a6ed928df393c19332c5d979`; only the four W1/W2 owned source and test paths changed. Candidate head `7b9f4f1a00a87524397dd45d498d8fb4b7d7db09`.
- Review PR: https://github.com/SaamVR/ServiceDesk/pull/82 — now ready for review but **not merged**. `IMPLEMENTED` with isolated source tests; full `pnpm check:rc` and staged Render browser evidence still required. Coordinator remains free from these unverified changes.
- Controller-only low-cost CI added in `.github/workflows/v3-focused-pr.yml` at `d08faab0f4156899804b2ea1891ab9219cbb4068`: triggers on relevant V3 coordinator-targeted pull requests, one eight-minute job, Node smoke unit check, targeted W1+W2 Vitest and TypeScript check, read-only GitHub permissions, no secrets. This is **workflow implementation**, not a claim that CI has run.
- When checked, GitHub's `fetch_commit_workflow_runs` returned **zero runs** for the candidate SHA. Do not claim GitHub Actions PASS until run conclusion/commit and logs are observed. Do not rerun unchanged infrastructure on every turn.
- Public Render page retrieval was unavailable via the current read-only web tool. Render connector did not have a user-selected workspace and required the owner to choose one; no Render workspace or deployment operations performed, no live browser assertions made.

## V3 sustained implementation checkpoint — 11 October, ~07:42 Asia/Dhaka

This addendum updates earlier temporary REVIEW/PENDING statuses; all SHA evidence is source-specific.

**W1 + W2 integrated into coordinator**, not canonical/main: PR #82 accepted as `19468334ccbdde41b26e9aeddb65a255685f249e` following verified GitHub Actions run [38102291787](https://github.com/SaamVR/ServiceDesk/actions/runs/38102291787) for exact candidate `2236f57269dbfe86c429718803ac4d58240a3f91`. Focused release-smoke Node tests, domain/Resend Vitest regressions, and `pnpm typecheck` all completed successfully. W1 now rejects contradictory duplicate workspace slugs and resolves tie names deterministically. W2 now rejects unsafe Resend idempotency headers and malformed/synthetic-alias provider success IDs. Code/tests were reviewed as a four-file path-isolated candidate before merging. **Targeted CONTRACT_TESTED**, not production/provider verified; full `pnpm check:rc` against coordinator still required. No new isolated Render deploy has been promoted.

**W4 code implemented and CI tested** on exclusive `feat/servicedesk-v3-ui-overhaul-20261011`; frontend PR [#83](https://github.com/SaamVR/ServiceDesk/pull/83) is reviewable but **UNMERGED** pending browser/visual acceptance. W4 reconciled the coordinator into its branch using a history-preserving two-parent commit `8a05bbe88d0c08907c9a98178558a1d8e1c660ca` after verifying zero conflicting paths. W4 now includes:
- Signal Desk staff application chrome, Cmd/Ctrl+K accessible command palette over thirteen real routes, task-linked Today summary, and stable/tie-safe Inbox triage;
- Authenticated RLS-backed multi-workspace membership loader, explicit `/auth/select-workspace` chooser, `/auth/continue` routing for NONE/STAFF/CREW/CHOOSE and a staff header switch link; no route/user-metadata role grants;
- All existing protected destination checks, server-domain authority, customer and crew boundaries unchanged, registration disabled.

GitHub Actions [38102684008](https://github.com/SaamVR/ServiceDesk/actions/runs/38102684008), exact W4 head `1246f7e861f478d274408e75e5c4eb630cf7a2e0`: **5/5 test files and 28/28 tests PASS**; TypeScript PASS; focused ESLint PASS. Independently, exact-source Node/strict-TS probes verified command search and Inbox tie policies. This evidence is **CONTRACT_TESTED for focused frontend suites**, not Chromium screenshots, complete `pnpm check:rc`, SMTP/provider delivery, or owner visual acceptance.

**Still blocked / intentionally unchanged:** connected Supabase at migration `0036` with platform safety rejection of `0037` (issue #75), no 0037–0059 skip or bypass, owner-reported Supabase Auth SMTP with no confirmed recipient/session evidence, sign-up disabled, no provider send or payment writes, no canonical V2/main promotion. The Render integration gate remains at its prior deployed source until exact-sha release acceptance. Independent UI browser screenshots at 320/390/834/1280/1440 still required. No separate background chat worker was claimed.

**Next immediate validation:** capture actual browser screenshots from an authorized nonproduction workspace, run one complete `pnpm check:rc` on the prospective combined coordinator+W4 candidate in GPT Runtime/authorized environment, review the indigo Signal Desk visual direction with owner, and only then merge the frontend PR. Do not spend multiple cycles re-auditing unchanged blockers or redoing accepted W1/W2 work.

## V3 sustained backend implementation + exact coordinator RC — 11 October 2026, ~08:30 Asia/Dhaka

**Supersedes prior pending statements for W1/W2 backend candidates only.** The owner explicitly rejected the current frontend/Signal Desk visual design; [W4 PR #83](https://github.com/SaamVR/ServiceDesk/pull/83) stays OPEN/UNMERGED for a separate owner-activated redesign and genuine Chromium review.

Four substantive backend implementation batches have passed focused checks and full `pnpm check:rc` and merged into the **V3 coordinator only**:

| Candidate | PR | Merge commit | Behavior delivered |
|---|---|---|---|
| E | [#86](https://github.com/SaamVR/ServiceDesk/pull/86) | `22e702f7199ff23c0c4c1f47f71218d35b39289a` | Durable outbox: isolate DB exceptions, never send foreign-lease rows; bound provider Retry-After; de-duplicate recovery replays, invalid timestamp/ambiguous-lease hold; 7 W1/W2 source+test files |
| F | [#87](https://github.com/SaamVR/ServiceDesk/pull/87) | `b38ef60039fedb4e09d39a2c9ada7245877c4eec` | Preserve **actual PostgreSQL `lockedBy`**, stop laundering wrong lease owner; validate persisted provider recovery envelope, action/queue concordance, redact recipient PII/credentials |
| G | [#88](https://github.com/SaamVR/ServiceDesk/pull/88) | `5bf7225a50043cd9c3c063f73b69105cde9a22ae` | Bounded AI model transport; valid JSON `null`/primitive/malformed and oversized tool/reply payload correctly classify INVALID_RESPONSE, not NETWORK_FAILURE; finite timeout |
| H | [#89](https://github.com/SaamVR/ServiceDesk/pull/89) | `1bc7f1fb9134059afc315f86aa4b616f2450eaee` | Official OpenAI Responses transport: `text.format`, `store:false`, scalar metadata, `output[].content[].text` parsing; incomplete/refusal fail closed, synthetic provider tests; no real API call |

**Test history:** PR #86 first exposed TS duplicate object key and Vitest mistakenly discovering the Node-native smoke test; both corrected without bypassing tests. The Node smoke continues as `node --test`, Vitest excludes that separate suite. Final PR #86 CI [38104625792](https://github.com/SaamVR/ServiceDesk/actions/runs/38104625792) was GREEN with 1,465/1,465 tests and Next build. PR #87 [38104760392](https://github.com/SaamVR/ServiceDesk/actions/runs/38104760392), PR #88 [38104946142](https://github.com/SaamVR/ServiceDesk/actions/runs/38104946142) and PR #89 [38105098119](https://github.com/SaamVR/ServiceDesk/actions/runs/38105098119) each passed focused and full RC gates against exact PR heads.

**Final combined gate:** code+workflow coordinator commit `c3410438e4eb4977a89546c7a006c044c4ad3335`. GitHub Actions push [38105252436](https://github.com/SaamVR/ServiceDesk/actions/runs/38105252436) **PASS** on the exact integrated commit:
- Node release-smoke: 6/6 PASS.
- Focused backend suite: 10/10 files, **78/78 tests PASS**.
- Full `pnpm check:rc`: **356/356 files, 1,476/1,476 Vitest tests PASS; TypeScript PASS; ESLint 0 errors/9 warnings; Next production build PASS**, including 32 static pages generated.
- GitHub Actions push gate is scoped to backend source/workflow changes; documentation-only commits do not retrigger builds. These are executable GitHub-hosted CI checks, not fabricated GPT Runtime/browser/provider receipts.

**Release status: NOT LAUNCH APPROVED.** The original isolated Render integration gate remains pinned to previously reviewed SHA until independent deployment acceptance; no preview/prod promotion happened in these batches. Connected Supabase schema still last confirmed `0036`, 0037 platform safety rejected ([issue #75](https://github.com/SaamVR/ServiceDesk/issues/75)); do not bypass/migrate out of order. Supabase Auth SMTP configured by owner but controlled email-confirmation delivery/session receipt unverified; registration disabled. REST Resend and OpenAI tests are **CONTRACT_TESTED**, not live provider verification. No live messages/payments, tenant data edits, canonical V2/main edits, or credential exposure. Visual redesign must be approved with actual browser screenshots at 320/390/834/1280/1440, not inferred from tests.

**Next high-leverage work:** Let the owner-activated W4 chat own the complete visual overhaul on its branch; W3 reviews and merges it only after genuine screenshot/UX acceptance and combined RC. In parallel W1/W2 continue feature slices tied to operational use, not repetitive documentation. Resolve migration 0037 only through a supported platform/owner path, then verify real auth email, RLS session, controlled provider callbacks, and exact-sha staged browser walkthrough. Do not claim four independent conversations are running without observed worker evidence.
