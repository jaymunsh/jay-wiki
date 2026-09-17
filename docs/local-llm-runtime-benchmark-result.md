# M1 Max에서 Ollama NVFP4와 oMLX OptiQ를 비교한 결과

측정일: 2026-07-21
원시 데이터: `docs/benchmarks/local-llm/2026-07-21-m1-max.json`
실행 도구: `scripts/benchmark-local-llm.mjs`

## 결론부터 말하면

“oMLX가 항상 빠르다”는 가설은 성립하지 않았다. 대신 사용 중 느낀 차이를 두 부분으로 설명할 수 있었다.

1. **생성 속도는 oMLX가 일관되게 빨랐다.** cache miss 기준 thinking on 평균은 53.78 대 50.71 tok/s, off는 56.01 대
   50.49 tok/s였다. 긴 답변이 streaming되는 동안에는 oMLX가 약 6~11% 빠르게 느껴질 수 있다.
2. **짧은 입력의 첫 응답은 Ollama가 빨랐다.** cache miss의 짧은 두 prompt에서 Ollama TTFT는 약 0.32~0.40초,
   oMLX는 약 0.70~0.92초였다.
3. **동일 prompt 재사용은 Ollama가 매우 공격적으로 cache했다.** 긴 문맥 cache hit의 provider PP가 10만 tok/s 이상으로
   나타난 것은 순수 Metal prefill 속도가 아니라 이전 prompt를 재사용한 결과다.
4. **thinking on/off는 raw token 생성 속도보다 사용 가능한 답변의 시작 시점을 크게 바꿨다.** thinking on에서는 512 tokens를
   모두 추론에 사용해 최종 답변이 나타나지 않는 사례가 많았다.
5. **속도와 정확도는 별개였다.** 긴 주문 집계에서 두 조합 모두 26개 ID를 올바르게 나열하고도 count와 sum을 틀렸다.

따라서 나의 체감은 일부 확인됐다. oMLX는 답변이 본격적으로 생성되는 구간에서 더 빨랐지만, 첫 token, prefix cache와 짧은 요청까지 포함하면
Ollama가 앞서는 조건도 분명했다.

## 비교 대상

| 항목 | Ollama | oMLX |
|---|---|---|
| runtime | Ollama 0.30.10 | oMLX 0.5.1 |
| model | qwen3.6:35b-a3b-coding-nvfp4 | Qwen3.6-35B-A3B-OptiQ-4bit |
| base 계열 | Qwen3.6-35B-A3B | Qwen3.6-35B-A3B |
| 양자화 | NVFP4 | OptiQ mixed 4/8-bit |
| on-disk | 약 22GB | 약 23GB |
| 장비 | 14-inch MacBook Pro, Apple M1 Max 10-core CPU·32-core GPU, unified memory 64GB | 동일 |

이는 runtime만 격리한 비교가 아니다. 양자화, model packaging, chat template와 cache 전략을 포함해 실제로 선택할 두 로컬 배포 조합을 비교했다.

## 왜 Ollama에서 oMLX를 검토했나

Ollama는 macOS 설치, model 관리와 API 사용이 간단하고 Apple Silicon의 Metal을 공식 지원한다. 그래서 local LLM을 시작하기에는 좋은
기준점이었다. 이후 inference runtime을 조사하면서 Linux·GPU serving에서는 vLLM과 SGLang이 단순 실행 편의보다 처리량, KV cache,
batching과 prefix 재사용을 전면에 둔다는 점을 확인했다.

vLLM은 high-throughput·memory-efficient serving과 PagedAttention을, SGLang은 RadixAttention·prefix caching·multi-GPU serving을
강조한다. 이 둘을 Mac에서 직접 비교한 것은 아니다. 대신 runtime 최적화가 체감 성능을 바꿀 수 있다는 문제의식을 얻었고, Apple Silicon과
MLX에 맞춰 OpenAI-compatible server와 PP/TG benchmark를 제공하는 oMLX를 후보로 선택했다.

따라서 “커뮤니티에서 oMLX가 빠르다고 했다”를 결과로 받아들이지 않았다. 동일 계열 model을 실제 14-inch M1 Max 32-core GPU·64GB에서 Ollama와
oMLX로 실행해, 그 평가가 내 사용 조건에서도 성립하는 구간과 그렇지 않은 구간을 직접 확인했다.

## 실험 설계

- 짧은 기술 설명, Java 코드 생성, 약 4K-token 주문 집계의 세 prompt를 사용했다.
- thinking on/off와 prefix cache miss/hit을 별도 조합으로 실행했다.
- 각 조합은 warmup 1회 후 3회 측정하고 중앙값을 대표값으로 사용했다.
- 성능 측정은 최대 512 tokens, 답변 완결성 확인은 별도 최대 1,024 tokens로 실행했다.
- temperature는 0, 동시성은 1로 고정했다.
- runtime별 cold load 1회만 측정하고 두 모델을 동시에 memory에 올리지 않았다.
- TTFT와 전체 지연은 같은 Node client 시계로, PP·TG는 각 provider가 보고한 token count와 duration으로 계산했다.

