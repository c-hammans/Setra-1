begin;

create table public.activity_import_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  source_channel text not null check (source_channel in ('user_file','connector')),
  provider text not null,
  external_activity_id text not null,
  fingerprint text,
  format text check (format in ('fit','tcx','gpx')),
  sync_status text not null check (sync_status in ('imported','reconciled','restricted')),
  usage_permissions jsonb not null default '{}',
  recorded_result jsonb not null check (jsonb_typeof(recorded_result)='object'),
  imported_at timestamptz not null default now(),
  -- Unreviewed connector records may not participate in canonical/derived reads.
  check (source_channel='user_file' or (session_id is null and sync_status='restricted')),
  check (session_id is null or (provider='activity_file' and usage_permissions @> '{"ai":true,"coach":true,"social":true,"shareExport":true,"analytics":true}'::jsonb)),
  foreign key(session_id,user_id) references public.training_sessions(id,user_id) on delete set null (session_id),
  unique(user_id,provider,external_activity_id),
  unique(user_id,fingerprint)
);
create index activity_import_receipts_recent on public.activity_import_receipts(user_id,imported_at desc);
create index activity_import_receipts_session on public.activity_import_receipts(session_id);
alter table public.activity_import_receipts enable row level security;
revoke all on public.activity_import_receipts from public,anon,authenticated;
grant select on public.activity_import_receipts to authenticated;
grant all on public.activity_import_receipts to service_role;
create policy activity_import_receipts_owner on public.activity_import_receipts
  for select to authenticated using ((select auth.uid())=user_id and source_channel='user_file');

