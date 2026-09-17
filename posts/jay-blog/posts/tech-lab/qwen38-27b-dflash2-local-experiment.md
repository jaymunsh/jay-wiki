---
title: M1 Max에서 Qwen3.8-27B를 빠르게 만드는 DFlash2의 조건
slug: qwen38-27b-dflash2-local-experiment
category: 기술 실험
summary: Qwen3.8-27B와 DFlash2를 M1 Max에서 돌릴 때 공개된 27.12 tok/s 수치를 어떻게 읽어야 하는지, acceptance·메모리·컨텍스트·prefill의 트레이드오프와 직접 검증 계획을 정리했다.
tags: apple-silicon,benchmark,dflash2,local-llm,mlx,omlx,qwen3.8,speculative-decoding
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/26 (내려받음)
---
> **업데이트 안내 (2026년 8월 29일)** — 이 글은 공개 수치와 재현 계획을 정리한 원래 실험 기록이다. 실제 M1 Max·oMLX 측정 결과와 DFlash2/MTP 비교는 [후속 실험 글](/38/qwen38-27b-dflash2-local-experiment-update)에서 확인할 수 있다.

27B급 로컬 모델은 집에서 돌리기 어렵다는 말을 자주 듣는다. 실제로 모델 파일을 올리는 것과 대화형으로 쓸 만한 속도를 얻는 것은 다른 문제다. 특히 M1 Max처럼 몇 년 지난 Apple Silicon에서는 모델을 실행하는 것보다 첫 답변을 기다리는 시간이 더 큰 장벽이 된다.

최근 Qwen3.8-27B와 DFlash2 조합을 살펴보면서 이 문제를 다시 확인했다. 공개된 M1 Max 64GB 실측에는 일반 디코드 약 19.5 tok/s가 DFlash2 적용 후 27.12 tok/s까지 올라간 사례가 있다. 다만 이 숫자는 내가 직접 측정한 결과가 아니라 `dflash-mlx` Issue #60에 공개된 제3자 측정값이다.

따라서 이 글은 “내 M1 Max에서 이미 27 tok/s가 나왔다”는 사용기가 아니다. 공개 수치가 어떤 조건에서 나왔는지, 어떤 기본값을 잘못 쓰면 오히려 8.15 tok/s까지 떨어지는지, 그리고 다음에 무엇을 직접 검증해야 하는지를 정리한 기술 실험 설계에 가깝다.

## 로컬 27B의 속도 상한은 메모리 대역폭이 먼저 정한다

LLM이 토큰 하나를 생성할 때는 모델 가중치를 메모리에서 읽고 연산한 뒤 다음 토큰을 만든다. 연산 장치가 충분히 빨라도 가중치를 읽는 속도가 느리면 한 토큰씩 생성하는 디코드 속도는 올라가지 않는다.

대략적인 상한은 다음처럼 생각할 수 있다.

```text
디코드 속도 ≈ 메모리 대역폭 ÷ 모델 크기(바이트)
```

M1 Max와 Qwen3.8-27B 4bit를 여기에 대입하면 다음 정도가 된다.

| 항목 | 값 |
|---|---:|
| M1 Max 메모리 대역폭 | 약 400 GB/s |
| Qwen3.8-27B 4bit 크기 | 약 16~19GB |
| 단순 계산상 상한 | 약 22 tok/s |
| 일반 디코드 공개 측정 범위 | 약 15~20 tok/s |

이 계산은 실제 성능을 보장하는 벤치마크가 아니다. 다만 “4bit 모델인데 왜 100 tok/s가 안 나오나” 같은 질문에 대한 물리적인 기준선은 제공한다. 순수 autoregressive 디코드만으로는 메모리에서 모델을 매 토큰마다 다시 읽어야 하므로, 남은 선택지는 한 번의 검증으로 여러 토큰을 얻는 것이다.

## 스펙큘레이티브 디코딩은 초안과 검증을 분리한다

스펙큘레이티브 디코딩의 아이디어는 사람이 초안을 쓰고 검토하는 과정과 비슷하다.

~~~mermaid
flowchart TB
    A[작은 드래프트 모델이 다음 토큰 블록 제안] --> B[타겟 모델이 한 번에 검증]
    B --> C{앞부분이 채택되는가}
    C -->|예| D[여러 토큰을 한 번에 확정]
    C -->|아니오| E[처음 틀린 위치부터 다시 생성]
    E --> A
    D --> F[다음 블록으로 이동]
    F --> A
