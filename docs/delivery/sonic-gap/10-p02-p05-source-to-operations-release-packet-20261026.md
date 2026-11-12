# SONIC continuation — P02/P05 source-to-operations release packet (2026-10-26)

**Owner**: Production Readiness [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818) and [quote-replay blocker #199](https://github.com/SaamVR/ServiceDesk/issues/199). **Source at inspection** `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4`. **This packet is review/test-only.** It neither approves nor installs any migration, nor enables owner signup, a model key, message sending, outbox jobs or deployment.

## Verified code already built — avoid duplicate development

**P02:** `supabase/migrations/0065_v4_default_branch_membership_authority.sql` includes an active-workspace membership predicate, scoped branch, explicit service role dual validation and restrictive anonymous grants, and has disposable PG17 checks. `src/features/auth/owner-registration-readiness.ts` blocks QA/public signup unless `SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED=true` is set *server-side*. `scripts/release/v4-p02-two-owner-readonly-acceptance.mjs` has a controlled read-only two-owner JWT/tenant table + privileged RPC negative probe, requiring an explicit `READ_ONLY` acceptance flag and publishable key, not a service-role secret.

**P05:** `supabase/migrations/0063_v4_quote_accept_internal_source_journal.sql` defines transaction-bound accepted-quote journal, unique quote/source key, service-only row access, bounded `SKIP LOCKED` lease, retry/dead-letter. `src/server/workflows/customer-quote-source-recovery.ts` has an opt-in server kill switch, current lease recheck, tenant/request validation and internal-only recovery; existing unit tests simulate claims, throw/crash and rejection of fabricated success. This source code **does not prove** that 0063 is installed or the replay loop is active.

## Actual blocking work not done by these tests

| Gate | Code/source state | Operational evidence still needed | Exact authority |
|---|---|---|---|
| P02 DB tenant isolation | 0065 migration source reviewed, no live installation proved | Approved 0063→0064→0065 migration plan/rollback, installed ledger, foreign default-branch RPC denial for *two real isolated owners* | Explicit owner scoped DB-write approval, Production |
| P02 owner onboarding | QA/public registration fail-closed by default | Two controlled *fictional* signed-in OWNER A/B sessions and true V4 authenticated signup/login/workspace/branch readbacks | Owner-supplied approved QA accounts, Production |
| P02 hosting | Existing Render V3 service historically suspended | Authorized V4 branch/deploy, exact health/rollback and preserved V3 recovery source | Separate owner deployment approval, Production |
| P05 event durability | 0063 trigger/unique/lease worker source implemented, not proof of installation | DB transaction rollback/failover PG17, explicit opted-in quote A and B, forced post-commit crash, claim/recovery/unique action effect | Production migration + tenant QA authorization |
| Studio PR integration | PRs #631/#633/#645 overlap canon, historical #642 closed | Blob-by-blob decision on divergent files, no overwritten security changes, exact resulting UI CI/browser receipts | Production selects PR merge strategy, F08 frozen bundle choice |

**Do not conflate P02 success with P05 success.** One installed 0065 migration does not grant request→quote→invoice readiness. Existing F08 bundle #841 remains unmerged, and the original 72-workflow audit is source-only.

## Studio exact-blob decisions, audit 2026-10-26

The linked machine record `docs/delivery/sonic-gap/09-studio-pr-blob-reconciliation-20261026.json` pins 32 file hashes:
- #631: **8/8 identical canonical**. No Studio code changes needed from this PR; do not blindly merge just because it remains open.
- #633: **6/7 identical**. Canonical `AiStudioWorkspace.tsx` differs by passing current workspace ID to Owner Operations Brief while retaining workflow-projection privacy.
- #645: **5/7 identical**. Canonical `OperationalProductRoute.tsx` uses a dedicated `AutomationPlaybookBrowser` and updated crew coverage; canonical quote UI test expects a `versionTrusted` guard and clean effect teardown.
- #642: **1/10 identical**, CLOSED/UNMERGED. Historical diagnostics content has diverged; compare approved functionality, do not replay old PR as a patch.

Identical Git blobs demonstrate the *file content exists* in canonical, **not** the original PR was merged, nor any deployed V4 success. Non-identical blobs do **not** imply missing functionality; current canonical may have improved versions.

## Exact source acceptance/release boundary

This change packet should only add tests/documentation in isolated GitHub feature branches. Required CI: focused synthetic P02/P05/Studio tests, full exact-head `pnpm check:rc`, merge-tree parity and reviewer. Source CI PASS is **CONTRACT_TESTED** only; the actual two-owner/staging and quote crash tests still require **OPERATIONS_VERIFIED** real proof. No tokens/secrets, customer emails, schema mutations, billing, provider sends or device operations are permitted.
