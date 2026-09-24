-- ============================================================
-- V36: 게임 랭킹. game.leneu.cloud 의 한 장짜리 게임들이 같은 표를 나눠 쓴다.
--
--   game 열로 게임을 가른다. 게임마다 표를 따로 만들면 V32 에서 본 대로
--   같은 모양의 표와 같은 질의가 게임 수만큼 생기고 둘은 반드시 갈라진다.
--
--   댓글과 같은 익명 쓰기다 -- 원본 IP 는 두지 않고 차단용 salted hash 만 남긴다.
--   deleted_at 은 이상 기록을 숨길 때 쓰는 휴지통 표시다. 관리 화면은 아직 없다.
-- ============================================================

create table public.tb_game_score (
    id          bigint generated always as identity primary key,
    game        text        not null,
    name        text        not null,
    time_ms     integer     not null,
    ip_hash     text,
    source      text,
    created_at  timestamptz not null default now(),
    deleted_at  timestamptz
);

-- 랭킹 조회는 (game, time_ms) 순서만 보면 된다. 지운 행은 애초에 색인에 넣지 않는다.
create index ix_game_score_board
    on public.tb_game_score (game, time_ms)
    where deleted_at is null;
