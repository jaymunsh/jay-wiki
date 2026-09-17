title: "M1 Max Qwen3.6: Ollama와 oMLX 속도 비교"
slug: local-llm-qwen36-ollama-omlx-benchmark
category: 기술 실험
summary: NVFP4와 OptiQ 조합을 cache·thinking 조건별로 측정해 oMLX가 빠르게 느껴진 이유와 반대 조건을 확인한 실험.
tags: apple-silicon,benchmark,local-llm,mlx,ollama,omlx,prefix-cache,qwen3.6,thinking
toc: true
publishedAt: 2026-07-20T15:00:00Z
updatedAt: 2026-08-15T15:10:08.685074Z
syncHash: 46449a9bed5ca96854a1167dc62a82442d5ef04b3a0d6b6447bb15effec81728

---
로컬 LLM runtime을 Ollama에서 oMLX로 바꾼 뒤 답변이 조금 더 빨리 나온다고 느꼈다. 하지만 같은 prompt를 눈으로 비교한 체감만으로는
runtime 차이인지, model quantization이나 cache 때문인지 설명할 수 없다. 그래서 같은 Qwen3.6-35B-A3B 계열의 두 실제 사용 조합을
동일한 Mac에서 측정했다.

- Ollama 0.30.10 + qwen3.6:35b-a3b-coding-nvfp4
- oMLX 0.5.1 + Qwen3.6-35B-A3B-OptiQ-4bit
- 14-inch MacBook Pro, M1 Max 10-core CPU·32-core GPU, unified memory 64GB

## 왜 Ollama에서 oMLX를 검토했나

Ollama는 macOS 설치, model 관리와 API 사용이 간단하고 Apple Silicon의 Metal을 공식 지원한다. 그래서 local LLM을 시작하기에는 좋은
기준점이었다. 이후 inference runtime을 조사하면서 Linux·GPU serving에서는 vLLM과 SGLang이 단순 실행 편의보다 처리량, KV cache,
batching과 prefix 재사용을 전면에 둔다는 점을 확인했다.

- vLLM은 high-throughput·memory-efficient serving과 PagedAttention 기반 KV cache 관리를 강조한다.
- SGLang은 RadixAttention, prefix caching과 multi-GPU parallelism을 사용하는 production serving framework를 표방한다.
- oMLX는 Apple Silicon과 MLX에 맞춘 inference server로 OpenAI·Anthropic compatible endpoint와 PP/TG benchmark를 제공한다.

vLLM과 SGLang을 이 Mac에서 직접 비교한 것은 아니다. 두 프로젝트를 통해 runtime 최적화가 체감 성능을 바꿀 수 있다는 문제의식을 얻었고,
Apple Silicon에서 같은 관점으로 검토할 후보로 oMLX를 골랐다. 커뮤니티의 “oMLX가 더 빠르다”는 평가를 결론으로 받아들이지 않고, 실제
14-inch M1 Max 32-core GPU·64GB에서 어느 구간에 성립하는지 측정하는 것이 이 실험의 출발점이었다.

결론은 한쪽의 완승이 아니었다. **긴 답변의 생성 속도는 oMLX가 꾸준히 빨랐고, 짧은 입력의 첫 token과 동일 prompt cache hit은
Ollama가 빨랐다.** 내가 느낀 차이는 실제였지만 모든 요청에서 oMLX가 빠르다는 의미는 아니었다.

## 먼저 무엇을 비교한 것인지 한정했다

두 model은 같은 35B-A3B base 계열이고 disk size도 22~23GB로 비슷하다. 그러나 quantization은 NVFP4와 OptiQ mixed 4/8-bit로
다르다. 이 실험은 runtime 구현만 격리한 microbenchmark가 아니라, 로컬에서 실제로 선택할 **runtime + quantized model packaging** 조합의
end-to-end 비교다.

| 항목 | Ollama | oMLX |
|---|---|---|
| model | qwen3.6:35b-a3b-coding-nvfp4 | Qwen3.6-35B-A3B-OptiQ-4bit |
| base | Qwen3.6-35B-A3B | Qwen3.6-35B-A3B |
| quantization | NVFP4 | OptiQ mixed 4/8-bit |
| disk | 약 22GB | 약 23GB |
| API | Ollama native streaming | OpenAI-compatible streaming |

