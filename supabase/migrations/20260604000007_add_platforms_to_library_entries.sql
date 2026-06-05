alter table library_entries
  add column platforms text[] not null default '{}';
