-- ServiceDesk AI staging hardening after first Supabase advisor pass.

revoke execute on function public.has_active_membership(uuid, public.membership_role[]) from anon;
revoke execute on function public.is_customer_for_workspace(uuid, uuid) from anon;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

drop policy if exists invoices_staff_read on public.invoices;
create policy invoices_staff_read on public.invoices
  for select to authenticated
  using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists invoices_customer_read on public.invoices;
create policy invoices_customer_read on public.invoices
  for select to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      join public.requests r on r.workspace_id = q.workspace_id and r.id = q.request_id
      where q.workspace_id = invoices.workspace_id
        and q.id = invoices.quote_id
        and r.customer_id is not null
        and public.is_customer_for_workspace(r.workspace_id, r.customer_id)
    )
  );

drop policy if exists payment_applications_staff_read on public.verified_payment_applications;
create policy payment_applications_staff_read on public.verified_payment_applications
  for select to authenticated
  using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));
