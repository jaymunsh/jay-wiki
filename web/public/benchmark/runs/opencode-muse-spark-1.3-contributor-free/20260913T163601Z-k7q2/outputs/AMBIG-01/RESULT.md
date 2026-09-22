# AMBIG-01 RESULT

- case_version: v0.5-character-1. 시작: 2026-09-15T19:58:12Z, 종료: 2026-09-15T20:00:30Z (agent-observed, 터미널 UTC). 경과 약 150초 (한도 15분 이내).
- 고정 입력: 없음.
- 산출물: solution.mjs, assumptions.md, RESULT.md.
- 확인한 동작(node 실행): 0분·30분 0원, 31분·40분 500원, 41분 1000원, 10시간 15000원 상한, 파싱 불가·출차<입차 RangeError.
- 판단: 올림 과금·30분 포함·UTC 달력일별 상한·무료분은 입차일부터 소진·0분은 0원. 근거는 assumptions.md.
- 미확인 사항: 달력일 vs 롤링 24시간 해석은 명세에 없어 선택 문제로 남김. 독립 채점의 별도 검증을 통과했다고 주장하지 않음.
- 토큰·속도·비용: 미측정(not_exposed, 플랫폼 미제공).
- 상태: submitted (미채점).
