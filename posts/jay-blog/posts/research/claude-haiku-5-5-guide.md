---
title: "Claude Haiku 5.5 정리: 입력 $0.10, 1M 컨텍스트, 그리고 100K에서 갈리는 가격표"
slug: claude-haiku-5-5-guide
category: 리서치
summary: 2026년 10월 7일 공개된 Claude Haiku 5.5의 스펙과 가격, GPT-6 Luna·Sonnet 5.5와의 공식 벤치마크 비교, 토크나이저 변화가 실제 비용에 미치는 영향, Haiku 4.5에서 옮길 때 깨지는 API 동작을 정리한 리서치.
tags: anthropic,api-pricing,benchmark,claude,haiku-5-5,llm,research,small-model,subagent
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/119 (내려받음)
---
> **이 글의 대상**: 요약·분류·서브에이전트처럼 호출량이 많은 작업에 작은 모델을 쓰는 개발자. 특히 "75% 저렴해졌다"는 발표가 내 워크로드에서도 그대로인지, Haiku 4.5에서 바로 바꿔도 되는지 확인하려는 사람.

> **출처 및 기준일**: 1차 출처는 [Anthropic의 Haiku 5.5 발표](https://www.anthropic.com/claude-haiku-5-5)와 [모델 문서](https://platform.claude.com/docs/en/models/haiku-5-5/overview.md)다. 실측과 API 변경점은 [ComputingForGeeks의 출시 리뷰](https://computingforgeeks.com/claude-haiku-5-5-released-features-benchmarks/), 가격 해석은 [braindetox의 가격표 분석](https://braindetox.kr/en/posts/claude_haiku_5_5_release_pricing_2026.html)을 참고했다. 공개일은 미국 시간 10월 7일이고, 본문의 판정 기준일은 10월 8일이다. 그 뒤에 나온 독립 평가는 마지막 「10월 22일 수정」에 따로 모았다.

## 1. 작은 모델의 가격이 한 자릿수 센트로 내려왔다

에이전트를 붙여 쓰다 보면 비싼 모델이 하는 일의 상당 부분이 사실 단순 작업이다. 긴 로그를 요약하고, 파일 목록을 분류하고, 검색 결과를 추린다. 이런 호출을 큰 모델로 돌리면 청구액이 쌓이고, 작은 모델로 돌리면 품질이 아쉬웠다.

Haiku 5.5는 이 자리를 노린 모델이다. Anthropic은 "지금까지 낸 작은 모델 중 가장 싸고, 빠르고, 유능하다"고 소개했다. 100K 토큰 이하 요청의 입력 가격은 100만 토큰당 $0.10이다. Haiku 4.5의 $1.00과 비교하면 10분의 1이다.

## 2. 스펙은 4.5에서 한 세대를 건너뛰었다

| 항목 | Haiku 5.5 | Haiku 4.5 |
|---|---|---|
| 모델 ID | `claude-haiku-5-5` | `claude-haiku-4-5-20251001` |
| 컨텍스트 | 1M 토큰 | 200K 토큰 |
| 최대 출력 | 128K (Batch 베타로 300K) | 64K |
| 지식 기준일 | 2026년 6월 | 2025년 2월 |
| 사고 방식 | adaptive thinking, 기본 켜짐 | `budget_tokens` 수동 지정 |
| effort 설정 | low · medium · high · xhigh · max (기본 medium) | 없음 |
| 토크나이저 | Sonnet 5.5·Opus 5.5와 같은 새 계열 | 이전 계열 |

가장 큰 변화는 effort 설정이다. Haiku 계열에서는 처음으로, 같은 모델 안에서 비용과 지능을 저울질할 수 있게 됐다. 다만 이 선택은 결과에 크게 영향을 준다. 공식 수치를 보면, GDPval-AA 점수가 max에서 1620인데 기본값인 medium에서는 1277로 내려간다.

## 3. 가격표는 100K 토큰에서 두 개로 갈린다

| 100만 토큰당 | Haiku 5.5 (100K 이하) | Haiku 5.5 (100K 초과) | Haiku 4.5 | Sonnet 5.5 |
|---|---|---|---|---|
| 입력 | $0.10 | $0.50 | $1.00 | $2.00 |
| 출력 | $0.50 | $2.50 | $5.00 | $10.00 |
| 캐시 쓰기 (5분) | $0.125 | $0.625 | $1.25 | $2.50 |
| 캐시 읽기 | $0.01 | $0.05 | $0.10 | $0.10 |
| Batch 입력 / 출력 | $0.05 / $0.25 | $0.25 / $1.25 | $0.50 / $2.50 | $1.00 / $5.00 |

여기서 두 가지를 놓치기 쉽다.

- **100K를 넘으면 요청 전체가 비싼 쪽으로 계산된다.** 넘은 부분만 비싸지는 것이 아니다. 출력과 캐시까지 다섯 배 가격이 적용된다. 현재 Claude 모델 중 긴 컨텍스트 가격 구간이 따로 있는 것은 Haiku 5.5뿐이다.
- **100K는 Haiku 5.5의 토큰으로 센다.** 4.5에서 9만 토큰이던 프롬프트가 5.5에서는 100K를 넘을 수 있다. 이유는 다음 절의 토크나이저다.

같은 날 Sonnet 5.5의 캐시 읽기 가격도 $0.20에서 $0.10으로 반값이 됐다. Anthropic은 이 변경으로 대부분의 에이전트 작업에서 Sonnet 5.5가 약 20% 싸진다고 설명했다.

## 4. "75% 저렴"은 토큰이 30% 늘어난 것까지 반영한 평균이다

문서에 따르면 새 토크나이저는 같은 텍스트를 Haiku 4.5보다 **약 30% 많은 토큰**으로 센다. ComputingForGeeks가 2만 자짜리 샘플 여섯 개로 잰 값은 다음과 같다.

| 텍스트 종류 | 토큰 수 비율 (5.5 ÷ 4.5) |
|---|---|
| 영어 산문 | 1.36배 |
| Python | 1.29배 |
| Bash | 1.35배 |
| YAML | 1.36배 |
| JSON | 1.11배 |

토큰당 가격이 90% 내려도 토큰 수가 1.3배가 되면 실제 비용은 87% 정도 내려간다. 여기에 100K를 넘는 요청은 50%만 내려간다는 점을 섞은 평균이 발표의 "약 75%"다. Anthropic은 4.5에서 요청의 90%가 100K 이하였다고 밝혔지만, 75%를 계산한 가중치는 공개하지 않았다. 그래서 내 워크로드의 절감률은 **요청 길이 분포를 직접 넣어 계산해야 한다.** 짧은 요청 위주라면 80%대, 긴 문서 위주라면 절반 수준에 가깝다.

## 5. 공식 벤치마크에서는 GPT-6 Luna를 모든 항목에서 앞섰다

Anthropic이 비교 상대로 고른 것은 같은 가격대의 GPT-6 Luna다. Luna의 API 가격도 입력 $0.10, 출력 $0.50으로 Haiku 5.5와 같다. 아래는 Haiku 5.5의 max effort 기준 공식 수치다.

| 벤치마크 | Haiku 5.5 | Haiku 4.5 | GPT-6 Luna | Sonnet 5.5 (참고) |
|---|---|---|---|---|
| GDPval-AA v2.1 (Elo) | 1620 | 735 | 1437 | 1840 |
| AA-Briefcase v1.1 (Elo) | 1578 | 614 | 1336 | 1824 |
| OSWorld 2.1 (오프라인 부분집합) | 72.4% | 15.7% | 48.9% | 83.9% |
| Humanity's Last Exam (도구 없음) | 45.9% | 10.2% | – | 56.9% |
| Terminal-Bench 4.0 | 39.2% | 0.0% | 16.4% | 70.6% |
| FrontierCode 1.1 Main | 46.4% | – | 42.4% | 52.1% |
| Chartography (도구 없음) | 46.4% | 6.4% | 29.1% | 61.6% |

두 항목이 눈에 띈다. OSWorld가 15.7%에서 72.4%로 오른 것은 브라우저·컴퓨터 사용 작업에 Haiku를 쓸 수 있게 됐다는 뜻이다. 반대로 Terminal-Bench 4.0은 39.2%로 Sonnet 5.5의 70.6%와 차이가 크다. Anthropic도 복잡한 에이전트 코딩에는 Sonnet이나 Opus를 쓰라고 권했다.

SWE-bench Verified, GPQA Diamond, AIME 같은 익숙한 지표는 이번에 공개하지 않았다. 다른 작은 모델과 비교할 때 같은 표에 놓을 수 있는 공통 지표가 적다는 점은 감안해야 한다.

## 6. 권장 용도는 큰 모델 옆에서 일하는 서브에이전트다

발표에서 권장한 용도는 이렇다.

- 요약, 컨텍스트 압축, DB 질의, 분류처럼 반복량이 많은 작업
- Opus 5.5나 Sonnet 5.5가 주도하는 코딩 작업의 서브에이전트
- 실시간 고객 응대와 브라우저 사용처럼 속도가 중요한 작업

고객사 인용도 이 방향과 맞는다. HubSpot은 자체 평가 세트에서 "지금까지 본 최고 점수인 92.8%(3회 평균)"를 얻었다고 했고, Box는 "Haiku 4.5보다 11점 높으면서 지연 시간은 절반"이라고 했다. Cognition은 Devin의 보조 모델 목록에 Haiku 5.5를 넣었다.

## 7. Haiku 4.5에서 옮길 때 바로 깨지는 요청이 있다

모델 ID만 바꾸면 400 오류가 나는 경우가 여럿 있다. ComputingForGeeks가 정리한 변경점 중 실무에서 자주 걸릴 것을 추렸다.

| 4.5에서 되던 것 | 5.5에서 |
|---|---|
| `temperature`를 1이 아닌 값으로 지정 | 400 오류 |
| `top_k` 지정 | 값과 관계없이 400 오류 |
| `thinking.budget_tokens` 수동 지정 | 거부. adaptive thinking과 `effort`로 바꿔야 한다 |
| assistant 메시지 prefill | 거부 |
| `effort: max`에서 thinking 끄기 | 실패. thinking은 high 이하에서만 끌 수 있다 |

또 하나, 사고 토큰도 `max_tokens`에 포함된다. `max_tokens`를 4.5 때처럼 빠듯하게 두면 사고만 하다가 `stop_reason: max_tokens`로 끝나고 본문이 비어 돌아올 수 있다. 같은 리뷰에서 기본 medium의 첫 글자 지연이 2.66초로, thinking을 끈 low의 0.59초보다 길었다. 실시간 응답에 쓸 때는 effort와 thinking 설정을 함께 정해야 한다.

## 8. 정리: 짧은 요청을 많이 보내는 쪽이 가장 크게 이긴다

| 이런 경우라면 | 판단 |
|---|---|
| 100K 이하의 요약·분류·추출을 대량으로 돌린다 | 가장 큰 수혜자다. 바로 옮길 가치가 있다 |
| 큰 모델 밑에서 서브에이전트로 쓴다 | 권장 용도다. effort를 low~medium으로 두고 비용을 본다 |
| 긴 문서를 통째로 넣는다 | 100K를 넘으면 절감 폭이 절반으로 줄어든다. 토큰 수부터 다시 재 본다 |
| 터미널 중심의 복잡한 코딩 에이전트 | 여전히 Sonnet 5.5 이상이 맞다 |

가격 경쟁만 보면 GPT-6 Luna와 같은 가격에 공식 지표에서는 앞선다. 다만 토크나이저 때문에 같은 작업의 토큰 수가 달라지므로, 두 모델의 실제 비용은 단가가 아니라 같은 작업을 돌린 청구액으로 비교해야 한다.

## 10월 22일 수정: 발표 뒤에 나온 독립 평가

발표 직후에는 공식 수치뿐이었다. 그 뒤에 나온 독립 평가와 반응을 덧붙인다.

- **Artificial Analysis Intelligence Index**: 최고 설정에서 43점이다. Gemini 3.8 Flash는 41점, GPT-6 Luna는 38점이다. 다만 effort에 따라 high에서는 38점, medium에서는 34점으로 내려간다. 같은 사이트에서 Terminal-Bench 4.0을 측정한 결과는 33%로, 공식 수치 39.2%보다 낮았다.
- **속도**: 같은 사이트의 측정으로 effort에 따라 초당 137~243 토큰이 나왔다. Haiku 4.5는 90 토큰이었다.
- **환각률**: AA-Omniscience에서 40%로 Haiku 4.5와 비슷했다. GPT-6 Luna의 77%보다는 낮다. "모르면 모른다고 말하는 편"이라는 평가가 여기서 나왔다.
- **시스템 카드의 약점**: 자동 행동 감사에서 테스트한 모델 중 거절이 가장 많았다. 그리고 테스트가 기대 정답을 흘렸을 때 이를 밝히지 않고 쓴 비율이 17%로, Haiku 4.5의 2%보다 높았다.
- **비용 대비**: 한 비교 보고서는 GPT-6 Luna가 비슷한 성능을 약 3분의 1 비용으로 낸다고 평가했다. 지표를 어디에 두느냐에 따라 "Haiku가 더 똑똑하다"와 "Luna가 더 싸다"가 동시에 성립한다.

출처: [Artificial Analysis의 Haiku 5.5 페이지](https://artificialanalysis.ai/models/releases/claude-haiku-5-5), [eesel.ai 리뷰](https://www.eesel.ai/ja/blog/claude-haiku-5-5-rebyu), [ComputingForGeeks](https://computingforgeeks.com/claude-haiku-5-5-released-features-benchmarks/)

### 같은 급 모델과 나란히 놓으면

Artificial Analysis가 같은 조건으로 잰 값이다. 발표 다음 날 [Latent Space AINews](https://www.latent.space/p/ainews-claude-haiku-55-better-than)가 표로 정리했다.

| 지표 | Haiku 5.5 | GPT-6 Luna | Gemini 3.8 Flash | GLM-5.3 Flash |
|---|---|---|---|---|
| Intelligence Index (최고 설정) | **43** | 38 | 41 | 42 |
| Terminal-Bench 4.0 | **33%** | 13% | 20% | **33%** |
| 사실 회상 정확도 (AA-Omniscience) | 36% | 44% | **55%** | 측정 없음 |
| 환각률 (낮을수록 좋음) | **40%** | 77% | 55% | 측정 없음 |
| AutomationBench-AA | 35% | 53~60% | 53~60% | 53~60% |
| Index 과제당 출력 토큰 | 약 162K | 약 50K | 측정 없음 | 측정 없음 |

- **추론과 코딩에서는 앞서고, 아는 것의 양에서는 뒤진다.** 정확도는 가장 낮지만 모를 때 지어내는 비율도 가장 낮다.
- **AutomationBench의 35%는 출시 전 버그 탓이 크다.** 거절을 과하게 하는 안전 버그가 있었고, Anthropic이 수정 중이라고 밝혔다.
- **토큰을 세 배 쓴다.** high 설정에서는 약 55K 토큰으로 38점을 내서, Luna의 최고 설정과 점수·토큰이 거의 같다. 과제당 비용은 Haiku 약 $0.21, Luna 약 $0.07로 계산됐다. 100K 토큰 위의 5배 가격 구간은 아직 반영되지 않은 잠정치다.

### 커뮤니티 반응

출시 당일 X에서 나온 반응은 대체로 "Luna보다 낫다"였다.

- "GPT-6 Luna보다 훨씬 낫고 Sonnet 5.5에 더 가깝다. 싸고 똑똑하다." (@kimmonismus)
- "최고 설정의 Haiku는 프런티어 모델처럼 동작한다." (@draecomino)
- Simon Willison은 10배 비싼 Haiku 4.5보다 "훨씬 낫다"고 적었다.
- "Opus가 비쌀 때는 Sonnet이 말이 됐다"는 반응도 있었다(@altryne). Haiku가 올라오면서 중간 등급의 자리가 애매해졌다는 지적이다.

다만 이 반응들은 대부분 짧은 시연 한두 개에 근거한다. 위 표에서 보듯 사실 회상과 업무 자동화에서는 경쟁 모델이 앞서고, 토큰 사용량까지 넣으면 과제당 비용은 Luna가 싸다.