따라서 결과 전체를 Ollama와 oMLX engine 차이로만 설명하지 않는다. quantization, chat template와 prefix cache 정책도 결과에 포함된다.

## 느낌을 숫자로 바꿀 기준부터 정했다

짧은 기술 설명, Java 코드 생성과 약 4K-token 주문 집계 prompt를 만들었다. 각 prompt를 thinking on/off와 prefix cache miss/hit으로
나눴다. runtime별 model cold load는 한 번만 측정하고, 이후에는 warmup 1회와 측정 3회를 순차 실행해 중앙값을 사용했다.

~~~mermaid
flowchart TB
    MODEL[Qwen3.6 35B-A3B]
    MODEL --> OLLAMA[Ollama<br/>NVFP4]
    MODEL --> OMLX[oMLX<br/>OptiQ 4/8-bit]
    OLLAMA --> MODES[thinking on / off]
    OMLX --> MODES
    MODES --> CACHE[prefix cache<br/>miss / hit]
    CACHE --> CASES[short / coding / 4K context]
    CASES --> METRICS[TTFT · PP · TG<br/>total latency · output check]
~~~

| 지표 | 의미 |
|---|---|
| TTFT | 요청부터 첫 reasoning 또는 content token까지의 체감 시작 지연 |
| visible TTFT | 실제 답변 content가 보이기 시작한 시점 |
| PP | provider가 보고한 prompt evaluation tokens/s |
| TG | provider가 보고한 generation tokens/s |
| cold | model unload 직후 첫 요청, load 비용 포함 |
| warm | model이 memory에 올라온 일상 사용 상태 |

성능 실행은 512-token 상한을 사용했고, 최종 답변 도달 여부는 별도 1,024-token 실행으로 확인했다. temperature는 0, 동시성은 1로
고정했다. 원시 실행은 총 110회이며 API key는 결과에 저장하지 않았다.

### 왜 이 측정 도구를 직접 만들었나

이 스크립트는 새로운 종합 점수를 만들지 않는다. MLPerf Client와 NVIDIA GenAI-Perf 같은 공개 inference benchmark가 사용하는 TTFT와
token 생성 처리량을 중심으로, 내가 실제 사용하는 두 streaming endpoint를 같은 client clock으로 측정한다.

- TTFT는 요청 뒤 첫 token을 보기까지의 체감 대기시간이다.
- decode tokens/s는 첫 token 이후 긴 답변이 이어지는 속도다.
- total latency는 답변이 완전히 끝날 때까지의 시간을 보완한다.
- cold·warm과 cache miss·hit 분리는 model load와 prefix 재사용을 raw 계산 성능과 섞지 않게 한다.
- visible TTFT는 reasoning 시작과 사용 가능한 답변 노출을 구분한다.

따라서 이 결과는 공식 MLPerf 점수나 model 지능 평가가 아니라 **내 M1 Max에서 실제 선택할 두 배포 조합의 end-to-end
microbenchmark**다. 같은 base 계열이지만 quantization과 packaging도 다르므로 engine 차이만으로 일반화하지 않는다. 반복 3회는 경향을
확인하는 최소 범위이며, 더 강한 주장에는 실행 순서 교차, 반복 확대, 분산·전력·memory·동시성 측정과 별도의 품질 평가가 필요하다.

## Cold load에서는 oMLX가 조금 빨랐다

| runtime | 첫 token | 512 tokens 완료 | PP | TG |
|---|---:|---:|---:|---:|
| oMLX | 13.28초 | 22.59초 | 20.61 tok/s | 54.98 tok/s |
| Ollama | 14.63초 | 24.02초 | 15.45 tok/s | 54.50 tok/s |

oMLX가 첫 token은 약 9%, 전체 완료는 약 6% 빨랐다. 단, cold는 각 runtime에서 한 번만 실행했으므로 이 수치로 일반적인 분산까지
주장하지 않는다.

## Cache miss에서는 생성 속도와 첫 응답의 승자가 달랐다

### Thinking on

