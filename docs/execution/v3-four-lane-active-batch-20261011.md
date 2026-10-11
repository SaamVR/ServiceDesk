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
