alter table public.user_preferences
  drop constraint if exists user_preferences_library_sort_check;

alter table public.user_preferences
  add constraint user_preferences_library_sort_check
  check (library_sort in ('recent', 'title', 'rating', 'release_date', 'finished_at', 'custom'));
