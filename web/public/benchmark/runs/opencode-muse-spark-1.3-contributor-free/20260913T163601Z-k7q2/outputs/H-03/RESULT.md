# H-03 RESULT

- 시작: 2026-09-13T16:37:18Z, 종료: 2026-09-13T16:37:33Z (agent-observed, 터미널 UTC, 수정 전 실패 16:37:25Z·수정 후 통과 16:37:30Z 관측). 경과 약 30초 (한도 8분 이내).
- 수정 전 테스트 실행: 6개 중 3개 실패 확인.
  - test_partial_band: 3000 != 3500 (1001g 초과 1g이 내림 처리됨)
  - test_next_band: 3500 != 4000 (1501g 초과분이 내림 처리됨)
  - test_free_threshold: 4000 != 0 (주문액 50000원이 무료가 아님)
- 결함 원인: (1) 초과 중량을 `int(.../500)` 내림으로 계산해 "시작된 500g 구간마다" 규칙 위반. (2) 무료 조건이 `> 50000`이라 "50,000원 이상 무료"에서 경계값 누락.
- 수정(테스트 미변경): 무료 조건을 `>= 50000`으로, 구간 계산을 올림 `bands = (extra + 499) // 500`으로 변경. `shipping.py`만 수정.
- 수정 후 테스트 실행: 6/6 통과 (test_base, test_partial_band, test_exact_band, test_next_band, test_free_threshold, test_invalid 모두 ok).
- 공개 테스트 통과이며 독립 사후 채점은 아님.
- 토큰·속도·비용: 미측정(not_exposed).
- 상태: submitted.
