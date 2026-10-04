-- ServiceDesk AI V1 INT6 / E03: durable verified-payment Postgres RPC
-- Source-of-truth implementation for public.servicedesk_apply_verified_payment(jsonb).
-- Trusted server/service-role only; no Supabase JS sequential mutation path is treated as atomic.

create or replace function public.servicedesk_apply_verified_payment(p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_event->>'workspaceId')::uuid;
  v_provider text := nullif(trim(p_event->>'provider'), '');
  v_account text := nullif(trim(p_event->>'providerAccountId'), '');
  v_event text := nullif(trim(p_event->>'providerEventId'), '');
  v_tx text := nullif(trim(p_event->>'providerTransactionId'), '');
  v_purpose public.payment_purpose := (p_event->>'purpose')::public.payment_purpose;
  v_amount bigint := (p_event->>'amountMinor')::bigint;
  v_currency char(3) := upper(p_event->>'currency');
  v_occurred timestamptz := (p_event->>'occurredAt')::timestamptz;
  v_quote_id uuid := nullif(p_event->>'quoteId','')::uuid;
  v_hold_id uuid := nullif(p_event->>'holdId','')::uuid;
  v_invoice_id uuid := nullif(p_event->>'invoiceId','')::uuid;
  v_existing public.verified_payment_applications%rowtype;
  v_quote public.quotes%rowtype;
  v_hold public.slot_holds%rowtype;
  v_slot public.capacity_slots%rowtype;
  v_invoice public.invoices%rowtype;
  v_visit public.visits%rowtype;
  v_app_id uuid;
  v_attention_id uuid;
  v_reason text;
  v_outbox_id uuid;
  v_invoice_json jsonb;
  v_visit_json jsonb;
  v_safe_quote_id uuid;
  v_safe_hold_id uuid;
  v_safe_invoice_id uuid;
