# ServiceDesk V3 — High-Throughput Multilane Recovery (2026-10-11)

## Verified shared baseline

V3 code ref `b2b153d57213bb2f5f4aea1473a205b359b53a9b`, isolated preview
`https://servicedesk-v2-multilane-gate.onrender.com`; canonical V2
`5be389feb0bd0661df637780ef2e7d61071c459c` is intentionally
unchanged. Verified connected ServiceDesk Supabase migration history contains
43 records through `sd_0036_v2_commercial_direct_cost_schema`. The source
contains remaining 0037–0059, but 0037 was blocked by platform safety checks.
Owner reports Resend SMTP configured; actual confirmation delivery is not
verified. Registration flag remains false.

## Operational failure to correct

Repeated single-lane Auth micro-fixes and serial full Render build polling
displaced implementation work. A green build was repeatedly confused with
commercial readiness, while the frontend direction was not accepted.
The controller must run one integration-level quality gate per substantive
batch and prevent slow provider/configuration gates from blocking unrelated
development. No fabricated parallel agents or wall-clock run durations.

## Lane contract and ownership

| Lane | Branch | Exclusive code scope | This batch deliverable |
|---|---|---|---|
| W1 Core/domain | `feat/servicedesk-v3-core-readiness-20261011` | `src/domain/**`, `tests/domain/**` | Pure authorized workspace-selection policy, role/dedup/path safety and eleven domain tests (PR #78) |
| W2 Connectors | `feat/servicedesk-v3-provider-reliability-20261011` | `src/server/integrations/**`, `tests/providers/**` | Official Resend transactional payload mapping, endpoint and idempotency validation with six tests (PR #79) |
| W3 Coordinator/release | `feat/servicedesk-v3-coordination-20261011` | Integration, shared configs, release ledger only | Review W1/W2, integrate after genuine checks; audit signup/SMTP/Render, publish acceptance and blocker receipts |
| W4 Independent frontend chat | `feat/servicedesk-v3-ui-overhaul-20261011` | `src/app/**`, `src/features/**`, `src/components/**`, `src/styles/**`, `public/**`, UI e2e tests | Replace rejected frontend direction, design system, operational shell, owner dashboard, inbox, dispatch and browser proof |

W4 must read AGENTS and the coordinator packet before editing. W4's shared
workstream begins only when the owner starts that independent chat; this
document is not an assertion that background agents were spawned. The model
orchestrating W4 should use GPT Runtime/Work and provide commits and screenshots
without modifying server/domain/provider files or pushing to gate directly.

## Critical constraints

- Only `feat/servicedesk-v3-coordination-20261011` integrates backend branches.
  Never reset, rebase, force-push or mutate V2 canonical/main.
- Never bypass Supabase 0037's platform safety rejection. Backend workers
  remain free to implement and validate independent code while a supported
  operator resolves issue #75.
- No production payment, credentials, CMS, customer data, live webhook or
  provider-send mutation without independent explicit authorization.
- Do not expose Resend, Stripe, Supabase service-role or project secrets.
- A commit with authored tests is `IMPLEMENTED`, not
  `CONTRACT_TESTED`; real tests/build and acceptance receipts are required.
- Render Free can cold-start with 503; do not equate its `LIVE` deploy label
  with uninterrupted readiness. See issue #77.
- W1's pure resolver is NOT a security boundary. Frontend W4 must obtain
  memberships through authenticated Supabase RLS and preserve server-side
  authorization on each destination.
- W2's REST Resend endpoint is for business transactional email, **not**
  Supabase Auth SMTP. Neither source tests nor hosted Auth settings prove
  a delivered account-verification message.

## Concrete execution rhythm

1. Verify actual HEAD and worktree cleanliness on every lane.
2. Run independent READY slices concurrently; each must produce a real
   behavior change and targeted tests, with one safe fallback.
3. After each worker PR, compare commit ranges and check exclusive paths.
4. Integrate once on W3, run focused tests and one `pnpm check:rc`
   via the supported execution environment. Render release build is a
   real hosted test only if exact SHA and successful logs are captured.
5. Browser-audit the exact deployed SHA. Confirm RLS, disabled signup and
   no localhost redirects. Save receipt on GitHub.
6. Continue the next non-conflicting READY slice; do not wait idly for
   SMTP/migration resolution or repeatedly poll unchanged infrastructure.
7. Report after ~25 minutes active development or at durable checkpoints:
   shipped commits, tested outcomes, unresolved blockers and next tasks.

## Today: ordering and dependencies

- **T1** (W1): authorized workspace-switch decision contract —
  implementation branch PR #78; W4 may consume only after W3 review/accept.
- **T2** (W2): Resend business transactional send interoperability —
  implementation branch PR #79; do not confuse with Supabase Auth SMTP.
- **T3** (W3): read-only provider/db/hosting health, merge validated W1/W2,
  release smoke and exact SHA.
- **T4** (W4): professional owner-operational redesign, including app shell,
  high-density yet legible dashboard and inbox, purposeful motion,
  320/390/834/1440 responsive evidence, and workflow correctness. No
  fixture-only actions.
- **T5** external database gate (issue #75): supported authorized execution
  of migration 0037–0059 in order, then RPC grants/tenant proof; **BLOCKED**.
- **T6** Auth delivery gate: approved temporary sender
  `no-reply@ezcomo.shop`, SMTP owner-reported configured, actual verification
  email/confirmed-session receipt **NOT VERIFIED**.
- **T7** product launch: meaningful role-based workflow acceptance after
  T5/T6, no production payment use.

## Stop conditions

No unvalidated merge into canonical/main. No false claim that signup is live.
If Runtime cannot run checks, preserve unverified WIP on branch and continue
independent READY work, instead of reporting test PASS. External paid hosting
upgrades need cost approval. Frontend owner sign-off on visual approach
must be based on real browser evidence, not a design-only PDF.

## Next integration receipt

Record W1/W2 PR SHAs, comparison file lists, check command outputs, combined
candidate commit SHA, release deployment ID, actual browser result and each
blocker in the next addendum to this file.


## Integration receipt — Combined Backend Candidate A (2026-10-11)

- Source base: `b2b153d57213bb2f5f4aea1473a205b359b53a9b`.
- W1 PR **#78**, accepted branch HEAD
  `738a69bf463d3e4fd385faddeb1dd8ff79678103`,
  merge SHA `302f10dae886233b7289cca9cd4d0b16651cbcea`;
  changed only `src/domain/auth/authorized-workspace-selection.ts` and
  `tests/domain/authorized-workspace-selection.test.ts`.
- W2 PR **#79**, accepted branch HEAD
  `2e14fca2879a9c523fd8ff1290ec2debc225e90a`,
  combined merge SHA **`2a5f44e845880410719783ed076bffec1d9bba40`**;
  changed only `src/server/integrations/email/transport.ts` and
  `tests/providers/resend-transactional-email-contract.test.ts`.
- Real test environment: isolated Render build using current gate branch,
  deployment **`dep-db5deflckfvc739qp6bg`**. Exact source SHA
  **`2a5f44e845880410719783ed076bffec1d9bba40`**.
- **Test results: `355/355` files and `1,437/1,437` tests PASS.**
  New W1 domain suite `11/11` PASS; new W2 Resend contract `6/6`
  PASS; existing generic email-provider transport suite remained PASS.
- `pnpm check:rc`: TypeScript PASS; ESLint zero errors / nine existing
  warnings; Next.js production compilation and route generation PASS.
  Build upload reported successful.
- Render deploy reported **LIVE** at
  `2026-10-11T00:27:29.715355Z`. Public URL:
  `https://servicedesk-v2-multilane-gate.onrender.com`.
  **This is deploy + contract-test evidence, not a real provider receipt,
  authenticated UI test or a live new-account signup.**
- Canonical V2 untouched; ServiceDesk Supabase migrations not changed in
  this integration. W1 domain function is a reusable *pure policy*:
  an authenticated UI query/chooser is still needed to use it.
  W2 Resend mapping is for business transactional HTTP mail, separate
  from owner-reported configured Supabase Auth SMTP; no provider email
  was sent.
- Frontend branch
  `feat/servicedesk-v3-ui-overhaul-20261011` is reserved and based
  on the original candidate SHA. It needs activation in a new independent
  Work chat; **no frontend work or browser screenshot evidence is claimed
  by this backend merge**.

### Readiness

Backend integrated candidate A: **CONTRACT_TESTED**. Real operational
acceptance: **CONFIGURATION_BLOCKED** until owner signup migration 0037–0059
and controlled email confirmation/e2e journey pass. Customer-ready
release: **NOT AUTHORIZED / NOT VERIFIED**.

### Next focused work

W1: consume pure selection contract only through verified authenticated RLS
membership results (coordinator/frontend cross-lane handshake) and test
0/1/multiple business routing. W2: wire compatible Resend transport into
a durable authorized outbox only when provider credentials and mode are
explicitly approved; do not treat SMTP configuration as API wiring.
W3: resolve migration 0037 with platform support, not bypass; maintain
a single integration gate per batch. W4: execute UI redesign brief on
its exclusive branch with real browser before/after images.
