-- V23 과 같은 문장이다. V23 이 아무것도 안 넣었기 때문에 한 번 더 둔다.
--
-- 왜 안 들어갔나: 마이그레이션은 앱이 뜰 때 돌고, 위키 콘텐츠 싱크는 그보다 뒤 단계다.
-- 2026-08-15 배포에서 V23 이 돌던 시점에 audit-before-incident-default-open 을 비롯한 9편이
-- 아직 운영에 없었다. FK 가드("다섯이 다 있을 때만 넣는다")가 제 일을 해서 0행을 넣었다.
-- 가드가 틀린 게 아니라, 같은 배포에서 처음 만들어지는 글을 참조하는 초기값은 그 배포에서는
-- 절대 못 채운다는 순서 문제였다. 지금은 다섯 편이 다 운영에 있다.
--
-- 여전히 비어 있을 때만 넣는다. 그 사이 화면에서 골라 둔 목록이 있으면 건드리지 않는다.
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
