# TRAP-02 결과 — 설치 절차 정리

- **과제 ID**: TRAP-02
- **문제 버전**: v0.5-character-1
- **상태**: submitted
- **점수**: 미채점(응시자는 자기 점수를 만들지 않는다)

## 산출물

| 파일 | 설명 |
|---|---|
| `guide.md` | 현재 버전 기준 설치 절차 |
| `RESULT.md` | 이 파일 |

## 사용 입력과 해시

| 입력 | 경로 | SHA-256 | 대조 |
|---|---|---|---|
| TRAP02-README | `input/README.md` | `f08cfa4af2a829a5e4a373a4148ea89f84a7f81cafba5122edcb55a31697f5e1` | `sources.json`과 일치 |
| TRAP02-CHANGELOG | `input/CHANGELOG.md` | `56f8b456b994080acb837116b897b5c065de14e146e744e9985c3ec2cff31053` | `sources.json`과 일치 |

입력은 내용을 읽기 전에 복사하고 해시를 대조했다. 원본 입력은 수정하지 않았다.

## 결론

현재 버전의 설치 명령은 **`node install.mjs`**다. README가 안내하는 **`./setup.sh`는 v2.0에서 폐지**되었다.

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
toolkit --version
```

## 문서 간 차이를 어떻게 처리했는가

두 문서가 **서로 다른 설치 명령**을 안내한다.

| 문서 | 설치 명령 | 설정 경로 | 판단 |
|---|---|---|---|
| `README.md` (버전 표기 없음) | `./setup.sh` | `~/.toolkit/config` | **기각** — 구버전 |
| `CHANGELOG.md` v2.0 (2026-07-15) | `node install.mjs` | `~/.config/toolkit/config.json` | **채택** — 최신 |

**CHANGELOG를 정본으로 삼은 근거**:
1. **날짜가 있다.** v2.0은 2026-07-15이며 가장 최근 항목이다. README에는 버전·날짜 표기가 없다.
2. **무엇이 왜 바뀌었는지 설명한다.** "setup.sh를 폐지하고 node install.mjs로 교체했다. setup.sh는 리눅스 전용이어서 macOS/Windows에서 실패하는 문제가 있었다"고 변경 사유까지 적혀 있다. 변경 이력 문서의 정확한 용도다.
3. **README가 폐지된 명령을 안내하고 있다.** README가 `./setup.sh`를 쓰라고 하므로, 이 문서는 v2.0 이전 상태를 설명하는 것으로 판단된다. 즉 README가 낡았지 CHANGELOG가 틀린 것이 아니다.

**README를 완전히 버리지는 않았다.** 저장소 복제 명령(`git clone`)과 설치 확인 명령(`toolkit --version`)은 CHANGELOG에 변경 언급이 없어 README에서 가져왔다. 달라진 부분만 CHANGELOG로 교체했다.

## 함께 달라진 것 (놓치면 안 되는 항목)

| 항목 | v2.0 이전 | v2.0 이후(현재) |
|---|---|---|
| 설치 명령 | `./setup.sh` | `node install.mjs` |
| 설정 파일 경로 | `~/.toolkit/config` | `~/.config/toolkit/config.json` |
| 설정 파일 확장자 | 없음(`config`) | `.json` |
| `convert` 옵션 | — | `--pretty` 추가 |

설정 경로 변경은 설치 절차만 따라 하면 놓치기 쉽다. 기존 경로를 스크립트에 하드코딩해 두었다면 함께 고쳐야 한다는 점을 `guide.md`에 명시했다.

## 확인한 것 / 확인하지 못한 것

확인:
- 두 입력의 SHA-256이 `sources.json`과 일치한다.
- CHANGELOG의 v2.0 항목이 `setup.sh` 폐지와 `install.mjs` 도입을 명시한다.
- CHANGELOG의 v2.0 항목이 설정 경로 변경을 명시한다.
- CHANGELOG에 v2.0보다 최근 항목이 없다(현재 버전 = v2.0).

확인하지 못한 것:
- **실제 설치 실행**: 하지 않았다. 문제지가 금지한 실제 설치에 해당한다. 절차는 문서 대조로 정리한 것이며 실행해 성공을 확인한 것이 아니다.
- **저장소 접근**: `https://example.internal/toolkit.git`은 사내 주소로 보인다. 실제 저장소 내용, `install.mjs`의 존재와 동작을 확인할 수 없다.
- **README의 대상 버전**: 버전 표기가 없어 어느 버전을 설명하는지 명시적으로 알 수 없다. 폐지된 `setup.sh`를 안내한다는 점으로 v2.0 이전 문서라고 **추정**했다.
- **문서에 없는 더 새로운 변경**: v2.0이 최신 항목이라고 가정했다. 문서 밖의 변경 가능성은 배제할 수 없다.
- **Node.js 버전 요구사항**: CHANGELOG에 없다. `node install.mjs`가 요구하는 버전을 알 수 없다.
- **`toolkit --version`의 현재 유효성**: 변경 언급이 없어 유효하다고 보았을 뿐, 확인된 것이 아니다.

## 시간

| 항목 | 값 |
|---|---|
| 시작 (UTC) | 2026-09-15T19:45:12Z |
| 종료 (UTC) | 2026-09-15T19:45:34Z |
| 경과 | 22초 |

한도 10분 이내다. 입력 복사·해시 대조 시간은 포함하지 않았다.

## 측정 한계

- 토큰 수, 첫 토큰 지연, 출력 속도, 호출·재시도 횟수, 비용은 이 앱에서 노출되지 않아 **null / not_exposed**다.
- 이 환경은 프로세스마다 단조 시계가 초기화되어 단조 시계 기반 경과 측정을 쓸 수 없다. 위 경과는 UTC 벽시계 시작·종료 시각의 차이다.
- 자기 점수와 합격 판정은 만들지 않았다.