~~~

타겟 모델은 어차피 가중치 전체를 읽어야 하므로, 제안된 토큰 여러 개를 한 번의 forward pass로 검증하면 같은 메모리 읽기로 더 많은 토큰을 얻을 수 있다. 드래프트가 틀린 토큰을 그대로 내보내는 것이 아니라 타겟이 채택한 토큰만 사용하기 때문에 이론적으로는 타겟 모델의 분포를 유지한다.

다만 “lossless”를 “기준 실행과 비트 단위로 완전히 동일하다”로 읽으면 안 된다. MLX의 멀티토큰 검증 경로와 부동소수점 연산 순서가 달라 greedy 출력이 긴 시퀀스에서 미세하게 drift할 수 있다는 분석이 있다. 더 정확한 표현은 **설계상 품질 저하를 목표로 하지 않지만, baseline과 모든 비트가 같다는 보장은 없다**는 쪽이다.

## DFlash2는 드래프트 단계까지 병렬화한다

기존 EAGLE 계열은 드래프트 모델도 autoregressive하게 토큰을 하나씩 제안했다. 드래프트 모델이 작아도 토큰 16개를 만들려면 여러 번 순차 실행해야 하므로 타겟 검증에서 얻는 이득이 줄었다.

DFlash는 블록 확산 모델을 사용해 토큰 블록을 한 번에 제안하고, DFlash2는 블록 내부의 선택 정확도와 끝부분 유지력을 높이는 방향으로 개선했다. 공개 자료에 따르면 DFlash2는 Qwen3.8-27B에서 다음과 같은 수치를 보고한다.

| 항목 | 공개 수치 |
|---|---:|
| 검증 패스당 산출량 | 20% 이상 증가, 사이클 지연 약 1% 추가 |
| acceptance length | 5.46 |
| Qwen 공식 MTP 헤드 | 5.02 |
| Qwen3.8-27B 서버 처리량 | autoregressive 대비 2.7~3.4배 |

여기서 Qwen의 MTP 헤드와 DFlash2는 같은 것이 아니다.

| | Qwen MTP 헤드 | DFlash2 드래프터 |
|---|---|---|
| 형태 | 모델 체크포인트에 내장 | 별도 모델로 추가 |
| 타겟 수정 | 변환 과정에 영향 | 기존 타겟을 그대로 사용 |
| 저장 용량 | 타겟 안에 포함 | 약 4GB 추가 |
| 역할 | 공식 모델 내부의 멀티토큰 예측 | 타겟 전용 외부 드래프트 모델 |

DFlash2는 Qwen3.8-27B 모델 파일을 다시 학습하거나 바꾸는 업그레이드가 아니라, 기존 타겟 모델과 함께 올리는 애드온으로 이해하는 편이 맞다.

## M1 Max 공개 실측의 핵심은 27.12 tok/s보다 w4a32였다

`dflash-mlx` Issue #60에는 macOS 26.5.2, M1 Max 64GB, Qwen3.8-27B 4bit와 DFlash2를 조합한 측정이 남아 있다. 512토큰을 EOS 없이 생성하고 반복과 cooldown을 둔 지속 평균값이다.

측정 명령은 다음과 같다.

```bash
dflash benchmark \
  --model mlx-community/Qwen3.8-27B-4bit \
  --draft z-lab/Qwen3.8-27B-DFlash2 \
  --draft-quant w4a32:gs64 \
  --block-tokens 5 --max-tokens 512 --repeat 2 --cooldown 45 --no-eos
```

결과를 단순히 속도만 보고 읽으면 안 된다.

| 드래프트 양자화 | acceptance | 지속 속도 | 기본 디코드 대비 |
|---|---:|---:|---:|
| `w4` 기본값 | 0.000 | 8.15 tok/s | 0.44배, 오히려 느림 |
| `w4a32` | 0.701 | **27.12 tok/s** | **1.39배** |
| `none` BF16 드래프트 | 0.705 | 23.32 tok/s | 1.20배 |

이 표에서 가장 중요한 값은 27.12가 아니라 `w4`의 acceptance 0%다. 기본값으로 실행했는데 스펙큘레이티브 디코딩이 느려졌다면, 모델이 M1 Max와 맞지 않는다고 결론내리기 전에 드래프트 activation 정밀도와 acceptance부터 확인해야 한다.

