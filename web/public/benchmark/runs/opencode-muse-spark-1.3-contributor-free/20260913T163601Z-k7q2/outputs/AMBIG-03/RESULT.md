# AMBIG-03 RESULT

- case_version: v0.5-character-1. 시작: 2026-09-15T19:59:18Z, 종료: 2026-09-15T19:59:59Z (agent-observed, 터미널 UTC). 경과 약 40초 (한도 15분 이내).
- 사용 입력: ambig03-spec.md (SHA-256 f5829aee…89625, sources.json과 일치, 검증됨).
- 산출물: solution.mjs, assumptions.md, RESULT.md.
- 확인한 동작(node 실행): 일시 오류(503) 2회 후 성공. 영구 오류(403) 즉시 실패(1회 시도). 미분류 오류 연속 실패 시 3회 상한 후 throw. 관측 이벤트 기록됨.
- 판단: §3 상한 우선·§7은 시도·예산 내 계속으로 해석. 분류 기준·기본값·예산·중단 조건·멱등 키·관측 방식의 근거는 assumptions.md.
- 미확인 사항: 미분류 오류의 오분류 가능성, 실제 게이트웨이 연동·5초 예산 경계 실측. 독립 채점의 별도 검증을 통과했다고 주장하지 않음.
- 토큰·속도·비용: 미측정(not_exposed, 플랫폼 미제공).
- 상태: submitted (미채점).
