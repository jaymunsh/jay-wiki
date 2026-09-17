-- ============================================================
-- V1: 위키 본문의 '파생 읽기모델' 테이블
--   원본(SoT)은 web/docs/*.md. 이 테이블은 검색/통계용 사본.
--   (완성가이드 §6 콘텐츠 모델 / §8 스키마)
--   * Flyway 규칙: 파일명 V<번호>__<설명>.sql, 한 번 적용되면 수정 금지(고치려면 V2 추가)
--   * 스키마 wiki 는 application.yml 의 flyway.schemas 로 Flyway가 생성
-- ============================================================

create table if not exists public.tb_article (
    slug         text primary key,            -- 문서 식별자 = 파일명 (redis, intro ...)
    parent_id    text not null,               -- 1차 탭(부모 폴더) (data, start ...)
    title        text not null,
    summary      text,
    body         text not null,               -- MD 본문 raw (검색 대상)
    kind         text not null default 'wiki',
    status       text not null default 'draft',
    tags         text,                        -- 슬라이스2는 콤마 문자열. 정규화는 게시판 단계에서
    last_review  date,
    synced_at    timestamptz not null default now()  -- 마지막 동기화 시각
);

-- 1차 탭별 + 공개 여부 조회 가속
create index if not exists idx_article_parent_status on public.tb_article (parent_id, status);

-- 슬라이스2의 검색은 LIKE 기반. trigram GIN 인덱스로 '%키워드%' 검색을 보조.
--   (LIKE vs GIN vs OpenSearch 비교 데모의 'GIN' 칸으로 워크북 03에서 재활용)
create extension if not exists pg_trgm;
create index if not exists idx_article_title_trgm on public.tb_article using gin (title gin_trgm_ops);
create index if not exists idx_article_body_trgm  on public.tb_article using gin (body  gin_trgm_ops);
