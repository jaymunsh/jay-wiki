# toolkit 설치 가이드 (현재 버전)

## 설치
```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
toolkit --version   # 확인
```
`node install.mjs`가 플랫폼을 감지해 의존성·초기 설정을 수행한다. 초기 설정 파일은 **`~/.config/toolkit/config.json`** 에 생성된다.

## 사용
```bash
toolkit convert input.csv --to json
toolkit convert input.csv --to json --pretty   # v2.0부터 --pretty
```

## 근거 (어떤 문서를 댔는가)
- **`CHANGELOG.md` v2.0 (2026-07-15)을 현재 기준(권위 문서)으로 채택**. 명시적으로 "`setup.sh`를 폐지하고 `node install.mjs`로 교체", "config 위치 `~/.toolkit/config`→`~/.config/toolkit/config.json`", "`--pretty` 추가"를 기록. 날짜·버전이 있어 **최신 상태**.
- **`README.md`는 구버전(과실)으로 판정**: 여전히 `./setup.sh`·`~/.toolkit/config`를 안내. 날짜·버전 표기가 없고, 최신 changelog와 **정면으로 충돌**하므로 설치 절차 근거로 쓰지 않음.
- **차이 인지도**: README(setup.sh, ~/.toolkit/config) vs CHANGELOG v2.0(install.mjs, ~/.config/toolkit/config.json, --pretty). 둘의 충돌 지점을 위 설치 단에 반영했으며, **새 changelog**가 이긴다.
- **권고**: `README.md` 설치 단을 `node install.mjs`·새 config 경로로 갱신해 충돌을 없애라.
