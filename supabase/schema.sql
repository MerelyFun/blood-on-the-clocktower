-- Blood on the Clocktower companion: execute once in a dedicated Supabase project.
-- Mutating RPCs are service_role-only. Edge Function verifies the real Auth user.
begin;
create schema if not exists bt_private;
revoke all on schema bt_private from public, anon;
grant usage on schema bt_private to authenticated, service_role;

create table public.bt_rooms (
 id uuid primary key, code text not null unique, title text not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 locked boolean not null default false, created_at timestamptz not null default now()
);
create index bt_rooms_owner on public.bt_rooms(owner_id);
create table public.bt_members (
 room_id uuid not null references public.bt_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(length(nickname)<=40),
 role text not null check(role in ('host','player')),
 status text not null check(status in ('pending','active','revoked')),
 seat_id uuid, created_at timestamptz not null default now(), primary key(room_id,user_id)
);
create index bt_members_user on public.bt_members(user_id,status);
create unique index bt_members_seat on public.bt_members(room_id,seat_id) where status='active' and seat_id is not null;
create table public.bt_games (room_id uuid primary key references public.bt_rooms(id) on delete cascade, version bigint not null default 0, state jsonb not null);
create table public.bt_public (room_id uuid primary key references public.bt_rooms(id) on delete cascade, data jsonb not null);
create table public.bt_player_views (room_id uuid not null references public.bt_rooms(id) on delete cascade, seat_id uuid not null, data jsonb not null, primary key(room_id,seat_id));
create table public.bt_signals (room_id uuid not null references public.bt_rooms(id) on delete cascade, audience text not null, nonce uuid not null default gen_random_uuid(), primary key(room_id,audience));
create table public.bt_commands (room_id uuid not null references public.bt_rooms(id) on delete cascade, op_id uuid not null, actor_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key(room_id,op_id));
create table public.bt_scripts (id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, data jsonb not null check(octet_length(data::text)<=2000000), updated_at timestamptz not null default now());
create index bt_scripts_owner on public.bt_scripts(owner_id);
create table public.bt_notes (room_id uuid not null references public.bt_rooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, body text not null default '' check(length(body)<=20000), updated_at timestamptz not null default now(), primary key(room_id,user_id));
create table bt_private.join_limits (user_id uuid primary key references auth.users(id) on delete cascade, started_at timestamptz not null default now(), attempts integer not null default 1);

-- Definer helpers prevent recursive member policies. The private schema is not exposed by the Data API.
create function bt_private.is_host(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bt_rooms where id=r and owner_id=(select auth.uid()));
$$;
create function bt_private.is_active(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bt_members where room_id=r and user_id=(select auth.uid()) and status='active');
$$;
create function bt_private.owns_seat(r uuid,s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bt_members where room_id=r and user_id=(select auth.uid()) and status='active' and seat_id=s);
$$;
revoke all on function bt_private.is_host(uuid),bt_private.is_active(uuid),bt_private.owns_seat(uuid,uuid) from public,anon;
grant execute on function bt_private.is_host(uuid),bt_private.is_active(uuid),bt_private.owns_seat(uuid,uuid) to authenticated,service_role;

alter table public.bt_rooms enable row level security;
alter table public.bt_members enable row level security;
alter table public.bt_games enable row level security;
alter table public.bt_public enable row level security;
alter table public.bt_player_views enable row level security;
alter table public.bt_signals enable row level security;
alter table public.bt_commands enable row level security;
alter table public.bt_scripts enable row level security;
alter table public.bt_notes enable row level security;
alter table bt_private.join_limits enable row level security;
create policy rooms_read on public.bt_rooms for select to authenticated using (bt_private.is_active(id));
create policy members_read on public.bt_members for select to authenticated using(user_id=(select auth.uid()) or bt_private.is_host(room_id));
create policy games_host on public.bt_games for select to authenticated using(bt_private.is_host(room_id));
create policy town_read on public.bt_public for select to authenticated using(bt_private.is_active(room_id));
create policy cards_read on public.bt_player_views for select to authenticated using(bt_private.is_host(room_id) or bt_private.owns_seat(room_id,seat_id));
create policy signals_read on public.bt_signals for select to authenticated using(
 (audience='public' and bt_private.is_active(room_id)) or (audience='host' and bt_private.is_host(room_id)) or
 (audience not in ('public','host') and exists(select 1 from public.bt_members m where m.room_id=bt_signals.room_id and m.user_id=(select auth.uid()) and m.status='active' and m.seat_id::text=bt_signals.audience))
);
create policy scripts_read on public.bt_scripts for select to authenticated using(owner_id=(select auth.uid()));
create policy scripts_insert on public.bt_scripts for insert to authenticated with check(owner_id=(select auth.uid()));
create policy scripts_update on public.bt_scripts for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy scripts_delete on public.bt_scripts for delete to authenticated using(owner_id=(select auth.uid()));
create policy notes_read on public.bt_notes for select to authenticated using(user_id=(select auth.uid()) and bt_private.is_active(room_id));
create policy notes_insert on public.bt_notes for insert to authenticated with check(user_id=(select auth.uid()) and bt_private.is_active(room_id));
create policy notes_update on public.bt_notes for update to authenticated using(user_id=(select auth.uid()) and bt_private.is_active(room_id)) with check(user_id=(select auth.uid()) and bt_private.is_active(room_id));
create policy notes_delete on public.bt_notes for delete to authenticated using(user_id=(select auth.uid()) and bt_private.is_active(room_id));

