-- Outbox relay 가 여러 개 돌 때 같은 행을 중복 발행하지 않도록 선점(claim) 단계를 넣는다.
-- 선점한 행은 status='CLAIMED' 가 되고, 발행에 성공하면 PUBLISHED, 실패하면 NEW 로 돌아간다.
--
-- claimed_at 이 필요한 이유: 선점한 뒤 발행 전에 프로세스가 죽으면 그 행은 CLAIMED 로 남는다.
-- 되돌려 줄 주체가 없으므로 영원히 발행되지 않는다. 그래서 "오래된 선점"을 판별할 시각이 있어야
-- 다음 relay 가 회수할 수 있다.
alter table public.tb_outbox_event
    add column if not exists claimed_at timestamptz;

-- 선점 조회가 매번 훑는 조건에 맞춘 부분 인덱스. 발행이 끝난 행(PUBLISHED)은 대상이 아니다.
create index if not exists idx_outbox_event_claimable
    on public.tb_outbox_event (aggregate_type, event_type, created_at)
    where status in ('NEW', 'CLAIMED');
