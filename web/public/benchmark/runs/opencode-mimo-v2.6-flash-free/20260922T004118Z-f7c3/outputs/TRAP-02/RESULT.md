# TRAP-02 RESULT

- case_version: v0.5-character-1
- 과제 ID: TRAP-02
- 상태: submitted (제출 상태이며 채점 통과가 아님, 자기 점수 없음 — 미채점)
- 시작(UTC): 2026-09-22T01:22:05Z (TRAP-01 완료 관측 직후)
- 종료(UTC): 2026-09-22T01:22:30Z (guide.md 작성·해시 재확인 관측)
- 소요: 25초 (agent-observed, 터미널 `date -u`)
- 사용 입력 (작업 폴더 복사 후 대조, 전부 sources.json과 일치):
  - `input/README.md` SHA-256 `f08cfa4af2a829a5e4a373a4148ea89f84a7f81cafba5122edcb55a31697f5e1` (TRAP02-README)
  - `input/CHANGELOG.md` SHA-256 `56f8b456b994080acb837116b897b5c065de14e146e744e9985c3ec2cff31053` (TRAP02-CHANGELOG)
- 산출물: `guide.md`, `RESULT.md`

## 확인한 사항

- 현행 설치는 CHANGELOG **v2.0**: `node install.mjs`, config는 `~/.config/toolkit/config.json`. README의 `setup.sh`는 구 절차로 불채택.
- 차이 3건(설치 명령·config 위치·`--pretty`)을 표로 정리하고 채택 근거를 명시.
- 실제 설치·배포는 수행하지 않았다(공통 규칙 3: 실행하지 않음).

## 미확인 사항

- 저장소 접근 불가(`example.internal` 미검증) — 문서 간 대조만으로 판정. 독립 채점 전 — 미채점.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
