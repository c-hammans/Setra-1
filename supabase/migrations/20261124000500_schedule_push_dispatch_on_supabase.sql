begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_push_dispatch(p_dispatch_url text,p_dispatch_secret text)
returns void language plpgsql security definer set search_path='' as $$
declare url_secret_id uuid;auth_secret_id uuid;
begin
  if p_dispatch_url is null or p_dispatch_url not like 'https://%/api/push/dispatch' then raise exception 'Use the full HTTPS Setra push dispatch URL';end if;
  if p_dispatch_secret is null or char_length(p_dispatch_secret)<32 then raise exception 'Use a random dispatch secret of at least 32 characters';end if;

  select id into url_secret_id from vault.secrets where name='setra_push_dispatch_url';
  if url_secret_id is null then
    perform vault.create_secret(p_dispatch_url,'setra_push_dispatch_url','Setra push dispatch endpoint');
  else
    perform vault.update_secret(url_secret_id,p_dispatch_url);
  end if;

  select id into auth_secret_id from vault.secrets where name='setra_push_dispatch_secret';
  if auth_secret_id is null then
    perform vault.create_secret(p_dispatch_secret,'setra_push_dispatch_secret','Setra push dispatch bearer secret');
  else
    perform vault.update_secret(auth_secret_id,p_dispatch_secret);
  end if;
end;$$;

create or replace function public.invoke_push_dispatch()
returns bigint language plpgsql security definer set search_path='' as $$
declare dispatch_url text;dispatch_secret text;request_id bigint;
begin
  select decrypted_secret into dispatch_url from vault.decrypted_secrets where name='setra_push_dispatch_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name='setra_push_dispatch_secret';
  if dispatch_url is null or dispatch_secret is null then
    raise warning 'Setra push dispatch is waiting for Vault configuration';
    return null;
  end if;
  select net.http_get(
    url:=dispatch_url,
    headers:=jsonb_build_object('Authorization','Bearer '||dispatch_secret),
    timeout_milliseconds:=55000
  ) into request_id;
  return request_id;
exception when others then
  raise warning 'Setra push dispatch request could not be queued: %',sqlerrm;
  return null;
end;$$;

revoke all on function public.configure_push_dispatch(text,text) from public,anon,authenticated;
revoke all on function public.invoke_push_dispatch() from public,anon,authenticated;
grant execute on function public.configure_push_dispatch(text,text) to service_role;

do $$declare existing_job bigint;begin
  for existing_job in select jobid from cron.job where jobname='setra-push-dispatch-every-minute' loop
    perform cron.unschedule(existing_job);
  end loop;
  perform cron.schedule('setra-push-dispatch-every-minute','* * * * *','select public.invoke_push_dispatch();');
end$$;

commit;
