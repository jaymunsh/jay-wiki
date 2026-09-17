# Apple Silicon LLM 실행 도구 리서치 — MLX 가 바닥이 된 뒤의 지형 (2026-08-17)

- Mac 에서 로컬 LLM 을 돌리는 도구는 여럿이지만, **2026 년의 바닥은 MLX 하나**다. Ollama 도 Apple Silicon 에서는 그 위에 서 있다.
- 그래서 선택 기준이 "무엇이 빠른가"에서 **"어떤 껍데기를 쓸 것인가"**로 옮겨갔다.
- 이 저장소에는 M1 Max 64GB 에서 직접 잰 값이 있다 — 생성은 oMLX 가 6~11% 빨랐고, 짧은 요청의 첫 응답은 Ollama 가 두 배 이상 빨랐다.

수치의 출처를 항목마다 갈라 적는다. **직접 잰 것과 남의 숫자를 섞지 않는다.**

## MLX 가 무엇인가

Apple 이 만든 배열·머신러닝 프레임워크다. NumPy·PyTorch 자리에 있는 것이지 실행 도구가 아니다.
로컬 LLM 이야기에서 MLX 가 계속 나오는 이유는 **Apple Silicon 의 구조를 전제로 설계됐기 때문**이다.

| 설계 | 무엇이 달라지나 |
|---|---|
| 통합 메모리 위에서 zero-copy | CPU ↔ GPU 로 가중치를 복사하지 않는다. 옮기는 시간과 중복 메모리가 사라진다 |
| 지연 평가(lazy evaluation) | 배열을 바로 계산하지 않고 필요할 때 만든다. 그 사이에 연산을 합칠 수 있다 |
| 함수 변환으로 커널 융합 | 여러 연산을 Metal 커널 하나로 묶는다 |
| M5 의 Neural Accelerator 사용 | 이 하드웨어를 llama.cpp 는 안 쓴다 |

llama.cpp 의 Metal 백엔드와 갈리는 지점이 마지막 줄이다. llama.cpp 는 본래 CUDA 계열 패턴을
Metal 셰이더로 옮긴 구조라, 애플이 칩에 넣은 회로를 그대로 못 쓴다. 그래서 같은 모델·같은
양자화에서 **MLX 가 일관되게 빠르다**는 보고가 이어졌고, 2026-03 에 **Ollama 가 Apple Silicon
백엔드를 MLX 로 갈아탔다.**

즉 지금 Mac 에서 "무엇이 빠른가"를 묻는 것은 대부분 의미가 없어졌다. **대부분이 같은 엔진을 쓴다.**

## 도구 지형

| 도구 | 정체 | Apple Silicon 백엔드 | 인터페이스 |
|---|---|---|---|
| **MLX / mlx-lm** | 프레임워크와 그 위의 LLM 도구 | 자기 자신 | 파이썬 라이브러리 + `mlx_lm.server` |
| **Ollama** | 모델 관리·실행 도구 | **MLX** (2026-03 전환) | CLI + OpenAI 호환 API(11434) |
| **LM Studio** | GUI 앱 | MLX 엔진 + GGUF(llama.cpp) 자동 전환 | 데스크톱 앱 + 헤드리스 서버 |
| **oMLX** | MLX 기반 서버, 코딩 에이전트 용도에 맞춤 | MLX | OpenAI 호환 서버 + PP/TG 벤치 |
| **llama.cpp** | C/C++ 레퍼런스 구현 | Metal(자체) | `llama-server`, 세밀한 제어 |
| **vLLM** | 서버용 엔진 | **없음** (Linux + NVIDIA/AMD) | 참고용. Mac 대상이 아니다 |

vLLM 을 표에 남긴 이유는 하나다. **처리량 이야기는 대부분 vLLM 기준**이라, Mac 숫자와 섞으면
안 된다는 것을 표에서 바로 보이게 하려는 것이다.

## 성능 — 출처를 갈라 본다

### 직접 잰 것 (이 저장소, M1 Max 64GB, 2026-07-21)

`docs/local-llm-runtime-benchmark-result.md` 의 값이다. 같은 계열 모델(Qwen3.6-35B-A3B)을
같은 장비에서 두 조합으로 돌렸다. **runtime 만 격리한 비교가 아니라 실제로 고를 두 배포 조합의 비교다.**

