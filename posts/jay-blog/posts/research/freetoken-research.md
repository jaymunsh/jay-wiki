---
title: "VRAM이 부족해도 RAM으로 초대형 MoE를 돌린다: FreeToken 해부"
slug: freetoken-research
category: 리서치
summary: VRAM에 들어가지 않는 초대형 MoE의 expert 가중치를 호스트 RAM에 두고, GPU VRAM은 캐시로 활용하는 FreeToken을 살펴본다. 대역폭 적응형 실행, 에이전트용 캐싱의 구조와 논문 성능 수치, 독립 검증의 한계, 직접 확인할 때의 주의점을 함께 정리한다.
tags: benchmark,cuda,edge-ai,freetoken,gpu,kv-cache,llm-inference,moe,nvidia,offloading,research
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/30 (내려받음)
---
> 이 글은 FreeToken 논문과 공개된 구현·리뷰를 바탕으로 기술 구조와 주장을 정리한 리서치다. 아래 성능 수치는 논문이 제시한 실험 조건의 결과이며, 모델·양자화·GPU·호스트 메모리 대역폭·런타임 버전에 따라 달라질 수 있다. 특히 “GPU 한 장으로 753B”라는 표현은 호스트 RAM 512GiB를 포함한 구성으로 읽어야 한다.

> **시리즈 안내**: 이전 글에서는 RAM 활용 추론의 큰 그림(레이어 오프로딩 → KV 캐시 오프로딩 → KTransformers → 유니파이드 메모리 → CXL)을 다뤘다. 이번 글은 그 흐름에서 최근 공개된 **FreeToken**(arXiv:2608.16157, 2026.08) 하나를 집중 조명한다.

이 글의 주인공은 753B 모델 자체가 아니라 **부족한 VRAM을 호스트 RAM으로 확장해 주는 FreeToken이라는 서빙 엔진**이다. 정확히 말하면 RAM이 VRAM을 완전히 대체하는 것은 아니다. 전체 expert 가중치는 RAM에 보관하고, GPU VRAM에는 자주 쓰는 expert를 캐시하며, 캐시 미스는 PCIe 전송과 CPU 실행으로 처리한다. 753B는 이 구조가 어디까지 확장될 수 있는지를 보여 주는 극단적인 사례다.

즉 FreeToken의 질문은 “작은 GPU에 거대한 모델을 어떻게 억지로 넣을까?”가 아니다. “**VRAM에는 일부만 두고 나머지를 RAM·PCIe·CPU와 어떻게 협업시켜 계속 추론할까?**”에 가깝다.

---

## 1. FreeToken이 뭐냐 — 한 줄 정의

**FreeToken**은 UC 버클리·UT 오스틴 연구진(FlashML)이 공개한 **엣지 네이티브 MoE(Mixture-of-Experts) 서빙 엔진**이다.

> 용어 미리 보기: **MoE**는 모델 안에 수십~수백 개의 "전문가 네트워크(expert)"를 넣어두고, 라우터가 토큰마다 그중 일부만 골라 쓰는 구조다. 덕분에 총 파라미터는 거대해도 토큰당 실제 연산량은 작다. 대신 전문가 전원의 가중치는 어딘가에 저장돼 있어야 한다는 새로운 문제가 생긴다 — 이 글의 출발점이다.

