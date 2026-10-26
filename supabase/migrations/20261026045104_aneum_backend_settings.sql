begin;
create table public.aneum_backend_settings (
    key text primary key check (key = 'admin_token_hash'),
    value text not null check (value ~ '^[a-f0-9]{64}$')
);
alter table public.aneum_backend_settings enable row level security;
revoke all on public.aneum_backend_settings from public, anon, authenticated;
grant select on public.aneum_backend_settings to service_role;
commit;