| 조건 | Ollama 0.30.10 (NVFP4) | oMLX 0.5.1 (OptiQ 4/8bit) |
|---|---|---|
| 생성 속도, thinking on | 50.71 tok/s | **53.78 tok/s** |
| 생성 속도, thinking off | 50.49 tok/s | **56.01 tok/s** |
| 짧은 프롬프트 TTFT | **0.32~0.40초** | 0.70~0.92초 |
| on-disk | 약 22GB | 약 23GB |

읽을 점은 **"항상 빠른 쪽은 없다"** 이다. 답변이 흐르는 구간은 oMLX 가 6~11% 빨랐고,
짧은 요청의 첫 글자는 Ollama 가 두 배 이상 빨랐다. 체감은 이 둘 중 무엇을 많이 하느냐로 갈린다.

### 같은 하드웨어(M1 Max 64GB)에서 잰 공개 비교 — 우리 결론과 일치한다

우리 장비와 **같은 M1 Max 64GB** 에서 런타임 셋을 비교한 공개 측정이 있다(macOS 26.2,
temperature 0, 2026-05~06). 재현이 안 된 초기 세션을 버리고 다시 잰 값이라고 적혀 있다.

**Llama 3.2 3B Instruct 4비트**

| 런타임 | 짧은 프롬프트 디코드 | 긴 프롬프트 프리필 | 긴 프롬프트 디코드 |
|---|---|---|---|
| mlx-lm | **67.63** | 423 | 52.5 |
| mlxcel (Rust MLX) | 63.33 | 약 430 | 약 55 |
| Ollama 0.20.7 (GGUF Q4_K_M) | 48.73 | **440** | 41.8 |

**Qwen 2.5 7B Instruct 4비트, 짧은 프롬프트**

| 런타임 | 프리필 | 디코드 |
|---|---|---|
| mlx-lm | 102.15 | **31.80** |
| mlxcel | 96.62 | 31.33 |
| Ollama 0.20.7 | **125.85** | 24.23 |

**여기서 우리 측정과 같은 모양이 나온다** — 디코드는 MLX 계열이 앞서고(약 29~30% 차),
**프리필은 Ollama 가 오히려 빠르다.** 우리가 M1 Max 에서 본 것도 정확히 이 구조였다:
생성 속도는 oMLX 가 앞서고 짧은 요청의 TTFT 는 Ollama 가 두 배 이상 빨랐다.

측정자는 양자화가 bit-identical 이 아니라는 것도 적어 뒀다(MLX 4비트 약 4.5 bits/weight,
Q4_K_M 약 4.85 bits/weight). 다만 그 차이로는 30% 격차가 설명되지 않고 커널 구현 차이로 본다.

또 하나 — mlxcel 이 README 에 적은 "프리필 2.7배"는 **M5 Max 에서만 나온 값**이고,
M1 Max 에서는 셋 다 420~440 tok/s 로 사실상 같았다. **세대가 다르면 이야기가 달라진다.**

### MLX 의 약점 — 긴 입력에서 TTFT 가 무너진다

같은 맥락에서 보고된 것이 하나 더 있다. MLX 는 **토큰을 하나도 안 내보내고 프리필을 끝낸다.**
그래서 입력이 길어질수록 TTFT 가 선형으로 늘어난다. 한 사례에서는 M1 Max 에 8.5K 토큰을
넣었을 때 **디코드는 51 tok/s 로 보고되는데 프리필까지 포함한 실효 처리량은 약 3 tok/s** 로
떨어졌다.

이것이 oMLX 가 KV 캐시를 SSD 에 남기는 이유이자, 긴 문맥을 반복해서 넣는 작업에서
런타임 선택이 실제로 갈리는 지점이다.

### 한 장비에서 도구를 다섯 가지로 갈아 끼운 측정 (Mac mini M2 Pro 32GB)

도구를 가장 많이 넣은 비교다. 전원을 꽂고 매번 유휴를 확인, 워밍업 1회 버리고 3회 측정, temperature 0.

| 모델 | rapid-mlx | llama.cpp | Ollama | LM Studio (GGUF) | LM Studio (MLX) |
|---|---|---|---|---|---|
| gpt-oss-20b | 46.7 | 42.6 | 32.1 | 42.2 | **48.1** |
| Qwen3.6-35B-A3B | **58.5** | 38.3 | 39.0 | — | — |
| Gemma4-12B | 21.3 | 18.3 | 18.0 | 18.0 | **22.0** |

