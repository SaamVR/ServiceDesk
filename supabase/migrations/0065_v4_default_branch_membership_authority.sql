-- V4 R29 / #153: source-only SECURITY DEFINER membership-scoped default branch.
-- Deploy only through an explicitly authorized reviewed DDL release AFTER
-- 0063 quote journal and 0064 pricing revision are separately approved.
-- Do NOT apply to the connected Supabase project as part of this PR.
-- Keep authenticated invoker-rights trigger calls working; deny foreign RPC.
-- SQL is intentionally identical to the PG17-vetted R16 review candidate.
create or replace function public.servicedesk_default_branch(target_workspace uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.workspace_branches b
  where b.workspace_id = target_workspace
    and b.is_default
    and b.active
    and (
      -- Service-role calls are internal privileged processes, not customer
      -- sessions. RLS-bypass service credentials must never reach browsers.
      (auth.role() = 'service_role'
       and current_setting('role', true) = 'service_role')
      or exists (
        select 1
        from public.memberships m
        where m.workspace_id = target_workspace
          and m.user_id = auth.uid()
          and m.status = 'ACTIVE'
      )
    )
  limit 1;
$$;

revoke all on function public.servicedesk_default_branch(uuid)
  from public, anon;
grant execute on function public.servicedesk_default_branch(uuid)
  to authenticated, service_role;
