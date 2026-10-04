# ServiceDesk AI V1 — Render Deployment (2026-10-05)

Status: PREPARED_NOT_DEPLOYED

## Deployment target
- User-specified Render project: `prj-db1bllqd0e5s73f0m03g`
- Render workspace: `tea-d1ihdsbipnbc73bpc8f0`
- Repository: `SaamVR/ServiceDesk`
- Deployment source branch: `rc/servicedesk-v1-source-freeze-20261005`
- Exact frozen SHA: `8b7066876263491c908f6453219d48e6300a8b17`

## Render inventory
Connected Render workspace inspection found no existing ServiceDesk web service.
Existing services belong to other products/projects.

No duplicate ServiceDesk infrastructure was created.

## Frozen application runtime
- Next.js 16
- Node `22.23.2`
- pnpm `10.17.1`
- Intended build boundary: frozen-lockfile install then `pnpm build`
- Intended start boundary: `pnpm start`
- Existing Supabase remains the PostgreSQL backend; no Render Postgres is required.
- Stripe/payment mode remains SANDBOX / DEMO ONLY.
- Frozen source contains no dedicated API health route; root/public HTTP route will be used for initial deploy health verification.

## Environment inventory

### Non-secret
- ServiceDesk Supabase URL: project ref `cpmmgivhlkfbiwzhlcey`
- Runtime environment name
- Public/base app URL after Render assigns it
- Payment mode: SANDBOX

### Secret references
Exact values must never be committed or printed.
Potential provider/runtime secret references include:
- Supabase service-role / secret key where server RPC composition requires it
- WhatsApp provider credentials
- Google Calendar OAuth credentials/tokens
- Email provider credential
- n8n/webhook signing secret
- AI provider key
- payment webhook signing secret if/when a controlled sandbox webhook is configured

The frozen provider adapters are dependency-injected and do not by themselves prove a complete environment wiring path.

## Deployment gate
Release policy requires:
- `REPO_RECONCILIATION=PASS`
- `SAMVR_RECONCILIATION=PASS`
- no secret-scan blocker

Current:
- Repository reconciliation: PASS
- samvr reconciliation: BLOCKED (device offline)
- full local secret scan: pending

Therefore no Render deploy was triggered yet.

## Next executable action
When `samvr` is reachable:
1. reconcile local ServiceDesk worktrees/stashes/commits;
2. run canonical grouped quality and secret gate;
3. if PASS, create/configure one Render Web Service from the frozen branch;
4. verify deployed SHA, build/boot logs and public URL;
5. run HTTP smoke and browser acceptance;
6. update this document with Render service/deploy identifiers and final status.