**가장 값진 줄은 LM Studio 두 칸이다.** 같은 앱·같은 모델인데 백엔드만 GGUF → MLX 로 바꾸면
42.2 → 48.1 이다. **도구를 바꾸는 것보다 그 도구가 어느 백엔드로 도는지가 더 크다.**
Ollama 자료가 서로 어긋났던 것도 같은 이야기다.

양자화가 도구마다 미세하게 다르다는 것도 적혀 있다(Q4_K_M 약 4.8 bpw 대 MLX 4비트 약 4.5 bpw).

### 도구 비교가 사실은 버전 비교인 경우

M3 Max 36GB · Qwen2.5-Coder-7B Q4 측정에서는 **raw llama.cpp 53.5, Ollama 46.2(-14%),
LM Studio 38.2(-29%)** 였다. LM Studio 가 뒤진 이유로 적힌 것은 설계가 아니라
**번들된 llama.cpp 가 상류보다 뒤처져 있었다**는 것이다. 버전 차이를 도구 차이로 읽으면 안 된다.

### M5 Pro 64GB · 모델 넷 (Ollama · MLX · llama.cpp)

| 모델 | Ollama | MLX | llama.cpp |
|---|---|---|---|
| Llama 3.3 8B Q4 | 48 | 62 | 52 |
| Llama 3.3 8B Q8 | 38 | 48 | 40 |
| Llama 3.3 70B Q4 | 10 | 14 | 11 |
| Mistral Small Q4 | 52 | 66 | 55 |
| Phi-4 Q4 | 58 | 72 | 60 |

여기서는 MLX 가 15~25% 앞선다. 앞의 3배 차이와도, 동률 사례와도 다르다.
**세대·모델·버전이 바뀌면 격차가 이렇게 흔들린다는 것 자체가 결론이다.**

### 다른 하드웨어에서의 통제 비교

아래는 장비가 다르다. 위 M1 Max 표와 **가로질러 비교하면 안 된다.**

**하나. M4 Max 128GB · Qwen3.5-35B-A3B · 런타임 셋** (Ante Kapetanovic, macOS 26.3)

| 런타임 | 양자화 | 생성 속도 |
|---|---|---|
| MLX (파이썬 API) | MLX 4-bit group | **131.8 tok/s** |
| MLX (HTTP 서버) | 같음 | 107.6 tok/s |
| llama.cpp | Unsloth Dynamic Q4_K_XL | 약 71 tok/s |
| Ollama | Q4_K_M | 48.1 tok/s |

방법이 적혀 있어 신뢰할 만하다 — 워밍업 1회 + 측정 10회, 엔진 4 × thinking 2 × 파라미터 2 조합으로
총 160회. **다만 양자화가 런타임마다 다르다**(Q4_K_M / Q4_K_XL / MLX 4-bit). 앞서 적은 함정이
여기서도 그대로 나타난다 — 순수한 런타임 비교가 아니다.

같은 MLX 라도 **파이썬으로 직접 부르는 것과 HTTP 서버를 지나는 것이 131.8 대 107.6** 으로 갈린다는
점도 실용적이다. 서버 계층이 20% 가까이 먹는다.

**둘. Mac Studio M4 Max 64GB · Qwen 계열 넷 · 4비트** (Homelabcraft)

| 모델 | Ollama | MLX |
|---|---|---|
| Qwen3.5 0.8B | 97 | **371 tok/s** |
| Qwen3.5 9B | 38 | 83 |
| Qwen3 30B-A3B (MoE) | 82 | 113 |
| Qwen2.5-Coder 32B | 22 | 24 |

**작은 모델일수록 차이가 크다.** 32B 에서는 22 대 24 로 거의 붙는다. 모델이 커질수록 메모리 대역폭이
병목이 되어 런타임 최적화가 묻히는 것으로 읽힌다. 같은 측정에 MBPP·GSM8K 정확도도 같이 있는데,
**속도 차이와 정확도는 별개**라는 우리 결론과 같다.

**셋. 그런데 서로 어긋나는 자료가 있다** (llmcheck.net, 256입력·512출력·3회 평균)

