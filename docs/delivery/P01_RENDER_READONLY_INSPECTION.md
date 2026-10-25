> **OWNER OVERRIDE — 2026-10-25:** Use **EXISTING** ServiceDesk Supabase project `cpmmgivhlkfbiwzhlcey` and **EXISTING** suspended Render service `srv-db5p1s142hec739noohg` ONLY. The earlier recommendation to create a separate staging service/database is rejected. Preserve original user data and Render deploy `3962aa5c84c3aa5f47ad72b62d51ae4382467708`; do not create paid or extra resources. [Final owner decision](https://github.com/SaamVR/ServiceDesk/issues/829) · [P02 shared-infrastructure preflight](./P02_SHARED_INFRA_AUTH_PREFLIGHT.md).

# P01 — Render workspace and actual ServiceDesk service: read-only inspection

**Inspection date:** 2026-10-25. **Authorization scope:** owner confirmed connected Render `My Workspace` for READ-ONLY ServiceDesk inspection; no permission to deploy, resume, create or change any service.

## Provider-observed inventory

- Selected workspace: `My Workspace` / `tea-d1ihdsbipnbc73bpc8f0`.
- Total listed services across projects: **25**; ServiceDesk repository matches: **1**.
- Service: [`servicedesk-v3-frontend-review`](https://dashboard.render.com/web/srv-db5p1s142hec739noohg), ID `srv-db5p1s142hec739noohg`.
- URL: https://servicedesk-v3-frontend-review.onrender.com ; Render type `web_service`, plan `free`, region `virginia`.
- Repository: `https://github.com/SaamVR/ServiceDesk`; configured branch **`deploy/servicedesk-v3-public-review-20261011`**.
- Deployment controls: `autoDeploy=no`, `autoDeployTrigger=off`, `previews.generation=off`.
- Provider service lifecycle: **`suspended`**. No running ServiceDesk V4 staging application was identified in this authorized workspace.
- Most recent recorded deploy `dep-db9gv3rrjlhs73epr34g`, last deploy object `status=live` on October 17, 2026, at SHA `3962aa5c84c3aa5f47ad72b62d51ae4382467708`. **"live" here is historic deployment status, not proof the currently suspended service responds.**
- GitHub branch `deploy/servicedesk-v3-public-review-20261011` currently points at this same older SHA.
- HTTP `/health` from the public service was not accessible using the inspection client; no health or build-provenance claim.

## Comparison with canonical V4

- Canonical application branch `feat/servicedesk-v4-reconciled-qa-shell-20261012` at `974e9f040071b1a2c1199c7ff6fb652a67812a47` remains *source-verified* via [GitHub app/Chrome](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003445), [PG17](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003465), [guardian](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003408).
- Compare **Render's old deployment SHA ... canonical V4**: **`diverged`, 657 ahead / 50 behind**. A force-push or direct switch of the historic preview may overwrite divergent review history; never perform it without exact release authorization.
- Tracked `render.yaml` refers to a different historic V2 review branch `feat/servicedesk-v2-multilane-20261006`, and should not be assumed to represent this actual V3 service.
- Therefore `SOURCE_VERIFIED=true` but `DEPLOYMENT_V4_VERIFIED=false`, `STAGING_V4_VERIFIED=false`.

## Proposed safe staging path — awaiting owner decision

**Preferred:** preserve the suspended V3 review service and provision/configure a *separate isolated V4 staging web service* using a pinned canonical V4 SHA or dedicated release candidate branch with autodeploy off, and a separate nonproduction Supabase staging project (or explicit approval to use existing `ServiceDesk` DB with fictional-only data). Record the actual full deploy SHA and compare its authenticated `/health` to host metadata before any tenant acceptance.

**Do not** unsuspend the old review service, run an API deployment, change `render.yaml`, create paid resources, repoint custom domains or apply SQL without a separate authorization and budget.

**P01 conclusion:** Render inspection criterion is DONE, but choosing/approving a V4 staging *target* is PENDING_OWNER. P01 stays open for staging target decision. The remainder of P01's PR audit and source proof is in [P01 topology/merge order](./P01_ENV_AND_MERGE_ORDER.md) and [67-PR audit](./P01_PR_AUDIT.md).
