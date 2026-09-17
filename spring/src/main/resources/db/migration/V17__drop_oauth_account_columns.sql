-- ============================================================
-- V17: 구글 로그인 제거 (2026-08-06)
--   구글 계정 행을 지우고 OAuth 전용 컬럼(email, subject)을 드롭한다.
--   로컬 회원가입은 그대로 남는다 — 개인정보 처리 시나리오 재료로 쓰기 위해 의도적으로 유지.
--
--   tb_post 는 author_name 을 문자열로 복사해 두고 tb_user 를 가리키는 외래키가 없다.
--   그래서 계정 행을 지워도 기존 글은 깨지지 않는다.
-- ============================================================

-- 순서 주의: 행을 먼저 지우고 컬럼을 드롭한다.
delete from public.tb_user where provider = 'google';

-- provider+subject 유니크 인덱스는 subject 가 사라지므로 함께 정리한다.
drop index if exists public.idx_user_provider_subject;

alter table public.tb_user drop column if exists subject;
alter table public.tb_user drop column if exists email;
