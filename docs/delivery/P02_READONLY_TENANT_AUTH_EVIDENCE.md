# P02 read-only synthetic authenticated-role evidence (2026-10-25)

**Environment:** existing main Supabase `cpmmgivhlkfbiwzhlcey`. **Scope:** diagnostic SQL in an explicit `READ ONLY` transaction with rollback, no application writes, no new users, no table/view/RLS alterations, no customer records returned.

## What is proved and what is not

| Test identity | workspaces | memberships | workspace_branches | requests | Evidence type |
|---|---:|---:|---:|---:|---|
| Fictional authenticated nonmember | 0 | 0 | 0 | 0 | Read-only synthetic JWT-claim role context |
| Existing confirmed OWNER represented by their membership identity | 1 | 1 | 1 | 1 | Read-only synthetic JWT-claim role context |

The nonmember probe also returned 0 for `branch_memberships`, `service_catalog`, and `branch_price_books`. The existing data snapshot included 1 workspace, 1 owner membership, 1 branch, and 1 saved request; therefore these role-scoped counts are meaningful. **No owner UUID, email, property, address, password, JWT or credential is recorded here.**

This is **limited role-context evidence**, not two real browser logins, not Supabase API receipt verification, and not a complete production tenant-isolation audit. In particular, default-branch SECURITY DEFINER still bypasses the intended membership check on main Supabase: the synthetically authenticated nonmember can learn whether the known foreign workspace has a default branch. The reviewed 0065 function/ACL repair is approved by owner but was **blocked by the connector safety system** and is not installed; migration ledger still ends at 0062.

## Acceptance requirements not satisfied

- [ ] Main 0065-only security patch deployed through a supported authorized, recorded migration. [Handoff](./P02_AUTHORIZED_0065_MIGRATION_HANDOFF.md).
- [ ] Same nonmember branch helper returns NULL under independent read-only role context after patch, authenticated owner still resolves correct default, anon EXECUTE denied.
- [ ] Two independently controlled owner accounts authenticate through V4 UI, complete onboarding and prove mutual deny paths using actual JWTs.
- [ ] Existing Render service restored/retargeted to exact approved V4 SHA, with deployed source metadata and `/health` verified.
- [ ] Neither public signup nor QA fixture writes turned on before explicit attestation and separate QA fixture-write approval.

**Program:** [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818). All owner test users, source writes and provider changes remain pending; do not turn a green read-only count into full staging acceptance.
