-- ============================================================
-- V5: 게시판 검색 비교(워크북 03B Phase 1) — PG 안에서 LIKE vs 전문검색(tsvector+GIN)
--   목적: 10만 건(tb_post) 위에서 "같은 검색어, 방식별 소요시간"을 보여주기.
--   * LIKE(ILIKE '%q%')  = 인덱스 없이 순차 스캔 → 대량에서 느림 (일부러 인덱스 안 붙임)
--   * tsvector + GIN     = 토큰화 전문검색 → 빠름
--   * (한글 형태소 분석은 Phase 2 의 OpenSearch+nori 에서. 여기 'simple' 은 공백 토큰화)
-- ============================================================

-- 전문검색 벡터(제목+본문). to_tsvector(config, text) 2-인자형은 IMMUTABLE → 생성컬럼 가능.
alter table public.tb_post
    add column if not exists tsv tsvector
    generated always as (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) stored;

-- 전문검색 가속용 GIN (LIKE 쪽은 의도적으로 인덱스 없음 → 대비군)
create index if not exists idx_post_tsv on public.tb_post using gin (tsv);
