create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  library_sort text not null default 'recent'
    check (library_sort in ('recent', 'title', 'rating', 'playtime', 'custom')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_preferences enable row level security;

create policy "Users can manage own preferences" on public.user_preferences
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.user_preferences
  for each row execute function update_updated_at();
