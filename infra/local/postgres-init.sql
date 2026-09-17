-- ============================================================
-- 로컬 개발 PostgreSQL 최초 기동 시 1회 실행 (docker-entrypoint-initdb.d)
--
-- 스키마 정책(2026-07-01 결정, "과설계 금지"):
--   * 도메인 테이블(위키/게시판/계정/통계/감사)은 전부 public 로 통합.
--     이유: PG를 만지는 건 jaywiki 모놀리식 하나 + 계정 하나뿐 → 스키마 분리가 값을 못 함.
--     구분은 테이블 접두사 tb_ 로. (서비스/접근이 실제로 갈릴 때 그때 스키마 도입)
--   * batch 스키마만 예외로 유지 — Spring Batch 가 자기 메타테이블(BATCH_*)을 자동 생성.
--
-- 실제 테이블/인덱스는 Spring Flyway(V1__init.sql 등)가 public 에 만든다.
-- (DDL 은 Flyway 한 곳에서 관리해야 dev/prod 가 동일)
-- ============================================================

-- public 은 항상 존재하므로 도메인 스키마 생성 불필요.
CREATE SCHEMA IF NOT EXISTS batch;       -- Spring Batch 메타 (BATCH_*) — 유일한 별도 스키마
GRANT ALL ON SCHEMA batch TO portfolio;

-- 검색 보조용 확장 (LIKE vs GIN vs OpenSearch 비교 데모)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  RAISE NOTICE '✓ init done: domain tables → public (tb_ prefix), batch schema kept';
END $$;
