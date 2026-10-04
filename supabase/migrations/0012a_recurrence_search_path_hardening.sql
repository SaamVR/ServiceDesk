-- ServiceDesk AI V1 INT7 / E07: recurrence helper search_path hardening
-- Keep helper functions out of Supabase mutable-search-path advisor findings.

alter function public.servicedesk_recurrence_next_date(date, text, integer)
  set search_path = public, pg_temp;

alter function public.servicedesk_recurrence_local_start(date, time, text)
  set search_path = public, pg_temp;

alter function public.servicedesk_recurrence_is_complete(date, date, integer, integer)
  set search_path = public, pg_temp;

alter function public.servicedesk_recurrence_rule_json(public.recurrence_rules)
  set search_path = public, pg_temp;
