title: Gemini 4 Argon 정리: 공식 표 19개 중 13개 1위, 그러나 '1M 출력'은 공유 창이었다
slug: gemini-4-argon-guide
category: 리서치
summary: 9월 30일 사이버 방어 파트너에게 먼저 풀리고 10월 13일 일반 공개된 Gemini 4 Argon의 스펙과 한시 가격, Claude Opus 5.5·GPT-6 Astra와의 공식 벤치마크 비교, 출시 당일 실측에서 드러난 약점과 3.1 Pro에서 옮길 때 바뀌는 점을 정리한 리서치.
tags: gemini,gemini-4-argon,google,llm,benchmark,api-pricing,long-context,frontier-model,research
toc: true
publishedAt: 2026-10-13T03:00:00Z
updatedAt: 2026-10-22T03:00:00Z
syncHash: 7265828c4a64085a9b839d1eaa32f39ce2b160923dd05105411f4b7dabc5e830

---

> **이 글의 대상**: 프런티어급 모델을 API로 쓰면서 Claude Opus 5.5나 GPT-6 계열과 가격·성능을 저울질하는 개발자. 특히 "1M 토큰 출력"과 "$2/$10"이라는 숫자가 실제로 무엇을 뜻하는지 확인하려는 사람.

> **출처 및 기준일**: 1차 출처는 Google의 [9월 30일 발표](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/), [10월 13일 일반 공개 발표](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/), [Google Cloud 공지](https://cloud.google.com/blog/products/ai-machine-learning/gemini-4-argon-available-on-google-cloud)다. 출시 당일 실측과 API 변경점은 [ComputingForGeeks의 리뷰](https://computingforgeeks.com/gemini-4-argon-released-features-benchmarks/), 출력 한도 해석은 [SmartScope의 정리](https://smartscope.blog/en/blog/gemini-4-argon-release-date-1-million-output-2026/)를 참고했다. 본문의 판정 기준일은 일반 공개일인 10월 13일이다. 그 뒤에 나온 독립 평가는 마지막 「10월 22일 수정」에 모았다.

## 1. 공개는 두 단계로 나뉘었다

Argon은 한 번에 풀리지 않았다.

| 날짜 (미국) | 무엇이 열렸나 |
|---|---|
| 9월 30일 | 발표. 검증된 사이버 방어 조직(Fairwind Program)에만 제공 |
| 10월 13일 | API 일반 공개(`gemini-4-argon`). Gemini 앱은 Google AI Pro·Ultra 구독자부터 순차 적용 |
| 11월 30일까지 | 입력 $2, 출력 $10의 한시 가격 |
| 12월 1일부터 | 입력 $4, 출력 $20 |

Google은 이 2주를 "프런티어 능력을 단계적으로 공개하는 방식"이라고 설명했다. 모델 카드에는 사이버·생물 분야의 위험 능력 수준과 은밀성·상황 인식 기준을 "배제하지 못했다"고 적었다. 그래서 세 분야 모두에 안전성 근거를 따로 마련했다는 것이다. Fairwind 파트너는 공격 보안 관련 보호 장치를 뺀 `gemini-4-argon-cyber-permissive` 변형을 받는다.

## 2. '1M 출력'은 입력·사고·출력이 함께 쓰는 창이다

발표에서 가장 많이 인용된 문구는 "출력 한도가 64K에서 1M으로 늘었다"였다. 실제 동작은 조금 다르다.

| 항목 | 실제 |
|---|---|
| 컨텍스트 창 | 1,048,576 토큰. 입력·사고·출력이 함께 쓴다 |
| 일반 요청의 출력 상한 | 문서상 65,536 토큰 |
| 긴 출력 | Interactions API의 백그라운드 실행(`background: true`)으로 "창에서 입력을 뺀 만큼"까지 |
| 사고 수준 | `low`, `medium`(기본), `high`. 3.1 Pro의 기본값은 `high`였다 |
| 입력 | 텍스트, 이미지, 영상, 오디오, PDF |
| 지식 기준일 | 2026년 3월 |

즉 "한 번에 1M 토큰을 출력한다"가 아니라 "별도 실행 방식을 쓰면 남은 창만큼 길게 쓸 수 있다"에 가깝다. 사고 토큰도 같은 창과 같은 출력 한도를 쓴다. 실측에서 `high`에 `max_tokens`를 1,024로 두자 1,021 토큰을 사고에 쓰고 빈 응답을 돌려줬다.

## 3. 가격은 한시적으로 경쟁 모델의 절반이다

| 100만 토큰당 | 입력 | 출력 | 캐시 입력 | 12월 1일 이후 |
|---|---|---|---|---|
| Standard | $2.00 | $10.00 | $0.10 | $4 / $20 / $0.20 |
| Batch · Flex | $1.00 | $5.00 | $0.05 | $2 / $10 / $0.10 |
| Priority | $3.60 | $18.00 | $0.18 | $7.20 / $36 / $0.36 |

- 1M 창 전체에 같은 가격이다. 3.1 Pro에 있던 200K 초과 할증이 없어졌다.
- 출력 가격에는 사고 토큰이 포함된다. 공식 벤치마크는 가장 높은 사고 수준으로 돌렸으므로, 그 성능을 그대로 쓰면 출력 청구액도 그만큼 는다.
- 캐시는 암시적 캐시만 지원한다. 반복되는 앞부분에 95% 할인이 붙지만, 명시적 `cachedContents` API는 쓸 수 없다.
- API 무료 구간이 없다. 결제가 연결되지 않은 키는 429로 막힌다.

비교 대상의 정가는 Claude Opus 5.5가 $4/$20, GPT-6.1 Sol이 $2/$10이다. 한시 가격 동안은 Opus의 절반이고 Sol과 같다. 12월부터는 Opus와 같아진다. **도입 비용을 계산할 때는 12월 가격으로 계산하는 편이 안전하다.**

## 4. 공식 표에서는 19개 중 13개 항목에서 1위다

Google의 모델 카드는 GPT-6 Astra, Claude Fable 5.1, Claude Opus 5.5와 비교했다. Argon은 가장 높은 사고 수준의 수치다. 주요 항목만 옮긴다.

| 벤치마크 | Gemini 4 Argon | GPT-6 Astra | Claude Fable 5.1 | Claude Opus 5.5 |
|---|---|---|---|---|
| Vals Index | **68.9%** | 63.1% | 65.8% | 67.0% |
| AutomationBench | **51.3%** | 41.4% | 31.4% | 42.5% |
| Vals Finance Agent v2 | **65.4%** | 53.5% | 58.9% | 58.6% |
| DeepSWE v1.1 | **77.9%** | 74.1% | 67.4% | 74.2% |
| FrontierSWE v2 | 55.0% | **65.5%** | 56.3% | 62.3% |
| Terminal-Bench 4.0 | 57.4% | 58.2% | 57.9% | **66.4%** |
| Terminal-Bench Science 0.1 | 57.6% | **68.1%** | 52.6% | 63.3% |
| GraphWalks BFS 256K~1M (F1) | **84.2%** | 71.8% | 65.0% | 66.8% |
| LVBench | **91.7%** | 87.5% | 79.7% | 83.7% |
| CWE-bench v1 | **68.0%** | **68.0%** | 58.0% | 67.0% |

강점은 분명하다. 업무 자동화(AutomationBench, 금융·법률 에이전트)와 긴 컨텍스트(GraphWalks 1M 구간 84.2%)에서 차이가 크다. 반대로 터미널 중심 코딩(Terminal-Bench 4.0)은 Opus 5.5가, 새 소프트웨어 엔지니어링 평가(FrontierSWE)는 Astra가 앞선다.

표를 읽을 때 걸리는 점도 있다.

- **비교 대상이 골라져 있다.** GPT-6.1 Sol과 Claude Sonnet 5.5가 표에 없다.
- **조건이 같지 않은 행이 있다.** LVBench에서 Gemini는 초당 1프레임을 받고 경쟁 모델은 300~800프레임으로 제한됐다. Terminal-Bench Science는 검증 시간 제한을 6배로 늘려 돌렸다.
- **익숙한 지표가 빠졌다.** SWE-bench Verified, GPQA, HLE 점수가 없다.

## 5. 출시 당일 실측: 린트는 통과했지만 파드는 하나도 뜨지 않았다

ComputingForGeeks가 출시 당일에 DevOps 작업 세 가지를 모델마다 세 번씩 돌렸다. Kubernetes Deployment 작성, PostgreSQL 백업 스크립트, OpenTofu VPC 구성이다. 결과는 k3s 클러스터에 실제로 배포해서 확인했다.

| 결과 | Argon (기본) | Argon (high) | Opus 5.5 | GPT-6.1 Sol |
|---|---|---|---|---|
| kubeconform·shellcheck·tofu validate | 9/9 | 9/9 | 9/9 | 9/9 |
| 파드 Ready + HTTP 200 | **0/3** | **0/3** | 3/3 | 3/3 |
| 백업 스크립트 동작 | 3/3 | 3/3 | 3/3 | 3/3 |
| 평균 지연 | 5.5초 | 15.3초 | 12.1초 | 18.7초 |
| 9회 호출 비용 (Argon은 한시 가격) | $0.045 | $0.169 | $0.254 | $0.062 |

원인은 하나였다. Argon은 `nginx:1.27-alpine`에 `runAsUser: 101`을 지정하면서 쓰기 가능한 볼륨을 붙이지 않았다. 그래서 nginx가 `/var/cache/nginx`에 쓰지 못하고 죽었다. 오류를 보여 주자 세 번 모두 고쳤지만, Opus 5.5와 GPT-6.1 Sol은 처음부터 `emptyDir`를 붙였다.

이 실험에서 얻을 교훈은 모델 순위가 아니다. **정적 검사를 통과한 설정이 실제로 동작한다는 보장은 없다.** 에이전트가 쓴 인프라 코드는 테스트 클러스터에서 한 번 띄워 봐야 한다.

속도는 강점이었다. 기본 설정에서 화면에 보이는 토큰이 초당 258~299개였다. 다만 `high`에서는 사고 토큰 약 1,400개가 먼저 나와 첫 글자가 12~13초 뒤에 떴다. 짧은 작업에서는 `low`, `medium`, 기본값 모두 사고 토큰이 0이었고 `high`만 실제로 사고했다.

## 6. Gemini 3.1 Pro에서 옮길 때 바뀌는 점

| 3.1 Pro에서 | Argon에서 |
|---|---|
| `thinkingBudget`, `MINIMAL` 수준 | Vertex에서 400 오류 |
| 명시적 캐시(`cachedContents`) | 지원 안 함 |
| `frequency_penalty`, `presence_penalty`, `candidate_count` | Vertex에서 400 오류 |
| `temperature`, `top_p`, `top_k` | 받기는 하지만 조용히 무시된다 |
| 기본 사고 수준 `high` | `medium` |
| `thinkingLevel: "max"` 같은 값 | 400 오류. `low`·`medium`·`high`만 된다 |

어려운 요청은 몇 분씩 걸릴 수 있어서 Google은 클라이언트 타임아웃을 15분 이상으로 두라고 권한다. 샘플링 파라미터가 오류 없이 무시된다는 점이 가장 위험하다. 값을 바꿔도 결과가 그대로라는 것을 알아채기 어렵다.

## 7. 정리: 긴 문서와 업무 자동화에는 지금, 터미널 코딩에는 아직

| 이런 경우라면 | 판단 |
|---|---|
| 수십만 토큰짜리 문서를 넣고 답을 찾는다 | 1M 구간 수치가 가장 좋다. 바로 써 볼 만하다 |
| 금융·법률처럼 문서 기반 업무를 자동화한다 | 공식 지표가 강하다. 다만 사고 토큰 비용을 같이 본다 |
| 터미널 중심의 코딩 에이전트 | 공식 표에서도 Opus 5.5가 앞선다. 실측에서도 동작 검증이 필요했다 |
| 12월 이후에도 쓸 예산을 짠다 | 정가 $4/$20 기준으로 계산한다 |

[Gemini 3.8 Flash](/54/gemini-3-8-flash-benchmark-guide)가 가성비 축이었다면, Argon은 Google이 다시 최상위 경쟁에 들어온 모델이다. 다만 공식 표의 우세가 실무 우세로 이어지는지는 작업 종류마다 따로 확인해야 한다.

## 10월 22일 수정: 일반 공개 뒤의 독립 평가

- **Artificial Analysis Intelligence Index**: 53점으로 GPT-6 Astra와 같고 GPT-6.1 Sol보다 1점 높다. 다만 과제 하나에 출력 토큰을 약 62K개 써서 Astra의 27K개보다 두 배 이상 많았다. 과제당 비용은 한시 가격에서 $1.99, 정가에서 $3.98이다.
- **환각률**: AA-Omniscience에서 15%로, Astra 51%, GPT-6.1 Sol 54%보다 크게 낮았다. 이번 평가에서 가장 두드러진 장점이다.
- **Terminal-Bench 4.0 독립 측정**: 57%로 Sonnet 5.5(64%)와 Opus 5.5(60%)보다 낮았다. 공식 표와 같은 방향이다.
- **Vals**: Vals Index 1위(68.90%)가 확인됐다. 전체 실행 비용은 $15.68로 Sonnet 5.5의 $21.34, Opus 5.5의 $32.14보다 쌌다. 반면 Harvey 법률 에이전트 리더보드에서는 6위로, Meta Muse Spark 계열보다 뒤였다.
- **제공 범위**: 출시 당일 Pro 구독자 중 일부는 Gemini 앱에서 Argon을 볼 수 없었다고 보고했다. Gemini CLI 지원은 아직 GitHub 이슈 단계다.

출처: [ComputingForGeeks](https://computingforgeeks.com/gemini-4-argon-released-features-benchmarks/), [eesel.ai 가격 분석](https://www.eesel.ai/blog/gemini-4-argon-pricing), [Artificial Analysis](https://artificialanalysis.ai/)

### 같은 작업을 세 모델에 맡긴 실측

일반 공개 다음 날부터 Opus 5.5, GPT-6 Astra와 같은 프롬프트로 비교한 글이 나왔다. 모두 한 번씩 돌린 결과라 편차가 크다는 점을 감안해서 읽는다.

| 실측 | Argon | Opus 5.5 | GPT-6 Astra |
|---|---|---|---|
| 카트 게임 한 번에 만들기 (API 1회) | 220.6초, $0.31, 9.5/10 | 307.6초, $0.64, 32K 토큰에서 잘려 미완성 | 323.4초, $0.70, 10/10 |
| 82문항 한 단어 답하기 | 82/82, $0.22 | 81/82 (형식 실수), $0.07 | 82/82, $0.11 |
| 3D 게임 (MindStudio) | 약 5분, 약 $0.43, 그림자와 빈 맵 | 약 20분, 약 $3, 건물과 NPC까지 | 없음 |

- **싸고 빠른 시제품에는 Argon, 완성도에는 Opus라는 평가가 많다.** [MindStudio](https://www.mindstudio.ai/blog/gemini-4-argon-vs-opus-5-5)는 "Argon으로 시제품을 만들고, 검증된 것을 Opus 5.5로 다시 짓는다"는 흐름을 소개했다.
- **에이전트로 쓰면 설정이 필요했다.** [한 개발자의 비교](https://dev.to/akartit/gemini-4-argon-vs-opus-55-vs-gpt-6-astra-same-prompt-real-bills-1dd9)에서는 opencode의 헤더 타임아웃과 출력 상한을 늘려야 했고, 파일이 실제로 나오기까지 새 세션이 여섯 번 필요했다. 같은 글은 Argon의 에이전트 세션이 많은 토큰을 다시 보내 비용이 커진다고 경고했다.
- **독립 지표는 엇갈린다.** Text Arena에서는 high 설정의 Argon이 1,525 Elo로 1위다([DeepLearning.AI](https://www.deeplearning.ai/the-batch/argon-a-low-hallucination-model-build-for-knowledge-work)). 반면 Artificial Analysis 종합 지수에서는 Opus 5.5보다 약 5점 낮다.

### 커뮤니티 반응

- **"벤치마크 맞춤"이라는 의심**: 종합 점수는 최상위인데 실제 빌드 작업에서는 못 미친다는 반응이 여러 테스터에게서 나왔다. MindStudio는 이것을 업계 전반의 우려로 정리했다.
- **접근 혼선**: Hacker News에는 $20 요금제인데 아직 Gemini 3.1 Pro만 제공된다는 댓글이 있었다([eesel.ai 정리](https://www.eesel.ai/de/blog/gemini-4-argon-test)).
