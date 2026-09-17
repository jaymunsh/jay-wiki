# 로컬 LLM 런타임 비교 실험 계획

작성일: 2026-07-21

## 실험 질문

14-inch MacBook Pro의 M1 Max 10-core CPU·32-core GPU·64GB unified memory 환경에서 같은 Qwen3.6-35B-A3B 계열을 사용할 때
다음 실제 조합의 응답 체감과 처리량은 얼마나 다른가?

- Ollama 0.30.10 + qwen3.6:35b-a3b-coding-nvfp4
- oMLX 0.5.1 + Qwen3.6-35B-A3B-OptiQ-4bit

이 실험은 런타임만 격리한 microbenchmark가 아니다. NVFP4와 OptiQ 혼합 4/8-bit라는 양자화 차이, 각 서버의 chat template 처리와
cache 전략까지 포함한 **로컬에서 실제 선택할 두 배포 조합**을 비교한다.

## oMLX를 비교 대상으로 선택한 배경

처음에는 설치와 model 관리가 간단하고 macOS를 공식 지원하는 Ollama를 사용했다. 이후 local LLM serving을 조사하면서 Linux·GPU 서버에서는
vLLM과 SGLang이 고처리량·저지연 serving, 효율적인 KV cache와 batching을 핵심 목표로 삼는다는 점을 확인했다. 단순히 model을 실행하는
것과 inference runtime의 처리 효율을 최적화하는 것은 다른 문제였다.

- vLLM은 자신을 high-throughput, memory-efficient inference and serving engine으로 설명하며 PagedAttention 기반 KV cache 관리를 강조한다.
- SGLang은 RadixAttention, prefix caching과 multi-GPU parallelism을 사용하는 production serving framework를 표방한다.
- oMLX는 Apple Silicon과 MLX에 맞춘 local inference server이며 OpenAI·Anthropic compatible endpoint와 자체 PP/TG benchmark를 제공한다.
- Ollama는 macOS Apple Silicon과 Metal을 공식 지원하고 설치·model 관리·API 사용이 간단해 기준 조합으로 유지할 가치가 있다.

vLLM과 SGLang은 이번 Mac 실험의 직접 비교 대상이 아니다. 그 프로젝트들을 통해 runtime 최적화의 중요성을 알게 됐고, Apple Silicon에서 같은
관점으로 검토할 수 있는 후보로 oMLX를 선택했다. 커뮤니티의 “더 빠르다”는 평가를 결론으로 사용하지 않고 실제 장비에서 측정해 확인하는 것이
이번 실험의 출발점이다.

## 비교가 성립하는 이유와 한계

두 모델은 Qwen3.6-35B-A3B라는 같은 base 계열이고 on-disk size도 약 22GB로 비슷하다. 동일한 Mac에서 같은 prompt와 생성 옵션을
사용하면 사용자가 경험하는 runtime 조합의 차이를 수치화할 수 있다.

다만 다음 결론은 내릴 수 없다.

- 측정값 전체를 Ollama와 oMLX 엔진 구현 차이로만 설명할 수 없다.
- NVFP4와 OptiQ의 출력 품질이 동일하다고 가정할 수 없다.
- 한 대의 M1 Max 결과를 다른 Apple Silicon과 일반화할 수 없다.
- client-observed TTFT로 순수 Metal kernel prefill 성능을 단정할 수 없다.

## 통제 조건

| 조건 | 고정값 |
|---|---|
| 장비 | 14-inch MacBook Pro, Apple M1 Max 10-core CPU·32-core GPU, unified memory 64GB |
| 요청 방식 | 각 서버의 OpenAI-compatible streaming chat endpoint |
| sampling | temperature 0, thinking on/off를 별도 측정 |
| system message | 동일 문구 |
| prompt | 짧은 설명, Java 코드 생성, 긴 주문 목록 집계의 세 종류 |
| 출력 상한 | 처리량은 512 tokens, 답변 완결성 확인은 별도 1,024 tokens |
| 실행 순서 | engine별 cold load 1회, 각 mode·cache·case별 warmup 1회와 warm 3회 |
| 동시성 | 1, 순차 요청 |
| cache 구분 | model unload 뒤 cold와 상주 상태의 warm을 분리 |
| prefix cache | 매번 첫 prefix를 바꾸는 miss와 완전히 같은 prompt를 재사용하는 hit을 분리 |

