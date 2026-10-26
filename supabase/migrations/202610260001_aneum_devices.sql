-- Dedicated objects for Aneum only. No existing application tables are changed.
begin;

create table public.aneum_devices (
    id text primary key check (id ~ '^[a-f0-9]{24}$'),
    name text not null check (char_length(btrim(name)) between 1 and 40),
    platform text not null check (platform in ('android', 'ios')),
    token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
    created_at bigint not null check (created_at > 0),
    latest jsonb
);

alter table public.aneum_devices enable row level security;
revoke all on public.aneum_devices from public, anon, authenticated;
grant select, insert, update, delete on public.aneum_devices to service_role;

create function public.aneum_register_device(p_device jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
    -- Serialize concurrent registrations so the 20-device limit is enforced.
    perform pg_catalog.pg_advisory_xact_lock(20261026, 7101);
    if (select count(*) from public.aneum_devices) >= 20 then return false; end if;
    insert into public.aneum_devices(id, name, platform, token_hash, created_at, latest)
    values (p_device->>'id', p_device->>'name', p_device->>'platform',
            p_device->>'tokenHash', (p_device->>'createdAt')::bigint, null)
    on conflict do nothing;
    return found;
end;
$$;

create function public.aneum_report_activity(p_id text, p_token_hash text, p_sample jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare current_device public.aneum_devices%rowtype;
begin
    select * into current_device from public.aneum_devices where id = p_id for update;
    if not found or current_device.token_hash <> p_token_hash then return -1; end if;
    if current_device.latest is not null
       and (p_sample->>'windowEnd')::bigint < (current_device.latest->>'windowEnd')::bigint
    then return 0; end if;
    update public.aneum_devices set latest = p_sample where id = p_id;
    return 1;
end;
$$;

revoke all on function public.aneum_register_device(jsonb) from public, anon, authenticated;
revoke all on function public.aneum_report_activity(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.aneum_register_device(jsonb) to service_role;
grant execute on function public.aneum_report_activity(text, text, jsonb) to service_role;

commit;
