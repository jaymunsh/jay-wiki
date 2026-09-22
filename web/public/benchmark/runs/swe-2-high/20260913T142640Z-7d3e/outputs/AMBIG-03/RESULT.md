# AMBIG-03 RESULT

- case_version: v0.5-character-1
- task: 재시도 정책 명세서 구현
- start (UTC): 2026-09-15T19:22:35Z
- end (UTC): 2026-09-15T19:23:59Z
- duration: 약 84초 (한도 15분 내)
- 측정 방법: `date -u` wall-clock
- 사용 입력: `cases/v0.5-character/input/ambig03-spec.md`
  - sha256: `f5829aeec5418ce2aee75332f3540bbe93cfe7924709fec32afeaba05c589625` (sources.json의 AMBIG03-SPEC과 일치 확인)

## 확인한 동작 (node 직접 호출, 5건)

- 즉시 성공 시 반환값 그대로 전달
- 2회 일시 오류 후 성공 — 재시도 동작, 모든 시도에 동일 멱등 키 전달 확인
- 일시 오류(502) 지속 → 최대 3회 시도 후 `retry.exhausted` 기록하고 오류 throw, `retry.attempt` 로그 2건
- 영구 오류(403) → 재시도 없이 즉시 실패
- 429 → 일시 오류로 분류되어 재시도 후 성공

## 명세 해석 상 쟁점

- §3(최대 3회)과 §7(성공할 때까지)의 모순을 발견해 §3 우선으로 해석. 근거는 `assumptions.md`에 기록.

## 확인하지 못한 것

- 출제 의도가 §7 우선(사실상 5초 대기 예산 내 무제한)일 가능성
- 실제 배포 환경의 로그 수집 연동(기본 구현은 console JSON 로그)
- 토큰·속도·비용: not_exposed
