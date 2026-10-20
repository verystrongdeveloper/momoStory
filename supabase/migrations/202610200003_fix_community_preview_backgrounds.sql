-- PostgreSQL-safe replacement for the community preview background extractor.
create or replace function public.community_list(p_actor uuid, p_data jsonb default '{}')
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_period text := coalesce(p_data->>'period', 'all');
  v_since timestamptz;
  v_result jsonb;
  v_offset integer := least(greatest(coalesce((p_data->>'offset')::integer, 0), 0), 10000);
begin
  if p_actor is null then raise exception 'UNAUTHORIZED'; end if;
  if v_period not in ('all', 'day', 'week', 'month', 'year') then raise exception 'INVALID_REQUEST'; end if;
  perform public.community_take_quota(p_actor, 'request', 5000, 0);
  if v_period <> 'all' then
    v_since := date_trunc(v_period, now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  end if;
  with period_scores as (
    select l.post_id, count(*)::integer as score
    from public.community_likes l
    where v_since is not null and l.created_at >= v_since and l.created_at <= now()
    group by l.post_id
  ), ranked as (
    select p.id, p.title, p.character,
      substring(p.script from '(?i)bg[[:space:]]*:[[:space:]]*(BG_[A-Za-z0-9_]+)') as preview_bg,
      p.created_at, p.likes, p.views,
      case when v_since is null then p.likes else coalesce(s.score, 0) end as period_likes,
      exists(select 1 from public.community_likes l where l.post_id = p.id and l.actor = p_actor) as liked,
      p.author = p_actor as is_mine
    from public.community_posts p left join period_scores s on s.post_id = p.id
    where (coalesce(p_data->>'liked', 'false') <> 'true' or exists(select 1 from public.community_likes l where l.post_id = p.id and l.actor = p_actor))
      and (coalesce(p_data->>'query', '') = '' or position(lower(p_data->>'query') in lower(p.title)) > 0)
  )
  select coalesce(jsonb_agg(to_jsonb(t)), '[]') into v_result from (
    select ranked.*,
      (select count(*) from public.community_comments c where c.post_id = ranked.id) as comment_count
    from ranked
    order by case when p_data->>'sort' = 'popular' then period_likes else 0 end desc, created_at desc, id
    limit 20 offset v_offset
  ) t;
  return v_result;
end $$;
revoke all on function public.community_list(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.community_list(uuid, jsonb) to service_role;
