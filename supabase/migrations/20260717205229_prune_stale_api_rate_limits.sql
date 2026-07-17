create or replace function public.consume_api_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_hits integer;
begin
  if p_key is null or length(p_key) < 10 or p_max < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.api_rate_limits (rate_key, window_started_at, hits, updated_at)
  values (p_key, now(), 1, now())
  on conflict (rate_key) do update
  set
    window_started_at = case
      when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else public.api_rate_limits.window_started_at
    end,
    hits = case
      when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else public.api_rate_limits.hits + 1
    end,
    updated_at = now()
  returning hits into current_hits;

  if random() < 0.01 then
    delete from public.api_rate_limits
    where rate_key in (
      select rate_key
      from public.api_rate_limits
      where updated_at < now() - interval '1 day'
      order by updated_at
      limit 250
    );
  end if;

  return current_hits <= p_max;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
