-- ============================================================
-- V2: 위키 본문을 DB SoT 로 (탭 + 버전 + 이력)
--   완성가이드 §6/§8 (2026-06-28 결정: 본문 SoT = PostgreSQL)
--   * 1차 탭(카테고리)  = public.tb_tab
--   * 2차 문서          = public.tb_article (parent_id 가 tab 참조, +version/sort_order)
--   * 수정 이력         = public.tb_revision (수정 때마다 스냅샷)
-- ============================================================

-- 1) 1차 탭(카테고리)
create table if not exists public.tb_tab (
    tab_id      text primary key,            -- 식별자 (start, data ...)
    title       text not null,               -- 표시명 (0. 시작하기 ...)
    sort_order  int  not null default 0,     -- 탭 정렬(드래그)
    created_at  timestamptz not null default now()
);

-- 현재 사이트의 1차 카테고리 7종 시드 (web/src/data/wiki.ts 기준)
insert into public.tb_tab (tab_id, title, sort_order) values
    ('start',    '0. 시작하기',   0),
    ('infra',    '1. 인프라',     1),
    ('backend',  '2. 백엔드',     2),
    ('data',     '3. 데이터',     3),
    ('frontend', '4. 프론트엔드', 4),
    ('ops',      '5. 관측·운영',  5),
    ('demo',     '6. 시연·AI',    6)
on conflict (tab_id) do nothing;

-- 2) 문서 테이블 확장 (V1 의 public.tb_article 에 컬럼 추가)
alter table public.tb_article add column if not exists version    int not null default 1;
alter table public.tb_article add column if not exists sort_order int not null default 0;
alter table public.tb_article add column if not exists updated_at timestamptz not null default now();

-- parent_id 가 빈 문서(혹시 모를)를 위해 기본 탭 보정
update public.tb_article set parent_id = 'start' where parent_id is null or parent_id = '';

-- 3) 수정 이력 (revision)
create table if not exists public.tb_revision (
    id         bigserial primary key,
    slug       text not null,                -- 어떤 문서의 이력인가 (public.tb_article.slug)
    version    int  not null,                -- 그 시점의 버전 번호
    title      text,
    body       text,                         -- 그 시점의 본문 스냅샷
    editor     text,                         -- 작성자 (admin / oauth nickname)
    created_at timestamptz not null default now(),
    unique (slug, version)
);

create index if not exists idx_revision_slug on public.tb_revision (slug, version desc);
