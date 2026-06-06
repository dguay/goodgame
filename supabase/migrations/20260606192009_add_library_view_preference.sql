alter table user_preferences
  add column if not exists library_view text not null default 'grid';
