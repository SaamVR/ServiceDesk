\set ON_ERROR_STOP on
-- The historical shared 0053 function must reproduce the exact missing-row
-- field error on a properties row, BEFORE migration 0062 repairs the function.
do $$
declare observed boolean:=false;
begin
  begin
    insert into public.properties(id,workspace_id,branch_id)
    values ('90000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
  exception when undefined_column then
    observed:=true;
  end;
  if not observed then
    raise exception 'Historical 0053 row-type defect was NOT reproduced';
  end if;
end $$;
select 'PG17_OLD_ROWTYPE_DEFECT_REPRODUCED' as receipt;
