-- ============================================================
-- V3: 계정(public.tb_user) + 최초 관리자 1명 시드
--   가벼운 관리자 로그인 (Spring Security + JWT). 나중에 OAuth 확장 대비.
--   * 비번은 BCrypt 해시로 저장 (평문 저장 금지)
--   * 시드 관리자: admin / admin1234  (배포 전 반드시 변경)
-- ============================================================

-- 도메인 테이블은 전부 public 로 통합(과설계 금지 결정, 2026-07-01). public 은 항상 존재.
create table if not exists public.tb_user (
    id          bigserial primary key,
    username    text not null unique,       -- 로그인 아이디
    password    text,                        -- BCrypt 해시 (OAuth 사용자는 null 가능)
    nickname    text,
    role        text not null default 'USER',-- ADMIN / USER
    provider    text not null default 'local',-- local / google ...
    subject     text,                        -- OAuth subject (local 은 null)
    email       text,
    created_at  timestamptz not null default now()
);

create unique index if not exists idx_user_provider_subject
    on public.tb_user (provider, subject) where subject is not null;

-- 최초 관리자 (username=admin, password=admin1234 의 BCrypt 해시)
insert into public.tb_user (username, password, nickname, role, provider)
values ('admin', '$2a$10$y8rGSi9nEK4ixrK21sJP7OAITE/O.dR2dg8FBpgDCK2GOVv6WESCu', '관리자', 'ADMIN', 'local')
on conflict (username) do nothing;