-- Share the canonical versioned save and lifecycle logic. Only a verified,
-- account-bound server preview may call this function.
create function public.import_reviewed_activity(
  p_user uuid,p_fingerprint text,p_external_id text,p_result jsonb,p_payload jsonb,
  p_plan uuid,p_manual uuid,p_allow_separate boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt public.activity_import_receipts; planned public.training_sessions; existing public.training_sessions;
  imported_session_id uuid; when_local date; raw_start timestamptz; chosen_sport text; plan_key text; activity_client text;
begin
  if p_fingerprint !~ '^[0-9a-f]{64}$' or p_external_id !~ '^start:[0-9]{1,13}$'
     or p_result->>'format' not in ('fit','tcx','gpx') or jsonb_typeof(p_result->'laps')<>'array'
     or jsonb_array_length(p_result->'laps')>500 or p_plan is not null and p_manual is not null then
    raise exception 'Invalid import preview' using errcode='P0400';
  end if;
  raw_start:=(p_result->>'start')::timestamptz;
  when_local:=(p_payload->>'date')::date;
  chosen_sport:=p_payload->>'activityType';
  if chosen_sport not in ('run','bike','swim','row','walk_hike','elliptical','cross_training','custom')
     or when_local<'1989-12-31'::date or when_local>current_date+1
     or abs(when_local-(raw_start at time zone 'UTC')::date)>1 or raw_start>now()+interval '5 minutes' then
    raise exception 'Invalid activity date or sport' using errcode='P0400';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('activity-import:'||p_user,0));
  select * into receipt from public.activity_import_receipts where user_id=p_user
    and (fingerprint=p_fingerprint or provider='activity_file' and external_activity_id=p_external_id) limit 1;
  if found then return jsonb_build_object('status','duplicate','id',receipt.id);end if;

  if p_manual is not null then
    select * into existing from public.training_sessions where id=p_manual and user_id=p_user and status='completed' and modality='endurance'
      and activity_type=chosen_sport and session_date between when_local-1 and when_local+1 for update;
    if not found then raise exception 'The completed activity is no longer available for reconciliation' using errcode='P0409';end if;
    select * into receipt from public.activity_import_receipts where user_id=p_user and session_id=existing.id limit 1;
    if found then return jsonb_build_object('status','duplicate','id',receipt.id);end if;
    imported_session_id:=existing.id;
  else
    if p_plan is not null then
      select * into planned from public.training_sessions where id=p_plan and user_id=p_user and status='planned' and modality='endurance'
        and not skipped and activity_type=chosen_sport and session_date between when_local-1 and when_local+1 for update;
      if not found then raise exception 'The planned session is no longer available' using errcode='P0409';end if;
      if exists(select 1 from public.training_sessions s where s.user_id=p_user and s.planned_session_id=planned.id and s.status in ('completed','in_progress'))
        or exists(select 1 from public.training_plan_occurrences o where o.user_id=p_user and o.occurrence_key='endurance:'||planned.client_id and o.status<>'planned')
      then raise exception 'That session was already logged or started. Refresh and reconcile with the existing result.' using errcode='P0409';end if;
      plan_key:=planned.client_id;
    end if;
    if not coalesce(p_allow_separate,false) and exists(select 1 from public.training_sessions s where s.user_id=p_user
      and s.modality='endurance' and s.status='completed' and s.activity_type=chosen_sport and s.session_date between when_local-1 and when_local+1
      and ((s.started_at is not null and abs(extract(epoch from s.started_at-raw_start))<=600)
      or (s.session_date=when_local and s.duration_seconds>0 and (p_payload->>'durationSeconds')::numeric>0
       and abs(s.duration_seconds-(p_payload->>'durationSeconds')::numeric)<=0.17*greatest(s.duration_seconds,(p_payload->>'durationSeconds')::numeric)
       and s.distance_metres>0 and (p_payload->>'distanceMetres')::numeric>0
       and abs(s.distance_metres-(p_payload->>'distanceMetres')::numeric)<=0.12*greatest(s.distance_metres,(p_payload->>'distanceMetres')::numeric))))
    then raise exception 'A similar activity is already logged. Refresh and review it before importing.' using errcode='P0409';end if;
    activity_client:='activity-file-'||p_fingerprint;
    perform set_config('request.jwt.claim.sub',p_user::text,true);
    if auth.uid() is distinct from p_user then raise exception 'Could not verify the activity owner';end if;
    perform public.save_endurance_session_v2(p_payload||jsonb_strip_nulls(jsonb_build_object('id',activity_client,
      'status','completed','source','activity_file','externalProvider','activity_file','externalActivityId',p_external_id,
      'plannedSessionId',plan_key,'blocks','[]'::jsonb,'completedAt',coalesce(p_result->>'finish',p_result->>'start'))),
      activity_client,0);
    select id into imported_session_id from public.training_sessions where user_id=p_user and client_id=activity_client;
  end if;
  insert into public.activity_import_receipts(user_id,session_id,source_channel,provider,external_activity_id,fingerprint,format,sync_status,usage_permissions,recorded_result)
    values(p_user,imported_session_id,'user_file','activity_file',p_external_id,p_fingerprint,p_result->>'format',
      case when p_manual is null then 'imported' else 'reconciled' end,
      '{"ai":true,"coach":true,"social":true,"shareExport":true,"analytics":true}',p_result)
    returning * into receipt;
  return jsonb_build_object('status',receipt.sync_status,'id',receipt.id);
end;
$$;

-- Serialize a linked manual completion and a linked file completion on the plan
-- row. Existing manual-only lifecycle behaviour remains unchanged.
create function public.guard_file_import_plan_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.planned_session_id is null or new.status<>'completed' then return new;end if;
  perform 1 from public.training_sessions where id=new.planned_session_id and user_id=new.user_id for update;
  if exists(select 1 from public.training_sessions s where s.user_id=new.user_id and s.planned_session_id=new.planned_session_id
    and s.id<>new.id and s.client_id is distinct from new.client_id and s.status='completed'
    and (s.source='activity_file' or new.source='activity_file'))
  then raise exception 'A completed activity is already linked to this planned session' using errcode='P0409';end if;
  return new;
end;
$$;
create trigger guard_file_import_plan_completion before insert or update of planned_session_id,status on public.training_sessions
  for each row execute function public.guard_file_import_plan_completion();

revoke all on function public.import_reviewed_activity(uuid,text,text,jsonb,jsonb,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.import_reviewed_activity(uuid,text,text,jsonb,jsonb,uuid,uuid,boolean) to service_role;
revoke all on function public.guard_file_import_plan_completion() from public,anon,authenticated;
commit;
