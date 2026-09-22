# toolkit 설치 절차 (현재 버전 v2.0 기준)

## 근거가 되는 문서

**최신 절차를 결정하는 근거는 `CHANGELOG.md`**다. CHANGELOG는 v2.0(2026-07-15)에서 설치 방식이 변경되었음을 공식 기록한다. `README.md`는 아직 변경되지 않은 상태(구 절차 유지)로, 현재 버전을 반영하지 못한다. 따라서 **현재 버전 = v2.0**으로 보고 아래 절차를 따른다.

## 설치 절차 (v2.0)

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

1. 저장소를 복제한다.
2. 프로젝트 폴더로 이동한다.
3. **`node install.mjs`**로 의존성과 초기 설정을 수행한다. `install.mjs`는 플랫폼(macOS/Windows/Linux)을 감지한다.
4. `toolkit --version`으로 설치를 확인한다.

## 참고 (v2.0 변경사항)

- 초기 설정 파일 위치: `~/.toolkit/config` → **`~/.config/toolkit/config.json`**로 이동.
- `toolkit convert`에 `--pretty` 옵션 추가.

## 문서 간 차이 (주의)

- `README.md`는 `./setup.sh`로 설치하라고 되어 있으나, 이는 **구버전(v1.x) 절차**다.
- `CHANGELOG.md` v2.0은 `setup.sh`를 **폐지**하고 `node install.mjs`로 교체했다고 명시한다. 근거: `setup.sh`는 리눅스 전용이라 macOS/Windows에서 실패했기 때문이다.
- 따라서 본 절차는 `setup.sh`가 아니라 `node install.mjs`를 사용한다.
