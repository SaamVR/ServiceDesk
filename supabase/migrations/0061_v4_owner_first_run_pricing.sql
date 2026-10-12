-- ServiceDesk V4: one explicit, owner-authenticated, atomic initial cleaning price configuration.
-- Deliberately NOT applied by CI. Review and authorize a staging migration separately.
-- Staff/browser roles cannot execute this command; only the trusted service-role RPC
-- after a verified SSR getUser + workspace membership/branch-scope check.
create or replace function public.servicedesk_setup_owner_cleaning_pricing(p_input jsonb)
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
  v_idempotency uuid := nullif(p_input->>'setupId','')::uuid;
  v_version text;
  v_currency text := nullif(trim(p_input->>'currency'),'');
  v_names jsonb := p_input->'serviceNames';
  v_rules jsonb := p_input->'rules';
  v_rule jsonb;
  v_field text;
  v_code text;
  v_name text;
  v_value numeric;
  v_min numeric;
  v_max numeric;
  v_active_count integer;
  v_existing public.rate_cards%rowtype;
  v_rate public.rate_cards%rowtype;
  v_branch_row public.workspace_branches%rowtype;
  v_book public.branch_price_books%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_branch is null or v_idempotency is null
     or v_currency is null or v_currency !~ '^[A-Z]{3}$'
     or jsonb_typeof(v_names) is distinct from 'object'
     or jsonb_typeof(v_rules) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(v_names)) <> 3
     or (select count(*) from jsonb_object_keys(v_rules)) <> 4
  then
    return jsonb_build_object('ok', false, 'code', 'PRICING_SETUP_INPUT_INVALID');
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.workspace_id = v_workspace and m.user_id = v_actor
      and m.role = 'OWNER' and m.status = 'ACTIVE'
  ) or not public.servicedesk_actor_has_branch_access(
    v_workspace,v_branch,v_actor,v_role,array['OWNER']::public.membership_role[]
  ) then
    return jsonb_build_object('ok', false, 'code', 'PRICING_SETUP_OWNER_REQUIRED');
  end if;

  select * into v_branch_row from public.workspace_branches
  where workspace_id=v_workspace and id=v_branch and active for update;
  if not found or trim(v_branch_row.currency) <> v_currency then
    return jsonb_build_object('ok', false, 'code', 'PRICING_SETUP_BRANCH_CURRENCY_INVALID');
  end if;

  -- Serialize concurrent setup attempts on the same branch. A service-role
  -- retry uses the same setupId and returns the same durable rate/book IDs.
  perform pg_advisory_xact_lock(hashtext(v_workspace::text),hashtext('cleaning-pricing:'||v_branch::text));
  v_version := 'owner-cleaning-' || v_idempotency::text;

  select * into v_existing from public.rate_cards
  where workspace_id=v_workspace and version=v_version;
  if found then
    select * into v_book from public.branch_price_books
    where workspace_id=v_workspace and branch_id=v_branch
      and rate_card_id=v_existing.id and active
    order by created_at desc limit 1;
    if found and v_existing.active and v_existing.currency=v_currency
       and v_existing.deposit_percent = (p_input->>'depositPercent')::integer
       and v_existing.valid_hours = (p_input->>'validHours')::integer
       and v_existing.buffer_minutes = (p_input->>'bufferMinutes')::integer
       and v_existing.rules=v_rules
       and (
         select count(*) from public.service_catalog sc
         where sc.workspace_id=v_workspace and sc.active
           and (
             (sc.code='STANDARD' and sc.name=trim(v_names->>'STANDARD'))
             or (sc.code='DEEP' and sc.name=trim(v_names->>'DEEP'))
             or (sc.code='MOVE_OUT' and sc.name=trim(v_names->>'MOVE_OUT'))
           )
       ) = 3 then
      return jsonb_build_object('ok',true,'duplicate',true,
        'rateCardId',v_existing.id,'priceBookId',v_book.id,
        'branchId',v_branch,'rateVersion',v_existing.version);
    end if;
    return jsonb_build_object('ok',false,'code','PRICING_SETUP_IDEMPOTENCY_CONFLICT');
  end if;

  if exists (
    select 1 from public.branch_price_books
    where workspace_id=v_workspace and branch_id=v_branch and active
  ) then
    return jsonb_build_object('ok',false,'code','PRICING_SETUP_ALREADY_CONFIGURED');
  end if;

  foreach v_code in array array['STANDARD','DEEP','MOVE_OUT'] loop
    if not (v_names ? v_code) or jsonb_typeof(v_names->v_code) <> 'string' then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_SERVICE_NAME_INVALID');
    end if;
    v_name := trim(v_names->>v_code);
    if length(v_name)<3 or length(v_name)>120 or v_name ~ '[[:cntrl:]]' then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_SERVICE_NAME_INVALID');
    end if;
  end loop;

  -- A real business must submit its own prices, durations and policies.
  -- Numeric JSON values must be finite, integer and bounded, not defaults
  -- smuggled in from the public sandbox or string-coerced input.
  foreach v_code in array array['moveOut','standard','deep'] loop
    v_rule := v_rules->v_code;
    if jsonb_typeof(v_rule) <> 'object' then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
    end if;
    foreach v_field in array array[
      'baseMinor','baseMinutes','bedroomMinor','bedroomMinutes',
      'bathroomMinor','bathroomMinutes'
    ] loop
      if jsonb_typeof(v_rule->v_field) <> 'number' then
        return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
      end if;
      v_value := (v_rule->>v_field)::numeric;
      v_min := case when v_field = 'baseMinor' or v_field = 'baseMinutes' then 1 else 0 end;
      v_max := case when right(v_field,7) = 'Minutes' then 1440 else 10000000 end;
      if v_value <> trunc(v_value) or v_value < v_min or v_value > v_max then
        return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
      end if;
    end loop;
    if v_code = 'moveOut' then
      foreach v_field in array array['ovenMinor','ovenMinutes'] loop
        if jsonb_typeof(v_rule->v_field) <> 'number' then
          return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
        end if;
        v_value := (v_rule->>v_field)::numeric;
        v_max := case when right(v_field,7) = 'Minutes' then 1440 else 10000000 end;
        if v_value <> trunc(v_value) or v_value < 0 or v_value > v_max then
          return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
        end if;
      end loop;
    end if;
  end loop;
  foreach v_field in array array['autoApprovalMaxTotalMinor'] loop
    if jsonb_typeof(v_rules->v_field) <> 'number' then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
    end if;
    v_value := (v_rules->>v_field)::numeric;
    if v_value <> trunc(v_value) or v_value < 0 or v_value > 100000000 then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
    end if;
  end loop;

  foreach v_field in array array['depositPercent','validHours','bufferMinutes'] loop
    if jsonb_typeof(p_input->v_field) <> 'number' then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
    end if;
    v_value := (p_input->>v_field)::numeric;
    v_min := case when v_field='validHours' then 1 else 0 end;
    v_max := case when v_field='depositPercent' then 100
                  when v_field='validHours' then 720 else 1440 end;
    if v_value <> trunc(v_value) or v_value < v_min or v_value > v_max then
      return jsonb_build_object('ok',false,'code','PRICING_SETUP_RULES_INVALID');
    end if;
  end loop;

  -- Preflight the entire affected catalog BEFORE the first write. Returning
  -- a failure code after partially inserting services does NOT roll back a
  -- normal PL/pgSQL function invocation; exception subtransactions alone are
  -- not a substitute for this explicit all-or-nothing logical gate.
  if exists (
    select 1 from public.service_catalog sc
    where sc.workspace_id = v_workspace
      and sc.code in ('STANDARD','DEEP','MOVE_OUT')
      and sc.active is distinct from true
  ) then
    return jsonb_build_object('ok',false,'code','PRICING_SETUP_INACTIVE_SERVICE');
  end if;

  -- Never revive/deactivate existing services behind the owner's back.
  -- A partial existing catalog is repaired only by adding absent codes;
  -- if an existing supported service was intentionally disabled, fail.
  foreach v_code in array array['STANDARD','DEEP','MOVE_OUT'] loop
    insert into public.service_catalog(workspace_id,code,name,active,requires_review)
    values (v_workspace,v_code,trim(v_names->>v_code),true,false)
    on conflict (workspace_id,code) do update
       set name=excluded.name, updated_at=now()
       where public.service_catalog.active;
  end loop;
  select count(*) into v_active_count from public.service_catalog
  where workspace_id=v_workspace and active
    and code in ('STANDARD','DEEP','MOVE_OUT');
  if v_active_count<>3 then
    return jsonb_build_object('ok',false,'code','PRICING_SETUP_INACTIVE_SERVICE');
  end if;

  insert into public.rate_cards(
    workspace_id,version,currency,deposit_percent,valid_hours,
    buffer_minutes,active,rules
  ) values(
    v_workspace,v_version,v_currency,
    (p_input->>'depositPercent')::integer,(p_input->>'validHours')::integer,
    (p_input->>'bufferMinutes')::integer,true,v_rules
  ) returning * into v_rate;

  insert into public.branch_price_books(
    workspace_id,branch_id,rate_card_id,active,created_by
  ) values (v_workspace,v_branch,v_rate.id,true,v_actor)
  returning * into v_book;

  insert into public.audit_events(
    workspace_id,actor_user_id,actor_role,action,resource_type,
    resource_id,request_id,after_data
  ) values(
    v_workspace,v_actor,v_role,'cleaning_pricing.initialized',
    'rate_card',v_rate.id,v_idempotency::text,
    jsonb_build_object('branchId',v_branch,'rateVersion',v_version,
      'currency',v_currency,'priceBookId',v_book.id,'serviceCodes',
      jsonb_build_array('STANDARD','DEEP','MOVE_OUT'))
  );

  return jsonb_build_object('ok',true,'duplicate',false,
    'rateCardId',v_rate.id,'priceBookId',v_book.id,
    'branchId',v_branch,'rateVersion',v_rate.version);
exception
  when invalid_text_representation or numeric_value_out_of_range
    or check_violation or unique_violation or foreign_key_violation
    or invalid_parameter_value then
    return jsonb_build_object('ok',false,'code','PRICING_SETUP_WRITE_REJECTED');
end;
$$;

revoke all on function public.servicedesk_setup_owner_cleaning_pricing(jsonb)
  from public,anon,authenticated;
grant execute on function public.servicedesk_setup_owner_cleaning_pricing(jsonb)
  to service_role;
comment on function public.servicedesk_setup_owner_cleaning_pricing(jsonb) is
  'Owner-verified service-role-only, explicit and atomic first-run cleaning pricing setup. No demo prices and no public Data API access.';
