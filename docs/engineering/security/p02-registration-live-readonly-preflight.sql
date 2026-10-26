\set ON_ERROR_STOP on
-- P02 SOURCE-ONLY operator gate: never execute registration DDL here.
-- Target: existing ServiceDesk Supabase database, ONLY after owner-approved
-- review. Operates in a READ ONLY transaction and rejects source drift.
-- Exit nonzero if the live function/grants/schema differ from the vetted
-- preimage. This does not authorize installing the candidate SQL.
begin transaction read only;
select (
  to_regprocedure('public.servicedesk_register_owner_workspace(text,text,text,text)') is not null
  and (select md5(pg_get_functiondef(p.oid))
       from pg_proc p
       where p.oid = to_regprocedure('public.servicedesk_register_owner_workspace(text,text,text,text)')
      ) = 'e4de11c0b1b6736e46e201ee491d908f'
  and (select p.prosecdef from pg_proc p
       where p.oid = to_regprocedure('public.servicedesk_register_owner_workspace(text,text,text,text)')
      ) is true
  -- SECURITY DEFINER executes with FUNCTION OWNER privileges. A body hash
  -- and the flag alone cannot detect ALTER FUNCTION ... OWNER TO drift.
  and (select pg_catalog.pg_get_userbyid(p.proowner) from pg_proc p
       where p.oid = to_regprocedure('public.servicedesk_register_owner_workspace(text,text,text,text)')
      ) = 'postgres'
  and has_function_privilege(
      'authenticated',
      'public.servicedesk_register_owner_workspace(text,text,text,text)',
      'EXECUTE'
    )
  and not has_function_privilege(
      'anon',
      'public.servicedesk_register_owner_workspace(text,text,text,text)',
      'EXECUTE'
    )
  -- This SECURITY DEFINER RPC searches public. Any CREATE grant to the
  -- Data API roles would undermine the reviewed search_path preimage.
  and not has_schema_privilege('anon', 'public', 'CREATE')
  and not has_schema_privilege('authenticated', 'public', 'CREATE')
  and to_regnamespace('servicedesk_security') is null
  and (
    select md5(pg_get_functiondef(p.oid))
    from pg_proc p
    where p.oid = to_regprocedure('public.servicedesk_default_branch(uuid)')
  ) = '9f14160f16e16ffe6ac16f35c3f4557f'
  and (select pg_catalog.pg_get_userbyid(p.proowner) from pg_proc p
       where p.oid = to_regprocedure('public.servicedesk_default_branch(uuid)')
      ) = 'postgres'
) as p02_source_preimage_valid
\gset
\if :p02_source_preimage_valid
  \echo P02_REGISTRATION_READONLY_PREIMAGE_PASS
\else
  \echo P02_REGISTRATION_READONLY_PREIMAGE_BLOCKED
  rollback;
  -- SQL execution failure + ON_ERROR_STOP gives a nonzero psql exit.
  -- A bare psql \quit command may exit with status 0 despite a BLOCKED gate.
  select 1 / 0 as p02_preimage_blocked;
\endif
rollback;
