-- ServiceDesk AI V1 INT8 follow-up: keep workspace_id stable when a linked quality attention row is deleted.
-- Postgres supports column-scoped SET NULL for composite FKs; only attention_item_id should null out.

alter table public.quality_cases
  drop constraint if exists quality_cases_workspace_id_attention_item_id_fkey;

alter table public.quality_cases
  drop constraint if exists quality_cases_workspace_attention_item_fk;

alter table public.quality_cases
  add constraint quality_cases_workspace_attention_item_fk
  foreign key (workspace_id, attention_item_id)
  references public.attention_items(workspace_id, id)
  on delete set null (attention_item_id);
