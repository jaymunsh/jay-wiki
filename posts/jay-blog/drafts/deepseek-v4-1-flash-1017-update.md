title: DeepSeek V4.1 Flash-1017 정리: 구조는 그대로, 11개 지표 모두 올랐지만 가장 큰 상승은 하네스를 바꾼 결과였다
slug: deepseek-v4-1-flash-1017-update
category: 리서치
summary: 10월 17일 나온 DeepSeek V4.1 Flash-1017은 9월 V4.1 Flash의 사후 학습 갱신판이다. 11개 공식 지표 변화와 Opus 5 비교, Terminal-Bench 상승에 섞인 하네스 차이, 그대로인 가격과 바뀐 API 라우팅, MIT 가중치 자체 배포 시 주의점을 정리한 리서치.
tags: deepseek,v4-1-flash,v4-1-flash-1017,llm,benchmark,api-pricing,open-weights,agentic-coding,research
toc: true
publishedAt: 2026-10-19T03:00:00Z
updatedAt: 2026-10-22T03:00:00Z

---

> **이 글의 대상**: DeepSeek API를 에이전트 코딩에 쓰고 있거나, 가중치를 직접 띄울지 고민하는 개발자. 9월 V4.1 Flash에서 무엇이 바뀌었고, 지금 내 요청이 어느 모델로 가는지 확인하려는 사람.

