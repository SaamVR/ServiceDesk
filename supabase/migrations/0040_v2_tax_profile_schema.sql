-- ServiceDesk AI V2 Wave 2B.4C: workspace tax configuration governance.
-- Tax profiles are reference-only until a separately reviewed tax-application policy exists.
-- No default profile is seeded and V1 synthetic zero tax is not promoted.

create table if not exists public.workspace_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  jurisdiction_code text not null check (length(trim(jurisdiction_code)) between 2 and 80),
  tax_code text not null check (length(trim(tax_code)) between 1 and 80),
  rate_basis_points integer not null check (rate_basis_points between 0 and 10000),
  price_includes_tax boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT','REVIEWED','RETIRED')),
  provenance_kind text not null
    check (provenance_kind in ('ACCOUNTANT_GUIDANCE','TAX_AUTHORITY','ACCOUNTING_SYSTEM','OTHER')),
  provenance_reference text not null check (length(trim(provenance_reference)) between 3 and 240),
  effective_from date not null,
  effective_to date,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_attestation text,
  version bigint not null default 1 check (version > 0),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, jurisdiction_code, tax_code, effective_from),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (status = 'DRAFT' and reviewed_by_user_id is null and reviewed_at is null and review_attestation is null)
    or
    (status = 'REVIEWED' and reviewed_by_user_id is not null and reviewed_at is not null
      and review_attestation is not null and length(trim(review_attestation)) between 3 and 240)
    or
    status = 'RETIRED'
  )
);

create index if not exists workspace_tax_profiles_status_idx
  on public.workspace_tax_profiles(workspace_id, status, effective_from desc);

create unique index if not exists workspace_tax_profiles_one_reviewed_key_uq
  on public.workspace_tax_profiles(workspace_id, jurisdiction_code, tax_code)
  where status = 'REVIEWED';

alter table public.workspace_tax_profiles enable row level security;

create policy workspace_tax_profiles_staff_select on public.workspace_tax_profiles
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.workspace_tax_profiles from anon, authenticated;
grant select on table public.workspace_tax_profiles to authenticated;
grant all on table public.workspace_tax_profiles to service_role;

comment on table public.workspace_tax_profiles is
  'Reference-only workspace tax configuration with explicit provenance and recorded review. Profiles are never auto-applied by this migration.';
