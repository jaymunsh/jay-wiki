-- ============================================================
-- V14: 블로그 조회수와 일일 통계
--   개별 식별자를 영구 저장하지 않는다. 방문자 중복 제거는 Redis 에서 하루치만 하고
--   TTL 로 사라지며, 여기에는 날짜별 집계 숫자만 남는다.
--   유입 경로는 받는 즉시 버킷으로 분류하고 원본 URL 은 버린다.
-- ============================================================

alter table public.tb_blog_post
    add column if not exists view_count bigint not null default 0;

create table if not exists public.tb_blog_daily_stat (
    stat_date  date primary key,
    views      bigint not null default 0,
    visitors   bigint not null default 0,
    ref_search bigint not null default 0,
    ref_sns    bigint not null default 0,
    ref_other  bigint not null default 0
);
