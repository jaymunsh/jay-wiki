-- 결제 상태의 읽기 전용 사본.
--
-- 이름이 설계의 일부다. 이 테이블은 "결제의 상태" 가 아니라
-- **"우리가 마지막으로 들은 결제의 상태"** 다. 원본은 payment-api 가 든다.
--
-- 유니크는 order_id 에 건다. 화면 조회가 주문 기준이라(OrderSagaSteps.view()),
-- 한 주문에 사본이 둘 생기면 어느 쪽을 보여줄지 정할 수 없다.

create table if not exists public.tb_payment_projection (
    order_id text primary key,
    payment_id text not null,
    status text not null,
    -- 원본에서 그 사실이 일어난 시각. 이벤트가 순서 없이 와도 과거로 안 되돌아가게 하는 근거다.
    occurred_at timestamptz not null,
    -- 우리가 받은 시각. 화면에 "n초 전 기준" 을 적으려고 든다.
    observed_at timestamptz not null
);

create index if not exists ix_payment_projection_payment on public.tb_payment_projection (payment_id);
