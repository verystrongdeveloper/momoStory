-- Only the Edge Function (service_role) may call these functions or read tables.
-- No author identifiers are returned by the API. All mutations are transactional.
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 100),
  character text not null check (character in ('호시노', '히나')),
  script text not null check (char_length(script) between 1 and 50000),
  chat_messages jsonb not null default '[]' check (jsonb_typeof(chat_messages) = 'array' and jsonb_array_length(chat_messages) <= 300),
  created_at timestamptz not null default now(),
  likes integer not null default 0 check (likes >= 0),
  views bigint not null default 0 check (views >= 0),
  unique(author, client_id),
  check (octet_length(script) + octet_length(chat_messages::text) <= 220000)
);
create index community_posts_new on public.community_posts(created_at desc, id);
create index community_posts_popular on public.community_posts(likes desc, created_at desc, id);
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300 and length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index community_comments_post on public.community_comments(post_id, created_at, id);
create table public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  actor uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id, actor)
);
create index community_likes_actor on public.community_likes(actor, created_at desc);
create table public.community_views (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  actor uuid not null references auth.users(id) on delete cascade,
  day date not null, primary key(post_id, actor, day)
);
create index community_views_cleanup on public.community_views(day);
create table public.community_limits (
  actor uuid not null references auth.users(id) on delete cascade,
  day date not null, action text not null,
  used integer not null default 0, last_at timestamptz not null,
  primary key(actor, day, action)
);
create index community_limits_cleanup on public.community_limits(day);
create table public.community_reports (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  actor uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id, actor)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_views enable row level security;
alter table public.community_limits enable row level security;
alter table public.community_reports enable row level security;
revoke all on public.community_posts, public.community_comments, public.community_likes, public.community_views, public.community_limits, public.community_reports from anon, authenticated;
grant all on public.community_posts, public.community_comments, public.community_likes, public.community_views, public.community_limits, public.community_reports to service_role;

-- Keep counters correct even when an operator deletes an anonymous Auth user (FK cascade).
create function public.community_like_counter() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    update public.community_posts set likes = likes + 1 where id = NEW.post_id;
    return NEW;
  else
    update public.community_posts set likes = likes - 1 where id = OLD.post_id;
    return OLD;
  end if;
end $$;
create trigger community_like_count after insert or delete on public.community_likes for each row execute function public.community_like_counter();
revoke all on function public.community_like_counter() from public, anon, authenticated;

create function public.community_take_quota(p_actor uuid, p_action text, p_max integer, p_seconds integer)
returns void language plpgsql set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Seoul')::date; v_used integer;
begin
  -- ON CONFLICT locks a shared quota row: concurrent requests cannot exceed the limit.
  insert into public.community_limits as q(actor, day, action, used, last_at)
  values(p_actor, v_day, p_action, 1, clock_timestamp())
  on conflict(actor, day, action) do update set used = q.used + 1, last_at = clock_timestamp()
    where q.used < p_max and q.last_at <= clock_timestamp() - make_interval(secs => p_seconds)
  returning used into v_used;
  if v_used is null then raise exception 'RATE_LIMIT'; end if;
  -- Preserve the last action across midnight too, not only within one quota day.
  if exists(select 1 from public.community_limits where actor = p_actor and day = v_day - 1 and action = p_action and last_at > clock_timestamp() - make_interval(secs => p_seconds)) then
    raise exception 'RATE_LIMIT';
  end if;
end $$;

create function public.community_api(p_actor uuid, p_action text, p_data jsonb default '{}')
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
    select * into v_post from public.community_posts where author = p_actor and client_id = p_data->>'clientId';
    if found then return jsonb_build_object('id', v_post.id, 'alreadyPublished', true); end if;
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
revoke all on function public.community_take_quota(uuid, text, integer, integer), public.community_api(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.community_take_quota(uuid, text, integer, integer), public.community_api(uuid, text, jsonb) to service_role;

-- Schedule daily in the dashboard (pg_cron) to bound deduplication/quota storage.
create function public.community_cleanup() returns void language sql set search_path = '' as $$
  delete from public.community_views where day < (now() at time zone 'Asia/Seoul')::date - 2;
  delete from public.community_limits where day < (now() at time zone 'Asia/Seoul')::date - 2;
$$;
revoke all on function public.community_cleanup() from public, anon, authenticated;
grant execute on function public.community_cleanup() to service_role;
