# ServiceDesk AI V1 — Render Deployment (2026-10-05)

Status: DEPLOYED_LIVE

## Deployment target

- Render workspace: `tea-d1ihdsbipnbc73bpc8f0`
- Repository: `SaamVR/ServiceDesk`
- Candidate branch: `rc/servicedesk-v1-release-candidate-20261005`
- Exact deployed SHA: `b966bb685729a2e8e19b7c46d764d871672a1636`
- Service: `servicedesk-ai-v1-rc`
- Service ID: `srv-db1e069srm7s73b8fr30`
- Deploy ID: `dep-db1e06psrm7s73b8fufg`
- Public URL: `https://servicedesk-ai-v1-rc.onrender.com`
- Region: Virginia
- Auto-deploy: OFF

## Predeploy gates

- `REPO_RECONCILIATION=PASS`
- `SAMVR_RECONCILIATION=PASS`
- `CANONICAL_QUALITY_GATE=PASS`
- `SECRET_SCAN=PASS`
- Supabase migration parity through `0015a`: PASS
- proof fixture cleanup: PASS

## Render build

Runtime:
- Next.js 16.3.8
- Node `22.23.2`
- pnpm `10.17.1`

Pinned build command asserted exact SHA `b966bb685729a2e8e19b7c46d764d871672a1636`.

Render evidence:
- checkout exact candidate SHA: PASS
- production compilation: PASS
- TypeScript build phase: PASS
- static generation: PASS
- build upload: PASS
- Render status: `Build successful 🎉`
- runtime start: `pnpm start`
- Next.js ready on port 10000
- Render status: `Your service is live 🎉`

Deploy final status: `live`

## Public HTTP smoke

Executed from `samvr` against the Render URL after the deploy reached live.

HTTP 200:
- `/`
- `/b/brightroom`
- `/b/brightroom/enquire`
- `/portal`
- `/crew/today`
- `/onboarding`
- `/presentation`
- `/app/demo/overview`
- `/app/demo/inbox`
- `/app/demo/settings`

Verdict: `RENDER_HTTP_SMOKE=PASS`

## Current deployment state

`DEPLOYED_NOT_RELEASE_VERIFIED`

The application is live on Render. Remaining production-release gates are browser acceptance, Supabase production security configuration, and controlled provider evidence where required. Stripe/payment remains SANDBOX-only by owner policy.