cache miss에서는 매 요청의 첫 줄을 바꿔 prefix 전체 재사용을 막았다. cache hit에서는 같은 prompt를 반복했다.

## 이 측정 도구가 의미 있는 이유

`scripts/benchmark-local-llm.mjs`는 model 지능을 하나의 점수로 평가하는 도구가 아니다. MLPerf Client와 NVIDIA GenAI-Perf에서도 사용하는
TTFT와 token 생성 처리량을 중심으로, 내가 실제 사용하는 두 streaming endpoint를 같은 client clock과 요청 조건으로 측정한
end-to-end microbenchmark다.

짧은 응답의 첫 token, 긴 답변의 지속 생성, cold load, prefix cache와 thinking 뒤 visible content를 분리했다. 덕분에 “체감상
oMLX가 빨랐다”를 한 숫자로 뭉개지 않고 어떤 구간에서 왜 달랐는지 설명할 수 있다. 원시 JSON에는 개별 실행값과 환경 version을 남겨 표를
다시 계산할 수 있다.

다만 공식 MLPerf 결과나 engine 단독 비교라고 부르지 않는다. 양자화와 model packaging도 다르고 반복은 3회이며 동시성·전력·peak memory를
측정하지 않았다. 따라서 이 결과의 주장 범위는 **M1 Max 한 대에서 실제 사용할 두 배포 조합의 선택 근거**까지다. coding 정확도와 범용
지능은 compile·test 또는 HumanEval+·lm-evaluation-harness 같은 별도 평가가 필요하다.

## Cold load

| runtime | 첫 token | 전체 512 tokens | provider PP | provider TG |
|---|---:|---:|---:|---:|
| oMLX | 13.28초 | 22.59초 | 20.61 tok/s | 54.98 tok/s |
| Ollama | 14.63초 | 24.02초 | 15.45 tok/s | 54.50 tok/s |

oMLX가 첫 token은 약 9%, 전체 완료는 약 6% 빨랐다. 다만 한 번씩만 실행한 cold 값이므로 분산을 대표하지는 않는다.

## Cache miss: 실제 입력을 다시 계산할 때

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

짧은 prompt의 PP와 TTFT는 Ollama가 크게 앞섰다. prompt가 약 4K tokens로 길어지면 차이가 줄었고 thinking off에서는 oMLX의 PP와
전체 지연이 오히려 조금 앞섰다. TG는 모든 cache miss 사례에서 oMLX가 빨랐다.

## Cache hit: 동일 문맥을 다시 사용할 때

| mode | 사례 | oMLX PP | Ollama PP | oMLX cached tokens | 해석 |
|---|---|---:|---:|---:|---|
| thinking on | 짧은 설명 | 99.84 | 2,164.50 | 0 | Ollama만 짧은 prefix 재사용 효과가 큼 |
| thinking on | 코드 생성 | 114.69 | 2,562.88 | 0 | 동일 |
| thinking on | 긴 문맥 | 821.48 | 105,505.93 | 2,048 | 양쪽 cache hit, 전략과 보고 방식 차이가 큼 |
| thinking off | 짧은 설명 | 113.64 | 1,761.20 | 0 | Ollama만 짧은 prefix 재사용 효과가 큼 |
| thinking off | 코드 생성 | 114.59 | 2,661.16 | 0 | 동일 |
| thinking off | 긴 문맥 | 719.49 | 105,648.61 | 2,048 | 양쪽 cache hit |

이 표의 10만 tok/s를 하드웨어의 raw prefill 성능으로 읽으면 안 된다. Ollama는 동일 prompt를 짧은 입력에서도 재사용했고, oMLX usage에는
긴 문맥에서 2,048 cached tokens가 명시됐다. oMLX는 block boundary를 기준으로 cache snapshot을 저장하는 현재 설정의 특성이 드러났다.

실제 agent처럼 공통 system prompt와 긴 대화 prefix를 반복하는 사용에서는 cache 정책이 체감 속도를 크게 바꾼다. 반면 model 자체의 입력 계산
속도를 비교하려면 cache miss 표를 사용해야 한다.

## Thinking on/off에서 확인한 것

512-token 처리량 실행에서 thinking on은 두 runtime 모두 추론에 상한을 대부분 사용했다.

