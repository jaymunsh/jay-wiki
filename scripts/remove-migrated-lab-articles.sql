-- 이관이 끝난 LAB 글을 위키에서 지운다. migrate-lab-articles-to-blog.sql 다음에만 실행한다.
-- 블로그에 같은 slug 가 있는 글만 지운다 — 이관되지 않은 글을 실수로 지우지 않기 위해서다.
--
-- tb_revision 에는 이 8편의 과거 스냅샷이 남는다. 위키가 문서를 지워도 이력을 보존하는
-- 기존 정책 때문이며 의도된 결과다. 블로그에 revision 을 만드는 것과는 무관하다.
--
--   docker exec -i pf-postgres psql -U portfolio -d portfolio -v ON_ERROR_STOP=1 \
--     < scripts/remove-migrated-lab-articles.sql
begin;

select a.slug from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and exists (select 1 from public.tb_blog_post p where p.slug = a.slug);

delete from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and exists (select 1 from public.tb_blog_post p where p.slug = a.slug);

commit;
