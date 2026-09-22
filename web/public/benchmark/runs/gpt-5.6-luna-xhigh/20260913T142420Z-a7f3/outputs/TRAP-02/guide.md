# toolkit v2.0 설치 가이드

## 기준 버전과 문서 판단

이 절차는 `CHANGELOG.md`의 v2.0(2026-07-15)을 현재 기준으로 삼는다.
`README.md`에는 이전 방식인 `setup.sh`가 남아 있지만, CHANGELOG는 v2.0에서
그 스크립트를 폐지하고 `node install.mjs`로 교체했다고 명시한다. 따라서
아래에는 `setup.sh`를 사용하지 않는다.

## 설치

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
```

v2.0의 `install.mjs`는 플랫폼을 감지해 의존성과 초기 설정을 수행한다. 설치가
끝난 뒤에는 다음으로 실행 파일 버전을 확인한다.

```bash
toolkit --version
```

초기 설정 파일의 현재 위치는 `~/.config/toolkit/config.json`이다. README에
적힌 `~/.toolkit/config`는 v2.0 이전 위치이므로 현재 절차의 확인 기준으로
사용하지 않는다.

## 설치 후 사용

기본 변환은 다음처럼 실행할 수 있다.

```bash
toolkit convert input.csv --to json
```

v2.0에는 보기 좋은 출력을 위한 `--pretty` 옵션도 추가됐다. 실제 파일 경로와
플랫폼별 권한은 설치 환경에서 확인한다.

## 확인 범위

이 가이드는 두 입력 문서의 변경 내역을 편집한 것이며, 명령을 실행해 설치
성공이나 버전 출력을 확인한 기록은 아니다. 특히 README의 `setup.sh` 절차는
리눅스 전용 문제로 폐지됐다는 CHANGELOG의 설명과 충돌하므로 현재 버전의
공식 절차로 채택하지 않았다.
