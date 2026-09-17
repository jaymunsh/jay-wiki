-- 배송 상태의 원본이 모놀리스를 떠났다(docs/2026-08-17-msa-data-ownership-design.md 5단계).
--
-- 원본은 pg-services 의 shipping DB 에 있는 tb_shipping 이고, 화면이 읽는 것은
-- 이벤트로 채우는 사본 tb_shipping_projection 이다. 이 표는 이제 아무도 안 쓴다.
--
-- V27(결제)과 같은 이유로 남기지 않는다. 남겨 두면 "여기도 배송 상태가 있다" 가 되어
-- 다음 사람이 조인한다. 되돌릴 일이 생기면 백업에서 꺼낸다.
drop table if exists public.tb_saga_shipping;