| 사례 | runtime | PP | TG | TTFT | 전체 지연 |
|---|---|---:|---:|---:|---:|
| 짧은 설명 | oMLX | 119.92 | 55.30 | 0.77초 | 10.03초 |
| 짧은 설명 | Ollama | 347.76 | 51.02 | 0.32초 | 10.34초 |
| 코드 생성 | oMLX | 122.35 | 54.91 | 0.88초 | 10.21초 |
| 코드 생성 | Ollama | 320.03 | 50.98 | 0.37초 | 10.44초 |
| 긴 문맥 | oMLX | 429.29 | 51.13 | 9.52초 | 19.53초 |
| 긴 문맥 | Ollama | 435.68 | 50.12 | 9.40초 | 19.62초 |

### Thinking off

| 사례 | runtime | PP | TG | TTFT | 전체 지연 |
|---|---|---:|---:|---:|---:|
| 짧은 설명 | oMLX | 136.13 | 60.38 | 0.70초 | 2.45초 |
| 짧은 설명 | Ollama | 322.53 | 51.71 | 0.33초 | 1.91초 |
| 코드 생성 | oMLX | 117.47 | 54.21 | 0.92초 | 10.32초 |
| 코드 생성 | Ollama | 299.18 | 49.99 | 0.40초 | 10.53초 |
| 긴 문맥 | oMLX | 433.03 | 53.44 | 9.44초 | 14.47초 |
| 긴 문맥 | Ollama | 384.37 | 49.78 | 10.65초 | 14.89초 |

oMLX의 TG는 모든 cache miss 사례에서 빨랐다. thinking on 세 사례 평균은 53.78 대 50.71 tok/s, off는 56.01 대 50.49 tok/s로
약 6~11% 차이다. 답변이 길게 streaming되는 동안 oMLX가 더 빠르다고 느낀 근거가 된다.

반면 짧은 prompt의 PP와 TTFT는 Ollama가 앞섰다. 약 4K tokens의 긴 문맥에서는 차이가 줄었고 thinking off에서는 oMLX가 PP와 전체
지연에서 조금 앞섰다. 따라서 짧은 질문의 즉각적인 반응과 긴 답변의 지속 생성은 서로 다른 지표로 봐야 한다.

## Cache hit의 10만 tok/s는 raw 성능이 아니다

같은 prompt를 반복하자 Ollama의 PP는 짧은 요청에서 약 1,700~2,700 tok/s, 긴 문맥에서 10만 tok/s 이상으로 올라갔다. 이 숫자는
M1 Max가 매초 10만 token을 새로 계산했다는 뜻이 아니라 prefix cache가 계산을 재사용한 결과다.

| mode | 사례 | oMLX PP | Ollama PP | oMLX cached tokens |
|---|---|---:|---:|---:|
| on | 짧은 설명 | 99.84 | 2,164.50 | 0 |
| on | 코드 생성 | 114.69 | 2,562.88 | 0 |
| on | 긴 문맥 | 821.48 | 105,505.93 | 2,048 |
| off | 짧은 설명 | 113.64 | 1,761.20 | 0 |
| off | 코드 생성 | 114.59 | 2,661.16 | 0 |
| off | 긴 문맥 | 719.49 | 105,648.61 | 2,048 |

oMLX usage에는 긴 문맥에서 2,048 cached tokens가 명시됐고 짧은 prompt는 cache block 경계에 미치지 못했다. Ollama는 짧은 동일
prompt에도 큰 cache 효과를 보였다. agent처럼 같은 system prompt와 긴 대화를 이어가는 환경에서는 model의 raw 속도뿐 아니라 cache block과
재사용 정책이 체감 성능을 크게 바꾼다.

그래서 runtime의 입력 계산 비교에는 cache miss 표를 사용하고, cache hit은 별도의 실사용 최적화 결과로 해석했다.

## Thinking은 token/s보다 답변 도달 여부를 먼저 봐야 했다

512-token 실행에서 thinking on은 두 runtime 모두 추론에 상한을 대부분 사용했다.

- Ollama는 세 사례 모두 visible content가 나타나기 전에 512 tokens에 도달했다.
- oMLX는 reasoning stream 뒤 length 종료 시 reasoning 내용이 content에도 나타나 정상 최종 답변으로 판정하지 않았다.
- thinking off에서는 모든 반복의 reasoning character가 0이었다.
- thinking off의 짧은 설명은 양쪽 모두 2.5초 안에 사용 가능한 답변을 완료했다.

