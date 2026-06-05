alter table library_entries
  alter column platforms drop not null,
  alter column platforms set default null;

update library_entries
  set platforms = null
  where platforms = '{}';
