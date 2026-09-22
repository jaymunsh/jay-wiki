# toolkit 최신 설치 안내서 (guide.md)

본 문서는 현재 최신 버전(v2.0)을 기준으로 한 `toolkit` 프로젝트의 공식 설치 절차와 설정 확인 방법을 정리한 가이드이다.

---

## 1. 최신 설치 절차 (v2.0 기준)

```bash
# 1. 저장소 복제 및 디렉터리 이동
git clone https://example.internal/toolkit.git
cd toolkit

# 2. 설치 스크립트 실행 (v2.0 공식 설치 방식)
node install.mjs

# 3. 설치 정상 완료 확인
toolkit --version
```

### 설치 동작 및 설정 파일 위치
- `node install.mjs`는 실행 중인 플랫폼(Linux, macOS, Windows)을 자동 감지하여 의존성을 설치하고 초기 설정을 구성한다.
- 설정 파일은 `~/.config/toolkit/config.json` 경로에 생성된다.

---

## 2. 문서 간 차이점 및 근거

본 가이드는 **`CHANGELOG.md` (v2.0, 2026-07-15 릴리스)**를 정본 근거로 삼아 작성되었다.

| 구분 | `README.md` (구버전 미갱신 문서) | `CHANGELOG.md` (v2.0 최신 내역) | 가이드 채택 및 판단 |
| :--- | :--- | :--- | :--- |
| **설치 스크립트** | `./setup.sh` 실행 안내 | `setup.sh` 폐지 및 `node install.mjs` 교체 | **`node install.mjs` 채택** (`setup.sh`는 폐지됨) |
| **플랫폼 지원** | Linux 한정 (셸 스크립트) | OS 감지 지원 (Linux, macOS, Windows) | 크로스 플랫폼 지원을 위해 Node 기반 스크립트 사용 |
| **설정 파일 위치** | `~/.toolkit/config` | `~/.config/toolkit/config.json` | **`~/.config/toolkit/config.json` 채택** |

### 판단 이유
`README.md`는 v2.0 릴리스 이후 최신 변경 사항이 반영되지 않은 채 방치된 구버전(Stale) 문서이다. 최신 변경 이력을 기록한 `CHANGELOG.md`에 명시된 대로 `setup.sh`는 공식 폐지되었으므로, 현재 버전에서 정상적으로 설치를 완료하려면 반드시 `node install.mjs`를 실행해야 한다.