-- Explicit grants: new Supabase projects do not auto-expose new tables.
revoke all on public.bt_rooms,public.bt_members,public.bt_games,public.bt_public,public.bt_player_views,public.bt_signals,public.bt_commands,public.bt_scripts,public.bt_notes from public,anon,authenticated;
grant select on public.bt_rooms,public.bt_members,public.bt_games,public.bt_public,public.bt_player_views,public.bt_signals to authenticated;
grant select,insert,update,delete on public.bt_scripts,public.bt_notes to authenticated;
grant all on public.bt_rooms,public.bt_members,public.bt_games,public.bt_public,public.bt_player_views,public.bt_signals,public.bt_commands,public.bt_scripts,public.bt_notes,bt_private.join_limits to service_role;

create function bt_private.write_projections(r uuid, pub jsonb, views jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; changed boolean;
begin
 insert into public.bt_public(room_id,data) values(r,pub) on conflict(room_id) do update set data=excluded.data where bt_public.data is distinct from excluded.data;
 changed:=found;
 if changed then insert into public.bt_signals(room_id,audience) values(r,'public') on conflict(room_id,audience) do update set nonce=gen_random_uuid(); end if;
 for item in select * from jsonb_array_elements(views) loop
  insert into public.bt_player_views(room_id,seat_id,data) values(r,(item->>'seat_id')::uuid,item->'data') on conflict(room_id,seat_id) do update set data=excluded.data where bt_player_views.data is distinct from excluded.data;
  changed:=found;
  if changed then insert into public.bt_signals(room_id,audience) values(r,item->>'seat_id') on conflict(room_id,audience) do update set nonce=gen_random_uuid(); end if;
 end loop;
 delete from public.bt_player_views where room_id=r and seat_id not in (select (v->>'seat_id')::uuid from jsonb_array_elements(views) v);
 insert into public.bt_signals(room_id,audience) values(r,'host') on conflict(room_id,audience) do update set nonce=gen_random_uuid();
end;$$;
revoke all on function bt_private.write_projections(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function bt_private.write_projections(uuid,jsonb,jsonb) to service_role;

create function public.bt_create_room(p_room uuid,p_code text,p_actor uuid,p_state jsonb,p_public jsonb,p_views jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.bt_rooms where id=p_room and owner_id=p_actor) then return p_room; end if;
 if (select count(*) from public.bt_rooms where owner_id=p_actor)>=30 then raise exception 'ROOM_LIMIT'; end if;
 insert into public.bt_rooms(id,code,title,owner_id,locked) values(p_room,p_code,left(p_state->>'title',100),p_actor,coalesce((p_state->>'locked')::boolean,false));
 insert into public.bt_members(room_id,user_id,nickname,role,status) values(p_room,p_actor,'说书人','host','active');
 insert into public.bt_games(room_id,version,state) values(p_room,0,p_state);
 perform bt_private.write_projections(p_room,p_public,p_views);
 return p_room;
end;$$;

create function public.bt_commit_room(p_room uuid,p_actor uuid,p_op uuid,p_expected bigint,p_seat uuid,p_state jsonb,p_public jsonb,p_views jsonb) returns text language plpgsql security invoker set search_path='' as $$
declare current_version bigint;
begin
 -- Serializes commands and membership changes in the same room.
 perform 1 from public.bt_rooms where id=p_room for update;
 if not exists(select 1 from public.bt_members where room_id=p_room and user_id=p_actor and status='active' and ((role='host' and p_seat is null) or (role='player' and seat_id=p_seat))) then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.bt_commands where room_id=p_room and op_id=p_op and actor_id=p_actor) then return 'duplicate'; end if;
 select version into current_version from public.bt_games where room_id=p_room for update;
 if current_version is distinct from p_expected then raise exception 'VERSION_CONFLICT'; end if;
 if (p_state->>'version')::bigint<>p_expected+1 or p_state->>'id'<>p_room::text then raise exception 'INVALID_STATE'; end if;
 -- Do not remove/reindex an occupied seat without explicitly revoking its member first.
 if exists(select 1 from public.bt_members m where m.room_id=p_room and m.status='active' and m.seat_id is not null and not exists(select 1 from jsonb_array_elements(p_state->'seats') s where s->>'id'=m.seat_id::text)) then raise exception 'OCCUPIED_SEAT'; end if;
 insert into public.bt_commands(room_id,op_id,actor_id) values(p_room,p_op,p_actor);
 update public.bt_games set version=p_expected+1,state=p_state where room_id=p_room;
 update public.bt_rooms set title=left(p_state->>'title',100),locked=(p_state->>'locked')::boolean where id=p_room;
 perform bt_private.write_projections(p_room,p_public,p_views);
 return 'committed';
end;$$;

create function public.bt_join_room(p_code text,p_actor uuid,p_nickname text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.bt_rooms; tries integer; m public.bt_members;
begin
 insert into bt_private.join_limits(user_id) values(p_actor) on conflict(user_id) do update set attempts=case when join_limits.started_at<now()-interval '1 minute' then 1 else join_limits.attempts+1 end, started_at=case when join_limits.started_at<now()-interval '1 minute' then now() else join_limits.started_at end returning attempts into tries;
 if tries>8 then return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
 select * into r from public.bt_rooms where code=upper(p_code) for update;
 if not found then return jsonb_build_object('error','ROOM_UNAVAILABLE'); end if;
 select * into m from public.bt_members where room_id=r.id and user_id=p_actor;
 if found then
  if m.status='revoked' then return jsonb_build_object('error','REVOKED'); end if;
  return jsonb_build_object('room_id',r.id);
 end if;
 if r.locked then return jsonb_build_object('error','ROOM_LOCKED'); end if;
 if (select count(*) from public.bt_members where room_id=r.id and status='pending')>=40 or (select count(*) from public.bt_members where user_id=p_actor and status='pending')>=5 then return jsonb_build_object('error','JOIN_LIMIT'); end if;
 insert into public.bt_members(room_id,user_id,nickname,role,status) values(r.id,p_actor,left(p_nickname,40),'player','pending');
 insert into public.bt_signals(room_id,audience) values(r.id,'host') on conflict(room_id,audience) do update set nonce=gen_random_uuid();
 return jsonb_build_object('room_id',r.id);
end;$$;

create function public.bt_member_action(p_room uuid,p_actor uuid,p_target uuid,p_seat uuid,p_action text,p_rebind boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare owner uuid;
begin
 select owner_id into owner from public.bt_rooms where id=p_room for update;
 if owner is distinct from p_actor or p_target=owner then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from public.bt_members where room_id=p_room and user_id=p_target and role='player') then raise exception 'MEMBER_NOT_FOUND'; end if;
 if p_action='approve' then
  if not exists(select 1 from public.bt_games g,jsonb_array_elements(g.state->'seats') s where g.room_id=p_room and s->>'id'=p_seat::text and (s->>'left')::boolean=false) then raise exception 'INVALID_SEAT'; end if;
  if p_rebind then update public.bt_members set status='revoked',seat_id=null where room_id=p_room and seat_id=p_seat and user_id<>p_target and role='player'; end if;
  update public.bt_members set status='active',seat_id=p_seat where room_id=p_room and user_id=p_target;
 elsif p_action='revoke' then update public.bt_members set status='revoked',seat_id=null where room_id=p_room and user_id=p_target;
 else raise exception 'INVALID_ACTION'; end if;
 insert into public.bt_signals(room_id,audience) values(p_room,'host') on conflict(room_id,audience) do update set nonce=gen_random_uuid();
 -- No private payload is ever broadcast. Clients poll membership as well as listening for signals.
end;$$;

revoke all on function public.bt_create_room(uuid,text,uuid,jsonb,jsonb,jsonb),public.bt_commit_room(uuid,uuid,uuid,bigint,uuid,jsonb,jsonb,jsonb),public.bt_join_room(text,uuid,text),public.bt_member_action(uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.bt_create_room(uuid,text,uuid,jsonb,jsonb,jsonb),public.bt_commit_room(uuid,uuid,uuid,bigint,uuid,jsonb,jsonb,jsonb),public.bt_join_room(text,uuid,text),public.bt_member_action(uuid,uuid,uuid,uuid,text,boolean) to service_role;

-- Only small, audience-filtered invalidations enter Realtime.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bt_signals') then
  alter publication supabase_realtime add table public.bt_signals;
 end if;
end $$;
commit;
