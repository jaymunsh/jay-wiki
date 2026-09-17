-- 블로그 글의 목차 노출 여부. 위키(V19 tb_article.toc_enabled)와 같은 이름·같은 방식으로 맞춘다.
-- 글 쓰는 사람이 두 사이트에서 같은 스위치를 찾게 하려는 것이다.
--
-- 기본값은 true 다. 블로그는 지금까지 '기본 켜짐 + <!-- no-toc --> 로 끄기'였고 끈 글이 한 편도
-- 없다. 기본을 false 로 두면 기존 16편이 전부 목차를 잃는다.
alter table public.tb_blog_post
    add column toc_enabled boolean not null default true;
