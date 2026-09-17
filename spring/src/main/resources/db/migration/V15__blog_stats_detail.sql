-- ============================================================
-- V15: 유입 소스와 디바이스 일별 집계
--   컬럼을 늘리지 않고 세로 테이블로 둔다. 소스가 늘 때마다 마이그레이션이 붙지 않는다.
--
--   원본 Referer URL 과 User-Agent 원문은 여전히 저장하지 않는다.
--   referer 는 호스트만 보고 소스 이름으로 줄이고(검색어는 경로·쿼리에 있으므로 남지 않는다),
--   UA 는 모바일 여부 boolean 으로만 줄인다.
--
--   tb_blog_daily_stat 의 ref_search / ref_sns / ref_other 는 그대로 둔다.
--   이미 쌓인 값이 있고 지우면 과거 집계가 사라진다. 이 테이블은 이 시점부터 쌓인다.
-- ============================================================

create table if not exists public.tb_blog_referrer_daily (
    stat_date date   not null,
    source    text   not null,          -- google, naver, daum, bing, sns:x, direct, other ...
    count     bigint not null default 0,
    primary key (stat_date, source)
);

create table if not exists public.tb_blog_device_daily (
    stat_date date   not null,
    device    text   not null check (device in ('pc', 'mobile')),
    count     bigint not null default 0,
    primary key (stat_date, device)
);