## 지표 정의

| 지표 | 계산 | 해석 |
|---|---|---|
| TTFT | 요청 전송부터 첫 reasoning 또는 content token까지 | queue, HTTP, template, tokenize와 prefill을 포함한 체감 시작 지연 |
| visible TTFT | 요청 전송부터 사용자에게 보이는 첫 content token까지 | thinking 이후 실제 답변이 보이기 시작하는 지연 |
| total latency | 요청 전송부터 stream 종료까지 | 한 응답을 모두 받는 데 걸린 시간 |
| effective prompt tok/s | prompt token 수 / TTFT | 순수 prefill이 아닌 end-to-end 유효 입력 처리량 |
| decode tok/s | completion token 수 / 첫 token 이후 종료 시간 | 사용자가 텍스트를 받는 구간의 유효 생성 처리량 |
| provider PP·TG | 서버가 보고한 prompt eval·generation duration 기반 tok/s | client overhead를 뺀 runtime 자체 보고값 |
| cold result | runtime별 unload 직후 첫 짧은 요청 | model load 비용이 포함된 첫 실행 경험 |
| warm median | warm 3회의 중앙값 | 일상적인 모델 상주 상태의 대표값 |

평균은 일시적인 지연에 민감하므로 중앙값을 대표값으로 사용하고 평균·최소·최대도 함께 보존한다. 원시 실행 결과와 출력 일부는 JSON에
남겨 결과를 다시 계산할 수 있게 한다.

## 지표를 이렇게 선택한 근거

이 스크립트는 새로운 종합 성능 점수를 만들지 않는다. LLM inference 도구와 공개 benchmark에서 일반적으로 구분하는 다음 두 사용자 경험을
같은 방식으로 측정한다.

- TTFT는 요청 뒤 첫 token을 보기까지의 대기시간이다. MLPerf Client와 NVIDIA GenAI-Perf도 interactive inference의 대표 latency로 사용한다.
- decode tokens/s는 첫 token 이후 답변이 이어지는 속도다. 짧은 질의의 반응성과 긴 coding 답변의 지속 생성 속도를 분리하기 위해 필요하다.
- total latency는 token 생성이 끝날 때까지의 end-to-end 시간으로, TTFT나 tokens/s 한 지표만으로 놓치는 실제 완료 시간을 보완한다.
- cold와 warm, cache miss와 hit은 model load 및 prefix 재사용을 raw prefill 성능과 섞지 않기 위한 조건 분리다.
- visible TTFT는 reasoning token이 먼저 streaming되는 model에서 내부 추론 시작과 사용 가능한 답변 노출을 구분한다.

따라서 측정 지표에는 외부 기준이 있지만, 이 스크립트 자체는 MLPerf·GenAI-Perf의 공식 구현이나 공인 결과가 아니다. 같은 client와 시계로 두
로컬 endpoint를 호출해 **내 장비에서 실제 선택할 배포 조합의 체감 성능을 재현하는 목적별 microbenchmark**다.

## 이 실험이 답할 수 있는 범위

다음 질문에는 답할 수 있다.

- 이 M1 Max에서 두 실제 배포 조합 중 어느 쪽이 첫 응답과 지속 생성에 유리한가?
- model load, prefix cache와 thinking이 체감 지연을 얼마나 바꾸는가?
- 속도가 빨라도 고정된 최소 과업을 틀리는 사례가 있는가?

다음 질문에는 이 결과만으로 답하지 않는다.

- oMLX engine 자체가 모든 model과 장비에서 Ollama보다 빠른가?
- NVFP4와 OptiQ가 같은 품질을 보장하는가?
- model의 일반적인 coding·추론 능력이 더 우수한가?
- 동시 사용자가 많은 serving 환경에서도 같은 순위가 유지되는가?

현재 3회 반복은 개인 장비의 경향을 확인하기 위한 최소 범위다. 더 강한 주장에는 반복 5회 이상, 실행 순서 교차, 분산 지표, 전력·메모리와
동시성 측정이 필요하다. coding 품질은 compile·test, 일반 품질은 HumanEval+나 lm-evaluation-harness 같은 별도 평가로 보완한다.

## 품질 확인

