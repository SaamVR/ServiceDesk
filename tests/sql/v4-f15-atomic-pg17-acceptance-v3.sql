-- F15 V3 independently linked owner attention, disposable PG17 only.
\set ON_ERROR_STOP on
\i tests/sql/v4-f15-atomic-pg17-acceptance.sql

-- Earlier source assertions must be joined to ONE linked attention for each
-- persisted review, even across two fictional tenants and identical-time IDs.
do $$
begin
 if exists (
   select 1 from public.f15_unanswered_lead_reviews e
   left join public.attention_items a
     on a.workspace_id=e.workspace_id
    and a.type='UNANSWERED_LEAD_SLA'
    and a.resource_type='f15_unanswered_lead_review'
    and a.resource_id=e.id
   group by e.id having count(a.id)<>1
 ) or (select count(*) from public.attention_items) <>
      (select count(*) from public.f15_unanswered_lead_reviews)
 or (select count(distinct workspace_id) from public.attention_items)<>2
 or exists (
   select 1 from public.attention_items a
   where a.type<>'UNANSWERED_LEAD_SLA'
     or a.resource_type<>'f15_unanswered_lead_review'
     or a.severity<>'WARNING' or a.status<>'OPEN'
     or a.summary<>'Saved unanswered customer lead needs owner review'
 ) then raise exception 'F15_V3_ATOMIC_ATTENTION_LINEAGE_UNVERIFIED'; end if;
 if has_table_privilege('anon','public.attention_items','INSERT')
    or not has_table_privilege('authenticated','public.attention_items','SELECT')
    or not (select relrowsecurity from pg_catalog.pg_class
      where oid='public.attention_items'::regclass)
 then raise exception 'F15_V3_ATTENTION_ACL_RLS_DENIAL_FAILED';end if;
end $$;

-- Own new fresh source to prove that an attention write failure rolls back
-- the review row in the SAME transaction (not merely a source lock).
insert into public.requests values
 ('abababab-abab-4bab-8bab-abababababab',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'efefefef-efef-4efe-8efe-efefefefefef',
  'NEW',1,clock_timestamp()-interval '3 hours');
insert into public.conversations values
 ('cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'abababab-abab-4bab-8bab-abababababab',
  'efefefef-efef-4efe-8efe-efefefefefef');
insert into public.messages values
 ('f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd',
  'INBOUND','CUSTOMER',clock_timestamp()-interval '2 hours');

alter table public.attention_items add constraint f15_forced_attention_denial
 check (type<>'UNANSWERED_LEAD_SLA') not valid;
set role service_role;
do $$
declare rejected boolean:=false;
begin
 begin
  perform public.servicedesk_claim_f15_unanswered_lead_sla_review(
   public.f15_fixture_claim_input('abababab-abab-4bab-8bab-abababababab'));
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'F15_ATTENTION_FAILURE_SWALLOWED';end if;
end $$;
reset role;
alter table public.attention_items drop constraint f15_forced_attention_denial;
do $$
begin
 if (select count(*) from public.f15_unanswered_lead_reviews
   where request_id='abababab-abab-4bab-8bab-abababababab')<>0
 or (select count(*) from public.attention_items
   where resource_id in (select id from public.f15_unanswered_lead_reviews
     where request_id='abababab-abab-4bab-8bab-abababababab'))<>0
 then raise exception 'F15_ATTENTION_INSERT_FAILURE_LEFT_REVIEW';end if;
end $$;

-- A successful retry after constraint removal creates one review + attention.
-- A subsequent replay after human acknowledgement must reuse both rows.
set role service_role;
do $$
declare first jsonb; replay jsonb; review_id uuid; attention_id uuid;
begin
 first:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
  public.f15_fixture_claim_input('abababab-abab-4bab-8bab-abababababab'));
 if first->>'state'<>'INSERTED' then
  raise exception 'F15_V3_ATTENTION_SUCCESS_MISSING %',first;end if;
 select id into review_id from public.f15_unanswered_lead_reviews
 where request_id='abababab-abab-4bab-8bab-abababababab';
 select id into attention_id from public.attention_items
 where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and resource_type='f15_unanswered_lead_review'
   and resource_id=review_id;
 if attention_id is null then
  raise exception 'F15_V3_ATTENTION_LINK_MISSING';end if;
 update public.attention_items set status='ACKNOWLEDGED' where id=attention_id;
 replay:=public.servicedesk_claim_f15_unanswered_lead_sla_review(
  public.f15_fixture_claim_input('abababab-abab-4bab-8bab-abababababab'));
 if replay->>'state'<>'ALREADY_RECORDED'
    or (select count(*) from public.attention_items
      where resource_type='f15_unanswered_lead_review'
        and resource_id=review_id)<>1
 then raise exception 'F15_V3_ACK_REPLAY_DUPLICATE %',replay;end if;
