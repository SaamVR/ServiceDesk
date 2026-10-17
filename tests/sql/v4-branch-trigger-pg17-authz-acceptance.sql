\set ON_ERROR_STOP on
-- Both owner identities use the same authenticated DB role, with *different*
-- auth.uid() JWT contexts, exactly the condition a SECURITY DEFINER RPC
-- must enforce. No provider API, real JWT, staging tenant, or customer data.
do $catalog$
begin
  if not has_function_privilege('authenticated',
      'public.servicedesk_default_branch(uuid)','EXECUTE') then
    raise exception 'Authenticated trigger callers unexpectedly lost execute';
  end if;
  if has_function_privilege('anon',
      'public.servicedesk_default_branch(uuid)','EXECUTE') then
    raise exception 'Anonymous role can resolve default branches';
  end if;
  if not (select prosecdef from pg_proc where oid=
      'public.servicedesk_default_branch(uuid)'::regprocedure) then
    raise exception 'Expected definer helper unexpectedly changed security mode';
  end if;
end
$catalog$;

begin;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $owner_a$
begin
  if public.servicedesk_default_branch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is distinct from
      '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'Owner A cannot read own default branch';
  end if;
  if public.servicedesk_default_branch(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is not null then
    raise exception 'Owner A leaked the foreign default branch';
  end if;
end
$owner_a$;
-- Authenticated owner must still be able to omit branch_id when writing an
-- authorized row. This runs the actual seven-table shared trigger installed
-- earlier in the rowtype fixture, not a mocked API.
insert into public.properties(id,workspace_id,branch_id)
values('90000000-0000-4000-8000-000000000001',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
do $trigger_a$
begin
  if (select branch_id from public.properties
      where id='90000000-0000-4000-8000-000000000001') is distinct from
      '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'Owner A authorized trigger default was broken';
  end if;
end
$trigger_a$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='bbbbbbbb-0000-4000-8000-000000000002';
do $owner_b$
begin
  if public.servicedesk_default_branch(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is distinct from
      '33333333-3333-4333-8333-333333333333'::uuid then
    raise exception 'Owner B cannot read own default branch';
  end if;
  if public.servicedesk_default_branch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null then
    raise exception 'Owner B leaked the foreign default branch';
  end if;
end
$owner_b$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='cccccccc-0000-4000-8000-000000000003';
do $revoked$
begin
  if public.servicedesk_default_branch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null then
    raise exception 'Revoked actor resolved a default branch';
  end if;
end
$revoked$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
-- Authenticated role without user must fail closed, not inherit postgres data.
do $missing_identity$
begin
  if public.servicedesk_default_branch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null then
    raise exception 'Missing auth.uid unexpectedly resolved a branch';
  end if;
end
$missing_identity$;
rollback;

-- An attacker-controlled claim alone must not be enough to impersonate the
-- privileged SQL role. Real PostgREST role switch must match the service JWT.
begin;
set local role authenticated;
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='aaaaaaaa-0000-4000-8000-000000000001';
do $forged_role$
begin
  if public.servicedesk_default_branch(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is not null then
    raise exception 'Forged service_role JWT claim bypassed database role';
  end if;
end
$forged_role$;
rollback;

begin;
set local role service_role;
set local request.jwt.claim.role='service_role';
-- The internal service role intentionally retains direct lookup during
-- existing privileged workflows even without a customer auth.uid().
do $service$
begin
  if public.servicedesk_default_branch(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is distinct from
      '33333333-3333-4333-8333-333333333333'::uuid then
    raise exception 'Service role lookup regressed';
  end if;
end
$service$;
rollback;
select 'PG17_TWO_OWNER_DEFAULT_BRANCH_AUTHORIZATION_PASS' as receipt;