begin
  if v_workspace is null
     or v_provider is null
     or v_account is null
     or v_event is null
     or v_tx is null
     or v_purpose is null
     or v_amount is null
     or v_amount <= 0
     or v_currency is null
     or length(v_currency) <> 3
     or v_occurred is null then
    return jsonb_build_object('ok', false, 'code', 'PAYMENT_EVENT_INVALID');
  end if;

  select * into v_existing
  from public.verified_payment_applications
  where provider = v_provider
    and provider_account_id = v_account
    and provider_event_id = v_event
  limit 1;

  if found then
    if v_existing.workspace_id = v_workspace
       and v_existing.provider_transaction_id = v_tx
       and v_existing.purpose = v_purpose
       and v_existing.amount_minor = v_amount
       and v_existing.currency = v_currency then
      select jsonb_build_object(
        'id', i.id, 'workspaceId', i.workspace_id, 'visitId', i.visit_id,
        'status', i.status::text, 'currency', i.currency,
        'totalMinor', i.total_minor, 'allocatedMinor', i.allocated_minor,
        'refundedMinor', i.refunded_minor, 'balanceMinor', i.balance_minor
      ) into v_invoice_json
      from public.invoices i
      where i.workspace_id = v_existing.workspace_id and i.id = v_existing.invoice_id;

      select jsonb_build_object(
        'id', v.id, 'workspaceId', v.workspace_id, 'requestId', v.request_id,
        'quoteId', v.quote_id, 'crewId', v.crew_id,
        'status', case v.status when 'SCHEDULED' then 'CONFIRMED' when 'NEEDS_REVIEW' then 'PENDING_REVIEW' else v.status::text end,
        'startAt', v.starts_at, 'serviceMinutes', coalesce(q.duration_minutes, greatest(0, floor(extract(epoch from (v.ends_at - v.starts_at)) / 60)::int)),
        'bufferMinutes', coalesce(q.buffer_minutes, 0), 'version', v.version
      ) into v_visit_json
      from public.visits v
      left join public.quotes q on q.workspace_id = v.workspace_id and q.id = v.quote_id
      where v.workspace_id = v_existing.workspace_id
        and v.id = (select i.visit_id from public.invoices i where i.workspace_id = v_existing.workspace_id and i.id = v_existing.invoice_id);

      return jsonb_build_object(
        'ok', true,
        'state', case when v_existing.state = 'APPLIED' then 'DUPLICATE' else 'PAYMENT_REVIEW' end,
        'applicationId', v_existing.id,
        'invoice', v_invoice_json,
        'visit', v_visit_json
      );
    end if;

    insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, created_at)
    values (gen_random_uuid(), v_workspace, 'PAYMENT_REVIEW', 'payment_application', v_existing.id, 'WARNING', 'OPEN', 'Payment provider event identity conflict requires review.', now())
    on conflict do nothing
    returning id into v_attention_id;

    return jsonb_build_object('ok', true, 'state', 'PAYMENT_REVIEW', 'applicationId', v_existing.id, 'attentionItemId', v_attention_id);
  end if;

  select * into v_existing
  from public.verified_payment_applications
  where workspace_id = v_workspace
    and provider_account_id = v_account
    and provider_transaction_id = v_tx
    and purpose = v_purpose
  limit 1;

  if found then
    if v_existing.provider = v_provider
       and v_existing.amount_minor = v_amount
       and v_existing.currency = v_currency then
      select jsonb_build_object(
        'id', i.id, 'workspaceId', i.workspace_id, 'visitId', i.visit_id,
        'status', i.status::text, 'currency', i.currency,
        'totalMinor', i.total_minor, 'allocatedMinor', i.allocated_minor,
        'refundedMinor', i.refunded_minor, 'balanceMinor', i.balance_minor
      ) into v_invoice_json
      from public.invoices i
      where i.workspace_id = v_existing.workspace_id and i.id = v_existing.invoice_id;

      select jsonb_build_object(
        'id', v.id, 'workspaceId', v.workspace_id, 'requestId', v.request_id,
        'quoteId', v.quote_id, 'crewId', v.crew_id,
        'status', case v.status when 'SCHEDULED' then 'CONFIRMED' when 'NEEDS_REVIEW' then 'PENDING_REVIEW' else v.status::text end,
        'startAt', v.starts_at, 'serviceMinutes', coalesce(q.duration_minutes, greatest(0, floor(extract(epoch from (v.ends_at - v.starts_at)) / 60)::int)),
        'bufferMinutes', coalesce(q.buffer_minutes, 0), 'version', v.version
      ) into v_visit_json
      from public.visits v
      left join public.quotes q on q.workspace_id = v.workspace_id and q.id = v.quote_id
      where v.workspace_id = v_existing.workspace_id
        and v.id = (select i.visit_id from public.invoices i where i.workspace_id = v_existing.workspace_id and i.id = v_existing.invoice_id);

      return jsonb_build_object(
        'ok', true,
        'state', case when v_existing.state = 'APPLIED' then 'DUPLICATE' else 'PAYMENT_REVIEW' end,
        'applicationId', v_existing.id,
        'invoice', v_invoice_json,
        'visit', v_visit_json
      );
    end if;

    insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, created_at)
    values (gen_random_uuid(), v_workspace, 'PAYMENT_REVIEW', 'payment_application', v_existing.id, 'WARNING', 'OPEN', 'Payment provider transaction identity conflict requires review.', now())
    on conflict do nothing
    returning id into v_attention_id;

    return jsonb_build_object('ok', true, 'state', 'PAYMENT_REVIEW', 'applicationId', v_existing.id, 'attentionItemId', v_attention_id);
  end if;

  if v_purpose = 'PLATFORM_SUBSCRIPTION' then
    insert into public.verified_payment_applications(
      id, workspace_id, provider, provider_account_id, provider_event_id, provider_transaction_id,
      purpose, amount_minor, currency, occurred_at, state, reason_code, created_at
    ) values (
      gen_random_uuid(), v_workspace, v_provider, v_account, v_event, v_tx,
      v_purpose, v_amount, v_currency, v_occurred, 'REVIEW', 'PLATFORM_SUBSCRIPTION_OUT_OF_SCOPE', now()
    ) returning id into v_app_id;

    insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, created_at)
    values (gen_random_uuid(), v_workspace, 'PAYMENT_REVIEW', 'payment_application', v_app_id, 'INFO', 'OPEN', 'Platform subscription payment is outside customer invoice mutation.', now())
    on conflict do nothing
    returning id into v_attention_id;

    return jsonb_build_object('ok', true, 'state', 'PAYMENT_REVIEW', 'applicationId', v_app_id, 'attentionItemId', v_attention_id);
  end if;

  if v_purpose = 'DEPOSIT' then
    if v_quote_id is null or v_hold_id is null then
      v_reason := 'DEPOSIT_REFERENCE_REQUIRED';
    else
      select * into v_quote from public.quotes where workspace_id = v_workspace and id = v_quote_id for update;
      select * into v_hold from public.slot_holds where workspace_id = v_workspace and id = v_hold_id for update;
      if v_quote.id is not null then v_safe_quote_id := v_quote.id; end if;
      if v_hold.id is not null then v_safe_hold_id := v_hold.id; end if;

      if v_quote.id is null then v_reason := 'QUOTE_NOT_FOUND';
      elsif v_hold.id is null then v_reason := 'HOLD_NOT_FOUND';
      elsif v_quote.status <> 'ACCEPTED' then v_reason := 'QUOTE_NOT_ACCEPTED';
      elsif v_hold.quote_id <> v_quote.id then v_reason := 'HOLD_QUOTE_MISMATCH';
      elsif v_hold.status <> 'HELD' or v_hold.expires_at < v_occurred then v_reason := 'HOLD_EXPIRED';
      elsif v_amount <> v_quote.deposit_minor then v_reason := 'DEPOSIT_AMOUNT_MISMATCH';
      elsif v_currency <> v_quote.currency then v_reason := 'CURRENCY_MISMATCH';
      elsif exists (select 1 from public.invoices i where i.workspace_id = v_workspace and i.quote_id = v_quote.id) then v_reason := 'INVOICE_ALREADY_EXISTS';
      end if;
    end if;

    if v_reason is not null then
      insert into public.verified_payment_applications(
        id, workspace_id, provider, provider_account_id, provider_event_id, provider_transaction_id,
        purpose, quote_id, hold_id, amount_minor, currency, occurred_at, state, reason_code, created_at
      ) values (
        gen_random_uuid(), v_workspace, v_provider, v_account, v_event, v_tx,
        v_purpose, v_safe_quote_id, v_safe_hold_id, v_amount, v_currency, v_occurred, 'REVIEW', v_reason, now()
      ) returning id into v_app_id;

      insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, created_at)
      values (gen_random_uuid(), v_workspace, 'PAYMENT_REVIEW', 'payment_application', v_app_id, 'WARNING', 'OPEN', 'Deposit payment requires review: ' || v_reason, now())
      on conflict do nothing
      returning id into v_attention_id;

      return jsonb_build_object('ok', true, 'state', 'PAYMENT_REVIEW', 'applicationId', v_app_id, 'attentionItemId', v_attention_id, 'reason', v_reason);
    end if;

    select * into v_slot from public.capacity_slots where workspace_id = v_workspace and id = v_hold.slot_id for update;
    if v_slot.id is null then
      return jsonb_build_object('ok', false, 'code', 'SLOT_NOT_FOUND');
    end if;

    insert into public.invoices(
      id, workspace_id, quote_id, status, currency, total_minor, allocated_minor, refunded_minor, balance_minor, version, created_at, updated_at
    ) values (
      gen_random_uuid(), v_workspace, v_quote.id,
      case when v_quote.total_minor - v_amount = 0 then 'PAID'::public.invoice_status else 'PARTIALLY_PAID'::public.invoice_status end,
      v_quote.currency, v_quote.total_minor, v_amount, 0, v_quote.total_minor - v_amount, 1, now(), now()
    ) returning * into v_invoice;

    insert into public.visits(
      id, workspace_id, request_id, quote_id, slot_id, hold_id, crew_id, status, starts_at, ends_at, timezone, version, created_at, updated_at
    ) values (
      gen_random_uuid(), v_workspace, v_quote.request_id, v_quote.id, v_slot.id, v_hold.id, v_slot.crew_id,
      'SCHEDULED', v_slot.starts_at, v_slot.starts_at + ((v_quote.duration_minutes + v_quote.buffer_minutes)::text || ' minutes')::interval,
      v_slot.timezone, 1, now(), now()
    ) returning * into v_visit;

    update public.invoices
    set visit_id = v_visit.id, updated_at = now()
    where workspace_id = v_workspace and id = v_invoice.id
    returning * into v_invoice;

    update public.slot_holds
    set status = 'CONFIRMED', updated_at = now()
    where workspace_id = v_workspace and id = v_hold.id;

    insert into public.verified_payment_applications(
      id, workspace_id, provider, provider_account_id, provider_event_id, provider_transaction_id,
      purpose, quote_id, hold_id, invoice_id, amount_minor, currency, occurred_at, state, created_at
    ) values (
      gen_random_uuid(), v_workspace, v_provider, v_account, v_event, v_tx,
      v_purpose, v_quote.id, v_hold.id, v_invoice.id, v_amount, v_currency, v_occurred, 'APPLIED', now()
    ) returning id into v_app_id;

    insert into public.ledger_entries(id, workspace_id, resource_type, resource_id, direction, amount_minor, currency, idempotency_key, occurred_at)
    values (gen_random_uuid(), v_workspace, 'invoice', v_invoice.id, 'CREDIT', v_amount, v_currency, 'payment:' || v_app_id::text, v_occurred);

    insert into public.outbox_events(id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at)
    values (
      gen_random_uuid(), v_workspace, 'calendar.visit.upsert',
      jsonb_build_object('visitId', v_visit.id, 'requestId', v_visit.request_id, 'quoteId', v_visit.quote_id, 'startsAt', v_visit.starts_at, 'endsAt', v_visit.ends_at, 'timezone', v_visit.timezone),
      'PENDING', 0, 'calendar.visit.upsert:' || v_visit.id::text, now(), now()
    ) returning id into v_outbox_id;

    v_invoice_json := jsonb_build_object(
      'id', v_invoice.id, 'workspaceId', v_invoice.workspace_id, 'visitId', v_invoice.visit_id,
      'status', v_invoice.status::text, 'currency', v_invoice.currency,
      'totalMinor', v_invoice.total_minor, 'allocatedMinor', v_invoice.allocated_minor,
      'refundedMinor', v_invoice.refunded_minor, 'balanceMinor', v_invoice.balance_minor
    );
    v_visit_json := jsonb_build_object(
      'id', v_visit.id, 'workspaceId', v_visit.workspace_id, 'requestId', v_visit.request_id,
      'quoteId', v_visit.quote_id, 'crewId', v_visit.crew_id, 'status', 'CONFIRMED',
      'startAt', v_visit.starts_at, 'serviceMinutes', v_quote.duration_minutes, 'bufferMinutes', v_quote.buffer_minutes, 'version', v_visit.version
    );

    return jsonb_build_object('ok', true, 'state', 'APPLIED', 'applicationId', v_app_id, 'invoice', v_invoice_json, 'visit', v_visit_json, 'outboxEventId', v_outbox_id);
  end if;

  if v_purpose = 'BALANCE' then
    if v_invoice_id is null then
      v_reason := 'BALANCE_INVOICE_REQUIRED';
    else
      select * into v_invoice from public.invoices where workspace_id = v_workspace and id = v_invoice_id for update;
      if v_invoice.id is not null then v_safe_invoice_id := v_invoice.id; end if;
      if v_invoice.id is null then v_reason := 'INVOICE_NOT_FOUND';
      elsif v_invoice.status in ('VOID','PAID') then v_reason := 'INVOICE_NOT_PAYABLE';
      elsif v_currency <> v_invoice.currency then v_reason := 'CURRENCY_MISMATCH';
      elsif v_amount <> v_invoice.balance_minor then v_reason := 'BALANCE_AMOUNT_MISMATCH';
      end if;
    end if;

    if v_reason is not null then
      insert into public.verified_payment_applications(
        id, workspace_id, provider, provider_account_id, provider_event_id, provider_transaction_id,
        purpose, invoice_id, amount_minor, currency, occurred_at, state, reason_code, created_at
      ) values (
        gen_random_uuid(), v_workspace, v_provider, v_account, v_event, v_tx,
        v_purpose, v_safe_invoice_id, v_amount, v_currency, v_occurred, 'REVIEW', v_reason, now()
      ) returning id into v_app_id;

      insert into public.attention_items(id, workspace_id, type, resource_type, resource_id, severity, status, summary, created_at)
      values (gen_random_uuid(), v_workspace, 'PAYMENT_REVIEW', 'payment_application', v_app_id, 'WARNING', 'OPEN', 'Balance payment requires review: ' || v_reason, now())
      on conflict do nothing
      returning id into v_attention_id;

      return jsonb_build_object('ok', true, 'state', 'PAYMENT_REVIEW', 'applicationId', v_app_id, 'attentionItemId', v_attention_id, 'reason', v_reason);
    end if;

    update public.invoices
    set allocated_minor = allocated_minor + v_amount,
        balance_minor = balance_minor - v_amount,
        status = case when balance_minor - v_amount = 0 then 'PAID'::public.invoice_status else 'PARTIALLY_PAID'::public.invoice_status end,
        version = version + 1,
        updated_at = now()
    where workspace_id = v_workspace and id = v_invoice.id
    returning * into v_invoice;

    insert into public.verified_payment_applications(
      id, workspace_id, provider, provider_account_id, provider_event_id, provider_transaction_id,
      purpose, invoice_id, amount_minor, currency, occurred_at, state, created_at
    ) values (
      gen_random_uuid(), v_workspace, v_provider, v_account, v_event, v_tx,
      v_purpose, v_invoice.id, v_amount, v_currency, v_occurred, 'APPLIED', now()
    ) returning id into v_app_id;

    insert into public.ledger_entries(id, workspace_id, resource_type, resource_id, direction, amount_minor, currency, idempotency_key, occurred_at)
    values (gen_random_uuid(), v_workspace, 'invoice', v_invoice.id, 'CREDIT', v_amount, v_currency, 'payment:' || v_app_id::text, v_occurred);

    insert into public.outbox_events(id, workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at)
    values (
      gen_random_uuid(), v_workspace, 'invoice.receipt',
      jsonb_build_object('invoiceId', v_invoice.id, 'paymentApplicationId', v_app_id),
      'PENDING', 0, 'payment-outbox:' || v_app_id::text, now(), now()
    ) returning id into v_outbox_id;

    v_invoice_json := jsonb_build_object(
      'id', v_invoice.id, 'workspaceId', v_invoice.workspace_id, 'visitId', v_invoice.visit_id,
      'status', v_invoice.status::text, 'currency', v_invoice.currency,
      'totalMinor', v_invoice.total_minor, 'allocatedMinor', v_invoice.allocated_minor,
      'refundedMinor', v_invoice.refunded_minor, 'balanceMinor', v_invoice.balance_minor
    );
    select jsonb_build_object(
      'id', v.id, 'workspaceId', v.workspace_id, 'requestId', v.request_id,
      'quoteId', v.quote_id, 'crewId', v.crew_id,
      'status', case v.status when 'SCHEDULED' then 'CONFIRMED' when 'NEEDS_REVIEW' then 'PENDING_REVIEW' else v.status::text end,
      'startAt', v.starts_at, 'serviceMinutes', coalesce(q.duration_minutes, greatest(0, floor(extract(epoch from (v.ends_at - v.starts_at)) / 60)::int)),
      'bufferMinutes', coalesce(q.buffer_minutes, 0), 'version', v.version
    ) into v_visit_json
    from public.visits v
    left join public.quotes q on q.workspace_id = v.workspace_id and q.id = v.quote_id
    where v.workspace_id = v_invoice.workspace_id and v.id = v_invoice.visit_id;

    return jsonb_build_object('ok', true, 'state', 'APPLIED', 'applicationId', v_app_id, 'invoice', v_invoice_json, 'visit', v_visit_json, 'outboxEventId', v_outbox_id);
  end if;

  return jsonb_build_object('ok', false, 'code', 'PAYMENT_PURPOSE_UNSUPPORTED');
end;
$$;

revoke all on function public.servicedesk_apply_verified_payment(jsonb) from public;
revoke all on function public.servicedesk_apply_verified_payment(jsonb) from anon;
revoke all on function public.servicedesk_apply_verified_payment(jsonb) from authenticated;
grant execute on function public.servicedesk_apply_verified_payment(jsonb) to service_role;

comment on function public.servicedesk_apply_verified_payment(jsonb) is
  'Trusted service-role verified payment application RPC. Atomic deposit/balance mutation, duplicate-safe payment identity, review routing, ledger/outbox projection, and DTO-shaped return payload.';
