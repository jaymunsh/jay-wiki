-- 글쓴이가 지정하는 시리즈 연결. 이어서 쓴 글끼리 잇는다.
--
-- 이미 있는 '이전/다음 글'(BlogPostService.neighbors)과 다르다. 그건 발행일 순서라
-- 22번의 다음이 23번이지만, 실제로 22번을 쓰고 이어서 쓴 글은 37번일 수 있다.
-- 시간순 이웃으로는 그 관계를 표현할 방법이 없어서 컬럼으로 들고 간다.
--
-- 양쪽을 다 둔다. 한쪽만 두고 반대 방향을 역조회하면 질의가 하나 늘고,
-- 무엇보다 관리 화면에서 '이 글의 다음'을 직접 고르는 조작이 자연스럽지 않다.
-- 대신 어긋난 상태를 만들지 않는 책임을 서비스가 진다 -- BlogPostService.applySeriesLinks 가
-- 한쪽을 쓸 때 상대의 반대편도 함께 맞춘다.
alter table public.tb_blog_post
    add column if not exists prev_post_id bigint,
    add column if not exists next_post_id bigint;

-- 가리키던 글이 지워지면 링크만 풀린다. 글까지 따라 지우면 안 된다.
alter table public.tb_blog_post
    add constraint fk_blog_post_prev foreign key (prev_post_id)
        references public.tb_blog_post (id) on delete set null;
alter table public.tb_blog_post
    add constraint fk_blog_post_next foreign key (next_post_id)
        references public.tb_blog_post (id) on delete set null;

-- 자기 자신을 앞이나 뒤로 가리키면 화면이 같은 글로 도는 링크를 그린다.
alter table public.tb_blog_post
    add constraint chk_blog_post_series_self check (
        (prev_post_id is null or prev_post_id <> id)
        and (next_post_id is null or next_post_id <> id));
