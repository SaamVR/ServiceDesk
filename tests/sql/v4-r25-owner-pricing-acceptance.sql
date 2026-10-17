-- Real SQL transaction/replay and negative branch authorization, no provider data.
create function pg_temp.rule(oven boolean) returns jsonb language plpgsql as $$
declare v jsonb;
begin
 v := '{"baseMinor":9000,"baseMinutes":90,"bedroomMinor":1500,"bedroomMinutes":20,"bathroomMinor":1500,"bathroomMinutes":20}'::jsonb;
 if oven then v:=v||'{"ovenMinor":3500,"ovenMinutes":30}'::jsonb; end if;
 return v;
end $$;
create function pg_temp.payload(who uuid,book uuid,ver bigint,request uuid) returns jsonb
language sql as $$
 select jsonb_build_object('workspaceId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'actorUserId',who,'actorRole','OWNER',
 'branchId','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'expectedBookId',book,'expectedBookVersion',ver,'setupId',request,'currency','USD',
 'serviceNames','{"STANDARD":"Standard cleaning","DEEP":"Deep cleaning","MOVE_OUT":"Move-out cleaning"}'::jsonb,
 'rules',jsonb_build_object('autoApprovalMaxTotalMinor',50000,'standard',pg_temp.rule(false),
   'deep',pg_temp.rule(false),'moveOut',pg_temp.rule(true)),
 'depositPercent',25,'validHours',48,'bufferMinutes',30);
$$;
do $$
declare
 owner uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
 foreign_owner uuid:='88888888-8888-4888-8888-888888888888';
 old_book uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 key uuid:='12345678-1234-4234-8234-123456789abc';
 payload jsonb; outcome jsonb; new_book uuid; n integer;
begin
 payload:=pg_temp.payload(foreign_owner,old_book,7,key);
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(payload);
 if outcome->>'code'<>'PRICING_REVISION_OWNER_REQUIRED' then raise exception 'foreign owner allowed: %',outcome; end if;
 payload:=pg_temp.payload(owner,old_book,6,key);
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(payload);
 if outcome->>'code'<>'PRICING_REVISION_VERSION_CONFLICT' then raise exception 'stale write allowed: %',outcome; end if;
 payload:=pg_temp.payload(owner,old_book,7,key);
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(
 jsonb_set(payload,'{serviceNames,STANDARD}','"Wrong name"'::jsonb));
 if outcome->>'code'<>'PRICING_REVISION_CATALOG_MISMATCH' then raise exception 'global catalog mutation allowed: %',outcome; end if;
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(payload);
 if outcome->>'ok'<>'true' or outcome->>'duplicate'<>'false' then raise exception 'first write failed: %',outcome; end if;
 new_book:=(outcome->>'priceBookId')::uuid;
 if not exists(select 1 from public.branch_price_books where id=old_book and active=false and version=8)
 or not exists(select 1 from public.branch_price_books where id=new_book and active)
 or not exists(select 1 from public.rate_cards where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    and active and rules='{"broken":true}'::jsonb)
 then raise exception 'historical rate not immutable or new active book missing'; end if;
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(payload);
 if outcome->>'ok'<>'true' or outcome->>'duplicate'<>'true'
 or (outcome->>'priceBookId')::uuid<>new_book then raise exception 'idempotent retry failed: %',outcome; end if;
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(jsonb_set(payload,'{depositPercent}','30'::jsonb));
 if outcome->>'code'<>'PRICING_REVISION_IDEMPOTENCY_CONFLICT' then raise exception 'changed replay allowed: %',outcome; end if;
 outcome:=public.servicedesk_revise_owner_cleaning_pricing(pg_temp.payload(owner,old_book,7,
 '22222222-2222-4222-8222-222222222222'));
 if outcome->>'code'<>'PRICING_REVISION_VERSION_CONFLICT' then raise exception 'stale old book reused: %',outcome; end if;
 select count(*) into n from public.branch_price_books
 where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and active;
 if n<>1 then raise exception 'not exactly one active branch book'; end if;
 select count(*) into n from public.audit_events where action='cleaning_pricing.revised';
 if n<>1 then raise exception 'bad durable audit count: %',n; end if;
 raise notice 'R25 disposable PG17 revision PASS';
end $$;
