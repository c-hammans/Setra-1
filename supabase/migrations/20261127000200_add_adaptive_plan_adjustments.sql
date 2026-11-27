begin;

alter table public.training_plan_occurrences add column if not exists adaptive_strength_prescription jsonb;

create table public.adaptive_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source_kind text not null check (source_kind in ('recommendation','ask','review')),
  source_id uuid not null,
  source_hash text not null,
  status text not null check (status in ('generating','proposed','applied','declined','expired','reverted')),
  reason text not null,
  evidence jsonb not null,
  options jsonb not null default '[]',
  accepted jsonb not null default '[]',
  outcomes jsonb not null default '[]',
  usage jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  reverted_at timestamptz,
  unique(user_id,source_kind,source_id,source_hash)
);
create index adaptive_plan_proposals_user_idx on public.adaptive_plan_proposals(user_id,created_at desc);
alter table public.adaptive_plan_proposals enable row level security;
revoke all on public.adaptive_plan_proposals from public,anon,authenticated;
grant all on public.adaptive_plan_proposals to service_role;

-- All RPCs below are private server RPCs. Never accept a user ID from a request body.
create function public.adaptive_plan_today(p_user uuid) returns date
language sql stable set search_path='' as $$
  select (now() at time zone coalesce((select name from pg_timezone_names where name=p.timezone),'UTC'))::date
  from public.profiles p where p.id=p_user and coalesce(p.individual_plan,p.subscription_tier)='adaptive';
$$;

