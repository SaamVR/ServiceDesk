-- ServiceDesk AI V2 Wave 2B.3A: accounting integration state + local version authority.

create or replace function public.servicedesk_accounting_local_version(
  p_workspace uuid,
  p_kind text,
  p_resource_id uuid
)
returns bigint
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_version bigint;
begin
  if p_kind = 'COMMERCIAL_ORGANIZATION' then
    select version into v_version
    from public.commercial_organizations
    where workspace_id = p_workspace and id = p_resource_id and status <> 'ARCHIVED';
  elsif p_kind = 'INVOICE' then
    select version into v_version
    from public.invoices
    where workspace_id = p_workspace and id = p_resource_id and status <> 'VOID';
  elsif p_kind = 'VERIFIED_PAYMENT' then
    select 1 into v_version
    from public.verified_payment_applications
    where workspace_id = p_workspace and id = p_resource_id and state = 'APPLIED' and invoice_id is not null;
  elsif p_kind = 'MANUAL_PAYMENT' then
    select 1 into v_version
    from public.manual_payment_records
    where workspace_id = p_workspace and id = p_resource_id;
  elsif p_kind = 'COMMERCIAL_BILLING_LINE' then
    select 1 into v_version
    from public.commercial_billing_lines l
    join public.commercial_billing_drafts d
      on d.workspace_id = l.workspace_id and d.id = l.draft_id
    where l.workspace_id = p_workspace
      and l.id = p_resource_id
      and l.source_type = 'ADJUSTMENT'
      and l.direction = 'CREDIT'
      and l.state = 'INCLUDED'
      and d.state = 'FINALIZED';
  end if;

  return v_version;
end;
$$;

create or replace function public.servicedesk_set_accounting_integration_state(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_provider text := lower(trim(p_input->>'provider'));
  v_status text := p_input->>'status';
  v_owner text := coalesce(p_input->>'defaultSyncOwner','SERVICEDESK');
  v_error text := nullif(trim(p_input->>'lastErrorCode'),'');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_existing public.accounting_integrations%rowtype;
  v_row public.accounting_integrations%rowtype;
begin
  if v_workspace is null
     or v_provider !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
     or v_status not in ('DISCONNECTED','READY','AUTH_EXPIRED','ERROR')
     or v_owner not in ('SERVICEDESK','EXTERNAL')
     or (v_status in ('AUTH_EXPIRED','ERROR') and v_error is null)
     or (v_error is not null and length(v_error) > 120) then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_INTEGRATION_STATE_INVALID');
  end if;

  select * into v_existing
  from public.accounting_integrations
  where workspace_id = v_workspace and provider = v_provider
  for update;

  if found then
    update public.accounting_integrations
    set status = v_status,
        default_sync_owner = v_owner,
        last_success_at = case when v_status = 'READY' then coalesce(last_success_at, v_now) else last_success_at end,
        last_error_code = case when v_status in ('AUTH_EXPIRED','ERROR') then v_error else null end,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace and id = v_existing.id
    returning * into v_row;
  else
    insert into public.accounting_integrations(
      workspace_id, provider, status, default_sync_owner, last_success_at, last_error_code,
      version, created_at, updated_at
    ) values (
      v_workspace, v_provider, v_status, v_owner,
      case when v_status = 'READY' then v_now else null end,
      case when v_status in ('AUTH_EXPIRED','ERROR') then v_error else null end,
      1, v_now, v_now
    )
    returning * into v_row;
  end if;

  if v_status in ('AUTH_EXPIRED','ERROR') then
    insert into public.attention_items(
      workspace_id, type, resource_type, resource_id, severity, status, summary, created_at, updated_at
    ) values (
      v_workspace, 'ACCOUNTING_RECONCILIATION', 'accounting_integration', v_row.id,
      'WARNING', 'OPEN', 'Accounting connection requires attention.', v_now, v_now
    )
    on conflict (workspace_id, type, resource_type, resource_id) where status = 'OPEN'
    do update set severity = excluded.severity, summary = excluded.summary, updated_at = excluded.updated_at;
  else
    update public.attention_items
    set status = 'RESOLVED', updated_at = v_now
    where workspace_id = v_workspace
      and type = 'ACCOUNTING_RECONCILIATION'
      and resource_type = 'accounting_integration'
      and resource_id = v_row.id
      and status = 'OPEN';
  end if;

  insert into public.audit_events(
    workspace_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, 'SYSTEM', 'ACCOUNTING_INTEGRATION_STATE_RECORDED',
    'accounting_integration', v_row.id,
    jsonb_build_object(
      'provider', v_provider,
      'status', v_status,
      'defaultSyncOwner', v_owner,
      'errorCode', case when v_status in ('AUTH_EXPIRED','ERROR') then v_error else null end,
      'version', v_row.version
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'integration', public.servicedesk_accounting_integration_json(v_row)
  );
end;
$$;

revoke all on function public.servicedesk_accounting_local_version(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.servicedesk_set_accounting_integration_state(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_accounting_local_version(uuid, text, uuid) to service_role;
grant execute on function public.servicedesk_set_accounting_integration_state(jsonb) to service_role;