M1/M2 계열은 네이티브 BF16 경로가 없고 FP16 에뮬레이션을 거친다. DFlash2의 path selector가 FP16 범위에서 포화되면 경고 없이 acceptance가 0%가 될 수 있다는 것이 Issue #60의 핵심 관찰이다. 이 환경에서는 weight 4bit에 activation 32bit를 사용하는 `w4a32`가 오히려 BF16 드래프트보다 빠른 구성이었다.

다시 말해 이 공개 수치가 말해주는 것은 다음에 가깝다.

> M1 Max 64GB에서 Qwen3.8-27B와 DFlash2를 올바른 activation 정밀도로 구성하면 27 tok/s대가 가능하다는 제3자 사례가 있다. 하지만 기본값을 그대로 쓰면 8 tok/s대로 떨어질 수 있다.

## DFlash2는 품질보다 다른 비용을 가져온다

스펙큘레이티브 디코딩을 켠다고 모델의 4bit 양자화 한계가 사라지는 것은 아니다. DFlash2가 추가하는 비용과 조건을 따로 봐야 한다.

| 축 | 실제 비용 또는 제약 | 읽는 방법 |
|---|---|---|
| 메모리 | 드래프터 약 4GB + 캐시 추가 | 64GB에서는 여유가 있지만 24GB는 빠듯하다 |
| 동시성 | 단일 요청 중심 | 개인용은 괜찮지만 공유 서버에는 불리하다 |
| 긴 컨텍스트 | 검증 어텐션 비용 증가 | 짧은 컨텍스트에서 배율이 더 잘 나온다 |
| 샘플링 | 온도가 올라갈수록 acceptance 저하 | 코드·추출·요약처럼 예측 가능한 출력에 유리하다 |
| prefill | 가속 대상이 아님 | 긴 프롬프트는 첫 응답을 여전히 오래 기다린다 |
| 툴콜·JSON | 드래프터가 포맷을 놓칠 수 있음 | 실제 에이전트 트래픽으로 따로 확인해야 한다 |

공개 M5 Max 측정에서도 생성 길이가 1,024토큰일 때 2.37배였던 DFlash가 8,192토큰에서는 1.34배까지 줄었다. “몇 배 빨라진다”가 아니라 컨텍스트와 출력 형태에 따른 범위로 읽어야 한다.

또한 DFlash2는 디코드만 가속한다. 긴 프롬프트를 처음 읽는 prefill은 그대로이고, dflash-mlx Issue #21에는 cold-start prefill이 다른 런타임보다 훨씬 느릴 수 있다는 보고도 있다. RAG 원문 전체 요약처럼 입력은 길고 출력은 짧은 작업에서는 디코드 가속이 prefill 손실을 상쇄하지 못할 수 있다.

## M1/M2에서는 기본값보다 acceptance를 먼저 확인해야 한다

실험에서 가장 먼저 기록해야 할 지표는 tok/s가 아니다. 다음 순서가 더 안전하다.

1. 드래프트가 실제로 로드됐는지 확인한다.
2. acceptance rate가 0%에 가깝지 않은지 확인한다.
3. baseline보다 느려지지 않았는지 확인한다.
4. 그 다음에 block size와 출력 유형을 조정한다.

MTP 텐서가 포함된 체크포인트를 stock 런타임에 잘못 올리면 norm 처리 차이로 출력이 깨질 수 있고, Homebrew 빌드는 필요한 Metal 커널이 없어 느린 폴백 경로로 내려갈 수 있다는 주의점도 있다. 실패해도 에러가 나지 않고 단순히 느린 결과로 나타나는 것이 이 기술의 가장 불편한 부분이다.

## oMLX에서는 드래프터 위치와 activation 설정이 함께 중요하다

보고서에서 정리한 M1 Max 기준의 준비물은 다음과 같다.

| 항목 | 설정 |
|---|---|
| oMLX | 2026-08-18 이후 DFlash2 지원 빌드 |
| 타겟 | `Qwen3.8-27B-nvfp4` 등 순수 양자화 모델 |
| 드래프터 | `z-lab/Qwen3.8-27B-DFlash2` safetensors |
| 드래프터 위치 | `~/.omlx/models/` 바깥의 별도 디렉터리 |
| M1/M2 드래프트 양자화 | weight 4bit + activation 32bit |
| block size | 처음에는 adaptive로 두고 sweep |