별도 1,024-token 실행에서도 Ollama의 thinking on 코드·긴 문맥은 최종 답변에 도달하지 못했다. oMLX도 정상 최종 답변 대신 reasoning이
visible content에 포함됐다. thinking을 켜는 옵션만으로는 부족하며 token budget, reasoning budget과 length 종료 처리까지 함께 정해야 한다.

## 빠르다고 정확한 것은 아니었다

긴 문맥에는 ORDER-001부터 ORDER-180까지의 구조화된 기록을 넣고 RETRY count, amount sum과 ID 목록을 요구했다. 정답은 26건,
110,175다.

| 조합 | 출력 결과 | 판정 |
|---|---|---|
| oMLX, thinking off | ID 26개는 맞음, count 18·sum 42,306 | 실패 |
| Ollama, thinking off | ID 26개는 맞음, count 18·sum 24,666 | 실패 |

두 출력 모두 올바른 26개 ID를 나열하고도 집계 숫자가 목록과 모순됐다. 짧은 락 설명은 둘 다 정확했고 Java 예제도 멱등 key와 transaction
흐름을 포함했지만 compile·test까지 검증하지 않았으므로 품질 통과로 과장하지 않았다.

이 실패 때문에 속도와 정확도를 하나의 종합 점수로 합치지 않았다. token/s는 runtime 성능의 증거일 뿐 model이 업무를 정확히 수행한다는
증거가 아니다.

## oMLX 선택은 조건부로 타당했다

이번 구성에서 oMLX로 바꾼 판단은 긴 coding·agent 답변의 지속 생성 속도를 우선한다면 타당했다. TG는 모든 cache miss에서 빨랐고 cold load도
이번 실행에서는 조금 앞섰다.

하지만 다음 조건에서는 Ollama의 장점이 컸다.

- 짧은 prompt의 첫 token을 빨리 받아야 할 때
- 동일한 짧은 prompt나 긴 prefix를 반복할 때
- cache hit을 적극적으로 활용하는 단일 요청 workflow

현재 나의 결론은 **oMLX가 더 빠르다**가 아니라 다음과 같다.

> oMLX는 긴 답변의 지속 생성이 약 6~11% 빨라 기존 체감을 설명했다. Ollama는 짧은 입력의 첫 응답과 동일 prefix cache hit이 더
> 빨랐다. thinking과 정확도는 runtime 속도와 별도로 검증해야 한다.

## 측정 근거 자료를 남겼다

- 측정 스크립트는 이 사이트 저장소의 scripts/benchmark-local-llm.mjs다. 저장소가 아직 비공개라 아래 공개 자료는 측정 조건과
  결과를 검토하는 근거만 제공한다. 제3자가 동일 실행을 재현하려면 스크립트 공개가 추가로 필요하다.
- [실험 계획 원문](/api/assets/publications/local-llm/2026-07-21-m1-max/plan.md)
- [전체 결과 원문](/api/assets/publications/local-llm/2026-07-21-m1-max/result.md)
- [원시 JSON](/api/assets/publications/local-llm/2026-07-21-m1-max/raw.json)
- [SHA-256 manifest](/api/assets/publications/local-llm/2026-07-21-m1-max/SHA256SUMS)

~~~bash
node scripts/benchmark-local-llm.mjs --engine both --iterations 3 \
  --output docs/benchmarks/local-llm/2026-07-21-m1-max.json
~~~

## 공식 자료

- [Ollama qwen3.6:35b-a3b-coding-nvfp4](https://ollama.com/library/qwen3.6:35b-a3b-coding-nvfp4)
- [mlx-community Qwen3.6-35B-A3B-OptiQ-4bit](https://huggingface.co/mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit)
- [oMLX GitHub](https://github.com/jundot/omlx)
- [vLLM](https://vllm.ai/)
- [SGLang](https://docs.sglang.io/)
- [MLPerf Client](https://mlcommons.org/benchmarks/client/)
- [NVIDIA GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html)
