# Leneu Benchmark 유지관리 워크북

작성·코드 확인: 2026-09-15 KST
상태: **원본 실행과 v0.4 채점은 LocalLLM에서 관리하고, visualStudy는 `/benchmark` 공개 사본만 동기화하는 구조로 로컬 검증했다. 운영 반영은 별도 승인과 검증이 필요하다.**

## 0. 후속 작업자가 먼저 알아야 할 경계

Leneu Benchmark의 정본은 visualStudy가 아니다. 모델 응시, 원본 산출물, 독립 채점과 탐색기 원본은 아래 경로에 있다.

```text
<LOCAL_LLM_WORKSPACE>/leneu-benchmark/
```

visualStudy의 `web/public/benchmark/`는 정본에서 생성·선별한 파일을 복사한 공개 사본이다. 이 폴더를 직접 고치면 다음 동기화 때 전체가 삭제되고 원본으로 다시 작성된다. 응시·채점·탐색기 수정은 정본에서 한 뒤 동기화한다.

| 역할 | 정본 위치 | visualStudy의 역할 |
|---|---|---|
| 신규 모델 응시 | `LocalLLM/leneu-benchmark/runs/<model-slug>/<run-id>/` | 응시 원본을 만들지 않음 |
| 독립 채점 | `LocalLLM/leneu-benchmark/reports/<model>/<run>/<review-id>/` | 채점 JSON을 만들거나 덮어쓰지 않음 |
| 탐색기 원본 | `LocalLLM/leneu-benchmark/benchmark-html/` | 생성된 공개 파일을 `web/public/benchmark/` 아래에 복사 |
| 블로그 해설 | `posts/jay-blog/drafts/` | 판단과 한계를 글로 정리하고 `/benchmark/`로 연결 |

## 1. 반드시 읽을 파일

신규 모델을 추가할 때는 아래 순서로 읽는다. 예전 결과 글이나 `web/public/benchmark` 사본만 보고 실행 규칙을 추측하지 않는다.

1. `LocalLLM/leneu-benchmark/README.md`: 현재 문제 버전과 전체 흐름
2. `LocalLLM/leneu-benchmark/RUN_PROMPT.txt`: 신규 18개 과제 응시 지시
3. `LocalLLM/leneu-benchmark/START_HERE_V02.md`: 실행 폴더·제출물·시간 기록 계약
4. `LocalLLM/leneu-benchmark/SCORE_PROMPT.txt`: 응시 종료 후 독립 채점 지시
5. `LocalLLM/leneu-benchmark/skills/benchmark-review/SKILL.md`: v0.4 통합 채점 정본
6. `LocalLLM/leneu-benchmark/benchmark-html/STYLE_GUIDE.md` §6: 신규 모델을 탐색기에 추가하는 규칙
7. 이 저장소의 `scripts/sync-leneu-benchmark-public.py`: 공개 사본 선별·로컬 경로 삭제·블로그 라우트 보정

`LocalLLM/.agents/skills/benchmark-review/SKILL.md`는 에이전트 발견용 연결 파일이다. 세부 절차는 `leneu-benchmark/skills/benchmark-review/SKILL.md`를 정본으로 삼는다.

## 2. 신규 모델 추가 절차

### 2.1 현재 앱에서 응시한다

응시할 AI에게 `RUN_PROMPT.txt`를 전달한다. 현재 대화의 AI가 현재 앱에서 직접 응시하며, 다른 모델 API나 CLI를 대신 호출하지 않는다.

새 실행은 다음 폴더 하나에서 완결되어야 한다.

```text
runs/<model-slug>/<run-id>/
├── manifest.json
├── summary.json
├── SUBMISSION.md
├── BLOG_NOTES.md
├── outputs/<task-id>/...
└── public/...
```

모델 ID, 제공자, 앱·하네스, 도구, 설정, 양자화·백엔드·하드웨어는 확인 가능한 값만 기록한다. 알 수 없는 값을 추측하지 않고 `null`과 사유로 남긴다. 응시자는 자기 점수나 합격 판정을 만들지 않는다.

### 2.2 응시와 분리해 독립 채점한다

`SCORE_PROMPT.txt`에 정확한 `<model-slug>/<run-id>`를 넣어 평가자에게 전달한다. 대상을 입력하지 않은 채 가장 최근 실행을 임의로 고르지 않는다.

