-- LAB 4개 탭의 위키 글을 블로그로 옮긴다. 일회성이지만 재실행해도 안전하다(slug 로 중복을 막는다).
-- 시드가 아니다. 이 스크립트는 tb_article 을 읽기만 하고 지우지 않는다.
-- 원본 삭제는 화면 확인이 끝난 뒤 scripts/remove-migrated-lab-articles.sql 로 따로 한다.
--
--   scripts/migrate-lab-articles-to-blog.sh            로컬
--   scripts/migrate-lab-articles-to-blog.sh --dry-run  옮길 대상만 출력
begin;

-- 1) 글 본문. parent_id 와 카테고리 slug 가 같은 문자열이라 그대로 조인한다.
--    published_at 은 위키의 작성일(created_at)을 쓰고, 없으면 옮기지 않는다.
--    V13 의 chk_blog_post_published_at 이 published + published_at null 을 막기 때문이다.
insert into public.tb_blog_post
    (slug, category_id, title, summary, body, status, published_at, created_at, updated_at)
select a.slug,
       c.id,
       a.title,
       a.summary,
       a.body,
       'published',
       a.created_at,
       a.created_at,
       now()
from public.tb_article a
join public.tb_blog_category c on c.slug = a.parent_id
where a.parent_id in ('personal-projects', 'team-projects', 'tech-lab', 'tools-workflow')
  and a.status = 'published'
  and a.created_at is not null
  and not exists (select 1 from public.tb_blog_post p where p.slug = a.slug);

-- 2) 태그. 위키는 콤마 문자열이라 풀어서 정규화한다.
with pairs as (
    select p.id as post_id,
           trim(t.name) as tag_name
    from public.tb_article a
    join public.tb_blog_post p on p.slug = a.slug
    cross join lateral unnest(string_to_array(coalesce(a.tags, ''), ',')) as t(name)
    where a.parent_id in ('personal-projects', 'team-projects', 'tech-lab', 'tools-workflow')
      and trim(t.name) <> ''
)
insert into public.tb_blog_tag (name)
select distinct tag_name from pairs
on conflict (name) do nothing;

with pairs as (
    select p.id as post_id,
           trim(t.name) as tag_name
    from public.tb_article a
    join public.tb_blog_post p on p.slug = a.slug
    cross join lateral unnest(string_to_array(coalesce(a.tags, ''), ',')) as t(name)
    where a.parent_id in ('personal-projects', 'team-projects', 'tech-lab', 'tools-workflow')
      and trim(t.name) <> ''
)
insert into public.tb_blog_post_tag (post_id, tag_id)
select pairs.post_id, tg.id
from pairs
join public.tb_blog_tag tg on tg.name = pairs.tag_name
on conflict do nothing;

-- 3) 본문 첫 줄의 H1 을 뗀다.
--    위키 본문은 '# 제목' 으로 시작하는데 블로그 글 화면은 머리말에 제목을 따로 세운다.
--    두면 같은 제목이 화면에 두 번 나온다. 제목과 같은 문자열일 때만 뗀다.
--    제목을 정규식에 넣지 않는다. 제목에 . ( ) 같은 글자가 있으면 패턴이 뒤틀린다.
--    첫 줄을 문자열로 그대로 비교하고, 지울 때만 정규식을 쓴다.
--    본문이 개행으로 시작하는 글이 있어 앞 공백을 먼저 턴 뒤에 비교한다.
update public.tb_blog_post
set body = regexp_replace(ltrim(body, E' \t\r\n'), '^[^\n]*\n\s*', '')
where split_part(ltrim(body, E' \t\r\n'), E'\n', 1) = '# ' || title;

-- 4) 본문 안의 위키 내부 링크를 블로그 주소로 바꾼다.
--    조사된 것은 orca -> donts3p 한 건뿐이지만, 이관 대상끼리의 링크는 전부 바꾼다.
update public.tb_blog_post src
set body = replace(src.body, '/wiki/' || dst.slug, '/' || dst.id || '/' || dst.slug)
from public.tb_blog_post dst
where src.id <> dst.id
  and src.body like '%/wiki/' || dst.slug || '%';

commit;

-- 확인용 출력
select p.id, p.slug, c.slug as category, p.published_at::date,
       (select count(*) from public.tb_blog_post_tag pt where pt.post_id = p.id) as tags
from public.tb_blog_post p
join public.tb_blog_category c on c.id = p.category_id
order by p.published_at desc, p.id desc;
