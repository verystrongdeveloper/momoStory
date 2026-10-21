alter table public.community_posts
  drop constraint if exists community_posts_character_check;

alter table public.community_posts
  add constraint community_posts_character_check
  check (character in ('호시노', '히나', '마리', '후부키'));
