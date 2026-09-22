# toolkit 설치 절차 (현재 버전 기준)

## 설치

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

`install.mjs`가 플랫폼을 감지해 의존성 설치와 초기 설정을 수행한다. 설치 확인은 `toolkit --version`으로 한다.

- 초기 설정 파일 위치: `~/.config/toolkit/config.json` (v2.0부터)
- 사용 예: `toolkit convert input.csv --to json` (v2.0부터 `--pretty` 옵션 사용 가능)

## 근거 문서와 판단

**채택 근거: CHANGELOG.md (v2.0 — 2026-07-15)**

- CHANGELOG v2.0이 "`setup.sh`를 폐지하고 `node install.mjs`로 교체했다"고 명시한다. 사유는 setup.sh가 리눅스 전용이라 macOS/Windows에서 실패하는 문제.
- 같은 항목이 config 위치도 `~/.toolkit/config` → `~/.config/toolkit/config.json`으로 이동했음을 기록한다.

**배척한 정보: README.md의 `./setup.sh` 절차**

- README의 설치 절차는 `setup.sh` 기준으로, v2.0 이후에는 폐지된 옛 절차다. README가 아직 갱신되지 않은 것으로 판단했다.
- 판단 근거: CHANGELOG는 시점(2026-07-15)과 버전(v2.0)이 명시된 변경 기록이고, README에는 절차의 유효 버전 표기가 없다. 두 문서가 충돌할 때 **버전·날짜가 있는 최신 변경 기록**을 우선하는 것이 일반적이다.

## 문서 간 차이 요약

| 항목 | README (구) | CHANGELOG v2.0 (현재) |
|---|---|---|
| 설치 명령 | `./setup.sh` | `node install.mjs` |
| 지원 플랫폼 | 리눅스 중심 | 플랫폼 감지(크로스 플랫폼) |
| config 위치 | `~/.toolkit/config` | `~/.config/toolkit/config.json` |

주의: README 자체가 갱신되지 않았으므로, 저장소의 README만 보고 설치하면 폐지된 절차를 따르게 된다. README 수정을 프로젝트에 건의할 가치가 있다.
