-- 배송 상태의 읽기 전용 사본. V26(결제)과 같은 이유로 같은 모양이다.
--
-- 이 테이블은 "배송의 상태" 가 아니라 **"우리가 마지막으로 들은 배송의 상태"** 다.
-- 원본은 shipping-api 가 pg-services 의 shipping DB 에 든다.

create table if not exists public.tb_shipping_projection (
    order_id text primary key,
    shipment_id text not null,
    status text not null,
    -- 원본에서 그 사실이 일어난 시각. 이벤트가 순서 없이 와도 과거로 안 되돌아가게 하는 근거다.
    occurred_at timestamptz not null,
    -- 우리가 받은 시각. 화면에 "n초 전 기준" 을 적으려고 든다.
    observed_at timestamptz not null
);

create index if not exists ix_shipping_projection_shipment on public.tb_shipping_projection (shipment_id);
