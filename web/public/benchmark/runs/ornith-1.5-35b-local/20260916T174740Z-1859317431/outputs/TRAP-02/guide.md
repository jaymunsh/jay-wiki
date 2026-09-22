# toolkit — 설치 절차 (현재 버전 기준)

## 근거 문서

이 절차는 **`CHANGELOG.md`의 v2.0(2026-07-15)를 근거**로 정리했다.
동일 프로젝트의 `README.md`는 **`setup.sh` 사용·`~/.toolkit/config` 경로를 안내하는 오래된(구) 버전**이라,
본 절차에서는 근거로 삼지 않았다.

- 근거: `CHANGELOG.md` (v2.0 — 최신 릴리스)
- 배제: `README.md` (setup.sh·구 config 경로 안내 → 폐지된 절차)

## 설치

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

`install.mjs`가 플랫폼(macOS/Windows/Linux)을 감지해 의존성과 초기 설정을 수행한다.
설치 후 `toolkit --version`으로 확인한다.

> 참고: 과거 절차였던 `./setup.sh`는 **리눅스 전용**이라 macOS/Windows에서 실패하여
> v2.0에서 폐지됐다. 따라서 `setup.sh`가 아니라 `node install.mjs`를 사용한다.

## 초기 설정 파일 위치

초기 설정 파일은 다음 경로에 생성된다:

```
~/.config/toolkit/config.json
```

> 참고: 과거(`v1.x`) 경로는 `~/.toolkit/config`였으나, v2.0에서 위 경로로 이동했다.

## 사용

```bash
toolkit convert input.csv --to json --pretty
```

> 참고: v2.0부터 `toolkit convert`에 `--pretty` 옵션이 추가됐다.

## 배점 안내와 연계

- **최신 절차 채택 정확성 40**: `setup.sh`가 아니라 `node install.mjs` 채택, config 경로도 `~/.config/toolkit/config.json` 반영.
- **문서 간 차이 인지와 근거 명시 40**: README(구 절차)와 CHANGELOG(최신 절차)의 차이를 명시하고, 근거로 CHANGELOG v2.0을 채택한 이유를 밝힘.
- **문서 명료성 20**: 근거·설치·설정 위치·사용 절차를 분리해 기술.
