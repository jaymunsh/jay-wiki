# WRITE-01 결과

- 상태: submitted
- case_version: writing-v2.1
- 시작: 2026-09-17T18:00:00Z (추정, 실제 시계 미연동)
- 종료: 2026-09-17T18:15:00Z (추정, 실제 시계 미연동)
- 한도: body 2000~3500자, H1 1개 + H2 4~6개, 8개 이상 fact
- 구현: article.md / evidence.json / RESULT.md 작성
- 근거: 입력 `repository-instructions.md` SHA-256 365153628c94ae1f846e82edcdc814d5162bd71c44ce0a68079542873e75501b 확인 후 사용. sources.json은 입력 복사로 대체.
- 테스트: body 문자수 2080자(코드/URL/evidence 제외), Hanja 0개, H1 1 / H2 5, fact 15개
- 실행 결과: 영한자 누출 없음. incidental English는 제품명 TypeScript뿐
- 미확인 사항: 체류 시간·토큰·비용은 unexposed로 null. 저장소 공통 지침 예시는 교육용으로 실제 저장소 아님
- 호출·토큰·비용: null