- GitHub: [FlashML-org/FreeToken](https://github.com/FlashML-org/FreeToken) (Apache-2.0)
- 논문: [FreeToken: Efficient Edge-Native MoE Serving with Bandwidth-Adaptive Execution](https://arxiv.org/html/2608.16157) (2026.08)
- 배포: PyPI `freetoken`, Windows/Linux 원클릭 데스크톱 앱 ([flashml.ai](https://www.flashml.ai/))

논문의 핵심 주장을 번역하면 이렇다:

> 개인용 머신을 "작은 GPU"로 취급하지 말고, **GPU + CPU + 호스트 메모리(RAM) + PCIe 인터커넥트를 하나의 통합·탄력적 추론 플랫폼으로 다뤄라.**

그 결과:

| 하드웨어 | 달성한 것 | 필요한 호스트 RAM |
|---|---|---|
| 8GB 노트북 GPU (RTX 4060 Laptop) | 35B MoE 모델 @ **39.3 tok/s** | 32 GiB |
| 게이밍 데스크톱 (RTX 5090) | 284B DeepSeek-V4-Flash @ 22~25 tok/s | 192 GiB |
| 워크스테이션 GPU 1장 (RTX PRO 6000) | **753B GLM-5.2 @ 14.9 tok/s** | **512 GiB** |

⚠️ "GPU 한 장"이라는 헤드라인의 함정을 미리 짚고 간다: GPU는 정말 한 장이지만, 모델 크기에 비례해 **호스트 RAM 요구량이 커진다.** 753B 구동에는 워크스테이션급 RAM(512GiB)이 전제된다 — 이 점은 뒤의 팩트체크(10장)에서 다시 다룬다.

"내가 이미 갖고 있는 하드웨어로 데이터센터급 지능을 돌린다"는 것이 슬로건이다. 이름의 'Free'는 무료 API가 아니라, **이미 소유한 하드웨어를 추가 비용 없이 활용한다**는 의미다. (Apache-2.0 오픈소스인 것도 맞다.)

---

## 2. 왜 필요한가: 기존 엔진들의 세 가지 실패 모드

> 용어 미리 보기: LLM 추론은 두 단계로 돈다. **Prefill**은 입력 프롬프트(수백~수천 토큰)를 한꺼번에 처리해 문맥을 이해하는 단계, **Decode**는 답을 토큰 하나씩 생성하는 단계다. **TTFT**(Time To First Token)는 prefill이 끝나고 첫 글자가 나올 때까지의 대기 시간이다.

MoE 모델 덕분에 로컬 프론티어 추론이 산술적으로는 가능해졌다. 예를 들어 DeepSeek-V4-Flash는 총 284B 파라미터 중 43개 레이어에서 라우터가 토큰당 256개 expert 중 **6개만 활성화** — 실제 참여 파라미터는 13B뿐이다.

문제는 **비활성 expert도 어딘가에 저장돼 있어야 한다**는 것. FP4 기준 전체 expert 풀이 약 140GB — VRAM에는 못 들어가고, 호스트 RAM에 상주시킨 뒤 필요할 때 꺼내 써야 한다. 여기서 FreeToken 팀은 기존 엔진(llama.cpp, Ollama, KTransformers, MoE-Infinity)에서 세 가지 실패 모드를 분리해냈다.

### 실패 모드 1: Prefill이 sparsity를 파괴한다

Prefill 단계에서는 수천 개 토큰이 한 레이어를 동시에 통과하는데, 토큰마다 라우팅이 다르니 **결국 거의 모든 expert가 한 번씩 호출된다.** 즉 전체 expert 풀(140GB+)이 PCIe를 건너야 한다:

- RTX 5090 (PCIe 5.0): 약 2초
- PCIe 4.0 데스크톱: 약 5초
- 노트북 x8 링크: 10초 이상

### 실패 모드 2: 정적 배치는 decode 트래픽을 놓친다

llama.cpp는 로딩 시점에 MoE 텐서 위치를 고정하고, KTransformers는 "hot" expert 부분집합을 고정(pin)한다. 그런데 **라우팅은 매 토큰마다 바뀐다.** 결과적으로 대부분의 expert 평가가 CPU로 떨어지고, GPU와 PCIe 링크는 놀고 있는 비효율이 생긴다.

### 실패 모드 3: 소비자 CPU는 나머지를 도저히 못 감당한다

듀얼채널 DDR5는 80\~90GB/s. 반면 RTX 4090/5090은 온패키지 메모리에서 **1\~1.8TB/s**를 끌어쓴다. 순수 CPU 실행에 의존하면 20배 이상의 격차가 그대로 속도에 나타난다.

**FreeToken의 답: 고정된 오프로딩 전략을 고수하지 말고, 캐싱 + 전송 + CPU 실행을 실측 대역폭에 맞춰 실시간 조율하라.**

---

## 3. 핵심 설계 #0: VRAM을 RAM으로 확장하는 2단계 Expert 메모리 계층

모든 것의 토대가 되는 구조다.

```
┌─────────────────────────────────────────────┐
│ GPU VRAM                                     │
│  ├─ 비(非)expert 가중치 (Attention 등): 상주   │
│  └─ Elastic Expert Cache                     │
│      · 모든 MoE 레이어가 공유하는 단일 LRU 캐시 │
│      · 슬롯 = (layer, expert) 논리 ID 단위     │
├─────────────── PCIe ─────────────────────────┤
│ 호스트 RAM                                    │
│  └─ CPU-resident Expert Pool                 │
│      · 전체 routed expert 가중치의 원본(source   │
│        of truth)                             │
└─────────────────────────────────────────────┘
```

포인트 두 가지:

1. **RAM은 '원본 보관소', VRAM은 '캐시'** — KTransformers류의 "hot/cold 고정 분할"이 아니라, 접근 패턴에 따라 유동적으로 바뀌는 진짜 캐시 계층. (캐시 교체는 **LRU** 방식 — Least Recently Used, 가장 오래 안 쓴 expert부터 내보내고 새로 필요한 것을 넣는다.)
2. **슬롯 단위 추상화** — 캐시의 각 슬롯이 하나의 (layer, expert) 쌍을 평가하는 데 필요한 모든 텐서를 통째로 담는다. 커널과 CPU executor가 체크포인트 저장 형식과 무관하게 동일한 논리 ID로 expert를 참조하므로, 20개 이상의 서로 다른 MoE 아키텍처를 하나의 런타임으로 지원할 수 있다.

---

## 4. 핵심 설계 #1: 대역폭 적응형 실행 — q\* 정책

FreeToken의 학술적 심장부. 비유하면 **배달 vs 현장 조리**의 선택 문제다: 필요한 expert가 RAM에만 있을 때, "PCIe로 GPU까지 배달해와서 쓸까(GPU 캐시 채우기), 아니면 CPU가 RAM에서 바로 현장 조리할까(CPU 실행)?"를 매 스텝 결정한다.

### 4-1. 문제의 구조

두 방식은 같은 자원(호스트 메모리 대역폭)을 놓고 경쟁한다. DMA 전송과 CPU expert 실행 모두 **같은 호스트 메모리 서브시스템에서 대역폭을 뽀려간다.** PCIe가 전송으로 포화되면 CPU가 쓸 수 잔여 대역폭은:

```
B_R = max(B_H − B_P, 0)
```

- `B_P`: pinned expert의 PCIe 전송 대역폭 (실측) — pinned란 페이지 아웃되지 않도록 메모리에 고정해 둔 상태를 말한다
- `B_H`: 호스트 측 expert 처리(CPU 실행) 대역폭 (실측)

### 4-2. 해법: 균형점에서 자르기

현재 스텝에서 미스난 expert가 m개일 때, q개를 GPU 캐시에 채우고 (m−q)개를 CPU에서 계산한다. 두 경로의 완료 시간을 맞추면:

```
q* ≈ m × B_P / B_H
```

- `B_P`와 `B_H`가 비슷 → q* ≈ m → 거의 전부 PCIe로 가져옴
- `B_P` << `B_H` → CPU가 미스 대부분을 직접 처리

중요한 디테일들:

- **두 경로는 동시 실행**된다. 캐시 필은 PCIe 풀 레이트로 진행되고, CPU는 링크가 포화된 후 남는 대역폭만 소비해 현재 토큰의 진행도에 기여한다.
- **결과는 bit-exact** — GPU와 CPU가 각자 담당 expert의 출력을 계산한 뒤(라우터가 매기는 가중치를 곱한 "부분 합" 형태), 최종적으로 더한다. 라우터 수정, expert 대체, 정밀도 완화 같은 근사가 전혀 없어 원본 모델과 결과가 완전히 동일하다.
- **머신별 프로파일링** — `ft bench bw`가 배포 대상 하드웨어에서 B_P:B_H를 직접 측정한다. 실제로 RTX 5090 서버는 52.7:77.3인데 4060 노트북은 11.8:47.5. 같은 알고리즘이 머신마다 완전히 다른 분할로 동작하는 것 — 이것이 "bandwidth-adaptive"의 의미다.
- 항상 최소 1개는 fill에 남겨 캐시가 계속 예열되도록 한다.

### 4-3. Prefill: 더블 버퍼 스트리밍

Decode의 q\* 정책과 별개로, prefill에서는 **풀 레이어 더블 버퍼링**으로 expert 이동을 연산 뒤에 숨긴다. GPU가 레이어 l을 계산하는 동안 레이어 l+1의 전체 expert가 PCIe로 스트리밍된다. (선택 옵션으로 CUDA ≥ 13에서 캐시 히트 expert는 디바이스 내부 복사로 처리하고 미스만 스트리밍 가능.)

---

## 5. 핵심 설계 #2: 시맨틱 어웨어 캐싱

메모리가 빈약한 엣지 환경에서는 "**무엇을 VRAM에 남길 것인가**"가 곧 성능이다. FreeToken은 여기서 에이전틱 워크로드의 특성을 정면으로 활용한다.

### 5-1. Decode: 라우터를 따라가는 공유 LRU expert 캐시

인접 토큰들은 라우팅이 크게 겹친다(routing locality). llama.cpp처럼 로딩 시점에 고정하지 않고, **모든 MoE 레이어가 공유하는 단일 LRU 캐시가 라우터 선택을 실시간 따라간다.** 대부분의 라우팅 접근이 VRAM 히트로 해결되고, 잔여 미스만 q\* 정책으로 처리된다.

실측(동일 캐시 용량, Qwen3.6 풀의 37%): decode 중 expert 읽기 미스율 — (DSV4-Flash 수치와 검증 조건 상세는 7-4에서 다룬다)

| 엔진 | 미스율 |
|---|---|
| **FreeToken (global LRU)** | **16%** |
| KTransformers (hot 고정) | 41% |
| llama.cpp (정적 배치) | 62% |

### 5-2. Prefill: 시맨틱 앵커 체크포인트

에이전트 하네스(Claude Code, Codex 등)는 문맥을 **thinking 블록, tool call, tool output 같은 특수 토큰 경계에서 잘라내며 편집**한다. FreeToken은 이 경계들에 recurrent state·prefix KV 체크포인트를 미리 박아둔다. 문맥이 편집되면 **새 suffix만 재계산**한다 — 에이전트가 턴을 반복할 때마다 프롬프트 전체를 다시 prefill하는 낭비를 제거한다.

이게 왜 중요하냐면, FreeToken의 타깃 워크로드가 애초에 "코딩 에이전트 + tool calling"이라는 점 때문이다. 범용 채팅이 아니라 **문맥이 계속 잘리고 붙는 에이전틱 패턴에 특화된 캐싱**이라는 점이 기존 엔진과의 철학적 차이다.

---

## 6. 핵심 설계 #3: 탄력적(Elastic) 메모리 관리

엣지 GPU는 데이터센터처럼 LLM 전용이 아니다. 게임도 하고, 브라우저도 띄우고, 엔진도 수시로 껐다 켠다. FreeToken은 이 변동성을 런타임에 흡수한다.

- **런타임 VRAM 재분할**: KV 캐시 페이지와 expert 캐시 슬롯의 비율이 실행 중 scheduler safe point에서 재조정된다. **엔진 재시작도, CPU expert 풀 재로딩도 없이.** CPU 풀이 원본이므로 GPU 캐시가 줄어도 모델 출력은 전혀 바뀌지 않는다.
- **빠른 부팅**: 디스크 → 호스트 메모리 로딩 시, expert를 **최종 호스트 레이아웃으로 직접 읽은 뒤 pin**한다. 빈 버퍼를 먼저 pin해서 GB 단위 페이지를 zero-fill하고 다시 덮어쓰는 낭비를 없앤다.
- **콜드 캐시 시작**: GPU warmup 없이 첫 요청부터 콜드 캐시로 서빙한다.
- **FTW 포맷**: HF safetensors 체크포인트를 자체 고속 로딩 포맷(`ft checkpoint`)으로 변환 가능 — offload bank로 expert를 패킹해 부팅을 더 줄인다.

---

## 7. 실측 성능 정리 — "적용 전 vs 적용 후" 비교

논문의 평가 세팅부터 정리하면: **모델 3종**(Qwen3.6-35B-A3B, DeepSeek-V4-Flash, GLM-5.2) × **머신 6종**(8GB 노트북 → RTX PRO 6000 워크스테이션) × **실제 에이전틱 워크로드 4종**(W1~W4), 비교 대상은 **llama.cpp, Ollama, KTransformers, MoE-Infinity**. 가중치 포맷까지 완전히 동일하게 맞춰 비교했다(Qwen3.6는 전 엔진 BF16, DSV4-Flash는 전 엔진이 네이티브 MXFP4 expert 블록을 bit-exactly 소비).

### 7-0. 평가에 쓰인 하드웨어 매트릭스

| 시스템 | GPU | 호스트 RAM | 시연 모델 |
|---|---|---|---|
| 노트북 | RTX 4060 Laptop (8GB, PCIe x8) | 32 GiB | Qwen3.6-35B-A3B NVFP4 |
| 게이밍 데스크톱 | RTX 3090 (별도 시스템) | — | — |
| 게이밍 데스크톱 | RTX 4090 (별도 시스템) | — | — |
| 게이밍 데스크톱 | RTX 5090 (32GB) | 192 GiB DDR5 듀얼채널 | DeepSeek-V4-Flash (284B) |
| 서버급 호스트 | RTX 5090 (32GB, 동일 실리콘·다른 호스트) | 다채널 DRAM | — |
| 워크스테이션 | RTX PRO 6000 (96GB) | 512 GiB | GLM-5.2 (753B) |

### 7-1. 디코드 처리량: 기존 엔진(적용 전) vs FreeToken(적용 후)

**RTX 5090에서의 절대치와 배율 (워크로드 W1~W4):**

| 모델 | 기존/비교 기준 | FreeToken | 변화 |
|---|---|---|---|
| Qwen3.6-35B-A3B (BF16) | 논문은 워크로드별 baseline 절대값 대신 배율만 공개 | **77–83 tok/s** | 최강 baseline 대비 **1.8–2.3배** |
| DeepSeek-V4-Flash (MXFP4) | 논문은 워크로드별 baseline 절대값 대신 배율만 공개 | **22–25 tok/s** | 최강 baseline 대비 **1.5–1.9배** |

**머신을 바꿔도 패턴이 동일 (W2 반복, 최강 baseline 대비):**

| 머신 | FreeToken 우위 |
|---|---|
| RTX 3090 | 1.3배 |
| RTX 4090 | 1.3배 |
| RTX 5090 서버 호스트 | 1.9배 |
| RTX 5090 데스크톱 (듀얼채널) | 2.1배 |
| RTX 4060 Laptop (8GB) | 1.8배 |
| RTX PRO 6000 / GLM-5.2 753B | **14.9 vs llama.cpp 7.3 tok/s (2.0배)** |

소비자 시스템 5종에서의 향상 범위는 **1.3–2.1배**.

특히 주목할 셋:

- **노트북 역전 현상**: 8GB + PCIe x8인 4060 랩톱에서 35B를 **39.3 tok/s**로 서빙 — 이는 RTX 4090 머신 속도의 **92%**. VRAM 크기와 PCIe 폭이 줄어도 q\* 정책이 대역폭 재분할로 보상한다.
- **호스트 민감도 실험**: 같은 RTX 5090 실리콘이면서 호스트만 다른 두 머신 비교에서, 멀티채널 서버 → 듀얼채널 데스크톱으로 내려가자 FreeToken은 **4%만** 손해 본 반면 llama.cpp는 **20%를 잃었다**(RAM 상주 expert가 DDR5 2채널에 굶주림). 즉 RAM 중심 설계일수록 호스트 메모리 대역폭에 더 취약하다는 것 — FreeToken의 하이브리드 분할이 이 약점을 흡수한다.
- **MoE-Infinity**: W1에서만 8.8 tok/s로 동작. per-expert prefill 스테이징 한도 때문에 긴 프롬프트 워크로드는 아예 실패하고, 번들 서버가 요청 간 KV 캐시를 유지하지 못한다.

### 7-2. 꼬리 지연(Tail TTFT): "사용 가능 여부"의 차이

평균보다 꼬리가 엔진을 가른다. 에이전트 클라이언트의 실제 타임아웃 기준과 겹쳐보면:

| 엔진 | 최악 턴 TTFT (테스트 매트릭스 어딘가에서) | 판정 |
|---|---|---|
| **FreeToken** | **모든 셀에서 < 44초** | 사용 가능 |
| llama.cpp | 232초 | OpenClaw 감시견(120초) 초과 → 요청 포기 |
| Ollama | 179초 | 마찬가지로 감시견 초과 |
| KTransformers | 946초 (≈15.8분) | Claude Code 기본 타임아웃(~10분)조차 **초과** |

> 논문 표현을 빌리면, 꼬리 TTFT는 "지연 통계"가 아니라 **가용성 경계(availability boundary)** 다. 평균 TTFT는 6개 멀티턴 셀 중 5개에서 FreeToken이 최저였다(예외: Qwen3.6×W3에서 KTransformers의 GPU-prefill arm이 앞섬).

### 7-3. 에이전틱 워크로드에서의 성능 저하 폭

문맥 편집이 심해질수록(W1 단일턴 → W2/W3/W4 멀티턴 에이전틱):

| 엔진 | W1 단일턴 기준 | W2/W3/W4 멀티턴 | 변화 |
|---|---|---|---|
| **FreeToken** | 100% | **88% 이상** | 싱글턴 대비 손실 **12% 이내** |
| KTransformers (DSV4-Flash) | 100% | 약 **69%** | W2 시점에 **31% 손실** |

단일 스트림 벤치마크 숫자가 기존 엔진들의 에이전틱 성능을 과장해서 보여준다는 의미다.

### 7-4. 원인 진단: expert 캐시 미스율

같은 VRAM, 같은 라우팅 트레이스를 재생해 캐시 정책만 비교한 결과 (RTX 5090 캐시 용량 기준):

| 엔진 (캐시 정책) | Qwen3.6 미스율 | DSV4-Flash 미스율 | FreeToken 대비 |
|---|---|---|---|
| **FreeToken (공유 LRU)** | **16%** | **39%** | 기준 |
| KTransformers (hot 고정 pin) | 41% | 59% | **41→16%, 59→39%** |
| llama.cpp (로딩 시 정적 배치) | 62% | 89% | **62→16%, 89→39%** |

같은 VRAM으로도 미스율 격차가 최소 1.5배(KT vs FT, DSV4)에서 최대 3.9배(llama.cpp vs FT, Qwen3.6)까지 벌어진다. 그리고 남은 미스조차 FreeToken은 PCIe 전송과 CPU 실행을 **동시에** 수행하며 실측 대역폭 비율(`q* ≈ m·B_P/B_H`)로 분할해 흡수한다 — 이 두 겹의 차이가 위 표들의 1.5~2.3배로 누적된 것이다.

### 7-5. 프론티어 티어 (GLM-5.2, 753B)

RTX PRO 6000 1장 + 512 GiB 호스트:

| 항목 | FreeToken | llama.cpp | KTransformers |
|---|---|---|---|
| 디코드 | **14.9 tok/s** | 7.3 tok/s | **서빙 불가** |
| 평균 TTFT | 7.5초 | 7.8초 | — |

KTransformers가 불가능한 이유: GLM-5.2 방식은 753GB–1.5TB의 호스트 상주 expert가 필요한데 박스엔 512GiB뿐이고, CPU 커널이 GLM-5.2의 NVFP4 레이아웃을 읽지 못한다. 같은 expert 가중치(bit-identical)를 쓰고도 결과가 2배 차이 난다는 점이 이 글의 결론 — **경계는 하드웨어가 아니라 서빙 소프트웨어다** — 를 그대로 보여준다.

### 7-6. 왜 빠른가 (한 문장 요약)

> 캐시 히트율을 16% 미스로 끌어올린 데다, 남은 미스조차 PCIe 전송과 CPU 실행을 **동시에** 진행하며 실측 대역폭 비율로 정확히 분할하기 때문.

---

## 8. 직접 써보기 — 설치와 CLI

요구사항: Linux x86_64 + NVIDIA GPU (RTX 30/40/50 시리즈 네이티브 지원), 드라이버 r580+ (CUDA 13). Windows/Linux GUI 앱은 flashml.ai에서.

```bash
# PyPI 설치 (uv 권장)
uv pip install "freetoken[accel]"

# 소스 설치
git clone https://github.com/FlashML-org/FreeToken.git && cd FreeToken
uv venv && source .venv/bin/activate
uv pip install -e ".[accel]"
```

기본 사용:

```bash
# 서버 기동 (OpenAI/Anthropic 호환 API, 포트 1919)
ft serve --model ~/models/Qwen3.6-35B-A3B

# 터미널 채팅
ft shell

# 코딩 에이전트 연결 (Claude Code / Codex / OpenCode / OpenClaw)
ft launch claude
```

주목할 만한 디테일: `ft launch`는 자식 프로세스에서 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 등을 **삭제**해서 에이전트가 몰래 유료 클라우드 엔드포인트로 폴백하는 걸 차단한다.

MoE 백엔드 선택:

```bash
ft bench bw          # 머신의 B_P(PCIe) vs B_H(CPU) 실측 프로파일 생성
ft serve --model ... --moe-backend auto   # 프로파일 있으면 hybrid 추천
```

| 백엔드 | 동작 |
|---|---|
| `fused` | expert 전체 GPU 상주 (VRAM 충분할 때) |
| `offload` | expert는 RAM, GPU에 LRU 캐시, 미스는 PCIe 스트리밍 (기본) |
| `cpu` | 미스를 CPU에서 직접 계산 |
| `hybrid` | 스텝당 일부는 fetch, 일부는 CPU 계산 — q\* 정책 |
| `auto` | dense는 fused, MoE는 offload, `bench bw` 프로파일 있으면 hybrid |

---

## 9. 정직한 평가: 강점과 한계

### 강점

1. **"무엇을 어디에 둘지"가 아니라 "무엇을 어디서 계산할지"까지 통합** — 기존 계층형 메모리 관리(SGLang HiCache, WiSP, eLLM, FluxMoE)는 없는 바이트를 "가져오기만" 한다. FreeToken은 missing expert를 **그 자리에서 계산하는** 추가 자유도를 얻어, allocation-only 시스템의 상한을 깬다.
2. **근사 없음** — bit-exact. 정확도 저하 걱정이 없다.
3. **에이전트 우선 설계** — 시맨틱 앵커 체크포인트, API 호환, 에이전트 런처까지. "LLM 서버"가 아니라 "로컬 에이전트 플랫폼"으로 설계됐다.
4. **배포 장벽이 낮음** — Apache-2.0, pip 설치, GUI 앱.

### 한계 / 유의점

1. **NVIDIA 전용** — Linux x86_64 + NVIDIA(CUDA 13)가 CLI 타깃. AMD ROCm, Apple Silicon은 지원 밖.
2. **"단일 GPU로 753B" 프레이밍의 함정** — 검증 리뷰들이 지적했듯, GLM-5.2 753B 구동에는 호스트에 **512GiB DDR5**(Xeon Platinum급)가 필요하다. GPU는 1장이지만 RAM 요구량은 여전히 워크스테이션급. 284B 데스크톱 구성도 192GB RAM 전제.
3. **KTransformers 비교의 공정성** — KTransformers는 AMX 최적화 many-core CPU 실행이 본체라, 엣지급 호스트에서 재현한 비교 열은 그 잠재력의 상한이 아님.
4. **동시성 제한** — `--max-running-requests` 기본값 4. 단일 유저 에이전트용이지 멀티테넌트 서빙이 아니다.
5. **v0.1.x 초기 단계** — 빠른 릴리즈 사이클(Day-0 모델 지원)에 따른 안정성 변동은 감안 필요.

---

## 10. 실전 전후 사례와 독립 검증은? — 지금 확인 가능한 것들

논문 벤치마크가 아니라 **실제 사용자들이 공개한 전후 비교 사례**가 있는지 찾아봤다. 결론부터: FreeToken 자체는 공개된 지 얼마 안 돼 독립 재현 사례가 거의 없고, 반면 같은 계열 선행 기술(KTransformers)의 실전 전후 비교는 상당히 축적돼 있다. 둘 다 정리한다.

### 10-1. FreeToken에 대한 커뮤니티 독립 검증 (2026.08 기준)

#### 사례를 먼저 한 표로 보기

FreeToken의 실사용 자료는 성공한 숫자만 모아 보면 오해하기 쉽다. 아래처럼 **성공·성능 편차·실패를 한 표에 놓고** 읽는 편이 낫다.

| 사례 | 환경 | 비교 전 → 후/경계 | 이 사례가 말해 주는 것 |
|---|---|---|---|
| [SFF 커뮤니티 실측](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1710123) | RTX 4060 Laptop 8GB · RAM 64GB · Ornith 35B IQ3_S | llama.cpp CPU **11.08 → FreeToken 46.7~50.1 tok/s** (**4.2~4.5배**) | 작은 VRAM과 큰 RAM을 결합한 오프로딩이 실제로 동작할 수 있다. |
| [FreeToken Issue #72](https://github.com/FlashML-org/FreeToken/issues/72) | RTX 4060 Ti 16GB · Qwen3.6 35B NVFP4 | 11토큰 **50~66 tok/s →** 약 180토큰 cold prefill **무한 대기** | 모델이 올라가도 prefill·warm-up 경로가 안정적이라는 보장은 없다. |
| [FreeToken Issue #151](https://github.com/FlashML-org/FreeToken/issues/151) | RTX 3090 2장 · RAM 503GB · DeepSeek-V4-Flash | 자동 `hybrid` **0.67 →** 수동 `offload` **5.58 tok/s** (**8.3배**) | 대역폭 벤치마크와 실제 serving 결과가 다를 수 있고, backend 선택을 확인해야 한다. |
| [FreeToken Issue #111](https://github.com/FlashML-org/FreeToken/issues/111) | RTX PRO 6000 96GB · RAM 503GB · MiniMax-M2.5 | **8,011토큰 통과 → 8,760토큰 대기**; chunk마다 약 137GB expert bank 재전송 | 대용량 GPU·RAM 구성에서도 긴 컨텍스트와 캐시 경로에 별도 한계가 있다. |

#### 성공 사례: 8GB VRAM에 35B MoE를 올린 경우

첫 번째 글은 FreeToken이 주장하는 구조를 가장 직관적으로 보여 준다. RTX 4060 Laptop의 VRAM은 8GB뿐이지만, 호스트 RAM에 약 20GB의 pinned expert bank를 두고 Ornith 35B-A3B를 실행했다. FreeToken 생성 속도는 46.7~50.1 tok/s였고, full-prompt streaming도 약 44.5 tok/s였다. 같은 파일을 llama.cpp CPU 경로로 실행한 값은 11.08 tok/s였다. 즉 이 비교에서는 **11.08 → 46.7\~50.1 tok/s, 약 4.2\~4.5배**가 됐다.

다만 이 값을 “FreeToken이 모든 llama.cpp보다 네 배 빠르다”로 읽으면 안 된다. 비교 대상은 llama.cpp의 CPU 경로이고, 게시물에는 반복 횟수·정확한 커맨드·프롬프트 길이·버전이 모두 정리돼 있지 않다. **RAM으로 VRAM 용량을 확장해 8GB GPU에서도 실사용 속도를 낼 수 있다는 가능성**을 보여 주는 사례로 보는 것이 정확하다.

#### 실패 사례: 작은 프롬프트는 되는데 첫 prefill에서 멈춘 경우

Issue #72에는 RTX 4060 Ti 16GB에서 Qwen3.6 35B NVFP4를 실행할 때, 약 11토큰 요청은 50~66 tok/s로 생성되지만 새 서버의 약 180토큰 요청은 끝나지 않았다는 재현 보고가 있다. GPU는 높은 사용률을 보인 채 scheduler가 돌고, 프로세스를 강제 종료해야 했다.

이 사례의 가치는 성능 숫자보다 **가용성의 경계**를 보여 준다는 데 있다. “짧은 요청이 빠르게 생성된다”와 “에이전트가 처음 보내는 큰 프롬프트를 안정적으로 처리한다”는 다른 문제다. FreeToken을 실제 도구로 쓰려면 decode tok/s뿐 아니라 cold prefill과 warm-up 이후의 길이별 동작을 확인해야 한다.

#### 설정 사례: 자동으로 고른 backend가 더 느렸던 경우

Issue #151은 2장의 RTX 3090과 503GB RAM에서 DeepSeek-V4-Flash를 돌린 기록이다. `ft bench bw`는 CPU 경로가 더 유리하다고 판단해 `hybrid`를 골랐지만, 실제 serving에서는 `hybrid`가 0.67 tok/s, 수동으로 지정한 `offload`가 5.58 tok/s였다. 같은 설정에서 backend만 바꿨을 때 **8.3배 차이**가 난 셈이다.

보고자는 단일 expert를 재는 대역폭 측정과 43개 MoE 레이어에서 258번의 expert 활성화가 발생하는 실제 decode 사이에 동기화 비용 차이가 있다고 분석했다. 아직 열린 이슈인 만큼 최종 결론은 보류해야 하지만, `--moe-backend auto`를 켜고 결과를 그대로 믿기보다 짧은 end-to-end decode로 선택 결과를 검증해야 한다는 실전 교훈은 분명하다.

#### 긴 컨텍스트 사례: RAM이 충분해도 끝까지 확장되지는 않는다

Issue #111은 RTX PRO 6000 96GB와 호스트 RAM 503GB에서 MiniMax-M2.5를 실행한 보고다. 약 8,011토큰 프롬프트는 통과했지만 8,760토큰은 반환되지 않았다. 보고서에 따르면 prefill 요청마다 약 137GB에 달하는 expert bank가 PCIe로 다시 스트리밍되고, KV 캐시가 완전히 적중한 1토큰 extend에서도 이 비용이 발생했다.

이 사례는 “RAM이 충분하면 VRAM 부족 문제가 끝난다”는 식의 해석을 막아 준다. RAM은 용량을 보완하지만 PCIe 전송량, KV pool, chunked prefill 정책까지 없애 주지는 않는다. 특히 반복되는 긴 에이전트 컨텍스트에서는 **RAM 용량보다 매 턴 실제로 다시 읽는 데이터량과 TTFT**가 중요하다.

### 10-2. 논문 수치와 실제 사용기를 분리해서 읽기

현재 공개 자료의 증거 수준은 다음처럼 나누는 것이 안전하다.

| 자료 | 강점 | 한계 | 글에서의 역할 |
|---|---|---|---|
| FreeToken 논문 | 모델·머신·워크로드 매트릭스가 가장 넓다 | 독립 재현 수가 아직 적다 | 설계와 성능 주장의 기준점 |
| 커뮤니티 성공 실측 | 실제 소비자 하드웨어에서의 가능성을 보여 준다 | 반복·버전·명령어가 빠질 수 있다 | “정말 돌아가는가”를 보여 주는 사례 |
| GitHub 재현 이슈 | 환경·로그·재현 절차가 비교적 구체적이다 | 성공 벤치가 아니라 특정 버그 보고다 | 제품화 단계의 한계와 주의점 |
| 리뷰·블로그 | 수치를 읽기 쉽게 정리한다 | 원 논문을 재실행한 것은 아닐 수 있다 | 해석 보조 자료 |

논문이 제시한 RTX 5090 디코드 77~83 tok/s, DeepSeek-V4-Flash 22~25 tok/s, 753B GLM-5.2 14.9 tok/s와 같은 수치는 논문 자체의 실험값이다. 공개된 그림에서 배율을 다시 계산할 수 있다는 것과, 제3자가 같은 결과를 재현했다는 것은 다르다. 특히 753B 구성은 RTX PRO 6000 한 장 외에 호스트 RAM 512GiB가 필요하므로, “GPU 한 장”만 떼어 광고 문구처럼 읽으면 안 된다.

### 10-3. 선행 기술 KTransformers의 실전 사례는 어디까지 참고할까

FreeToken과 같은 RAM 오프로딩 계열이 실전에서 보인 방향성을 확인하는 데는 KTransformers 사례가 도움 된다. 다만 서로 다른 엔진·모델·하드웨어를 비교한 자료이므로 FreeToken의 성능을 직접 증명하는 근거는 아니다.

| 사례 | 구성 | 관측된 결과 | 주의할 점 |
|---|---|---|---|
| [Osman 라이브 실증](https://www.ahmadosman.com/blog/r1-ktransformers-inference-livestream/) | 14× RTX 3090 · EPYC 7713 · RAM 512GB · DeepSeek R1 671B | prompt eval이 llama.cpp보다 약 15배 | 다중 GPU·서버급 CPU 환경이다. |
| [llama.cpp Discussion #8721](https://github.com/ggml-org/llama.cpp/discussions/8721) | RTX 3090 2장 · DeepSeek-V2 | KTransformers 9 tok/s, llama.cpp 7.5 tok/s; VRAM 사용량도 낮음 | 사용자 보고이며 완전한 실험 매트릭스는 아니다. |
| [CraftRigs 집계](https://craftrigs.com/comparisons/ktransformers-vs-llama-cpp-moe-models/) | RTX 4090급 · 5회 중앙값 | Kimi·Qwen·MiniMax에서 약 2.9~3.1배 | 커뮤니티 집계라 모델·옵션별 조건을 확인해야 한다. |
| [club-3090 운영 문서](https://github.com/noonghunna/club-3090/blob/master/docs/INFERENCE_ENGINES.md) | 3090 기반 소비자 시스템 | 큰 MoE에서 KTransformers가 VRAM을 덜 쓰고 1.5~2배 빠르다는 경험 | FreeToken이 아니라 선행 엔진의 경험이다. |

이 선행 사례들이 공통으로 보여 주는 것은 “RAM 오프로딩은 공짜 VRAM이 아니다”라는 점이다. 호스트 RAM 대역폭, CPU 명령어셋, PCIe 링크, 캐시 정책이 함께 성능을 결정한다. FreeToken이 `ft bench bw`와 q* 정책을 도입한 이유도 이 병목을 고정된 비율로 가정하지 않기 위해서다.

### 10-4. 지금 시점에서 내릴 수 있는 결론

1. **FreeToken의 핵심 가능성은 확인된다.** 작은 VRAM에 전체 MoE를 넣지 않고 RAM을 expert 원본 저장소로 활용하는 방식은 실제 소비자 GPU 사용기에서도 동작했다.
2. **논문 수치는 방향성을 보여 주는 기준점이지 보증서가 아니다.** 모델·양자화·호스트·backend·프롬프트 길이가 바뀌면 결과가 달라진다.
3. **성공 사례와 실패 사례를 함께 봐야 한다.** 8GB 노트북에서 50 tok/s가 나와도 특정 prefill 길이에서 멈출 수 있고, 자동 backend가 수동 설정보다 느릴 수 있다.
4. **직접 검증할 때는 네 가지를 재야 한다.** 같은 모델·포맷으로 decode tok/s, cold/warm TTFT, 길이별 prefill, 그리고 실제 멀티턴 에이전트의 tail latency를 확인해야 한다.

---

## 11. 기술 계보 속에서의 FreeToken

이전 글에서 정리한 계보에 대입하면:

| 세대 | 접근 | 한계 |
|---|---|---|
| llama.cpp | 레이어 물리 분할 + mmap | CPU 구간에서 GPU 유휴, 정적 배치 |
| vLLM/LMCache | KV 캐시를 DRAM으로 | weights는 여전히 VRAM 전제 |
| PowerInfer | hot/cold 뉴런 분할 | predictor 학습 필요, dense 위주 |
| KTransformers | Attention(GPU)/Expert(CPU) 고정 분할 + AMX | 배치가 정적, AMX 의존 |
| **FreeToken** | **expert 풀=RAM 원본, VRAM=탄력적 캐시, 미스는 실측 대역폭으로 PCIe/CPU 동시 분할** | NVIDIA/CUDA 전용, 초기 단계 |

FreeToken의 본질적 신선함은 두 가지로 요약된다.

1. **오프로딩(offloading)에서 오케스트레이션(orchestration)으로** — "무엇을 어디에 저장할까"의 정적 문제가 아니라, 매 스텝 "이 미스를 옮길까 계산할까"를 실측 대역폭으로 푸는 동적 스케줄링 문제로 재정의했다.
2. **워크로드 가정의 전환** — 채팅이 아니라 에이전틱 패턴(문맥이 경계 단위로 편집됨, 인접 토큰의 라우팅 locality)을 캐시 설계의 1급 시민으로 삼았다.

논문의 결론 문구가 잘 요약한다: *"로컬 AI의 경계는 이제 하드웨어 용량만이 아니라, 이미 있는 자원들을 엮는 서빙 소프트웨어가 결정한다."*

---

## 12. 참고 자료

- FreeToken GitHub (Apache-2.0): https://github.com/FlashML-org/FreeToken
- FreeToken 논문 (arXiv:2608.16157): https://arxiv.org/html/2608.16157
- PyPI: https://pypi.org/project/freetoken/
- 공식 사이트/GUI 앱: https://www.flashml.ai/
- SFF 마이너 갤러리 — RTX 4060 Laptop 8GB에서 Ornith 35B 실측: https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1710123
- FreeToken Issue #72 — RTX 4060 Ti에서 prefill hang 재현: https://github.com/FlashML-org/FreeToken/issues/72
- FreeToken Issue #111 — 긴 컨텍스트 요청 대기와 KV cache 경로 분석: https://github.com/FlashML-org/FreeToken/issues/111
- FreeToken Issue #151 — `hybrid` 자동 선택과 `offload`의 실측 차이: https://github.com/FlashML-org/FreeToken/issues/151
- MarkTechPost 소개 기사 (2026.08.23): https://www.marktechpost.com/2026/08/23/meet-freetoken-an-edge-native-moe-serving-engine-that-runs-753b-glm-5-2-on-a-single-workstation-gpu/
- TradePoint.io 팩트체크 리뷰: https://tradepoint.io/meet-freetoken-an-edge-native-moe-serving-engine-that-runs-753b-glm-5-2-on-a-single-workstation-gpu/
- wavect.io 실무 리뷰: https://wavect.io/blog/freetoken-ai-inference-engine-review/
- Medium — FreeToken 커뮤니티 반응·반박 테스트 정리: https://ai-engineering-trend.medium.com/freetoken-open-source-run-35b-moe-models-on-8gb-gpus-at-39-tokens-s-is-local-llm-freedom-finally-29a27541ccb0
- Osman의 실전 라이브 검증 (KTransformers vs llama.cpp): https://www.ahmadosman.com/blog/r1-ktransformers-inference-livestream/
- llama.cpp GitHub Discussion #8721 (커뮤니티 실측 보고): https://github.com/ggml-org/llama.cpp/discussions/8721
- CraftRigs KTransformers vs llama.cpp 커뮤니티 집계: https://craftrigs.com/comparisons/ktransformers-vs-llama-cpp-moe-models/
- club-3090 실무 엔진 비교 문서: https://github.com/noonghunna/club-3090/blob/master/docs/INFERENCE_ENGINES.md
- AI Trends 한국어 정리: https://aitrends.kr/articles/99620
- alphaXiv: https://www.alphaxiv.org/abs/2608.16157
- (계보 맥락) KTransformers: https://github.com/kvcache-ai/ktransformers / PowerInfer: https://arxiv.org/pdf/2312.12456