속도가 빠르더라도 요구를 수행하지 못하면 실사용 비교가 아니다. 성능 수치와 별도로 다음만 최소 확인한다.

- 짧은 설명이 낙관적 락과 비관적 락의 차이를 정확히 구분하는가
- Java 예제가 멱등성 키, transaction 경계와 동시 요청을 실제 코드에 포함하는가
- 긴 문맥 집계의 count, 합계와 ID 목록이 원본 데이터와 일치하는가

정확도 평가는 별도 표로 기록하며 token/s와 하나의 종합 점수로 합치지 않는다.

## 추론 모드 비교

각 runtime과 prompt를 thinking on, thinking off로 나눠 실행한다. on에서는 reasoning과 visible content를 합친 completion token 처리량을
기록하되, 첫 reasoning token과 첫 visible content의 지연을 따로 남긴다. off에서는 reasoning character가 실제로 0인지 확인한다.

이를 통해 다음 두 질문을 분리한다.

- runtime이 token을 얼마나 빠르게 생성하는가
- 사용자가 최종 답변을 보기까지 thinking이 얼마나 추가 지연을 만드는가

## Prefix cache 비교

같은 prompt를 반복하면 runtime의 prefix cache가 입력 계산을 재사용해 순수 prefill보다 지나치게 높은 수치가 나올 수 있다. 따라서 다음 두 결과를
한 표에 섞지 않는다.

- cache miss: prompt 첫 줄의 실험 ID를 매번 바꿔 prefix 재사용을 막고 실제 입력 처리량을 측정한다.
- cache hit: 동일 prompt를 반복해 agent처럼 공통 문맥을 재사용할 때의 이득을 측정한다.

대표적인 runtime prefill 비교에는 cache miss 중앙값을 사용하고, cache hit는 별도의 실사용 최적화 결과로 제시한다.

## 재현 명령

~~~bash
node scripts/benchmark-local-llm.mjs --engine both --iterations 3 \
  --output docs/benchmarks/local-llm/2026-07-21-m1-max.json
~~~

API key는 oMLX의 로컬 settings에서 실행 시 읽기만 하며 결과 파일이나 console에 기록하지 않는다.

## 근거 자료

- Ollama model registry: qwen3.6:35b-a3b-coding-nvfp4, 약 22GB
- mlx-community model card: Qwen3.6-35B-A3B-OptiQ-4bit, mixed 4/8-bit OptiQ
- oMLX 공식 문서: OpenAI-compatible streaming usage와 built-in PP/TG benchmark
- vLLM 공식 사이트: high-throughput, memory-efficient inference and serving 목표
- SGLang 공식 문서: RadixAttention, prefix caching과 multi-GPU serving 특성
- MLPerf Client: TTFT와 첫 token 이후 TPS를 client LLM 성능 지표로 정의
- NVIDIA GenAI-Perf: TTFT, output token throughput, inter-token latency와 request throughput을 제공

## 증거 파일 공개 원칙

실행 스크립트, 계획과 해석 문서는 Git을 기준 원본으로 둔다. diff와 commit history가 있어 측정 로직과 해석이 언제 바뀌었는지 검토할 수 있기
때문이다. MinIO는 누구나 브라우저에서 결과를 내려받을 수 있는 공개 benchmark 자료실로 사용한다. 측정일별 원시 JSON과 당시 문서 snapshot,
checksum manifest를 불변 경로로 복제한다.

~~~text
benchmarks/local-llm/2026-07-21-m1-max/
  raw.json
  plan.md
  result.md
  SHA256SUMS
~~~

MinIO를 파일 저장소로 쓰는 것이 문제인 것은 아니다. 오히려 비공식 실험일수록 원시 자료를 쉽게 검토할 수 있게 공개하는 편이 신뢰에 도움이
된다. 다만 관리 Console·credential과 공개 read 경계를 분리하고, 파일을 덮어쓰지 않으며 측정일과 checksum으로 결과를 식별한다.

위키에는 MinIO 내부 endpoint나 만료되는 presigned URL을 저장하지 않는다. 공개용 same-origin route가 구현된 뒤
`/api/assets/benchmarks/local-llm/2026-07-21-m1-max/...` 형태로 연결한다. 이 경로가 실제로 배포되고 HTTP 200과 checksum을 확인하기
전까지는 저장소 상대 경로만 표시한다.
