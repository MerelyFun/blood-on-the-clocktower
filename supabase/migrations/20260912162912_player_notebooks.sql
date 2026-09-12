-- Private notebook documents. No notebook payload enters room projections or Realtime.
create table public.bt_notebooks (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 room_id uuid references public.bt_rooms(id) on delete set null,
 data jsonb not null check(jsonb_typeof(data)='object' and data->'schemaVersion'='1'::jsonb and octet_length(data::text)<=1000000),
 revision bigint not null check(revision>0), updated_at timestamptz not null default now()
);
create index bt_notebooks_owner on public.bt_notebooks(owner_id,updated_at desc);
create unique index bt_notebooks_room_owner on public.bt_notebooks(owner_id,room_id) where room_id is not null;
alter table public.bt_notebooks enable row level security;
create policy notebooks_read on public.bt_notebooks for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.bt_notebooks from public,anon,authenticated;
grant select on public.bt_notebooks to authenticated;
grant all on public.bt_notebooks to service_role;

-- The private definer is necessary to keep writes behind CAS rather than expose direct table writes.
-- Identity always comes from the verified JWT, never a client-supplied owner argument.
create function bt_private.notebook_operation(p_operation text,p_id uuid default null,p_room_id uuid default null,p_data jsonb default null,p_expected_revision bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); doc public.bt_notebooks; result jsonb;
begin
 if actor is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_operation='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'roomId',room_id,'data',data,'revision',revision,'updatedAt',updated_at) order by updated_at desc),'[]'::jsonb) into result from public.bt_notebooks where owner_id=actor;
  return jsonb_build_object('notebooks',result);
 end if;
 if p_id is null then raise exception 'INVALID_COMMAND'; end if;
 -- Serialize even first writes and room-unique creation by owner.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select * into doc from public.bt_notebooks where id=p_id and owner_id=actor for update;
 if p_operation='get' then
  return jsonb_build_object('notebook',case when doc.id is null then null else jsonb_build_object('id',doc.id,'roomId',doc.room_id,'data',doc.data,'revision',doc.revision,'updatedAt',doc.updated_at) end);
 end if;
 if p_operation not in ('save','delete') or p_expected_revision is null or p_expected_revision<0 then raise exception 'INVALID_COMMAND'; end if;
 if coalesce(doc.revision,0)<>p_expected_revision then raise exception 'VERSION_CONFLICT'; end if;
 if p_operation='delete' then
  delete from public.bt_notebooks where id=p_id and owner_id=actor;
  return jsonb_build_object('ok',true);
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or (p_data->'schemaVersion') is distinct from '1'::jsonb or octet_length(p_data::text)>1000000 then raise exception 'INVALID_COMMAND'; end if;
 if doc.id is not null and doc.room_id is distinct from p_room_id then raise exception 'INVALID_COMMAND'; end if;
 if p_room_id is not null then
  perform 1 from public.bt_rooms where id=p_room_id for update;
  if not exists(select 1 from public.bt_members where room_id=p_room_id and user_id=actor and status='active') then raise exception 'FORBIDDEN'; end if;
 end if;
 if doc.id is null and exists(select 1 from public.bt_notebooks where id=p_id) then raise exception 'FORBIDDEN'; end if;
 if p_room_id is not null and exists(select 1 from public.bt_notebooks where owner_id=actor and room_id=p_room_id and id<>p_id) then raise exception 'VERSION_CONFLICT'; end if;
 insert into public.bt_notebooks(id,owner_id,room_id,data,revision) values(p_id,actor,p_room_id,p_data,coalesce(doc.revision,0)+1)
 on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now() returning * into doc;
 return jsonb_build_object('notebook',jsonb_build_object('id',doc.id,'roomId',doc.room_id,'data',doc.data,'revision',doc.revision,'updatedAt',doc.updated_at));
end;$$;
revoke all on function bt_private.notebook_operation(text,uuid,uuid,jsonb,bigint) from public,anon;
grant execute on function bt_private.notebook_operation(text,uuid,uuid,jsonb,bigint) to authenticated;
create function public.notebook_operation(p_operation text,p_id uuid default null,p_room_id uuid default null,p_data jsonb default null,p_expected_revision bigint default null) returns jsonb
language sql security invoker set search_path='' as $$
 select bt_private.notebook_operation(p_operation,p_id,p_room_id,p_data,p_expected_revision);
$$;
revoke all on function public.notebook_operation(text,uuid,uuid,jsonb,bigint) from public,anon;
grant execute on function public.notebook_operation(text,uuid,uuid,jsonb,bigint) to authenticated;
