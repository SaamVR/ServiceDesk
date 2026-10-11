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
