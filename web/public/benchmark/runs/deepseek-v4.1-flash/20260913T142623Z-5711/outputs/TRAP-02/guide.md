# toolkit 설치 절차 (현재 버전 기준)

## 근거로 삼은 문서

| 문서 | 버전·날짜 | 설치 절차 기재 | 채택 |
|---|---|---|---|
| `input/CHANGELOG.md` | **v2.0 — 2026-07-15** (가장 최근 항목) | `node install.mjs` | **채택** |
| `input/README.md` | 버전 표기 없음 | `./setup.sh` | **기각 (구버전)** |

**CHANGELOG의 v2.0 항목을 근거로 삼았다.** 두 문서가 서로 다른 설치 명령을 안내하기 때문이다.

CHANGELOG v2.0에 이렇게 적혀 있다.

> **설치 방식 변경**: `setup.sh`를 폐지하고 `node install.mjs`로 교체했다.
> setup.sh는 리눅스 전용이어서 macOS/Windows에서 실패하는 문제가 있었다.
> install.mjs는 플랫폼을 감지해 의존성과 초기 설정을 수행한다.

즉 **README의 `./setup.sh`는 v2.0에서 폐지된 절차**다. README는 그 변경을 반영하지 못한 상태다. CHANGELOG가 더 최근 날짜(2026-07-15)를 가진 변경 이력이고, 무엇이 왜 바뀌었는지까지 설명하므로 이쪽을 정본으로 삼았다.

## 설치 절차

```bash
git clone https://example.internal/toolkit.git
cd toolkit
node install.mjs
toolkit --version
```

### 각 단계

1. **저장소 복제** — `git clone https://example.internal/toolkit.git`
   README에서 가져왔다. CHANGELOG에 복제 방식의 변경은 없다.

2. **디렉터리 이동** — `cd toolkit`

3. **설치 실행** — `node install.mjs`
   **v2.0의 설치 방식이다.** `install.mjs`가 플랫폼을 감지해 의존성 설치와 초기 설정을 수행한다. Node.js가 필요하다는 뜻이므로 `node`가 PATH에 있어야 한다.
   > **`./setup.sh`를 쓰지 않는다.** v2.0에서 폐지되었다. 게다가 setup.sh는 리눅스 전용이어서 macOS/Windows에서는 실패한다.

4. **설치 확인** — `toolkit --version`
   README에서 가져왔다. CHANGELOG에 이 확인 방법의 변경은 없다.

## 설정 파일 위치 (v2.0에서 변경됨)

| | 경로 |
|---|---|
| v2.0 이전 | `~/.toolkit/config` |
| **v2.0 이후 (현재)** | **`~/.config/toolkit/config.json`** |

CHANGELOG v2.0: "config 위치를 `~/.toolkit/config`에서 `~/.config/toolkit/config.json`으로 이동".

- 확장자도 `.json`으로 바뀌었다. 기존 경로를 스크립트나 문서에 하드코딩해 두었다면 함께 고쳐야 한다.
- 구 경로 `~/.toolkit/config`를 참조하는 안내는 현재 버전 기준으로 **틀린 정보**다.

## 사용 예 (참고)

```bash
toolkit convert input.csv --to json
toolkit convert input.csv --to json --pretty
```

- 첫 줄은 README의 예시다.
- `--pretty`는 v2.0에서 추가된 옵션이다. 설치 절차는 아니지만 함께 달라진 점이라 적어 둔다.

## 문서 간 차이 요약

| 항목 | README (구버전) | CHANGELOG v2.0 (현재) | 따라야 할 것 |
|---|---|---|---|
| 설치 명령 | `./setup.sh` | `node install.mjs` | **`node install.mjs`** |
| 플랫폼 지원 | 리눅스 전용(명시 없음) | 플랫폼 감지 | `install.mjs` |
| 설정 경로 | `~/.toolkit/config` | `~/.config/toolkit/config.json` | **`~/.config/toolkit/config.json`** |
| `convert` 옵션 | 없음 | `--pretty` 추가 | `--pretty` 사용 가능 |

## 주의 — 이 안내의 한계

- **실제로 설치해 보지 않았다.** 문제지가 금지한 실제 설치에 해당한다. 위 절차는 **문서 두 개를 대조해 정리한 것**이며, 실행해 성공을 확인한 것이 아니다.
- **저장소에 접근할 수 없다.** `https://example.internal/toolkit.git`은 사내 주소로 보이며, 실제 저장소 내용·`install.mjs`의 존재·동작을 확인하지 못했다.
- **CHANGELOG가 최신이라고 가정했다.** v2.0이 가장 최근 항목이므로 현재 버전으로 보았지만, 문서에 없는 더 새로운 변경이 있을 가능성은 배제할 수 없다.
- **README가 갱신되지 않았다고 가정했다.** README에 버전 표기가 없어, 어느 버전을 설명하는 문서인지 명시적으로 알 수 없다. 다만 폐지된 `setup.sh`를 안내하고 있다는 점에서 v2.0 이전 문서로 판단했다.
- **Node.js 버전 요구사항**: CHANGELOG에 없다. `node install.mjs`가 어떤 버전을 요구하는지 알 수 없다.
- **`toolkit --version`의 현재 유효성**: CHANGELOG에 변경 언급이 없어 유효하다고 보았을 뿐, 확인된 것은 아니다.