드래프터는 약 4GB이므로 다음처럼 별도 경로에 둔다.

```bash
hf download z-lab/Qwen3.8-27B-DFlash2 \
  --local-dir ~/.omlx/dflash-drafts/Qwen3.8-27B-DFlash2
```

모델 디렉터리 안에 드래프터를 넣으면 oMLX가 이를 별도 서빙 모델로 인식할 수 있으므로 타겟과 분리하는 편이 안전하다. `dflash_max_ctx`를 넘으면 일반 디코드로 폴백하도록 두고, block size는 처음부터 5로 고정해 결론내리기보다 3·5·7을 비교할 계획이다.

## 로컬에서는 DFlash2보다 하네스의 컨텍스트가 더 큰 병목이 될 수 있다

로컬 코딩 에이전트에 이 모델을 붙일 때는 생성 속도만 보는 것으로 부족하다. M1 Max dense 27B의 prefill을 약 59 tok/s로 놓으면, 새 prefix가 생긴 1만 토큰 컨텍스트를 읽는 데만 약 170초가 걸린다.

```text
10,000 context tokens ÷ 59 prefill tok/s ≈ 169초
```

DFlash2는 이 prefill을 가속하지 않는다. 따라서 모델 디코드가 27 tok/s로 빨라져도 하네스가 시스템 프롬프트, 툴 스키마, 이전 결과와 컴팩션 입력을 계속 부풀리면 체감 이득이 사라질 수 있다.

이 관점에서 opencode와 Pi의 선택도 달라진다.

| | opencode | Pi |
|---|---|---|
| 방향 | 기능이 갖춰진 코딩 에이전트 | 최소 도구를 조립하는 하네스 |
| 로컬 비용 | 자동 컴팩션·내장 기능이 추가 컨텍스트와 호출을 만들 수 있음 | 시스템 프롬프트와 도구 수가 작고 컴팩션 교체 가능 |
| 장점 | 바로 사용하기 쉽다 | 컨텍스트와 컴팩션을 직접 통제하기 쉽다 |
| 주의점 | 긴 세션에서 prefill 비용이 커질 수 있다 | 권한·LSP·통합을 직접 구성해야 한다 |

다만 이 비교는 같은 태스크·같은 모델로 내가 직접 수행한 A/B 벤치마크가 아니다. 지금 단계의 실무 결론은 하네스를 바로 바꾸라는 것이 아니라, 먼저 컨텍스트 상한과 툴 출력 크기를 줄이고, 컴팩션 호출을 관찰하라는 쪽이다.

## 이 조합은 대화형 만능 모델보다 개인용 배치에 잘 맞는다

M1 Max 64GB에서 DFlash2 조합을 검토할 만한 작업은 속도·프라이버시·동시성의 우선순위가 맞아야 한다.

| 잘 맞는 작업 | 이유 |
|---|---|
| 프라이버시가 필요한 단일 파일 코딩 보조 | 코드를 외부로 보내지 않고 4K 안팎 컨텍스트를 유지할 수 있다 |
| 오프라인 배치 처리 | 기다리는 시간이 처리량으로 누적되고 단일 요청 제약이 덜하다 |
| 문서·메일 구조화 추출 | 짧고 예측 가능한 출력은 acceptance가 높아지기 쉽다 |
| 커밋 메시지·PR 요약 초안 | 작은 호출을 반복하는 자동화에 적합하다 |

반대로 다음 작업은 기대치를 낮춰야 한다.

- 수만 토큰 원문을 한 번에 요약하는 작업
- 여러 사용자가 동시에 접속하는 서버
- 높은 temperature의 자유 창작
- 첫 응답이 1초 안에 와야 하는 인터랙티브 UI
- frontier 모델 수준의 추론 품질이 필요한 작업

200토큰 출력이면 AR 약 10초, DFlash2 약 7초로 줄어들 수 있지만 4,000토큰 출력은 여전히 수 분이 걸린다. 이 조합의 가치는 “클라우드처럼 즉시 반응한다”가 아니라, 로컬에서 밤새 처리할 작업을 조금 더 많이 끝내는 데 있다.

