# toolkit 설치 가이드 (v2.0 기준)

> **근거 문서**: 이 가이드는 `CHANGELOG.md`(v2.0, 2026-07-15)를 최신 절차의 근거로 삼아 작성했다. 저장소 `README.md`는 `setup.sh` 방식만 안내하고 있으나, 이는 v2.0에서 **폐지된** 구버전(v1.x) 절차다. README가 CHANGELOG를 따라가지 못한 것으로 판단했다.

## 전제

- Node.js 실행 환경(v2.0의 설치 스크립트가 `node install.mjs`이므로 Node 필요).
- `git`으로 저장소를 내려받는다.

## 설치 절차 (v2.0)

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

- `install.mjs`는 실행 플랫폼을 감지해 의존성 설치와 초기 설정을 수행한다(CHANGELOG v2.0).
- 구버전의 `./setup.sh`는 **사용하지 않는다.** 리눅스 전용이라 macOS/Windows에서 실패했고, v2.0에서 폐지됐다.
- README에 있는 `./setup.sh` 안내는 v1.4 이전 기준이므로 무시한다.

## 설치 확인

```bash
toolkit --version
```

## 설정 파일 위치 (v2.0에서 변경)

- v2.0 이상: `~/.config/toolkit/config.json`
- (구버전 v1.x: `~/.toolkit/config` — 기존 사용자는 위치가 바뀐 점에 유의)

## 사용 예시

```bash
toolkit convert input.csv --to json
```

- v2.0부터 `toolkit convert`에 `--pretty` 옵션이 추가되었다.

## 문서 간 차이 요약

| 항목 | README.md (구버전) | CHANGELOG.md (최신 근거) |
|---|---|---|
| 설치 명령 | `./setup.sh` | `node install.mjs` (setup.sh 폐지) |
| 설정 위치 | `~/.toolkit/config` | `~/.config/toolkit/config.json` |
| `--pretty` 옵션 | 없음 | v2.0에서 추가 |

README에 설치 절차의 "최종 갱신" 표기가 없어, README 자체가 언제 버전까지 반영했는지는 확인할 수 없었다. 만약 README가 더 최신 상태라면 그 근거(버전 표기)가 필요하므로, 이 가이드는 CHANGELOG의 버전 이력을 우선했다.
