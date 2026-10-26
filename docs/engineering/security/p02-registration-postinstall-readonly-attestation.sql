\set ON_ERROR_STOP on
-- P02 SOURCE-ONLY READ-ONLY POSTINSTALL ATTESTATION, NOT AN INSTALL SCRIPT.
-- Must run ONLY AFTER separately authorized guarded SQL installation and
-- BEFORE any QA grant is provisioned or mode is opened. Can be rerun in
-- a disposable PostgreSQL 17 database; no SQL/DML/provider action occurs.
begin transaction read only;

do $p02_postinstall_check$
declare
  v_reg oid := to_regprocedure('public.servicedesk_register_owner_workspace(text,text,text,text)');
  v_branch oid := to_regprocedure('public.servicedesk_default_branch(uuid)');
  v_mode_rows bigint;
  v_closed_rows bigint;
  v_qa_grants bigint;
  v_body text;
  v_config text;
  v_rpc_owner text;
  v_rpc_definer boolean;
begin
  if to_regnamespace('servicedesk_security') is null
     or to_regclass('servicedesk_security.owner_registration_control') is null
     or to_regclass('servicedesk_security.owner_registration_grants') is null
     or v_reg is null or v_branch is null
  then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: guarded objects missing';
  end if;

  select count(*), count(*) filter (where singleton and mode = 'CLOSED')
    into v_mode_rows, v_closed_rows
  from servicedesk_security.owner_registration_control;
  select count(*) into v_qa_grants
  from servicedesk_security.owner_registration_grants;
  if v_mode_rows <> 1 or v_closed_rows <> 1 or v_qa_grants <> 0 then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: CLOSED and zero-grant install receipt required';
  end if;

  select p.prosrc, array_to_string(p.proconfig, ','), pg_get_userbyid(p.proowner), p.prosecdef
    into v_body, v_config, v_rpc_owner, v_rpc_definer
  from pg_proc p where p.oid = v_reg;
  -- Exact guarded PL/pgSQL body digest from approved disposable PG17
  -- installation of the unchanged candidate. Detects even comment-only or
  -- otherwise syntactically valid unreviewed body modifications.
  if md5(v_body) is distinct from 'b24154db78c5f1b210f86c97f896d44d' then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: guarded function body hash drift';
  end if;

  if v_rpc_definer is distinct from true or v_rpc_owner is distinct from 'postgres'
     or v_config is null
     or v_config not like '%search_path=pg_catalog, public, pg_temp%'
     or v_body not like '%select c.mode into v_registration_mode%'
     or v_body not like '%select true into v_qa_granted%'
     or v_body not like '%g.expires_at > pg_catalog.clock_timestamp()%'
     or v_body not like '%v_registration_mode is distinct from ''PUBLIC''%'
     or v_body not like '%for share%'
     or v_body not like '%REGISTRATION_NOT_AUTHORIZED%'
  then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: guarded RPC definition or privileged owner mismatch';
  end if;

  if not has_function_privilege('authenticated',v_reg,'EXECUTE')
     or has_function_privilege('anon',v_reg,'EXECUTE')
     or exists (
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       where p.oid=v_reg and a.grantee=0 and a.privilege_type='EXECUTE'
     )
  then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: registration RPC ACL drift';
  end if;
  -- Neither the Data API role nor the PUBLIC pseudo-role may read or mutate
  -- private registration controls; table RLS adds a second barrier.
  if has_schema_privilege('anon','servicedesk_security','USAGE')
     or has_schema_privilege('authenticated','servicedesk_security','USAGE')
     or has_schema_privilege('anon','servicedesk_security','CREATE')
     or has_schema_privilege('authenticated','servicedesk_security','CREATE')
     or has_schema_privilege('anon','public','CREATE')
     or has_schema_privilege('authenticated','public','CREATE')
  then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: exposed privileged schema';
  end if;

  -- All effective API role table AND column privileges must be denied.
  -- A SELECT-only check misses DELETE/TRUNCATE/TRIGGER/MAINTAIN grants,
  -- and a table ACL check alone misses column-level grants.
  if exists (
    select 1
    from (values ('anon'::text), ('authenticated'::text)) as api(role_name)
    cross join (values
      ('servicedesk_security.owner_registration_control'::regclass),
      ('servicedesk_security.owner_registration_grants'::regclass)
    ) as protected(table_oid)
    cross join (values
      ('SELECT'::text),
      ('INSERT'::text),
      ('UPDATE'::text),
      ('DELETE'::text),
      ('TRUNCATE'::text),
      ('REFERENCES'::text),
      ('TRIGGER'::text),
      ('MAINTAIN'::text)
    ) as table_right(privilege_name)
    where has_table_privilege(api.role_name, protected.table_oid, table_right.privilege_name)
  ) or exists (
    select 1
    from (values ('anon'::text), ('authenticated'::text)) as api(role_name)
    cross join (values
      ('servicedesk_security.owner_registration_control'::regclass),
      ('servicedesk_security.owner_registration_grants'::regclass)
    ) as protected(table_oid)
    cross join (values
      ('SELECT'::text),
      ('INSERT'::text),
      ('UPDATE'::text),
      ('REFERENCES'::text)
    ) as column_right(privilege_name)
    where has_any_column_privilege(api.role_name, protected.table_oid, column_right.privilege_name)
  ) then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: direct protected table or column access';
  end if;
  if (select count(*)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='servicedesk_security'
        and c.relname in ('owner_registration_control','owner_registration_grants')
        and c.relkind='r' and c.relrowsecurity) <> 2
     or exists (
       select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='servicedesk_security'
         and c.relname in ('owner_registration_control','owner_registration_grants')
     )
  then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: protected table RLS or policy drift';
  end if;


  -- The immediate row contents alone cannot prove that constraints survived.
  -- Reject missing/replaced PKs, the CLOSED/QA_ONLY/PUBLIC check, singleton
  -- check or Auth FK, even while the current dataset looks harmless.
  if (
    select count(*)
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='servicedesk_security'
      and t.relname in ('owner_registration_control','owner_registration_grants')
  ) <> 5 or (
    select count(*)
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='servicedesk_security'
      and (
        (t.relname='owner_registration_control'
         and c.conname='owner_registration_control_pkey'
         and c.contype='p'
         and pg_get_constraintdef(c.oid)='PRIMARY KEY (singleton)')
        or (t.relname='owner_registration_control'
         and c.conname='owner_registration_control_singleton_check'
         and c.contype='c'
         and pg_get_constraintdef(c.oid)='CHECK (singleton)')
        or (t.relname='owner_registration_control'
         and c.conname='owner_registration_control_mode_check'
         and c.contype='c'
         and pg_get_constraintdef(c.oid) like '%mode = ANY%'
         and pg_get_constraintdef(c.oid) like '%CLOSED%'
         and pg_get_constraintdef(c.oid) like '%QA_ONLY%'
         and pg_get_constraintdef(c.oid) like '%PUBLIC%')
        or (t.relname='owner_registration_grants'
         and c.conname='owner_registration_grants_pkey'
         and c.contype='p'
         and pg_get_constraintdef(c.oid)='PRIMARY KEY (user_id)')
        or (t.relname='owner_registration_grants'
         and c.conname='owner_registration_grants_user_id_fkey'
         and c.contype='f'
         and pg_get_constraintdef(c.oid)
              like 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE%')
      )
  ) <> 5 or (
    select count(*)
    from pg_attribute a
    where (a.attrelid='servicedesk_security.owner_registration_control'::regclass
           and a.attname in ('singleton','mode','updated_at')
           and a.attnotnull)
       or (a.attrelid='servicedesk_security.owner_registration_grants'::regclass
           and a.attname in ('user_id','expires_at','approved_at')
           and a.attnotnull)
  ) <> 6 then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: protected table constraint drift';
  end if;

  if (select pg_get_userbyid(p.proowner) from pg_proc p where p.oid=v_branch) is distinct from 'postgres'
     or (select p.prosecdef from pg_proc p where p.oid=v_branch) is distinct from true
     or (select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid=v_branch)
        is distinct from '9f14160f16e16ffe6ac16f35c3f4557f'
  then
    raise exception 'P02_REGISTRATION_POSTINSTALL_BLOCKED: repaired 0065 branch RPC drift';
  end if;
end $p02_postinstall_check$;

-- This PASS is valid only before any approved QA grants/mode changes.
select 'P02_REGISTRATION_POSTINSTALL_CLOSED_PASS' as result;
rollback;
