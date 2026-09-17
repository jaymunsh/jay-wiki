-- ============================================================
-- V4: 게시판(public.tb_post/comment) + 10만 건 시드
--   완성가이드 §8 / 워크북 04. 게시판 SoT = PostgreSQL.
--   목표: 대량 데이터 페이징 + 익명 작성 + 조회수(Redis).
--   * 익명 글: author_type='anonymous', 게스트 닉네임 + 선택적 비밀번호(BCrypt)
--   * 조회수: 실시간 증가는 Redis INCR, 여기 views 는 '누적 기저값'(나중에 배치로 flush)
-- ============================================================

-- 도메인 테이블은 전부 public 로 통합(과설계 금지 결정, 2026-07-01).

-- 1) 게시글
create table if not exists public.tb_post (
    id            bigserial primary key,
    title         text not null,
    content       text not null,
    author_type   text not null default 'anonymous',  -- anonymous / user(로그인, 10에서)
    author_name   text not null,                       -- 게스트 닉네임 또는 로그인 닉네임
    password_hash text,                                -- 익명 글 본인 삭제용 BCrypt (없으면 관리자만 삭제)
    views         int  not null default 0,             -- 누적 기저(실시간은 Redis)
    comment_count int  not null default 0,             -- 댓글 수(비정규화 — 목록 빠르게)
    created_at    timestamptz not null default now()
);

-- 목록은 최신순(id desc) 페이징 → 커버링 인덱스
create index if not exists idx_post_id_desc on public.tb_post (id desc);

-- 2) 댓글 (글 삭제 시 함께 삭제)
create table if not exists public.tb_comment (
    id          bigserial primary key,
    post_id     bigint not null references public.tb_post(id) on delete cascade,
    content     text not null,
    author_type text not null default 'anonymous',
    author_name text not null,
    created_at  timestamptz not null default now()
);

create index if not exists idx_comment_post on public.tb_comment (post_id, id);

-- 3) 시드 10만 건 (generate_series 한 방)
--   created_at 은 전부 과거로 흩뿌림 → 이후 사용자가 쓰는 실제 글(now())이 목록 맨 앞에 온다.
--   views 는 0~499 랜덤으로 목록에 변화를 준다.
insert into public.tb_post (title, content, author_name, author_type, views, created_at)
select
    '샘플 게시글 #' || g,
    E'페이징/부하 테스트용 시드 데이터입니다.\n글 번호 ' || g || ' — 10만 건 중 하나. 커서/오프셋 페이징과 조회수(Redis)를 시연합니다.',
    '익명' || lpad((g % 1000)::text, 3, '0'),
    'anonymous',
    (random() * 500)::int,
    now() - ((g % 43200) || ' minutes')::interval    -- 최근 30일 안쪽으로 분산
from generate_series(1, 100000) g;
