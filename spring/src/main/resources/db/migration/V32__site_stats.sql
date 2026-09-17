-- ============================================================
-- V32: 유입 통계를 블로그 전용에서 사이트 공용으로 넓힌다
--
--   1) 세 집계 테이블을 tb_site_* 로 바꾸고 site 열을 기본키에 넣는다.
--      위키(portfolio.leneu.cloud)도 같은 표에 쌓기 위해서다. 위키용 표를 따로 만들면
--      같은 모양의 표와 같은 질의가 두 벌이 되고, 두 벌은 반드시 갈라진다.
--      이미 쌓인 행은 전부 블로그 것이므로 site 기본값을 'blog' 로 채운다.
--
--   2) ref_internal 열을 더한다. 지금까지 사이트 안에서의 이동(목록 -> 글)은 referer 가
--      자기 호스트라서 ref_other 로 쌓였다. 안에서 도는 횟수가 밖에서 오는 횟수보다
--      훨씬 많으므로 ref_other 는 사실상 외부 유입을 뜻하지 못했다.
--      지난 값은 되살릴 수 없다 -- 원본 referer 를 저장하지 않기 때문이다. 이 시점부터 갈린다.
--
--   3) tb_blog_comment.source -- 댓글 쓴 사람이 애초에 어디서 들어왔는지.
--      댓글 POST 의 referer 는 그 글 자신이라 그 시점엔 유입 경로가 이미 사라져 있다.
--      그래서 첫 방문 때 세션 쿠키에 담아 둔 유입 호스트를 여기로 옮긴다.
--      쿠키는 브라우저를 닫으면 사라지고, 저장하는 것은 분류된 소스 이름 하나뿐이다.
--      원본 URL 도 개인 식별자도 새로 만들지 않는다.
-- ============================================================

alter table public.tb_blog_daily_stat     rename to tb_site_daily_stat;
alter table public.tb_blog_referrer_daily rename to tb_site_referrer_daily;
alter table public.tb_blog_device_daily   rename to tb_site_device_daily;

-- 테이블 이름을 바꿔도 제약 이름은 따라오지 않는다. 옛 이름으로 지운다.
alter table public.tb_site_daily_stat
    add column if not exists site text not null default 'blog',
    add column if not exists ref_internal bigint not null default 0,
    drop constraint tb_blog_daily_stat_pkey,
    add primary key (site, stat_date);

alter table public.tb_site_referrer_daily
    add column if not exists site text not null default 'blog',
    drop constraint tb_blog_referrer_daily_pkey,
    add primary key (site, stat_date, source);

alter table public.tb_site_device_daily
    add column if not exists site text not null default 'blog',
    drop constraint tb_blog_device_daily_pkey,
    add primary key (site, stat_date, device);

alter table public.tb_blog_comment
    add column if not exists source text;
