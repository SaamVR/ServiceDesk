-- F26 fictional PostgreSQL 17 JWT stub only, never copied to production.
-- Existing fixture creates fake anon/authenticated database roles.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
