-- 결제 상태의 원본이 모놀리스를 떠났다(docs/2026-08-17-msa-data-ownership-design.md).
--
-- 원본은 pg-services 의 payment DB 에 있는 tb_payment 이고, 화면이 읽는 것은
-- 이벤트로 채우는 사본 tb_payment_projection 이다. 이 표는 이제 아무도 안 쓴다.
--
-- 남겨 두면 "여기도 결제 상태가 있다" 가 되어 다음 사람이 조인한다. 소유권을 문서가 아니라
-- 구조로 만드는 것이 이 설계의 목적이라 지운다. 되돌릴 일이 생기면 백업에서 꺼낸다
-- (분리 직전 사본: .local-backups/pre-4d-*).
drop table if exists public.tb_saga_payment;