create function public.adaptive_plan_snapshot(p_user uuid,p_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare o public.training_plan_occurrences; s public.training_sessions; t public.workout_templates;
  fields jsonb; payload jsonb; patch jsonb; blocked boolean; stamp text; v bigint;
begin
  select * into o from public.training_plan_occurrences where id=p_id and user_id=p_user;
  if not found then return null; end if;
  blocked:=exists(select 1 from public.coach_training_assignments a where a.client_user_id=p_user and a.occurrence_key=o.occurrence_key);
  if o.modality='strength' then
    select template.* into t from public.scheduled_workouts w join public.workout_templates template on template.id=w.template_id
      where w.user_id=p_user and w.scheduled_date=o.planned_date and template.client_id=o.source_client_id and not w.skipped;
    if not found then return null;end if;
    blocked:=blocked or t.coach_assignment_id is not null or exists(select 1 from public.scheduled_workouts w
      where w.user_id=p_user and w.template_id=t.id and w.scheduled_date=o.planned_date and w.coach_assignment_id is not null)
      or exists(select 1 from public.workouts w
      where w.user_id=p_user and w.template_id=t.id and w.workout_date=o.planned_date);
    payload:=o.adaptive_strength_prescription;
    patch:=case when payload->>'templateVersion'=floor(extract(epoch from t.updated_at)*1000)::bigint::text then payload->'values' else '{}'::jsonb end;
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key','exercise:'||e.idx||':'||f.key,
      'label',x.name||' · '||f.label,'value',coalesce(patch->('exercise:'||e.idx||':'||f.key),f.value),'unit',f.unit)) order by e.idx,f.key),'[]') into fields
    from (select item.*,row_number() over(order by item.position)-1 idx from public.template_exercises item where item.template_id=t.id) e
    join public.exercises x on x.id=e.exercise_id
    cross join lateral (values ('sets','sets',to_jsonb(e.planned_sets),null::text),
      ('reps','reps',case when e.rep_target ~ '^[1-9][0-9]?$' then to_jsonb(e.rep_target::integer) end,null),
      ('load','load',case when e.planned_load_mode='kg' and e.planned_load_value>0 then to_jsonb(e.planned_load_value) end,'kg')) f(key,label,value,unit)
    where f.value is not null;
    stamp:=md5(jsonb_build_array(o.occurrence_key,o.status,o.updated_at,t.updated_at,fields,payload)::text);
    return jsonb_build_object('id',o.id,'modality',o.modality,'date',o.planned_date,'title',t.name,'stamp',stamp,'fields',fields,
      'state',o.status,'blocked',blocked,'payload',payload,'templateVersion',floor(extract(epoch from t.updated_at)*1000)::bigint::text,'coach',t.coach_assignment_id is not null or blocked and exists(select 1 from public.coach_training_assignments a where a.client_user_id=p_user and a.occurrence_key=o.occurrence_key));
  end if;
  select * into s from public.training_sessions where user_id=p_user and client_id=o.source_client_id and modality='endurance';
  if not found then return null;end if;
  blocked:=blocked or s.coach_assignment_id is not null or s.skipped or s.started_at is not null or s.completed_at is not null
    or coalesce(s.planned_duration_minutes<>trunc(s.planned_duration_minutes),false)
    or s.status not in ('planned','cancelled') or s.external_provider is not null or s.external_activity_id is not null or o.linked_completion_client_id is not null
    or exists(select 1 from public.training_sessions x where x.planned_session_id=s.id);
  select jsonb_strip_nulls(jsonb_build_object('id',s.client_id,'title',s.title,'status',s.status,'date',s.session_date,
    'activityType',s.activity_type,'plannedStartTime',s.planned_start_time,'plannedDurationMinutes',s.planned_duration_minutes::integer,
    'plannedDistanceMetres',s.planned_distance_metres,'targetRpe',s.target_rpe,'environment',s.environment,'category',s.training_category,
    'notes',s.notes,'source',s.source,'templateId',(select client_id from public.endurance_templates where id=s.endurance_template_id and user_id=p_user),
    'blocks',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',b.client_id,'parentId',b.parent_client_id,'type',b.block_type,'title',b.title,'instructions',b.instructions,
      'repetitions',b.repetitions,'durationSeconds',b.planned_duration_seconds,'distanceMetres',b.planned_distance_metres,
      'recoveryDurationSeconds',b.recovery_duration_seconds,'recoveryDistanceMetres',b.recovery_distance_metres,'intensityTarget',b.intensity_target,
      'completionType',b.completion_type,'targetMetric',b.target_metric,'targetMinValue',b.target_min_value,'targetMaxValue',b.target_max_value,
      'targetUnit',b.target_unit,'stroke',b.stroke,'providerMetadata',b.provider_metadata)) order by b.position)
      from public.training_session_blocks b where b.session_id=s.id),'[]'))) into payload;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key',f.key,'label',f.label,'value',f.value,'unit',f.unit))),'[]') into fields
    from (values ('plannedDurationMinutes','Duration',to_jsonb(s.planned_duration_minutes),'min'),
      ('plannedDistanceMetres','Distance',to_jsonb(s.planned_distance_metres),'m'),('targetRpe','Target effort',to_jsonb(s.target_rpe),'/10')) f(key,label,value,unit)
    where f.value is not null;
  fields:=fields||coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key','block:'||idx||':'||f.key,
    'label',coalesce(nullif(b->>'title',''),'Step '||(idx+1))||' · '||f.label,'value',f.value,'unit',f.unit)) order by idx,f.key)
    from jsonb_array_elements(payload->'blocks') with ordinality item(b,n)
    cross join lateral (select (n-1) idx) z
    cross join lateral (values ('repetitions','repeats',case when b->>'type' not in ('warmup','cooldown') then b->'repetitions' end,null::text),
      ('durationSeconds','duration',case when b->>'completionType'='time' then b->'durationSeconds' end,'sec'),
      ('distanceMetres','distance',case when b->>'completionType'='distance' then b->'distanceMetres' end,'m'),
      ('targetMinValue','fastest pace',case when b->>'targetMetric'='pace' then b->'targetMinValue' end,b->>'targetUnit'),
      ('targetMaxValue','slowest pace',case when b->>'targetMetric'='pace' then b->'targetMaxValue' end,b->>'targetUnit')) f(key,label,value,unit)
    where f.value is not null),'[]');
  select server_version into v from public.client_write_heads where user_id=p_user and entity_key='endurance-session:'||s.client_id;
  stamp:=md5(jsonb_build_array(o.occurrence_key,o.status,payload,s.updated_at,coalesce(v,0))::text);
  return jsonb_build_object('id',o.id,'modality',o.modality,'date',s.session_date,'title',s.title,'activityType',s.activity_type,
    'stamp',stamp,'fields',fields,'state',o.status,'blocked',blocked,'simple',jsonb_array_length(payload->'blocks')=0,
    'coach',s.coach_assignment_id is not null or exists(select 1 from public.coach_training_assignments a where a.client_user_id=p_user and a.occurrence_key=o.occurrence_key),
    'payload',payload,'version',coalesce(v,0),'clientId',s.client_id);
