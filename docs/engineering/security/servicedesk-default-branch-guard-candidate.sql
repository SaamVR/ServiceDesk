-- R16 / #153: REVIEW-ONLY remediation candidate, NOT an automatically applied migration.
-- The connected Supabase project remains at 0062 while repository migration 0063
-- is uninstalled. Do NOT move this file into supabase/migrations or apply to
-- any connected environment without explicit release/DDL authorization.
-- Disposable PG17 tests execute this candidate after seven-table trigger proof.
--
-- Existing public function is used by invoker-rights insert/update triggers.
-- Revoking authenticated EXECUTE blindly would break legitimate branch defaults.
-- Keep its exact signature and authorized trigger use; prohibit revealing a
-- foreign workspace's default branch UUID through direct RPC invocation.
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
