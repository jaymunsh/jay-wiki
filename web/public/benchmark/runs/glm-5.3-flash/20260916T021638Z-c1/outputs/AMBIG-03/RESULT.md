# AMBIG-03 RESULT.md

- 상태: submitted
- case_version: v0.5-character-1
- 시작: 2026-09-16T02:25:12Z / 종료: 2026-09-16T02:25:45Z (agent-observed)
- 수행: 명세서 구현(fetchWithPolicy: §3 최대 3회 우선, §2 오류 분류(status 기반), §4 백오프 200ms/2배/2s 상한, §7 대기 총합 5초 한도). 자체 테스트 7개 7/7 통과(run-output.txt).
- 판단 문서화: assumptions.md에서 명세 내 모순(§3 vs §7) 발견과 §3 우선 근거, 오류 분류 기준, 대기 총합 해석, 관측·멱등 키의 책임 분리 등 7개 판단 기록.
- 미확인: 명세 소유자 확인(모순 해소) 불가 — §3 우선은 구현자 판단임을 명시. 자체 테스트 통과는 독립 채점 통과가 아님.
- 토큰·속도·비용: not_exposed