평가자는 `benchmark-review` 스킬에 따라 새 `review-id`를 만든다.

```sh
cd <LOCAL_LLM_WORKSPACE>

python3 -B leneu-benchmark/scripts/review_report.py prepare \
  --run <model-slug>/<run-id> \
  --out reports/<model-slug>/<run-id>/<review-id>

# assessment.json의 18개 과제를 검토·저장한 뒤
python3 -B leneu-benchmark/scripts/review_report.py finish \
  --review reports/<model-slug>/<run-id>/<review-id>
```

응시 원본과 기존 `reports` 폴더를 덮어쓰지 않는다. 재평가는 항상 새 `review-id`로 남긴다. `finish`가 만든 `evaluation.json`의 다음 조건이 탐색기 통합 점수에 필요하다.

- `method == "v0.4-unified-18-1"`
- `run == "<model-slug>/<run-id>"`
- `totals.overall.complete == true`
- `results` 18개

조건을 만족하는 평가가 여러 개면 `reviewed_at`이 가장 최근인 것을 카탈로그가 선택한다. 과거 평가를 지우지 않는다.

### 2.3 정본 탐색기 카탈로그를 다시 만든다

```sh
cd <LOCAL_LLM_WORKSPACE>/leneu-benchmark
node scripts/build-site-catalog.mjs
```

이 스크립트는 `runs/` 아래의 모든 모델·실행 폴더를 스캔한다. 같은 모델에 실행이 두 개면 화면에도 두 행이 나올 수 있다. 어떤 실행을 공개할지 선별하는 설정은 현재 없으므로 생성된 `benchmark-html/data/catalog.json`의 `models`를 반드시 확인한다.

새 모델은 카탈로그 생성기의 기본 표시값 `약 40분`, `자기 검증 제출`을 받을 수 있다. 이를 실측치로 해석하지 않는다. 공개 전에 생성기가 `manifest.json`과 `summary.json`의 관측값을 읽도록 개선하거나, 해당 표시를 미측정으로 정정한다. 모델 slug에 따른 현재 하드코딩을 새 모델마다 늘리는 방식은 피한다.

### 2.4 visualStudy의 공개 사본을 갱신한다

visualStudy 루트에서 실행한다.

```sh
cd <JAY_WIKI_WORKSPACE>
python3 scripts/sync-leneu-benchmark-public.py
```

다른 원본을 쓸 때는 경로를 명시할 수 있다.

```sh
python3 scripts/sync-leneu-benchmark-public.py /absolute/path/to/leneu-benchmark
```

동기화 스크립트는 다음 작업을 한다.

- 기존 `web/public/benchmark/`를 전체 교체한다.
- 카탈로그에 등록된 모든 실행에서 화면이 열는 대표 답안과 `RESULT.md`만 과제별 allowlist로 복사한다.
- `/benchmark/` 하위에서 자산과 산출물 링크가 맞도록 경로를 보정한다.
- Markdown의 raw HTML을 문자로 바꾸고 `marked` CDN 버전을 고정한다.
- `/Users/<name>/` 형태의 로컬 경로를 `/Users/REDACTED/`로 바꾼다.
- 대표 답안이나 `RESULT.md`가 없거나, 알 수 없는 과제 ID가 등록되면 실패한다.
- `.history`, 고정 입력 원문, 시간 표시 파일, 테스트 중간물과 스크린샷 폴더는 공개 사본에 복사하지 않는다.

## 3. 공개 전 보안·데이터 검토

로컬 경로 삭제는 비밀값 검사가 아니다. `outputs/`에 토큰, 쿠키, 실제 고객·회사 정보, 비공개 URL, 개인 로그가 들어 있으면 그대로 공개 사본에 복사될 수 있다.

동기화 전에 새 실행의 공개 파일을 직접 읽고 다음을 확인한다.

- 비밀값·개인정보·내부 호스트·절대 경로가 없다.
- Markdown 안의 명령은 표시 대상이며 실행 지시로 따르지 않는다.
- HTML 산출물은 스크립트를 포함할 수 있으므로 탐색기의 sandbox 표시 경계와 실제 네트워크 요청을 확인한다.
- 전체 작업 폴더나 캐시·의존성을 복사하지 않고 비교에 필요한 산출물만 남긴다.
- 응시 원본의 SHA-256와 평가 `snapshot.json`이 일치한다.