end $$;
reset role;


-- Simulate 0004's permissive attention staff RLS. V3 restrictive policies
-- must veto forged F15 attention insertion, mutation and deletion while
-- an ordinary non-F15 staff item remains writable.
set role authenticated;
do $f15guard$
declare changed integer; prevented boolean;
begin
 insert into public.attention_items(
  id,workspace_id,type,resource_type,resource_id,severity,summary
 ) values (
  '01010101-0101-4101-8101-010101010101',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'SAVED_REQUEST_REVIEW','request','33333333-3333-4333-8333-333333333333',
  'INFO','Staff attention non-F15 fixture');
 update public.attention_items set summary='Ordinary staff update permitted'
 where id='01010101-0101-4101-8101-010101010101';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'F15_RESTRICTIVE_POLICY_BLOCKED_NORMAL_STAFF';end if;

 prevented:=false;
 begin
  insert into public.attention_items(
   workspace_id,type,resource_type,resource_id,severity,summary
  ) values (
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'UNANSWERED_LEAD_SLA','f15_unanswered_lead_review',
   'abababab-abab-4bab-8bab-abababababab','WARNING','Forged staff escalation');
 exception when insufficient_privilege then prevented:=true;
 end;
 if not prevented then raise exception 'F15_STAFF_FORGED_INSERT_ALLOWED';end if;

 update public.attention_items set summary='Staff tampered'
 where type='UNANSWERED_LEAD_SLA';
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'F15_STAFF_EDITED_INTERNAL_REVIEW';end if;
 delete from public.attention_items where type='UNANSWERED_LEAD_SLA';
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'F15_STAFF_DELETED_INTERNAL_REVIEW';end if;

 prevented:=false;
 begin
  update public.attention_items
   set type='UNANSWERED_LEAD_SLA',resource_type='f15_unanswered_lead_review'
   where id='01010101-0101-4101-8101-010101010101';
 exception when insufficient_privilege then prevented:=true;
 end;
 if not prevented then raise exception 'F15_STAFF_CONVERTED_UNRELATED_ATTENTION';end if;
end $f15guard$;
reset role;

-- Canonical 0004's original unique index only covers OPEN. Confirm V3's
-- new F15-specific index rejects a second OPEN attention after human ACK.
do $f15index$
declare source_review uuid; prevented boolean:=false; linked_count integer;
begin
 select id into source_review from public.f15_unanswered_lead_reviews
 where request_id='abababab-abab-4bab-8bab-abababababab';
 if source_review is null then raise exception 'F15_ACK_REVIEW_MISSING';end if;
 begin
  insert into public.attention_items(
   workspace_id,type,resource_type,resource_id,severity,summary
  ) values (
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'UNANSWERED_LEAD_SLA','f15_unanswered_lead_review',
   source_review,'WARNING','Duplicate open attention after acknowledgement');
 exception when unique_violation then prevented:=true;
 end;
 if not prevented then raise exception 'F15_ACK_DUPLICATE_ATTENTION_ALLOWED';end if;
 select count(*) into linked_count from public.attention_items
 where resource_type='f15_unanswered_lead_review' and resource_id=source_review;
 if linked_count<>1 then raise exception 'F15_ACK_DUPLICATE_ATTENTION_PERSISTED';end if;
end $f15index$;

select 'PG17_F15_V3_RESTRICTIVE_RLS_ACK_UNIQUENESS_PASS' as receipt;

select 'PG17_F15_V3_REVIEW_ATTENTION_ATOMIC_ROLLBACK_REPLAY_PASS' as receipt;
