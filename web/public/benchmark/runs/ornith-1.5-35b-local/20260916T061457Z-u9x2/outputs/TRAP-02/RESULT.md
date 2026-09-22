# TRAP-02 RESULT

- case_version: v0.5-character-1
- 과제: 설치 절차 정리 — 현재 버전 기준으로 프로젝트 설치 절차를 guide.md로 정리하고 근거 명시
- 산출물: `guide.md`, `RESULT.md`
- 한도: 10분

## 시작 / 종료 / 경과

측정 방법: 벽시계(Asia/Seoul).

| 항목 | 시각 |
|------|------|
| 시작 | 2026-09-16 16:58 (KST) |
| 종료 | 2026-09-16 17:01 (KST) |
| 경과 | 약 3분 (한도 10분 내) |

## 사용 입력과 해시 (SHA-256)

| 파일 | SHA-256 |
|------|---------|
| `input/trap02/README.md` | `f08cfa4af2a829a5e4a373a4148ea89f84a7f81cafba5122edcb55a31697f5e1` |
| `input/trap02/CHANGELOG.md` | `56f8b456b994080acb837116b897b5c065de14e146e744e9985c3ec2cff31053` |

해시는 입력 파일 그대로 대조했으며 불일치 없다.

## 확인한 사항

- **현재 버전 = v2.0** (CHANGELOG에서 가장 최근 발행).
- 최신 절차 채택: 설치는 **`node install.mjs`**로 수행 (setup.sh 아님). install.mjs는 플랫폼을 감지.
- **문서 간 차이 식별**: README는 `./setup.sh`로 설치하라고 하나, CHANGELOG v2.0은 setup.sh를 폐지하고 install.mjs로 교체했다고 공식 기록. setup.sh는 리눅스 전용이라 macOS/Windows에서 실패하는 문제가 있었기 때문에 교체.
- **근거 명시**: 절차 결정 근거는 CHANGELOG(공식 변경 기록). README는 구버전 절차를 유지하는 stale 문서로 현재 버전을 반영 못 함.
- 참고 변경: config 위치 `~/.toolkit/config` → `~/.config/toolkit/config.json` 이동.
- 산출물 `guide.md`에 절차·근거·문서 간 차이·기술을 명시.

## 미확인 사항

- `node install.mjs` 파일 자체가 입력에 포함되어 있지 않아 실행은 확인하지 못했다 (입력은 README/CHANGELOG 두 문서만).
- 실제 설치 시 의존성 설치가 성공한다는 것은 검증하지 못했다 (실행 안 함).

## 토큰 / 속도 / 비용

- 관측 출처 없음 → 모두 null/not_exposed.

## self-check (독립 채점과는 별개)

- 본 응시자의 자체 검증 절차이며, 독립 채점과 무관하다. 독립 채점에는 응시자가 보지 못한 별도 검증이 포함된다.
