-- 첫 화면에 전시할 '핵심 위키' 목록.
--
-- 사람이 화면에서 고르는 값이라 시드가 채우지 않는다. 조회수(V21)와 같은 성질이고,
-- 그래서 배포가 시드를 다시 돌려도 이 목록은 그대로 남는다.
--
-- 컬럼(tb_article.featured_order)이 아니라 테이블로 둔 이유는 전시 목록이 하나로
-- 끝나지 않을 수 있어서다. 목록이 둘 이상 필요해지면 list_id 를 앞에 붙여 복합 PK 로 간다.
--
-- position 이 PK 라 같은 자리에 둘이 들어갈 수 없고, article_slug 가 unique 라
-- 한 글이 목록에 두 번 들어갈 수 없다. 몇 편까지 전시할지는 서비스가 정한다 --
-- 그 수는 화면 사정으로 바뀔 값이라 스키마에 박지 않는다.
create table if not exists public.tb_wiki_featured (
    position     smallint primary key check (position >= 1),
    article_slug text     not null unique
                 references public.tb_article(slug) on delete cascade on update cascade
);
