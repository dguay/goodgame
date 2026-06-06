alter table user_preferences
  add constraint user_preferences_library_view_check
  check (library_view in ('grid', 'list', 'minimalist'));
