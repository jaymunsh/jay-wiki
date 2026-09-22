# AMBIG-02 RESULT

- case_version: v0.5-character-1. 시작: 2026-09-15T19:58:40Z, 종료: 2026-09-15T19:59:08Z (agent-observed, 터미널 UTC). 경과 약 60초 (한도 15분 이내).
- 고정 입력: 없음.
- 산출물: retry.mjs, assumptions.md, RESULT.md.
- 확인한 동작(node 실행): 2회 실패 후 성공 시 값 그대로 반환·3회 시도. 전부 실패 시 마지막 오류 그대로 throw(약 300ms 대기 포함). 비함수 인자 TypeError.
- 판단: 총 3회·지수 백오프(100ms~)·전체 오류 재시도·시도 횟수 인자 전달·마지막 오류 그대로. 근거는 assumptions.md.
- 미확인 사항: 영구 오류 구분·타임아웃·중단은 미지원으로 남김. 독립 채점의 별도 검증을 통과했다고 주장하지 않음.
- 토큰·속도·비용: 미측정(not_exposed, 플랫폼 미제공).
- 상태: submitted (미채점).
