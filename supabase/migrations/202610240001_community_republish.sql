-- Re-publishing an edited source updates its author's existing post in place.
-- Identical retries are no-ops; actual updates share the existing publishing quota.
create or replace function public.community_api(p_actor uuid, p_action text, p_data jsonb default '{}')
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_id uuid; v_comment uuid; v_result jsonb; v_post public.community_posts;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_offset integer := least(greatest(coalesce((p_data->>'offset')::integer, 0), 0), 10000);
  v_affected integer; v_liked boolean;
begin
  if p_actor is null then raise exception 'UNAUTHORIZED'; end if;
  -- Soft per-identity API budget, separate from daily publish/comment quotas.
  perform public.community_take_quota(p_actor, 'request', 5000, 0);
  if p_action = 'list' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]') into v_result from (
      select p.id, p.title, p.character, p.created_at, p.likes, p.views,
        exists(select 1 from public.community_likes l where l.post_id = p.id and l.actor = p_actor) as liked,
        p.author = p_actor as is_mine
      from public.community_posts p
      where (coalesce(p_data->>'liked', 'false') <> 'true' or exists(select 1 from public.community_likes l where l.post_id = p.id and l.actor = p_actor))
        and (coalesce(p_data->>'query', '') = '' or position(lower(p_data->>'query') in lower(p.title)) > 0)
      order by case when p_data->>'sort' = 'popular' then p.likes else 0 end desc, p.created_at desc, p.id
      limit 20 offset v_offset
    ) t;
    return v_result;
  elsif p_action = 'publish' then
    -- Serialize publications of the same source, including the first insert.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text || ':' || (p_data->>'clientId'), 0));
    select * into v_post from public.community_posts
      where author = p_actor and client_id = p_data->>'clientId' for update;
    if found then
      if v_post.title = p_data->>'title' and v_post.character = p_data->>'character'
        and v_post.script = p_data->>'script' and v_post.chat_messages = p_data->'chatMessages' then
        return jsonb_build_object('id', v_post.id, 'alreadyPublished', true);
      end if;
      perform public.community_take_quota(p_actor, 'publish', 5, 60);
      update public.community_posts set title = p_data->>'title', character = p_data->>'character',
        script = p_data->>'script', chat_messages = p_data->'chatMessages'
        where id = v_post.id and author = p_actor;
      -- Keep the post ID, creation date, likes, views, comments and reports intact.
      return jsonb_build_object('id', v_post.id, 'updated', true);
    end if;
    perform public.community_take_quota(p_actor, 'publish', 5, 60);
    insert into public.community_posts(author, client_id, title, character, script, chat_messages)
    values(p_actor, p_data->>'clientId', p_data->>'title', p_data->>'character', p_data->>'script', p_data->'chatMessages') returning id into v_id;
    return jsonb_build_object('id', v_id);
  end if;
  v_id := (p_data->>'id')::uuid;
  if p_action = 'detail' then
    select * into v_post from public.community_posts where id = v_id;
    if not found then raise exception 'NOT_FOUND'; end if;
    select coalesce(jsonb_agg(row_to_json(t)), '[]') into v_result from (
      select c.id, c.body, c.created_at, c.author = p_actor as is_mine from public.community_comments c
      where c.post_id = v_id order by c.created_at desc, c.id limit 30 offset v_offset
    ) t;
    return jsonb_build_object('id', v_post.id, 'title', v_post.title, 'character', v_post.character,
      'script', v_post.script, 'chat_messages', v_post.chat_messages, 'created_at', v_post.created_at,
      'likes', v_post.likes, 'views', v_post.views, 'is_mine', v_post.author = p_actor,
      'liked', exists(select 1 from public.community_likes where post_id = v_id and actor = p_actor), 'comments', v_result);
  elsif p_action = 'comment' then
    perform public.community_take_quota(p_actor, 'comment', 10, 10);
    insert into public.community_comments(post_id, author, body) values(v_id, p_actor, p_data->>'body') returning id into v_comment;
    return jsonb_build_object('id', v_comment);
  elsif p_action = 'like' then
    perform public.community_take_quota(p_actor, 'like', 300, 1);
    -- Lock the post so increments, decrements and deletion cannot race.
    perform 1 from public.community_posts where id = v_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    v_liked := (p_data->>'liked')::boolean;
    if v_liked then
      insert into public.community_likes(post_id, actor) values(v_id, p_actor) on conflict do nothing;
    else
      delete from public.community_likes where post_id = v_id and actor = p_actor;
    end if;
    return jsonb_build_object('liked', v_liked);
  elsif p_action = 'view' then
    insert into public.community_views(post_id, actor, day) values(v_id, p_actor, v_day) on conflict do nothing;
    get diagnostics v_affected = row_count;
    update public.community_posts set views = views + v_affected where id = v_id;
    return '{}'::jsonb;
  elsif p_action = 'deletePost' then
    delete from public.community_posts where id = v_id and author = p_actor;
    get diagnostics v_affected = row_count;
    if v_affected = 0 then raise exception 'NOT_FOUND'; end if;
    return '{}'::jsonb;
  elsif p_action = 'deleteComment' then
    delete from public.community_comments where id = (p_data->>'commentId')::uuid and post_id = v_id and author = p_actor;
    get diagnostics v_affected = row_count;
    if v_affected = 0 then raise exception 'NOT_FOUND'; end if;
    return '{}'::jsonb;
  elsif p_action = 'report' then
    perform public.community_take_quota(p_actor, 'report', 10, 10);
    insert into public.community_reports(post_id, actor) values(v_id, p_actor) on conflict do nothing;
    return '{}'::jsonb;
  end if;
  raise exception 'INVALID_ACTION';
end $$;
revoke all on function public.community_api(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.community_api(uuid, text, jsonb) to service_role;
