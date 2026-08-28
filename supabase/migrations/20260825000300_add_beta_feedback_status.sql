begin;

alter table public.beta_feedback
  add column if not exists status text not null default 'new';

alter table public.beta_feedback
  drop constraint if exists beta_feedback_status_check;

alter table public.beta_feedback
  add constraint beta_feedback_status_check
  check (status in ('new','reviewing','planned','actioned','declined'));

create index if not exists beta_feedback_status_created_idx
  on public.beta_feedback(status,created_at desc);

comment on column public.beta_feedback.status is
  'Internal review status maintained by the Setra project owner.';

commit;