- Ollama는 세 사례 모두 visible content가 나타나기 전에 512 tokens에 도달했다.
- oMLX는 reasoning stream 후 length 종료 시 raw reasoning이 content에도 나타나는 형태여서, 이를 정상 최종 답변으로 판정하지 않았다.
- thinking off에서는 reasoning character가 모든 반복에서 0이었다.
- thinking off의 짧은 설명은 두 runtime 모두 2.5초 안에 사용 가능한 답변을 끝냈다.

별도 1,024-token 실행에서도 thinking on의 코드와 긴 문맥은 Ollama에서 최종 답변이 나타나지 않았고, oMLX도 정상적인 최종 답변 대신 reasoning
내용이 visible content에 포함됐다. 이 model을 실사용할 때는 단순히 thinking을 켜는 것뿐 아니라 충분한 token budget, reasoning budget과
length 종료 처리도 함께 설계해야 한다.

## 최소 품질 확인

| 사례 | oMLX thinking off | Ollama thinking off | 판정 |
|---|---|---|---|
| 락 설명 | 낙관·비관 락과 재고 사례 구분 | 동일 | 둘 다 통과 |
| Java 멱등 주문 | 멱등 키·transaction·실패 흐름 포함 | 멱등 키·lock·transaction 흐름 포함 | 실행 검증 전, 구조만 확인 |
| 긴 주문 집계 | ID 26개를 나열했으나 count 18, sum 42,306 | ID 26개를 나열했으나 count 18, sum 24,666 | 둘 다 실패 |

정답은 count 26, amount sum 110,175다. 두 출력 모두 ID 목록은 맞았지만 집계 숫자가 목록과 모순됐다. 이 실패는 token/s가 비슷하거나
빠르다는 사실이 정확성을 보장하지 않는다는 직접적인 증거다.

## 최종 판단

oMLX로 바꾼 뒤 더 빠르다고 느낀 것은 근거가 있었다. 모델이 memory에 올라온 상태에서 텍스트를 계속 생성하는 TG는 oMLX가 모든 cache miss
사례에서 빨랐고, thinking off 평균 차이는 약 11%였다. cold load도 이번 한 번의 실행에서는 oMLX가 앞섰다.

그러나 짧은 요청의 TTFT와 cache 재사용은 Ollama가 더 빨랐다. 따라서 다음과 같이 선택 기준을 정리할 수 있다.

- 긴 coding·agent 응답에서 지속 생성 속도를 우선하면 현재 구성의 oMLX가 유리하다.
- 짧은 prompt를 반복하거나 동일 prefix 재사용이 많은 단일 요청에서는 Ollama의 cache가 강하다.
- thinking을 켤 때는 runtime 선택보다 token budget과 최종 답변 도달 여부가 더 중요하다.
- 어느 쪽도 이번 긴 문맥 집계 정확도를 통과하지 못했으므로 성능 결과만으로 model 품질을 주장하지 않는다.

이번 결과는 14-inch M1 Max 10-core CPU·32-core GPU·64GB 한 대, 각 runtime과 quantization 한 조합의 측정이다. 재현 시에는 원시 JSON, runtime version, model tag와
cache mode를 함께 남겨야 비교 의미가 유지된다.

## 공식 자료

- [Ollama qwen3.6:35b-a3b-coding-nvfp4](https://ollama.com/library/qwen3.6:35b-a3b-coding-nvfp4)
- [mlx-community Qwen3.6-35B-A3B-OptiQ-4bit](https://huggingface.co/mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit)
- [oMLX GitHub](https://github.com/jundot/omlx)
- [vLLM](https://vllm.ai/)
- [SGLang](https://docs.sglang.io/)
- [MLPerf Client](https://mlcommons.org/benchmarks/client/)
- [NVIDIA GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html)

## 공개 증거 보관

스크립트와 문서는 Git을 기준 원본으로 유지한다. 측정일별 원시 JSON, 계획, 결과와 SHA-256 manifest는 MinIO의 불변 경로에 복제한다.
MinIO는 누구나 별도 개발 환경 없이 브라우저에서 자료를 확인하고 내려받을 수 있는 공개 benchmark 자료실 역할을 맡는다. 비공식 실험이기
때문에 오히려 요약만 보여주기보다 원시 자료와 계산 조건을 함께 공개하는 편이 낫다.

파일 저장소로 사용하는 것 자체는 문제가 없다. 관리 Console과 credential은 비공개로 유지하고 공개 경로는 read-only로 제한하며, 같은
측정 ID의 파일을 덮어쓰지 않고 SHA-256으로 무결성을 확인하는 것이 운영 기준이다.

공개 링크는 MinIO endpoint를 직접 노출하지 않고 same-origin proxy로 제공한다. 현재 benchmark 전용 공개 route가 구현되기 전이므로 이
문서에는 동작하지 않는 URL을 미리 싣지 않았으며, route 배포 후 HTTP 200과 checksum 일치를 확인한 링크만 추가한다.
