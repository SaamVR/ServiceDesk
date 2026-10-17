# R28 P0 — two-owner authenticated default-branch RPC isolation

Source: [security issue #153](https://github.com/SaamVR/ServiceDesk/issues/153). This is a **read-only authenticated acceptance gate**, NOT a live security repair or migration approval.

## Why the existing table RLS matrix was insufficient

`public.servicedesk_default_branch(target_workspace uuid)` runs as a SECURITY DEFINER and can disclose a foreign default branch ID even if the caller's ordinary `workspace_branches` SELECT returns zero foreign rows. A two-owner table proof alone cannot close this issue.

## New fail-closed gate

The existing protected `v4-private-rls-proof.mjs` now requires **two separately signed-in, email-confirmed, distinct fictional owners**. Each owner must have exactly one visible, active default branch. Both must receive that exact branch ID from the RPC when calling for their own workspace. Each must receive **null or explicit SQLSTATE 42501** when calling the RPC for the other owner's real populated workspace. Any foreign ID, positive wrong ID, empty fixture, missing RPC, ambiguous branch or arbitrary error blocks acceptance.

The guard makes read-only requests only; it neither creates accounts nor applies DDL or provider changes. Offline tests exercise a simulated foreign-branch disclosure and negative edge cases. They establish *harness contract testing only*. A successful real protected manual run with two independently configured owners is required for OPERATIONS_VERIFIED security acceptance.

## Existing environment remains blocked

The connected Supabase project has installed migrations only through `0062`. The reviewed SQL protection candidate `docs/engineering/security/servicedesk-default-branch-guard-candidate.sql` has **NOT** been deployed. Therefore the source test alone does not close #153 or justify a merchant pilot. Do not silently apply this candidate or start a privileged migration from this PR.

After separate DDL approval: transactionally install and read back the reviewed fix, perform two-owner protected QA, check existing legitimate insert/update trigger callers on PostgreSQL 17, and record exact rollout/rollback evidence. No customer identifiers or secrets belong in GitHub receipts.
