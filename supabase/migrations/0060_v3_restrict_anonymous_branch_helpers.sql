-- 0060: Close Supabase advisor 0028 anonymous SECURITY DEFINER RPC exposure.
-- Authenticated branch reads and internal service-role callers stay functional.
-- No table changes, row changes, or application data writes.
begin;

revoke execute on function public.servicedesk_default_branch(uuid)
  from public, anon;
revoke execute on function public.servicedesk_has_branch_access(
  uuid, uuid, public.membership_role[]
) from public, anon;

-- RLS policies on workspace_branches and other branch-scoped tables call
-- servicedesk_has_branch_access with the authenticated caller's auth.uid().
-- Preserve that role and the server-only service role explicitly.
grant execute on function public.servicedesk_default_branch(uuid)
  to authenticated, service_role;
grant execute on function public.servicedesk_has_branch_access(
  uuid, uuid, public.membership_role[]
) to authenticated, service_role;

commit;
