begin;

alter table public.workout_templates add column if not exists archived_at timestamptz;
alter table public.endurance_templates add column if not exists archived_at timestamptz;
alter table public.coach_programs add column if not exists archived_at timestamptz;

create index if not exists workout_templates_library_idx
  on public.workout_templates(user_id,archived_at,updated_at desc)
  where coach_assignment_id is null;
create index if not exists endurance_templates_library_idx
  on public.endurance_templates(user_id,archived_at,updated_at desc);
create index if not exists coach_programs_library_idx
  on public.coach_programs(coach_user_id,archived_at,updated_at desc);

drop function if exists public.list_coach_programs();
create function public.list_coach_programs()
returns table(program_id uuid,name text,description text,duration_weeks smallint,focus text,sessions jsonb,created_at timestamptz,updated_at timestamptz,archived_at timestamptz)
language sql stable security definer set search_path='' as $$
  select program.id,program.name,program.description,program.duration_weeks,program.focus,
    coalesce(jsonb_agg(jsonb_build_object(
      'id',session.id,'weekNumber',session.week_number,'dayOffset',session.day_offset,'position',session.position,
      'modality',session.modality,'templateId',session.source_template_client_id,'templateName',session.source_template_name,
      'instruction',session.instruction
    ) order by session.week_number,session.day_offset,session.position) filter(where session.id is not null),'[]'::jsonb),
    program.created_at,program.updated_at,program.archived_at
  from public.coach_programs program
  left join public.coach_program_sessions session on session.program_id=program.id
  where program.coach_user_id=auth.uid()
  group by program.id order by program.updated_at desc;
$$;

create or replace function public.set_coach_library_archive(
  p_item_type text,
  p_item_id text,
  p_archived boolean
)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if not exists(select 1 from public.user_roles where user_id=uid and role='coach') then
    raise exception 'Coach access is required';
  end if;
  if p_item_type='strength' then
    update public.workout_templates set archived_at=case when p_archived then now() else null end
      where user_id=uid and client_id=p_item_id and coach_assignment_id is null;
  elsif p_item_type='endurance' then
    update public.endurance_templates set archived_at=case when p_archived then now() else null end
      where user_id=uid and client_id=p_item_id;
  elsif p_item_type='program' then
    update public.coach_programs set archived_at=case when p_archived then now() else null end
      where coach_user_id=uid and id=p_item_id::uuid;
  else
    raise exception 'Unsupported library item type';
  end if;
  if not found then raise exception 'Library item is unavailable';end if;
end;$$;

create or replace function public.assign_coach_library_item_bulk(
  p_item_type text,
  p_item_id text,
  p_relationship_ids uuid[],
  p_date date,
  p_note text default ''
)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare relationship_id uuid;result_id uuid;result_ids uuid[]:='{}';
begin
  if auth.uid() is null then raise exception 'Authentication is required';end if;
  if p_relationship_ids is null or cardinality(p_relationship_ids) not between 1 and 50 then
    raise exception 'Choose between 1 and 50 clients';
  end if;
  if (select count(distinct value) from unnest(p_relationship_ids) value)<>cardinality(p_relationship_ids) then
    raise exception 'Each client can only be selected once';
  end if;
  if p_item_type='program' and not exists(
    select 1 from public.coach_programs
    where id=p_item_id::uuid and coach_user_id=auth.uid() and archived_at is null
  ) then
    raise exception 'Program is unavailable';
  elsif p_item_type='strength' and not exists(
    select 1 from public.workout_templates
    where user_id=auth.uid() and client_id=p_item_id and coach_assignment_id is null and archived_at is null
  ) then
    raise exception 'Strength workout is unavailable';
  elsif p_item_type='endurance' and not exists(
    select 1 from public.endurance_templates
    where user_id=auth.uid() and client_id=p_item_id and archived_at is null
  ) then
    raise exception 'Endurance workout is unavailable';
  elsif p_item_type not in ('strength','endurance','program') then
    raise exception 'Unsupported library item type';
  end if;
  for relationship_id in select unnest(p_relationship_ids) loop
    if p_item_type='program' then
      result_id:=public.assign_coach_program(p_item_id::uuid,relationship_id,p_date,p_note);
    elsif p_item_type in ('strength','endurance') then
      result_id:=public.coach_assign_template(relationship_id,p_item_type,p_item_id,p_date,p_note);
    end if;
    result_ids:=array_append(result_ids,result_id);
  end loop;
  return result_ids;
end;$$;

revoke all on function public.list_coach_programs() from public,anon;
revoke all on function public.set_coach_library_archive(text,text,boolean) from public,anon;
revoke all on function public.assign_coach_library_item_bulk(text,text,uuid[],date,text) from public,anon;
grant execute on function public.list_coach_programs() to authenticated;
grant execute on function public.set_coach_library_archive(text,text,boolean) to authenticated;
grant execute on function public.assign_coach_library_item_bulk(text,text,uuid[],date,text) to authenticated;

commit;
