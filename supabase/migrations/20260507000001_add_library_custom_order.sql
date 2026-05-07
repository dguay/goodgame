alter table public.library_entries
add column custom_order integer;

alter table public.library_entries disable trigger set_updated_at;

with ranked_entries as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at desc, id asc
    ) as position
  from public.library_entries
)
update public.library_entries as entry
set custom_order = ranked_entries.position
from ranked_entries
where entry.id = ranked_entries.id;

alter table public.library_entries enable trigger set_updated_at;

create index library_entries_user_id_custom_order_idx
on public.library_entries (user_id, custom_order);