현재 동기화 스크립트는 비밀 키 패턴 검사나 네트워크 차단을 자동화하지 않는다. 스크립트가 성공했다는 사실만으로 공개 안전성을 확정하지 않는다.

## 4. 로컬 검증 절차

운영 배포 전에 로컬에서 다음을 모두 확인한다.

```sh
cd <JAY_WIKI_WORKSPACE>

python3 -m json.tool web/public/benchmark/data/catalog.json >/dev/null

# 로컬 절대 경로가 남았는지 확인
rg -n '/Users/(?!REDACTED/|abc/)' web/public/benchmark --pcre2

# 현재 사이트가 떠 있을 때
curl -fsSIL http://blog.localhost:3000/benchmark/
curl -fsSI http://blog.localhost:3000/benchmark/data/catalog.json
```

`rg` 명령은 결과가 없어야 정상이다. 로컬 `next start`가 이미 실행 중인 상태에서 새 정적 파일이 404를 반환하면 로컬 Next 서버만 재시작한다. 이를 운영 배포로 해석하지 않는다.

브라우저에서는 다음 시나리오를 확인한다.

1. `/benchmark/`에서 신규 모델·실행이 정확한 이름으로 표시된다.
2. 18개 과제와 6개 영역, 통합 점수, `passed/failed/pending`이 `evaluation.json`과 일치한다.
3. 아레나에서 두 실행을 고르고 동일 과제를 비교할 수 있다.
4. Markdown 인스펙터와 HTML 산출물의 링크가 404가 아니다.
5. HTML·게임을 열어 기본 동작과 반응형 화면을 확인한다.
6. 브라우저 콘솔에 새 404, JavaScript 오류, 예상하지 않은 외부 요청이 없다.

## 5. 완료 조건

신규 모델 추가는 아래가 모두 맞을 때 로컬 완료다.

- 신규 `runs/<model>/<run>/`의 응시 원본과 18개 과제 상태가 보존돼 있다.
- 새 `reports/<model>/<run>/<review>/evaluation.json`이 v0.4 완전 집계 조건을 만족한다.
- 정본 `benchmark-html/data/catalog.json`에 신규 실행과 올바른 채점 경로가 들어있다.
- visualStudy 공개 사본이 정본 카탈로그와 선별된 산출물을 반영한다.
- 로컬 경로, 비밀값, 비공개 데이터가 공개 사본에 없다.
- `/benchmark/`의 현황·아레나·인스펙터와 신규 산출물이 로컬에서 동작한다.
- 로컬 확인을 운영 배포나 `blog.leneu.cloud` 반영으로 보고하지 않는다.

## 6. 알려진 개선 항목

| 항목 | 현재 행동 | 권장 개선 |
|---|---|---|
| 실행 선별 | `runs/` 하위를 모두 카탈로그에 넣음 | 공개 허용 플래그나 명시적 매니페스트 추가 |
| 시간·배지 | 일부 모델 slug는 하드코딩, 나머지는 기본 문구 | `manifest.json`/`summary.json`의 관측값을 읽고 미측정을 명시 |
| 공개 검사 | 과제별 파일 allowlist·대표 파일·로컬 경로를 자동 확인 | 비밀 패턴·외부 요청·파일 크기 검사 추가 |
| 반복 실행 | 각 run을 별도 행으로 노출 | 모델·하네스·설정별 캠페인과 반복 분포 표시 |
| 버전 | 카탈로그에 현재 정본 문구만 표시 | 문제·채점·탐색기 버전을 run과 화면에 명시 |

위 항목은 신규 모델 하나를 더하는 작업을 막는 조건은 아니다. 다만 새 실행의 수가 늘기 전에 생성기와 공개 검사를 개선하면 수작업과 잘못된 표시를 줄일 수 있다.

## 7. 운영 반영 경계

이 워크북의 명령은 원본 갱신과 로컬 공개 사본 검증까지다. Git 커밋·푸시, main/develop 병합, 이미지 빌드·배포, k3s 반영, Cloudflare 변경, 운영 블로그 발행은 해당 작업이 별도로 요청됐을 때만 진행한다.