> **출처 및 기준일**: 1차 출처는 DeepSeek의 [1017 릴리스 노트](https://api-docs.deepseek.com/news/news261017/), [변경 기록](https://api-docs.deepseek.com/updates/), [가격 페이지](https://api-docs.deepseek.com/quick_start/pricing/)다. 두 모델 카드의 대조와 자체 배포 주의점은 [braindetox의 1017 분석](https://braindetox.kr/en/posts/deepseek_v4_1_flash_1017_update_2026.html), 공개 맥락은 [TechNode의 10월 19일 기사](https://technode.com/2026/10/19/deepseek-releases-v4-1-flash-1017-with-stronger-coding-and-agent-capabilities/)를 참고했다. 공개일은 10월 17일이고, 판정 기준일은 10월 19일이다. 9월 원판의 구조와 가격은 [V4.1 Flash 정리 글](/76/deepseek-v4-1-flash-guide)에 있다.

## 1. 새 모델이 아니라 같은 모델의 사후 학습 갱신이다

DeepSeek은 1017을 V4.1 Flash의 "minor update"라고 불렀다. 실제로 1017 저장소의 `config.json`은 9월 원판과 바이트 단위까지 같다. 552B 백본, 입력 8B·출력 16B 활성, 20층 인코더와 20층 디코더로 나눈 CED 구조, 토큰당 약 890바이트의 KV 캐시가 모두 그대로다.

바뀐 것은 학습이다. 릴리스 노트는 "엔드투엔드 프로젝트 개발에 대한 자기 피드백 강화학습"을 한 문장으로만 언급한다. 방법의 세부는 공개하지 않았다. 목표로 밝힌 것은 DeepSeek Harness, Tencent CodeBuddy, WorkBuddy 같은 에이전트 도구에 맞춘 개선이다.

DeepSeek은 이 갱신을 "성능과 비용 모두의 파레토 개선"이라고 설명했다. 점수가 오르면서, 작업 시간과 출력 길이는 줄었다는 주장이다.

## 2. 공식 지표 11개가 모두 올랐다

| 벤치마크 | 9월 V4.1 Flash | 1017 | 변화 | Claude Opus 5 |
|---|---|---|---|---|
| HLE (도구 없음) | 36.8 | 42.6 | +5.8 | 56.3 |
| Terminal-Bench 4.0 | 31.2 | 42.3 | **+11.1** | 51.8 |
| DeepSWE v1.1 | 74.2 | 77.0 | +2.8 | 74.0 |
| ProgramBench | 20.3 | 29.1 | +8.8 | 37.0 |
| NL2Repo-Bench | 65.4 | 68.2 | +2.8 | 75.3 |
| Automation-Bench v1.0.6 | 54.8 | 60.5 | +5.7 | 50.3 |
| Agents' Last Exam | 31.8 | 35.4 | +3.6 | 28.6 |
| Apex Bench v1.1 | 64.6 | 72.1 | +7.5 | 65.8 |
| Chartography (도구 사용) | 78.9 | 83.0 | +4.1 | 84.0 |
| BabyVision (도구 사용) | 89.6 | 92.5 | +2.9 | 94.1 |
| ZeroBench-main (도구 사용) | 49.0 | 51.0 | +2.0 | 52.0 |

Opus 5와 비교하면 4개 항목에서 앞서고 7개 항목에서 뒤진다. 앞서는 쪽은 DeepSWE, 업무 자동화, 에이전트 시험, 수학(Apex)이다. 뒤지는 쪽은 HLE, Terminal-Bench, 저장소 단위 생성(NL2Repo), 시각 작업이다. 가격 차이를 생각하면 앞서는 항목이 있다는 것 자체가 눈에 띈다.

## 3. 가장 큰 상승폭 +11.1에는 하네스 변경이 섞여 있다

표에서 가장 눈에 띄는 숫자는 Terminal-Bench 4.0의 31.2 → 42.3이다. 그런데 두 숫자는 같은 조건에서 잰 것이 아니다.

| | 9월 카드 | 1017 카드 |
|---|---|---|
| 에이전트 하네스 | DeepSeek Harness(DSH) Minimal 모드, 1M 컨텍스트 | Claude Code |
| 샘플링 조건 | reasoning_effort=100, temperature 1.0, top_p 0.95 | 표에 명시 없음 |
| 9월 원판 점수 | 31.2 | 31.2 (다시 쟀는지 표시 없음) |

하네스가 결과를 얼마나 흔드는지는 9월 카드에 이미 나와 있다. 같은 모델의 DeepSWE v1.1이 mini-SWE에서 74.2, OpenCode에서 65.5로 8.7점 차이가 났다. Terminal-Bench 2.1도 DSH Minimal에서 90.6, Codex에서 84.1로 6.5점 차이였다.

그래서 +11.1을 "모델이 11점 좋아졌다"로 읽으면 안 된다. 모델 개선분과 하네스 차이가 섞인 숫자다. 내가 쓰는 하네스에서 직접 재기 전에는 다른 항목의 +3~+8점이 더 믿을 만한 변화 폭이다.

두 카드 사이에 맞지 않는 값도 있다. NL2Repo-Bench의 9월 원판 점수가 9월 카드에서는 64.0, 1017 카드에서는 65.4다. 9월 카드의 "MathArena Apex"(65.6)와 1017 카드의 "Apex Bench v1.1"이 같은 벤치마크인지도 적혀 있지 않다.

## 4. 가격은 그대로고, 옛 모델 이름은 모두 1017로 간다

변경 기록에 따르면 "API 호출 방식과 가격은 바뀌지 않는다." 가격표는 이렇다.

| 100만 토큰당 (`deepseek-flash`) | 비혼잡 시간 | 혼잡 시간 |
|---|---|---|
| 입력, 캐시 적중 | $0.003 | $0.006 |
| 입력, 캐시 미적중 | $0.15 | $0.30 |
| 출력 | $0.60 | $1.20 |

혼잡 시간은 평일 UTC 01:00~04:00, 06:00~10:00이다. 한국 시간으로는 10시~13시와 15시~19시다. 주말과 중국 공휴일은 종일 비혼잡 가격이다. 한국의 업무 시간과 상당 부분 겹치므로, 배치 작업은 저녁이나 주말로 미루면 절반 가격이 된다.

라우팅도 확인해야 한다.

| 모델 이름 | 지금 가는 곳 |
|---|---|
| `deepseek-flash` | V4.1 Flash-1017 |
| `deepseek-v4-flash` | 옛 모델은 퇴역. 1017이 받아서 Flash 가격으로 과금 |
| `deepseek-v4-flash-vision-exp` | 같음 |

옛 이름을 쓰던 코드는 오류 없이 1017로 넘어간다. 편하지만, 모델이 바뀐 줄 모르고 평가 결과를 비교하게 될 수 있다. Hugging Face에는 "헷갈리는 모델 ID를 피해 달라"는 토론 글도 올라와 있다. 그 밖의 사양은 1M 컨텍스트, 최대 출력 384K, 사고 모드 기본값이다. OpenAI 형식과 Anthropic 형식 엔드포인트를 모두 제공한다.

함께 열린 Search·Fetch API는 1,000회당 $0.75다. DeepSeek Harness, Claude Code, Codex 안에서 부르는 서버 측 도구 호출은 지금 무료지만, **10월 31일 16:00 UTC(한국 시간 11월 1일 01:00)부터 과금된다.**

## 5. 가중치는 MIT이고, 자체 배포에는 손이 간다

가중치는 Hugging Face와 ModelScope에 MIT 라이선스로 올라왔다. 상업적 사용과 재배포에 제약이 거의 없다. 같은 주에 나온 FLUX 3 Image Klein이 매출 기준과 파생물 제한을 붙인 것과 대조된다.

다만 바로 띄울 수 있는 형태는 아니다.

- **채팅 템플릿이 없다.** Jinja 템플릿 대신 `encoding.py` 참조 구현이나 Rust 라이브러리 `deepseek-recipe`로 프롬프트를 인코딩해야 한다.
- **추론 코드는 참조 구현이다.** 저장소의 inference 폴더는 읽기 쉬운 구현이지 운영용 서빙 엔진이 아니다.
- **자체 시험은 배관 확인용이다.** `model.py`는 초기화하지 않은 가중치로 prefill 한 번과 decode 22스텝을 돌려 텐서 모양과 커널 연결만 확인한다. 수치 정확도는 보지 않는다.
- **권장 설정**: temperature 1.0, top_p 1.0, `max_tokens` 256K 이상이다.

552B 모델이라 개인 장비로 돌릴 크기는 아니다. 조직 내부 GPU 클러스터에 띄울 때 라이선스 걱정이 없다는 것이 장점이다.

## 6. 정리: API 사용자는 이미 바뀌었고, 평가표를 다시 볼 차례다

| 이런 경우라면 | 판단 |
|---|---|
| `deepseek-flash`나 옛 이름으로 API를 쓰고 있다 | 이미 1017로 바뀌었다. 같은 가격에 지표가 올랐으니 할 일은 회귀 확인뿐이다 |
| 9월에 잰 내부 평가표가 있다 | 다시 잰다. 모델이 바뀐 것을 모르고 비교하지 않는다 |
| Terminal-Bench 상승을 근거로 도입을 검토한다 | 하네스가 다르다. 내 하네스에서 직접 잰다 |
| Search·Fetch를 하네스에서 쓰고 있다 | 11월 1일 01:00(KST)부터 과금된다. 호출 수를 미리 본다 |
| 가중치를 직접 띄운다 | MIT라 자유롭다. 프롬프트 인코딩과 서빙 엔진은 따로 준비한다 |

9월 원판이 "Flash 가격에 Pro급"을 내세웠다면, 1017은 같은 가격에서 에이전트 작업을 더 다듬은 갱신이다. 다만 모든 수치가 DeepSeek의 자체 보고이고, 출력 길이와 작업 시간이 얼마나 줄었는지는 숫자로 공개되지 않았다.

## 10월 22일 수정: 독립 실측과 반응

### 개인 벤치마크에서도 9월판보다 올랐다

[LeanZero의 Mihai Perdum](https://dev.to/mihai_leanzero/deepseek-v41-flash-1017-benchmark-same-task-two-builds-024-and-066-32b8)이 10월 18일 자신의 에이전트 벤치마크로 쟀다. 코딩 에이전트 goose가 결제 앱을 만들고 99개 검사를 통과하는지 본다.

| 모델 | 점수 | 비용 |
|---|---|---|
| **DeepSeek V4.1 Flash-1017** | **0.6957** | **$0.21** |
| DeepSeek V4.1 Flash (9월) | 0.591 | $0.25 |
| Mistral Large 4 | 0.5462 | $4.93 |
| Nemotron 3.5 Super VL | 0.3781 | $1.21 |

같은 작업에서 점수는 오르고 비용은 줄어, DeepSeek의 "파레토 개선" 주장과 방향이 맞았다. 다만 더 긴 과제(Forge 2.0)에서는 같은 설정의 두 번 실행이 0.24와 0.66으로 갈렸다. 한 번은 시작 코드에 있던 재시도 루프를 그대로 두어 37분을 기다렸다. **한 번의 실행으로 판단하지 말라**는 본문 3절의 주의가 여기서도 확인된다.

같은 글의 비용 비교도 눈에 띈다. 이 과제 한 쌍에 Opus 5.5는 $42.50, GLM 5.3 Prime은 $99.66이 들었다. DeepSeek 1017은 약 $0.62였다.

### 커뮤니티 반응

- **조용한 출시에 대한 반응**: 금요일에 행사나 시연 없이 패치 번호로 나온 것이 오히려 화제가 됐다. 한편 SNS에 돈 "Opus 5를 이겼다"는 비교는 11개 중 4개 항목만 앞선 것을 부풀렸다는 비판이 나왔다([DEV Community](https://dev.to/dishant0406/deepseek-v41-flash-1017-the-hype-vs-what-shipped-friday-3gn6)).
- **용도에 대한 평가**: 가격과 MIT 라이선스 때문에 대량의 에이전트 코딩에 권하고, 사실 회상(상식 문답)에는 권하지 않는다는 평이 있었다.
- Hacker News와 Reddit에서는 1017 자체를 다룬 큰 토론을 찾지 못했다.