같은 모델·같은 양자화로 엔진을 갈아 끼운 표에서 **Mistral 7B Q4_K_M · M5 Max 는 Ollama 102,
MLX 102 로 같다.** 위 두 자료에서는 Ollama 가 크게 뒤졌는데 여기서는 동률이다.

설명이 되는 가설은 하나다 — **Ollama 는 2026-03 부터 Apple Silicon 에서 MLX 를 쓴다.**
그렇다면 동률이 정상이고, 크게 뒤진 측정은 그 경로를 안 탔거나(모델·설정에 따라) 구버전이었을
가능성이 크다. **즉 "Ollama 가 느리다"가 아니라 "Ollama 가 어느 백엔드로 도느냐에 달렸다"** 로
읽는 편이 안전하다. 우리 측정(50 대 56 tok/s, 약 10% 차)이 3배 차이가 아니었던 것도 이쪽에 가깝다.

**넷. 하드웨어 축 참고** (arXiv, MLX v0.30.6 · MLX 4비트)

| 모델 | M3 Ultra | M4 Pro |
|---|---|---|
| GLM-4.7 30B MoE | 55.0 | 53.6 |
| Llama-3.3 70B dense | 13.1 | 5.1 |
| Qwen3-Next 80B MoE | 49.1 | **52.3** |

MoE 에서는 **M4 Pro 가 M3 Ultra 를 앞선다.** 논문은 단일 다이 대 이중 다이의 지연 차이로 설명한다.
dense 70B 에서는 반대로 메모리 대역폭이 지배해 M3 Ultra 가 2.5배 앞선다.
**칩 등급이 높다고 항상 빠른 것이 아니라 모델 구조에 따라 뒤집힌다.**

### 남의 숫자 (하드웨어와 조건이 제각각이다)

| 보고 | 하드웨어 | 값 |
|---|---|---|
| Ollama 백엔드 교체 효과 (llama.cpp → MLX) | M5 Max, Qwen3.5-35B-A3B | 디코드 58 → **112 tok/s** |
| MLX 대 Ollama(구 llama.cpp 백엔드) | M4 Pro mini, Qwen3-Coder-30B-A3B | 약 130 대 43 tok/s |
| MLX 대 llama.cpp 일반화 | Apple Silicon 전반 | MLX 가 **30~50% 빠름** |
| llama.cpp Metal | M4 Max | 약 89 tok/s |

**이 표를 서로 비교하면 안 된다.** 칩도 모델도 양자화도 다르다. 여기서 얻을 것은
순위가 아니라 "백엔드 교체로 두 배 가까이 달라진 사례가 보고됐다" 정도다.

### oMLX 가 노리는 자리

oMLX 는 코딩 에이전트를 겨냥한다. **KV 캐시를 SSD 에 남겨** 같은 접두사를 다시 보낼 때
TTFT 를 30~90초에서 1~3초로 줄인다는 것이 핵심 주장이다. 긴 코드베이스를 반복해서
집어넣는 작업에서 값이 나오는 설계다.

우리 측정에서 oMLX 의 짧은 프롬프트 TTFT 가 오히려 느렸던 것과 어긋나지 않는다 —
**짧은 새 요청에는 그 장치가 도움이 안 되고, 긴 반복 요청에서 값을 낸다.**

## MTP — 지금 가장 큰 속도 레버

MTP(Multi-Token Prediction)는 **한 번에 다음 토큰 하나가 아니라 여럿을 내다보는** 방식이다.
모델이 학습 때부터 t 시점의 상태에서 t+2 를 예측하는 머리(head)를 함께 갖고 나오면,
추론에서 그것을 써서 여러 토큰을 미리 뽑고 검증한다.

투기적 디코딩(speculative decoding)과 목적은 같고 방법이 다르다.

| | 초안 모델 방식 | MTP |
|---|---|---|
| 필요한 것 | 작은 초안 모델을 **따로** 띄운다 | 모델 자체의 MTP 헤드 |
| 메모리 | 모델 둘 | 하나 |
| 지원 | `mlx-lm` 서버가 `--draft-model` 로 지원 | 런타임이 헤드를 읽어야 한다 |

**정확도는 안 깎인다.** 미리 뽑은 토큰을 원래 모델 분포로 검증(rejection sampling)하므로,
결과 분포는 MTP 를 안 쓴 것과 같다. 공짜로 얻는 것은 속도뿐이라는 점이 중요하다.

