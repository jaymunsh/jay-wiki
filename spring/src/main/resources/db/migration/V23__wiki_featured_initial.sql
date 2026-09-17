-- 핵심 위키 다섯 편의 초기값. V22 가 "사람이 고르는 값이라 시드가 채우지 않는다"고 한 결정은
-- 그대로다 -- 이건 시드가 아니라 한 번 심고 마는 초기값이라, 목록이 비어 있을 때만 들어간다.
-- 그래서 화면에서 다시 고른 목록을 배포가 되돌리지 않는다.
--
-- tb_article 을 조인하는 이유: article_slug 에 FK 가 걸려 있어 글이 아직 없는 DB(새로 만든 로컬,
-- Testcontainers)에서 그냥 넣으면 기동이 죽는다. 다섯 편이 다 있을 때만 넣고, 아니면 아무것도 안 넣는다.
insert into public.tb_wiki_featured (position, article_slug)
select v.position, v.slug
  from (values (1::smallint, 'postgres-backup-restore'),
               (2::smallint, 'audit-before-incident-default-open'),
               (3::smallint, 'silent-500-alert-gap'),
               (4::smallint, 'saga-kafka-outbox-order'),
               (5::smallint, 'search-comparison-results')) as v(position, slug)
  join public.tb_article a on a.slug = v.slug
 where not exists (select 1 from public.tb_wiki_featured)
   and (select count(*) from public.tb_article where slug in
        ('postgres-backup-restore', 'audit-before-incident-default-open', 'silent-500-alert-gap',
         'saga-kafka-outbox-order', 'search-comparison-results')) = 5;