end;
$$;

create function public.list_adaptive_plan_snapshots(p_user uuid) returns jsonb
language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(s order by s->>'date',s->>'id'),'[]') from (
    select public.adaptive_plan_snapshot(p_user,o.id)-'payload'-'version'-'templateVersion' as s
    from public.training_plan_occurrences o where o.user_id=p_user and o.status='planned'
      and o.planned_date between public.adaptive_plan_today(p_user)+1 and public.adaptive_plan_today(p_user)+28
    order by o.planned_date,o.id limit 24
  ) x where s is not null;
$$;

create function public.claim_adaptive_plan_proposal(p_user uuid,p_kind text,p_source uuid,p_hash text,p_reason text,p_evidence jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare r public.adaptive_plan_proposals;
begin
  if public.adaptive_plan_today(p_user) is null then raise exception 'Adaptive access is required';end if;
  perform pg_advisory_xact_lock(hashtextextended('adaptive-proposal:'||p_user,0));
  select * into r from public.adaptive_plan_proposals where user_id=p_user and source_kind=p_kind and source_id=p_source and source_hash=p_hash;
  if found then return jsonb_build_object('claimed',false,'proposal',to_jsonb(r));end if;
  if (select count(*) from public.adaptive_plan_proposals where user_id=p_user and created_at>now()-interval '5 minutes')>=2 or
     (select count(*) from public.adaptive_plan_proposals where user_id=p_user and created_at>now()-interval '24 hours')>=6 then
    raise exception 'Plan preview limit reached. Try again later.' using errcode='P0429';
  end if;
  insert into public.adaptive_plan_proposals(user_id,source_kind,source_id,source_hash,status,reason,evidence)
    values(p_user,p_kind,p_source,p_hash,'generating',p_reason,p_evidence) returning * into r;
  return jsonb_build_object('claimed',true,'proposal',to_jsonb(r));
end;
$$;

create function public.change_adaptive_plan(p_user uuid,p_proposal uuid,p_action text,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.adaptive_plan_proposals; c jsonb; opt jsonb; original jsonb; current_snapshot jsonb; result jsonb;
  before_row jsonb; after_row jsonb; saved jsonb:='[]'; target uuid; added uuid; added_client text; target_date date;
  k text; v jsonb; operation text; parts text[]; today date; block jsonb; oth numeric; pos integer:=0; schedule_version bigint;
begin
  today:=public.adaptive_plan_today(p_user);
  if today is null then raise exception 'Adaptive access is required';end if;
  select * into r from public.adaptive_plan_proposals where id=p_proposal and user_id=p_user for update;
  if not found then raise exception 'Preview not found';end if;
  if (p_action='apply' and r.status='applied') or (p_action='undo' and r.status='reverted') or (p_action='decline' and r.status='declined') then return to_jsonb(r);end if;
  if p_action='decline' and r.status='proposed' then
    update public.adaptive_plan_proposals set status='declined' where id=r.id returning * into r;return to_jsonb(r);
  end if;
  if p_action='apply' and r.status='proposed' then
    if r.created_at<now()-interval '48 hours' then
      update public.adaptive_plan_proposals set status='expired' where id=r.id returning * into r;return to_jsonb(r);
    end if;
    if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 1 and 3 then raise exception 'Select up to three changes';end if;
  elsif p_action='undo' and r.status='applied' then p_changes:=r.outcomes;
  else raise exception 'This preview is no longer available for that action';
  end if;
  -- Use the versioned writers' lock order (head, then schedule/session).
  perform 1 from public.client_write_heads where user_id=p_user and entity_key='schedule:current' for update;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  if auth.uid() is distinct from p_user then raise exception 'Could not verify the plan owner';end if;
  for c in select value from jsonb_array_elements(p_changes) order by value->'option'->'session'->>'id' loop
    pos:=pos+1;opt:=c->'option';target:=(opt->'session'->>'id')::uuid;k:=opt->'field'->>'key';v:=c->'value';
    if p_action='apply' then
      if not exists(select 1 from jsonb_array_elements(r.options) item where item=opt)
        or (select count(*) from jsonb_array_elements(p_changes) item where item->'option'->'session'->>'id'=target::text)<>1 then
        raise exception 'Choose one approved change per session';
      end if;
      if k not in ('date','add') then
        if jsonb_typeof(opt->'proposed')='number' then
          if jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between (opt->>'min')::numeric and (opt->>'max')::numeric
             or mod((v#>>'{}')::numeric,(opt->>'step')::numeric)<>0 or v=opt->'field'->'value' then
            raise exception 'Choose a supported value';
          end if;
        elsif v is distinct from opt->'proposed' then raise exception 'Choose a supported action';end if;
      end if;
    end if;
    operation:=r.id::text||':'||p_action||':'||pos;
    if p_action='undo' and k='add' then target:=(c->'after'->>'id')::uuid;end if;
    perform 1 from public.client_write_heads h join public.training_plan_occurrences o
      on h.user_id=o.user_id and h.entity_key='endurance-session:'||o.source_client_id
      where o.id=target and h.user_id=p_user and o.modality='endurance' for update of h;
    -- A row lock prevents a completion referencing this endurance plan from entering mid-transaction.
    perform 1 from public.training_sessions s join public.training_plan_occurrences o
      on o.user_id=s.user_id and o.source_client_id=s.client_id and o.modality='endurance'
      where o.id=target and o.user_id=p_user for update of s;
    perform 1 from public.training_plan_occurrences where id=target and user_id=p_user for update;
    perform 1 from public.workout_templates t join public.training_plan_occurrences o on o.user_id=t.user_id and o.source_client_id=t.client_id
      where o.id=target and o.modality='strength' and o.user_id=p_user for update of t;
    current_snapshot:=public.adaptive_plan_snapshot(p_user,target);
    original:=case when p_action='undo' then c->'after' else opt->'session' end;
    if current_snapshot is null or (current_snapshot->>'blocked')::boolean or (current_snapshot->>'date')::date<=today
      or current_snapshot->>'stamp' is distinct from original->>'stamp'
      or current_snapshot->>'state' not in ('planned',case when p_action='undo' and k='remove' then 'cancelled' else 'planned' end) then
      raise exception 'A session has changed, started, or is coach-assigned. Create a fresh preview.' using errcode='P0409';
    end if;
    before_row:=current_snapshot;
    if current_snapshot->>'modality'='strength' and k='date' then
      target_date:=case when p_action='undo' then (c->'before'->>'date')::date else (v#>>'{}')::date end;
      if target_date<=today or target_date>today+28 or target_date=(current_snapshot->>'date')::date then raise exception 'Choose a different future date within four weeks';end if;
      if exists(select 1 from public.training_plan_occurrences where user_id=p_user and planned_date=target_date and status in ('planned','completed','partial'))
         or exists(select 1 from public.training_plan_occurrences source join public.training_plan_occurrences x
          on x.user_id=source.user_id and x.occurrence_key='strength:'||source.source_client_id||':'||target_date::text where source.id=target)
         or exists(select 1 from public.training_plan_occurrences source join public.workout_templates t on t.user_id=source.user_id and t.client_id=source.source_client_id
          join public.workouts w on w.template_id=t.id and w.workout_date=target_date where source.id=target and w.user_id=p_user)
      then raise exception 'Choose a date without another planned or recorded session' using errcode='P0422';end if;
      select server_version into schedule_version from public.client_write_heads where user_id=p_user and entity_key='schedule:current';
      perform public.claim_client_write_v2('schedule:current',operation,md5(target::text||':'||target_date::text),coalesce(schedule_version,0),false,false);
      update public.scheduled_workouts w set scheduled_date=target_date from public.workout_templates t,public.training_plan_occurrences o
        where o.id=target and w.user_id=p_user and t.user_id=p_user and t.id=w.template_id and t.client_id=o.source_client_id and w.scheduled_date=o.planned_date;
      if not found then raise exception 'The strength plan changed' using errcode='P0409';end if;
      update public.training_plan_occurrences set planned_date=target_date,occurrence_key='strength:'||source_client_id||':'||target_date::text where id=target;
    elsif current_snapshot->>'modality'='strength' then
      if k !~ '^exercise:[0-9]+:(sets|reps|load)$' then raise exception 'Unsupported strength field';end if;
      if p_action='undo' then result:=nullif(c->'before'->'payload','null'::jsonb);
      else
        result:=current_snapshot->'payload';
        if result->>'templateVersion' is distinct from current_snapshot->>'templateVersion' then
          result:=jsonb_build_object('templateVersion',current_snapshot->>'templateVersion','values','{}'::jsonb);
        end if;
        result:=jsonb_set(result,array['values',k],v,true);
      end if;
      update public.training_plan_occurrences set adaptive_strength_prescription=result where id=target and user_id=p_user;
    else
      result:=current_snapshot->'payload';
      if p_action='undo' then
        if k='add' then
          perform public.delete_client_entity_v2('endurance-session:'||(result->>'id'),operation,(current_snapshot->>'version')::bigint,'endurance-session',result->>'id',today);
          continue;
        end if;
        result:=c->'before'->'payload';
      elsif k in ('date','add') then
        target_date:=(v#>>'{}')::date;
        if target_date<=today or target_date>today+28 then raise exception 'Choose a future date within four weeks';end if;
        result:=jsonb_set(result,'{date}',v);
        if k='add' then
          if exists(select 1 from public.training_plan_occurrences where user_id=p_user and planned_date between target_date-1 and target_date+1 and status in ('planned','completed','partial')) then raise exception 'Choose a date with space around existing training' using errcode='P0422';end if;
          added_client:='adaptive-'||r.id::text||'-'||pos;
          result:=jsonb_build_object('id',added_client,'title',left('Easy '||(result->>'title'),120),'status','planned','activityType',result->>'activityType','date',target_date,'targetRpe',3,'plannedDurationMinutes',15,'blocks','[]'::jsonb,'category','easy');
        elsif exists(select 1 from public.training_plan_occurrences where user_id=p_user and planned_date=target_date and status in ('planned','completed','partial') and id<>target) then
          raise exception 'Choose a date without another planned session' using errcode='P0422';
        end if;
      elsif k='remove' then result:=jsonb_set(result,'{status}','"cancelled"');
      elsif k='replace' then
        if jsonb_array_length(result->'blocks')<>0 then raise exception 'Structured sessions cannot be replaced';end if;
        result:=(result-'templateId'-'plannedDistanceMetres')||jsonb_build_object('title',left('Easy '||(result->>'title'),120),'targetRpe',3,'plannedDurationMinutes',15,'category','easy');
      elsif k in ('plannedDurationMinutes','plannedDistanceMetres','targetRpe') then result:=jsonb_set(result,array[k],v);
      elsif k ~ '^block:[0-9]+:(repetitions|durationSeconds|distanceMetres|targetMinValue|targetMaxValue)$' then
        parts:=string_to_array(k,':');block:=result->'blocks'->(parts[2]::integer);
        if block is null or not (block ? parts[3]) then raise exception 'The selected step is unavailable';end if;
        oth:=(block->>case when parts[3]='targetMinValue' then 'targetMaxValue' else 'targetMinValue' end)::numeric;
        if (parts[3]='targetMinValue' and (v#>>'{}')::numeric>oth) or (parts[3]='targetMaxValue' and (v#>>'{}')::numeric<oth) then raise exception 'Keep the pace range in order';end if;
        result:=jsonb_set(result,array['blocks',parts[2],parts[3]],v,false);
      else raise exception 'Unsupported endurance field';end if;
      -- Numeric edits must not inadvertently persist an already-invalid tree.
      if exists (
        with recursive steps as (
          select b->>'id' id,b->>'parentId' parent,b->>'type' kind from jsonb_array_elements(result->'blocks') b
        ), reachable(id,kind) as (
          select id,kind from steps where parent is null
          union
          select s.id,s.kind from steps s join reachable visited on visited.id=s.parent and visited.kind='repeat_group'
        )
        select 1 where (select count(*) from steps)<>(select count(*) from reachable)
          or (select count(distinct id) from steps)<>(select count(*) from steps)
      ) then raise exception 'This session has an invalid interval structure' using errcode='P0409';end if;
      perform public.save_endurance_session_v2(result,operation,case when p_action='apply' and k='add' then 0 else (current_snapshot->>'version')::bigint end);
      if result->>'status'='cancelled' then update public.training_plan_occurrences set status='cancelled' where id=target and user_id=p_user;end if;
      if p_action='apply' and k='add' then
        select id into added from public.training_plan_occurrences where user_id=p_user and occurrence_key='endurance:'||added_client;
        target:=added;
      end if;
    end if;
    after_row:=public.adaptive_plan_snapshot(p_user,target);
    saved:=saved||jsonb_build_array(c||jsonb_build_object('before',before_row,'after',after_row));
  end loop;
  if p_action='apply' then
    update public.adaptive_plan_proposals set status='applied',accepted=p_changes,outcomes=saved,applied_at=now() where id=r.id returning * into r;
  else
    update public.adaptive_plan_proposals set status='reverted',reverted_at=now() where id=r.id returning * into r;
  end if;
  return to_jsonb(r);
end;
$$;

-- Serialize workout starts with prescription updates without changing any workout data.
create function public.lock_adaptive_strength_start() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.template_id is not null then perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));end if;
  return new;
end;
$$;
create trigger lock_adaptive_strength_start before insert or update of template_id,workout_date,status on public.workouts
  for each row execute function public.lock_adaptive_strength_start();

create function public.guard_adaptive_strength_prescription() returns trigger
language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and
    (case when tg_op='INSERT' then new.adaptive_strength_prescription is not null
     else new.adaptive_strength_prescription is distinct from old.adaptive_strength_prescription end) then
    raise exception 'Strength prescriptions require an approved plan adjustment';
  end if;
  return new;
end;
$$;
create trigger guard_adaptive_strength_prescription before insert or update on public.training_plan_occurrences
  for each row execute function public.guard_adaptive_strength_prescription();

revoke all on function public.adaptive_plan_today(uuid),public.adaptive_plan_snapshot(uuid,uuid),
  public.list_adaptive_plan_snapshots(uuid),public.claim_adaptive_plan_proposal(uuid,text,uuid,text,text,jsonb),
  public.change_adaptive_plan(uuid,uuid,text,jsonb),public.lock_adaptive_strength_start(),public.guard_adaptive_strength_prescription() from public,anon,authenticated;
grant execute on function public.list_adaptive_plan_snapshots(uuid),public.claim_adaptive_plan_proposal(uuid,text,uuid,text,text,jsonb),
  public.change_adaptive_plan(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.adaptive_plan_today(uuid),public.adaptive_plan_snapshot(uuid,uuid) to service_role;

commit;