지원 상태는 이렇다.

| 런타임 | 상태 |
|---|---|
| LM Studio | **0.4.14 부터 지원.** 단 GGUF/llama.cpp 경로에 한한다. 모델도 MTP 판이어야 한다(예: Qwen3.6-35B-A3B-MTP-GGUF) |
| mlx-lm | 투기적 디코딩은 있고(`--draft-model`), **네이티브 MTP 는 PR 단계**(#990, Qwen3.5/3.6 레퍼런스 구현) |
| mlx-vlm | 없다. 요청만 올라와 있다 |

한 측정에서는 **MTP 만으로 토큰 속도가 약 40% 올랐다**고 보고됐다(M3 Max).
백엔드를 바꾸는 것 다음으로 큰 레버가 여기 있다.

## 양자화 포맷을 헷갈리지 않기

Mac 에서 도구를 고르면 포맷도 따라온다. 이름이 많아 보이지만 결이 넷이다.

| 포맷 | 성격 | 어디서 |
|---|---|---|
| **GGUF** | llama.cpp 계열의 파일 포맷. Q4_K_M 처럼 **레이어마다 비트를 섞는다**(대부분 4비트, 어텐션 일부는 6비트) | llama.cpp, LM Studio, 예전 Ollama |
| **MLX 양자화** | 별도 포맷이라기보다 **MLX 안의 가중치 표현**. safetensors + config 디렉터리 | MLX 계열 전부 |
| **NVFP4 / MXFP4** | 4비트 **부동소수점**. 정수 양자화보다 동적 범위를 유지한다 | MLX 양자화 도구가 지원 |
| **OptiQ** | 레이어별 민감도를 따로 재서 **필요한 층만 비트를 올린다**. 평균 4비트로 fp16 품질을 노린다 | oMLX 계열 |

우리 측정이 Ollama NVFP4 대 oMLX OptiQ 였던 것도 이 때문이다. **런타임을 바꾸면 포맷이 같이
바뀌므로, 순수한 런타임 비교는 사실상 불가능하다.** 그 한계를 측정 문서에도 적어 뒀다.

## 얼마나 쓰이는가

속도만큼 중요한 것이 사용자 수다. 막혔을 때 검색해서 답이 나오느냐가 거기서 갈린다.
공개 지표 중 검증이 쉬운 저장소 별을 2026-08-17 에 GitHub API 로 직접 조회했다.

| 저장소 | 별 | 최근 push |
|---|---|---|
| ollama/ollama | 178,688 | 2026-08-16 |
| ggml-org/llama.cpp | 124,147 | 2026-08-16 |
| menloresearch/jan | 44,021 | 2026-08-14 |
| ml-explore/mlx | 27,992 | 2026-08-16 |
| ml-explore/mlx-lm | 6,642 | 2026-08-12 |
| lmstudio-ai/lms | 5,182 | 2026-08-13 |

**인기 순위로 읽으면 틀린다.** LM Studio 는 앱 본체가 비공개이고 저 저장소는 CLI 뿐이라
실제 사용자 수를 반영하지 않는다. MLX 도 프레임워크라 최종 사용자가 별을 누를 이유가 적다.

읽을 것은 둘이다. **Ollama 가 압도적**이고 문서·튜토리얼에서 기본값처럼 등장한다는 것,
그리고 **LM Studio 는 비개발자가 로컬 LLM 을 처음 만나는 통로**라는 것이다.
업데이트 속도도 갈린다 — Ollama 는 새 모델이 몇 시간 안에 올라오고, LM Studio 는 월 단위로
안정성을 우선한다. 위의 "번들 llama.cpp 가 뒤처져 느렸다" 가 그 부작용이다.

## 무엇을 고를 것인가

| 상황 | 고를 것 | 이유 |
|---|---|---|
| 처음 시작 | **Ollama** | 설치·모델 관리가 가장 단순하고, Apple Silicon 이면 어차피 MLX 로 돈다 |
| 화면으로 고르고 싶다 | **LM Studio** | 모델 브라우저와 GUI. MTP 를 지금 켜 볼 수 있는 유일한 경로이기도 하다 |
| 코딩 에이전트로 긴 문맥을 반복 | **oMLX** | SSD KV 캐시로 재요청 TTFT 를 줄이는 설계 |
| 직접 양자화하거나 파인튜닝 | **mlx-lm** | 프레임워크에 가장 가깝다 |
| 세밀한 제어·비Mac 이식 | **llama.cpp** | 옵션이 가장 많다 |
| 동시 사용자 처리량 | vLLM | **Mac 이 아니다.** Linux + NVIDIA/AMD |

## 이 문서의 한계

직접 잰 것은 2026-07-21 의 한 조합뿐이다(M1 Max 64GB, Qwen3.6-35B-A3B 계열, Ollama 0.30.10 대
oMLX 0.5.1). 나머지 수치는 전부 남의 측정이고 하드웨어·모델·양자화가 제각각이라 **표 사이를
가로질러 비교하면 안 된다.**

특히 MTP 효과 40% 는 다른 칩(M3 Max)에서 나온 한 건이다. 우리 장비에서 재려면 LM Studio 로
MTP 판 GGUF 를 올려 켜고 끈 값을 각각 재야 한다. **그것이 이 리서치에서 이어질 다음 측정이다.**

## 출처

- [MLX 대 llama.cpp, M5 Neural Accelerator, Ollama 가 갈아탄 이유](https://yage.ai/share/mlx-apple-silicon-en-20260331.html)
- [Ollama·LM Studio·vLLM·llama.cpp·MLX 비교표](https://codersera.com/blog/ollama-vs-lm-studio-vs-vllm-vs-llama-cpp-vs-mlx-2026/)
- [Apple Silicon 로컬 LLM 가이드 (2026)](https://codersera.com/blog/apple-silicon-llms-complete-guide-2026/)
- [MLX 대 llama.cpp 벤치마크 비교](https://www.compute-market.com/blog/mlx-vs-llama-cpp-apple-silicon-2026)
- [GGUF 대 MLX 양자화 포맷 실무 비교](https://contracollective.com/blog/gguf-vs-mlx-quantization-formats-apple-silicon-2026)
- [mlx-optiq FAQ — 레이어별 민감도 양자화](https://mlx-optiq.com/docs/faq)
- [LM Studio 0.4.14 의 MTP 지원 안내](https://x.com/lmstudio/status/2057889028578455905)
- [mlx-lm 네이티브 MTP 투기적 디코딩 PR #990](https://github.com/ml-explore/mlx-lm/pull/990)
- [MTP 실측 (M3 Max)](https://www.rotecodefraktion.de/en/blog/mlx-mtp-mtplx-test-m3-max/)
- [**M1 Max 64GB 에서 mlx-lm·mlxcel·Ollama 비교** (kubesimplify)](https://blog.kubesimplify.com/mlxcel-rust-native-inference-engine-tested-on-m1-max)
- [Ollama·llama.cpp·MLX 통제 비교, M4 Max 128GB Qwen3.5-35B-A3B](https://antekapetanovic.com/blog/qwen3.5-apple-silicon-benchmark/)
- [Apple Silicon 추론 최적화 가이드 — MLX 의 프리필 TTFT 문제](https://blog.starmorph.com/blog/apple-silicon-llm-inference-optimization-guide)
- [Mac Studio M4 Max 에서 Qwen 계열 넷을 Ollama·MLX 로 비교](https://homelabcraft.com/posts/local-llm-benchmarks-mac-studio/)
- [모델·칩·양자화별 tok/s 모음 (llmcheck)](https://llmcheck.net/benchmarks)
- [**M2 Pro 한 대에서 도구 다섯 설정 비교** (rapid-mlx)](https://rapidmlx.com/blog/rapid-mlx-vs-ollama-benchmark)
- [M5 Pro 에서 Ollama·MLX·llama.cpp, M3 Max 의 LM Studio 지연 사례 (PromptQuorum)](https://www.promptquorum.com/local-llms/mlx-vs-ollama-vs-llama-cpp-mac)
- 저장소 별·최근 push: GitHub API 로 2026-08-17 직접 조회
- [Silicon Showdown — 소비자 하드웨어 LLM 추론 (arXiv)](https://arxiv.org/html/2605.00519v2)
- 직접 측정: `docs/local-llm-runtime-benchmark-result.md`, 원시 데이터 `docs/benchmarks/local-llm/2026-07-21-m1-max.json`
