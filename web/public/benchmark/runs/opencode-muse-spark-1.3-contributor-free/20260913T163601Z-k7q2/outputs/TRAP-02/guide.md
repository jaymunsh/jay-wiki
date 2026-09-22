# toolkit 설치 절차 (현재 버전 기준)

## 설치

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

`install.mjs`가 플랫폼을 감지해 의존성을 설치하고 초기 설정을 만든다. 설정 파일은 `~/.config/toolkit/config.json`에 생긴다. 설치 후 `toolkit --version`으로 확인한다.

## 사용

```bash
toolkit convert input.csv --to json
```

## 근거 문서

- CHANGELOG.md v2.0(2026-07-15): `setup.sh` 폐지·`node install.mjs` 교체, 설정 위치 이동을 근거로 삼았다.
- README.md의 설치 절(`setup.sh`, `~/.toolkit/config`)은 v2.0 이전 내용으로, 최신 변경과 어긋나므로 따르지 않았다. 두 문서가 다를 때는 변경 이력이 있는 CHANGELOG의 최신 항목을 우선했다.
