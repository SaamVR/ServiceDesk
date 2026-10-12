-- Bind all seven triggers to the historical shared function, just like 0053.
create trigger properties_branch_guard
before insert or update of workspace_id,branch_id on public.properties
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
create trigger requests_branch_guard
before insert or update of workspace_id,branch_id,property_id on public.requests
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
create trigger conversations_branch_guard
before insert or update of workspace_id,branch_id,request_id on public.conversations
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
create trigger crews_branch_guard
before insert or update of workspace_id,branch_id on public.crews
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
create trigger capacity_slots_branch_guard
before insert or update of workspace_id,branch_id,crew_id on public.capacity_slots
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
create trigger visits_branch_guard
before insert or update of workspace_id,branch_id,request_id,crew_id,slot_id on public.visits
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
create trigger recurrence_rules_branch_guard
before insert or update of workspace_id,branch_id,request_id,property_id on public.recurrence_rules
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();
