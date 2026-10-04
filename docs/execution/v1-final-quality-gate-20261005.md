# ServiceDesk AI V1 — Final Quality Gate (2026-10-05)

Status: PARTIAL / DEVICE_BLOCKED

## Frozen candidate
- Source branch: `rc/servicedesk-v1-source-freeze-20261005`
- Source SHA: `8b7066876263491c908f6453219d48e6300a8b17`
- Release evidence branch: `release/servicedesk-v1-render-20261005`
- Source code was not modified.

## Repository reconciliation
- Frozen branch resolves exactly to the expected SHA.
- `rc/servicedesk-v1-unverified-20261004` resolves to the same SHA.
- Final E10B receipt files are present in the frozen tree.
- Durable migration files are present through `0015a_e10b_read_helpers.sql`.

Verdict: `REPO_RECONCILIATION=PASS`

## Canonical executable gate
Required by release policy:
- pnpm install / frozen-lockfile install
- typecheck
- Vitest/unit tests
- lint
- build
- local secret scan
- migration/static checks
- package-free acceptance harnesses where applicable

Current execution state:
- `samvr` was initially reachable, then became unresponsive and is now offline.
- Because the required device gate cannot currently execute, no canonical PASS is claimed.
- GitHub Actions were not used.
- `samai` was not used as a substitute for claiming the canonical `samvr` PASS.

Verdict: `CANONICAL_QUALITY_GATE=BLOCKED_DEVICE_OFFLINE`

## Static deployment requirements
Observed from frozen source:
- Framework: Next.js 16
- Runtime: Node
- Node version: `22.23.2` from `.nvmrc`
- Package manager: `pnpm@10.17.1`
- Build script: `pnpm build`
- Start script: `pnpm start`
- No dedicated Next.js API/health route exists in the frozen source.
- Root/public route must be used for initial Render HTTP health verification unless an explicitly authorized release-only source change is later made.

## Secret scan
A full local candidate secret scan remains required on `samvr`.
No secret values were printed or added during release preparation.

Verdict: `SECRET_SCAN=TO_RUN_ON_SAMVR`

## Database release checks
Dedicated Supabase project:
- Name: ServiceDesk
- Ref: `cpmmgivhlkfbiwzhlcey`
- State: `ACTIVE_HEALTHY`
- PostgreSQL: 17
- Region: us-east-1

Observed migration history matches the repository migration chain through `0015a`.

Current proof-data sanity:
- workspaces: 0
- auth users: 0
- requests: 0
- quotes: 0
- capacity slots: 0
- slot holds: 0

Service-role command RPC inspection:
- Service-role EXECUTE is present on the ServiceDesk command RPCs sampled across request/quote/capacity/payment/visit/conversation/reporting flows.
- Command RPCs are denied to `anon` and `authenticated` in the sampled matrix.

Known security advisor warnings remain:
- `citext` installed in `public`.
- `has_active_membership(...)` is SECURITY DEFINER and executable by `authenticated`.
- `is_customer_for_workspace(...)` is SECURITY DEFINER and executable by `authenticated`.
- RLS enabled with no policy on `invitations` and `servicedesk_command_idempotency` is known/intentional deny-all behavior from prior acceptance.

Leaked-password protection remains a production configuration gate and is not claimed enabled.

## Current release decision
`PRODUCTION_RELEASE_BLOCKED`

Blocking items:
1. `samvr` reconciliation and canonical quality/secret gate.
2. Render deployment has not yet been created from the frozen candidate.
3. Post-deploy smoke and browser acceptance have not executed.
4. Supabase leaked-password protection status is not verified as enabled.
5. Controlled provider proof remains separate; Stripe/payment policy remains SANDBOX-only.
