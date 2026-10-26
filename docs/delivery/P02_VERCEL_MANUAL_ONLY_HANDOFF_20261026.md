# P02 Vercel manual-only hosting handoff — owner directive 2026-10-26

**Owner selected Vercel instead of Render and explicitly prohibited ALL deployment until separately authorized.** This document is a release policy and a source preparation guide. **No Vercel project, preview, staging or production deployment was created in this step.**

## Read-only inventory

- **Connected Vercel team:** `Samvrc`, slug `samvrc`, ID `team_SwFPLhTkG0XpAX3RQ8B4vbLt`. Account plan: **Hobby**.
- **Repo:** [`SaamVR/ServiceDesk`](https://github.com/SaamVR/ServiceDesk). Read-only Vercel project lookup by repository and by `servicedesk` name returned **no ServiceDesk project**. Six connected projects were seen for unrelated repositories; those are out of scope.
- **Verified V4 GitHub canonical source at this directive:** `1003075d1bfcefb6415d6c9a4bdda9c57a0546ff`. GitHub-only previous release-candidate ref `deploy/servicedesk-v4-p02-rc-20261026` points to `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4`, which predates the Vercel policy. **Neither SHA is deployment authorization.**
- **Current main database:** existing Supabase `cpmmgivhlkfbiwzhlcey`, with owner-approved membership authorization patch migration `sd_0065_v4_default_branch_membership_authority` installed. Migrations `0063`/`0064` remain unapplied/unapproved.
- **Old Render service:** `srv-db5p1s142hec739noohg`, historically suspended on V3 `3962aa5c84c3aa5f47ad72b62d51ae4382467708`; preserve unchanged for evidence and rollback planning. **Render is no longer the selected future host.**

## Strict owner gate — applies to ALL environments

**No project creation that deploys; no Git import/link that can automatically deploy; no previews, branch deployments, staged builds published to Vercel, production deployments, promotion, rollbacks, aliases/domains, or deployment-triggering environment changes without an explicit new user approval.** A generic `continue`, an approved source PR, this hosting selection or a green CI job is **not** approval.

Before any future Vercel creation/link, first merge and verify source-only [P02 Vercel manual-deployment policy PR #855](https://github.com/SaamVR/ServiceDesk/pull/855), containing root `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": { "deploymentEnabled": false }
}
```

Vercel's [Git configuration reference](https://vercel.com/docs/project-configuration/git-configuration) states that **`git.deploymentEnabled=false` disables all automatic Git deployments**, including previews. When a project is eventually authorized, independently inspect its effective Git settings; never infer safety from a config file alone. GitHub Actions remain for source-only CI; do not install deploy hooks, add Vercel deploy secrets or enable Git preview deployments.

## Hobby plan and commercial boundary

The connected Vercel **Hobby** plan is intended for personal/non-commercial use. Vercel [terms](https://vercel.com/legal/terms) and [fair-use guidance](https://vercel.com/docs/limits/fair-use-guidelines) require a compliant Pro/Enterprise plan for commercial use. **Do not deploy ServiceDesk for commercial sale or customer use on Hobby.** If the owner chooses a paid plan later, verify price/cost and obtain separate explicit authorization before changing billing. No paid upgrade requested or performed.

## QA identities

The owner provided one controlled Gmail mailbox in the conversation. **Do not publish the address in GitHub files/issues**, retrieve its messages without authorization or create users/aliases merely because the address was provided. Two distinct Gmail plus-address aliases of that mailbox can be *proposed* for controlled QA owner A/B, but account signup/confirmation and any writes into the main Supabase require explicit QA authorization. Never ask for passwords or access JWTs in chat.

## Once owner explicitly authorizes a PARTICULAR Vercel deploy

1. Independently identify/approve the **existing Vercel team**, exact ServiceDesk Vercel project ID (none yet), intended source **40-hex Git SHA**, environment (manual preview vs production), anticipated Hobby/Pro cost and any customer exposure.
2. Verify that the reviewed source has `git.deploymentEnabled=false`, the GitHub branch SHA is the approved commit, the manually controlled Vercel project has no automatic deployment hooks, and source-only exact-HEAD CI passes.
3. Review environment variable **names** and their scope without disclosing values. Use only the same main Supabase project and secure server-side credentials. Keep public signup, automatic fixture writes, payment capture, and real provider delivery OFF until explicitly authorized and tested.
4. Perform the authorized **single** manual deployment, not an automated workflow; immediately capture provider deployment ID, SHA, environment, URL, hosting SHA attestation, exact CI receipt and any cost.
5. Perform two independently authenticated real owner journeys/tenant isolation checks, branch selection, recovery, signed-in negative tests and sanitised DB readbacks. **Do not equate two fabricated JWT role simulations with browser UAT.**
6. Obtain a **separate** explicit promotion/production release approval before pointing public domains or enabling customer access. Preserve provider revision rollback.

**Status:** P02 [issue #818](https://github.com/SaamVR/ServiceDesk/issues/818) remains OPEN. Planning/source policy work is not deployment.
