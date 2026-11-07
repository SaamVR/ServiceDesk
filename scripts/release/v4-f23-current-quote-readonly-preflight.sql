-- F23 aggregate-only installed-schema readiness preflight.
-- READ ONLY. Contains NO INSERT/UPDATE/DELETE/DDL and returns NO user,
-- workspace, request, quote, payment, or provider identifiers/amounts.
-- Execute ONLY after DBA approval; this source-only file does not
-- authorize a staging/production query or database reactivation.
-- Use the actual installed schema as the authority, not local migration files.
\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
with
 existing_current as (
  select workspace_id,request_id,count(*)::bigint as sibling_count
  from public.quotes
  where status::text <> 'SUPERSEDED'
  group by workspace_id,request_id
 ),
 inventory as (
  select count(*)::integer as total_indexes,
   count(*) filter (
    where indexdef ilike '%CREATE UNIQUE INDEX%'
      and indexdef ilike '%SUPERSEDED%'
      and indexdef ilike '%WHERE %'
   )::integer as current_quote_unique_index_candidates
  from pg_catalog.pg_indexes
  where schemaname = 'public' and tablename = 'quotes'
 ),
 quote_counts as (
  select count(*)::bigint as all_quotes,
   count(*) filter (where status::text <> 'SUPERSEDED')::bigint as non_superseded,
   count(*) filter (where status::text = 'DRAFT')::bigint as draft,
   count(*) filter (where status::text = 'ACCEPTED')::bigint as accepted,
   count(*) filter (where status::text in ('DECLINED','EXPIRED'))::bigint as declined_or_expired
  from public.quotes
 )
select jsonb_build_object(
 'schema','servicedesk.f23.current-quote-readonly-preflight.v1',
 'mode','REPEATABLE_READ_READ_ONLY_AGGREGATES',
 'identifiersReturned',false,
 'totalQuoteRows',q.all_quotes,
 'nonSupersededQuoteRows',q.non_superseded,
 'draftQuoteRows',q.draft,
 'acceptedQuoteRows',q.accepted,
 'declinedOrExpiredRows',q.declined_or_expired,
 'requestGroupsWithTwoOrMoreNonSupersededQuotes',
  (select count(*)::bigint from existing_current where sibling_count>1),
 'largestNonSupersededSiblingCount',
  coalesce((select max(sibling_count) from existing_current),0),
 'existingQuoteIndexCount',i.total_indexes,
 'indexDefinitionCandidatesToReview',i.current_quote_unique_index_candidates,
 'liveUserJwtRlsVerified',false,
 'allQuoteWritersAudited',false,
 'safeToEnableF23',false,
 'dbaReviewRequired',true,
 'noProductionApprovalGranted',true
 ) as sanitized_current_quote_preflight
from quote_counts q cross join inventory i;
commit;
