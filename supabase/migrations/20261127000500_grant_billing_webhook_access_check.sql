begin;

-- Webhook reconciliation runs as service_role and calls this private helper.
grant execute on function public.billing_access_valid(text, timestamptz) to service_role;

commit;
