# toolkit — 현재 버전(v2.0) 설치 절차

## 근거 문서

- **CHANGELOG.md (v2.0, 2026-07-15)** — 최신 절차. `setup.sh` 폐지, config 위치 이동을 명시한 1차 근거.
- **README.md** — 프로젝트 개요·사용법 참고. 단, 설치 절차(§설치)는 v1.4 이전 상태라 **현행 절차로는 채택하지 않는다.**

## 설치 절차 (CHANGELOG v2.0 기준)

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

- `install.mjs`는 플랫폼을 감지해 의존성과 초기 설정을 수행한다(구 `setup.sh`는 리눅스 전용이라 macOS/Windows에서 실패해 폐지됨).
- 초기 config 위치: **`~/.config/toolkit/config.json`** (구 `~/.toolkit/config`에서 이동).
- 설치 확인: `toolkit --version` (README의 사용법 섹션은 현행과 충돌 없음).

## 사용 (README 기준, 현행 유지)

```bash
toolkit convert input.csv --to json        # v2.0에서 --pretty 옵션 추가됨
```

## 문서 간 차이 요약

| 항목 | README.md (구) | CHANGELOG.md v2.0 (현행) | 채택 |
|---|---|---|---|
| 설치 명령 | `./setup.sh` | `node install.mjs` | v2.0 |
| config | `~/.toolkit/config` | `~/.config/toolkit/config.json` | v2.0 |
| convert 옵션 | `--to json`만 | `--pretty` 추가 | v2.0 반영 |

README의 설치 섹션이 `setup.sh`를 안내하는 이유는 README가 v2.0 갱신 전 상태로 남아 있기 때문이며, 설치 방식 변경의 기록은 CHANGELOG v2.0에만 있다. **현재 버전 설치는 CHANGELOG를 따른다.**
