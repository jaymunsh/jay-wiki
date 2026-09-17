-- 위키 문서 조회수. 시드가 덮지 않는 컬럼이다 — ArticleService.save 는 요청에 담긴 필드만
-- 엔티티에 덮으므로, 배포가 시드를 다시 돌려도 이 값은 그대로 남는다.
-- 전체 조회수는 따로 저장하지 않는다. 필요할 때 이 컬럼을 더한다(진실은 한 군데).
alter table public.tb_article
    add column if not exists view_count bigint not null default 0;
