-- V4 R25: explicit owner replacement of one existing branch price book.
-- SOURCE ONLY: do not apply to connected Supabase without operator authorization.
-- First-run migration 0061 remains non-overwriting. No external provider calls.
create or replace function public.servicedesk_revise_owner_cleaning_pricing(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_expected_book uuid := nullif(p_input->>'expectedBookId','')::uuid;
  v_expected_version bigint := nullif(p_input->>'expectedBookVersion','')::bigint;
  v_revision uuid := nullif(p_input->>'setupId','')::uuid;
  v_currency text := nullif(trim(p_input->>'currency'),'');
  v_names jsonb := p_input->'serviceNames';
  v_rules jsonb := p_input->'rules';
  v_rule jsonb;
  v_field text;
  v_code text;
  v_name text;
  v_amount numeric;
  v_lower numeric;
  v_upper numeric;
  v_version text;
  v_branch_row public.workspace_branches%rowtype;
  v_old_book public.branch_price_books%rowtype;
  v_saved_rate public.rate_cards%rowtype;
  v_saved_book public.branch_price_books%rowtype;
  v_catalog_count integer;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_branch is null or v_expected_book is null or v_revision is null
     or v_expected_version is null or v_expected_version < 1
     or v_expected_version > 1000000000 or v_currency <> 'USD'
     or jsonb_typeof(v_names) is distinct from 'object'
     or jsonb_typeof(v_rules) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(v_names)) <> 3
     or (select count(*) from jsonb_object_keys(v_rules)) <> 4
  then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_INPUT_INVALID');
  end if;

  if not exists (
    select 1 from public.memberships
     where workspace_id=v_workspace and user_id=v_actor
       and role='OWNER' and status='ACTIVE'
  ) or not public.servicedesk_actor_has_branch_access(
    v_workspace,v_branch,v_actor,v_role,array['OWNER']::public.membership_role[]
  ) then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_OWNER_REQUIRED');
  end if;

  select * into v_branch_row from public.workspace_branches
   where workspace_id=v_workspace and id=v_branch and active for update;
  if not found or trim(v_branch_row.currency) <> v_currency then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_BRANCH_FORBIDDEN');
  end if;
  perform pg_advisory_xact_lock(hashtext(v_workspace::text),hashtext('cleaning-pricing:'||v_branch::text));
  v_version := 'owner-cleaning-revision-' || v_revision::text;

  -- Reject inconsistent or incomplete owner input BEFORE touching any record.
  foreach v_code in array array['STANDARD','DEEP','MOVE_OUT'] loop
    if jsonb_typeof(v_names->v_code) is distinct from 'string' then
      return jsonb_build_object('ok',false,'code','PRICING_REVISION_NAME_INVALID');
    end if;
    v_name := trim(v_names->>v_code);
    if length(v_name)<3 or length(v_name)>120 or v_name ~ '[[:cntrl:]]' then
      return jsonb_build_object('ok',false,'code','PRICING_REVISION_NAME_INVALID');
    end if;
  end loop;
  foreach v_code in array array['standard','deep','moveOut'] loop
    v_rule := v_rules->v_code;
    if jsonb_typeof(v_rule) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_rule)) <>
          case when v_code='moveOut' then 8 else 6 end
    then
      return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
    end if;
    foreach v_field in array array[
      'baseMinor','baseMinutes','bedroomMinor','bedroomMinutes',
      'bathroomMinor','bathroomMinutes'
    ] loop
      if jsonb_typeof(v_rule->v_field) is distinct from 'number' then
        return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
      end if;
      v_amount := (v_rule->>v_field)::numeric;
      v_lower := case when v_field in ('baseMinor','baseMinutes') then 1 else 0 end;
      v_upper := case when right(v_field,7)='Minutes' then 1440 else 10000000 end;
      if v_amount<>trunc(v_amount) or v_amount<v_lower or v_amount>v_upper then
        return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
      end if;
    end loop;
    if v_code='moveOut' then
      foreach v_field in array array['ovenMinor','ovenMinutes'] loop
        if jsonb_typeof(v_rule->v_field) is distinct from 'number' then
          return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
        end if;
        v_amount := (v_rule->>v_field)::numeric;
        v_upper := case when right(v_field,7)='Minutes' then 1440 else 10000000 end;
        if v_amount<>trunc(v_amount) or v_amount<0 or v_amount>v_upper then
          return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
        end if;
      end loop;
    end if;
  end loop;
  if jsonb_typeof(v_rules->'autoApprovalMaxTotalMinor') is distinct from 'number' then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
  end if;
  v_amount := (v_rules->>'autoApprovalMaxTotalMinor')::numeric;
  if v_amount<>trunc(v_amount) or v_amount<0 or v_amount>100000000 then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
  end if;
  foreach v_field in array array['depositPercent','validHours','bufferMinutes'] loop
    if jsonb_typeof(p_input->v_field) is distinct from 'number' then
      return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
    end if;
    v_amount := (p_input->>v_field)::numeric;
    v_lower := case when v_field='validHours' then 1 else 0 end;
    v_upper := case when v_field='depositPercent' then 100
                when v_field='validHours' then 720 else 1440 end;
    if v_amount<>trunc(v_amount) or v_amount<v_lower or v_amount>v_upper then
      return jsonb_build_object('ok',false,'code','PRICING_REVISION_RULES_INVALID');
    end if;
  end loop;

  -- A retry after a successful but unacknowledged commit is read-only.
  -- Duplicate IDs with different inputs must never be accepted.
  select * into v_saved_rate from public.rate_cards
   where workspace_id=v_workspace and version=v_version;
  if found then
    select * into v_saved_book from public.branch_price_books
     where workspace_id=v_workspace and branch_id=v_branch
       and rate_card_id=v_saved_rate.id and active;
    if found and v_saved_rate.active and trim(v_saved_rate.currency)=v_currency
       and v_saved_rate.rules=v_rules
       and v_saved_rate.deposit_percent=(p_input->>'depositPercent')::integer
       and v_saved_rate.valid_hours=(p_input->>'validHours')::integer
       and v_saved_rate.buffer_minutes=(p_input->>'bufferMinutes')::integer
       and (select count(*) from public.service_catalog sc
            where sc.workspace_id=v_workspace and sc.active
              and ((sc.code='STANDARD' and sc.name=trim(v_names->>'STANDARD'))
                or (sc.code='DEEP' and sc.name=trim(v_names->>'DEEP'))
                or (sc.code='MOVE_OUT' and sc.name=trim(v_names->>'MOVE_OUT'))))=3
    then
      return jsonb_build_object('ok',true,'duplicate',true,
        'rateCardId',v_saved_rate.id,'priceBookId',v_saved_book.id,
        'branchId',v_branch,'rateVersion',v_version);
    end if;
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_IDEMPOTENCY_CONFLICT');
  end if;

  select * into v_old_book from public.branch_price_books
   where workspace_id=v_workspace and branch_id=v_branch and active for update;
  if not found then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_NO_ACTIVE_BOOK');
  end if;
  if v_old_book.id<>v_expected_book or v_old_book.version<>v_expected_version then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_VERSION_CONFLICT');
  end if;

  -- Owner explicitly replaces the whole cleaning configuration. No auto-repair.
  -- The former rate card remains immutable for already issued quotes.
  foreach v_code in array array['STANDARD','DEEP','MOVE_OUT'] loop
    insert into public.service_catalog(workspace_id,code,name,active,requires_review)
    values (v_workspace,v_code,trim(v_names->>v_code),true,false)
    on conflict (workspace_id,code) do update
      set name=excluded.name,active=true,updated_at=now();
  end loop;
  select count(*) into v_catalog_count from public.service_catalog
   where workspace_id=v_workspace and active and code in ('STANDARD','DEEP','MOVE_OUT');
  if v_catalog_count<>3 then
    raise exception 'incomplete catalog'; -- entire function transaction rolls back
  end if;

  update public.branch_price_books set active=false,version=version+1,updated_at=now()
   where workspace_id=v_workspace and branch_id=v_branch and id=v_old_book.id
     and version=v_expected_version and active;
  if not found then
    raise exception 'pricing concurrency conflict';
  end if;
  insert into public.rate_cards(
    workspace_id,version,currency,deposit_percent,valid_hours,buffer_minutes,active,rules
  ) values(
    v_workspace,v_version,v_currency,
    (p_input->>'depositPercent')::integer,(p_input->>'validHours')::integer,
    (p_input->>'bufferMinutes')::integer,true,v_rules
  ) returning * into v_saved_rate;
  insert into public.branch_price_books(
    workspace_id,branch_id,rate_card_id,active,created_by,starts_at,ends_at
  ) values(v_workspace,v_branch,v_saved_rate.id,true,v_actor,null,null)
    returning * into v_saved_book;
  insert into public.audit_events(
    workspace_id,actor_user_id,actor_role,action,resource_type,
    resource_id,request_id,before_data,after_data
  ) values(
    v_workspace,v_actor,v_role,'cleaning_pricing.revised','branch_price_book',
    v_saved_book.id,v_revision::text,
    jsonb_build_object('priceBookId',v_old_book.id,'rateCardId',v_old_book.rate_card_id,
      'bookVersion',v_old_book.version),
    jsonb_build_object('priceBookId',v_saved_book.id,'rateCardId',v_saved_rate.id,
      'rateVersion',v_version,'currency',v_currency,'branchId',v_branch)
  );
  return jsonb_build_object('ok',true,'duplicate',false,
    'rateCardId',v_saved_rate.id,'priceBookId',v_saved_book.id,
    'branchId',v_branch,'rateVersion',v_version);
exception
  when invalid_text_representation or numeric_value_out_of_range or
       check_violation or unique_violation or foreign_key_violation or
       invalid_parameter_value then
    return jsonb_build_object('ok',false,'code','PRICING_REVISION_WRITE_REJECTED');
end;
$$;

revoke all on function public.servicedesk_revise_owner_cleaning_pricing(jsonb)
  from public, anon, authenticated;
grant execute on function public.servicedesk_revise_owner_cleaning_pricing(jsonb)
  to service_role;
comment on function public.servicedesk_revise_owner_cleaning_pricing(jsonb) is
  'Explicit active-owner full price-book replacement; service-role only, optimistic book CAS, immutable historical rates and audit.';
