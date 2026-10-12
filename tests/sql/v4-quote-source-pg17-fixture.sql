-- Ephemeral PostgreSQL 17 fixture, no Supabase network or customer data.
-- Apply THIS FIRST, then SQL 0062, then the regression assertions.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create extension if not exists pgcrypto;
create table public.workspaces(id uuid primary key);
create table public.quotes(
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  status text not null check(status in('SENT','ACCEPTED')),
  unique(workspace_id,id)
);
create table public.workspace_feature_flags(
  workspace_id uuid not null references public.workspaces(id),
  feature_key text not null,
  enabled boolean not null default false,
  primary key(workspace_id,feature_key)
);
