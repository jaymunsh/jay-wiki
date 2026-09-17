-- ============================================================
-- V13: 블로그 (blog.leneu.cloud)
--   위키(tb_article)와 분리된 개인 글 저장소.
--   시드와 revision 을 두지 않는다. 원본은 이 테이블이고 안전망은 pg_dump 전체 백업이다.
--   카테고리는 최대 2단. 깊이 제약은 애플리케이션에서 강제한다(자기참조 깊이를 CHECK 로
--   표현하기 어렵고, 규칙이 코드에 있어야 오류 메시지를 낼 수 있다).
-- ============================================================

create table if not exists public.tb_blog_category (
    id          bigserial primary key,
    slug        text not null unique,            -- 영어. URL 에 그대로 쓴다
    name        text not null,                   -- 화면 표시명
    description text,
    parent_id   bigint references public.tb_blog_category(id) on delete restrict,
    sort_order  int  not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists idx_blog_category_parent
    on public.tb_blog_category (parent_id, sort_order);

create table if not exists public.tb_blog_post (
    id             bigserial primary key,        -- URL 의 숫자 id
    slug           text not null,                -- URL 뒤에 붙는 읽기용. 유일하지 않아도 된다
    category_id    bigint not null references public.tb_blog_category(id) on delete restrict,
    title          text not null,
    summary        text,
    body           text not null,
    cover_asset_id text,                         -- tb_article_asset.id. FK 없이 문자열로만 참조
    status         text not null default 'draft' check (status in ('draft', 'published')),
    published_at   timestamptz,
    -- published 는 published_at 이 있어야 한다. null 이면 정렬/이웃 쿼리에서 상태가 애매해진다.
    constraint chk_blog_post_published_at check (status <> 'published' or published_at is not null),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_blog_post_published
    on public.tb_blog_post (status, published_at desc);
create index if not exists idx_blog_post_category
    on public.tb_blog_post (category_id, published_at desc);

create table if not exists public.tb_blog_tag (
    id   bigserial primary key,
    name text not null unique
);

create table if not exists public.tb_blog_post_tag (
    post_id bigint not null references public.tb_blog_post(id) on delete cascade,
    tag_id  bigint not null references public.tb_blog_tag(id)  on delete cascade,
    primary key (post_id, tag_id)
);

create index if not exists idx_blog_post_tag_tag
    on public.tb_blog_post_tag (tag_id, post_id);

create table if not exists public.tb_blog_comment (
    id            bigserial primary key,
    post_id       bigint not null references public.tb_blog_post(id) on delete cascade,
    author_name   text not null,
    password_hash text not null,                 -- BCrypt. 본인 삭제용
    body          text not null,
    ip_prefix     text not null,                 -- 표시용 앞 2옥텟. 예: 121.135
    ip_hash       text not null,                 -- 원본 IP + salt 의 hash. 원본은 저장하지 않는다
    created_at    timestamptz not null default now(),
    deleted_at    timestamptz
);

create index if not exists idx_blog_comment_post
    on public.tb_blog_comment (post_id, created_at);

-- 위키 LAB 탭과 같은 이름의 카테고리로 시작한다. 이관 대상이 이 넷이다.
insert into public.tb_blog_category (slug, name, description, sort_order) values
    ('personal-projects', '개인 프로젝트', '혼자 만들고 혼자 쓰는 것들.', 0),
    ('team-projects',     '팀 프로젝트',   '여럿이 만든 것과 그때 배운 것.', 1),
    ('tech-lab',          '기술 실험',     '재보고 확인한 기록.', 2),
    ('tools-workflow',    '도구·워크플로', '쓰는 도구와 일하는 방식.', 3)
on conflict (slug) do nothing;
