-- ServiceDesk AI V1 E10B: service-role read helpers for concrete request/quote/capacity composition

create or replace function public.servicedesk_get_request(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_request_id uuid := (p_input->>'requestId')::uuid;
  v_request public.requests%rowtype;
begin
  if v_workspace is null or v_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'REQUEST_LOOKUP_INVALID');
  end if;
  select * into v_request from public.requests where workspace_id = v_workspace and id = v_request_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'request', public.servicedesk_request_json(v_request));
end;
$$;

create or replace function public.servicedesk_get_quote(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_quote_id uuid := (p_input->>'quoteId')::uuid;
  v_quote public.quotes%rowtype;
begin
  if v_workspace is null or v_quote_id is null then
    return jsonb_build_object('ok', false, 'code', 'QUOTE_LOOKUP_INVALID');
  end if;
  select * into v_quote from public.quotes where workspace_id = v_workspace and id = v_quote_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'QUOTE_NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'quote', public.servicedesk_quote_json(v_quote));
end;
$$;

create or replace function public.servicedesk_get_latest_quote_for_request(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_request_id uuid := (p_input->>'requestId')::uuid;
  v_quote public.quotes%rowtype;
begin
  if v_workspace is null or v_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'QUOTE_LOOKUP_INVALID');
  end if;
  select * into v_quote
  from public.quotes
  where workspace_id = v_workspace and request_id = v_request_id and status <> 'SUPERSEDED'
  order by version desc
  limit 1;
  if not found then return jsonb_build_object('ok', false, 'code', 'QUOTE_NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'quote', public.servicedesk_quote_json(v_quote));
end;
$$;

revoke all on function public.servicedesk_get_request(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_get_quote(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_get_latest_quote_for_request(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_get_request(jsonb) to service_role;
grant execute on function public.servicedesk_get_quote(jsonb) to service_role;
grant execute on function public.servicedesk_get_latest_quote_for_request(jsonb) to service_role;