## 이 글의 다음 실험은 공개 수치를 내 M1 Max에서 재현하는 것이다

현재까지 확정된 것은 공개 자료를 읽고 세운 가설이다. 다음 순서로 직접 검증할 예정이다.

| 단계 | 확인할 것 | 판정 기준 |
|---|---|---|
| E0 | `mlx_lm.generate` baseline | AR 15~20 tok/s 범위인지 |
| E1 | Issue #60 명령 재현 | `w4a32`에서 25 tok/s 이상·acceptance 약 70%인지 |
| E2 | 기본 `w4` 실행 | acceptance 0%와 역효과가 재현되는지 |
| E3 | block size 3·5·7 sweep | 27 tok/s를 넘기는 지점이 있는지 |
| E4 | oMLX 서버 경로 | CLI와 서버의 커널·속도 차이 |
| E5 | 코딩·수학·자유 서술 비교 | 태스크별 acceptance 변화 |
| E6 | opencode 연결 | TTFT·총 소요·툴콜 성공 여부 |
| E7 | 긴 세션 컴팩션 | 컴팩션 1회가 실제로 몇 분인지 |

모든 실행에서 디코드 tok/s만 기록하지 않고 acceptance rate, TTFT, peak memory, 컨텍스트 길이, 출력 완료 여부를 함께 남겨야 한다. 특히 27.12 tok/s가 재현되지 않더라도 실패 원인을 기록하는 것이 이 실험의 결과다.

## 공개 수치는 가능성을 보여주고, 실제 선택은 acceptance가 결정한다

현재 자료만으로 내릴 수 있는 결론은 세 가지다.

1. **가능성**: M1 Max 64GB에서도 Qwen3.8-27B와 DFlash2를 올바르게 구성하면 27 tok/s대가 나온 공개 사례가 있다.
2. **조건**: `w4a32`, acceptance rate, 드래프터·타겟 동시 상주, 짧은 컨텍스트와 낮은 temperature가 중요하다.
3. **한계**: prefill·긴 컨텍스트·동시성·툴콜은 별도로 남아 있고, 현재 수치는 아직 내 머신의 자체 벤치마크가 아니다.

그래서 이 조합을 바로 “27B 모델을 클라우드처럼 쓸 수 있게 해주는 기술”이라고 부르지는 않겠다. 더 정확한 표현은 **메모리 대역폭에 막힌 dense 모델의 디코드 구간을, 검증 가능한 출력에서 선택적으로 줄여주는 기술**이다.

다음에는 E0부터 직접 실행해 공개 수치와 내 M1 Max의 차이를 확인할 예정이다. 그 결과가 나온 뒤에야 30 tok/s에 도전할지, DFlash2를 포기하고 단순한 baseline 런타임으로 돌아갈지 판단할 수 있다.

## 참고 자료

- [DFlash 논문](https://arxiv.org/abs/2602.06036)
- [DFlash2 발표 — Inco AI](https://inco.ai/blog/dflash2/)
- [dflash-mlx Apple Silicon 포트](https://github.com/bstnxbt/dflash-mlx)
- [Issue #60 — M1 Max 64GB 실측](https://github.com/bstnxbt/dflash-mlx/issues/60)
- [Issue #32 — 장기 컨텍스트 역효과](https://github.com/bstnxbt/dflash-mlx/issues/32)
- [Issue #21 — prefill 성능 이슈](https://github.com/bstnxbt/dflash-mlx/issues/21)
- [Qwen3.8-27B-DFlash2 모델](https://huggingface.co/z-lab/Qwen3.8-27B-DFlash2)
- [Qwen3.8-27B 모델](https://huggingface.co/Qwen/Qwen3.8-27B)
- [oMLX + DFlash2 설정 가이드](https://github.com/yusenthebot/omlx-qwen38-dflash-setup)
- [oMLX](https://github.com/jundot/omlx)
- [MTP 개념 설명](https://sebastianraschka.com/llm-architecture-gallery/mtp)
- [mlx-optiq 스펙큘레이티브 디코딩 문서](https://mlx-optiq.com/docs/mtp)
- [Qwen3.8-27B 하드웨어 가이드](https://www.contextstudios.ai/blog/qwen-3-8-27b-hardware-guide)
- [Pi Coding Agent](https://pi.dev/)
- [opencode 설정 문서](https://opencode.ai/docs/config)
