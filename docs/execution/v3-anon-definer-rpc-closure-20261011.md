# Security closure: anonymous SECURITY DEFINER branch helpers

The connected Supabase staging advisor found two publicly callable privileged helpers:
- public.servicedesk_default_branch(target_workspace uuid)
- public.servicedesk_has_branch_access(target_workspace uuid, target_branch uuid, allowed_roles public.membership_role[])

Both previously had EXECUTE for the anonymous role, inherited via PUBLIC. The first could return a default branch ID for a supplied workspace without authenticating the caller; the second checks auth.uid but still exposed a privileged RPC endpoint.

Migration 0060 revokes direct execution by PUBLIC and anon, grants it explicitly to authenticated and service_role to preserve RLS policy callers, and does not alter schema, user records or data.

Verify after staging migration:
- has_function_privilege('anon', ...) = false for both
- has_function_privilege('authenticated', ...) = true for both
- has_function_privilege('service_role', ...) = true
- RLS remains enabled on workspace_branches and branch_memberships
- Security advisor 0028 count for these functions reduced to zero
- Signed-out requests cannot invoke the RPC. Signed-in workspace RLS and owner bootstrap still require real-session browser acceptance.
- public signup remains OFF; QA-only RLS operations mode must not be enabled before this security gate passes.

Note: Other advisor warnings (e.g., intended internal RLS-only tables without policies, citext extension in public) are separately tracked and not claimed fixed by migration 0060.
