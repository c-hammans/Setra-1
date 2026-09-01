begin;

alter table public.training_session_blocks
  add column if not exists parent_client_id text;

alter table public.training_session_blocks
  drop constraint if exists training_session_blocks_block_type_check,
  drop constraint if exists training_session_blocks_parent_client_id_check,
  drop constraint if exists training_session_blocks_parent_client_fk;

alter table public.training_session_blocks
  add constraint training_session_blocks_block_type_check
    check (block_type in ('warmup','main','interval','recovery','cooldown','custom','repeat_group')),
  add constraint training_session_blocks_parent_client_id_check
    check (
      parent_client_id is null
      or (
        char_length(parent_client_id) between 1 and 160
        and client_id is not null
        and parent_client_id <> client_id
        and block_type <> 'repeat_group'
      )
    ),
  add constraint training_session_blocks_parent_client_fk
    foreign key (session_id,parent_client_id)
    references public.training_session_blocks(session_id,client_id)
    on delete cascade
    deferrable initially deferred;

create index if not exists training_session_blocks_parent_client_idx
  on public.training_session_blocks(session_id,parent_client_id)
  where parent_client_id is not null;

comment on column public.training_session_blocks.parent_client_id is
  'Links an executable child step to a repeat_group step in the same session. The group repetitions value controls how many times all children repeat.';

commit;
