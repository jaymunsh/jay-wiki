title: Meta Muse Wonder 정리: 첫 프런티어급 모델, 그러나 표의 1위는 구독 전용 Full의 몫이다
slug: meta-muse-wonder-guide
category: 리서치
summary: 10월 12일 공개된 Meta의 Muse Wonder와 Muse Wonder Full의 차이, API 가격과 Muse Code 요금제, Claude Opus 5.5·GPT-6 Astra와의 공식 벤치마크 비교, Active Memory·Active Focus의 의미와 출시 직후 커뮤니티 반응을 정리한 리서치.
tags: meta,muse-wonder,muse-code,llm,benchmark,api-pricing,agent,frontier-model,research
toc: true
publishedAt: 2026-10-13T05:00:00Z
updatedAt: 2026-10-22T03:00:00Z

---

> **이 글의 대상**: Muse Spark를 쓰던 개발자나, 프런티어급 모델 후보를 비교하는 사람. 특히 발표 표의 높은 점수를 API로 그대로 쓸 수 있는지 확인하려는 사람.

> **출처 및 기준일**: 1차 출처는 [Meta의 Muse Wonder 발표](https://about.fb.com/news/2026/10/introducing-muse-wonder-models/)와 [Meta 개발자 페이지](https://developer.meta.com/ai)다. 요금제·가격·벤치마크 표와 커뮤니티 반응은 [eesel.ai의 정리](https://www.eesel.ai/es/blog/meta-muse-wonder), 출시 맥락은 [Let's Data Science](https://letsdatascience.com/news/meta-launches-muse-wonder-and-muse-wonder-full-for-agentic-t-41113cca)와 [AI Magazine](https://aimagazine.com/news/muse-wonder-how-is-meta-competing-at-the-frontier)을 참고했다. 공개일은 미국 시간 10월 12일이고, 판정 기준일은 10월 13일이다.

## 1. Muse 시리즈가 반년 만에 프런티어 경쟁에 들어왔다

[Muse Spark 1.3 글](/62/muse-spark-1-3-benchmark-guide)을 쓸 때만 해도 Meta의 Muse는 "싸고 쓸 만한 모델"이었다. 4월에 Muse Spark를 내놓은 지 반년 만에, Meta는 Wonder를 "지금까지 만든 가장 유능한 모델"로 소개했다. 일본 언론은 "OpenAI와 Anthropic의 최첨단 모델을 넘어섰다"고 보도했다.

Wonder가 겨냥하는 일은 개인 비서보다 업무 에이전트에 가깝다. 문서 작업과 코딩, 금융·법률·의료 같은 전문 영역의 다단계 작업이다.

## 2. Wonder와 Wonder Full은 쓰는 길이 다르다

이 글에서 가장 중요한 구분이다. 이름은 비슷하지만 접근 경로가 다르다.

| 항목 | Muse Wonder | Muse Wonder Full |
|---|---|---|
| 모델 ID | `muse-wonder-1.0` | 공개 ID 없음 |
| 쓰는 곳 | Meta Model API, OpenRouter, Muse Code 전 요금제 | Muse Code Power·Maximum 구독에서만 |
| 토큰 단가 | 입력 $4, 출력 $20 | 없음 (구독제) |
| 상태 | Preview | 구독 기능 |

Meta 문서에 따르면 Wonder의 reasoning effort를 `max`로 올려도 Full이 되지 않는다. **API로 호출할 수 있는 것은 Wonder뿐이다.** 그런데 발표 페이지에 크게 걸린 점수는 대부분 Full의 것이다.

## 3. API 가격은 Opus 5.5와 같다

| 100만 토큰당 | 입력 | 출력 |
|---|---|---|
| Muse Spark 1.3 | $1.25 | $4.25 |
| GPT-6.1 Sol | $2.00 | $10.00 |
| **Muse Wonder** | **$4.00** | **$20.00** |
| Claude Opus 5.5 | $4.00 | $20.00 |
| Claude Fable 5.1 | $10.00 | $50.00 |

- 캐시 입력은 $0.20이다.
- 컨텍스트는 1,048,576 토큰이고 긴 컨텍스트 할증이 없다.
- 웹 검색 도구는 1,000회당 $2.50이다.
- 처리 한도는 분당 3,000 요청, 분당 400만 토큰이다.
- Muse Spark에 있던 Contributor 등급, 즉 트래픽을 학습에 내주고 할인받는 구간이 없다.

Spark 1.3과 비교하면 입력은 3.2배, 출력은 4.7배다. 지금까지 싼 가격이 Meta 모델의 장점이었던 만큼, 이번에는 가격으로 고르는 모델이 아니다.

## 4. Muse Code 요금제가 Full로 가는 유일한 길이다

| 요금제 | 월 | 사용량 | 모델 |
|---|---|---|---|
| Everyday | $5 | 5시간마다 10~50 프롬프트 | Spark, Wonder, Image |
| High | $15 | Everyday의 5배 | 위와 같음 + 멀티모달 입력 |
| Power | $50 | Everyday의 20배 | **Wonder Full** 추가, 조기 기능 |
| Maximum | $200 | Everyday의 80배 | Power의 모든 것 |

구독에는 조건이 붙는다. 기본값이 Contributor 모드라서 끄지 않으면 내 트래픽이 학습에 쓰인다. 18세 이상만 가입할 수 있고, 지역 제한이 있으며, 환불이 없다. 출시 시점에는 북미에서만 구독할 수 있었다는 댓글도 있었다.

## 5. 공식 표는 Full과 Opus 5.5가 6대 6으로 나눠 가졌다

Meta가 공개한 표는 14개 행이다. 행별 1위는 Wonder Full 6개, Opus 5.5 6개, GPT-6 Astra 1개, Wonder API 1개였다.

| 벤치마크 | Wonder Full | Wonder (API) | Claude Opus 5.5 |
|---|---|---|---|
| Artificial Analysis Index | 56 | 52 | **58** |
| DeepSWE 1.1 | **79.0** | 78.8 | 74.2 |
| SWE-Marathon | **57.5** | 53.1 | 46.3 |
| MemoryBench | 85.5 | **85.6** | 81.5 |
| Vals Finance Agent V2 | **59.1** | 56.6 | 58.6 |
| Terminal-Bench 4.0-AA | 57.1 | 52.0 | **59.6** |
| OSWorld V2.1 (부분) | 78.4 | 72.6 | **81.8** |

같은 지수에서 Claude Fable 5.1과 GPT-6 Astra는 53점이다.

세 가지가 읽힌다.

- **긴 코딩 작업에서는 Full이 앞선다.** SWE-Marathon에서 Opus 5.5보다 11점 높다. 긴 호흡의 작업을 끝까지 끌고 가는 Active Focus의 효과라고 Meta는 설명한다.
- **API 모델은 표의 윗줄이 아니다.** 종합 지수에서 Wonder API는 52점으로 Fable 5.1·Astra(53)보다 1점 낮다. Opus 5.5와는 6점 차이다.
- **컴퓨터 사용과 시각 작업은 Meta 자신의 표에서도 Opus 5.5가 앞선다.**

## 6. Active Memory와 Active Focus는 모델보다 제품 기능에 가깝다

Meta가 내세운 두 기능은 이렇다.

| 기능 | Meta의 설명 |
|---|---|
| Active Memory | 대화가 바뀌어도 중요한 맥락을 이어 가고, 지금 작업에 맞는 세부를 다시 꺼낸다 |
| Active Focus | 작업이 어려워져도 다른 접근을 시도하고, 오류에서 회복하고, 중요한 행동 전에는 확인을 구한다 |

API Wonder가 MemoryBench에서 표의 유일한 1위를 가져간 것을 보면 기억 기능은 모델 자체에도 일부 들어 있다. 다만 "대화를 넘나드는 기억"은 Muse 앱과 Muse Code 같은 제품 위에서 동작하는 기능이다. API로 붙일 때 같은 경험이 나오는지는 별개로 확인해야 한다.

## 7. 출시 직후 커뮤니티 반응은 가격과 표의 이름에 몰렸다

Hacker News에서 나온 반응을 추렸다. 개인의 짧은 사용 경험이므로 참고로만 읽는다.

- **가격**: "다른 Meta 모델과 달리 가격이 꽤 크게 뛰었다"는 반응이 먼저 나왔다.
- **표의 이름**: 마케팅 페이지의 최상위 점수가 API 모델이 아니라 Wonder Full의 것이라는 지적이 있었다.
- **시각 작업**: 이미지를 HTML로 옮기는 테스트를 해 본 사용자는 "Opus 5.5보다 훨씬 못하다"고 평가했다.
- **도구와 사용량**: 한 달을 결제했지만 Muse Code 샌드박스가 Mac과 Linux 모두에서 동작하지 않았다는 사용자가 있었다. $5 요금제에서 요청 몇 번에 주간 사용량의 14~17%가 소진됐다(보도마다 수치가 다르다)는 보고도 있었다.
- **순위 변동**: Artificial Analysis 순위가 출시 몇 시간 만에 2위에서 5위로 내려갔다는 댓글도 있었다.

## 8. 정리: 구독으로 Full을 쓸 사람과 API로 Wonder를 쓸 사람의 판단이 다르다

| 이런 경우라면 | 판단 |
|---|---|
| 긴 코딩 작업을 Muse Code 안에서 돌린다 | Power 이상에서 Full을 써 볼 가치가 있다. 학습 동의 설정부터 끈다 |
| API로 프런티어급 모델을 붙인다 | 같은 가격의 Opus 5.5보다 종합 지수가 낮다. 아직 Preview이기도 하다 |
| 싼 Meta 모델이 필요하다 | 여전히 Spark 1.3이 맞다 |
| 시각·컴퓨터 사용 에이전트 | Meta 자신의 표에서도 Opus 5.5가 앞선다 |

Meta가 반년 만에 최상위 경쟁에 들어온 것은 분명하다. 하지만 가장 좋은 숫자는 구독 안에 있고, API로 꺼낼 수 있는 모델은 한 단계 아래다. 안전성 평가 보고서도 "곧 공개"로 남아 있다.

## 10월 22일 수정: 경쟁 모델과의 독립 비교와 실사용 시연

발표 뒤에 나온 독립 지표와 실사용 시연을 덧붙인다.

### Artificial Analysis 종합 지수

| 모델 | Intelligence Index | API 가격 (입력/출력, 100만 토큰당) |
|---|---|---|
| Claude Opus 5.5 | **58** | $4 / $20 |
| Muse Wonder Full | 56 | API 없음 (Muse Code 구독) |
| GPT-6 Astra | 53 | $10 / $50 |
| Gemini 4 Argon | 53 | $2 / $10 (11월 30일까지) |
| Muse Wonder (API) | 52 | $4 / $20 |

API로 살 수 있는 Wonder는 같은 가격의 Opus 5.5보다 6점 낮고, 절반 가격인 Argon보다도 1점 낮다. 가격만 보면 API로 Wonder를 고를 이유가 약하다. Full은 GPT-6 Astra와 Meta의 14개 항목 중 11개에서 앞섰다. 다만 직접 맞붙인 실사용 비교는 찾지 못했다. 출처는 [eesel.ai 리뷰](https://www.eesel.ai/blog/meta-muse-wonder-review)다.

### 실사용 시연은 엇갈렸다

Matthew Berman이 Wonder Full로 시연한 결과를 [Stork.ai](https://www.stork.ai/blog/metas-new-ai-model-is-brilliantand-already-breaking)가 정리했다.

| 시연 | 결과 |
|---|---|
| 루빅스 큐브 | 섞는 동안 상태를 유지했고 약 4분 만에 풀었다. 가장 좋은 결과였다 |
| Fall Guys 풍 게임 | 깜빡임과 겹침이 보였다. 부드러움은 Opus 5.5보다 못했다 |
| Three.js 바다 위 배 | 물 반사는 좋았지만 그림자가 약하고 선체에 흰 잔상이 남았다 |
| 수박 물리 시뮬레이션 | 총알이 맞는 순간 화면이 흐려지고 파괴 효과가 없었다 |

- **사용량 제한에 바로 걸렸다.** 요금제를 $15에서 $50, $200으로 올렸지만, 매번 몇 분 만에 HTTP 429와 할당량 오류가 났다. Meta 쪽은 알려진 문제라고 밝혔다고 한다.
- **같은 날 [MindStudio](https://www.mindstudio.ai/blog/gemini-4-argon-vs-opus-5-5)의 야구 게임 시험**에서도 동작은 맞았지만 그림은 Argon이나 Opus 5.5보다 확연히 약했다.

벤치마크 표에서는 Opus 5.5와 비등했지만, 시각 결과물을 만드는 작업에서는 아직 한 단계 아래라는 평가가 모인다. 업무형 에이전트 작업에서는 좋은 평가도 있어서, 작업 종류에 따라 갈린다고 보는 편이 맞다.
